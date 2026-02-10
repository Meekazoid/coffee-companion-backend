// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

import express from 'express';
import { extractAuthCredentials, getDeviceInfo } from '../middleware/auth.js';
import { queries } from '../db/database.js';

const router = express.Router();

/**
 * Validate Token with Device-Binding
 * GET /validate
 * Accepts token from Authorization: Bearer <token> header or query param (fallback)
 * Accepts deviceId from X-Device-ID header or query param (fallback)
 */
router.get('/validate', async (req, res) => {
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

export default router;
