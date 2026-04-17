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
     * Attempts to summarize content without a real AI.
     * Use sentence extraction and "rephrasing" patterns.
     */
    generateHeuristicSummary(content, level) {
        if (!content) return "";

        // Clean content
        const cleanContent = content.trim().replace(/\s+/g, ' ');
        // Split into sentences (simple regex)
        const sentences = cleanContent.split(/[.!?]+\s/).filter(s => s.length > 10);
        
        if (sentences.length === 0) return cleanContent.slice(0, 100) + "...";

        const firstSentence = sentences[0];
        const lastSentence = sentences.length > 1 ? sentences[sentences.length - 1] : "";
        const middleSentence = sentences.length > 2 ? sentences[Math.floor(sentences.length / 2)] : "";

        // Identify tech keywords for context
        const techTopics = {
            tailwind: "utility-first styling",
            javascript: "the JS ecosystem",
            react: "component architecture",
            ai: "artificial intelligence",
            database: "data persistence"
        };
        
        let foundTopic = "this discussion";
        for (const [key, label] of Object.entries(techTopics)) {
            if (content.toLowerCase().includes(key)) {
                foundTopic = label;
                break;
            }
        }

        if (level === 'SHORT') {
            // Pick the most representative sentence or combine first and last if and meaningful
            return `Key Insight: ${firstSentence.length < 120 ? firstSentence : firstSentence.slice(0, 120) + "..."}`;
        }

        if (level === 'MEDIUM') {
            const part1 = `The author explores ${foundTopic}, opening with: "${firstSentence.slice(0, 80)}..."`;
            const part2 = middleSentence ? ` They further address that ${middleSentence.slice(0, 100)}.` : "";
            return `${part1}${part2}\nIn conclusion, the post highlights meaningful perspectives on ${foundTopic}.`;
        }

        // DETAILED
        const part1 = `In this deep-dive into ${foundTopic}, the core premise is established as: "${firstSentence.slice(0, 100)}..."`;
        const part2 = middleSentence ? `\nThe discussion expands on various technical nuances, specifically noting: "${middleSentence.slice(0, 120)}..."` : "";
        const part3 = lastSentence ? `\nFinally, the author concludes with a focused takeaway: "${lastSentence.slice(0, 100)}..."` : "";
        
        return `${part1}${part2}${part3}\nOverall, this thread serves as a valuable resource for understanding ${foundTopic} within the current developer workflow.`;
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
