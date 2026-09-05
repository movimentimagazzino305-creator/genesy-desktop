
// --- REPORT 2: ANALYTICS EXPLORER ---

window.initReport2 = function () {
    // defaults
    const d = new Date();
    document.getElementById('rep2End').valueAsDate = d;
    // Set Start Date to Jan 1st of PREVIOUS year (to ensure data is visible)
    document.getElementById('rep2Start').value = new Date(d.getFullYear() - 1, 0, 1).toISOString().split('T')[0];

    // Auto render first time
    renderReport2();
}

window.renderReport2 = function () {
    const dim = document.getElementById('rep2Dim').value;
    const metric = document.getElementById('rep2Metric').value;
    const type = document.getElementById('rep2Type').value;
    const start = new Date(document.getElementById('rep2Start').value);
    const end = new Date(document.getElementById('rep2End').value);
    end.setHours(23, 59, 59, 999);

    // 1. Filter Data by Date
    const rawData = db.getAllQuotes().filter(q => {
        if (q.deleted) return false;
        if (q.excludeFromStats) return false; // Exclude if flagged
        const d = new Date(q.date || q.createdAt);
        return d >= start && d <= end;
    });

    // 2. Aggregate Data
    // Buckets: { "Label": Value }
    const buckets = {};

    rawData.forEach(q => {
        // Determine Keys (Dimensions)
        let keys = [];

        if (dim === 'agent') keys = [q.agent || 'N/D'];
        else if (dim === 'zone') keys = [q.zone || 'N/D'];
        else if (dim === 'status') keys = [q.status || 'Aperto'];
        else if (dim === 'month') {
            const d = new Date(q.date || q.createdAt);
            keys = [`${d.getMonth() + 1}/${d.getFullYear()}`];
        }
        else if (dim === 'category') {
            // Special Case: Item level
            const cats = new Set();
            if (q.items) q.items.forEach(i => {
                if (i.category) cats.add(i.category);
                else cats.add('Altro');
            });
            keys = Array.from(cats);
        }

        // Apply Metric to Keys
        keys.forEach(k => {
            if (!buckets[k]) buckets[k] = 0;

            let val = 0;
            if (metric === 'closed_revenue') {
                // Closed Revenue: Only sum value from SOLD quotes
                if (['Chiuso', 'Ordine Confermato'].includes(q.status)) {
                    if (dim === 'category') {
                        val = q.items ? q.items.filter(i => (i.category || 'Altro') === k).reduce((s, x) => {
                            if (x.includeInStats === false) return s;
                            return s + (parseFloat(x.total) || 0);
                        }, 0) : 0;
                    } else {
                        val = q.items.reduce((s, i) => {
                            // Check if explicit false, otherwise default to true
                            if (i.includeInStats === false) return s;
                            return s + (parseFloat(i.total) || 0);
                        }, 0);
                    }
                } else {
                    val = 0; // Not sold, skip
                }
            }
            else if (metric === 'revenue') {
                // If category, we should ideally sum only items OF that category
                // For now, simplify: if dimension is category, sum matching items. 
                // Else sum total quote.
                if (dim === 'category') {
                    val = q.items ? q.items.filter(i => (i.category || 'Altro') === k).reduce((s, x) => {
                        if (x.includeInStats === false) return s;
                        return s + (parseFloat(x.total) || 0);
                    }, 0) : 0;
                } else {
                    // Only sum Revenue if sold? Usually yes for Revenue Reports.
                    // But if user selects "Status" dimension, they might want Potential Revenue of "Open" quotes.
                    // Let's sum ALL revenue for the Dimension "Revenue".
                    val = q.items.reduce((s, i) => {
                        if (i.includeInStats === false) return s;
                        return s + (parseFloat(i.total) || 0);
                    }, 0);

                    // BUT: commonly revenue implies 'Sold'. 
                    // Let's stick to Total Value of the quote for general aggregation, 
                    // UNLESS metric is specifically "Sold Revenue" (not in list).
                    // Actually, let's filter: if Metric is Revenue, maybe we should only count sold? 
                    // Let's count ALL value for 'Distribution', but maybe color code?
                    // User request "Advanced Stats": standard is usually value of all OR value of sold.
                    // Let's use Value of 'Accettato/Chiuso' ONLY if metric is REVENUE? 
                    // No, if I look at "Status" breakdown, I want to see Revenue of "Open" too.
                    // So: Total Value.
                }
            }
            else if (metric === 'lost_revenue') {
                if (['Perso', 'Rifiutato'].includes(q.status)) {
                    if (dim === 'category') {
                        val = q.items ? q.items.filter(i => (i.category || 'Altro') === k).reduce((s, x) => {
                            if (x.includeInStats === false) return s;
                            return s + (parseFloat(x.total) || 0);
                        }, 0) : 0;
                    } else {
                        val = q.items.reduce((s, i) => {
                            if (i.includeInStats === false) return s;
                            return s + (parseFloat(i.total) || 0);
                        }, 0);
                    }
                } else {
                    val = 0;
                }
            }
            else if (metric === 'count') {
                val = 1;
            }
            else if (metric === 'sold_count') {
                if (['Chiuso', 'Ordine Confermato'].includes(q.status)) val = 1;
                else val = 0;
            }
            else if (metric === 'avg') {
                // Hard to aggregate average directly. We need sum and count.
                // We will handle 'avg' by calculating buckets as { sum: x, count: y } then mapping?
                // For simplicity, let's just sum TOTAL value now, calculate avg later?
                // No, sticking to simple numbers:
                // If metric avg, we sum Value, then divide by Count at the end? 
                // Let's restart aggregator for AVG case.
            }

            if (metric !== 'avg') buckets[k] += val;
        });
    });

    // Handle Average separately or post-process?
    // Let's redo aggregation for complex logic if needed
    if (metric === 'avg') {
        const complexBuckets = {};
        rawData.forEach(q => {
            let keys = [];
            if (dim === 'agent') keys = [q.agent || 'N/D'];
            else if (dim === 'zone') keys = [q.zone || 'N/D'];
            else if (dim === 'status') keys = [q.status || 'Aperto'];
            else if (dim === 'month') {
                const d = new Date(q.date || q.createdAt);
                keys = [`${d.getMonth() + 1}/${d.getFullYear()}`];
            }
            // Skip category for avg for now (too complex item split)

            keys.forEach(k => {
                if (!complexBuckets[k]) complexBuckets[k] = { sum: 0, count: 0 };
                // Only count Sold? Or All? For Average Receipt usually Sold.
                if (['Chiuso', 'Ordine Confermato'].includes(q.status)) {
                    complexBuckets[k].sum += q.items.reduce((s, i) => {
                        if (i.includeInStats === false) return s;
                        return s + (parseFloat(i.total) || 0);
                    }, 0);
                    complexBuckets[k].count++;
                }
            });
        });

        Object.keys(complexBuckets).forEach(k => {
            const b = complexBuckets[k];
            buckets[k] = b.count > 0 ? b.sum / b.count : 0;
        });
    }


    // 3. Prepare Chart Data
    let labels = Object.keys(buckets);
    let values = labels.map(k => buckets[k]);

    // Sort
    if (dim === 'month') {
        labels.sort((a, b) => {
            const [m1, y1] = a.split('/').map(Number);
            const [m2, y2] = b.split('/').map(Number);
            return y1 - y2 || m1 - m2;
        });
        values = labels.map(k => buckets[k]);
    } else {
        // Sort Descending Value
        const combined = labels.map((l, i) => ({ l, v: values[i] }));
        combined.sort((a, b) => b.v - a.v);
        labels = combined.map(c => c.l);
        values = combined.map(c => c.v);
    }

    // Top 10 limit for readability?
    if (labels.length > 15 && dim !== 'month') {
        labels = labels.slice(0, 15);
        values = values.slice(0, 15);
    }

    // Colors
    const colors = [
        '#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea',
        '#089899', '#db2777', '#64748b', '#8b5cf6', '#f59e0b'
    ];
    const bgColors = values.map((_, i) => type === 'line' ? 'rgba(37,99,235,0.1)' : colors[i % colors.length]);
    const borderColors = values.map((_, i) => type === 'line' ? '#2563eb' : colors[i % colors.length]);

    // Destroy Old Chart
    if (window.rep2Chart) window.rep2Chart.destroy();

    // Context
    const ctx = document.getElementById('rep2Canvas').getContext('2d');

    // HANDLE EMPTY DATA
    if (labels.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = "14px Outfit, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";

        // Center text considering canvas size
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        ctx.fillText("Nessun dato disponibile con i filtri attuali.", w / 2, h / 2);

        // Reset KPIs
        document.getElementById('rep2Total').textContent = '-';
        document.getElementById('rep2Avg').textContent = '-';
        document.getElementById('rep2Top').textContent = '-';
        document.getElementById('rep2TopVal').textContent = '-';
        document.getElementById('rep2GlobalTotal').textContent = '-';
        document.getElementById('rep2GlobalClosed').textContent = '-';
        document.getElementById('rep2GlobalLost').textContent = '-';
        return;
    }

    // Label
    const metricLabel = document.getElementById('rep2Metric').selectedOptions[0].text;

    window.rep2Chart = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: metricLabel,
                data: values,
                backgroundColor: type === 'line' ? 'rgba(37, 99, 235, 0.1)' : bgColors,
                borderColor: type === 'line' ? '#2563eb' : borderColors,
                borderWidth: 1,
                fill: type === 'line'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: type !== 'bar' } // Hide legend for Bar if redundant
            },
            scales: {
                y: { beginAtZero: true, display: type !== 'pie' && type !== 'doughnut' && type !== 'polarArea' },
                x: { display: type !== 'pie' && type !== 'doughnut' && type !== 'polarArea' }
            }
        }
    });

    // 4. Update KPI Summary
    const totalVal = values.reduce((a, b) => a + b, 0);
    const avgVal = values.length > 0 ? totalVal / values.length : 0;

    // Formatting helper
    const isMonetary = ['revenue', 'avg', 'closed_revenue', 'lost_revenue'].includes(metric);
    const fmt = (n) => isMonetary ? formatCurrency(parseFloat(n) || 0) + ' €' : Math.round(parseFloat(n) || 0);

    document.getElementById('rep2Total').textContent = fmt(totalVal);
    document.getElementById('rep2Avg').textContent = fmt(avgVal.toFixed(2)); // Avg of Groups

    // Top
    if (labels.length > 0) {
        document.getElementById('rep2Top').textContent = labels[0];
        document.getElementById('rep2TopVal').textContent = fmt(values[0]);
    } else {
        document.getElementById('rep2Top').textContent = '-';
        document.getElementById('rep2TopVal').textContent = '-';
    }

    // 5. Calculate Global KPIs (Independent of dimension/metric but affected by date filters)
    let globalTotal = 0;
    let globalClosed = 0;
    let globalLost = 0;

    rawData.forEach(q => {
        const quoteVal = q.items ? q.items.reduce((s, i) => {
            if (i.includeInStats === false) return s;
            return s + (parseFloat(i.total) || 0);
        }, 0) : 0;

        globalTotal += quoteVal;
        if (['Chiuso', 'Ordine Confermato'].includes(q.status)) {
            globalClosed += quoteVal;
        } else if (['Perso', 'Rifiutato'].includes(q.status)) {
            globalLost += quoteVal;
        }
    });

    document.getElementById('rep2GlobalTotal').textContent = formatCurrency(globalTotal) + ' €';
    document.getElementById('rep2GlobalClosed').textContent = formatCurrency(globalClosed) + ' €';
    document.getElementById('rep2GlobalLost').textContent = formatCurrency(globalLost) + ' €';
}

window.exportRep2ToExcel = function() {
    if (!window.XLSX) {
        alert("Libreria XLSX non trovata!");
        return;
    }

    const dim = document.getElementById('rep2Dim').selectedOptions[0].text;
    const metric = document.getElementById('rep2Metric').selectedOptions[0].text;

    const wb = XLSX.utils.book_new();

    // 1. Data Sheet
    const chartData = [
        [dim, metric]
    ];
    
    // rep2Chart.data
    if (window.rep2Chart && window.rep2Chart.data.labels) {
        const labels = window.rep2Chart.data.labels;
        const values = window.rep2Chart.data.datasets[0].data;
        for(let i=0; i<labels.length; i++) {
            chartData.push([labels[i], values[i]]);
        }
    }

    const wsData = XLSX.utils.aoa_to_sheet(chartData);
    XLSX.utils.book_append_sheet(wb, wsData, "Dati Grafico");

    const cleanText = (id) => {
        const el = document.getElementById(id);
        return el ? el.textContent.replace(/€/g, '').trim() : '';
    };

    // 2. Global KPIs
    const kpiData = [
        ["Metrica Globale", "Valore Periodo"],
        ["Preventivato Globale", cleanText('rep2GlobalTotal')],
        ["Valore Chiuso", cleanText('rep2GlobalClosed')],
        ["Valore Perso", cleanText('rep2GlobalLost')]
    ];
    const wsKPI = XLSX.utils.aoa_to_sheet(kpiData);
    XLSX.utils.book_append_sheet(wb, wsKPI, "KPI Globali");

    const d = new Date();
    XLSX.writeFile(wb, `Analytics_Explorer_${d.getFullYear()}${('0'+(d.getMonth()+1)).slice(-2)}${('0'+d.getDate()).slice(-2)}.xlsx`);
}
