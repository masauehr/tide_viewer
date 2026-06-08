# 沖縄県 潮位観測ビューア（tide_viewer）

気象庁 BOSAI API を使い、沖縄県7観測所の潮位をリアルタイム一覧表示するシングルページWebアプリ。

## 概要

| 項目 | 内容 |
|------|------|
| リポジトリ | https://github.com/masauehr/tide_viewer |
| 公開URL | https://masauehr.github.io/tide_viewer/ |
| フォルダ | `~/projects/tide_viewer/` |
| 技術 | Vanilla JS / HTML / CSS + Chart.js 4.x (CDN) |
| データ | 気象庁 BOSAI 潮位観測API（非公式・無認証） |
| 記録間隔 | **15秒**（表示はズームモードに応じてダウンサンプリング） |
| 自動更新 | 5分ごとにデータ再取得・グラフ再描画（ブラウザ内JSで実行） |

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

---

## 表示機能

### ズームモード（表示範囲の切り替え）

画面上部のズームバーから7モードを選択できる。左側は「過去から現在」、右側は「現在を中心に前後」表示。

| ボタン | 表示範囲 | ダウンサンプリング | グリッドラベル間隔 | 表示モード |
|--------|----------|------------------|-----------------|-----------|
| 36時間 | 過去36時間 | 10分刻み・216点 | 4時間おき | 現在＝右端 |
| 24時間 | 過去24時間 | 5分刻み・288点 | 4時間おき | 現在＝右端 |
| 12時間 | 過去12時間 | 2分刻み・360点 | 2時間おき | 現在＝右端 |
| 6時間 | 過去6時間 | 1分刻み・360点 | 1時間おき | 現在＝右端 |
| ±12時間 | 前後12時間 | 5分刻み・288点 | 4時間おき | 現在＝中央 |
| ±3時間 | 前後3時間 | 1分刻み・360点 | 1時間おき | 現在＝中央 |
| ±1時間 | 前後1時間 | 30秒刻み・240点 | 10分おき | 現在＝中央 |

データは**前日・当日・翌日の3日分**を結合して取得。翌日天文潮位も取得済みなので未来方向も天文潮位が表示される。

### 各観測所カードの表示内容

- **現在潮位**（cm、TP基準）
- **潮位グラフ**：観測潮位（青）＋天文潮位（橙破線）を重ねて表示
- **偏差グラフ**：観測値 − 天文潮位（緑、折れ線）

### 横軸の仕様

- ラベルには「時」単位を表示（例：`12`、`16`）。分が0以外は `HH:MM`（例：`12:30`）
- ±1時間モード以外はグラフ右下に小さく「時」と単位を明示
- 日付境界は縦線のみ濃い黒（ラベル非表示）
- ラベルのない目盛位置のグリッド線は非表示（間引き）

---

## 使用方法

### ローカル起動（開発・確認）

```bash
cd ~/projects/tide_viewer
python3 -m http.server 8080
# ブラウザで http://localhost:8080 を開く
```

### GitHub Pages での公開

リポジトリをpushした状態でGitHub → Settings → Pages → Source: main / root を有効にすれば動作。
気象庁APIへのfetchはブラウザ（クライアントサイド）から行うためサーバー不要。

---

## ファイル構成

```
tide_viewer/
├── index.html        # メインページ（ズームバー・観測所カード）
├── css/
│   └── style.css    # スタイルシート
├── js/
│   ├── config.js    # 観測所リスト・API設定・グラフ色・ズームモード定義
│   └── app.js       # データ取得・グラフ描画・自動更新
├── tide-viewer.md   # マニュアル（本ファイル）
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

### tide_obs_{YYYYMMDD}_{code}.json ― 観測データ

```json
{
  "time":         "2026-06-08T00:00:00+09:00",
  "station_code": "209131",
  "interval":     15,          // ⚠️ 秒単位（15秒間隔）
  "tide":         [...],       // 観測潮位の配列（cm, TP基準）
  "departure":    [...]        // 潮位偏差 surge = 観測値 − 天文潮位（cm）
}
```

#### ⚠️ interval の単位は「秒」（重要）

`interval: 15` は **15秒間隔** であり、分ではない。
1日の総データ点数 = 24時間 × 3600秒 / 15秒 = **最大5760点**。

ファイルには今日の0:00から「現在時刻まで観測済みの分だけ」データが格納されており、
リアルタイムに点数が増え続ける。

- `tide` の `.length` は**観測所によって異なる**（例：3600点・3620点など）
  - rawIdx 計算時は必ず `Math.min(rawIdx, tide.length - 1)` でクランプすること
- `tide_obs.tide` = 実際の観測潮位（cm）
- `tide_obs.departure` = 気象偏差（surge）、平穏時は ±数cm、台風時は数十cm

---

### tide_astro_{YYYY}_{code}.json ― 天文潮位

- キー: `MMDD` 形式（例: `"0608"` = 6月8日）
- 各日24点（0時〜23時の1時間間隔）
- 単位: cm（TP基準）
- アプリでは1時間→ズームモードの間隔に線形補間してグラフデータを生成
- 翌日分（翌日MMDD）も同ファイルから取得し、未来時間も途切れなく表示

---

## アプリの描画ロジック

### データ結合とダウンサンプリング

前日・当日・翌日の3日分の `tide_obs` を取得してrawデータを結合。
その後、各ズームモードの `stepSec` に基づいてダウンサンプリングする。

```javascript
// ズームモード定義（js/config.js）
const ZOOM_MODES = [
  { id: '36h',  hours: 36, stepSec: 600, centered: false },
  { id: '24h',  hours: 24, stepSec: 300, centered: false },
  { id: '12h',  hours: 12, stepSec: 120, centered: false },
  { id: '6h',   hours: 6,  stepSec:  60, centered: false },
  { id: '±12h', hours: 24, stepSec: 300, centered: true  },
  { id: '±3h',  hours: 6,  stepSec:  60, centered: true  },
  { id: '±1h',  hours: 2,  stepSec:  30, centered: true  },
];

// ダウンサンプリング例（24時間モード: stepSec=300）
const step = stepSec / 15;  // 15秒rawから何点おきに取るか
for (let i = 0; i < count; i++) {
  const rawIdx = startRawIdx + i * step;
  tideArray.push(combinedRaw[rawIdx] ?? null);
}
```

### 現在インデックスの計算

```javascript
// basetime（気象庁サーバーの観測基準時刻）から現在rawIndexを計算
const rawIdx = Math.round(elapsedSec / 15);
// ⚠️ tide.length（観測所ごとに異なる）を超えないようにクランプ
const actualRawIdx = Math.min(rawIdx, todayTide.length - 1);
```

### グラフ構成

| データセット | ソース | 色 | 備考 |
|------------|--------|-----|------|
| 観測潮位 | `tide_obs.tide`（ダウンサンプリング） | 青 #2196F3 | null = 未観測（グラフ空白） |
| 天文潮位 | `tide_astro[MMDD]`（線形補間） | 橙 #FF9800（破線） | 翌日分まで表示 |
| 潮位偏差 | 観測潮位 − 天文潮位 | 緑 #4CAF50 | 折れ線・塗りつぶし |

### 横軸ラベル生成（buildTimeLabels）

`totalHours` の値に応じてラベル間隔を自動決定：

| totalHours | ラベル間隔 | 対象モード |
|------------|----------|----------|
| ≤ 2時間 | 10分おき | ±1時間 |
| ≤ 6時間 | 1時間おき | 6時間・±3時間 |
| ≤ 12時間 | 2時間おき | 12時間 |
| > 12時間 | 4時間おき | 24時間・36時間・±12時間 |

- 分が0のときは時のみ表示（`12:00` → `12`）
- 日付境界は `'DATE'` マーカーでグリッド線のみ描画（ラベル非表示・濃い黒）
- ラベルなしのグリッド線は `transparent`（間引き）

---

## 開発時に判明したAPIの落とし穴

1. **`interval: 15` は秒単位（分ではない）**
   - 誤解すると全インデックス計算がずれ、グラフ前半24分しか表示されない
   - 1日最大5760点 → 各モードの `stepSec` でダウンサンプリングして表示

2. **ファイルは今日0:00〜現在まで成長するのみ**
   - 過去データは別日のファイルに格納
   - 未観測（将来）のスロットには値がなく、グラフは観測済み部分のみ描画

3. **`tide.length` は観測所ごとに異なる**
   - 一部観測所は3600点、別観測所は3620点など
   - `basetime` から計算したrawIdxが `.length` を超える場合があり `currentTide = --` になる
   - `Math.min(rawIdx, tide.length - 1)` で必ずクランプすること

4. **天文潮位は翌日分も取得が必要**
   - `±12時間` や `36時間` モードで未来時間を表示するとき翌日MMDDが必要
   - 同じ `tide_astro_{YYYY}_{code}.json` から翌日のキーを取得して結合する

5. **`departure` フィールドの存在**
   - `tide_obs.departure` は surge（気象偏差）= 観測値 − 天文潮位
   - ただし計算誤差が含まれるため、アプリでは独自に `tide - astro` を計算して偏差グラフを描画

---

## 観測所の追加・変更

`js/config.js` の `STATIONS` 配列を編集する。

```javascript
const STATIONS = [
  {
    code:      '209131',
    name:      '那覇',
    addr:      '那覇市 通堂町',
    area_code: '4720100',
    class30:   '47101100',
    jma_url:   'https://www.jma.go.jp/bosai/tidelevel/#...',
  },
];
```

観測点コードは `const/tide_area.json` から取得可能：

```bash
python3 -c "
import urllib.request, json
url = 'https://www.jma.go.jp/bosai/tidelevel/const/tide_area.json'
with urllib.request.urlopen(url) as r:
    data = json.load(r)
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
- 自動更新はブラウザのJS上で動作。PCがスリープ中・ブラウザ非表示中は更新されない
