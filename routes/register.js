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
                <body style="margin:0;padding:0;background:#f5f5f0;font-family:'Helvetica Neue',Arial,sans-serif;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:48px 20px;">
                        <tr>
                            <td align="center">
                                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

                                    <!-- Header: Logo + Brand -->
                                    <tr>
                                        <td style="padding-bottom:28px;">
                                            <table cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td style="vertical-align:middle;padding-right:14px;">
                                                        <img src="https://dripmate.app/logo_dunkel_light.svg"
                                                             alt="drip·mate"
                                                             width="48"
                                                             height="48"
                                                             style="display:block;width:48px;height:48px;">
                                                    </td>
                                                    <td style="vertical-align:middle;">
                                                        <p style="margin:0 0 3px;font-size:1.5rem;font-weight:200;letter-spacing:0.32em;color:#000000;line-height:1;">
                                                            d r i p<span style="color:#8b6f47;margin:0 0.1em;">·</span>m a t e
                                                        </p>
                                                        <p style="margin:0;font-size:0.58rem;font-weight:300;letter-spacing:0.22em;text-transform:uppercase;color:#8b6f47;opacity:0.8;">
                                                            Precision meets Ritual.
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                    <!-- Card -->
                                    <tr>
                                        <td style="background:#ffffff;border:1px solid #e0e0e0;border-radius:20px;padding:40px 36px;">

                                            <p style="margin:0 0 8px;font-size:0.65rem;text-transform:uppercase;letter-spacing:0.2em;color:#aaaaaa;font-weight:400;">
                                                Beta-Zugang
                                            </p>

                                            <p style="margin:0 0 32px;font-size:1rem;color:#1a1a1a;line-height:1.6;font-weight:300;">
                                                Willkommen bei dripmate.<br>
                                                Hier ist dein persönlicher Zugangs-Token:
                                            </p>

                                            <!-- Token Box -->
                                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                                                <tr>
                                                    <td style="background:#faf8f5;border:1.5px solid #8b6f47;border-radius:12px;padding:24px 20px;text-align:center;">
                                                        <p style="margin:0 0 8px;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.22em;color:#aaaaaa;">
                                                            Dein Token
                                                        </p>
                                                        <p style="margin:0;font-size:2rem;font-family:'Courier New',Courier,monospace;letter-spacing:0.12em;color:#8b6f47;font-weight:600;">
                                                            ${token}
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>

                                            <!-- Text -->
                                            <p style="margin:0 0 8px;font-size:0.88rem;color:#444444;line-height:1.8;font-weight:300;">
                                                Öffne dripmate und gib diesen Token ein um dich anzumelden. Der Token ist einmalig und wird an dein Gerät gebunden. Installiere die App über den Browser auf deinem Homescreen.
                                            </p>

                                            <!-- Divider -->
                                            <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                                                <tr>
                                                    <td style="border-top:1px solid #e8e8e8;"></td>
                                                </tr>
                                            </table>

                                            <!-- CTA -->
                                            <table width="100%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td align="center">
                                                        <a href="https://dripmate.app"
                                                           style="display:inline-block;background:#8b6f47;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:0.88rem;font-weight:600;letter-spacing:0.05em;">
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
                                            <p style="margin:0;font-size:0.7rem;color:#aaaaaa;text-align:center;line-height:1.6;">
                                                Diese Mail wurde an ${email} gesendet.<br>
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
