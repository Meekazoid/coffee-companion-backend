// ==========================================
// DRIPMATE DATABASE MODULE V5.2
// Device-Binding + Grinder Variants (8) + Method Preference + Water Hardness
// ==========================================

import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

let db = null;
let dbType = null;

// ── Valid Values (exported for route validation) ──
const VALID_GRINDERS = [
    'comandante_mk4', 'comandante_mk3',
    'fellow_gen2', 'fellow_gen1',
    'timemore_s3', 'timemore_c2',
    '1zpresso', 'baratza',
];

const VALID_METHODS = ['v60', 'chemex', 'aeropress'];

/**
 * Initialize database connection
 */
export async function initDatabase() {
    const isProduction = process.env.NODE_ENV === 'production';
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    
    if (isProduction && hasDatabaseUrl) {
        console.log('📊 Initializing PostgreSQL database...');
        dbType = 'postgresql';
        
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
        
        try {
            await pool.query('SELECT NOW()');
            console.log('✅ PostgreSQL connection successful');
        } catch (err) {
            console.error('❌ PostgreSQL connection failed:', err.message);
            throw err;
        }
        
        db = {
            pool,
            async exec(sql) {
                const statements = sql.split(';').filter(s => s.trim());
                for (const statement of statements) {
                    if (statement.trim()) {
                        await pool.query(statement);
                    }
                }
            },
            async get(sql, params = []) {
                const result = await pool.query(sql, params);
                return result.rows[0] || null;
            },
            async all(sql, params = []) {
                const result = await pool.query(sql, params);
                return result.rows;
            },
            async run(sql, params = []) {
                const result = await pool.query(sql, params);
                return { 
                    lastID: result.rows[0]?.id, 
                    changes: result.rowCount 
                };
            }
        };
        
        await createPostgreSQLTables();
        console.log('✅ PostgreSQL database initialized');
        
    } else {
        console.log('📊 Initializing SQLite database...');
        dbType = 'sqlite';
        
        let sqlite3;
        let sqliteOpen;
        try {
            sqlite3 = (await import('sqlite3')).default;
            sqliteOpen = (await import('sqlite')).open;
        } catch (e) {
            console.error('❌ sqlite3 module not found. Install with: npm install sqlite3 sqlite');
            console.error('   Error:', e.message);
            throw e;
        }
        
        const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'dripmate.db');
        
        db = await sqliteOpen({
            filename: dbPath,
            driver: sqlite3.Database
        });

        await createSQLiteTables();
        console.log('✅ SQLite database initialized:', dbPath);
    }
    
    return { db, dbType };
}

/**
 * Create PostgreSQL tables with auto-migration for grinder variants + method preference
 */
async function createPostgreSQLTables() {
    // Schritt 1: Tabellen erstellen
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            token TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS coffees (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            coffee_uid TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, coffee_uid)
        );
    `);
    
    // Schritt 2: Spalten hinzufügen (idempotent via IF NOT EXISTS)
    try {
        await db.pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS device_id TEXT,
            ADD COLUMN IF NOT EXISTS device_info TEXT,
            ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS grinder_preference TEXT DEFAULT 'fellow',
            ADD COLUMN IF NOT EXISTS water_hardness DECIMAL(4,1) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS method_preference VARCHAR(20) DEFAULT 'v60';
        `);
    } catch (err) {
        console.log('Note: user columns may already exist');
    }

    // Schritt 2b: Method-Spalte auf coffees (per-Coffee Override)
    try {
        await db.pool.query(`
            ALTER TABLE coffees
            ADD COLUMN IF NOT EXISTS method VARCHAR(20) DEFAULT 'v60';
        `);
    } catch (err) {
        console.log('Note: coffees.method column may already exist');
    }

    // Schritt 2c: Stable key for idempotent coffee upserts
    try {
        await db.pool.query(`
            ALTER TABLE coffees
            ADD COLUMN IF NOT EXISTS coffee_uid TEXT;
        `);
        await db.pool.query(`
            UPDATE coffees
            SET coffee_uid = id::text
            WHERE coffee_uid IS NULL OR coffee_uid = '';
        `);
        await db.pool.query(`
            ALTER TABLE coffees
            ALTER COLUMN coffee_uid SET NOT NULL;
        `);
        await db.pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_coffees_user_uid
            ON coffees(user_id, coffee_uid);
        `);
    } catch (err) {
        console.log('Note: coffees.coffee_uid migration may already exist');
    }
    
    // Schritt 3: Migrate alte Grinder-Keys → neue versionierte Keys
    try {
        const migrations = [
            { old: 'fellow',     new: 'fellow_gen2' },
            { old: 'comandante', new: 'comandante_mk3' },
            { old: 'timemore',   new: 'timemore_s3' },
        ];
        for (const m of migrations) {
            const result = await db.pool.query(
                `UPDATE users SET grinder_preference = $1 WHERE grinder_preference = $2`,
                [m.new, m.old]
            );
            if (result.rowCount > 0) {
                console.log(`🔄 Migrated ${result.rowCount} user(s): ${m.old} → ${m.new}`);
            }
        }
    } catch (err) {
        console.log('Note: grinder migration may have already run');
    }
    
    // Schritt 4: Indices erstellen (NACH den Spalten!)
    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_coffees_user_id ON coffees(user_id);
        CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
        CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);
        CREATE INDEX IF NOT EXISTS idx_coffees_user_created ON coffees(user_id, created_at DESC);
    `);
}

/**
 * Create SQLite tables (fresh DB gets new defaults, existing DB gets migrated)
 */
async function createSQLiteTables() {
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            token TEXT NOT NULL UNIQUE,
            device_id TEXT UNIQUE,
            device_info TEXT,
            last_login_at DATETIME,
            grinder_preference TEXT DEFAULT 'fellow_gen2',
            water_hardness REAL DEFAULT NULL,
            method_preference TEXT DEFAULT 'v60',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS coffees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            coffee_uid TEXT NOT NULL,
            data TEXT NOT NULL,
            method TEXT DEFAULT 'v60',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, coffee_uid)
        );

        CREATE INDEX IF NOT EXISTS idx_coffees_user_id ON coffees(user_id);
        CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
        CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);
        CREATE INDEX IF NOT EXISTS idx_coffees_user_created ON coffees(user_id, created_at DESC);
    `);

    // SQLite: migrate alte Keys (falls existierende V4 DB)
    try {
        await db.run(`UPDATE users SET grinder_preference = 'fellow_gen2' WHERE grinder_preference = 'fellow'`);
        await db.run(`UPDATE users SET grinder_preference = 'comandante_mk3' WHERE grinder_preference = 'comandante'`);
        await db.run(`UPDATE users SET grinder_preference = 'timemore_s3' WHERE grinder_preference = 'timemore'`);
    } catch (err) {
        // Silently ignore on fresh DB
    }

    // SQLite: add new columns if upgrading from V4
    try { await db.run(`ALTER TABLE users ADD COLUMN method_preference TEXT DEFAULT 'v60'`); } catch (err) { /* already exists */ }
    try { await db.run(`ALTER TABLE coffees ADD COLUMN method TEXT DEFAULT 'v60'`); } catch (err) { /* already exists */ }
    try { await db.run(`ALTER TABLE coffees ADD COLUMN coffee_uid TEXT`); } catch (err) { /* already exists */ }

    try {
        await db.run(`UPDATE coffees SET coffee_uid = CAST(id AS TEXT) WHERE coffee_uid IS NULL OR coffee_uid = ''`);
    } catch (err) {
        // ignore
    }

    try { await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_coffees_user_uid ON coffees(user_id, coffee_uid)`); } catch (err) { /* already exists */ }
}

export function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

export function getDatabaseType() {
    return dbType;
}

/**
 * Begin a database transaction
 */
export async function beginTransaction() {
    const database = getDatabase();
    if (dbType === 'postgresql') {
        await database.pool.query('BEGIN');
    } else {
        await database.exec('BEGIN TRANSACTION');
    }
}

/**
 * Commit a database transaction
 */
export async function commit() {
    const database = getDatabase();
    if (dbType === 'postgresql') {
        await database.pool.query('COMMIT');
    } else {
        await database.exec('COMMIT');
    }
}

/**
 * Rollback a database transaction
 */
export async function rollback() {
    const database = getDatabase();
    if (dbType === 'postgresql') {
        await database.pool.query('ROLLBACK');
    } else {
        await database.exec('ROLLBACK');
    }
}

export async function closeDatabase() {
    if (db && dbType === 'postgresql') {
        await db.pool.end();
        console.log('✅ PostgreSQL connection closed');
    } else if (db && dbType === 'sqlite') {
        await db.close();
        console.log('✅ SQLite connection closed');
    }
    db = null;
    dbType = null;
}

/**
 * Query helpers
 */
export const queries = {
    /**
     * Get user by token (prüft auch device_id)
     */
    async getUserByToken(token, deviceId = null) {
        const db = getDatabase();
        if (dbType === 'postgresql') {
            if (deviceId) {
                return db.get(
                    'SELECT id, username, device_id, grinder_preference, method_preference, water_hardness, created_at FROM users WHERE token = $1 AND device_id = $2', 
                    [token, deviceId]
                );
            } else {
                return db.get(
                    'SELECT id, username, device_id, grinder_preference, method_preference, water_hardness, created_at FROM users WHERE token = $1', 
                    [token]
                );
            }
        } else {
            if (deviceId) {
                return db.get(
                    'SELECT id, username, device_id, grinder_preference, method_preference, water_hardness, created_at FROM users WHERE token = ? AND device_id = ?', 
                    [token, deviceId]
                );
            } else {
                return db.get(
                    'SELECT id, username, device_id, grinder_preference, method_preference, water_hardness, created_at FROM users WHERE token = ?', 
                    [token]
                );
            }
        }
    },
    
    /**
     * Create new user mit device binding und defaults
     */
    async createUser(username, token, deviceId, deviceInfo) {
        const db = getDatabase();
        if (dbType === 'postgresql') {
            const result = await db.get(
                `INSERT INTO users (username, token, device_id, device_info, grinder_preference, method_preference, last_login_at) 
                 VALUES ($1, $2, $3, $4, 'fellow_gen2', 'v60', CURRENT_TIMESTAMP) 
                 RETURNING id`,
                [username, token, deviceId, deviceInfo]
            );
            return result.id;
        } else {
            const result = await db.run(
                `INSERT INTO users (username, token, device_id, device_info, grinder_preference, method_preference, last_login_at) 
                 VALUES (?, ?, ?, ?, 'fellow_gen2', 'v60', CURRENT_TIMESTAMP)`,
                [username, token, deviceId, deviceInfo]
            );
            return result.lastID;
        }
    },
    
    /**
     * Update grinder preference
     */
    async updateGrinderPreference(userId, grinder) {
        if (!VALID_GRINDERS.includes(grinder)) {
            throw new Error(`Invalid grinder: ${grinder}`);
        }
        const db = getDatabase();
        if (dbType === 'postgresql') {
            await db.run(
                'UPDATE users SET grinder_preference = $1 WHERE id = $2',
                [grinder, userId]
            );
        } else {
            await db.run(
                'UPDATE users SET grinder_preference = ? WHERE id = ?',
                [grinder, userId]
            );
        }
    },
    
    /**
     * Get grinder preference
     */
    async getGrinderPreference(userId) {
        const db = getDatabase();
        if (dbType === 'postgresql') {
            const result = await db.get(
                'SELECT grinder_preference FROM users WHERE id = $1',
                [userId]
            );
            return result?.grinder_preference || 'fellow_gen2';
        } else {
            const result = await db.get(
                'SELECT grinder_preference FROM users WHERE id = ?',
                [userId]
            );
            return result?.grinder_preference || 'fellow_gen2';
        }
    },

    /**
     * Update method preference
     */
    async updateMethodPreference(userId, method) {
        if (!VALID_METHODS.includes(method)) {
            throw new Error(`Invalid method: ${method}`);
        }
        const db = getDatabase();
        if (dbType === 'postgresql') {
            await db.run(
                'UPDATE users SET method_preference = $1 WHERE id = $2',
                [method, userId]
            );
        } else {
            await db.run(
                'UPDATE users SET method_preference = ? WHERE id = ?',
                [method, userId]
            );
        }
    },

    /**
     * Get method preference
     */
    async getMethodPreference(userId) {
        const db = getDatabase();
        if (dbType === 'postgresql') {
            const result = await db.get(
                'SELECT method_preference FROM users WHERE id = $1',
                [userId]
            );
            return result?.method_preference || 'v60';
        } else {
            const result = await db.get(
                'SELECT method_preference FROM users WHERE id = ?',
                [userId]
            );
            return result?.method_preference || 'v60';
        }
    },
    
    /**
     * Update water hardness
     */
    async updateWaterHardness(userId, waterHardness) {
        const db = getDatabase();
        if (dbType === 'postgresql') {
            await db.run(
                'UPDATE users SET water_hardness = $1 WHERE id = $2',
                [waterHardness, userId]
            );
        } else {
            await db.run(
                'UPDATE users SET water_hardness = ? WHERE id = ?',
                [waterHardness, userId]
            );
        }
    },
    
    /**
     * Get water hardness
     */
    async getWaterHardness(userId) {
        const db = getDatabase();
        if (dbType === 'postgresql') {
            const result = await db.get(
                'SELECT water_hardness FROM users WHERE id = $1',
                [userId]
            );
            return result?.water_hardness || null;
        } else {
            const result = await db.get(
                'SELECT water_hardness FROM users WHERE id = ?',
                [userId]
            );
            return result?.water_hardness || null;
        }
    },
    
    /**
     * Update last login time
     */
    async updateLastLogin(userId) {
        const db = getDatabase();
        if (dbType === 'postgresql') {
            await db.run(
                'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
                [userId]
            );
        } else {
            await db.run(
                'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
                [userId]
            );
        }
    },
    
    /**
     * Check if device is already registered
     */
    async deviceExists(deviceId) {
        const db = getDatabase();
        if (dbType === 'postgresql') {
            const result = await db.get(
                'SELECT id FROM users WHERE device_id = $1',
                [deviceId]
            );
            return !!result;
        } else {
            const result = await db.get(
                'SELECT id FROM users WHERE device_id = ?',
                [deviceId]
            );
            return !!result;
        }
    },
    
    /**
     * Bind device to user
     */
    async bindDevice(userId, deviceId, deviceInfo) {
        const db = getDatabase();
        if (dbType === 'postgresql') {
            await db.run(
                'UPDATE users SET device_id = $1, device_info = $2, last_login_at = CURRENT_TIMESTAMP WHERE id = $3',
                [deviceId, deviceInfo, userId]
            );
        } else {
            await db.run(
                'UPDATE users SET device_id = ?, device_info = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
                [deviceId, deviceInfo, userId]
            );
        }
    },
    
    async getUserCount() {
        const db = getDatabase();
        const result = await db.get('SELECT COUNT(*) as count FROM users');
        return result.count;
    },
    
    async usernameExists(username) {
        const db = getDatabase();
        if (dbType === 'postgresql') {
            const result = await db.get(
                'SELECT id FROM users WHERE LOWER(username) = LOWER($1)', 
                [username]
            );
            return !!result;
        } else {
            const result = await db.get(
                'SELECT id FROM users WHERE LOWER(username) = LOWER(?)', 
                [username]
            );
            return !!result;
        }
    },
    
    async getUserCoffees(userId) {
        const db = getDatabase();
        if (dbType === 'postgresql') {
            return db.all(
                'SELECT id, coffee_uid, data, method, created_at FROM coffees WHERE user_id = $1 ORDER BY created_at DESC',
                [userId]
            );
        } else {
            return db.all(
                'SELECT id, coffee_uid, data, method, created_at FROM coffees WHERE user_id = ? ORDER BY created_at DESC',
                [userId]
            );
        }
    },
    
    async saveCoffee(userId, coffeeUid, data, method = 'v60') {
        const db = getDatabase();
        if (dbType === 'postgresql') {
            const result = await db.get(
                `INSERT INTO coffees (user_id, coffee_uid, data, method)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT(user_id, coffee_uid)
                 DO UPDATE SET data = EXCLUDED.data, method = EXCLUDED.method, created_at = CURRENT_TIMESTAMP
                 RETURNING id`,
                [userId, coffeeUid, data, method]
            );
            return result.id;
        } else {
            const result = await db.run(
                `INSERT INTO coffees (user_id, coffee_uid, data, method)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(user_id, coffee_uid)
                 DO UPDATE SET data = excluded.data, method = excluded.method, created_at = CURRENT_TIMESTAMP`,
                [userId, coffeeUid, data, method]
            );
            return result.lastID;
        }
    },

    async replaceUserCoffees(userId, keepCoffeeUids = []) {
        const db = getDatabase();
        if (!Array.isArray(keepCoffeeUids) || keepCoffeeUids.length === 0) {
            if (dbType === 'postgresql') {
                await db.run('DELETE FROM coffees WHERE user_id = $1', [userId]);
            } else {
                await db.run('DELETE FROM coffees WHERE user_id = ?', [userId]);
            }
            return;
        }

        if (dbType === 'postgresql') {
            await db.run('DELETE FROM coffees WHERE user_id = $1 AND coffee_uid <> ALL($2::text[])', [userId, keepCoffeeUids]);
        } else {
            const placeholders = keepCoffeeUids.map(() => '?').join(', ');
            await db.run(`DELETE FROM coffees WHERE user_id = ? AND coffee_uid NOT IN (${placeholders})`, [userId, ...keepCoffeeUids]);
        }
    },
    
    async deleteUserCoffees(userId) {
        const db = getDatabase();
        if (dbType === 'postgresql') {
            await db.run('DELETE FROM coffees WHERE user_id = $1', [userId]);
        } else {
            await db.run('DELETE FROM coffees WHERE user_id = ?', [userId]);
        }
    }
};

// ── Export valid values for use in routes ──
export { VALID_GRINDERS, VALID_METHODS };

export default {
    initDatabase,
    getDatabase,
    getDatabaseType,
    closeDatabase,
    beginTransaction,
    commit,
    rollback,
    queries,
    VALID_GRINDERS,
    VALID_METHODS
};
