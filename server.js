// ==========================================
// DRIPMATE BACKEND SERVER V5.2
// + Grinder Variants + Method Preference
// + Water Hardness + Card Editor PATCH
// ==========================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { initDatabase } from './db/database.js';
import authRoutes from './routes/auth.js';
import grinderRoutes from './routes/grinder.js';
import methodRoutes from './routes/method.js';
import waterHardnessRoutes from './routes/waterHardness.js';
import coffeeRoutes from './routes/coffees.js';
import analyzeRoutes from './routes/analyze.js';
import healthRoutes from './routes/health.js';
import brewsRoutes from './routes/brews.js';
import adminRouter from './routes/admin.js';
import registerRoute from './routes/register.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
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

// ==========================================
// CORS CONFIGURATION
// ==========================================

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID', 'X-Admin-Password']
}));

app.use(express.json({ limit: '10mb' }));
app.use('/api/', apiLimiter);

console.log('🔒 CORS enabled for origins:', allowedOrigins);
console.log('🛡️ Rate limiting: 100 req/15min (general), 10 req/hour (AI)');

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

await initDatabase();

// ==========================================
// ROUTE MOUNTING
// ==========================================

app.use('/api/auth', authRoutes);
app.use('/api/user/grinder', grinderRoutes);
app.use('/api/user/method', methodRoutes);
app.use('/api/user/water-hardness', waterHardnessRoutes);
app.use('/api/coffees', coffeeRoutes);
app.use('/api/brews', brewsRoutes);
app.use('/api/analyze-coffee', analyzeRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/admin', adminRouter);
app.use('/api/auth/register', registerRoute);

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
    console.log(`🚀 dripmate API v5.2 running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 CORS enabled for: ${allowedOrigins.join(', ')}`);
    console.log(`🛡️ Rate limiting active`);
    console.log(`⚙️ Grinder Variants: ENABLED (8 grinders)`);
    console.log(`☕ Brew Method: ENABLED (v60/chemex/aeropress)`);
    console.log(`💧 Water Hardness: ENABLED`);
    console.log(`✏️ Card Editor PATCH: ENABLED`);
});
