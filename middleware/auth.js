// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================

import { queries } from '../db/database.js';

/**
 * Extract authentication credentials from headers with fallback to body/query
 * Prioritizes headers for security (Authorization: Bearer <token>, X-Device-ID: <deviceId>)
 */
export function extractAuthCredentials(req) {
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
export async function authenticateUser(req, res, next) {
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
                    error: 'This token is already bound to another device'
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
export function getDeviceInfo(req) {
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
