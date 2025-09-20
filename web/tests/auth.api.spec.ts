import { test, expect } from '@playwright/test';

test.describe('認証が必要なAPI', () => {
    test('GET /api/token は未認証時に401を返す', async ({ request }) => {
        const res = await request.get('/api/token?room=test&publish=true');
        expect(res.status()).toBe(401);
    });

    test('POST /api/room/create は未認証時に401を返す', async ({ request }) => {
        const res = await request.post('/api/room/create', {
            data: { displayName: 'テストルーム' }
        });
        expect(res.status()).toBe(401);
    });

    test('POST /api/presence/heartbeat は未認証時に401を返す', async ({ request }) => {
        const res = await request.post('/api/presence/heartbeat', {
            data: { room: 'test' }
        });
        expect(res.status()).toBe(401);
    });

    test('POST /api/presence/leave は未認証時に401を返す', async ({ request }) => {
        const res = await request.post('/api/presence/leave', {
            data: { room: 'test' }
        });
        expect(res.status()).toBe(401);
    });

    test('POST /api/reaction/send は未認証時に401を返す', async ({ request }) => {
        const res = await request.post('/api/reaction/send', {
            data: { room: 'test', type: 'like' }
        });
        expect(res.status()).toBe(401);
    });

    test('POST /api/room/set-public は未認証時に401を返す', async ({ request }) => {
        const res = await request.post('/api/room/set-public', {
            data: { room: 'test', isPublic: 'true' }
        });
        expect(res.status()).toBe(401);
    });
});

