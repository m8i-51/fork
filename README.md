# fork – Live Audio MVP (Web)

音声ライブ配信の最小実装（Spoon風）。本プロジェクト名は「fork」です。

- 技術スタック: Next.js + NextAuth(Google/Twitter) + LiveKit(JS SDK) + Prisma(PostgreSQL)
- 主な機能: 認証、ルーム作成/入室、音声配信/視聴、チャット、視聴者数（SSE）、リアクション（👍/🎁）、監視ページ
- スケール前提: 同時視聴 数十人（SFU: LiveKit自前ホストで低コスト運用可能）

## セットアップ

1) LiveKitサーバを用意（Docker Compose推奨）

```bash
# 事前に Docker/Desktop をインストール
make livekit-up   # リポジトリのルートで実行
```

- WebSocket URL: `ws://localhost:7880`（.envで設定）
- APIキー/シークレット: `devkey` / `devsecret`（サンプル）

2) Webクライアントのセットアップ

```bash
cd web
cp .env.local.example .env.local
# .env.local を環境に合わせて編集
npm install
npx prisma migrate dev               # 初回のみ（対話に従ってDB作成）
npx prisma generate                  # 念のため生成を明示
npm run dev
```

3) 動作確認（ロビー→ルームへ）

- ブラウザで `http://localhost:3001` を開き、Google/Twitterでサインイン
- ロビー（トップ）
  - 公開中ルームの一覧カード（LIVEバッジ/視聴者数/視聴ボタン）
  - 既存ルームに入室: ルームID（URLの末尾、slug）を入力→入室
  - 新規作成: 表示名（任意）を入力→ルーム作成→配信者として入室
- ルームページ（`/room/[slug]`）
  - 配信者: ミュート/マイク選択/公開ON-OFF/退出、チャット、リアクション集計
  - 視聴者: チャット、リアクション送信、視聴者数がSSEで即時反映
  - ホスト離脱時は視聴者は自動退出

## 環境変数

`.env.local`

- `NEXTAUTH_URL` / `NEXTAUTH_SECRET`（ローカルは `http://localhost:3001`）
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET`
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`
- `NEXT_PUBLIC_LIVEKIT_WS_URL`（例: `ws://localhost:7880`）

## ルーティングとデータモデル

- ロビー: `/`（公開中ルーム一覧、入室/新規作成導線）
- ルーム: `/room/[slug]`（配信/視聴画面。`?publish=true|false`）
- 監視: `/admin/monitor`（サインイン必須）

データモデル（Prisma）
- Room: `name`（=slug, URLのID）, `displayName?`（表示名）, `hostIdentity?`, `isPublic`, `createdAt`
- Presence: ルームご在席（心拍で更新）。視聴者数は直近60秒のPresenceを集計（ホストは除外）
- Reaction/ReactionAggregate: 👍/🎁 の保存と集計

API の要点
- `POST /api/room/create`（表示名つき新規作成。slug自動採番）
- `GET /api/room/list?onlyLive=true&withinSec=60`（公開中一覧+視聴者数）
- `GET /api/room/viewers/stream?room=...`（SSEで視聴者数ストリーム）
- `POST /api/presence/heartbeat` / `POST /api/presence/leave`（在席更新/離脱）
- `POST /api/reaction/send` / `GET /api/reaction/summary`（リアクション送信/集計）
- `POST /api/room/set-public`（配信者のみ。公開ON/OFF）

## スクリプトと運用メモ

Prisma/DB（`web/package.json`）

- `npm run db:migrate` … `prisma migrate dev`
- `npm run db:push` … `prisma db push`（開発用の手早い反映）
- `npm run db:reset` … SQLiteを初期化→`migrate dev`

Tips
- `NEXTAUTH_SECRET` 生成例: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- チャットはLiveKitのデータチャネルでサーバ不要。視聴者数はSSEで即時反映
 - 本番はLiveKitサーバのスケール/TURN設定、NextAuthの公開URL/Secrets、DBはPostgreSQL（Supabase等）を利用

## OAuthコールバックURL（ローカル・ポート3001）

- Google: `http://localhost:3001/api/auth/callback/google`
- Twitter: `http://localhost:3001/api/auth/callback/twitter`
- 注意: Twitterの「Website URL」はlocalhost不可。公開httpsページ（例: GitHubリポジトリURL）を設定してください。

## Makefile（便利コマンド）

```bash
make livekit-up     # LiveKit をバックグラウンド起動（ルートで実行）
make livekit-down   # LiveKit を停止
make web-dev        # Web を dev 起動（初回は依存もインストール）
```

## 本番デプロイ（A: マネージド構成）

Vercel（Web）+ Supabase（Postgres）+ LiveKit Cloud（無料開発枠）でデプロイ可能です。

- Supabase（DB）
  - プロジェクト作成→`DATABASE_URL` を取得（例: `postgres://USER:PASSWORD@HOST:5432/DB?schema=public`）
- Vercel（Web）
  - リポジトリをインポート→環境変数を設定
    - `NEXTAUTH_URL=https://<your-vercel-domain>`
    - `NEXTAUTH_SECRET`（32文字以上を生成）
    - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
    - `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET`
    - `NEXT_PUBLIC_LIVEKIT_WS_URL=wss://<livekit-cloud-wss>`
    - `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`
    - `DATABASE_URL`（Supabaseの接続文字列）
  - Build: `npm run build`（デフォルト） / Install: `npm ci`
  - 本リポジトリは `postinstall` に `prisma generate` を設定済み。
  - 重要: 既存の `web/prisma/migrations` はSQLite由来のため、PostgreSQLではそのまま適用できません。初回は本番DBで `npx prisma db push` を実行してテーブルを作成してください（VercelのBuild Stepに追加 or デプロイ後に手動）。
- LiveKit Cloud（配信基盤）
  - Project作成→ `WSS URL` / `API_KEY` / `API_SECRET` を発行し、Vercelの環境変数へ
- OAuth（Google/Twitter）
  - Callback URL をVercelの本番ドメインへ更新
    - Google: `https://<your-domain>/api/auth/callback/google`
    - Twitter: `https://<your-domain>/api/auth/callback/twitter`

Prisma 運用メモ
- スキーマ: `web/prisma/schema.prisma`（provider=postgresql）
- 初期化: まず本番DBに `npx prisma db push`（SQLite由来の古いmigrationは使わない）
- 以降の変更: ローカルでPostgresに接続した状態で `npx prisma migrate dev` を実行し、Postgres向けmigrationを新規作成→本番で `npx prisma migrate deploy`
