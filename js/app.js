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

// 現在のrawインデックスを計算（15秒単位）
function getCurrentRawIndex(baseTime) {
  const jst = new Date(baseTime.getTime() + 9 * 60 * 60 * 1000);
  const sec = jst.getUTCHours() * 3600 + jst.getUTCMinutes() * 60 + jst.getUTCSeconds();
  return Math.floor(sec / 15);
}

// YYYYMMDD 文字列から JST 0:00 の Date オブジェクトを生成
function getJSTMidnight(dateStr) {
  const y = parseInt(dateStr.slice(0, 4));
  const mo = parseInt(dateStr.slice(4, 6)) - 1;
  const d = parseInt(dateStr.slice(6, 8));
  return new Date(Date.UTC(y, mo, d) - 9 * 60 * 60 * 1000);
}

// 時刻ラベルを生成（startMinからintervalMin間隔でcount点）
// baseDate: rawデータ起点の JST 0:00（日付境界の表示に使用）
function buildTimeLabels(intervalMin, count, startMin = 0, baseDate = null) {
  let labelInterval;
  if (intervalMin >= 10) labelInterval = 120;
  else if (intervalMin >= 5) labelInterval = 60;
  else if (intervalMin >= 2) labelInterval = 30;
  else if (intervalMin >= 1) labelInterval = 15;
  else labelInterval = 10;

  const labels = [];
  for (let i = 0; i < count; i++) {
    const totalMin = startMin + i * intervalMin;
    const prevTotalMin = startMin + (i - 1) * intervalMin;

    // 日付境界：前の点と日が変わる場合は M/D を表示
    const isDayBoundary = baseDate && i > 0 &&
      Math.floor(totalMin / 1440) > Math.floor(prevTotalMin / 1440);

    if (isDayBoundary) {
      const dayOffset = Math.floor(totalMin / 1440);
      const dt = new Date(baseDate.getTime() + (9 + dayOffset * 24) * 60 * 60 * 1000);
      labels.push(`${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`);
    } else if (totalMin % labelInterval === 0) {
      const h = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
      const m = String(Math.round(totalMin % 60)).padStart(2, '0');
      labels.push(`${h}:${m}`);
    } else {
      labels.push('');
    }
  }
  return labels;
}

// 天文潮位を任意間隔に補間（線形補間、startMinから開始）
function interpolateAstro(astroHourly, count, intervalMin, startMin = 0) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const totalMin = startMin + i * intervalMin;
    const hourPos = totalMin / 60;
    const h0 = Math.floor(hourPos);
    const h1 = Math.min(h0 + 1, astroHourly.length - 1);
    const frac = hourPos - h0;
    const v0 = astroHourly[h0] ?? astroHourly[astroHourly.length - 1];
    const v1 = astroHourly[h1] ?? astroHourly[astroHourly.length - 1];
    result.push(Math.round(v0 + (v1 - v0) * frac));
  }
  return result;
}

// 現在時刻の縦線プラグインを登録・描画
function registerCurrentLinePlugin(chart, canvasId, currentIdx, count) {
  if (currentIdx < 0 || currentIdx >= count) return;
  const plugin = {
    id: 'currentLine_' + canvasId,
    afterDraw(c) {
      const ctx = c.ctx;
      const xScale = c.scales.x;
      const yScale = c.scales.y;
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

// 共通のChart破棄処理
function destroyChart(canvasId) {
  if (window._charts?.[canvasId]) {
    window._charts[canvasId].destroy();
    delete window._charts[canvasId];
  }
}

// 潮位グラフを描画
function drawChart(canvasId, tideData, astroData, currentIdx, intervalMin, startMin = 0, baseDate = null) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  destroyChart(canvasId);
  if (!window._charts) window._charts = {};

  const count = tideData.length;
  const labels = buildTimeLabels(intervalMin, count, startMin, baseDate);
  const tideWithNull = tideData.map(v => (v === null || v === 32767) ? null : v);

  window._charts[canvasId] = new Chart(el.getContext('2d'), {
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
        legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, boxWidth: 20 } },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: (items) => {
              const totalMin = startMin + items[0].dataIndex * intervalMin;
              const h = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
              const m = String(Math.round(totalMin % 60)).padStart(2, '0');
              return `${h}:${m}`;
            },
            label: (item) => item.parsed.y === null ? null : `${item.dataset.label}: ${item.parsed.y} cm`,
          },
        },
      },
      scales: {
        x: { ticks: { font: { size: 10 }, maxRotation: 0 }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y: {
          ticks: { font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.07)' },
          title: { display: true, text: 'cm (TP)', font: { size: 11 } },
        },
      },
    },
  });

  registerCurrentLinePlugin(window._charts[canvasId], canvasId, currentIdx, count);
}

// 潮位偏差グラフを描画（観測 − 天文）
function drawDeviationChart(canvasId, deviationData, currentIdx, intervalMin, startMin = 0, baseDate = null) {
  const el = document.getElementById(canvasId);
  if (!el || !deviationData) return;
  destroyChart(canvasId);
  if (!window._charts) window._charts = {};

  const count = deviationData.length;
  const labels = buildTimeLabels(intervalMin, count, startMin, baseDate);

  window._charts[canvasId] = new Chart(el.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '潮位偏差 (cm)',
        data: deviationData,
        backgroundColor: deviationData.map(v =>
          v === null ? 'transparent' : v >= 0 ? 'rgba(244,67,54,0.6)' : 'rgba(33,150,243,0.6)'
        ),
        borderWidth: 0,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, boxWidth: 16 } },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: (items) => {
              const totalMin = startMin + items[0].dataIndex * intervalMin;
              const h = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
              const m = String(Math.round(totalMin % 60)).padStart(2, '0');
              return `${h}:${m}`;
            },
            label: (item) => {
              if (item.parsed.y === null) return null;
              const sign = item.parsed.y >= 0 ? '+' : '';
              return `潮位偏差: ${sign}${item.parsed.y} cm`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { font: { size: 10 }, maxRotation: 0 }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y: {
          ticks: { font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.07)' },
          title: { display: true, text: 'cm', font: { size: 10 } },
        },
      },
    },
  });

  registerCurrentLinePlugin(window._charts[canvasId], canvasId, currentIdx, count);
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
    <div class="card-deviation">
      <div class="deviation-label">潮位偏差（観測 − 天文）</div>
      <canvas id="dev-chart-${station.code}" width="400" height="90"></canvas>
    </div>
    <div class="card-footer">
      <span class="data-time" id="time-${station.code}"></span>
    </div>
  `;
  return card;
}

// 観測所のデータを読み込んで表示
async function loadStation(station, dateStr, year, mmdd, currentRawIdx, prevDateStr, prevMmdd) {
  const [prevObsResult, obsResult, astroResult] = await Promise.allSettled([
    fetchJMA(obsPath(prevDateStr, station.code)),
    fetchJMA(obsPath(dateStr, station.code)),
    fetchJMA(astroPath(year, station.code)),
  ]);

  if (obsResult.status === 'rejected') {
    console.warn(`[${station.name}] 観測データ取得失敗:`, obsResult.reason);
    const el = document.getElementById(`current-${station.code}`);
    if (el) el.textContent = 'N/A';
    return;
  }

  const todayTide = obsResult.value.tide;

  // 前日データを結合（前日データがない場合は空配列）
  const yesterdayTide = prevObsResult.status === 'fulfilled' ? prevObsResult.value.tide : [];
  const combinedTide = [...yesterdayTide, ...todayTide];
  const todayOffset = yesterdayTide.length;
  const combinedCurrentRawIdx = todayOffset + currentRawIdx;

  // 天文潮位（前日 + 当日を結合）
  // 前日ありの場合: hourPos=0が前日0時、hourPos=24が当日0時
  // 前日なしの場合: hourPos=0が当日0時
  const astroValue = astroResult.status === 'fulfilled' ? astroResult.value : null;
  const astroToday = astroValue?.tide?.[mmdd] ?? null;
  const astroYesterday = astroValue?.tide?.[prevMmdd] ?? null;
  const combinedAstroHourly = astroToday
    ? (astroYesterday ? [...astroYesterday, ...astroToday] : astroToday)
    : null;

  // rawデータ起点のJST 0:00
  const rawBaseDate = yesterdayTide.length > 0
    ? getJSTMidnight(prevDateStr)
    : getJSTMidnight(dateStr);

  // rawデータを保存（ズーム再描画用）
  if (!window._stationRaw) window._stationRaw = {};
  window._stationRaw[station.code] = {
    tide: combinedTide,
    astroHourly: combinedAstroHourly,
    todayOffset,
    currentRawIdx: combinedCurrentRawIdx,
    baseDate: rawBaseDate,
  };

  // 現在潮位の表示（当日rawデータから直接取得）
  const curVal = currentRawIdx < todayTide.length ? todayTide[currentRawIdx] : null;
  const currentEl = document.getElementById(`current-${station.code}`);
  if (currentEl) {
    currentEl.textContent = (curVal === null || curVal === 32767) ? '--' : curVal;
  }

  // 時刻表示
  const timeEl = document.getElementById(`time-${station.code}`);
  if (timeEl) {
    const totalMin = currentRawIdx * 15 / 60;
    const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const m = String(Math.round(totalMin % 60)).padStart(2, '0');
    timeEl.textContent = `${h}:${m} 時点`;
  }

  // 初期グラフ描画
  redrawStation(station.code, window._currentMode || '24h');
}

// 指定モードでグラフを再描画（ズーム切り替え用）
function redrawStation(code, mode) {
  const raw = window._stationRaw?.[code];
  if (!raw) return;

  const RAW_SEC = 15;
  const modeConf = ZOOM_MODES.find(m => m.id === mode);
  const step = Math.round(modeConf.stepSec / RAW_SEC);
  const intervalMin = modeConf.stepSec / 60;
  const count = Math.round(modeConf.hours * 60 / intervalMin);

  const rawEnd = raw.currentRawIdx;
  let rawStart, currentDisplayIdx;

  if (modeConf.centered) {
    // 現在を中心に前後に表示（±12h など）
    const halfPoints = Math.floor(count / 2);
    rawStart = Math.max(0, rawEnd - halfPoints * step);
    currentDisplayIdx = Math.round((rawEnd - rawStart) / step);
  } else {
    // 現在を右端として過去方向に表示
    rawStart = Math.max(0, rawEnd - (count - 1) * step);
    currentDisplayIdx = count - 1;
  }

  // rawデータから表示範囲を切り出し
  const tideArray = [];
  for (let i = 0; i < count; i++) {
    const rawIdx = rawStart + i * step;
    const v = rawIdx < raw.tide.length ? raw.tide[rawIdx] : null;
    tideArray.push((v === null || v === 32767) ? null : v);
  }

  const startMin = rawStart * RAW_SEC / 60;

  let astroArray = null;
  if (raw.astroHourly) {
    astroArray = interpolateAstro(raw.astroHourly, count, intervalMin, startMin);
  }

  // 偏差 = 観測 - 天文
  const deviationArray = (astroArray && tideArray)
    ? tideArray.map((v, i) => (v !== null && astroArray[i] !== null) ? v - astroArray[i] : null)
    : null;

  drawChart(`chart-${code}`, tideArray, astroArray, currentDisplayIdx, intervalMin, startMin, raw.baseDate);
  drawDeviationChart(`dev-chart-${code}`, deviationArray, currentDisplayIdx, intervalMin, startMin, raw.baseDate);
}

// ページ全体の初期化
async function init() {
  const statusEl = document.getElementById('status-message');
  const grid = document.getElementById('station-grid');

  try {
    const basetimeData = await fetchJMA('data/tide/tide_time.json');
    const baseTime = parseJMATime(basetimeData.time);

    const dateStr = formatDateJST(baseTime);
    const year = getYearJST(baseTime);
    const mmdd = getMMDD(baseTime);

    // 前日の日付
    const prevDate = new Date(baseTime.getTime() - 24 * 60 * 60 * 1000);
    const prevDateStr = formatDateJST(prevDate);
    const prevMmdd = getMMDD(prevDate);

    // 現在のrawインデックス（15秒単位）
    const currentRawIdx = getCurrentRawIndex(baseTime);

    // basetimeを表示
    const basetimeEl = document.getElementById('basetime');
    if (basetimeEl) {
      const jst = new Date(baseTime.getTime() + 9 * 60 * 60 * 1000);
      const hh = String(jst.getUTCHours()).padStart(2, '0');
      const mm = String(jst.getUTCMinutes()).padStart(2, '0');
      basetimeEl.textContent = `（${dateStr.slice(0,4)}/${dateStr.slice(4,6)}/${dateStr.slice(6)} ${hh}:${mm} JST 現在）`;
    }

    statusEl.style.display = 'none';
    STATIONS.forEach(station => {
      grid.appendChild(createStationCard(station));
    });

    await Promise.all(
      STATIONS.map(station =>
        loadStation(station, dateStr, year, mmdd, currentRawIdx, prevDateStr, prevMmdd)
      )
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
    window._stationRaw = {};
    init();
  }, REFRESH_INTERVAL);
}

// 起動
document.addEventListener('DOMContentLoaded', () => {
  // グローバルズームボタン（一度だけ設定）
  const globalZoom = document.getElementById('global-zoom');
  if (globalZoom) {
    globalZoom.addEventListener('click', (e) => {
      const btn = e.target.closest('.zoom-btn');
      if (!btn) return;
      const mode = btn.dataset.mode;
      globalZoom.querySelectorAll('.zoom-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window._currentMode = mode;
      STATIONS.forEach(s => redrawStation(s.code, mode));
    });
  }

  init();
  startAutoRefresh();
});
