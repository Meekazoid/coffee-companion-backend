// ==========================================
// GRINDER PREFERENCE ENDPOINTS
// ==========================================

import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { queries } from '../db/database.js';

const router = express.Router();

/**
 * Get Grinder Preference
 * GET /
 */
router.get('/', authenticateUser, async (req, res) => {
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
 * POST /
 */
router.post('/', authenticateUser, async (req, res) => {
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

export default router;
