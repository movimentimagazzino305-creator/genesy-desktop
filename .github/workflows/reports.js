
// --- ADVANCED REPORTS LOGIC ---

window.renderAdvancedReports = function () {

    // 1. Get Filters
    const startStr = document.getElementById('advDateStart').value;
    const endStr = document.getElementById('advDateEnd').value;
    const granularity = document.getElementById('advGranularity').value;
    const agentFilter = document.getElementById('advAgent').value;
    const zoneFilter = document.getElementById('advZone').value;
    const statusFilter = document.getElementById('advStatus').value;
    const executionYearFilter = document.getElementById('advExecutionYear') ? document.getElementById('advExecutionYear').value : '';
    const compare = document.getElementById('advCompare').checked;

    // Default dates if empty (Current Year)
    let startDate, endDate;
    if (startStr) startDate = new Date(startStr);
    else startDate = new Date(new Date().getFullYear(), 0, 1);

    if (endStr) endDate = new Date(endStr);
    else endDate = new Date(); // Now

    // Adjust for end of day
    endDate.setHours(23, 59, 59, 999);

    // Filter Logic
    const all = db.getAllQuotes();

    const filterFn = (q) => {
        if (q.deleted) return false;
        if (q.excludeFromStats) return false;

        // Agent
        if (agentFilter && q.agent !== agentFilter) return false;

        // Zone
        if (zoneFilter && q.zone !== zoneFilter) return false;

        // Anno Lavoro
        if (executionYearFilter) {
            const qYear = q.executionYear || (q.extra_fields && q.extra_fields.executionYear) || (q.date ? q.date.split('-')[0] : '');
            if (String(qYear) !== String(executionYearFilter)) return false;
        }

        // Status Wrapper
        // 'sold' = Chiuso/Ordine Confermato
        // 'lost' = Perso/Rifiutato
        // 'open' = Aperto/Attesa/Bozza
        if (statusFilter === 'sold' && !['Chiuso', 'Ordine Confermato'].includes(q.status)) return false;
        if (statusFilter === 'lost' && !['Perso', 'Rifiutato'].includes(q.status)) return false;
        if (statusFilter === 'open' && !['Aperto', 'In Attesa', 'Bozza'].includes(q.status)) return false;

        return true;
    };

    // Current Period Data
    const currentData = all.filter(q => {
        const d = new Date(q.date || q.createdAt);
        return d >= startDate && d <= endDate && filterFn(q);
    });

    // Previous Period Data (if Compare is ON)
    let prevData = [];
    let prevStartDate, prevEndDate;

    if (compare) {
        const duration = endDate.getTime() - startDate.getTime();
        prevEndDate = new Date(startDate.getTime() - 1); // 1ms before start
        prevStartDate = new Date(prevEndDate.getTime() - duration);

        prevData = all.filter(q => {
            const d = new Date(q.date || q.createdAt);
            return d >= prevStartDate && d <= prevEndDate && filterFn(q);
        });
    }

    // 2. Calculate KPIs
    const calcKPIs = (data) => {
        const total = data.length;
        
        let revenue = 0;
        let totalValue = 0;
        let lostValue = 0;
        let openValue = 0;

        data.forEach(q => {
            const val = q.items ? q.items.reduce((s, i) => {
                if (i.includeInStats === false) return s;
                return s + (i.total || 0);
            }, 0) : 0;

            totalValue += val;

            if (['Chiuso', 'Ordine Confermato'].includes(q.status)) {
                revenue += val;
            } else if (['Perso', 'Rifiutato'].includes(q.status)) {
                lostValue += val;
            } else {
                openValue += val;
            }
        });

        const soldCount = data.filter(q => ['Chiuso', 'Ordine Confermato'].includes(q.status)).length;
        const avg = soldCount > 0 ? revenue / soldCount : 0;
        const conv = total > 0 ? (soldCount / total) * 100 : 0;

        return { total, revenue, totalValue, lostValue, openValue, avg, conv };
    };

    const currKPI = calcKPIs(currentData);
    const prevKPI = compare ? calcKPIs(prevData) : null;

    // Update DOM
    document.getElementById('advKpiTotalValue').textContent = formatCurrency(currKPI.totalValue) + ' €';
    document.getElementById('advKpiRevenue').textContent = formatCurrency(currKPI.revenue) + ' €';
    document.getElementById('advKpiLostValue').textContent = formatCurrency(currKPI.lostValue) + ' €';
    document.getElementById('advKpiOpenValue').textContent = formatCurrency(currKPI.openValue) + ' €';
    document.getElementById('advKpiCount').textContent = currKPI.total; // Count is total quotes or sold quotes? Usually total quotes for volume, revenue for sales.
    document.getElementById('advKpiAvg').textContent = formatCurrency(currKPI.avg) + ' €';
    document.getElementById('advKpiConv').textContent = currKPI.conv.toFixed(1) + '%';

    // Deltas
    const renderDelta = (id, curr, prev, format = 'num') => {
        const el = document.getElementById(id);
        if (!prevKPI) {
            el.textContent = '-';
            el.style.color = 'var(--text-muted)';
            return;
        }
        const diff = curr - prev;
        const pct = prev > 0 ? (diff / prev) * 100 : 0;

        let icon = diff >= 0 ? '↑' : '↓';
        let color = diff >= 0 ? 'var(--success-color)' : 'var(--danger-color)';

        // Invert color for "Bad" metrics if needed (none strictly bad here except maybe 'lost')

        el.innerHTML = `<span style="color:${color}">${icon} ${Math.abs(pct).toFixed(1)}%</span> vs prev`;
    };

    renderDelta('advDeltaTotalValue', currKPI.totalValue, prevKPI ? prevKPI.totalValue : 0);
    renderDelta('advDeltaRevenue', currKPI.revenue, prevKPI ? prevKPI.revenue : 0);
    renderDelta('advDeltaLostValue', currKPI.lostValue, prevKPI ? prevKPI.lostValue : 0);
    renderDelta('advDeltaOpenValue', currKPI.openValue, prevKPI ? prevKPI.openValue : 0);
    renderDelta('advDeltaCount', currKPI.total, prevKPI ? prevKPI.total : 0);
    renderDelta('advDeltaAvg', currKPI.avg, prevKPI ? prevKPI.avg : 0);
    renderDelta('advDeltaConv', currKPI.conv, prevKPI ? prevKPI.conv : 0);


    // 3. Prepare Chart Data (Time Series)
    // defined buckets based on Granularity
    const buckets = {}; // key: date string, value: { revenue, count }

    // Helper to get bucket key
    const getKey = (date, granularity) => {
        const d = new Date(date);
        if (granularity === 'day') return d.toLocaleDateString('it-IT'); // DD/MM/YYYY
        if (granularity === 'week') {
            // Simple week identifier? Iso week is hard. Let's use Start of Week
            const day = d.getDay();
            const diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
            const monday = new Date(d.setDate(diff));
            return monday.toLocaleDateString('it-IT') + ' (Settimana)';
        }
        if (granularity === 'month') return `${d.getMonth() + 1}/${d.getFullYear()}`;
        if (granularity === 'year') return `${d.getFullYear()}`;
        return d.toDateString();
    };

    // Sort chrono
    currentData.sort((a, b) => new Date(a.date) - new Date(b.date));

    currentData.forEach(q => {
        const key = getKey(q.date || q.createdAt, granularity);
        if (!buckets[key]) buckets[key] = { revenue: 0, count: 0, sold: 0 };
        buckets[key].count++;
        if (['Chiuso', 'Ordine Confermato'].includes(q.status)) {
            buckets[key].sold++;
            buckets[key].revenue += q.items.reduce((s, i) => {
                if (i.includeInStats === false) return s;
                return s + (i.total || 0);
            }, 0);
        }
    });

    const labels = Object.keys(buckets);
    const dataRev = labels.map(k => buckets[k].revenue);
    const dataCount = labels.map(k => buckets[k].count);

    // Render Chart
    const ctx = document.getElementById('advMainChart').getContext('2d');

    if (window.advChartInstance) window.advChartInstance.destroy();

    window.advChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Fatturato (€)',
                    data: dataRev,
                    borderColor: '#2563eb', // Primary Blue
                    yAxisID: 'y',
                    tension: 0.3,
                    fill: true,
                    backgroundColor: 'rgba(37, 99, 235, 0.1)'
                },
                {
                    label: 'Preventivi (N.)',
                    data: dataCount,
                    borderColor: '#64748b', // Slate
                    yAxisID: 'y1',
                    borderDash: [5, 5],
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Fatturato €' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Numero' }
                }
            }
        }
    });

    // Segmentazione rimossa da qui e spostata in renderProspect()


    // 4. Fill Table
    const tbody = document.getElementById('advTableBody');
    tbody.innerHTML = '';
    labels.forEach((label, idx) => {
        const b = buckets[label];
        const avg = b.sold > 0 ? b.revenue / b.sold : 0;

        tbody.innerHTML += `<tr>
            <td>${label}</td>
            <td><strong>${formatCurrency(b.revenue)} €</strong></td>
            <td>${b.count}</td>
            <td>${formatCurrency(avg)} €</td>
            <td>${b.sold}</td>
        </tr>`;
    });
};

window.exportAdvReportToExcel = function() {
    if (!window.XLSX) {
        alert("Libreria XLSX non trovata!");
        return;
    }
    
    // Create workbook
    const wb = XLSX.utils.book_new();

    const cleanText = (id) => {
        const el = document.getElementById(id);
        return el ? el.textContent.replace(/€/g, '').trim() : '';
    };

    // 1. KPI Sheet
    const kpiData = [
        ["Metrica", "Valore Periodo"],
        ["Preventivato Totale", cleanText('advKpiTotalValue')],
        ["Chiuso / Venduto", cleanText('advKpiRevenue')],
        ["Perso", cleanText('advKpiLostValue')],
        ["Aperto", cleanText('advKpiOpenValue')],
        ["Numero Preventivi", cleanText('advKpiCount')],
        ["Scontrino Medio", cleanText('advKpiAvg')],
        ["Conversion Rate", cleanText('advKpiConv')]
    ];
    const wsKPI = XLSX.utils.aoa_to_sheet(kpiData);
    XLSX.utils.book_append_sheet(wb, wsKPI, "KPI");

    // 2. Data Table Sheet
    const table = document.querySelector("#adv_reports .modern-table");
    if(table) {
        const clone = table.cloneNode(true);
        clone.querySelectorAll('td, th').forEach(cell => {
            if(cell.textContent.includes('€')) {
                cell.textContent = cell.textContent.replace(/€/g, '').trim();
            }
        });
        const wsTable = XLSX.utils.table_to_sheet(clone);
        XLSX.utils.book_append_sheet(wb, wsTable, "Dettaglio Periodo");
    }

    // Export
    const d = new Date();
    XLSX.writeFile(wb, `Report_Avanzato_${d.getFullYear()}${('0'+(d.getMonth()+1)).slice(-2)}${('0'+d.getDate()).slice(-2)}.xlsx`);
};

function toggleAdvCompare() {
    renderAdvancedReports();
}

// Init Filters
function initAdvFilters() {
    // Agents
    const agSel = document.getElementById('advAgent');
    const prevAgent = agSel ? agSel.value : '';
    agSel.innerHTML = '<option value="">Tutti</option>'; // Reset
    db.getAgents().forEach(a => {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        agSel.appendChild(opt);
    });
    if (prevAgent && agSel) agSel.value = prevAgent;

    // Zones
    const zones = new Set(db.getAllQuotes().map(q => q.zone).filter(Boolean));
    const zoneSel = document.getElementById('advZone');
    const prevZone = zoneSel ? zoneSel.value : '';
    zoneSel.innerHTML = '<option value="">Tutte</option>'; // Reset
    zones.forEach(z => {
        const opt = document.createElement('option');
        opt.value = z;
        opt.textContent = z;
        zoneSel.appendChild(opt);
    });
    if (prevZone && zoneSel) zoneSel.value = prevZone;

    // Execution Years
    const years = new Set(db.getAllQuotes().map(q => {
        return q.executionYear || (q.extra_fields && q.extra_fields.executionYear) || (q.date ? q.date.split('-')[0] : '');
    }).filter(Boolean));
    const yearSel = document.getElementById('advExecutionYear');
    if (yearSel) {
        const prevYear = yearSel.value;
        yearSel.innerHTML = '<option value="">Tutti</option>'; // Reset
        Array.from(years).sort((a, b) => b.localeCompare(a)).forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearSel.appendChild(opt);
        });
        if (prevYear) yearSel.value = prevYear;
    }

    // Listeners
    ['advDateStart', 'advDateEnd', 'advGranularity', 'advAgent', 'advZone', 'advStatus', 'advExecutionYear'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', renderAdvancedReports);
    });

}

let prospectFiltersInitialized = false;
window.initProspectFilters = function() {
    const prosAgSel = document.getElementById('prospectAgent');
    if (prosAgSel) {
        const currentVal = prosAgSel.value;
        prosAgSel.innerHTML = '<option value="">Tutti</option>';
        db.getAgents().forEach(a => {
            const opt = document.createElement('option');
            opt.value = a;
            opt.textContent = a;
            prosAgSel.appendChild(opt);
        });
        if(currentVal) prosAgSel.value = currentVal;
    }

    if (!prospectFiltersInitialized) {
        ['prospectDateStart', 'prospectDateEnd', 'prospectMetric', 'prospectChartType', 'prospectAgent'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('change', renderProspect);
        });
        prospectFiltersInitialized = true;
    }
};

window.renderProspect = function () {
    const startStr = document.getElementById('prospectDateStart').value;
    const endStr = document.getElementById('prospectDateEnd').value;
    const metricType = document.getElementById('prospectMetric') ? document.getElementById('prospectMetric').value : 'value';
    const agentStr = document.getElementById('prospectAgent') ? document.getElementById('prospectAgent').value : '';

    let startDate, endDate;
    if (startStr) startDate = new Date(startStr);
    else startDate = new Date(new Date().getFullYear(), 0, 1);

    if (endStr) endDate = new Date(endStr);
    else endDate = new Date();

    endDate.setHours(23, 59, 59, 999);

    const all = db.getAllQuotes();
    const currentData = all.filter(q => {
        if (q.deleted) return false;
        if (q.excludeFromStats) return false;
        if (agentStr && q.agent !== agentStr) return false;
        const d = new Date(q.date || q.createdAt);
        return d >= startDate && d <= endDate;
    });

    const jobTypes = {};
    const materials = {};
    const contacts = {};
    const priceRanges = {};

    const initMap = (map, key) => {
        if (!map[key]) {
            map[key] = {
                valOpen: 0, valClosed: 0, valLost: 0, valTotal: 0,
                cntOpen: 0, cntClosed: 0, cntLost: 0, cntTotal: 0
            };
        }
    };

    currentData.forEach(q => {
        const jt = q.jobType || 'Non Specificato';
        const mat = q.material || 'Non Specificato';
        const cnt = q.contact || 'Non Specificato';

        initMap(jobTypes, jt);
        initMap(materials, mat);
        initMap(contacts, cnt);

        let quoteVal = 0;
        if (q.items) {
            quoteVal = q.items.reduce((s, i) => {
                if (i.includeInStats === false) return s;
                return s + (parseFloat(i.total) || 0);
            }, 0);
        }

        let pr = '';
        if (quoteVal <= 1000) pr = '0 - 1.000 €';
        else if (quoteVal <= 6000) pr = '1.001 - 6.000 €';
        else if (quoteVal <= 10000) pr = '6.001 - 10.000 €';
        else if (quoteVal <= 15000) pr = '10.001 - 15.000 €';
        else pr = 'Oltre 15.000 €';

        initMap(priceRanges, pr);

        const isClosed = ['Chiuso', 'Ordine Confermato'].includes(q.status);
        const isLost = ['Perso', 'Rifiutato'].includes(q.status);
        const isOpen = !isClosed && !isLost;

        const maps = [jobTypes[jt], materials[mat], contacts[cnt], priceRanges[pr]];

        maps.forEach(m => {
            m.valTotal += quoteVal;
            m.cntTotal += 1;

            if (isClosed) { m.valClosed += quoteVal; m.cntClosed += 1; }
            else if (isLost) { m.valLost += quoteVal; m.cntLost += 1; }
            else { m.valOpen += quoteVal; m.cntOpen += 1; }
        });
    });

    // Helper to render charts dynamically
    const createProspectChart = (canvasId, dataMap, useValue) => {
        const ctxEl = document.getElementById(canvasId);
        if (!ctxEl) return;
        
        if (window[`${canvasId}Instance`]) {
            window[`${canvasId}Instance`].destroy();
        }

        const chartTypeSelector = document.getElementById('prospectChartType');
        const selectedType = chartTypeSelector ? chartTypeSelector.value : 'bar-stacked';
        
        let chartJsType = selectedType;
        let isStacked = false;
        
        if (selectedType === 'bar-stacked') {
            chartJsType = 'bar';
            isStacked = true;
        }

        // Sort by total (descending) or keep specific order for price ranges
        let keys = Object.keys(dataMap);
        const isPriceRange = keys.some(k => k.includes(' - ') || k.includes('Oltre'));
        if (isPriceRange) {
            const order = ['0 - 1.000 €', '1.001 - 6.000 €', '6.001 - 10.000 €', '10.001 - 15.000 €', 'Oltre 15.000 €'];
            keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        } else {
            keys.sort((a, b) => {
                return useValue ? dataMap[b].valTotal - dataMap[a].valTotal : dataMap[b].cntTotal - dataMap[a].cntTotal;
            });
        }

        const dataOpen = keys.map(k => useValue ? dataMap[k].valOpen : dataMap[k].cntOpen);
        const dataClosed = keys.map(k => useValue ? dataMap[k].valClosed : dataMap[k].cntClosed);
        const dataLost = keys.map(k => useValue ? dataMap[k].valLost : dataMap[k].cntLost);

        const datasets = [];

        // If Pie/Doughnut, often it's better to just show Total per category to avoid confusing nested rings, 
        // but since we want to show the status breakdown, we'll keep the datasets. ChartJS handles nested rings.
        datasets.push({
            label: 'Chiuso / Fatturato',
            data: dataClosed,
            backgroundColor: chartJsType === 'pie' || chartJsType === 'doughnut' ? ['#16a34a', '#15803d', '#14532d', '#22c55e', '#4ade80'] : '#16a34a',
            borderColor: chartJsType === 'line' ? '#16a34a' : undefined,
            fill: chartJsType !== 'line'
        });
        datasets.push({
            label: 'Aperto',
            data: dataOpen,
            backgroundColor: chartJsType === 'pie' || chartJsType === 'doughnut' ? ['#2563eb', '#1d4ed8', '#1e3a8a', '#3b82f6', '#60a5fa'] : '#2563eb',
            borderColor: chartJsType === 'line' ? '#2563eb' : undefined,
            fill: chartJsType !== 'line'
        });
        datasets.push({
            label: 'Perso',
            data: dataLost,
            backgroundColor: chartJsType === 'pie' || chartJsType === 'doughnut' ? ['#dc2626', '#b91c1c', '#7f1d1d', '#ef4444', '#f87171'] : '#dc2626',
            borderColor: chartJsType === 'line' ? '#dc2626' : undefined,
            fill: chartJsType !== 'line'
        });

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) { label += ': '; }
                            if (context.parsed.y !== null && context.parsed.y !== undefined) {
                                label += useValue ? formatCurrency(context.parsed.y) + ' €' : context.parsed.y;
                            } else if (context.raw !== null) { // for pie/doughnut
                                label += useValue ? formatCurrency(context.raw) + ' €' : context.raw;
                            }
                            return label;
                        }
                    }
                }
            }
        };

        if (chartJsType === 'bar' || chartJsType === 'line') {
            options.scales = {
                x: { stacked: isStacked },
                y: { 
                    stacked: isStacked,
                    ticks: {
                        callback: function(value) {
                            return useValue ? formatCurrency(value) + ' €' : value;
                        }
                    }
                }
            };
        }

        window[`${canvasId}Instance`] = new Chart(ctxEl, {
            type: chartJsType,
            data: {
                labels: keys,
                datasets: datasets
            },
            options: options
        });
    };

    const isValue = metricType === 'value';
    createProspectChart('advJobTypeChart', jobTypes, isValue);
    createProspectChart('advMaterialChart', materials, isValue);
    createProspectChart('advContactChart', contacts, isValue);
    createProspectChart('advPriceRangeChart', priceRanges, isValue);

    // Render Tables
    const renderTable = (tableId, dataMap) => {
        const tbody = document.querySelector(`#${tableId} tbody`);
        if (!tbody) return;
        tbody.innerHTML = '';

        let keys = Object.keys(dataMap);
        const isPriceRange = keys.some(k => k.includes(' - ') || k.includes('Oltre'));
        if (isPriceRange) {
            const order = ['0 - 1.000 €', '1.001 - 6.000 €', '6.001 - 10.000 €', '10.001 - 15.000 €', 'Oltre 15.000 €'];
            keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        } else {
            keys.sort((a, b) => dataMap[b].valTotal - dataMap[a].valTotal);
        }
        
        if(keys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Nessun dato nel periodo</td></tr>';
            return;
        }

        const grandTotalValue = keys.reduce((sum, k) => sum + dataMap[k].valTotal, 0);

        keys.forEach(k => {
            const m = dataMap[k];
            const t = formatCurrency(m.valTotal) + ' €';
            const o = formatCurrency(m.valOpen) + ' €';
            const c = formatCurrency(m.valClosed) + ' €';
            const l = formatCurrency(m.valLost) + ' €';
            
            const percTotal = grandTotalValue > 0 ? Math.round((m.valTotal / grandTotalValue) * 100) : 0;
            const percOpen = m.valTotal > 0 ? Math.round((m.valOpen / m.valTotal) * 100) : 0;
            const percClosed = m.valTotal > 0 ? Math.round((m.valClosed / m.valTotal) * 100) : 0;
            const percLost = m.valTotal > 0 ? Math.round((m.valLost / m.valTotal) * 100) : 0;

            tbody.innerHTML += `
                <tr>
                    <td><strong>${k}</strong></td>
                    <td>${t} <span style="font-size:0.75rem; color:#64748b;">(${percTotal}%)</span> <br><small style="color:#64748b;">(${m.cntTotal} prev.)</small></td>
                    <td style="color:#2563eb">${o} <span style="font-size:0.75rem; color:#2563eb;">(${percOpen}%)</span> <br><small>(${m.cntOpen})</small></td>
                    <td style="color:#16a34a">${c} <span style="font-size:0.75rem; color:#16a34a;">(${percClosed}%)</span> <br><small>(${m.cntClosed})</small></td>
                    <td style="color:#dc2626">${l} <span style="font-size:0.75rem; color:#dc2626;">(${percLost}%)</span> <br><small>(${m.cntLost})</small></td>
                </tr>
            `;
        });
    };

    renderTable('prospectJobTypeTable', jobTypes);
    renderTable('prospectMaterialTable', materials);
    renderTable('prospectContactTable', contacts);
    renderTable('prospectPriceRangeTable', priceRanges);

    // Salva per export
    window.lastProspectData = {
        jobTypes, materials, contacts, priceRanges
    };
};

window.exportProspectToExcel = function() {
    if (!window.XLSX) {
        alert("Libreria XLSX non trovata!");
        return;
    }
    if (!window.lastProspectData) {
        alert("Genera prima i dati del Prospect cliccando su Filtra!");
        return;
    }

    const agentSelect = document.getElementById('prospectAgent');
    let agentStr = 'Tutti gli Agenti';
    if (agentSelect && agentSelect.value) {
        agentStr = agentSelect.options[agentSelect.selectedIndex].text;
    }

    const wb = XLSX.utils.book_new();

    const generateSheetData = (title, dataMap) => {
        const rows = [
            [`Report Analisi Prospect - Agente: ${agentStr}`],
            [],
            [title, "Prev. Totale (€)", "% Incid.", "N. Tot", "Aperto (€)", "% Ap.", "N. Aperto", "Chiuso/Fatturato (€)", "% Ch.", "N. Chiuso", "Perso (€)", "% Pe.", "N. Perso"]
        ];

        let keys = Object.keys(dataMap);
        const isPriceRange = keys.some(k => k.includes(' - ') || k.includes('Oltre'));
        if (isPriceRange) {
            const order = ['0 - 1.000 €', '1.001 - 6.000 €', '6.001 - 10.000 €', '10.001 - 15.000 €', 'Oltre 15.000 €'];
            keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        } else {
            keys.sort((a, b) => dataMap[b].valTotal - dataMap[a].valTotal);
        }

        const grandTotalValue = keys.reduce((sum, k) => sum + dataMap[k].valTotal, 0);

        keys.forEach(k => {
            const m = dataMap[k];
            const percTotal = grandTotalValue > 0 ? Math.round((m.valTotal / grandTotalValue) * 100) : 0;
            const percOpen = m.valTotal > 0 ? Math.round((m.valOpen / m.valTotal) * 100) : 0;
            const percClosed = m.valTotal > 0 ? Math.round((m.valClosed / m.valTotal) * 100) : 0;
            const percLost = m.valTotal > 0 ? Math.round((m.valLost / m.valTotal) * 100) : 0;

            rows.push([
                k, 
                m.valTotal, percTotal + '%', m.cntTotal,
                m.valOpen, percOpen + '%', m.cntOpen,
                m.valClosed, percClosed + '%', m.cntClosed,
                m.valLost, percLost + '%', m.cntLost
            ]);
        });
        return rows;
    };

    const wsJobs = XLSX.utils.aoa_to_sheet(generateSheetData("Tipo Lavoro", window.lastProspectData.jobTypes));
    const wsMats = XLSX.utils.aoa_to_sheet(generateSheetData("Materiale Principale", window.lastProspectData.materials));
    const wsCont = XLSX.utils.aoa_to_sheet(generateSheetData("Origine Contatto", window.lastProspectData.contacts));
    const wsPrice = XLSX.utils.aoa_to_sheet(generateSheetData("Fascia di Prezzo", window.lastProspectData.priceRanges));

    const setSheetFormatting = (ws) => {
        ws['!cols'] = [
            { wch: 30 }, // title
            { wch: 18 }, // valTotal
            { wch: 12 }, // percTotal
            { wch: 12 }, // cntTotal
            { wch: 18 }, // valOpen
            { wch: 12 }, // percOpen
            { wch: 14 }, // cntOpen
            { wch: 22 }, // valClosed
            { wch: 12 }, // percClosed
            { wch: 14 }, // cntClosed
            { wch: 18 }, // valLost
            { wch: 12 }, // percLost
            { wch: 14 }  // cntLost
        ];
    };

    setSheetFormatting(wsJobs);
    setSheetFormatting(wsMats);
    setSheetFormatting(wsCont);
    setSheetFormatting(wsPrice);

    XLSX.utils.book_append_sheet(wb, wsJobs, "Tipo Lavoro");
    XLSX.utils.book_append_sheet(wb, wsMats, "Materiale Principale");
    XLSX.utils.book_append_sheet(wb, wsCont, "Origine Contatto");
    XLSX.utils.book_append_sheet(wb, wsPrice, "Fascia di Prezzo");

    const d = new Date();
    XLSX.writeFile(wb, `Analisi_Prospect_${d.getFullYear()}${('0'+(d.getMonth()+1)).slice(-2)}${('0'+d.getDate()).slice(-2)}.xlsx`);
};

window.printProspect = function() {
    const agentSelect = document.getElementById('prospectAgent');
    let agentStr = 'Tutti gli Agenti';
    if (agentSelect && agentSelect.value) {
        agentStr = agentSelect.options[agentSelect.selectedIndex].text;
    }

    let printHeader = document.getElementById('prospectPrintHeader');
    if (!printHeader) {
        printHeader = document.createElement('div');
        printHeader.id = 'prospectPrintHeader';
        printHeader.className = 'print-only prospect-print-header';
        printHeader.style.display = 'none';
        
        const prospectSection = document.getElementById('prospect');
        prospectSection.insertBefore(printHeader, prospectSection.firstChild);
    }

    const d = new Date();
    const dateStr = `${('0'+d.getDate()).slice(-2)}/${('0'+(d.getMonth()+1)).slice(-2)}/${d.getFullYear()}`;
    
    printHeader.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
            <h1 style="color: #1e293b; margin: 0; font-size: 24px;">Report Analisi Prospect</h1>
            <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Generato il: ${dateStr}</p>
            <div style="margin-top: 15px; background: #f8fafc; display: inline-block; padding: 8px 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <strong style="color: #334155;">Agente di Riferimento:</strong> 
                <span style="color: #2563eb; font-size: 18px; margin-left: 10px; font-weight: bold;">${agentStr}</span>
            </div>
        </div>
    `;

    const originalPrintStyle = document.getElementById('dynamic-print-style');
    if(originalPrintStyle) originalPrintStyle.remove();
    
    const style = document.createElement('style');
    style.id = 'dynamic-print-style';
    style.innerHTML = `
        @media print {
            body > *:not(#appLayout) { display: none !important; }
            #appLayout > *:not(.main-content) { display: none !important; }
            .main-content > *:not(#prospect) { display: none !important; }
            
            .sidebar, .top-navbar, #bottomTabBar, .bottom-tab-bar { display: none !important; }
            .view-header, .filter-bar { display: none !important; }
            
            #prospect {
                display: block !important;
                visibility: visible !important;
                position: relative !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
            }
            
            #prospectPrintHeader {
                display: block !important;
                visibility: visible !important;
            }
            
            .dashboard-grid {
                display: grid !important;
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 20px !important;
            }
            .card {
                box-shadow: none !important;
                border: 1px solid #e2e8f0 !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                margin-bottom: 15px !important;
                background: white !important;
            }
            canvas {
                max-height: 200px !important;
                width: auto !important;
                max-width: 100% !important;
            }
            
            @page { margin: 10mm; }
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        window.print();
        setTimeout(() => {
            style.remove();
            printHeader.style.display = 'none';
        }, 1000);
    }, 500);
};
