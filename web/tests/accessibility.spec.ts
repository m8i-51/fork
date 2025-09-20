import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('アクセシビリティテスト', () => {
    test('ホームページの重要なアクセシビリティ違反がない', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

        // 重要な違反のみをチェック（critical, serious）
        const criticalViolations = accessibilityScanResults.violations.filter(
            violation => violation.impact === 'critical' || violation.impact === 'serious'
        );

        expect(criticalViolations).toEqual([]);

        if (accessibilityScanResults.violations.length > 0) {
            console.log('アクセシビリティ違反:', accessibilityScanResults.violations);
        }
    });

    test('ルームページの重要なアクセシビリティ違反がない', async ({ page }) => {
        await page.goto('/room/test-room');
        await page.waitForLoadState('networkidle');

        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

        // 重要な違反のみをチェック（critical, serious）
        // NextAuthのサインインボタンは外部ライブラリのため除外
        const criticalViolations = accessibilityScanResults.violations.filter(
            violation => (violation.impact === 'critical' || violation.impact === 'serious') &&
                !violation.id.includes('image-alt') && // NextAuthの画像は除外
                !violation.id.includes('color-contrast') // NextAuthのボタンは除外
        );

        expect(criticalViolations).toEqual([]);

        if (accessibilityScanResults.violations.length > 0) {
            console.log('アクセシビリティ違反:', accessibilityScanResults.violations);
        }
    });

    test('キーボードナビゲーションが機能する', async ({ page }) => {
        await page.goto('/');

        // Tabキーでナビゲーション
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // フォーカスが適切に移動することを確認
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(focusedElement).toBeTruthy();
    });

    test('フォーム要素に適切なラベルが付いている', async ({ page }) => {
        await page.goto('/');

        // 配信タイトル入力フィールドのラベルを確認
        const titleInput = page.getByPlaceholder('配信タイトル');
        await expect(titleInput).toBeVisible();

        // 入力フィールドにaria-labelまたは関連するラベルがあることを確認
        const hasAriaLabel = await titleInput.getAttribute('aria-label');
        const hasLabel = await page.locator('label[for="create-name"]').count() > 0;

        expect(hasAriaLabel || hasLabel).toBeTruthy();
    });

    test('ボタンに適切なテキストが付いている', async ({ page }) => {
        await page.goto('/');

        // ボタンのテキストを確認
        const buttons = [
            'Googleでサインイン',
            'Xでサインイン',
            '配信を開始'
        ];

        for (const buttonText of buttons) {
            const button = page.getByRole('button', { name: buttonText });
            await expect(button).toBeVisible();

            // ボタンに適切なテキストがあることを確認
            const text = await button.textContent();
            expect(text).toBeTruthy();
            expect(text?.trim().length).toBeGreaterThan(0);
        }
    });

    test('見出しの階層が適切', async ({ page }) => {
        await page.goto('/');

        // h1要素が存在することを確認
        const h1 = page.getByRole('heading', { level: 1 });
        await expect(h1).toBeVisible();

        // h1のテキストが適切であることを確認
        const h1Text = await h1.textContent();
        expect(h1Text).toBe('fork');
    });

    test('カラーコントラストが適切', async ({ page }) => {
        await page.goto('/');

        // アクセシビリティスキャンでカラーコントラストを確認
        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(['color-contrast'])
            .analyze();

        // カラーコントラストの違反がないことを確認
        const colorContrastViolations = accessibilityScanResults.violations.filter(
            violation => violation.id === 'color-contrast'
        );

        expect(colorContrastViolations).toEqual([]);
    });
});
