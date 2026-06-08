// 全国観測所マップ { code: stationObj }
let allStationsMap = {};
// 都道府県グループ [{ pref, prefCode, stations[] }]
let prefGroups = [];

const LS_KEY = 'tideviewer_stations';

// 全国観測所を tide_area.json から読み込み
async function loadAllStations() {
  const data = await fetchJMA('const/tide_area.json');
  const byPref = {};
  const prefCodeMap = {};

  for (const [areaCode, areaInfo] of Object.entries(data)) {
    for (const c30 of areaInfo.class30s || []) {
      for (const st of c30.stations || []) {
        const addr = st.addr || '';
        const pref = addr.split(' ')[0] || '不明';
        const jma_url = `https://www.jma.go.jp/bosai/tidelevel/#area_type=class20s&area_code=${areaCode}&point_code=${st.code}&filter=0&class30s=${c30.code}`;
        const stObj = { code: st.code, name: st.name, addr, pref, area_code: areaCode, class30: c30.code, jma_url };
        allStationsMap[st.code] = stObj;
        if (!byPref[pref]) { byPref[pref] = []; prefCodeMap[pref] = areaCode.slice(0, 2); }
        byPref[pref].push(stObj);
      }
    }
  }

  prefGroups = Object.entries(byPref)
    .map(([pref, stations]) => ({ pref, prefCode: prefCodeMap[pref] || '99', stations }))
    .sort((a, b) => a.prefCode.localeCompare(b.prefCode));
}

// localStorage から選択コードを読み込み（未設定はデフォルト）
function loadSelectedCodes() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const codes = JSON.parse(saved);
      if (Array.isArray(codes) && codes.length > 0) return codes;
    }
  } catch (e) { /* 無視 */ }
  return [...DEFAULT_STATION_CODES];
}

// localStorage に保存
function saveSelectedCodes(codes) {
  localStorage.setItem(LS_KEY, JSON.stringify(codes));
}

// 現在選択中の観測所オブジェクトを取得
function getSelectedStations() {
  return loadSelectedCodes().map(c => allStationsMap[c]).filter(Boolean);
}

// --- モーダル ---

function openStationModal() {
  const modal = document.getElementById('station-modal');
  renderModalBody();
  modal.hidden = false;
  document.body.classList.add('modal-open');
}

function closeStationModal() {
  document.getElementById('station-modal').hidden = true;
  document.body.classList.remove('modal-open');
}

function renderModalBody() {
  const currentCodes = new Set(loadSelectedCodes());
  const body = document.getElementById('modal-body');

  body.innerHTML = prefGroups.map(({ pref, stations }) => {
    const selectedCount = stations.filter(s => currentCodes.has(s.code)).length;
    const isOpen = selectedCount > 0;
    return `
      <details class="pref-group" ${isOpen ? 'open' : ''}>
        <summary class="pref-summary">
          <span class="pref-name">${pref}</span>
          <span class="pref-count" data-pref="${pref}">${selectedCount}/${stations.length}</span>
        </summary>
        <div class="pref-stations">
          ${stations.map(st => `
            <label class="station-check">
              <input type="checkbox" name="station" value="${st.code}" ${currentCodes.has(st.code) ? 'checked' : ''}>
              <span class="check-name">${st.name}</span>
              <span class="check-addr">${st.addr}</span>
            </label>
          `).join('')}
        </div>
      </details>
    `;
  }).join('');

  // チェック変更でカウント更新
  body.addEventListener('change', updateModalCount);
  updateModalCount();
}

function updateModalCount() {
  const checks = document.querySelectorAll('#modal-body input[name="station"]:checked');
  document.getElementById('modal-count').textContent = `${checks.length}局選択中`;

  // 都道府県ごとのカウントを更新
  prefGroups.forEach(({ pref, stations }) => {
    const el = document.querySelector(`.pref-count[data-pref="${pref}"]`);
    if (!el) return;
    const checked = stations.filter(st => {
      const cb = document.querySelector(`input[name="station"][value="${st.code}"]`);
      return cb?.checked;
    }).length;
    el.textContent = `${checked}/${stations.length}`;
  });
}

function applyModalSelection() {
  const checks = document.querySelectorAll('#modal-body input[name="station"]:checked');
  const codes = Array.from(checks).map(c => c.value);
  if (codes.length === 0) { alert('1局以上選択してください'); return; }
  saveSelectedCodes(codes);
  closeStationModal();
  reloadDisplay();
}

function reloadDisplay() {
  const grid = document.getElementById('station-grid');
  grid.innerHTML = '';
  if (window._charts) { Object.values(window._charts).forEach(c => c.destroy()); window._charts = {}; }
  window._stationRaw = {};
  init();
}

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
function buildTimeLabels(intervalMin, count, startMin = 0, baseDate = null, totalHours = 24) {
  // 表示範囲に応じてラベル間隔を決定
  let labelInterval;
  if (totalHours <= 2)       labelInterval = 10;  // ±1時間: 10分おき
  else if (totalHours <= 6)  labelInterval = 60;  // 6時間・±3時間: 1時間おき
  else if (totalHours <= 12) labelInterval = 120; // 12時間: 2時間おき
  else                       labelInterval = 240; // 24時間以上: 4時間おき

  const firstLabelMin = Math.ceil(startMin / labelInterval) * labelInterval;
  const firstLabelI = Math.round((firstLabelMin - startMin) / intervalMin);
  const stepsPerLabel = Math.round(labelInterval / intervalMin);

  const labels = [];
  for (let i = 0; i < count; i++) {
    const totalMin = startMin + i * intervalMin;
    const prevTotalMin = startMin + (i - 1) * intervalMin;

    // 日付境界: ラベル非表示・グリッド線を濃い黒にするためのマーカー
    const isDayBoundary = baseDate && i > 0 &&
      Math.floor(totalMin / 1440) > Math.floor(prevTotalMin / 1440);

    if (isDayBoundary) {
      labels.push('DATE');
    } else if (i >= firstLabelI && (i - firstLabelI) % stepsPerLabel === 0) {
      const labelMin = firstLabelMin + Math.round((i - firstLabelI) / stepsPerLabel) * labelInterval;
      const h = String(Math.floor(labelMin / 60) % 24);
      const m = String(labelMin % 60).padStart(2, '0');
      // 分が00の場合は時のみ表示
      labels.push(m === '00' ? h : `${h}:${m}`);
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

// 共通のChart破棄処理
function destroyChart(canvasId) {
  if (window._charts?.[canvasId]) {
    window._charts[canvasId].destroy();
    delete window._charts[canvasId];
  }
}

// 潮位グラフを描画
function drawChart(canvasId, tideData, astroData, currentIdx, intervalMin, startMin = 0, baseDate = null, totalHours = 24) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  destroyChart(canvasId);
  if (!window._charts) window._charts = {};

  const count = tideData.length;
  const labels = buildTimeLabels(intervalMin, count, startMin, baseDate, totalHours);
  const tideWithNull = tideData.map(v => (v === null || v === 32767) ? null : v);

  // ±1時間以外のモードでは横軸右下に「時」単位を表示
  const xUnitPlugins = totalHours > 2 ? [{
    id: 'xAxisUnit',
    afterDraw: (chart) => {
      const ctx = chart.ctx;
      const xScale = chart.scales.x;
      ctx.save();
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#718096';
      ctx.textAlign = 'right';
      ctx.fillText('時', xScale.right, xScale.bottom);
      ctx.restore();
    },
  }] : [];

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
        x: {
          ticks: {
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: false,
            callback: (value, index) => {
              const label = labels[index];
              return label === 'DATE' ? '' : (label || '');
            },
          },
          grid: {
            color: (ctx) => {
              const label = labels[ctx.index];
              if (!label) return 'transparent';
              if (label === 'DATE') return 'rgba(0,0,0,0.5)';
              return 'rgba(0,0,0,0.1)';
            },
          },
        },
        y: {
          ticks: { font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.07)' },
          title: { display: true, text: 'cm (TP)', font: { size: 11 } },
        },
      },
    },
    plugins: xUnitPlugins,
  });

}

// 潮位偏差グラフを描画（観測 − 天文）
function drawDeviationChart(canvasId, deviationData, currentIdx, intervalMin, startMin = 0, baseDate = null, totalHours = 24) {
  const el = document.getElementById(canvasId);
  if (!el || !deviationData) return;
  destroyChart(canvasId);
  if (!window._charts) window._charts = {};

  const count = deviationData.length;
  const labels = buildTimeLabels(intervalMin, count, startMin, baseDate, totalHours);

  const xUnitPlugins = totalHours > 2 ? [{
    id: 'xAxisUnit',
    afterDraw: (chart) => {
      const ctx = chart.ctx;
      const xScale = chart.scales.x;
      ctx.save();
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#718096';
      ctx.textAlign = 'right';
      ctx.fillText('時', xScale.right, xScale.bottom);
      ctx.restore();
    },
  }] : [];

  window._charts[canvasId] = new Chart(el.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '潮位偏差 (cm)',
          data: deviationData,
          borderColor: CHART_COLORS.deviation,
          backgroundColor: 'rgba(76,175,80,0.1)',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          spanGaps: false,
          tension: 0.3,
        },
      ],
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
        x: {
          ticks: {
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: false,
            callback: (value, index) => {
              const label = labels[index];
              return label === 'DATE' ? '' : (label || '');
            },
          },
          grid: {
            color: (ctx) => {
              const label = labels[ctx.index];
              if (!label) return 'transparent';
              if (label === 'DATE') return 'rgba(0,0,0,0.5)';
              return 'rgba(0,0,0,0.1)';
            },
          },
        },
        y: {
          ticks: { font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.07)' },
          title: { display: true, text: 'cm', font: { size: 10 } },
        },
      },
    },
    plugins: xUnitPlugins,
  });

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
async function loadStation(station, dateStr, year, mmdd, currentRawIdx, prevDateStr, prevMmdd, tomorrowMmdd) {
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
  const combinedCurrentRawIdx = todayOffset + Math.min(currentRawIdx, todayTide.length - 1);

  // 天文潮位（前日 + 当日 + 翌日を結合）
  // 同一年ファイルに全日分が含まれるため追加取得不要
  const astroValue = astroResult.status === 'fulfilled' ? astroResult.value : null;
  const astroToday    = astroValue?.tide?.[mmdd]         ?? null;
  const astroYesterday = astroValue?.tide?.[prevMmdd]    ?? null;
  const astroTomorrow  = astroValue?.tide?.[tomorrowMmdd] ?? null;
  let combinedAstroHourly = null;
  if (astroToday) {
    const parts = [];
    if (astroYesterday) parts.push(...astroYesterday);
    parts.push(...astroToday);
    if (astroTomorrow) parts.push(...astroTomorrow);
    combinedAstroHourly = parts;
  }

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

  // 現在潮位の表示（データがない場合は最新データのインデックスを使用）
  const actualRawIdx = Math.min(currentRawIdx, todayTide.length - 1);
  const curVal = actualRawIdx >= 0 ? todayTide[actualRawIdx] : null;
  const currentEl = document.getElementById(`current-${station.code}`);
  if (currentEl) {
    currentEl.textContent = (curVal === null || curVal === 32767) ? '--' : curVal;
  }

  // 時刻表示（実際のデータ時刻を表示）
  const timeEl = document.getElementById(`time-${station.code}`);
  if (timeEl) {
    const totalMin = actualRawIdx * 15 / 60;
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

  drawChart(`chart-${code}`, tideArray, astroArray, currentDisplayIdx, intervalMin, startMin, raw.baseDate, modeConf.hours);
  drawDeviationChart(`dev-chart-${code}`, deviationArray, currentDisplayIdx, intervalMin, startMin, raw.baseDate, modeConf.hours);
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

    // 前日・翌日の日付
    const prevDate = new Date(baseTime.getTime() - 24 * 60 * 60 * 1000);
    const prevDateStr = formatDateJST(prevDate);
    const prevMmdd = getMMDD(prevDate);
    const tomorrowDate = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowMmdd = getMMDD(tomorrowDate);

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

    const stations = getSelectedStations();
    statusEl.style.display = 'none';
    stations.forEach(station => {
      grid.appendChild(createStationCard(station));
    });

    await Promise.all(
      stations.map(station =>
        loadStation(station, dateStr, year, mmdd, currentRawIdx, prevDateStr, prevMmdd, tomorrowMmdd)
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
document.addEventListener('DOMContentLoaded', async () => {
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
      getSelectedStations().forEach(s => redrawStation(s.code, mode));
    });
  }

  // 観測所選択ボタン
  document.getElementById('select-stations-btn')?.addEventListener('click', openStationModal);

  // モーダルのボタン
  document.getElementById('modal-close-btn')?.addEventListener('click', closeStationModal);
  document.getElementById('modal-apply-btn')?.addEventListener('click', applyModalSelection);
  document.getElementById('modal-reset-btn')?.addEventListener('click', () => {
    document.querySelectorAll('#modal-body input[name="station"]').forEach(cb => {
      cb.checked = DEFAULT_STATION_CODES.includes(cb.value);
    });
    updateModalCount();
  });

  // オーバーレイクリックで閉じる
  document.getElementById('station-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeStationModal();
  });

  // 全国観測所リストを先に読み込んでから表示開始
  await loadAllStations();
  init();
  startAutoRefresh();
});
