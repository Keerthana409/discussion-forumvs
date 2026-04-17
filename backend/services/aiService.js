/**
 * AI Service
 * Handles real AI calls to Gemini and provides high-quality heuristic fallbacks 
 * when an API key is missing.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class AiService {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        this.isMockMode = !apiKey || apiKey === 'your_gemini_api_key_here';
        
        if (!this.isMockMode) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
    }

    getStatus() {
        return {
            isActive: !this.isMockMode,
            mode: this.isMockMode ? 'PREVIEW' : 'REAL'
        };
    }

    /**
     * Extracts keywords to create smart tags and titles without an AI key.
     */
    generateHeuristicMetadata(content, type) {
        const cleanContent = content.trim().replace(/[^\w\s]/gi, '');
        const words = cleanContent.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        
        // Remove common filler words
        const stopWords = ['would', 'could', 'should', 'there', 'their', 'about', 'these', 'those'];
        const keywords = [...new Set(words.filter(w => !stopWords.includes(w)))];

        if (type === 'title') {
            const words = content.split(' ').filter(w => w.length > 2);
            return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
        }

        // Tags logic: Pick 3-5 unique keywords
        if (keywords.length < 2) return "General, Discussion, Platform";
        return keywords.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(', ');
    }

    /**
     * Advanced Extractive Summarizer
     * Uses word frequency and sentence scoring to simulate AI summarization.
     */
    generateHeuristicSummary(content, level) {
        if (!content || content.length < 50) return content;

        const cleanContent = content.trim().replace(/\s+/g, ' ');
        // Improved sentence splitting to better handle periods and abbreviations
        const sentences = cleanContent.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(s => s.length > 10);
        if (sentences.length <= 1) return content;

        // 1. Calculate word frequencies (ignoring "stop words")
        const stopWords = new Set(['the', 'and', 'that', 'this', 'with', 'from', 'they', 'have', 'been', 'which', 'about', 'their', 'there', 'because', 'through']);
        const words = cleanContent.toLowerCase().match(/\b\w{4,}\b/g) || [];
        const freqMap = {};
        words.forEach(w => {
            if (!stopWords.has(w)) freqMap[w] = (freqMap[w] || 0) + 1;
        });

        // 2. Score sentences based on word frequencies
        const scoredSentences = sentences.map((s, index) => {
            const sWords = s.toLowerCase().match(/\b\w{4,}\b/g) || [];
            let score = 0;
            sWords.forEach(w => {
                if (freqMap[w]) score += freqMap[w];
            });
            // Position-based boosting (Intro and Conclusion sentences are often most relevant)
            if (index === 0) score *= 1.5;
            if (index === sentences.length - 1) score *= 1.3;
            return { text: s.trim(), score, index };
        });

        // 3. Select top sentences based on length and relevance
        const count = level === 'SHORT' ? 1 : (level === 'MEDIUM' ? 3 : 5);
        const topSentences = scoredSentences
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.min(count, sentences.length))
            .sort((a, b) => a.index - b.index); // Restore original order for readability

        // 4. Format into a professional summary
        if (level === 'SHORT') {
            const bestSentence = topSentences[0].text;
            return `AI Synthesis: This discussion highlights that ${bestSentence.charAt(0).toLowerCase() + bestSentence.slice(1)}`;
        }

        const summaryBody = topSentences.map(s => s.text).join('. ');
        const intro = `Generative Overview: The content explores complex themes with a focus on data and context. `;
        const detailedConclusion = `\n\nOverall, the analysis suggests these points represent the core argument of the discussion.`;
        
        return `${intro}${summaryBody}${level === 'DETAILED' ? detailedConclusion : ''}`;
    }

    async getSummary(content, level) {
        if (this.isMockMode) {
            return this.generateHeuristicSummary(content, level);
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `
                Summarize the following content at a ${level} level. 
                SHORT: 1 line. MEDIUM: 2-3 lines. DETAILED: 4-5 lines.
                CONTENT: ${content}
                SUMMARY:
            `;
            const result = await model.generateContent(prompt);
            return (await result.response).text().trim();
        } catch (err) {
            console.error("Gemini API Error:", err);
            return "AI Summarization is currently unavailable. Please try again later.";
        }
    }
}

module.exports = new AiService();
