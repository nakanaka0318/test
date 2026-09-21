# 朱入れPDF — PDF テキスト注釈エディタ

`public/pdf-editor.html` は依存パッケージのない単体の HTML ページです。PDF を開いて
好きな位置にテキストを置き、**同じファイルに上書き保存**します。

- Vite 開発サーバー: `npm run dev` → http://localhost:5173/pdf-editor.html
- ビルド成果物: `dist/pdf-editor.html`（`public/` はそのままコピーされます）
- 静的配信のみでも可: `npx serve public`

## できること

| 機能 | ローカルファイル | Google ドライブ |
|---|---|---|
| 開く | ファイル選択 / ドラッグ | Google Picker で選択 |
| 上書き保存 | File System Access API で元ファイルを直接更新 | 同じ `fileId` に PATCH（新リビジョン） |
| 別名で保存 | ダウンロード | ダウンロード |

ページをクリックすると注釈を追加、ドラッグで移動、ダブルクリックで文字を編集します。
`Ctrl`/`Cmd` + `S` で上書き保存、`Delete` で選択中の注釈を削除します。

## 文字の埋め込み方

- 本文が ASCII のみ → PDF 標準フォント（Helvetica / Times / Courier）でベクタ描画。
  保存後も文字として選択・検索できます。
- **日本語など非 ASCII を含む場合** → 画面と同じ書体で 4px/pt にラスタライズし、PNG として
  埋め込みます。PDF 標準フォントは日本語を表現できないためで、CJK フォントを丸ごと同梱せずに
  どんな文字でも確実に書き込めます（保存後の文字選択はできません）。

ページの `/Rotate`（90 / 180 / 270°）は座標変換して正しい向き・位置に配置します。

## Google ドライブ連携の設定

ドライブ連携はブラウザから Google の OAuth・Drive API を直接呼ぶため、**実際のオリジンで
配信されている必要があります**（GitHub Pages、社内ホスティング、`localhost` など）。
claude.ai のアーティファクト内では CSP により Google のスクリプトを読み込めません。

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成。
2. **API とサービス → ライブラリ** で次を有効化。
   - Google Drive API
   - Google Picker API
3. **認証情報 → OAuth クライアント ID**（種類: ウェブ アプリケーション）を作成。
   「承認済みの JavaScript 生成元」に配信元オリジンを登録します
   （例: `https://<ユーザー名>.github.io`、`http://localhost:5173`）。
4. **認証情報 → API キー**を作成（Picker が使います）。
5. プロジェクト番号（= アプリ ID）を控えます。
   `drive.file` スコープで Picker から選んだファイルに書き込むために必要です。
6. ページ右の **「Drive 設定」** を開き、クライアント ID / API キー / アプリ ID を入力。
   値は `localStorage` にのみ保存され、どこにも送信されません。

### スコープについて

要求するのは `https://www.googleapis.com/auth/drive.file` だけです。
これは **Picker で自分が選んだファイル** にしかアクセスできない最小権限で、
ドライブ全体を読む権限は要求しません。

### 上書きの挙動

保存は同じファイル ID への `PATCH .../upload/drive/v3/files/{id}?uploadType=media` です。
ファイル ID・共有設定・リンクは変わらず、ドライブ側では新しいリビジョンが積まれます。
そのため保存した直後からドライブ上で新しい内容が表示され、旧版は「版を管理」から辿れます。
