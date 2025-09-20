import { test, expect } from '@playwright/test';

test.describe('パフォーマンステスト', () => {
    test('ホームページのロード時間が3秒以内', async ({ page }) => {
        const startTime = Date.now();
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;

        expect(loadTime).toBeLessThan(3000);
        console.log(`ホームページロード時間: ${loadTime}ms`);
    });

    test('ルームページのロード時間が5秒以内', async ({ page }) => {
        const startTime = Date.now();
        await page.goto('/room/test-room');
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;

        expect(loadTime).toBeLessThan(5000);
        console.log(`ルームページロード時間: ${loadTime}ms`);
    });

    test('APIレスポンス時間が1秒以内', async ({ page }) => {
        const startTime = Date.now();
        const response = await page.request.get('/api/room/list?onlyLive=true&withinSec=60');
        const responseTime = Date.now() - startTime;

        expect(response.status()).toBe(200);
        expect(responseTime).toBeLessThan(1000);
        console.log(`APIレスポンス時間: ${responseTime}ms`);
    });

    test('ページサイズが適切な範囲内', async ({ page }) => {
        await page.goto('/');

        // ページのリソースサイズを確認
        const resources = await page.evaluate(() => {
            const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
            return entries.map(entry => ({
                name: entry.name,
                size: entry.transferSize,
                duration: entry.duration
            }));
        });

        // メインページのサイズが1MB以下であることを確認
        const mainPageSize = resources.find(r => r.name.includes('localhost:3001/'))?.size || 0;
        expect(mainPageSize).toBeLessThan(1024 * 1024); // 1MB
        console.log(`メインページサイズ: ${mainPageSize} bytes`);
    });

    test('メモリ使用量が適切な範囲内', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // メモリ使用量を取得（Chrome DevTools Protocolが必要）
        const memoryInfo = await page.evaluate(() => {
            return (performance as any).memory ? {
                usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
                totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
                jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
            } : null;
        });

        if (memoryInfo) {
            expect(memoryInfo.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024); // 100MB（現実的な制限）
            console.log(`メモリ使用量: ${Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024)}MB`);
        }
    });
});
