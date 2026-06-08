# 沖縄県 潮位観測ビューア（tide_viewer）

気象庁 BOSAI API を使い、沖縄県7観測所の潮位をリアルタイム一覧表示するシングルページWebアプリ。

## 概要

| 項目 | 内容 |
|------|------|
| リポジトリ | https://github.com/masauehr/tide_viewer |
| フォルダ | `~/projects/tide_viewer/` |
| 技術 | Vanilla JS / HTML / CSS + Chart.js 4.x (CDN) |
| データ | 気象庁 BOSAI 潮位観測API（非公式・無認証） |
| 記録間隔 | **15秒**（表示は15分単位にダウンサンプリング） |
| 自動更新 | 5分ごとにデータ再取得・グラフ再描画 |

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

### GitHub Pages

リポジトリをpushした状態でGitHub → Settings → Pages → Source: main / root を有効にすれば動作。
気象庁APIへのfetchはブラウザ（クライアントサイド）から行うためサーバー不要。

## ファイル構成

```
tide_viewer/
├── index.html        # メインページ
├── css/
│   └── style.css    # スタイルシート
├── js/
│   ├── config.js    # 観測所リスト・API設定・グラフ色・更新間隔
│   └── app.js       # データ取得・グラフ描画・自動更新
├── tide-viewer.md   # このファイル（マニュアル）
└── README.md
```

---

## API 技術詳細

### エンドポイント一覧

| データ種別 | URL |
|------------|-----|
| 現在時刻 | `https://www.jma.go.jp/bosai/tidelevel/data/tide/tide_time.json` |
| 観測データ | `https://www.jma.go.jp/bosai/tidelevel/data/tide/tide_obs_{YYYYMMDD}_{観測点コード}.json` |
| 天文潮位 | `https://www.jma.go.jp/bosai/tidelevel/const/tide_astro/tide_astro_{YYYY}_{観測点コード}.json` |
| 観測所リスト | `https://www.jma.go.jp/bosai/tidelevel/const/tide_area.json` |

CORS制限なし・認証不要。ブラウザから直接fetch可能。

---

### tide_time.json

```json
{"time": "2026-06-08T11:34:45+09:00"}
```

アプリ起動時に取得し、表示用の「現在日時」として使う。
`YYYYMMDD` や `MMDD` への変換は JST基準で行う。

---

### tide_obs_{YYYYMMDD}_{code}.json ― 観測データ

#### 構造

```json
{
  "time":         "2026-06-08T00:00:00+09:00",  // 開始時刻（今日の0:00 JST）
  "station_code": "209131",
  "interval":     15,          // ⚠️ 秒単位（15秒間隔）
  "tide":         [...],       // 観測潮位の配列（cm, TP基準）
  "departure":    [...]        // 潮位偏差 surge = tide - 天文潮位（cm）
}
```

#### ⚠️ interval の単位は「秒」

`interval: 15` は **15秒間隔** であり、分ではない。
1日の総データ点数 = 24時間 × 3600秒 / 15秒 = **5760点**。

ファイルには今日の0:00から「現在時刻まで観測済みの分だけ」データが入っており、
リアルタイムに点数が増え続ける。

| 時刻 | 例：approx. データ点数 |
|------|----------------------|
| 0:00 | 0点（ファイル開始直後） |
| 6:00 | 1440点 |
| 12:00 | 2880点 |
| 24:00 | 5760点（翌日0:00） |

#### tide フィールドの値

- 単位: **cm（TP：東京湾平均海面基準）**
- 値範囲: 観測所により -100〜+200cm 程度
- 欠測: `null` で格納（32767は使われていない）
- 今日の観測値が天文潮位に追随して変動する（沖縄の潮差は数十〜100cm超）

#### departure フィールドの値

- 潮位偏差 = 観測潮位 − 天文潮位（気象的な押し上げ/引き下げ効果）
- 平穏な気象下では ±数cm 程度、台風接近時は数十cm になることがある

---

### tide_astro_{YYYY}_{code}.json ― 天文潮位

```json
{
  "time": "2026-01-01T00:00:00+09:00",
  "station_code": "209131",
  "tide": {
    "0101": [-100, -76, -42, ...],   // 1月1日の0〜23時（24点・1時間間隔）
    "0102": [...],
    ...
    "1231": [...]
  }
}
```

- キーは `MMDD` 形式（例: `"0608"` = 6月8日）
- 各日24点（0時〜23時の1時間間隔）
- 単位: **cm（TP基準）**
- アプリでは1時間→15分単位に線形補間して96点のグラフデータを生成する

---

### tide_area.json ― 観測所リスト

観測所ごとの情報を含む。階層は `area_code → class30s → stations` 。

```json
{
  "4720100": {
    "name": "那覇市",
    "class30s": [{
      "code": "47101100",
      "standard": {"level4": 200, "level5": 300},   // 警報基準（cm）
      "stations": [{
        "code": "209131",
        "name": "那覇",
        "addr": "沖縄県 那覇市 通堂町",
        "type": "jma",
        "max": {"level": 178, "datetime": "201209160656", ...},
        "lat": 26.21333, "lon": 127.66528
      }]
    }]
  }
}
```

観測点コード（`stations[].code`）が `tide_obs_*.json` のファイル名に使われる。

---

## アプリの描画ロジック

### 全体フロー

```
1. tide_time.json → 現在時刻取得（JST）
2. 各観測所の tide_obs_{YYYYMMDD}_{code}.json を並行fetch
3. 各観測所の tide_astro_{YYYY}_{code}.json を並行fetch
4. 15秒データを15分間隔にダウンサンプリング（step=60）
5. 天文潮位を1時間→15分に線形補間（96点）
6. Chart.js でグラフ描画
```

### ダウンサンプリング処理（app.js）

```javascript
const intervalSec  = obs.interval;        // 15（秒）
const DISPLAY_MIN  = 15;                  // 表示単位（分）
const step         = DISPLAY_MIN * 60 / intervalSec;  // 60
const displayPoints = 96;                 // 24時間×4点/時

const tideArray = [];
for (let i = 0; i < displayPoints; i++) {
  const rawIdx = i * step;               // 0, 60, 120, ..., 5700
  // 観測済み分は実値、未観測はnull（グラフで空白になる）
  const v = rawIdx < obs.tide.length ? obs.tide[rawIdx] : null;
  tideArray.push(v);
}
```

### 現在インデックスの計算

```javascript
// 表示用15分単位でのインデックス（0〜95）
function getCurrentIndex(baseTime) {
  const jst = new Date(baseTime.getTime() + 9 * 3600 * 1000);
  const min = jst.getUTCHours() * 60 + jst.getUTCMinutes();
  return Math.min(Math.floor(min / 15), 95);
}
```

### 天文潮位の補間

```javascript
// astroHourly: 24点（1時間間隔）→ count点（15分間隔）に線形補間
function interpolateAstro(astroHourly, count, intervalMin) {
  const stepsPerHour = 60 / intervalMin;  // 4（15分間隔なら）
  for (let i = 0; i < count; i++) {
    const hourPos = i / stepsPerHour;     // 時間位置（小数）
    const h0 = Math.floor(hourPos);
    const h1 = Math.min(h0 + 1, 23);
    const frac = hourPos - h0;
    result.push(Math.round(astroHourly[h0] + (astroHourly[h1] - astroHourly[h0]) * frac));
  }
}
```

### グラフ構成

| データセット | ソース | 色 |
|------------|--------|-----|
| 観測潮位 | `tide_obs.tide`（15分ダウンサンプリング） | 青（#2196F3） |
| 天文潮位 | `tide_astro[MMDD]`（15分補間） | 橙（#FF9800、破線） |
| 現在時刻 | 縦線（afterDraw プラグイン） | 赤（#F44336、破線） |

観測済み分のみ青線が表示され、未観測の時間帯は空白になる。

---

## 開発時に判明したAPIの落とし穴

### 1. interval は「秒」単位（最重要）

`interval: 15` を「15分」と誤解すると全てのインデックス計算がずれる。
15秒間隔で1日5760点。誤って96点スライスすると最初の24分しか表示されず潮位がフラットに見える。

### 2. tide_obs.tide が変動しない場合

初期化直後や日替わり直後はデータ点数が少なく、0:00頃は数点しかない。
0:00〜数分間のデータが繰り返されているように見えることがある。正常動作。

### 3. 天文潮位との対応

`tide_obs.departure` = surge（気象偏差）= `tide_obs.tide` − 天文潮位
平穏時は ±10cm 以内。台風時は surge が大きくなる。

---

## 観測所の追加・変更

`js/config.js` の `STATIONS` 配列を編集する。

```javascript
const STATIONS = [
  {
    code:      '209131',       // 観測点コード（tide_area.json の stations[].code）
    name:      '那覇',
    addr:      '那覇市 通堂町',
    area_code: '4720100',      // tide_area.json のキー
    class30:   '47101100',
    jma_url:   'https://www.jma.go.jp/bosai/tidelevel/#area_type=class20s&area_code=4720100&point_code=209131&filter=0&class30s=47101100',
  },
  // ...
];
```

観測点コードは `const/tide_area.json` から確認可能：

```bash
python3 -c "
import urllib.request, json
url = 'https://www.jma.go.jp/bosai/tidelevel/const/tide_area.json'
with urllib.request.urlopen(url) as r:
    data = json.load(r)
# 沖縄（209で始まるコード）を抽出
for area, info in data.items():
    for c30 in info.get('class30s', []):
        for st in c30.get('stations', []):
            if st['code'].startswith('209'):
                print(area, st['code'], st['name'], st.get('addr',''))
"
```

---

## 注意事項

- 気象庁APIは非公式利用。利用規約に従い過剰なリクエストは控えること
- APIのURL・データ構造は予告なく変更される場合がある
- CORS制限なし。ブラウザから直接アクセス可能（プロキシ不要）
- 気象庁のページ（https://www.jma.go.jp/bosai/tidelevel/）はSPAで、  
  ソースは全てインライン化されている（`js/` 配下に独立ファイルは存在しない）
