import { test, expect } from '@playwright/test';

test('localhost:3001のスクリーンショットを撮る', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // フルページのスクリーンショットを撮る
    await page.screenshot({
        path: 'screenshot-fullpage.png',
        fullPage: true
    });

    // ビューポートのスクリーンショットも撮る
    await page.screenshot({
        path: 'screenshot-viewport.png'
    });

    console.log('スクリーンショットを撮りました: screenshot-fullpage.png, screenshot-viewport.png');
});

