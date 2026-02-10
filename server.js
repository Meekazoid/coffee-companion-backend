// ==========================================
// BREWBUDDY BACKEND SERVER V5
// Mit Grinder Preference + Water Hardness Support
// ==========================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { initDatabase, getDatabase, queries, beginTransaction, commit, rollback } from './db/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// ENVIRONMENT VALIDATION
// ==========================================

function validateEnvironment() {
    const required = ['ANTHROPIC_API_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(key => console.error(`   - ${key}`));
        process.exit(1);
    }
    
    console.log('✅ Environment variables loaded');
}

validateEnvironment();

// ==========================================
// RATE LIMITING
// ==========================================

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { 
        success: false, 
        error: 'Too many requests, please try again later.' 
    },
    standardHeaders: true,
    legacyHeaders: false,
});

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

// ==========================================
// CORS CONFIGURATION
// ==========================================

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

// Warn if ALLOWED_ORIGINS is not set in production
if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    console.warn('⚠️  WARNING: ALLOWED_ORIGINS is not set in production!');
    console.warn('⚠️  CORS is misconfigured - this is a security risk.');
    console.warn('⚠️  Please set ALLOWED_ORIGINS environment variable.');
}

if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000');
    allowedOrigins.push('http://localhost:5173');
    allowedOrigins.push('http://127.0.0.1:5173');
}

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️  CORS blocked request from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID']
}));

app.use(express.json({ limit: '10mb' }));
app.use('/api/', apiLimiter);

console.log('🔒 CORS enabled for origins:', allowedOrigins);
console.log('🛡️ Rate limiting: 100 req/15min (general), 10 req/hour (AI)');

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================

/**
 * Extract authentication credentials from headers with fallback to body/query
 * Prioritizes headers for security (Authorization: Bearer <token>, X-Device-ID: <deviceId>)
 */
function extractAuthCredentials(req) {
    // Extract token - prefer Authorization header, fallback to body/query
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        token = req.body?.token || req.query?.token;
    }
    
    // Extract deviceId - prefer X-Device-ID header, fallback to body/query
    const deviceId = req.headers['x-device-id'] || req.body?.deviceId || req.query?.deviceId;
    
    return { token, deviceId };
}

/**
 * Authentication middleware - validates token and device binding
 * Returns authenticated user or sends error response
 */
async function authenticateUser(req, res, next) {
    try {
        const { token, deviceId } = extractAuthCredentials(req);

        if (!token) {
            return res.status(400).json({ 
                success: false,
                error: 'Token required' 
            });
        }

        if (!deviceId) {
            return res.status(400).json({ 
                success: false,
                error: 'Device ID required' 
            });
        }

        const user = await queries.getUserByToken(token);

        if (!user) {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid token' 
            });
        }

        // Check device binding
        if (user.device_id) {
            if (user.device_id !== deviceId) {
                return res.status(403).json({
                    success: false,
                    error: 'Device mismatch'
                });
            }
        } else {
            // First-time device binding
            await queries.bindDevice(user.id, deviceId, getDeviceInfo(req));
            console.log(`🔗 Device bound: User ${user.username} → Device ${deviceId.substring(0, 8)}...`);
        }

        // Attach user to request for use in route handlers
        req.user = user;
        next();

    } catch (error) {
        console.error('Authentication error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
}

/**
 * Helper: Get Device Info
 */
function getDeviceInfo(req) {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const platform = userAgent.includes('Mobile') ? 'mobile' : 'desktop';
    const os = userAgent.includes('Mac') ? 'macOS' : 
               userAgent.includes('Windows') ? 'Windows' :
               userAgent.includes('Linux') ? 'Linux' : 
               userAgent.includes('Android') ? 'Android' :
               userAgent.includes('iPhone') ? 'iOS' : 'unknown';
    
    return JSON.stringify({
        platform,
        os,
        userAgent: userAgent.substring(0, 100)
    });
}

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

await initDatabase();
const db = getDatabase();

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

/**
 * Validate Token with Device-Binding
 * GET /api/auth/validate
 * Accepts token from Authorization: Bearer <token> header or query param (fallback)
 * Accepts deviceId from X-Device-ID header or query param (fallback)
 */
app.get('/api/auth/validate', async (req, res) => {
    try {
        const { token, deviceId } = extractAuthCredentials(req);

        if (!token) {
            return res.status(400).json({ 
                success: false,
                error: 'Token required' 
            });
        }

        if (!deviceId) {
            return res.status(400).json({ 
                success: false,
                error: 'Device ID required' 
            });
        }

        const user = await queries.getUserByToken(token);

        if (!user) {
            return res.status(401).json({ 
                success: false,
                valid: false,
                error: 'Invalid token' 
            });
        }

        if (user.device_id) {
            if (user.device_id !== deviceId) {
                return res.status(403).json({
                    success: false,
                    valid: false,
                    error: 'This token is already bound to another device'
                });
            }
        } else {
            await queries.bindDevice(user.id, deviceId, getDeviceInfo(req));
            console.log(`🔗 Device bound: User ${user.username} → Device ${deviceId.substring(0, 8)}...`);
        }

        await queries.updateLastLogin(user.id);

        res.json({
            success: true,
            valid: true,
            user: {
                id: user.id,
                username: user.username,
                deviceId: user.device_id || deviceId,
                grinderPreference: user.grinder_preference || 'fellow',
                waterHardness: user.water_hardness || null,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        console.error('Validate error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

// ==========================================
// GRINDER PREFERENCE ENDPOINTS
// ==========================================

/**
 * Get Grinder Preference
 * GET /api/user/grinder
 */
app.get('/api/user/grinder', authenticateUser, async (req, res) => {
    try {
        const grinder = await queries.getGrinderPreference(req.user.id);

        res.json({ 
            success: true, 
            grinder: grinder 
        });

    } catch (error) {
        console.error('Get grinder error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

/**
 * Update Grinder Preference
 * POST /api/user/grinder
 */
app.post('/api/user/grinder', authenticateUser, async (req, res) => {
    try {
        const { grinder } = req.body;

        if (!grinder || !['fellow', 'comandante', 'timemore'].includes(grinder)) {
            return res.status(400).json({ 
                success: false,
                error: 'Valid grinder required (fellow, comandante, or timemore)' 
            });
        }

        await queries.updateGrinderPreference(req.user.id, grinder);

        console.log(`⚙️ Grinder updated: ${req.user.username} → ${grinder}`);

        res.json({ 
            success: true,
            grinder: grinder
        });

    } catch (error) {
        console.error('Update grinder error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

// ==========================================
// WATER HARDNESS ENDPOINTS (NEW)
// ==========================================

/**
 * Get Water Hardness
 * GET /api/user/water-hardness
 */
app.get('/api/user/water-hardness', authenticateUser, async (req, res) => {
    try {
        const waterHardness = await queries.getWaterHardness(req.user.id);

        res.json({ 
            success: true, 
            waterHardness: waterHardness 
        });

    } catch (error) {
        console.error('Get water hardness error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

/**
 * Update Water Hardness
 * POST /api/user/water-hardness
 */
app.post('/api/user/water-hardness', authenticateUser, async (req, res) => {
    try {
        const { waterHardness } = req.body;

        if (waterHardness === null || waterHardness === undefined) {
            return res.status(400).json({ 
                success: false,
                error: 'Water hardness value required' 
            });
        }

        const hardnessValue = parseFloat(waterHardness);
        
        if (isNaN(hardnessValue) || hardnessValue < 0 || hardnessValue > 50) {
            return res.status(400).json({ 
                success: false,
                error: 'Valid water hardness required (0-50 °dH)' 
            });
        }

        await queries.updateWaterHardness(req.user.id, hardnessValue);

        console.log(`💧 Water hardness updated: ${req.user.username} → ${hardnessValue} °dH`);

        res.json({ 
            success: true,
            waterHardness: hardnessValue
        });

    } catch (error) {
        console.error('Update water hardness error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

// ==========================================
// COFFEE DATA ENDPOINTS
// ==========================================

app.get('/api/coffees', authenticateUser, async (req, res) => {
    try {
        await queries.updateLastLogin(req.user.id);

        const coffees = await queries.getUserCoffees(req.user.id);

        const parsed = coffees.map(c => ({
            id: c.id,
            ...JSON.parse(c.data),
            savedAt: c.created_at
        }));

        res.json({ 
            success: true, 
            coffees: parsed 
        });

    } catch (error) {
        console.error('Get coffees error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

app.post('/api/coffees', authenticateUser, async (req, res) => {
    try {
        const { coffees } = req.body;

        // Start transaction to ensure atomic delete+insert operation
        await beginTransaction();

        try {
            await queries.deleteUserCoffees(req.user.id);

            if (coffees && coffees.length > 0) {
                for (const coffee of coffees) {
                    await queries.saveCoffee(req.user.id, JSON.stringify(coffee));
                }
            }

            // Commit transaction if all operations succeeded
            await commit();

            res.json({ 
                success: true,
                saved: coffees?.length || 0
            });

        } catch (txError) {
            // Rollback transaction if any operation failed
            await rollback();
            throw txError;
        }

    } catch (error) {
        console.error('Save coffees error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

// ==========================================
// ANTHROPIC API PROXY (PROTECTED)
// ==========================================

app.post('/api/analyze-coffee', aiLimiter, authenticateUser, async (req, res) => {
    try {
        const { imageData, mediaType } = req.body;

        console.log(`📸 Analyse gestartet für User: ${req.user.username}`);

        if (!imageData) {
            return res.status(400).json({ 
                success: false,
                error: 'Image data required' 
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

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'API error');
        }

        const text = data.content[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            throw new Error('Could not parse coffee data');
        }

        const coffeeData = JSON.parse(jsonMatch[0]);

        res.json({
            success: true,
            data: {
                name: coffeeData.name || 'Unknown',
                origin: coffeeData.origin || 'Unknown',
                process: coffeeData.process || 'washed',
                cultivar: coffeeData.cultivar || 'Unknown',
                altitude: coffeeData.altitude || '1500',
                roaster: coffeeData.roaster || 'Unknown',
                tastingNotes: coffeeData.tastingNotes || 'No notes',
                addedDate: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Analyze error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Analysis failed. Please try again.'
        });
    }
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        app: 'brewbuddy',
        version: '5.0.0-water-hardness',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ==========================================
// ERROR HANDLING
// ==========================================

app.use((req, res) => {
    res.status(404).json({ 
        success: false,
        error: 'Endpoint not found' 
    });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ 
        success: false,
        error: 'Internal server error' 
    });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
    console.log(`🚀 BrewBuddy API v5.0 running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 CORS enabled for: ${allowedOrigins.join(', ')}`);
    console.log(`🛡️ Rate limiting active`);
    console.log(`⚙️ Grinder Preference: ENABLED`);
    console.log(`💧 Water Hardness: ENABLED`);
});
