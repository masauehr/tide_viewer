# 潮位観測ビューア

> 詳しくは [tide-viewer.md](tide-viewer.md) を参照。

**Website:** https://masauehr.github.io/tide_viewer/

気象庁の潮位観測データを使って、全国の観測所の潮位を一覧表示するWebアプリです。

## 主な機能

- 観測所選択UI（全国39都道府県・166局から選択・localStorage で記憶）
- 都道府県単位の一括選択・解除
- デフォルト表示は沖縄7局
- 8段階ズームモード（36時間〜±1時間）
- 観測潮位 + 天文潮位 + 偏差グラフを各観測所カードに表示

## データソース

- 提供：[気象庁 潮位観測情報](https://www.jma.go.jp/bosai/tidelevel/)
- 観測記録：15秒間隔（rawデータ）
- アプリ更新：5分ごとに自動再取得
- 単位：cm（TP：東京湾平均海面基準）

## 使用方法

ローカルでの動作確認には、CORSを避けるため簡易HTTPサーバーが必要です。

```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx)
npx serve .
```

ブラウザで `http://localhost:8080` を開いてください。

または GitHub Pages にデプロイすれば直接アクセスできます。

## ファイル構成

```
tide_viewer/
├── index.html        # メインページ
├── css/
│   └── style.css    # スタイルシート
├── js/
│   ├── config.js    # デフォルト観測所・API設定・ズームモード定義
│   └── app.js       # データ取得・描画ロジック・観測所選択UI
└── README.md
```

## 技術仕様

- Vanilla JS / HTML / CSS（フレームワーク不使用）
- Chart.js 4.x（CDN）でグラフ描画
- 気象庁 BOSAI API を直接フェッチ

### API エンドポイント

| データ | URL |
|--------|-----|
| 現在時刻 | `https://www.jma.go.jp/bosai/tidelevel/data/tide/tide_time.json` |
| 観測データ | `https://www.jma.go.jp/bosai/tidelevel/data/tide/tide_obs_{YYYYMMDD}_{観測点コード}.json` |
| 天文潮位 | `https://www.jma.go.jp/bosai/tidelevel/const/tide_astro/tide_astro_{YYYY}_{観測点コード}.json` |
| 観測所リスト | `https://www.jma.go.jp/bosai/tidelevel/const/tide_area.json` |

## ライセンス・注意事項

- 気象庁データの利用は[気象庁利用規約](https://www.jma.go.jp/jma/kishou/info/coment.html)に従ってください
- 気象庁APIの仕様は予告なく変更される場合があります
