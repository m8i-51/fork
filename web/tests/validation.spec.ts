import { test, expect } from '@playwright/test';

test.describe('フォームバリデーション', () => {
    test('配信タイトルのバリデーション詳細', async ({ page }) => {
        await page.goto('/');

        const input = page.getByPlaceholder('配信タイトル');
        const button = page.getByRole('button', { name: '配信を開始' });

        // 1文字未満は無効
        await input.fill('');
        await expect(button).toBeDisabled();

        // 33文字以上は無効
        await input.fill('a'.repeat(33));
        await expect(button).toBeDisabled();

        // 特殊記号は無効
        const invalidChars = ['<', '>', '"', "'", '`'];
        for (const char of invalidChars) {
            await input.fill(`テスト${char}配信`);
            await expect(button).toBeDisabled();
        }

        // 絵文字は無効
        await input.fill('テスト🎉配信');
        await expect(button).toBeDisabled();

        // 有効な文字列（1-32文字、英数字・ひらがな・カタカナ・漢字）
        await input.fill('テスト配信123');
        // 認証なしではボタンは無効のまま
        await expect(button).toBeDisabled();
    });

    test('ルーム入室のバリデーション', async ({ page }) => {
        await page.goto('/');

        // 公開中のルーム一覧が表示される
        await expect(page.getByText('公開中のルーム', { exact: true })).toBeVisible();

        // 現在はルームが存在しないので、メッセージが表示される
        await expect(page.getByText('現在、公開ルームはありません。')).toBeVisible();

        // ルームが存在する場合の「視聴する」ボタンの動作は別途テスト
    });

    test('エラーメッセージの表示', async ({ page }) => {
        await page.goto('/');

        const input = page.getByPlaceholder('配信タイトル');

        // 無効な文字列を入力
        await input.fill('テスト<>配信');

        // エラーメッセージが表示される
        await expect(page.getByText('1〜32文字、絵文字・< > " \' ` などの特殊記号は使用できません。')).toBeVisible();

        // 有効な文字列に変更するとエラーメッセージが消える
        await input.fill('テスト配信');
        await expect(page.getByText('1〜32文字、絵文字・< > " \' ` などの特殊記号は使用できません。')).not.toBeVisible();
    });
});
