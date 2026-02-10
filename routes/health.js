// ==========================================
// HEALTH CHECK
// ==========================================

import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ 
        status: 'ok',
        app: 'brewbuddy',
        version: '5.0.0-water-hardness',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

export default router;
