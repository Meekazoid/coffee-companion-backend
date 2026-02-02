// ==========================================
// BREWBUDDY BACKEND SERVER
// Environment Variables + CORS Setup
// ==========================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables FIRST
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
// CORS CONFIGURATION
// ==========================================

// Parse allowed origins from environment
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

// Add development origins in dev mode
if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000');
    allowedOrigins.push('http://localhost:5173');
    allowedOrigins.push('http://127.0.0.1:5173');
}

// CORS middleware
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, curl)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️  CORS blocked request from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));

// Log allowed origins on startup
console.log('🔒 CORS enabled for origins:', allowedOrigins);

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

let db = null;

async function initDatabase() {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'brewbuddy.db');
    
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            token TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS coffees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_coffees_user_id ON coffees(user_id);
        CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
    `);

    console.log('✅ Database initialized:', dbPath);
}

await initDatabase();

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

/**
 * POST /api/auth/register
 * Create new user (max 10)
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username } = req.body;

        if (!username || username.trim().length < 2) {
            return res.status(400).json({ 
                success: false,
                error: 'Username must be at least 2 characters' 
            });
        }

        // Check user limit
        const { count } = await db.get('SELECT COUNT(*) as count FROM users');
        if (count >= 10) {
            return res.status(403).json({ 
                success: false,
                error: 'Tester limit reached (10/10)',
                spotsRemaining: 0
            });
        }

        // Check if username exists
        const existing = await db.get(
            'SELECT id FROM users WHERE LOWER(username) = LOWER(?)', 
            [username.trim()]
        );
        
        if (existing) {
            return res.status(409).json({ 
                success: false,
                error: 'Username already taken' 
            });
        }

        // Create user
        const token = uuidv4();
        const result = await db.run(
            'INSERT INTO users (username, token) VALUES (?, ?)',
            [username.trim(), token]
        );

        const { count: newCount } = await db.get('SELECT COUNT(*) as count FROM users');

        res.json({
            success: true,
            user: {
                id: result.lastID,
                username: username.trim(),
                token: token
            },
            spotsRemaining: 10 - newCount
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

/**
 * GET /api/auth/validate?token=xxx
 * Validate user token
 */
app.get('/api/auth/validate', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ 
                success: false,
                error: 'Token required' 
            });
        }

        const user = await db.get(
            'SELECT id, username, created_at FROM users WHERE token = ?',
            [token]
        );

        if (!user) {
            return res.status(401).json({ 
                success: false,
                valid: false,
                error: 'Invalid token' 
            });
        }

        res.json({
            success: true,
            valid: true,
            user: {
                id: user.id,
                username: user.username,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        console.error('Validate error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

// ==========================================
// COFFEE DATA ENDPOINTS
// ==========================================

/**
 * GET /api/coffees?token=xxx
 * Get user's coffees
 */
app.get('/api/coffees', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(401).json({ 
                success: false,
                error: 'Unauthorized' 
            });
        }

        const user = await db.get('SELECT id FROM users WHERE token = ?', [token]);
        if (!user) {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid token' 
            });
        }

        const coffees = await db.all(
            'SELECT id, data, created_at FROM coffees WHERE user_id = ? ORDER BY created_at DESC',
            [user.id]
        );

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
        console.error('Get coffees error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

/**
 * POST /api/coffees
 * Save user's coffees
 */
app.post('/api/coffees', async (req, res) => {
    try {
        const { token, coffees } = req.body;

        if (!token) {
            return res.status(401).json({ 
                success: false,
                error: 'Unauthorized' 
            });
        }

        const user = await db.get('SELECT id FROM users WHERE token = ?', [token]);
        if (!user) {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid token' 
            });
        }

        // Delete existing
        await db.run('DELETE FROM coffees WHERE user_id = ?', [user.id]);

        // Insert new
        if (coffees && coffees.length > 0) {
            const stmt = await db.prepare(
                'INSERT INTO coffees (user_id, data) VALUES (?, ?)'
            );

            for (const coffee of coffees) {
                await stmt.run(user.id, JSON.stringify(coffee));
            }

            await stmt.finalize();
        }

        res.json({ 
            success: true,
            saved: coffees?.length || 0
        });

    } catch (error) {
        console.error('Save coffees error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

// ==========================================
// ANTHROPIC API PROXY
// ==========================================

/**
 * POST /api/analyze-coffee
 * Proxy to Anthropic API for coffee analysis
 */
app.post('/api/analyze-coffee', async (req, res) => {
    try {
        const { imageData, mediaType } = req.body;

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
                'x-api-key': process.env.ANTHROPIC_API_KEY  // ← From environment!
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

        // Parse Claude's response
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
        console.error('Analyze error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || 'Analysis failed' 
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
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false,
        error: 'Endpoint not found' 
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        success: false,
        error: 'Internal server error' 
    });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
    console.log(`🚀 BrewBuddy API running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 CORS enabled for: ${allowedOrigins.join(', ')}`);
});
