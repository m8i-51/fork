import { test, expect } from '@playwright/test';

test.describe('公開APIの疎通', () => {
    test('GET /api/room/list?onlyLive=true&withinSec=60 が 200 を返す', async ({ request }) => {
        const res = await request.get('/api/room/list?onlyLive=true&withinSec=60');
        expect(res.status()).toBe(200);
        const json = await res.json();
        expect(json).toHaveProperty('rooms');
        expect(Array.isArray(json.rooms)).toBe(true);
    });

    test('GET /api/room/info?room=__nonexistent は 200 で基本フィールドを返す', async ({ request }) => {
        const res = await request.get('/api/room/info?room=__nonexistent');
        expect(res.status()).toBe(200);
        const json = await res.json();
        // hostIdentity は null の可能性があるため、存在チェックのみにする
        expect(json).toEqual(expect.objectContaining({
            hasHost: expect.any(Boolean),
            isHost: expect.any(Boolean),
            isPublic: expect.any(Boolean),
        }));
        expect('hostIdentity' in json).toBe(true);
    });

    test('GET /api/reaction/summary?room=__nonexistent は 200 で summary を返す', async ({ request }) => {
        const res = await request.get('/api/reaction/summary?room=__nonexistent');
        expect(res.status()).toBe(200);
        const json = await res.json();
        expect(json).toHaveProperty('summary');
        expect(typeof json.summary).toBe('object');
    });
});


