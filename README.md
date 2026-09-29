# CHIMPANZEE MUSEUM

既存の黒地・黄緑の美術館デザインを維持し、制作AIの表示、AI別のフィルター、管理者の作品投稿・編集・削除を追加しています。

## 構成

GitHub PagesでHTML・CSS・JavaScript・既存画像を配信し、Supabase Auth・Database・Storageに接続します。独自のサーバーや外部CDNは不要です。公開キーを配置し、書き込みはデータベースと画像保存の権限で管理者だけに制限します。

GitHub Pagesの静的配信: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
Supabase Storageの権限制御: https://supabase.com/docs/guides/storage/security/access-control

既存43作品の画像と並び順を維持。制作AIの記録がなかったため「未分類」にし、管理画面で指定できます。新規画像はJPEG・PNG・WebP・GIF、10MB以下です。作品名、画像説明、制作AIの変更と、画像差し替えができます。

保存に成功してから古い画像を削除します。通信エラーで保存結果が不明の場合は画像を保持し、再読み込みを促します。別画面で変更された作品への更新・削除は拒否します。保存先が設定されている環境の接続障害時は、静的JSONから削除済みの作品を復活させず、エラーを表示します。

## 開発と検証

`npm ci` → `npm run build`。固定バージョンの公式Supabaseブラウザー配布物をルートの`supabase.js`にコピーします。
`npm run serve`でローカル表示、`npm test`でChromeを使った操作検証を実行します。Chromeの場所は`playwright.config.js`で変更できます。

表示、AIフィルター、ページ送り、スマートフォン表示、画像拡大、障害時表示を検証。管理UIの投稿・編集・削除と画像保存の失敗処理はテスト用応答で検証しています。保存先では一般訪問者と管理者以外の書き込み拒否、管理者のCRUDを確認済みです。実アカウントでのログインと画像アップロードは、利用者自身の操作による確認が必要です。

保存先と管理者の初期設定資料は、公開リポジトリと別に管理しています。
