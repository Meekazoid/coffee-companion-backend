// ==========================================
// REGISTER ENDPOINT
// Whitelist-Check → Token generieren → Mail senden
// ==========================================

import express from 'express';
import { randomBytes } from 'crypto';
import { getDatabase, getDatabaseType } from '../db/database.js';

const router = express.Router();

// ── Token generieren: BREW-XXXXXX ──────────────────
function generateToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O/1/I – lesbarer
    let token = 'BREW-';
    for (let i = 0; i < 6; i++) {
        token += chars[randomBytes(1)[0] % chars.length];
    }
    return token;
}

// ── Mail versenden via Resend ───────────────────────
async function sendTokenMail(email, token) {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: 'drip·mate <hello@dripmate.app>',
            to: email,
            subject: 'Dein dripmate Beta-Zugang ☕',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin:0;padding:0;background:#000000;font-family:'Helvetica Neue',Arial,sans-serif;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
                        <tr>
                            <td align="center">
                                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
                                    
                                    <!-- Header -->
                                    <tr>
                                        <td style="padding-bottom:32px;">
                                            <p style="margin:0;font-size:22px;font-weight:200;letter-spacing:0.15em;color:#ffffff;">
                                                drip<span style="color:#d4a574;">·</span>mate
                                            </p>
                                        </td>
                                    </tr>

                                    <!-- Body -->
                                    <tr>
                                        <td style="background:#111111;border:1px solid #222222;border-radius:16px;padding:36px;">
                                            
                                            <p style="margin:0 0 16px;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.15em;color:#888888;">
                                                Dein Beta-Zugang
                                            </p>
                                            
                                            <p style="margin:0 0 28px;font-size:1rem;color:#ffffff;line-height:1.6;font-weight:300;">
                                                Willkommen bei dripmate. Hier ist dein persönlicher Zugangs-Token:
                                            </p>

                                            <!-- Token Box -->
                                            <div style="background:#000000;border:1px solid #d4a574;border-radius:10px;padding:20px;text-align:center;margin-bottom:28px;">
                                                <p style="margin:0 0 6px;font-size:0.65rem;text-transform:uppercase;letter-spacing:0.2em;color:#888888;">
                                                    Token
                                                </p>
                                                <p style="margin:0;font-size:1.8rem;font-family:'Courier New',monospace;letter-spacing:0.1em;color:#d4a574;font-weight:400;">
                                                    ${token}
                                                </p>
                                            </div>

                                            <p style="margin:0 0 28px;font-size:0.88rem;color:#888888;line-height:1.6;">
                                                Öffne dripmate und gib diesen Token ein um dich anzumelden. 
                                                Der Token ist einmalig und wird an dein Gerät gebunden.
                                            </p>

                                            <!-- CTA -->
                                            <table width="100%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td align="center">
                                                        <a href="https://dripmate.app" 
                                                           style="display:inline-block;background:#d4a574;color:#000000;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:0.85rem;font-weight:600;letter-spacing:0.05em;">
                                                            dripmate öffnen
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>

                                        </td>
                                    </tr>

                                    <!-- Footer -->
                                    <tr>
                                        <td style="padding-top:24px;">
                                            <p style="margin:0;font-size:0.72rem;color:#444444;text-align:center;">
                                                Diese Mail wurde an ${email} gesendet. 
                                                Du erhältst sie weil du zur dripmate Beta eingeladen wurdest.
                                            </p>
                                        </td>
                                    </tr>

                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Resend error: ${err}`);
    }
}

// ── POST /api/auth/register ─────────────────────────
router.post('/', async (req, res) => {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'Ungültige E-Mail' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    try {
        const db  = getDatabase();
        const dbt = getDatabaseType();

        // 1. Whitelist prüfen
        const whitelisted = dbt === 'postgresql'
            ? await db.get('SELECT id FROM whitelist WHERE email = $1', [normalizedEmail])
            : await db.get('SELECT id FROM whitelist WHERE email = ?', [normalizedEmail]);

        if (!whitelisted) {
            return res.status(403).json({
                success: false,
                error: 'not_whitelisted'
            });
        }

        // 2. Bereits registriert?
        const existing = dbt === 'postgresql'
            ? await db.get('SELECT token, used FROM registrations WHERE email = $1', [normalizedEmail])
            : await db.get('SELECT token, used FROM registrations WHERE email = ?', [normalizedEmail]);

        if (existing) {
            // Token nochmal senden (falls verloren gegangen)
            await sendTokenMail(normalizedEmail, existing.token);
            console.log(`📧 Token erneut gesendet: ${normalizedEmail}`);
            return res.json({ success: true, resent: true });
        }

        // 3. Neuen Token generieren
        let token;
        let attempts = 0;
        do {
            token = generateToken();
            const conflict = dbt === 'postgresql'
                ? await db.get('SELECT id FROM registrations WHERE token = $1', [token])
                : await db.get('SELECT id FROM registrations WHERE token = ?', [token]);
            if (!conflict) break;
            attempts++;
        } while (attempts < 10);

        // 4. In DB speichern
        if (dbt === 'postgresql') {
            await db.run(
                'INSERT INTO registrations (email, token) VALUES ($1, $2)',
                [normalizedEmail, token]
            );
        } else {
            await db.run(
                'INSERT INTO registrations (email, token) VALUES (?, ?)',
                [normalizedEmail, token]
            );
        }

        // 5. Mail versenden
        await sendTokenMail(normalizedEmail, token);
        console.log(`✅ Token generiert & gesendet: ${normalizedEmail} → ${token}`);

        res.json({ success: true, resent: false });

    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
