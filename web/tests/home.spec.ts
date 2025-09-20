import { test, expect } from '@playwright/test';

test('トップページが表示され、主要UIが見える', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'fork' })).toBeVisible();
  await expect(page.getByText('サインインして開始')).toBeVisible();
});


