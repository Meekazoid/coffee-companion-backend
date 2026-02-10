// ==========================================
// COFFEE DATA ENDPOINTS
// ==========================================

import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { queries, beginTransaction, commit, rollback } from '../db/database.js';

const router = express.Router();

router.get('/', authenticateUser, async (req, res) => {
    try {
        await queries.updateLastLogin(req.user.id);

        const coffees = await queries.getUserCoffees(req.user.id);

        const parsed = coffees.map(c => ({
            id: c.id,
            ...JSON.parse(c.data),
            savedAt: c.created_at
        }));

        res.json({ 
            success: true, 
            coffees: parsed 
        });

    } catch (error) {
        console.error('Get coffees error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

router.post('/', authenticateUser, async (req, res) => {
    try {
        const { coffees } = req.body;

        // Start transaction to ensure atomic delete+insert operation
        await beginTransaction();

        try {
            await queries.deleteUserCoffees(req.user.id);

            if (coffees && coffees.length > 0) {
                for (const coffee of coffees) {
                    await queries.saveCoffee(req.user.id, JSON.stringify(coffee));
                }
            }

            // Commit transaction if all operations succeeded
            await commit();

            res.json({ 
                success: true,
                saved: coffees?.length || 0
            });

        } catch (txError) {
            // Rollback transaction if any operation failed
            await rollback();
            throw txError;
        }

    } catch (error) {
        console.error('Save coffees error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

export default router;
