# AGENTS.md — 名刺超高速スキャン × Google Sheets CRM

## プロジェクト概要

Vanilla JS製のPWAアプリ。スマートフォン/PCのカメラで名刺を撮影し、Gemini APIでデータ抽出、Google Sheetsに直接書き込むCRMシステム。

### 現在のファイル構成

```
/
├── index.html       # メインUI（カメラ・フォーム・履歴・バッチ処理）
├── app.js           # メインロジック（BusinessCardScannerクラス）
├── api.js           # Gemini API連携（GeminiAPIクラス）
├── style.css        # スタイル
├── manifest.json    # PWAマニフェスト
└── README.md
```

### 技術スタック

- フロントエンド: Vanilla JS（フレームワークなし）
- AI: Gemini 2.5 Flash API（名刺OCR・メッセージ生成）
- データ保存: localStorage（履歴・設定）
- 外部連携: Google Sheets API v4（OAuth 2.0）
- PWA: manifest.json（Service Worker未実装）

---

## 実装タスク（3ステップ）

---

## STEP 1: Google Sheets CRM 再設計（Google Apps Script生成）

### 目的
現在の「1行25列の横長シート」を、Translead CRM風の「4シート構成CRM」に再設計する。

### 成果物
`setup_crm.gs` — Google Apps Script ファイルを新規作成すること。

### 要件

#### Sheet 1: 取引先マスター（会社単位）
列順: `会社ID | 法人名 | 業種 | 住所 | 電話 | HP | ステータス | 担当者 | タグ | メモ | 登録日`

#### Sheet 2: 担当者（名刺データの書き込み先）
列順: `担当者ID | 会社ID | 顧客種別 | 氏名 | 部署・役職 | TEL | メール | HP | 住所 | タグ | 初回接触日 | 接触方法 | 紹介者 | ステータス | 担当者 | スキャン日時 | メモ`

**重要**: アプリからの書き込みはこのシートの末尾に追記する。

#### Sheet 3: 案件パイプライン
列順: `案件ID | 会社ID | 担当者ID | 案件名 | 金額 | フェーズ | 確度% | 契約予定日 | 担当者 | ネクストアクション | 期日 | メモ`

フェーズの選択肢: `初回接触 | 関係構築 | ニーズ把握 | 提案 | クロージング | 受注 | 失注`

#### Sheet 4: 活動ログ
列順: `ログID | 担当者ID | 会社ID | 氏名 | 法人名 | 日付 | 活動種別 | 内容 | 担当者 | ネクストアクション`

活動種別の選択肢: `名刺交換 | LINE | メール | 電話 | 訪問 | 勉強会 | 提案 | その他`

### Apps Scriptが実装すべき機能

1. **`setupCRM()`** — 4シートを作成し、ヘッダー行（太字・背景色）を設定
2. **条件付き書式** — Sheet2のステータス列を色分け
   - 名刺交換: グレー (`#f3f3f3`)
   - 進行中: 青 (`#cfe2f3`)
   - 検討中: 黄 (`#fff2cc`)
   - 受注: 緑 (`#d9ead3`)
   - 失注: 赤 (`#f4cccc`)
3. **データ検証** — ステータス列・フェーズ列・活動種別列にドロップダウン設定
4. **フィルタビュー** — Sheet2に「担当者別」「ステータス別」フィルタビューを作成
5. **`autoId()`** — 行追記時にID列（A列）へ自動採番するonEdit トリガー
   - Sheet2: `担当者ID` → `BC-001`形式
   - Sheet3: `案件ID` → `DEAL-001`形式
   - Sheet4: `ログID` → `LOG-001`形式
6. **ダッシュボードシート** — `=COUNTIF`でステータス別件数を集計する簡易ダッシュボード

### 実装上の注意

- Google Apps Script (GAS) で実装。`SpreadsheetApp.getActiveSpreadsheet()` を使用
- スクリプトを実行するだけで全シートが自動セットアップされること
- 既存シートがあれば確認ダイアログを出してスキップ or 上書き
- コメントを日本語で記載

---

## STEP 2: アプリ改修（index.html / app.js / api.js / style.css）

### 2-1. 住所フィールドの追加（api.js）

`analyzeBusinessCard()` のプロンプト内JSONに `"address"` フィールドを追加:
```
"address": "住所（都道府県から番地まで。複数行は半角スペースで連結）",
```
戻り値の正規化にも `address: result.address || ''` を追加。

### 2-2. 住所フィールドをUIに追加（index.html）

結果フォームのHP欄の直下に追加:
```html
<div class="form-group">
    <label>住所</label>
    <input type="text" id="address" placeholder="東京都渋谷区〇〇 1-2-3">
</div>
```

### 2-3. フォームフィールドの登録（app.js）

`this.fields` オブジェクトに `address: document.getElementById('address')` を追加。
`analyzeImage()` の結果反映部分に `this.fields.address.value = result.address;` を追加。
`getCurrentFormData()` に `address: this.fields.address.value` を追加。
`loadHistoryItem()` に `this.fields.address.value = entry.address || ''` を追加。

### 2-4. Google Sheets書き込み先を新シート構造に対応（app.js）

`buildSheetRow()` を新Sheet2（担当者）の列順に完全に作り直す:
```
[空列, 空列, data.type, data.name, data.position, data.phone, data.email,
 data.website, data.address, data.tag, data.contactDate, data.contactMethod,
 data.referrer, data.status, data.assignee, new Date().toISOString(), '']
```
（A列=担当者ID、B列=会社IDは空欄。Apps Scriptの自動採番が入る）

### 2-5. 活動ログ（Sheet4）への同時書き込み（app.js）

`writeCurrentToSheet()` を改修。現在は Sheet2 への書き込みのみだが、
`nextAction` が空でない場合、Sheet4 にも1行追記する:
```
[空列, 空列, 空列, data.name, data.company, today, '名刺交換', data.nextAction, data.assignee, '']
```

`appendRowsToSheet()` をシート名を引数で受け取れるよう汎用化すること。

### 2-6. alert() をトースト通知に置き換え（app.js / style.css / index.html）

#### index.html
`<body>` 直下に追加:
```html
<div id="toastContainer" class="toast-container"></div>
```

#### style.css
```css
.toast-container {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
}
.toast {
    padding: 12px 20px;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    animation: toastIn 0.3s ease, toastOut 0.3s ease 2.7s forwards;
    pointer-events: auto;
    max-width: 320px;
    text-align: center;
}
.toast.success { background: #34a853; }
.toast.error   { background: #ea4335; }
.toast.warning { background: #fbbc04; color: #333; }
.toast.info    { background: #4285f4; }
@keyframes toastIn  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes toastOut { from { opacity: 1; } to { opacity: 0; } }
```

#### app.js — showNotification() の完全置き換え
```javascript
showNotification(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) { alert(message); return; }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
```

`confirm()` を使っている箇所はそのまま維持（UIモーダルへの置き換えは別タスク）。

### 2-7. バッチデータのlocalStorage永続化（app.js）

`this.batchData = []` を `this.batchData = this.loadBatch()` に変更。
以下のメソッドを追加:
```javascript
loadBatch() {
    try { return JSON.parse(localStorage.getItem('batchData') || '[]'); } catch { return []; }
}
saveBatch() {
    localStorage.setItem('batchData', JSON.stringify(this.batchData));
}
```
`addToBatch()`, `removeFromBatch()`, `clearBatch()` の末尾に `this.saveBatch()` を呼び出す。

---

## STEP 3: PWA強化（manifest.json / service-worker.js / index.html）

### 3-1. manifest.json の強化

以下のフィールドを追加/更新:
```json
{
  "name": "名刺スキャナー CRM",
  "short_name": "名刺CRM",
  "description": "名刺をスキャンしてGoogleシートに即時登録",
  "start_url": "./index.html",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#4285f4",
  "categories": ["business", "productivity"],
  "shortcuts": [
    {
      "name": "カメラで撮影",
      "url": "./index.html#camera",
      "icons": [{"src": "icons/camera-96.png", "sizes": "96x96"}]
    }
  ]
}
```

### 3-2. service-worker.js の新規作成

キャッシュ戦略: Cache First（静的ファイル）+ Network First（APIリクエスト）

キャッシュ対象: `index.html`, `app.js`, `api.js`, `style.css`, `manifest.json`

```javascript
const CACHE_NAME = 'meishi-crm-v1';
const STATIC_ASSETS = ['/', '/index.html', '/app.js', '/api.js', '/style.css', '/manifest.json'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
});

self.addEventListener('fetch', (e) => {
    // APIリクエストはNetwork First
    if (e.request.url.includes('googleapis.com') || e.request.url.includes('generativelanguage')) {
        e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
        return;
    }
    // 静的ファイルはCache First
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
```

### 3-3. Service Worker登録（index.html）

`</body>` の直前に追加:
```html
<script>
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .then(() => console.log('SW registered'))
        .catch(e => console.warn('SW registration failed:', e));
}
</script>
```

---

## Codex実行コマンド（推奨）

### Step 1
```bash
codex "AGENTS.mdのSTEP 1の要件に従い、Google Apps Scriptファイル setup_crm.gs を新規作成してください。日本語コメント付きで、全機能を実装してください。"
```

### Step 2
```bash
codex "AGENTS.mdのSTEP 2の要件に従い、index.html / app.js / api.js / style.css を改修してください。2-1から2-7を順番に全て実装してください。"
```

### Step 3
```bash
codex "AGENTS.mdのSTEP 3の要件に従い、manifest.json を更新し、service-worker.js を新規作成し、index.htmlにSW登録コードを追加してください。"
```

---

## 重要な制約・注意事項

- フレームワーク不使用（Vanilla JS維持）
- 既存の機能（カメラ・自動スキャン・フォルダスキャン・履歴・バッチ）は壊さないこと
- Google OAuth認証フローは変更しないこと
- Gemini APIキーは `localStorage.getItem('geminiApiKey')` から取得（変更不要）
- CSVコピー機能も維持すること（後方互換）
- 文字コードはUTF-8

## 利用可能なスキル（参照用）

- `~/.agents/skills/crm-integration` — CRMパターン・パイプライン設計
- `~/.agents/skills/progressive-web-app` — PWAベストプラクティス
