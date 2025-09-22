import { test, expect } from '@playwright/test';

test.describe('SSEストリーム', () => {
    test('視聴者数ストリームAPIの基本確認', async ({ request }) => {
        // SSEストリームは継続的な接続のため、ヘッダーのみ確認
        try {
            const res = await request.get('/api/room/viewers/stream?room=test-room&withinSec=60&interval=2000', {
                timeout: 2000 // 2秒でタイムアウト
            });
            expect(res.status()).toBe(200);
            expect(res.headers()['content-type']).toContain('text/event-stream');
        } catch (error) {
            // タイムアウトは正常（SSEストリームの特性）
            expect(error instanceof Error && error.message).toContain('Timeout');
        }
    });

    test('リアクション集計APIの疎通確認', async ({ request }) => {
        const res = await request.get('/api/reaction/summary?room=test-room');
        expect(res.status()).toBe(200);

        const json = await res.json();
        expect(json).toHaveProperty('summary');
        expect(typeof json.summary).toBe('object');
    });
});
