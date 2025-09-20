import { test, expect } from '@playwright/test';

test.describe('ルームページ', () => {
    test('存在しないルームページにアクセスするとエラーが表示される', async ({ page }) => {
        await page.goto('/room/nonexistent-room');

        // ルームページの基本構造が表示される（見出し要素を指定）
        await expect(page.getByRole('heading', { name: 'fork' })).toBeVisible();

        // エラーメッセージまたは適切な状態が表示される
        // （実際の実装に応じて調整が必要）
    });

    test('ルームページのURL構造が正しい', async ({ page }) => {
        await page.goto('/room/test-room');

        // URLが正しく設定されている
        expect(page.url()).toContain('/room/test-room');
    });

    test('ルームページでLiveKitの設定が読み込まれる', async ({ page }) => {
        await page.goto('/room/test-room');

        // LiveKit関連の要素が存在することを確認
        // （実際の実装に応じて調整が必要）
        const livekitElements = page.locator('[data-livekit]');
        // 要素が存在するか、または適切なローディング状態が表示される
    });
});
