const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');

const calculateSpamScore = (text) => {
    let score = 0;
    const lowerText = text.toLowerCase();
    const keywords = [
        'buy', 'buy 1 get 1 free', 'buy now', 'free', 'click here', 
        'earn money', 'discount', 'offer', 'prize', 'winner', 
        'urgent', 'guaranteed', 'cash bonus', 'act now',
        'make money fast', 'low price', 'best price', 'cryptocurrency',
        'lottery', 'investment opportunity', 'wealth', 'profit',
        'subscribe', 'follow me', 'check out my bio'
    ];
    keywords.forEach(word => {
        // use regex to match whole words for short words like 'buy' or 'free' to reduce false positives
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(lowerText)) score += 2;
    });
    if (/(http|https|www\.)[^\s]+/i.test(text)) score += 3;
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length - 2; i++) {
        if (words[i] !== "" && words[i] === words[i+1] && words[i+1] === words[i+2]) {
            score += 2; break;
        }
    }
    const upperCount = (text.match(/[A-Z]/g) || []).length;
    const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
    if (alphaCount > 5 && (upperCount / alphaCount) > 0.6) score += 2;
    return score;
};

const calculateSimilarity = (newText, oldText) => {
    const s1 = newText.toLowerCase().split(/\W+/).filter(w=>w.length>2);
    const s2 = oldText.toLowerCase().split(/\W+/).filter(w=>w.length>2);
    if(s1.length === 0 || s2.length === 0) return 0;
    const intersection = s1.filter(x => s2.includes(x));
    const unique = new Set([...s1, ...s2]);
    return (intersection.length / unique.size) * 100;
};

const checkBadWords = (text) => /hate|kill|scam|abuse|fraud|jerk|loser/i.test(text);

// Delete a post by the author (Moved to top to prevent route shadowing)
router.delete('/:id', auth, async (req, res) => {
    console.log(`[DeleteRequest] PostID: ${req.params.id}, User: ${req.user.username}`);
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid Post ID' });
        }
        const post = await Post.findById(req.params.id);
        if (!post) {
            console.log(`[DeleteRequest] Post not found: ${req.params.id}`);
            return res.status(404).json({ msg: 'Post not found' });
        }

        console.log(`[DeleteRequest] PostAuthor: ${post.author}, Requester: ${req.user.username}`);

        // Check ownership or admin role
        if (post.author !== req.user.username && req.user.role !== 'admin') {
            return res.status(403).json({ msg: 'Access denied. You can only delete your own posts.' });
        }

        await Post.findByIdAndDelete(req.params.id);
        console.log(`[DeleteRequest] Successfully deleted post: ${req.params.id}`);
        res.json({ msg: 'Post deleted successfully' });
    } catch (err) {
        console.error(`[DeleteRequest] Error: ${err.message}`);
        res.status(500).send('Server Error');
    }
});

router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const posts = await Post.find().sort({ timestamp: -1 }).skip(skip).limit(limit);
        const total = await Post.countDocuments();
        
        res.json({
            posts,
            hasMore: skip + posts.length < total,
            total
        });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Get posts by a specific user
router.get('/user/:username', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const posts = await Post.find({ author: req.params.username }).sort({ timestamp: -1 }).skip(skip).limit(limit);
        const total = await Post.countDocuments({ author: req.params.username });
        
        res.json({
            posts,
            hasMore: skip + posts.length < total,
            total
        });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const { title, content, tags, image } = req.body;
        const allPosts = await Post.find();
        
        const fullText = title + " " + content;
        let maxSimilarity = 0;
        let similarPostId = null;
        
        allPosts.forEach(p => {
            const sim = calculateSimilarity(fullText, p.title + " " + p.content);
            if(sim > maxSimilarity) {
                maxSimilarity = sim;
                similarPostId = p._id;
            }
        });

        const spamScore = calculateSpamScore(fullText);
        const hasBadWords = checkBadWords(fullText);

        let finalStatus = 'safe';
        let foundSimilarTo = null;

        if (spamScore > 3 || hasBadWords) {
            finalStatus = 'spam';
        } else if (maxSimilarity > 80) {
            finalStatus = 'duplicate';
            foundSimilarTo = similarPostId;
        } else if (maxSimilarity > 60) {
            finalStatus = 'similar';
            foundSimilarTo = similarPostId;
        }

        const newPost = new Post({
            title, content, tags, image,
            author: req.user.username,
            spamScore,
            status: finalStatus,
            similarTo: foundSimilarTo
        });

        const post = await newPost.save();

        if (finalStatus !== 'safe') {
            await new Notification({
                recipient: 'Administrator',
                sender: 'System AI',
                type: 'admin_spam_alert',
                context: `flagged post "${post.title}" as ${finalStatus}`,
                postId: post._id.toString()
            }).save();
        }

        res.json(post);
    } catch (err) {
        console.log(err);
        res.status(500).send('Server Error');
    }
});

// Vote
router.post('/:id/vote', auth, async (req, res) => {
    try {
        const type = req.body.type;
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ msg: 'Invalid Post ID' });
        let post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        if (!post.upvoters) post.upvoters = [];
        if (!post.downvoters) post.downvoters = [];

        const username = req.user.username;
        let weight = 1;
        if (req.user.role !== 'admin' && req.user.id !== 'admin_id') {
            let user = await User.findById(req.user.id);
            if(user) {
                let rep = parseInt(user.reputation || 0);
                weight = Math.max(1, Math.floor(Math.log(rep + 1)));
            }
        } else {
            weight = 5; // Admins have more voting power visually
        }

        const hasUpvoted = post.upvoters.includes(username);
        const hasDownvoted = post.downvoters.includes(username);

        if (type === 'up') {
            if (hasUpvoted) {
                post.upvoters = post.upvoters.filter(u => u !== username);
                post.likes = Math.max(0, post.likes - weight);
            } else {
                post.upvoters.push(username);
                post.likes += weight;
                if (hasDownvoted) {
                    post.downvoters = post.downvoters.filter(u => u !== username);
                    post.dislikes = Math.max(0, post.dislikes - weight);
                }
                if(post.author !== 'Administrator') {
                    await User.findOneAndUpdate({ username: post.author }, { $inc: { reputation: 1 } });
                }
                if (username !== post.author) {
                    await new Notification({ recipient: post.author, sender: username, type: 'upvote', context: `upvoted your post: "${post.title}"` }).save();
                }
            }
        } else {
            if (hasDownvoted) {
                post.downvoters = post.downvoters.filter(u => u !== username);
                post.dislikes = Math.max(0, post.dislikes - weight);
            } else {
                post.downvoters.push(username);
                post.dislikes += weight;
                if (hasUpvoted) {
                    post.upvoters = post.upvoters.filter(u => u !== username);
                    post.likes = Math.max(0, post.likes - weight);
                }
            }
        }

        await post.save();
        res.json(post);
    } catch (err) {
        console.error("Vote Error:", err);
        res.status(500).json({ msg: 'Server Error', error: String(err) });
    }
});

// Reaction
router.post('/:id/react', auth, async (req, res) => {
    try {
        const { type } = req.body;
        const validTypes = ['fire', 'laugh', 'heart', 'sad'];
        if (!validTypes.includes(type)) return res.status(400).json({ msg: 'Invalid reaction type' });

        let post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        // Robust initialization for counters
        if (!post.reactions) post.reactions = {};
        validTypes.forEach(t => {
            if (post.reactions[t] === undefined || post.reactions[t] === null) {
                post.set(`reactions.${t}`, 0);
            }
        });

        if (!post.reactionDetails) post.reactionDetails = [];
        if (!post.reactedUsers) post.reactedUsers = [];

        const existingIndex = post.reactionDetails.findIndex(r => r.username === req.user.username);

        if (existingIndex > -1) {
            const oldType = post.reactionDetails[existingIndex].type;

            if (oldType === type) {
                // TOGGLE OFF
                const currentVal = post.reactions[type] || 0;
                post.set(`reactions.${type}`, Math.max(0, currentVal - 1));
                post.reactionDetails.splice(existingIndex, 1);
                post.reactedUsers = post.reactedUsers.filter(u => u !== req.user.username);
            } else {
                // SWITCH
                const oldVal = post.reactions[oldType] || 0;
                const newVal = post.reactions[type] || 0;
                post.set(`reactions.${oldType}`, Math.max(0, oldVal - 1));
                post.set(`reactions.${type}`, newVal + 1);
                post.reactionDetails[existingIndex].type = type;
            }
        } else {
            // ADD NEW
            const currentVal = post.reactions[type] || 0;
            post.set(`reactions.${type}`, currentVal + 1);
            post.reactionDetails.push({ username: req.user.username, type });
            post.reactedUsers.push(req.user.username);

            // Notify author
            if (req.user.username !== post.author) {
                try {
                    await new Notification({ 
                        recipient: post.author, 
                        sender: req.user.username, 
                        type: 'react', 
                        context: `reacted to your post: "${post.title}"`, 
                        postId: post._id.toString() 
                    }).save();
                } catch (e) {}
            }
        }

        post.markModified('reactions');
        post.markModified('reactionDetails');
        await post.save();

        res.json(post);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Comment generic recursive append
router.post('/:id/comment', auth, async (req, res) => {
    try {
        const { content, targetCommentId } = req.body;
        if (!content || content.trim() === "") return res.status(400).json({ msg: 'Content is required' });
        let post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        const newComment = { id: Date.now().toString() + Math.random(), author: req.user.username, content, timestamp: new Date(), replies: [] };

        if (!targetCommentId) {
            post.comments.push(newComment);
            await new Notification({ recipient: post.author, sender: req.user.username, type: 'comment', context: `commented on your post: "${post.title}"`, postId: post._id.toString() }).save();
        } else {
            let commentAuthor = post.author;
            const insertReply = (commentsArr, targetId, reply) => {
                for (let c of commentsArr) {
                    if (c.id === targetId) {
                        commentAuthor = c.author;
                        if (!c.replies) c.replies = [];
                        c.replies.push(reply);
                        return true;
                    }
                    if (c.replies && insertReply(c.replies, targetId, reply)) return true;
                }
                return false;
            };
            insertReply(post.comments, targetCommentId, newComment);
            await new Notification({ recipient: commentAuthor, sender: req.user.username, type: 'comment', context: `replied to your comment in: "${post.title}"`, postId: post._id.toString() }).save();
        }
        
        post.markModified('comments'); 
        await post.save();
        res.json(post);
    } catch(err) {
        res.status(500).send('Server Error');
    }
});

// (Moved to top)

// Admin Delete Comment recursive logic
router.delete('/:id/comment/:commentId', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ msg: 'Access denied. Admin only.' });
        }
        let post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        const deleteComment = (commentsArr, targetId) => {
            for (let i = 0; i < commentsArr.length; i++) {
                if (commentsArr[i].id.toString() === targetId.toString()) {
                    commentsArr.splice(i, 1);
                    return true;
                }
                if (commentsArr[i].replies && deleteComment(commentsArr[i].replies, targetId)) {
                    return true;
                }
            }
            return false;
        }

        const deleted = deleteComment(post.comments, req.params.commentId);
        if (!deleted) return res.status(404).json({ msg: 'Comment not found' });

        post.markModified('comments');
        await post.save();
        res.json(post);
    } catch(err) {
        res.status(500).send('Server Error');
    }
});

// Report
router.post('/:id/report', auth, async (req, res) => {
    console.log(`[ReportRequest] PostID: ${req.params.id}, Reporter: ${req.user.username}`);
    try {
        let post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        post.hasReport = true;
        post.reportReason = req.body.reason || "No reason provided";
        post.reporter = req.body.reporter || req.user.username;
        post.status = 'under review';

        await post.save();

        await new Notification({
            recipient: 'Administrator',
            sender: req.user.username,
            type: 'admin_report_alert',
            context: `reported post "${post.title}" for: ${post.reportReason}`,
            postId: post._id.toString()
        }).save();

        res.json(post);
    } catch(err) {
        console.log(err);
        res.status(500).json({ msg: 'Server Error', error: String(err), stack: err.stack });
    }
});

// Duplicate removal of the previous route at the end of file (I'll just remove it)
module.exports = router;
