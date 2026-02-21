// ==========================================
// ADMIN ROUTES – Whitelist Management
// ==========================================

import express from 'express';
import { getDatabase, getDatabaseType } from '../db/database.js';

const router = express.Router();

// ── Admin Auth Middleware ──────────────────────────
function adminAuth(req, res, next) {
    const pw = req.headers['x-admin-password'];
    if (!pw || pw !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    next();
}

// ── GET /api/admin/whitelist ───────────────────────
// Alle Whitelist-Einträge + Token-Status
router.get('/whitelist', adminAuth, async (req, res) => {
    try {
        const db  = getDatabase();
        const dbt = getDatabaseType();

        let entries;
        if (dbt === 'postgresql') {
            entries = await db.all(`
                SELECT 
                    w.id,
                    w.email,
                    w.name,
                    w.website,
                    w.note,
                    w.added_at,
                    r.token,
                    CASE 
                        WHEN u.id IS NOT NULL THEN 'registered'
                        WHEN r.token IS NOT NULL THEN 'sent'
                        ELSE 'invited'
                    END AS status
                FROM whitelist w
                LEFT JOIN registrations r ON r.email = w.email
                LEFT JOIN users u ON u.token = r.token AND u.device_id IS NOT NULL
                ORDER BY w.added_at DESC
            `);
        } else {
            entries = await db.all(`
                SELECT 
                    w.id,
                    w.email,
                    w.name,
                    w.website,
                    w.note,
                    w.added_at,
                    r.token,
                    CASE 
                        WHEN u.id IS NOT NULL THEN 'registered'
                        WHEN r.token IS NOT NULL THEN 'sent'
                        ELSE 'invited'
                    END AS status
                FROM whitelist w
                LEFT JOIN registrations r ON r.email = w.email
                LEFT JOIN users u ON u.token = r.token AND u.device_id IS NOT NULL
                ORDER BY w.added_at DESC
            `);
        }

        res.json({ success: true, entries });
    } catch (err) {
        console.error('Admin GET whitelist error:', err.message);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── POST /api/admin/whitelist ──────────────────────
// Neue Mail zur Whitelist hinzufügen
router.post('/whitelist', adminAuth, async (req, res) => {
    const { email, name = '', website = '', note = '' } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'Ungültige E-Mail' });
    }

    try {
        const db  = getDatabase();
        const dbt = getDatabaseType();

        let id;
        if (dbt === 'postgresql') {
            const result = await db.get(
                `INSERT INTO whitelist (email, name, website, note)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (email) DO NOTHING
                 RETURNING id`,
                [email.toLowerCase().trim(), name, website, note]
            );
            if (!result) {
                return res.status(409).json({ success: false, error: 'E-Mail bereits auf der Whitelist' });
            }
            id = result.id;
        } else {
            const existing = await db.get('SELECT id FROM whitelist WHERE email = ?', [email.toLowerCase().trim()]);
            if (existing) {
                return res.status(409).json({ success: false, error: 'E-Mail bereits auf der Whitelist' });
            }
            const result = await db.run(
                `INSERT INTO whitelist (email, name, website, note) VALUES (?, ?, ?, ?)`,
                [email.toLowerCase().trim(), name, website, note]
            );
            id = result.lastID;
        }

        console.log(`✅ Whitelist: ${email} hinzugefügt`);
        res.json({ success: true, id });
    } catch (err) {
        console.error('Admin POST whitelist error:', err.message);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── PATCH /api/admin/whitelist/:id ────────────────
// Notiz, Name oder Webseite aktualisieren
router.patch('/whitelist/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const allowed = ['name', 'website', 'note'];
    const updates = {};

    for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, error: 'Keine gültigen Felder' });
    }

    try {
        const db  = getDatabase();
        const dbt = getDatabaseType();

        if (dbt === 'postgresql') {
            const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
            const values     = [...Object.values(updates), id];
            await db.run(
                `UPDATE whitelist SET ${setClauses} WHERE id = $${values.length}`,
                values
            );
        } else {
            const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
            const values     = [...Object.values(updates), id];
            await db.run(`UPDATE whitelist SET ${setClauses} WHERE id = ?`, values);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Admin PATCH whitelist error:', err.message);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ── DELETE /api/admin/whitelist/:id ───────────────
// Eintrag entfernen
router.delete('/whitelist/:id', adminAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const db  = getDatabase();
        const dbt = getDatabaseType();

        if (dbt === 'postgresql') {
            await db.run('DELETE FROM whitelist WHERE id = $1', [id]);
        } else {
            await db.run('DELETE FROM whitelist WHERE id = ?', [id]);
        }

        console.log(`🗑️ Whitelist: Eintrag ${id} entfernt`);
        res.json({ success: true });
    } catch (err) {
        console.error('Admin DELETE whitelist error:', err.message);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
