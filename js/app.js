// 日付を YYYYMMDD 形式に変換（JST基準）
function formatDateJST(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// 年を YYYY 形式で取得（JST基準）
function getYearJST(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return String(jst.getUTCFullYear());
}

// 気象庁APIからデータを取得
async function fetchJMA(path) {
  const url = JMA_BASE + path;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

// 観測データのパスを生成
function obsPath(dateStr, stationCode) {
  return `data/tide/tide_obs_${dateStr}_${stationCode}.json`;
}

// 天文潮位データのパスを生成
function astroPath(year, stationCode) {
  return `const/tide_astro/tide_astro_${year}_${stationCode}.json`;
}

// MMDD 形式で月日を取得（JST基準）
function getMMDD(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${m}${d}`;
}

// basetime の ISO文字列をDateオブジェクトに変換
function parseJMATime(timeStr) {
  return new Date(timeStr);
}

// 現在の表示インデックスを計算（15分単位、0〜95）
function getCurrentIndex(baseTime) {
  const jst = new Date(baseTime.getTime() + 9 * 60 * 60 * 1000);
  const minutesFromMidnight = jst.getUTCHours() * 60 + jst.getUTCMinutes();
  return Math.min(Math.floor(minutesFromMidnight / 15), 95);
}

// 時刻ラベルを生成（96点=15分×96=24時間）
function buildTimeLabels(intervalMin, count) {
  const labels = [];
  for (let i = 0; i < count; i++) {
    const totalMin = i * intervalMin;
    const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const m = String(totalMin % 60).padStart(2, '0');
    // 3時間ごとにラベル表示
    labels.push(totalMin % 180 === 0 ? `${h}:${m}` : '');
  }
  return labels;
}

// 天文潮位を1時間→15分間隔に補間（線形補間）
function interpolateAstro(astroHourly, count, intervalMin) {
  const stepsPerHour = 60 / intervalMin;
  const result = [];
  for (let i = 0; i < count; i++) {
    const hourPos = i / stepsPerHour;
    const h0 = Math.floor(hourPos);
    const h1 = Math.min(h0 + 1, astroHourly.length - 1);
    const frac = hourPos - h0;
    const v0 = astroHourly[h0] ?? astroHourly[astroHourly.length - 1];
    const v1 = astroHourly[h1] ?? astroHourly[astroHourly.length - 1];
    result.push(Math.round(v0 + (v1 - v0) * frac));
  }
  return result;
}

// グラフを描画
function drawChart(canvasId, tideData, astroData, currentIdx, intervalMin) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const count = tideData.length;
  const labels = buildTimeLabels(intervalMin, count);

  // 既存グラフを破棄
  if (window._charts && window._charts[canvasId]) {
    window._charts[canvasId].destroy();
  }
  if (!window._charts) window._charts = {};

  // null を含むtideDataを処理（欠測はnullのまま）
  const tideWithNull = tideData.map(v => (v === null || v === 32767) ? null : v);

  // 現在位置のタテ線用データセット
  const currentLineData = Array(count).fill(null);
  if (currentIdx >= 0 && currentIdx < count) {
    const min = Math.min(...tideWithNull.filter(v => v !== null));
    const max = Math.max(...tideWithNull.filter(v => v !== null));
    currentLineData[currentIdx] = max + 10;
  }

  window._charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '観測潮位 (cm)',
          data: tideWithNull,
          borderColor: CHART_COLORS.tide,
          backgroundColor: 'rgba(33,150,243,0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          spanGaps: false,
          tension: 0.3,
        },
        ...(astroData ? [{
          label: '天文潮位 (cm)',
          data: astroData,
          borderColor: CHART_COLORS.astro,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          borderDash: [4, 4],
          tension: 0.3,
        }] : []),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { font: { size: 11 }, boxWidth: 20 },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: (items) => {
              const i = items[0].dataIndex;
              const totalMin = i * intervalMin;
              const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
              const m = String(totalMin % 60).padStart(2, '0');
              return `${h}:${m}`;
            },
            label: (item) => {
              if (item.parsed.y === null) return null;
              return `${item.dataset.label}: ${item.parsed.y} cm`;
            },
          },
        },
        annotation: undefined,
      },
      scales: {
        x: {
          ticks: { font: { size: 10 }, maxRotation: 0 },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
        y: {
          ticks: { font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.07)' },
          title: { display: true, text: 'cm (TP)', font: { size: 11 } },
        },
      },
    },
  });

  // 現在時刻の縦線を手動描画（afterDraw プラグイン）
  if (currentIdx >= 0 && currentIdx < count) {
    const chart = window._charts[canvasId];
    const plugin = {
      id: 'currentLine_' + canvasId,
      afterDraw(chart) {
        const ctx = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        const x = xScale.getPixelForValue(currentIdx);
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = CHART_COLORS.current;
        ctx.lineWidth = 2;
        ctx.moveTo(x, yScale.top);
        ctx.lineTo(x, yScale.bottom);
        ctx.stroke();
        ctx.restore();
      },
    };
    Chart.register(plugin);
    chart.update();
  }
}

// 観測所カードのHTMLを生成
function createStationCard(station) {
  const card = document.createElement('div');
  card.className = 'station-card';
  card.id = `card-${station.code}`;
  card.innerHTML = `
    <div class="card-header">
      <h2 class="station-name">
        <a href="${station.jma_url}" target="_blank" rel="noopener">${station.name}</a>
      </h2>
      <span class="station-addr">${station.addr}</span>
    </div>
    <div class="card-current">
      <span class="current-label">現在潮位</span>
      <span class="current-value" id="current-${station.code}">--</span>
      <span class="current-unit">cm</span>
    </div>
    <div class="card-graph">
      <canvas id="chart-${station.code}" width="400" height="180"></canvas>
    </div>
    <div class="card-footer">
      <span class="data-time" id="time-${station.code}"></span>
    </div>
  `;
  return card;
}

// 観測所のデータを読み込んで表示
async function loadStation(station, dateStr, year, mmdd, currentIdx) {
  const [obsData, astroData] = await Promise.allSettled([
    fetchJMA(obsPath(dateStr, station.code)),
    fetchJMA(astroPath(year, station.code)),
  ]);

  if (obsData.status === 'rejected') {
    console.warn(`[${station.name}] 観測データ取得失敗:`, obsData.reason);
    const el = document.getElementById(`current-${station.code}`);
    if (el) el.textContent = 'N/A';
    return;
  }

  const obs = obsData.value;
  // interval はデータの記録間隔（秒単位）
  const intervalSec = obs.interval || 15;
  // グラフは15分単位（96点/日）に間引いて表示する
  const DISPLAY_MIN = 15;
  const step = Math.round(DISPLAY_MIN * 60 / intervalSec); // 15分/interval秒 = 60
  const displayPoints = 96; // 24時間 × 4点/時

  // 15分間隔へダウンサンプリング（観測済み分は実値、未観測分はnull）
  const tideArray = [];
  for (let i = 0; i < displayPoints; i++) {
    const rawIdx = i * step;
    const v = rawIdx < obs.tide.length ? obs.tide[rawIdx] : null;
    tideArray.push((v === null || v === 32767) ? null : v);
  }

  // 現在潮位（currentIdx は15分単位のインデックス）
  const currentVal = tideArray[currentIdx];
  const currentEl = document.getElementById(`current-${station.code}`);
  if (currentEl) {
    if (currentVal === null) {
      currentEl.textContent = '--';
    } else {
      currentEl.textContent = currentVal;
      currentEl.className = 'current-value';
    }
  }

  // 時刻表示
  const timeEl = document.getElementById(`time-${station.code}`);
  if (timeEl) {
    const totalMin = currentIdx * DISPLAY_MIN;
    const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const m = String(totalMin % 60).padStart(2, '0');
    timeEl.textContent = `${h}:${m} 時点`;
  }

  // 天文潮位の補間（1時間→15分単位、96点）
  let interpolatedAstro = null;
  if (astroData.status === 'fulfilled') {
    const astroHourly = astroData.value.tide?.[mmdd];
    if (astroHourly) {
      interpolatedAstro = interpolateAstro(astroHourly, displayPoints, DISPLAY_MIN);
    }
  }

  // グラフ描画
  drawChart(`chart-${station.code}`, tideArray, interpolatedAstro, currentIdx, DISPLAY_MIN);
}

// ページ全体の初期化
async function init() {
  const statusEl = document.getElementById('status-message');
  const grid = document.getElementById('station-grid');

  try {
    // basetime を取得
    const basetimeData = await fetchJMA('data/tide/tide_time.json');
    const baseTime = parseJMATime(basetimeData.time);

    const dateStr = formatDateJST(baseTime);
    const year = getYearJST(baseTime);
    const mmdd = getMMDD(baseTime);

    // basetimeを表示
    const basetimeEl = document.getElementById('basetime');
    if (basetimeEl) {
      const jst = new Date(baseTime.getTime() + 9 * 60 * 60 * 1000);
      const hh = String(jst.getUTCHours()).padStart(2, '0');
      const mm = String(jst.getUTCMinutes()).padStart(2, '0');
      basetimeEl.textContent = `（${dateStr.slice(0,4)}/${dateStr.slice(4,6)}/${dateStr.slice(6)} ${hh}:${mm} JST 現在）`;
    }

    // 現在のデータインデックス（表示用15分単位）
    const currentIdx = getCurrentIndex(baseTime);

    // カードを先に生成
    statusEl.style.display = 'none';
    STATIONS.forEach(station => {
      grid.appendChild(createStationCard(station));
    });

    // 各観測所のデータを並行して取得
    await Promise.all(
      STATIONS.map(station => loadStation(station, dateStr, year, mmdd, currentIdx))
    );

  } catch (err) {
    console.error('初期化エラー:', err);
    statusEl.textContent = 'データの読み込みに失敗しました。しばらく経ってから再読み込みしてください。';
    statusEl.className = 'status-error';
  }
}

// 自動更新
function startAutoRefresh() {
  setInterval(() => {
    document.getElementById('station-grid').innerHTML = '';
    document.getElementById('status-message').style.display = 'none';
    if (window._charts) {
      Object.values(window._charts).forEach(c => c.destroy());
      window._charts = {};
    }
    init();
  }, REFRESH_INTERVAL);
}

// 起動
document.addEventListener('DOMContentLoaded', () => {
  init();
  startAutoRefresh();
});
