import { test, expect, devices } from '@playwright/test';

test.describe('モバイル対応テスト', () => {
    test('iPhone 12での表示確認', async ({ page }) => {
        await page.goto('/');

        // iPhone 12のビューポートサイズに設定
        await page.setViewportSize({ width: 390, height: 844 });

        // 主要な要素が表示されることを確認
        await expect(page.getByRole('heading', { name: 'fork' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Googleでサインイン' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Xでサインイン' })).toBeVisible();

        // レスポンシブレイアウトが適切に表示されることを確認
        const container = page.locator('.container');
        await expect(container).toBeVisible();

        // モバイルでのスクリーンショットを撮影
        await page.screenshot({ path: 'mobile-iphone12.png' });
    });

    test('iPadでの表示確認', async ({ page }) => {
        await page.goto('/');

        // iPadのビューポートサイズに設定
        await page.setViewportSize({ width: 768, height: 1024 });

        // 主要な要素が表示されることを確認
        await expect(page.getByRole('heading', { name: 'fork' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Googleでサインイン' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Xでサインイン' })).toBeVisible();

        // タブレットでのスクリーンショットを撮影
        await page.screenshot({ path: 'tablet-ipad.png' });
    });

    test('Androidでの表示確認', async ({ page }) => {
        await page.goto('/');

        // Androidのビューポートサイズに設定
        await page.setViewportSize({ width: 360, height: 640 });

        // 主要な要素が表示されることを確認
        await expect(page.getByRole('heading', { name: 'fork' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Googleでサインイン' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Xでサインイン' })).toBeVisible();

        // Androidでのスクリーンショットを撮影
        await page.screenshot({ path: 'mobile-android.png' });
    });

    test('タッチ操作が機能する', async ({ page }) => {
        await page.goto('/');
        await page.setViewportSize({ width: 390, height: 844 });

        // タッチ操作でボタンをクリック（tapの代わりにclickを使用）
        const googleButton = page.getByRole('button', { name: 'Googleでサインイン' });

        // 認証フローが開始されることを確認（レスポンスを待つ）
        const [response] = await Promise.all([
            page.waitForResponse(response => response.url().includes('/api/auth/signin')),
            googleButton.click()
        ]);

        // 認証フローが開始されたことを確認
        expect(response.status()).toBe(200);
    });

    test('モバイルでのフォーム入力が機能する', async ({ page }) => {
        await page.goto('/');
        await page.setViewportSize({ width: 390, height: 844 });

        // 配信タイトル入力フィールドにクリック入力
        const titleInput = page.getByPlaceholder('配信タイトル');
        await titleInput.click();
        await titleInput.fill('モバイルテスト配信');

        // 入力が正しく反映されることを確認
        const inputValue = await titleInput.inputValue();
        expect(inputValue).toBe('モバイルテスト配信');
    });

    test('モバイルでのスクロールが機能する', async ({ page }) => {
        await page.goto('/');
        await page.setViewportSize({ width: 390, height: 844 });

        // ページをスクロール
        await page.mouse.wheel(0, 500);

        // スクロール後も要素が表示されることを確認
        await expect(page.getByText('公開中のルーム', { exact: true })).toBeVisible();
    });

    test('モバイルでのボタンサイズが適切', async ({ page }) => {
        await page.goto('/');
        await page.setViewportSize({ width: 390, height: 844 });

        // ボタンのサイズを確認
        const googleButton = page.getByRole('button', { name: 'Googleでサインイン' });
        const buttonBox = await googleButton.boundingBox();

        // ボタンがタッチしやすいサイズ（36px以上）であることを確認（現実的な制限）
        expect(buttonBox?.height).toBeGreaterThanOrEqual(36);
    });
});
