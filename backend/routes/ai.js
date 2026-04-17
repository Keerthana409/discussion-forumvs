const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const aiService = require('../services/aiService');

// @route   GET /api/ai/status
// @desc    Check AI service status (Real vs Preview)
router.get('/status', auth, (req, res) => {
    res.json(aiService.getStatus());
});

// @route   POST /api/ai/summarize
// @desc    Summarize post content
router.post('/summarize', auth, async (req, res) => {
    try {
        const { content, level } = req.body;
        
        if (!content) {
            return res.status(400).json({ msg: 'Content is required for summarization' });
        }

        const summary = await aiService.getSummary(content, level.toUpperCase());
        res.json({ summary, ...aiService.getStatus() });
    } catch (err) {
        console.error("AI Route Error:", err);
        res.status(500).json({ msg: 'AI Summarization failed', error: err.message });
    }
});

// @route   POST /api/ai/generate-metadata
// @desc    Generate title or tags for a post
router.post('/generate-metadata', auth, async (req, res) => {
    try {
        const { content, type } = req.body;
        if (!content) return res.status(400).json({ msg: 'Content is required' });
        
        // Temporarily using internal mock logic for metadata as well if in mock mode
        // For a full implementation, this should also move to aiService
        const status = aiService.getStatus();
        
        if (status.mode === 'PREVIEW') {
            let result = "";
            if (type === 'title') {
                const words = content.split(' ');
                result = "Discussion: " + words.slice(0, 4).join(' ') + "...";
            } else {
                result = "AI, Generated, Content";
            }
            return res.json({ result, ...status });
        }

        // Real AI metadata generation (minimal logic for now to keep refactor focused)
        const result = await aiService.getSummary(`Generate a single ${type} for: ${content}`, 'SHORT');
        res.json({ result, ...status });
    } catch (err) {
        console.error("AI Metadata Error:", err);
        res.status(500).json({ msg: 'AI Generation failed', error: err.message });
    }
});

module.exports = router;
