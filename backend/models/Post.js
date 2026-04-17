const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    tags: [{ type: String }],
    image: { type: String }, // Base64
    video: { type: String }, // Base64
    author: { type: String, required: true },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    upvoters: [{ type: String }],
    downvoters: [{ type: String }],
    spamScore: { type: Number, default: 0 },
    status: { type: String, default: 'safe', enum: ['safe', 'spam', 'duplicate', 'similar', 'under review', 'removed', 'hidden'] },
    isPinned: { type: Boolean, default: false },
    comments: [mongoose.Schema.Types.Mixed], // Dynamic schema for nested replies handling mapping to existing format
    reactions: {
        fire: { type: Number, default: 0 },
        laugh: { type: Number, default: 0 },
        heart: { type: Number, default: 0 },
        sad: { type: Number, default: 0 }
    },
    reactionDetails: [{ 
        username: String, 
        type: { type: String, enum: ['fire', 'laugh', 'heart', 'sad'] } 
    }],
    reactedUsers: [{ type: String }],
    hasReport: { type: Boolean, default: false },
    reportReason: { type: String },
    reporter: { type: String },
    similarTo: { type: String }, // ID of the post this is a duplicate/similar of
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema);
