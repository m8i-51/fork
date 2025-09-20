import { test, expect } from '@playwright/test';

test.describe('認証フロー', () => {
    test('未認証状態でサインインボタンが表示される', async ({ page }) => {
        await page.goto('/');

        // 未認証状態のUI要素を確認
        await expect(page.getByText('サインインして開始')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Googleでサインイン' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Xでサインイン' })).toBeVisible();

        // 認証後の要素は表示されない
        await expect(page.getByText(/こんにちは/)).not.toBeVisible();
        await expect(page.getByRole('button', { name: 'サインアウト' })).not.toBeVisible();
    });

    test('サインインボタンをクリックすると認証フローが開始される', async ({ page }) => {
        await page.goto('/');

        // Googleサインインボタンをクリック
        const googleButton = page.getByRole('button', { name: 'Googleでサインイン' });
        await expect(googleButton).toBeVisible();

        // クリックしてリダイレクトが開始されることを確認
        const [response] = await Promise.all([
            page.waitForResponse(response => response.url().includes('/api/auth/signin')),
            googleButton.click()
        ]);

        // 認証フローが開始されたことを確認
        expect(response.status()).toBe(200);
    });

    test('Xサインインボタンをクリックすると認証フローが開始される', async ({ page }) => {
        await page.goto('/');

        // Xサインインボタンをクリック
        const twitterButton = page.getByRole('button', { name: 'Xでサインイン' });
        await expect(twitterButton).toBeVisible();

        // クリックしてリダイレクトが開始されることを確認
        const [response] = await Promise.all([
            page.waitForResponse(response => response.url().includes('/api/auth/signin')),
            twitterButton.click()
        ]);

        // 認証フローが開始されたことを確認
        expect(response.status()).toBe(200);
    });

    test('認証が必要な機能は未認証時に無効になる', async ({ page }) => {
        await page.goto('/');

        // 配信開始ボタンが無効になっていることを確認
        const createButton = page.getByRole('button', { name: '配信を開始' });
        await expect(createButton).toBeDisabled();

        // 配信タイトル入力フィールドは表示されるが、ボタンが無効
        await expect(page.getByPlaceholder('配信タイトル')).toBeVisible();
    });
});
