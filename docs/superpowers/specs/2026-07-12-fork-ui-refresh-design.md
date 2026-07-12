# fork — UI/UX 刷新 設計書

> 作成日: 2026-07-12  
> ステータス: Approved  
> 実装ブランチ: `cursor/fork-ui-refresh-9b77`

## 1. 目的

音声ライブ配信アプリ fork の UI/UX を、Spoon / 17Live / SHOWROOM を参考に刷新し、プロダクトとしての完成度を高める。

### 成功基準

| 指標 | 目標 |
|------|------|
| 全画面一貫性 | ロビー・ルーム・Monitor が同一デザイン言語 |
| モバイル | 44px タップターゲット、縦積みレイアウト |
| デスクトップ | ルーム画面でチャット右サイド（360px） |
| UX | `alert` 廃止、Toast フィードバック、Skeleton ローディング |
| Phase 4 準備 | 検索・映像・ギフト・カテゴリ・帯域の非活性 UI 枠 |

### スコープ外

- バックエンド API 変更
- Phase 4 機能の実装（映像、R2 録画、検索 API）
- E2E テスト自動化
- TanStack Router 移行

---

## 2. 技術選定

| 項目 | 決定 |
|------|------|
| CSS | Tailwind CSS v4 + `@tailwindcss/vite` |
| コンポーネント | shadcn/ui（new-york, CSS variables） |
| 通知 | sonner（`Toaster`） |
| ルーティング | react-router-dom v7（現状維持） |
| テーマ | ダーク固定（`:root` カスタムトークン） |

### デザイントークン

- 背景 `#0a0a0f`、カード `#14141f`
- Primary（LIVE/CTA）`#ff6b6b`
- Accent（ギフト）`#ff9f43`

---

## 3. コンポーネント構成

```
app/src/components/
├── ui/           # shadcn 生成
├── layout/
│   ├── AppShell.tsx
│   └── AppHeader.tsx
├── lobby/
│   ├── LiveRoomCard.tsx
│   ├── CreateRoomForm.tsx
│   ├── SearchBarPlaceholder.tsx
│   └── CategoryTabsPlaceholder.tsx
├── room/
│   ├── HostHeader.tsx
│   ├── MediaStage.tsx
│   ├── ReactionBar.tsx
│   ├── GiftSheet.tsx
│   ├── ViewerDialog.tsx
│   └── ChatPanel.tsx
└── monitor/
    ├── StatsCards.tsx
    └── RoomsTable.tsx
```

`InRoomUI.tsx` は SFU / WebSocket ロジックを保持し、プレゼンテーションを子コンポーネントへ委譲。

---

## 4. 画面設計

### 4.1 ロビー

- AppHeader（共通）
- SearchBarPlaceholder（disabled + Tooltip）
- CategoryTabsPlaceholder（すべて/音楽/トーク、disabled）
- CreateRoomForm（toast バリデーション）
- LIVE カードグリッド（sm:2列、lg:3列）
- 未ログイン時サインインカード

### 4.2 ルーム

- HostHeader: アバター、タイトル、LIVE バッジ、接続状態、視聴者数
- MediaStage: 音声ビジュアライザー + 16:9 映像プレースホルダ
- ReactionBar: like / gift / ギフト+（Sheet）
- コントロールバー: ミュート、公開 toggle、リンクコピー、視聴者、退出
- ChatPanel: lg 時右カラム 360px
- GiftSheet: Coming soon + ギフトグリッド枠
- フローティングリアクションアニメ維持

### 4.3 Monitor

- StatsCards: 合計視聴者 / ルーム数 / アクティブ配信
- RoomsTable: shadcn Table
- 帯域モニター（disabled + Tooltip）
- 403 時: 権限不足カード

---

## 5. UX 改善一覧

| 変更前 | 変更後 |
|--------|--------|
| `alert()` | `toast.error` / `toast.info` |
| リンクコピー無反応 | `toast.success` |
| 接続中空白 | Skeleton + 「接続中…」 |
| `window.location.assign` | `useNavigate` |
| 素の CSS クラス | Tailwind + shadcn |

---

## 6. Phase 4 UI 枠

| 機能 | 配置 | 状態 |
|------|------|------|
| ルーム検索 | ロビー | disabled Input |
| カテゴリ | ロビー | disabled Tabs |
| 映像配信 | ルーム MediaStage | 16:9 placeholder |
| ギフトパネル | ルーム Sheet | Coming soon |
| 帯域モニター | Monitor | disabled Button |

---

## 7. 検証

- `npm run build:app` 成功
- `npm run typecheck -w app` 成功
- 手動: ロビー作成、ルーム配信/視聴、Monitor 403/200
