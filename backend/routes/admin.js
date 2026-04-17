const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const User = require('../models/User');
const Usage = require('../models/Usage');

// Middleware to check admin Role
const adminAuth = (req, res, next) => {
    if(req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin only.' });
    }
    next();
};

router.get('/stats', auth, adminAuth, async (req, res) => {
    try {
        const posts = await Post.find();
        const users = await User.find();
        const usages = await Usage.find();

        const stats = {
            totalPosts: posts.length,
            spamPosts: posts.filter(p => p.status === 'spam').length,
            toxicPosts: posts.filter(p => p.status === 'toxic').length,
            aiFlaggedPosts: posts.filter(p => p.isAiFlagged).length,
            duplicatePosts: posts.filter(p => p.status === 'duplicate').length,
            similarPosts: posts.filter(p => p.status === 'similar').length,
            removedPosts: posts.filter(p => p.status === 'removed').length,
            reportedPosts: posts.filter(p => p.hasReport || p.status === 'under review').length,
            suspiciousUsers: users.filter(u => u.isSuspicious).length
        };

        // Get basic user info for suspicious list if needed
        const usersInfo = users.map(u => ({ username: u.username, isSuspicious: u.isSuspicious }));

        res.json({ stats, usages, users: usersInfo, rawPosts: posts });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.patch('/post/:id', auth, adminAuth, async (req, res) => {
    const { action } = req.body; 
    try {
        let post = await Post.findById(req.params.id);
        if(!post) return res.status(404).json({ msg: 'Post not found' });

        if(action === 'safe' || action === 'restore') {
            post.status = 'safe';
            post.hasReport = false;
            post.isAiFlagged = false;
            post.aiReason = "";
        } else if(action === 'unflag') {
            post.isAiFlagged = false;
            post.aiReason = "";
        } else if(action === 'remove') {
            post.status = 'removed';
        } else if(action === 'hide') {
            post.status = 'hidden';
        } else if(action === 'spam') {
            post.status = 'spam';
            post.isAiFlagged = false;
            post.aiReason = "";
        } else if(action === 'toxic') {
            post.status = 'toxic';
            post.isAiFlagged = false;
            post.aiReason = "";
        } else if(action === 'duplicate') {
            post.status = 'duplicate';
            post.isAiFlagged = false;
            post.aiReason = "";
        } else if(action === 'pin') {
            post.isPinned = !post.isPinned;
        }

        await post.save();
        res.json(post);
    } catch(err) {
        console.error(`[AdminAPI] Error patching post: ${err.message}`);
        res.status(500).send('Server Error');
    }
});

router.delete('/post/:id', auth, adminAuth, async (req, res) => {
    try {
        const post = await Post.findByIdAndDelete(req.params.id);
        if(!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }
        res.json({ msg: 'Post permanently deleted' });
    } catch(err) {
        console.error(`[AdminAPI] Error deleting post: ${err.message}`);
        res.status(500).send('Server Error');
    }
});

router.post('/warn/:username', auth, adminAuth, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if(!user) return res.status(404).json({ msg: 'User not found' });

        user.warnings += 1;
        if(user.warnings >= 3) {
            user.isSuspicious = true;
            user.isRestricted = true;
        }
        await user.save();

        const Notification = require('../models/Notification');
        await new Notification({
            recipient: user.username,
            sender: 'Administrator',
            type: 'admin_warning',
            context: `issued an official warning. You have ${user.warnings} warning(s).`
        }).save();

        res.json(user);
    } catch(err) {
        console.log(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
