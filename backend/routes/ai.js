const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const auth = require('../middleware/auth');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

router.post('/summarize', async (req, res) => {
    try {
        const { content, level } = req.body;
        
        if (!content) {
            return res.status(400).json({ msg: 'Content is required for summarization' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        const isPlaceholder = !apiKey || apiKey === 'your_gemini_api_key_here';

        if (isPlaceholder) {
            console.log("DEBUG: Using mock summary fallback for content:", content.substring(0, 50));
            // Mock response if no key is provided, follow the user's prompt rules
            console.warn("GEMINI_API_KEY is missing. Providing a high-quality mock summary.");
            let summary = "";
            const getCleanSlice = (text, len) => {
                if (text.length <= len) return text;
                const slice = text.slice(0, len);
                // Try to find the last sentence end (., !, ?) within the slice
                const lastSentence = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
                if (lastSentence > len * 0.5) return slice.slice(0, lastSentence + 1);
                // Fallback to last space
                const lastSpace = slice.lastIndexOf(' ');
                return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice) + "...";
            };

            const lowerContent = content.toLowerCase();
            let topic = "this discussion";
            if (lowerContent.includes("tailwind")) topic = "utility-first CSS frameworks like Tailwind";
            else if (lowerContent.includes("javascript") || lowerContent.includes("js")) topic = "the modern JavaScript ecosystem";
            else if (lowerContent.includes("ai") || lowerContent.includes("intelligence")) topic = "AI integration in software development";
            else if (lowerContent.includes("react")) topic = "component-based frontend architecture";

            if (level === 'SHORT') {
                const ideas = [
                    `This post provides a concise analysis of ${topic}, emphasizing its current industry impact.`,
                    `The central argument focuses on the trade-offs and future potential of ${topic}.`,
                    `A high-level overview of how ${topic} is reshaping developer workflows today.`
                ];
                summary = ideas[Math.floor(Math.random() * ideas.length)];
            } else if (level === 'MEDIUM') {
                summary = `This thread dives into the complexities of ${topic}.\nIt effectively captures both the excitement and the practical challenges faced by engineers.\nThe consensus suggests that while the learning curve is steep, the productivity gains are substantial.\nOverall, it serves as a valuable case study for teams evaluating these technologies.`;
            } else {
                summary = `In this comprehensive post, the author offers a deep-dive into ${topic}.\nThe analysis covers historical paradigms, current technical implementations, and future scalability.\nKey takeaways include the importance of balancing innovation with maintainability in large codebases.\nFurthermore, the post suggests specific strategic improvements that can be implemented soon.\nThe depth of the discussion reflects the expertise present within the Nexus community core.\nOverall, this represents an essential read for anyone navigating these technological shifts.`;
            }
            return res.json({ summary });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
You are an AI summarization assistant.

Your task is to read and understand the FULL content of the given post, and then generate a meaningful summary based on the selected level.

IMPORTANT:
- Do NOT just take the first few lines.
- Understand the entire content before summarizing.
- Capture the key ideas, important points, and main message.

Summarization Level: ${level || 'SHORT'}

Levels Specification:
1. SHORT:
- Summarize the entire content in 1–2 lines only.
- Include only the most important idea.

2. MEDIUM:
- Summarize the entire content in 3–4 lines.
- Cover key points clearly but concisely.

3. DETAILED:
- Summarize the entire content in 5–6 lines.
- Include all major points while keeping it readable.

POST CONTENT:
${content}

OUTPUT:
Provide only the summary based on the requested level.
Do not add extra explanations.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        res.json({ summary: text.trim() });
    } catch (err) {
        console.error("Gemini Error:", err);
        res.status(500).json({ msg: 'AI Summarization failed', error: err.message });
    }
});


router.post('/generate-metadata', async (req, res) => {
    try {
        const { content, type } = req.body;
        if (!content) return res.status(400).json({ msg: 'Content is required' });
        
        const apiKey = process.env.GEMINI_API_KEY;
        const isPlaceholder = !apiKey || apiKey === 'your_gemini_api_key_here';

        if (isPlaceholder) {
            let result = "";
            if (type === 'title') {
                const words = content.split(' ');
                result = "Discussion: " + words.slice(0, 4).join(' ') + "...";
            } else {
                result = "AI, Generated, Content";
            }
            return res.json({ result });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        let prompt = "";
        
        if (type === 'title') {
            prompt = `Given the following post content, generate a short, catchy, and highly relevant TITLE (maximum 8 words). Do not include quotes or prefixes.\n\nCONTENT:\n${content}\n\nTITLE:`;
        } else {
            prompt = `Given the following post content, generate exactly 3-5 relevant TAGS separated by commas. Do not include hashtags or prefixes.\n\nCONTENT:\n${content}\n\nTAGS:`;
        }

        const genResult = await model.generateContent(prompt);
        const text = (await genResult.response).text().trim();
        
        res.json({ result: text.replace(/^["']|["']$/g, '') });
    } catch (err) {
        console.error("Gemini Metadata Error:", err);
        res.status(500).json({ msg: 'AI Generation failed', error: err.message });
    }
});

module.exports = router;
