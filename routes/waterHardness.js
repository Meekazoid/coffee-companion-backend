// ==========================================
// WATER HARDNESS ENDPOINTS
// ==========================================

import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { queries } from '../db/database.js';

const router = express.Router();

/**
 * Get Water Hardness
 * GET /
 */
router.get('/', authenticateUser, async (req, res) => {
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
 * POST /
 */
router.post('/', authenticateUser, async (req, res) => {
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

export default router;
