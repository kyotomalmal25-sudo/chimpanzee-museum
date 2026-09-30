# Chimpanzee Museum v2

自分で生成した画像を、自分で投稿・編集・削除できる小さなギャラリー。
ビルド工程なし・依存なしの静的サイトです（HTML / CSS / ES Modules）。保存先は既存の Supabase（認証・DB・Storage）をそのまま使います。

## 構成

```
index.html            シェル（サイドバー / ダイアログ）
assets/css/site.css   デザイントークンと全スタイル
assets/js/app.js      ルーティング・画面・管理UI
assets/js/backend.js  Supabase 接続（読み込み・投稿・編集・削除）
assets/js/image.js    ブラウザ内での縮小・WebP変換
assets/js/config.js   サイト名・Supabase設定・AI一覧
assets/fonts/         Instrument Serif / DM Sans / IBM Plex Mono（Latinサブセット, OFL）
samples/              作品が0件のときだけ表示する見本画像
vendor/supabase.js    supabase-js 2.117.2（MIT）
_headers              Cloudflare Pages 用キャッシュ設定
```

## URL

| URL | 内容 |
|---|---|
| `/` | ホーム（ランダムに1点＋最近の4点。「ほかの作品」で引き直し） |
| `/collection` | すべての作品 |
| `/collection/gpt` など | AI別の棚（作品0件の棚はメニューに出ない） |
| `/work/<id>` | 鑑賞室（← → / スワイプ / ESC） |
| `/draw` | らくがき帳（ペン・マーカー・塗りつぶし・消しゴム、レイヤー最大8枚。管理者は描いた絵をそのまま作品として公開できる） |
| `/notes` | ひとこと帳（1行メモの掲示板。書くのは管理者だけ、読むのは誰でも。通常／太字・色・大きさ） |
| `/about` | この美術館について |
| `/admin` | 管理者ログイン（左メニュー下に小さくリンクあり） |

## 投稿のしかた

1. `/admin` を開いてログイン
2. 左メニューの「作品を投稿」→ 画像をドロップ（複数可）
3. 作品名はファイル名から自動入力。制作AIはまとめて設定も個別設定もできる
4. 「公開する」

画像はアップロード前にブラウザ内で **表示用（長辺2400px）** と **サムネイル（長辺720px）** の2つに縮小・WebP変換されます。元画像が重くても一覧は軽いまま。アニメGIFは表示用のみ元ファイルのまま保存。

編集・削除は鑑賞室の「編集・削除」から。まとめて消すときは左メニューの「選択して削除」。

## Supabase 側

既存のテーブル・バケットをそのまま使います（スキーマ変更なし）。

- テーブル `museum_works`（id, title, alt, ai, file, storage_path, sort_order, created_at, updated_at）
- テーブル `museum_admins`（user_id）
- テーブル `museum_notes`（ひとこと帳。作成用SQLは `sql/museum_notes.sql`）
- バケット `museum-images`：保存名は `artworks/<uuid>.<拡張子>` のみ許可（ストレージの制限）。表示用 `artworks/<uuid>.webp` と、uuidの最後のブロックを逆順にした名前のサムネイルを保存

## 公開（Cloudflare Pages）

公開中: https://chimpanzee-museum-v2.pages.dev （Cloudflare Pages の Direct Upload プロジェクト `chimpanzee-museum-v2`）。ビルド不要。
更新するときは、サイトのファイル（index.html, favicon.svg, og.png, _headers, assets/, samples/, vendor/）をzipにして、プロジェクトの「Create deployment」からアップロード。
`404.html` を置いていないので、Cloudflare Pages が自動的に SPA として `index.html` を返します。

独自ドメインに移すときは `index.html` の `og:image` / `og:url` も書き換える。

## ローカル確認

```
node scripts/serve.mjs            # http://127.0.0.1:4173
http://127.0.0.1:4173/?demo       # Supabaseに接続せず見本画像で表示
```

テスト（Supabase をブラウザ内で模擬し、投稿〜削除まで15項目）:

```
node scripts/serve.mjs &
NODE_PATH=$(npm root -g) node tests/e2e.cjs      # playwright と sharp が必要
```
