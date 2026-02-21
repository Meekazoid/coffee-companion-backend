// ==========================================
// AUTHENTICATION ENDPOINTS (V5.2)
// ==========================================

import express from 'express';
import { extractAuthCredentials, getDeviceInfo } from '../middleware/auth.js';
import { queries, getDatabase, getDatabaseType } from '../db/database.js';

const router = express.Router();

/**
 * Validate Token with Device-Binding
 * GET /validate
 * Beim ersten Login: Token aus registrations → User in users anlegen
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

        let user = await queries.getUserByToken(token);

        // Token nicht in users → prüfen ob in registrations
        if (!user) {
            const db  = getDatabase();
            const dbt = getDatabaseType();

            const registration = dbt === 'postgresql'
                ? await db.get('SELECT * FROM registrations WHERE token = $1', [token])
                : await db.get('SELECT * FROM registrations WHERE token = ?', [token]);

            if (!registration) {
                return res.status(401).json({ 
                    success: false,
                    valid: false,
                    error: 'Invalid token' 
                });
            }

            // Username aus E-Mail ableiten
            const base     = registration.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
            const suffix   = Date.now().toString().slice(-4);
            const username = (base || 'user') + '_' + suffix;

            // Neuen User anlegen + Device binden
            await queries.createUser(username, token, deviceId, getDeviceInfo(req));

            // Token als used markieren
            if (dbt === 'postgresql') {
                await db.run('UPDATE registrations SET used = true WHERE token = $1', [token]);
            } else {
                await db.run('UPDATE registrations SET used = 1 WHERE token = ?', [token]);
            }

            console.log(`Neuer User angelegt: ${username} (${registration.email})`);
            user = await queries.getUserByToken(token);
        }

        // Device-Binding
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
            console.log(`Device bound: User ${user.username} -> Device ${deviceId.substring(0, 8)}...`);
        }

        await queries.updateLastLogin(user.id);

        res.json({
            success: true,
            valid: true,
            user: {
                id: user.id,
                username: user.username,
                deviceId: user.device_id || deviceId,
                grinderPreference: user.grinder_preference || 'fellow_gen2',
                methodPreference: user.method_preference || 'v60',
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
