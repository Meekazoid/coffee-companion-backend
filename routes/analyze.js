// ==========================================
// ANTHROPIC API PROXY (PROTECTED)
// ==========================================

import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateUser } from '../middleware/auth.js';
import { sanitizeCoffeeData } from '../utils/sanitize.js';
import { buildCoffeeDefaults, extractCoffeeJsonFromAnthropicResponse } from '../utils/analyzeResponse.js';

const router = express.Router();

const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { 
        success: false, 
        error: 'AI analysis limit reached. Please try again in an hour.' 
    },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/', aiLimiter, authenticateUser, async (req, res) => {
    try {
        const { imageData, mediaType } = req.body;

        console.log(`📸 Analysis started for user: ${req.user.username}`);

        if (!imageData) {
            return res.status(400).json({ 
                success: false,
                error: 'Image data required' 
            });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('Analyze error: Missing ANTHROPIC_API_KEY');
            return res.status(503).json({
                success: false,
                error: 'AI analysis is temporarily unavailable. Please try again later.'
            });
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': process.env.ANTHROPIC_API_KEY
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mediaType || 'image/jpeg',
                                data: imageData
                            }
                        },
                        {
                            type: 'text',
                            text: `Analyze this coffee bag and extract the following information as JSON:
{
  "name": "coffee name or farm name",
  "origin": "country and region",
  "process": "processing method (washed, natural, honey, etc)",
  "cultivar": "variety/cultivar",
  "altitude": "altitude in masl",
  "roaster": "roaster name",
  "tastingNotes": "tasting notes"
}

Only return valid JSON, no other text.`
                        }
                    ]
                }]
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const providerError = data?.error?.message || 'AI provider request failed';
            console.error('Analyze provider error:', response.status, providerError);

            const statusCode = response.status === 429 ? 429 : 502;
            return res.status(statusCode).json({
                success: false,
                error: statusCode === 429
                    ? 'AI analysis limit reached. Please try again later.'
                    : 'Analysis provider is unavailable. Please try again.'
            });
        }

        const coffeeData = extractCoffeeJsonFromAnthropicResponse(data);

        // Apply defaults before sanitization
        const withDefaults = buildCoffeeDefaults(coffeeData);

        // Sanitize the data before returning
        const sanitized = sanitizeCoffeeData(withDefaults);

        res.json({
            success: true,
            data: sanitized
        });

    } catch (error) {
        console.error('Analyze error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Analysis failed. Please try again.'
        });
    }
});

export default router;
