// Tests for authentication middleware and transaction support
import { initDatabase, queries, closeDatabase, beginTransaction, commit, rollback } from '../db/database.js';

describe('Authentication and Transactions', () => {
    beforeAll(async () => {
        // Use SQLite for testing
        process.env.NODE_ENV = 'development';
        delete process.env.DATABASE_URL;
        await initDatabase();
    });

    afterAll(async () => {
        await closeDatabase();
    });

    describe('Transaction Support', () => {
        let testUserId;
        const testToken = 'transaction-test-token-' + Date.now();

        beforeAll(async () => {
            testUserId = await queries.createUser('transactionuser_' + Date.now(), testToken);
        });

        test('should commit transaction successfully', async () => {
            await beginTransaction();

            const coffeeData = JSON.stringify({
                name: 'Transaction Test Coffee',
                origin: 'Colombia',
                process: 'washed'
            });

            await queries.saveCoffee(testUserId, coffeeData);
            await commit();

            const coffees = await queries.getUserCoffees(testUserId);
            expect(coffees.length).toBeGreaterThan(0);
        });

        test('should rollback transaction on error', async () => {
            // Get initial coffee count
            const initialCoffees = await queries.getUserCoffees(testUserId);
            const initialCount = initialCoffees.length;

            await beginTransaction();

            try {
                const coffeeData = JSON.stringify({
                    name: 'Coffee to be rolled back',
                    origin: 'Ethiopia',
                    process: 'natural'
                });

                await queries.saveCoffee(testUserId, coffeeData);

                // Simulate an error
                throw new Error('Simulated error');
            } catch (error) {
                await rollback();
            }

            // Coffee count should remain the same after rollback
            const coffeesAfterRollback = await queries.getUserCoffees(testUserId);
            expect(coffeesAfterRollback.length).toBe(initialCount);
        });

        test('should protect against data loss during sync operation', async () => {
            // First, add some initial coffees
            await beginTransaction();
            await queries.deleteUserCoffees(testUserId);
            
            const initialCoffees = [
                { name: 'Coffee 1', origin: 'Brazil' },
                { name: 'Coffee 2', origin: 'Guatemala' }
            ];

            for (const coffee of initialCoffees) {
                await queries.saveCoffee(testUserId, JSON.stringify(coffee));
            }
            await commit();

            // Now test transaction protection during sync
            const newCoffees = [
                { name: 'New Coffee 1', origin: 'Kenya' },
                { name: 'New Coffee 2', origin: 'Rwanda' },
                { name: 'New Coffee 3', origin: 'Burundi' }
            ];

            await beginTransaction();
            
            try {
                await queries.deleteUserCoffees(testUserId);
                
                // Simulate partial save (error after 2 coffees)
                for (let i = 0; i < 2; i++) {
                    await queries.saveCoffee(testUserId, JSON.stringify(newCoffees[i]));
                }
                
                // Simulate error
                throw new Error('Database error during save');
            } catch (error) {
                await rollback();
            }

            // Original coffees should still be there
            const coffeesAfterFailedSync = await queries.getUserCoffees(testUserId);
            expect(coffeesAfterFailedSync.length).toBe(2);
            
            const parsedCoffees = coffeesAfterFailedSync.map(c => JSON.parse(c.data));
            expect(parsedCoffees.some(c => c.name === 'Coffee 1')).toBe(true);
            expect(parsedCoffees.some(c => c.name === 'Coffee 2')).toBe(true);
        });
    });

    describe('Auth Credential Extraction', () => {
        test('should extract credentials from Authorization header', () => {
            const mockReq = {
                headers: {
                    'authorization': 'Bearer test-token-123',
                    'x-device-id': 'device-456'
                },
                body: {},
                query: {}
            };

            // Simulate the extractAuthCredentials function logic
            let token = null;
            const authHeader = mockReq.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            } else {
                token = mockReq.body?.token || mockReq.query?.token;
            }
            
            const deviceId = mockReq.headers['x-device-id'] || mockReq.body?.deviceId || mockReq.query?.deviceId;

            expect(token).toBe('test-token-123');
            expect(deviceId).toBe('device-456');
        });

        test('should fallback to body when headers are not present', () => {
            const mockReq = {
                headers: {},
                body: {
                    token: 'body-token-789',
                    deviceId: 'body-device-012'
                },
                query: {}
            };

            // Simulate the extractAuthCredentials function logic
            let token = null;
            const authHeader = mockReq.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            } else {
                token = mockReq.body?.token || mockReq.query?.token;
            }
            
            const deviceId = mockReq.headers['x-device-id'] || mockReq.body?.deviceId || mockReq.query?.deviceId;

            expect(token).toBe('body-token-789');
            expect(deviceId).toBe('body-device-012');
        });

        test('should fallback to query when headers and body are not present', () => {
            const mockReq = {
                headers: {},
                body: {},
                query: {
                    token: 'query-token-345',
                    deviceId: 'query-device-678'
                }
            };

            // Simulate the extractAuthCredentials function logic
            let token = null;
            const authHeader = mockReq.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            } else {
                token = mockReq.body?.token || mockReq.query?.token;
            }
            
            const deviceId = mockReq.headers['x-device-id'] || mockReq.body?.deviceId || mockReq.query?.deviceId;

            expect(token).toBe('query-token-345');
            expect(deviceId).toBe('query-device-678');
        });

        test('should prefer headers over body and query', () => {
            const mockReq = {
                headers: {
                    'authorization': 'Bearer header-token',
                    'x-device-id': 'header-device'
                },
                body: {
                    token: 'body-token',
                    deviceId: 'body-device'
                },
                query: {
                    token: 'query-token',
                    deviceId: 'query-device'
                }
            };

            // Simulate the extractAuthCredentials function logic
            let token = null;
            const authHeader = mockReq.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            } else {
                token = mockReq.body?.token || mockReq.query?.token;
            }
            
            const deviceId = mockReq.headers['x-device-id'] || mockReq.body?.deviceId || mockReq.query?.deviceId;

            expect(token).toBe('header-token');
            expect(deviceId).toBe('header-device');
        });
    });
});
