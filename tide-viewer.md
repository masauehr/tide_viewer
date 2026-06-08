# 沖縄県 潮位観測ビューア（tide_viewer）

気象庁 BOSAI API を使い、沖縄県7観測所の潮位をリアルタイム一覧表示するシングルページWebアプリ。

## 概要

| 項目 | 内容 |
|------|------|
| フォルダ | `~/projects/tide_viewer/` |
| 技術 | Vanilla JS / HTML / CSS + Chart.js 4.x (CDN) |
| データ | 気象庁 BOSAI 潮位観測API（非公式・無認証） |
| 更新頻度 | 15分間隔（アプリは5分ごとに自動再取得） |
| GitHub | 公開予定 (GitHub Pages) |

## 対応観測所（沖縄県）

| 観測所 | 観測点コード | 所在地 |
|--------|-------------|--------|
| 那覇 | 209131 | 那覇市 通堂町 |
| 沖縄 | 209105 | 南城市 知念 |
| 中城湾港 | 209181 | 沖縄市 海邦 |
| 平良 | 209381 | 宮古島市 平良西里 |
| 石垣 | 209431 | 石垣市 八島町2丁目 |
| 与那国 | 209432 | 八重山郡 与那国町 久部良 |
| 南大東 | 209231 | 島尻郡 南大東村 北 |

## 使用方法

### ローカル起動（開発・確認）

```bash
cd ~/projects/tide_viewer
python3 -m http.server 8080
# ブラウザで http://localhost:8080 を開く
```

### GitHub Pages デプロイ

GitHub リポジトリを作成し、GitHub Pages を有効にするだけで動作。
（気象庁APIへのfetchはクライアントサイドで行うためサーバー不要）

```bash
cd ~/projects/tide_viewer
git remote add origin https://github.com/<username>/tide_viewer.git
git push -u origin main
# GitHub → Settings → Pages → Source: main / root
```

## ファイル構成

```
tide_viewer/
├── index.html        # メインページ
├── css/
│   └── style.css    # スタイルシート
├── js/
│   ├── config.js    # 観測所リスト・API設定・グラフ色
│   └── app.js       # データ取得・グラフ描画・自動更新
└── README.md
```

## 使用API

| データ | エンドポイント |
|--------|---------------|
| 現在時刻 | `https://www.jma.go.jp/bosai/tidelevel/data/tide/tide_time.json` |
| 観測データ | `https://www.jma.go.jp/bosai/tidelevel/data/tide/tide_obs_{YYYYMMDD}_{観測点コード}.json` |
| 天文潮位 | `https://www.jma.go.jp/bosai/tidelevel/const/tide_astro/tide_astro_{YYYY}_{観測点コード}.json` |
| 観測所リスト | `https://www.jma.go.jp/bosai/tidelevel/const/tide_area.json` |

### データ形式の注意点

- `tide_obs_*.json` は **約29日分** のデータを1ファイルに含む（今日 + 将来の天文潮位予測）
- 単位: **cm（TP：東京湾平均海面基準）**
- アプリは先頭96点（24時間×4点/時）を今日分として切り出して表示

## 観測所の追加・変更

`js/config.js` の `STATIONS` 配列を編集する。
観測点コードは `const/tide_area.json` で確認可能。

```javascript
const STATIONS = [
  {
    code: '209131',       // 観測点コード
    name: '那覇',          // 表示名
    addr: '那覇市 通堂町',  // 住所
    area_code: '4720100', // エリアコード
    class30: '47101100',  // 地域コード
    jma_url: 'https://...', // 気象庁ページURL
  },
  // ...
];
```

## 注意事項

- 気象庁APIは非公式利用。利用規約に従い、過剰なリクエストは控えること
- APIの仕様・URLは予告なく変更される場合がある
- CORS はブラウザから直接アクセスできる（サーバー不要）
