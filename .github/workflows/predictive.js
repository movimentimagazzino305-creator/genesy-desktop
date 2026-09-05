
// --- PREDICTIVE ANALYSIS & SALES CYCLE LOGIC (v2) ---

window.predictiveState = { avgCycleDays: 0, lateThreshold: 15 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _quoteValue(q) {
    if (!q.items || q.items.length === 0) return parseFloat(q.total) || 0;
    return q.items.reduce((s, i) => {
        if (i.includeInStats === false) return s;
        return s + (i.total || 0);
    }, 0);
}

/** Linear regression y = a + b*x — returns {a, b} */
function _linReg(points) {
    const n = points.length;
    if (n < 2) return { a: points[0] ? points[0].y : 0, b: 0 };
    const sumX  = points.reduce((s, p) => s + p.x, 0);
    const sumY  = points.reduce((s, p) => s + p.y, 0);
    const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
    const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const a = (sumY - b * sumX) / n;
    return { a, b };
}

/** Format a month key "YYYY-MM" -> "Gen 2026" */
function _fmtMonth(key) {
    const [y, m] = key.split('-');
    const names = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
    return `${names[parseInt(m) - 1]} ${y}`;
}

// ─── Main Render ──────────────────────────────────────────────────────────────

window.renderPredictiveAnalysis = function () {
    const allQuotes = db.getAllQuotes().filter(q => !q.excludeFromStats);

    // ── 1. Sales Cycle ──────────────────────────────────────────────────────
    // ONLY use quotes with a real acceptedAt (confirmed close date).
    // Using q.date as fallback gives cycle = 0 days and skews the average downward.
    const wonQuotes = allQuotes.filter(q =>
        ['Ordine Confermato', 'Chiuso'].includes(q.status) && q.acceptedAt
    );

    let totalDays = 0, validCount = 0;
    wonQuotes.forEach(q => {
        const start = new Date(q.createdAt || q.date);
        const end   = new Date(q.acceptedAt);
        const days  = Math.ceil((end - start) / 86400000);
        if (days >= 0) { totalDays += days; validCount++; }
    });

    // Default to 30 days if not enough real data (avoids threshold = 15 gg only)
    const avgDays = validCount >= 3 ? Math.round(totalDays / validCount) : 30;
    window.predictiveState.avgCycleDays = avgDays;
    const threshold = avgDays + window.predictiveState.lateThreshold;


    // ── 2. Pipeline KPIs ────────────────────────────────────────────────────
    const openQuotes = allQuotes.filter(q => ['Aperto','In Attesa','Bozza','Inviato'].includes(q.status));
    const pipelineValue = openQuotes.reduce((s, q) => s + _quoteValue(q), 0);
    const soldValue = wonQuotes.reduce((s, q) => s + _quoteValue(q), 0);
    const lostQuotes = allQuotes.filter(q => ['Perso','Rifiutato'].includes(q.status));
    const lostValue = lostQuotes.reduce((s, q) => s + _quoteValue(q), 0);
    const globalConv = allQuotes.length > 0 ? (wonQuotes.length / allQuotes.length * 100).toFixed(1) : 0;

    // ── 3. Anomaly Detection (Z-score on agent conv rate) ───────────────────
    const agentMap = {};
    allQuotes.forEach(q => {
        if (!q.agent) return;
        if (!agentMap[q.agent]) agentMap[q.agent] = { total: 0, won: 0, value: 0 };
        agentMap[q.agent].total++;
        if (['Ordine Confermato','Chiuso'].includes(q.status)) {
            agentMap[q.agent].won++;
            agentMap[q.agent].value += _quoteValue(q);
        }
    });

    const agentStats = Object.entries(agentMap).map(([agent, d]) => ({
        agent, total: d.total, won: d.won, value: d.value,
        rate: d.total > 0 ? d.won / d.total : 0
    }));

    const active = agentStats.filter(a => a.total >= 3);
    const anomalies = [];
    if (active.length > 2) {
        const mean = active.reduce((s, a) => s + a.rate, 0) / active.length;
        const std  = Math.sqrt(active.reduce((s, a) => s + Math.pow(a.rate - mean, 2), 0) / active.length);
        active.forEach(a => {
            const z = std > 0 ? (a.rate - mean) / std : 0;
            if (z < -1.5) anomalies.push({ ...a, diff: ((a.rate - mean) * 100).toFixed(1) });
        });
    }

    // ── 4. Monthly Historical + Regression Forecast ────────────────────────
    const monthMap = {};
    allQuotes.forEach(q => {
        const key = (q.date || q.createdAt || '').substring(0, 7); // YYYY-MM
        if (!key) return;
        if (!monthMap[key]) monthMap[key] = { quoted: 0, sold: 0, count: 0, soldCount: 0 };
        monthMap[key].quoted += _quoteValue(q);
        monthMap[key].count++;
        if (['Ordine Confermato','Chiuso'].includes(q.status)) {
            monthMap[key].sold += _quoteValue(q);
            monthMap[key].soldCount++;
        }
    });

    const sortedKeys = Object.keys(monthMap).sort();
    // Take last 12 months for regression
    const histKeys = sortedKeys.slice(-12);

    const points = histKeys.map((k, i) => ({ x: i, y: monthMap[k].sold }));
    const { a, b } = _linReg(points);

    // Build 4 future months
    const lastKeyDate = histKeys.length > 0 ? new Date(histKeys[histKeys.length - 1] + '-01') : new Date();
    const futureKeys = [];
    for (let i = 1; i <= 4; i++) {
        const d = new Date(lastKeyDate);
        d.setMonth(d.getMonth() + i);
        futureKeys.push(d.toISOString().substring(0, 7));
    }

    const allChartKeys = [...histKeys, ...futureKeys];
    const histLen = histKeys.length;

    const historicalData = histKeys.map(k => monthMap[k].sold);
    const forecastData = allChartKeys.map((k, i) => {
        if (i < histLen - 1) return null; // only overlap at last hist point
        const projIdx = i - (histLen - 1) + (histLen - 1);
        return Math.max(0, Math.round(a + b * (histLen - 1 + (i - (histLen - 1)))));
    });

    // Ensure last historical point connects to forecast
    const histChart = [...historicalData, null, null, null, null];
    const fcastChart = allChartKeys.map((k, i) => {
        const xi = i; // x index for regression
        if (i < histLen - 1) return null;
        return Math.max(0, Math.round(a + b * xi));
    });

    // ── 5. Render UI ────────────────────────────────────────────────────────
    _renderKPIs(avgDays, validCount, threshold, pipelineValue, soldValue, lostValue, globalConv, openQuotes.length);
    _renderAgentCards(agentStats);
    _renderAnomalies(anomalies);
    _renderRiskList(allQuotes, avgDays, threshold);
    _renderForecastChart(
        allChartKeys.map(k => _fmtMonth(k)),
        historicalData,
        fcastChart,
        histLen
    );
};

// ─── Sub-Renderers ────────────────────────────────────────────────────────────

function _renderKPIs(avgDays, validCount, threshold, pipeline, sold, lost, conv, openCount) {
    const el = document.getElementById('predKpiCycle');
    if (!el) return;

    const fmt = v => (typeof formatCurrency === 'function' ? formatCurrency(v) : v.toLocaleString('it-IT', { minimumFractionDigits: 2 }));

    el.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:14px; text-align:center; width:100%;">
            <div class="kpi-card card" style="border-left:4px solid #0ea5e9;">
                <h3>Ciclo Medio Vendita</h3>
                <div style="font-size:2rem; font-weight:700; color:#0ea5e9;">${avgDays} <span style="font-size:0.9rem; color:#64748b;">gg</span></div>
                <div class="text-muted" style="font-size:0.78rem;">
                    ${validCount >= 3
                        ? `su ${validCount} preventivi con data conferma reale`
                        : `<span style="color:#d97706;">⚠ Dati insufficienti (&lt;3) — valore di default 30gg</span>`}
                </div>
                <div style="margin-top:6px; font-size:0.75rem; color:#94a3b8;">Soglia ritardo: ${threshold} gg (ciclo + 15)</div>
            </div>
            <div class="kpi-card card" style="border-left:4px solid #14532d;">
                <h3>Pipeline Aperta</h3>
                <div style="font-size:1.6rem; font-weight:700; color:#14532d;">${fmt(pipeline)} €</div>
                <div class="text-muted" style="font-size:0.78rem;">${openCount} preventivi attivi</div>
            </div>
            <div class="kpi-card card" style="border-left:4px solid #7c3aed;">
                <h3>Conversion Rate</h3>
                <div style="font-size:2rem; font-weight:700; color:#7c3aed;">${conv}%</div>
                <div class="text-muted" style="font-size:0.78rem;">venduto / totale preventivato</div>
            </div>
            <div class="kpi-card card" style="border-left:4px solid #14532d;">
                <h3>Fatturato Totale (Storico)</h3>
                <div style="font-size:1.5rem; font-weight:700; color:#14532d;">${fmt(sold)} €</div>
            </div>
            <div class="kpi-card card" style="border-left:4px solid #7f1d1d;">
                <h3>Valore Perso (Storico)</h3>
                <div style="font-size:1.5rem; font-weight:700; color:#b91c1c;">${fmt(lost)} €</div>
            </div>
            <div class="kpi-card card" style="border-left:4px solid #d97706;">
                <h3>Prob. Chiusura Pipeline</h3>
                <div style="font-size:1.5rem; font-weight:700; color:#d97706;">${fmt(pipeline * (parseFloat(conv) / 100))} €</div>
                <div class="text-muted" style="font-size:0.78rem;">pipeline × conv. rate</div>
            </div>
        </div>`;
}

function _renderAgentCards(agentStats) {
    const el = document.getElementById('predAgentCards');
    if (!el) return;

    const fmt = v => (typeof formatCurrency === 'function' ? formatCurrency(v) : v.toLocaleString('it-IT'));
    const sorted = [...agentStats].sort((a, b) => b.value - a.value);

    el.innerHTML = sorted.map(a => {
        const pct = (a.rate * 100).toFixed(1);
        const barColor = a.rate >= 0.5 ? '#14532d' : a.rate >= 0.3 ? '#d97706' : '#b91c1c';
        return `
        <div class="card" style="padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <strong style="font-size:0.9rem;">${a.agent}</strong>
                <span style="font-size:0.8rem; color:${barColor}; font-weight:700;">${pct}%</span>
            </div>
            <div style="background:#e2e8f0; border-radius:4px; height:6px; margin-bottom:6px;">
                <div style="width:${Math.min(100, a.rate * 100)}%; height:6px; background:${barColor}; border-radius:4px;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#64748b;">
                <span>${a.won}/${a.total} prev.</span>
                <span>${fmt(a.value)} €</span>
            </div>
        </div>`;
    }).join('');
}

function _renderAnomalies(anomalies) {
    const container = document.getElementById('predAnomaliesContainer');
    const list = document.getElementById('predAnomaliesList');
    if (!list || !container) return;

    if (anomalies.length > 0) {
        container.classList.remove('hidden');
        list.innerHTML = anomalies.map(a => `
            <div style="padding:8px 12px; background:white; border-left:4px solid #dc2626; margin-bottom:6px; border-radius:4px;">
                <strong>${a.agent}</strong> converte al <strong>${(a.rate * 100).toFixed(1)}%</strong>
                <span style="color:#dc2626;"> (${a.diff}% sotto la media)</span>
                &nbsp;—&nbsp; ${a.won}/${a.total} preventivi chiusi.
            </div>`).join('');
    } else {
        container.classList.add('hidden');
    }
}

function _renderRiskList(quotes, avgDays, threshold) {
    const listBody = document.getElementById('predRiskListBody');
    if (!listBody) return;

    // threshold is pre-computed and passed in for consistency
    const now = new Date();

    const lateQuotes = quotes
        .filter(q => ['Aperto','In Attesa','Bozza'].includes(q.status))
        .map(q => {
            const age = Math.ceil((now - new Date(q.createdAt || q.date)) / 86400000);
            return { ...q, _age: age };
        })
        .filter(q => q._age > threshold)
        .sort((a, b) => b._age - a._age);

    const badge = document.getElementById('countRiskQuotes');
    if (badge) badge.textContent = lateQuotes.length;

    if (lateQuotes.length === 0) {
        listBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Nessun preventivo fuori tempo massimo 🚀</td></tr>';
        return;
    }

    const fmt = v => (typeof formatCurrency === 'function' ? formatCurrency(v) : v);
    listBody.innerHTML = lateQuotes.map(q => {
        const client = q.customer ? (q.customer.name || q.customer.ragioneSociale || '—') : '—';
        const val = _quoteValue(q);
        const delay = q._age - avgDays;
        const urgency = delay > 60 ? '#b91c1c' : delay > 30 ? '#d97706' : '#92400e';
        return `
        <tr onclick="openEditor('${q.id}')" style="cursor:pointer;">
            <td><strong>${q.quoteCode || q.id.substr(0,8)}</strong></td>
            <td>${client}</td>
            <td>${q.agent || '—'}</td>
            <td>${new Date(q.date || q.createdAt).toLocaleDateString('it-IT')}</td>
            <td><span class="badge" style="background:#fee2e2; color:#b91c1c;">${q._age} gg</span></td>
            <td style="color:${urgency}; font-weight:600;">+${delay} gg</td>
        </tr>`;
    }).join('');
}

function _renderForecastChart(labels, historical, forecast, histLen) {
    const ctx = document.getElementById('predChartForecast');
    if (!ctx || typeof Chart === 'undefined') return;
    if (window.predChartInstance) window.predChartInstance.destroy();

    const fmt = v => (typeof formatCurrency === 'function' ? formatCurrency(v) : v + ' €');

    window.predChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Fatturato Mensile (Storico)',
                    data: historical,
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14,165,233,0.12)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4
                },
                {
                    label: 'Proiezione (Regressione Lineare)',
                    data: forecast,
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124,58,237,0.08)',
                    borderDash: [6, 4],
                    fill: false,
                    tension: 0.3,
                    pointRadius: 3,
                    pointStyle: 'rectRot'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: ctx2 => `${ctx2.dataset.label}: ${fmt(ctx2.raw ?? 0)}`
                    }
                },
                annotation: {
                    annotations: {
                        forecastLine: {
                            type: 'line',
                            xMin: histLen - 1,
                            xMax: histLen - 1,
                            borderColor: '#94a3b8',
                            borderWidth: 1,
                            borderDash: [4, 4],
                            label: {
                                content: 'Inizio previsione',
                                enabled: true,
                                position: 'start',
                                font: { size: 10 }
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => fmt(v) }
                }
            }
        }
    });
}

// ─── Backfill ─────────────────────────────────────────────────────────────────

window.backfillHistoricalData = async function () {
    if (!confirm('Imposta la Data Conferma = Data Preventivo per i chiusi senza questo dato. Ciclo risultante = 0gg. Procedere?')) return;
    const quotes = db.getAllQuotes();
    let count = 0;
    for (const q of quotes) {
        if (['Ordine Confermato','Chiuso'].includes(q.status) && !q.acceptedAt) {
            q.acceptedAt = q.date || q.createdAt || new Date().toISOString();
            await db.saveQuote(q);
            count++;
        }
    }
    alert(`Storico aggiornato: ${count} preventivi corretti.`);
    renderPredictiveAnalysis();
};
