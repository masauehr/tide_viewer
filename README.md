# 沖縄県 潮位観測ビューア

気象庁の潮位観測データを使って、沖縄県の複数観測所を一覧表示するWebアプリです。

## スクリーンショット

各観測所カードに以下を表示します：
- 現在の潮位（cm）
- 今日の潮位グラフ（観測値 + 天文潮位）

## 対応観測所（沖縄県）

| 観測所 | 所在地 |
|--------|--------|
| 那覇 | 那覇市 通堂町 |
| 沖縄 | 南城市 知念 |
| 中城湾港 | 沖縄市 海邦 |
| 平良 | 宮古島市 平良西里 |
| 石垣 | 石垣市 八島町2丁目 |
| 与那国 | 八重山郡 与那国町 久部良 |
| 南大東 | 島尻郡 南大東村 北 |

## データソース

- 提供：[気象庁 潮位観測情報](https://www.jma.go.jp/bosai/tidelevel/)
- 更新頻度：15分間隔
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
│   ├── config.js    # 観測所リスト・API設定
│   └── app.js       # データ取得・描画ロジック
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
