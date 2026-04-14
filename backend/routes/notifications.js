const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// Get all notifications for user
router.get('/', auth, async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user.username })
            .sort({ timestamp: -1 })
            .limit(50); // limit to recent 50
        res.json(notifications);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Mark all as read
router.put('/read', auth, async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user.username, isRead: false },
            { $set: { isRead: true } }
        );
        res.json({ msg: 'Notifications marked as read' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Delete a single notification
router.delete('/:id', auth, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) return res.status(404).json({ msg: 'Notification not found' });
        
        // Ensure user is the recipient or an administrator
        if (notification.recipient !== req.user.username && req.user.role !== 'admin' && notification.recipient !== 'Administrator') {
            return res.status(403).json({ msg: 'Unauthorized' });
        }

        await Notification.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Notification removed' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Delete all notifications for a specific post
router.delete('/post/:postId', auth, async (req, res) => {
    try {
        await Notification.deleteMany({ 
            postId: req.params.postId, 
            recipient: req.user.username 
        });
        res.json({ msg: 'Post notifications cleared' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

module.exports = router;
