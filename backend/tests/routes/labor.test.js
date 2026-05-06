/**
 * Labor / time tracking routes
 */

const request = require('supertest');
const express = require('express');
const { getPool, closePool, clearTables, createTestUser, createTestSession, insertFixture } = require('../helpers/testDb');

function createApp(pool) {
    const app = express();
    app.use(express.json());
    const laborRoutes = require('../../routes/labor')(pool);
    app.use('/api/labor', laborRoutes);
    return app;
}

describe('Labor Routes', () => {
    let pool;
    let app;

    beforeAll(() => {
        pool = getPool();
        app = createApp(pool);
    });

    afterAll(async () => {
        await closePool();
    });

    beforeEach(async () => {
        await clearTables([
            'labor_misc_task_segments',
            'labor_work_order_segments',
            'labor_shifts',
            'user_sessions',
            'user_activity_log',
            'users',
            'work_orders',
            'customers'
        ]);
    });

    async function loginAs(role) {
        const user = await createTestUser({ username: 'laboruser', role });
        const token = await createTestSession(user.id);
        return { user, token };
    }

    it('GET /status returns shift null when not clocked in', async () => {
        const { token } = await loginAs('Operator');

        const res = await request(app)
            .get('/api/labor/status')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.shift).toBeNull();
        expect(Array.isArray(res.body.data.activeSegments)).toBe(true);
        expect(Array.isArray(res.body.data.activeMiscSegments)).toBe(true);
    });

    it('POST /clock-in then /clock-out', async () => {
        const { token } = await loginAs('Operator');

        const inRes = await request(app)
            .post('/api/labor/clock-in')
            .set('Authorization', `Bearer ${token}`);

        expect(inRes.status).toBe(200);
        expect(inRes.body.data.shift).toBeDefined();

        const st = await request(app)
            .get('/api/labor/status')
            .set('Authorization', `Bearer ${token}`);
        expect(st.body.data.shift).not.toBeNull();

        const outRes = await request(app)
            .post('/api/labor/clock-out')
            .set('Authorization', `Bearer ${token}`);

        expect(outRes.status).toBe(200);

        const st2 = await request(app)
            .get('/api/labor/status')
            .set('Authorization', `Bearer ${token}`);
        expect(st2.body.data.shift).toBeNull();
    });

    it('POST /segment/start auto-opens shift and creates segment', async () => {
        const { user, token } = await loginAs('Machinist');

        const cust = await insertFixture('customers', {
            name: 'Test Cust',
            is_active: 1
        });

        const wo = await insertFixture('work_orders', {
            wo_number: 'WO-2026-999',
            customer_id: cust.id,
            customer_name: 'Test Cust',
            status: 'Active',
            completion_percentage: 0
        });

        const res = await request(app)
            .post('/api/labor/segment/start')
            .set('Authorization', `Bearer ${token}`)
            .send({
                workOrderId: wo.id,
                workflowStepKey: 'machining_complete',
                lineItemId: null
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const st = await request(app)
            .get('/api/labor/status')
            .set('Authorization', `Bearer ${token}`);
        expect(st.body.data.shift).not.toBeNull();
        expect(st.body.data.activeSegments.length).toBeGreaterThan(0);
    });

    it('PATCH /shift/:id updates clock times for own completed shift', async () => {
        const { token } = await loginAs('Operator');

        const inRes = await request(app)
            .post('/api/labor/clock-in')
            .set('Authorization', `Bearer ${token}`);
        expect(inRes.status).toBe(200);
        const shiftId = inRes.body.data.shift.id;

        await request(app)
            .post('/api/labor/clock-out')
            .set('Authorization', `Bearer ${token}`);

        const patchRes = await request(app)
            .patch(`/api/labor/shift/${shiftId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                startedAt: '2026-03-01T13:00:00.000Z',
                endedAt: '2026-03-01T21:30:00.000Z'
            });

        expect(patchRes.status).toBe(200);
        expect(patchRes.body.success).toBe(true);
        expect(patchRes.body.data.shift.startedAt).toContain('2026-03-01');
    });

    it('GET /history forbids Operator viewing another user', async () => {
        const admin = await createTestUser({ username: 'admin2', role: 'Administrator' });
        const op = await createTestUser({ username: 'op2', role: 'Operator' });
        const adminToken = await createTestSession(admin.id);
        const opToken = await createTestSession(op.id);

        const res = await request(app)
            .get(`/api/labor/history?userId=${admin.id}&from=2026-01-01&to=2026-12-31`)
            .set('Authorization', `Bearer ${opToken}`);

        expect(res.status).toBe(403);
    });

    it('POST /misc-segment/start and /misc-segment/stop', async () => {
        const { token } = await loginAs('Operator');

        const startRes = await request(app)
            .post('/api/labor/misc-segment/start')
            .set('Authorization', `Bearer ${token}`)
            .send({
                miscTaskId: 1700000000001,
                miscTaskTitle: 'Sweeping'
            });

        expect(startRes.status).toBe(200);
        expect(startRes.body.success).toBe(true);
        expect(startRes.body.data.miscSegment).toBeDefined();

        const st = await request(app)
            .get('/api/labor/status')
            .set('Authorization', `Bearer ${token}`);
        expect(st.body.data.activeMiscSegments.length).toBe(1);
        expect(String(st.body.data.activeMiscSegments[0].miscTaskId)).toBe('1700000000001');

        const stopRes = await request(app)
            .post('/api/labor/misc-segment/stop')
            .set('Authorization', `Bearer ${token}`)
            .send({ miscTaskId: 1700000000001 });

        expect(stopRes.status).toBe(200);
        expect(stopRes.body.success).toBe(true);

        const st2 = await request(app)
            .get('/api/labor/status')
            .set('Authorization', `Bearer ${token}`);
        expect(st2.body.data.activeMiscSegments.length).toBe(0);
    });
});
