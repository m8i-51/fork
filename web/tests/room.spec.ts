import { test, expect } from '@playwright/test';

test.describe('ルーム機能', () => {
    test('配信タイトル入力フィールドのバリデーション', async ({ page }) => {
        await page.goto('/');

        const input = page.getByPlaceholder('配信タイトル');
        const button = page.getByRole('button', { name: '配信を開始' });

        // 初期状態ではボタンが無効
        await expect(button).toBeDisabled();

        // 空文字列では無効のまま
        await input.fill('');
        await expect(button).toBeDisabled();

        // 無効な文字列（特殊記号）では無効
        await input.fill('テスト<>"\'`');
        await expect(button).toBeDisabled();

        // エラーメッセージが表示される
        await expect(page.getByText('1〜32文字、絵文字・< > " \' ` などの特殊記号は使用できません。')).toBeVisible();

        // 有効な文字列では有効になる（ただし認証が必要なので実際は無効のまま）
        await input.fill('テスト配信');
        // 認証なしではボタンは無効のまま
        await expect(button).toBeDisabled();
    });

    test('ルーム入室機能の表示', async ({ page }) => {
        await page.goto('/');

        // 公開中のルーム一覧が表示される
        await expect(page.getByText('公開中のルーム', { exact: true })).toBeVisible();

        // ルームが存在しない場合のメッセージが表示される
        await expect(page.getByText('現在、公開ルームはありません。')).toBeVisible();
    });

    test('公開中のルーム一覧が表示される', async ({ page }) => {
        await page.goto('/');

        // 公開中のルームセクションが表示される
        await expect(page.getByText('公開中のルーム', { exact: true })).toBeVisible();

        // ルーム一覧のコンテナが表示される（ルームが存在する場合のみ）
        // 現在はルームが存在しないので、メッセージが表示される
        await expect(page.getByText('現在、公開ルームはありません。')).toBeVisible();
    });
});
