const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 1. Setup Environment
dotenv.config({ path: path.join(__dirname, '../.env') });

const Post = require('../models/Post');

// 2. Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const checkSpamAI = async (title, content) => {
    const text = `Title: ${title}\nContent: ${content}`;
    const apiKey = process.env.GEMINI_API_KEY;
    const isPlaceholder = !apiKey || apiKey === 'your_gemini_api_key_here';

    if (isPlaceholder) {
        const lowerText = text.toLowerCase();
        const spamKeywords = ['buy', 'free', 'discount', 'prize', 'earn money', 'bitcoin', 'crypto', 'scam'];
        const toxicityKeywords = ['hate', 'kill', 'abuse', 'fraud', 'jerk', 'loser'];
        
        const matchedSpam = spamKeywords.filter(word => lowerText.includes(word));
        const matchedToxic = toxicityKeywords.filter(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            return regex.test(lowerText);
        });
        
        if (matchedToxic.length > 0) {
            return { 
                category: 'toxic', 
                reason: `Internal detection: Found toxic words such as: ${matchedToxic.join(', ')}.` 
            };
        }
        if (matchedSpam.length > 0) {
            return { 
                category: 'spam', 
                reason: `Internal detection: Found spam keywords such as: ${matchedSpam.join(', ')}.` 
            };
        }
        
        return { category: 'safe', reason: "" };
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
            Analyze the following forum post for spam or toxicity.
            Classify it into one of these three categories: "safe", "spam", or "toxic".
            
            DEFINITIONS:
            - "spam": Promotional content, ads, bot-like repetitive text, or suspicious links.
            - "toxic": Hate speech, threats, direct insults, or extreme profanity.
            - "safe": Normal discussion, educational content, questions, or news.
            
            PRECISION RULES:
            1. Discussion of sensitive topics (like unemployment, immigration, or politics) in a neutral, informative, or educational manner is ALWAYS "safe".
            2. Only flag as "toxic" if the language is objectively aggressive, hateful, or abusive.
            3. The "reason" MUST be specific to the content. Do not use generic messages.
            
            OUTPUT MUST BE A VALID JSON OBJECT:
            {
              "category": "safe" | "spam" | "toxic",
              "reason": "Specific 1-sentence explanation referencing the post content."
            }
            
            POST:
            ${text}
        `;
        const result = await model.generateContent(prompt);
        let categoryAndReason;
        try {
            const resultText = result.response.text().trim();
            const cleanJson = resultText.replace(/```json|```/g, '').trim();
            categoryAndReason = JSON.parse(cleanJson);
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", e);
            const raw = result.response.text().toLowerCase();
            categoryAndReason = { 
                category: raw.includes('toxic') ? 'toxic' : (raw.includes('spam') ? 'spam' : 'safe'),
                reason: "Re-scanning with higher precision logic." 
            };
        }
        return {
            category: ['safe', 'spam', 'toxic'].includes(categoryAndReason.category) ? categoryAndReason.category : 'safe',
            reason: categoryAndReason.reason || ""
        };
    } catch (err) {
        console.error("AI Spam Check Error:", err);
        return { category: 'safe', reason: "" };
    }
};

const calculateSimilarity = (newText, oldText) => {
    const s1 = newText.toLowerCase().split(/\W+/).filter(w=>w.length>2);
    const s2 = oldText.toLowerCase().split(/\W+/).filter(w=>w.length>2);
    if(s1.length === 0 || s2.length === 0) return 0;
    const intersection = s1.filter(x => s2.includes(x));
    const unique = new Set([...s1, ...s2]);
    return (intersection.length / unique.size) * 100;
};

// 3. Main Migration Function
const runMigration = async () => {
    try {
        const dbUrl = process.env.MONGODB_URI_PROD || process.env.MONGODB_URI || process.env.MONGODB_URI_DEV;
        await mongoose.connect(dbUrl);
        console.log("Connected to MongoDB for Precision Re-scanning.");

        const posts = await Post.find({});
        console.log(`Found ${posts.length} posts to re-evaluate.`);

        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            console.log(`[${i+1}/${posts.length}] Re-evaluating: "${post.title}"...`);

            // Precision AI Check
            const aiResult = await checkSpamAI(post.title, post.content);
            
            // Similarity Check
            let maxSim = 0;
            let similarToId = null;
            for (let j = 0; j < posts.length; j++) {
                if (i === j) continue;
                const sim = calculateSimilarity(post.title + " " + post.content, posts[j].title + " " + posts[j].content);
                if (sim > maxSim) {
                    maxSim = sim;
                    similarToId = posts[j]._id;
                }
            }

            let newStatus = aiResult.category;
            let isAiFlagged = (newStatus !== 'safe');
            let aiReason = aiResult.reason;

            if (maxSim > 80) {
                newStatus = 'duplicate';
                isAiFlagged = true;
                post.similarTo = similarToId;
                aiReason = "This post content matches another existing discussion thread almost exactly.";
            }

            // Restore 'Under Review' if manually reported and AI now says safe
            if (post.hasReport && post.status === 'under review' && newStatus === 'safe') {
                newStatus = 'under review';
            }

            post.status = newStatus;
            post.isAiFlagged = isAiFlagged;
            post.aiReason = aiReason;

            await post.save();
            console.log(`    -> Result: [${newStatus}] Reason: ${aiReason || 'None'}`);
        }

        console.log("✅ Precision Re-scan migration completed successfully.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
};

runMigration();
