// 気象庁 潮位観測API のベースURL
const JMA_BASE = 'https://www.jma.go.jp/bosai/tidelevel/';

// 沖縄県の観測所リスト
const STATIONS = [
  {
    code: '209131',
    name: '那覇',
    addr: '那覇市 通堂町',
    area_code: '4720100',
    class30: '47101100',
    jma_url: 'https://www.jma.go.jp/bosai/tidelevel/#area_type=class20s&area_code=4720100&point_code=209131&filter=0&class30s=47101100',
  },
  {
    code: '209105',
    name: '沖縄',
    addr: '南城市 知念',
    area_code: '4721500',
    class30: '47101100',
    jma_url: 'https://www.jma.go.jp/bosai/tidelevel/#area_type=class20s&area_code=4721500&point_code=209105&filter=0&class30s=47101100',
  },
  {
    code: '209181',
    name: '中城湾港',
    addr: '沖縄市 海邦',
    area_code: '4721100',
    class30: '47101200',
    jma_url: 'https://www.jma.go.jp/bosai/tidelevel/#area_type=class20s&area_code=4721100&point_code=209181&filter=0&class30s=47101200',
  },
  {
    code: '209381',
    name: '平良',
    addr: '宮古島市 平良西里',
    area_code: '4721400',
    class30: '47300100',
    jma_url: 'https://www.jma.go.jp/bosai/tidelevel/#area_type=class20s&area_code=4721400&point_code=209381&filter=0&class30s=47300100',
  },
  {
    code: '209431',
    name: '石垣',
    addr: '石垣市 八島町2丁目',
    area_code: '4720700',
    class30: '47401100',
    jma_url: 'https://www.jma.go.jp/bosai/tidelevel/#area_type=class20s&area_code=4720700&point_code=209431&filter=0&class30s=47401100',
  },
  {
    code: '209432',
    name: '与那国',
    addr: '八重山郡 与那国町 久部良',
    area_code: '4738200',
    class30: '47402000',
    jma_url: 'https://www.jma.go.jp/bosai/tidelevel/#area_type=class20s&area_code=4738200&point_code=209432&filter=0&class30s=47402000',
  },
  {
    code: '209231',
    name: '南大東',
    addr: '島尻郡 南大東村 北',
    area_code: '4735700',
    class30: '47200000',
    jma_url: 'https://www.jma.go.jp/bosai/tidelevel/#area_type=class20s&area_code=4735700&point_code=209231&filter=0&class30s=47200000',
  },
];

// グラフの色設定
const CHART_COLORS = {
  tide: '#2196F3',      // 観測潮位
  astro: '#FF9800',     // 天文潮位
  current: '#F44336',  // 現在位置
};

// データ更新間隔（ミリ秒）
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5分

// ズームモード定義（現在を右端として過去方向に表示、元データは15秒間隔）
const ZOOM_MODES = [
  { id: '24h', label: '24時間', hours: 24, stepSec: 300 }, // 5分×288点
  { id: '12h', label: '12時間', hours: 12, stepSec: 120 }, // 2分×360点
  { id: '6h',  label: '6時間',  hours: 6,  stepSec:  60 }, // 1分×360点
  { id: '1h',  label: '1時間',  hours: 1,  stepSec:  15 }, // 15秒×240点
];
