
// --- WIDGETS MODULE ---

/**
 * Renders the Quote Health Widget into a target container.
 * @param {HTMLElement|string} container - Target DOM element or ID
 * @param {Object} data - { probability (0-100), daysOpen, avgCycle }
 */
window.renderQuoteHealthWidget = function (container, data) {
    const target = typeof container === 'string' ? document.getElementById(container) : container;
    if (!target) return;

    const { probability, daysOpen, avgCycle, mode } = data; // mode: 'dashboard' | 'editor' (default)
    const prob = Math.min(100, Math.max(0, probability || 0)); // Clamp 0-100
    const isDashboard = mode === 'dashboard';

    // Logic: Color Determination
    let colorClass, barColor;
    if (prob >= 75) {
        colorClass = 'text-success'; // defined in CSS or TWilind text-green-600
        barColor = 'bg-success';
    } else if (prob >= 40) {
        colorClass = 'text-warning';
        barColor = 'bg-warning';
    } else {
        colorClass = 'text-danger';
        barColor = 'bg-danger';
    }
    // Fallback for custom CSS classes if Tailwind not fully loaded
    const textStyle = `color: ${prob >= 75 ? '#10b981' : prob >= 40 ? '#f59e0b' : '#ef4444'};`;
    const bgStyle = `background-color: ${prob >= 75 ? '#10b981' : prob >= 40 ? '#f59e0b' : '#ef4444'};`;

    // Unique ID for popover
    const widgetId = 'health-widget-' + Math.random().toString(36).substr(2, 9);
    const popoverId = widgetId + '-popover';

    // TEXT LOGIC
    const widgetTitle = isDashboard ? "Tasso Conversione" : "Probabilità Chiusura";
    const leftLabel = isDashboard ? "Win Rate:" : "Score AI:";
    const rightLabel = "Ciclo:";
    const rightValue = isDashboard ? `${avgCycle}gg (Media)` : `${daysOpen}gg`;

    // POPOVER CONTENT
    let popoverContent = '';
    if (isDashboard) {
        popoverContent = `
            <div class="flex justify-between items-center mb-2 border-b border-slate-600 pb-1">
                <span class="font-bold">Info Tasso Conversione</span>
                <i class="fa-solid fa-times cursor-pointer hover:text-slate-300" onclick="document.getElementById('${popoverId}').classList.add('hidden')"></i>
            </div>
            <p class="mb-2">Percentuale di preventivi vinti rispetto al totale.</p>
            <ul class="space-y-1 list-disc pl-4 opacity-90">
                <li><strong style="color:#34d399">Formula:</strong> (Vinti / Totale) * 100</li>
                <li><strong style="color:#38bdf8">Target:</strong> > 40% è buono</li>
            </ul>
        `;
    } else {
        popoverContent = `
            <div class="flex justify-between items-center mb-2 border-b border-slate-600 pb-1">
                <span class="font-bold">Calcolo Score AI</span>
                <i class="fa-solid fa-times cursor-pointer hover:text-slate-300" onclick="document.getElementById('${popoverId}').classList.add('hidden')"></i>
            </div>
            <ul class="space-y-1 list-disc pl-4 opacity-90">
                <li><strong style="color:#38bdf8">Base:</strong> 50% partenza</li>
                <li><strong style="color:#34d399">Storico:</strong> +20% se ricorrente</li>
                <li><strong style="color:#f43f5e">Tempo:</strong> Penalità ritardo (Avg: ${avgCycle}gg)</li>
                <li><strong style="color:#fcd34d">Valore:</strong> Bonus &lt;1k€, Malus &gt;10k€</li>
            </ul>
        `;
    }

    // FINAL LAYOUT: Mimic .kpi-card but with dynamic border color
    // .kpi-card has padding: 1.5rem (p-6 in tailwind is 1.5rem)
    // FINAL LAYOUT: Explicit Inline Styles since Tailwind is missing
    target.innerHTML = `
        <div class="card no-print" style="position: relative; height: 100%; display: flex; flex-direction: column; justify-content: center; padding: 1.5rem; box-shadow: var(--shadow-paper); border-radius: var(--radius-lg); border-left: 5px solid ${prob >= 75 ? '#10b981' : prob >= 40 ? '#f59e0b' : '#ef4444'};">
            
            <!-- Absolute Info Icon (Top Right) -->
            <div style="position: absolute; top: 10px; right: 10px; z-index: 10;">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-regular fa-circle-question" 
                       style="color: #cbd5e1; font-size: 1.1rem; cursor: pointer; transition: color 0.2s;"
                       onmouseover="this.style.color='#0284c7'" 
                       onmouseout="this.style.color='#cbd5e1'"
                       onclick="event.stopPropagation(); document.getElementById('${popoverId}').classList.toggle('hidden')"
                       title="Info"></i>
                     
                     <!-- Popover (Right Aligned) -->
                     <div id="${popoverId}" class="hidden" style="position: absolute; top: 25px; right: 0; background-color: #1e293b; color: white; font-size: 0.75rem; padding: 12px; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); z-index: 50; width: 250px; text-align: left; font-weight: 400; line-height: 1.4; border: 1px solid #334155;">
                        ${popoverContent}
                     </div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <h3 style="margin: 0; font-size: 0.85rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
                    ${widgetTitle}
                </h3>
            </div>

            <!-- VALUES ROW -->
            <div style="display: flex; align-items: flex-end; gap: 8px; margin-bottom: 10px;">
                <span style="font-size: 2rem; font-weight: 700; color: #1e293b; line-height: 1;">${prob}%</span>
                <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 500; margin-bottom: 4px;">${leftLabel.replace(':', '')}</span>
            </div>

            <!-- Progress Bar -->
            <div style="width: 100%; background-color: #f1f5f9; border-radius: 9999px; overflow: hidden; margin-bottom: 10px; height: 6px;">
                <div style="height: 100%; border-radius: 9999px; width: ${prob}%; ${bgStyle} transition: width 0.5s ease;"></div>
            </div>

            <div style="font-size: 0.75rem; color: #94a3b8;">
                ${isDashboard ? 'Media ciclo vendita:' : 'Aperto da:'} <strong style="color: #475569;">${rightValue}</strong>
            </div>
        </div>
    `;
};

/**
 * REUSABLE SCORE CALCULATION
 */
window.calculateQuoteScore = function (quote) {
    if (!quote) return 0;

    // 1. Base Score
    let score = 50;

    // 2. Customer History (Bonus)
    if (quote.customer) {
        const history = db.getAllQuotes().filter(q => q.customer && q.customer.name === quote.customer.name && ['Ordine Confermato', 'Chiuso'].includes(q.status));
        if (history.length > 0) score += 20;
    }

    // 3. Time Decay
    const created = new Date(quote.date || quote.createdAt || new Date());
    const now = new Date();
    const daysOpen = Math.ceil((now - created) / (1000 * 60 * 60 * 24));

    // Get Safe Avg Cycle
    let avgCycle = 30;
    if (window.predictiveState && window.predictiveState.avgCycleDays > 0) {
        avgCycle = window.predictiveState.avgCycleDays;
    }

    if (daysOpen > avgCycle) {
        const overdue = daysOpen - avgCycle;
        score -= overdue;
    }

    // 4. Amount Factor
    const amount = quote.items ? quote.items.reduce((s, i) => s + (i.total || 0), 0) : 0;
    if (amount < 1000) score += 10;
    else if (amount > 10000) score -= 10;
    else if (amount > 50000) score -= 20;

    // Clamp
    return {
        score: Math.min(100, Math.max(0, score)),
        daysOpen: daysOpen,
        avgCycle: avgCycle
    };
};

/**
 * Updates Editor Widget using reusable logic
 */
window.updateEditorHealthWidget = function (quote) {
    if (!quote) return;
    const container = document.getElementById('editorHealthWidget');
    if (!container) return;

    const stats = window.calculateQuoteScore(quote);

    renderQuoteHealthWidget(container, {
        probability: stats.score,
        daysOpen: stats.daysOpen,
        avgCycle: stats.avgCycle
    });
};
