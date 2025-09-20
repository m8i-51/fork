import { test, expect } from '@playwright/test';

test('ホームのカードとボタンが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'fork' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Googleでサインイン' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xでサインイン' })).toBeVisible();
    await expect(page.getByRole('button', { name: '配信を開始' })).toBeVisible();
    await expect(page.getByPlaceholder('配信タイトル')).toBeVisible();
    await expect(page.getByText('公開中のルーム', { exact: true })).toBeVisible();
});


