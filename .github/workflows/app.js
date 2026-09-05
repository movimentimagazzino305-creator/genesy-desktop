/**
 * Logica Applicazione - V3
 * Include Filtri Avanzati
 */

window.localizeError = window.localizeError || ((e) => (e && e.message ? e.message : String(e)));
window.setupNavigation = typeof setupNavigation === 'function' ? setupNavigation : function(){};

// State
let currentQuote = null; // Object being edited
let editorIsDirty = false; // Track unsaved changes
let isPickingMode = false; // Product selection mode flag

window.isBattiscopa = function(item) {
    if (!item) return false;
    const desc = (typeof item === 'string' ? item : (item.description || '')).toLowerCase().trim();
    const code = (typeof item === 'object' && item.code ? item.code : '').toLowerCase().trim();
    const cat = (typeof item === 'object' && item.category ? item.category : '').toLowerCase().trim();

    if (cat.includes('battiscopa') || cat.includes('batt')) return true;
    if (code.startsWith('prbat') || code.startsWith('bat') || code.endsWith('btsm')) return true;
    if (desc.includes('battiscopa') || desc.includes('battisc') || desc.includes('batt.') || desc.includes('batt ') || desc.includes('bat.') || desc.includes('bat ')) return true;
    if (desc.startsWith('bat') || desc.startsWith('batt')) return true;
    return false;
};

// 🏷️ BATTISCOPA MAPPING: Genesy → Giobby
// Maps Genesy product descriptions to Giobby codes and descriptions
const BATTISCOPA_MAP = {
    'battiscopa 50x10 ral 9010': {
        code: '97BTSM',
        description: 'PRBAT SM BATTISCOPA 50X10 TANG 9010'
    },
    'battiscopa 50x10 bianco laccato': {
        code: '96BTSM',
        description: 'PRBAT SM BATTISCOPA 50X10 TANG BIANCO'
    },
    'battiscopa 50x10 rovere naturale': {
        code: '98BTSM',
        description: 'PRBAT SM BATTISCOPA 50X10 TANG ROVERE'
    },
    'battiscopa 70x10 ral 9010': {
        code: '100BTSM',
        description: 'PRBAT SM BATTISCOPA 70X10 TANG 9010'
    },
    'battiscopa 70x10 bianco laccato': {
        code: '99BTSM',
        description: 'PRBAT SM BATTISCOPA 70X10 TANG BIANCO'
    },
    'battiscopa 70x10 rovere naturale': {
        code: '119BTSM',
        description: 'PRBAT SM BATTISCOPA 70X10 TANG ROVERE'
    }
};

window.resolveBattiscopaMatch = function (desc, code) {
    desc = (desc || '').trim();
    code = (code || '').trim();
    const dLower = desc.toLowerCase().replace(/\s+/g, ' ');

    // 1. If code matches known BATTISCOPA_MAP or known code directly
    if (code && typeof BATTISCOPA_MAP !== 'undefined') {
        for (const k of Object.keys(BATTISCOPA_MAP)) {
            if (BATTISCOPA_MAP[k].code.toLowerCase() === code.toLowerCase()) {
                return { code: BATTISCOPA_MAP[k].code, description: BATTISCOPA_MAP[k].description };
            }
        }
    }
    if (code && window.db && window.db.getProducts) {
        const prod = window.db.getProducts().find(p => (p.code || '').toLowerCase() === code.toLowerCase());
        if (prod) return { code: prod.code, description: prod.description || prod.code };
    }

    // 2. Exact match in BATTISCOPA_MAP
    if (typeof BATTISCOPA_MAP !== 'undefined' && BATTISCOPA_MAP[dLower]) {
        return { code: BATTISCOPA_MAP[dLower].code, description: BATTISCOPA_MAP[dLower].description };
    }

    // 3. Smart pattern matching for standard battiscopa formats & finishes
    const is50 = dLower.includes('50x10') || dLower.includes('50 x 10') || dLower.includes('50*10') || dLower.includes('5x10') || dLower.includes('5x13') || dLower.includes('50x13');
    const is70 = dLower.includes('70x10') || dLower.includes('70 x 10') || dLower.includes('70*10') || dLower.includes('7x10') || dLower.includes('70x13');
    
    const isRal9010 = dLower.includes('9010') || dLower.includes('ral 9010') || dLower.includes('ral9010');
    const isBianco = dLower.includes('bianco') || dLower.includes('laccato');
    const isRovere = dLower.includes('rovere') || dLower.includes('naturale');

    if (is50) {
        if (isRal9010) return { code: '97BTSM', description: 'PRBAT SM BATTISCOPA 50X10 TANG 9010' };
        if (isBianco) return { code: '96BTSM', description: 'PRBAT SM BATTISCOPA 50X10 TANG BIANCO' };
        if (isRovere) return { code: '98BTSM', description: 'PRBAT SM BATTISCOPA 50X10 TANG ROVERE' };
        return { code: '97BTSM', description: 'PRBAT SM BATTISCOPA 50X10 TANG 9010' };
    }

    if (is70) {
        if (isRal9010) return { code: '100BTSM', description: 'PRBAT SM BATTISCOPA 70X10 TANG 9010' };
        if (isBianco) return { code: '99BTSM', description: 'PRBAT SM BATTISCOPA 70X10 TANG BIANCO' };
        if (isRovere) return { code: '119BTSM', description: 'PRBAT SM BATTISCOPA 70X10 TANG ROVERE' };
        return { code: '100BTSM', description: 'PRBAT SM BATTISCOPA 70X10 TANG 9010' };
    }

    // Check partial key matches in BATTISCOPA_MAP
    if (typeof BATTISCOPA_MAP !== 'undefined') {
        for (const k of Object.keys(BATTISCOPA_MAP)) {
            const kNorm = k.toLowerCase();
            if (dLower.includes(kNorm) || kNorm.includes(dLower.replace('battiscopa ', ''))) {
                return { code: BATTISCOPA_MAP[k].code, description: BATTISCOPA_MAP[k].description };
            }
        }
    }

    // 4. Check matching product in database
    if (window.db && window.db.getProducts) {
        const prods = window.db.getProducts() || [];
        const pMatch = prods.find(p => (p.description || '').toLowerCase() === dLower);
        if (pMatch) return { code: pMatch.code, description: pMatch.description };

        const pPartial = prods.find(p => {
            const pDesc = (p.description || '').toLowerCase();
            return pDesc.includes('battiscopa') && (dLower.includes(pDesc) || pDesc.includes(dLower));
        });
        if (pPartial) return { code: pPartial.code, description: pPartial.description };
    }

    // 5. If no real code matched, return empty code so the cell stays blank
    return { code: '', description: desc };
};






// --- CONFIGURAZIONE SUPABASE ---
// Inizializzata globalmente in supabase-config.js (window.supabase)

document.addEventListener('DOMContentLoaded', () => {
    // Monitoraggio Modifiche Editor
    const editorEl = document.getElementById('quoteEditor');
    if (editorEl) {
        editorEl.addEventListener('input', () => { editorIsDirty = true; });
        editorEl.addEventListener('change', () => { editorIsDirty = true; });
    }

    // LISTENER STAMPA (Ctrl+P) - Aggiorna Titolo per Nome File
    window.addEventListener('beforeprint', () => {
        if (typeof updateDocumentTitle === 'function') updateDocumentTitle();
    });

    // Verifica Stato Auth via Supabase
    if (window.supabase) {
        // Check sessione iniziale
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session && session.user) {
                currentUser = session.user;
                initApp();
            } else if (window.silentAutoLogin && await window.silentAutoLogin()) {
                // Auto-login completato con successo in background
            } else {
                document.getElementById('authView').classList.remove('hidden');
                document.getElementById('appView').classList.add('hidden');
                if (window.prefillLogin) window.prefillLogin();
            }
        });

        // Monitoraggio cambi stato
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                currentUser = session.user;
                initApp();
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
            }
        });
    } else {
        alert(window.localizeError("Errore Critico: Supabase SDK non inizializzato."));
        document.getElementById('authView').classList.remove('hidden');
    }


    // Navigation Logic
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            // Remove active from all
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const target = this.getAttribute('data-target');
            if (target) {
                // Hide all views
                document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

                // Show target
                const view = document.getElementById(target);
                if (view) {
                    view.classList.remove('hidden');
                    view.classList.add('active');
                }

                // Special Actions
                if (target === 'dashboard') updateDashboard();
                if (target === 'quotes') renderQuotesTable();
                if (target === 'clients') renderGenericClientsTable();
                if (target === 'products') {
                    // Reset picking mode if clicked from menu
                    isPickingMode = false;
                    renderProductsTable();
                }

                // Ensure Settings button remains visible (admin check)
                if (window.updateAdminUI) window.updateAdminUI();
            }
        });
    });

});

// --- AUTH & NAVIGATION MOVED TO SEPARATE MODULES ---

// Logica Selettore Prodotti
window.addDocRow = function () {
    isPickingMode = true; // Flag for Products (Legacy/Existing)

    // Passa a Vista Prodotti
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });

    const prodView = document.getElementById('products');
    prodView.classList.remove('hidden');
    prodView.classList.add('active');

    // Highlight nav
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-target="products"]').classList.add('active');

    populateFilterOptions();
    renderProductsTable();
}

window.cancelPicking = function () {
    resumeEditor();
}

// =====================================================
// HELPERS GLOBALI
// =====================================================

/** Sentence case per display (non modifica il DB) */
window.toSentenceCase = (str) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

/** Classi prodotto che attivano la logica Giobby/Parquet */
window.PARQUET_CLASSES = ['A', 'B', 'LAM', 'SPC'];

/**
 * Propone l'aggiunta del sottopavimento in nylon quando il prodotto è SPC.
 * @param {Object} p        - Prodotto appena inserito
 * @param {number} qty      - Quantità della riga
 * @param {number} [insertAfterIndex] - Se fornito usa splice, altrimenti push
 */
window._addNylonIfSpc = function(p, qty, insertAfterIndex) {
    const isSpc = (p.classe || p.category || '').toUpperCase() === 'SPC' ||
                  (p.description || '').toUpperCase().includes('SPC');
    if (!isSpc) return;

    setTimeout(() => {
        if (!confirm(`Hai inserito: ${p.description}.\nVuoi aggiungere anche il SOTTOPAVIMENTO IN NYLON?`)) return;

        const NYLON_CODE = 'SOTBARVAPMY100H50ML100NEX';
        const nylon = db.getProducts().find(x => x.code === NYLON_CODE);
        if (!nylon) { alert('Prodotto nylon non trovato nel registro (cod: ' + NYLON_CODE + ')'); return; }

        const nylonPrice = parseFloat(nylon.priceMax) || parseFloat(nylon.price) || 0;
        const nylonItem = {
            code: nylon.code, description: nylon.description, uom: nylon.uom,
            quantity: qty, unitPrice: nylonPrice,
            priceMin: parseFloat(nylon.priceMin) || 0, priceMax: parseFloat(nylon.priceMax) || 0,
            var1: nylon.var1 || '', var2: nylon.var2 || '', var3: nylon.var3 || '',
            total: nylonPrice * qty
        };

        if (typeof insertAfterIndex === 'number') {
            currentQuote.items.splice(insertAfterIndex + 1, 0, nylonItem);
        } else {
            currentQuote.items.push(nylonItem);
        }

        editorIsDirty = true;
        if (typeof renderEditorState === 'function') renderEditorState();
    }, 600);
};



window.getProductDefaultPrice = function(p) {
    if (!p) return 0;
    const fields = [p.priceMax, p.price, p.priceMin, p.price_max, p.price_min, p.unitPrice, p.prezzo, p.var3];
    for (let f of fields) {
        if (f !== undefined && f !== null && f !== '') {
            let val = 0;
            if (typeof f === 'number') {
                val = f;
            } else if (typeof f === 'string') {
                const clean = f.trim();
                val = clean.includes(',') ? (typeof parseInput === 'function' ? parseInput(clean) : parseFloat(clean.replace(',', '.'))) : parseFloat(clean);
            }
            if (!isNaN(val) && val > 0) {
                return val;
            }
        }
    }
    return 0;
};

window.getProductEffectivePrice = function(p, useMaterialPrice = false) {
    if (!p) return 0;
    if (useMaterialPrice && p.var3 !== undefined && p.var3 !== null && p.var3 !== '') {
        let matPrice = 0;
        if (typeof p.var3 === 'number') {
            matPrice = p.var3;
        } else if (typeof p.var3 === 'string') {
            const clean = p.var3.trim();
            matPrice = clean.includes(',') ? (typeof parseInput === 'function' ? parseInput(clean) : parseFloat(clean.replace(',', '.'))) : parseFloat(clean);
        }
        if (!isNaN(matPrice) && matPrice > 0) {
            return matPrice;
        }
    }
    return window.getProductDefaultPrice(p);
};

function selectProductFromRegistry(id) {
    const products = db.getProducts();
    const p = products.find(x => x.id == id);
    if (!p) return;

    // Usa prezzo solo materiale (var3) se la checkbox globale è spuntata E var3 esiste
    const _useGlobalMat = document.getElementById('checkUseMaterialPrice')?.checked;
    const _isMat = _useGlobalMat && p.var3 && parseFloat(p.var3) > 0;
    const _matPrice = window.getProductEffectivePrice(p, _isMat);
    // AUTO-GIOBBY: classi A, LAM, SPC → isParquet=true, salvo se solo materiale
    const _classeUpS = (p.classe || '').toUpperCase().trim();
    const _autoParquetS = !_isMat && ['A', 'B', 'LAM', 'SPC'].includes(_classeUpS);
    const effectivePriceMax = parseFloat(p.priceMax) || window.getProductDefaultPrice(p);

    currentQuote.items.push({
        code: p.code,
        description: p.description,
        giobby_description: p.giobby_description || '',
        uom: p.uom,
        quantity: 1,
        unitPrice: _matPrice,
        priceMin: parseFloat(p.priceMin) || 0,
        priceMax: effectivePriceMax,
        var1: p.var1,
        var2: p.var2,
        var3: p.var3,
        classe: p.classe || '',
        isMaterialPrice: !!_isMat,
        isParquet: _autoParquetS,
        total: _matPrice
    });

    _addNylonIfSpc(p, currentQuote.items[currentQuote.items.length - 1]?.quantity || 1);

    resumeEditor();
}

window.resumeEditor = function () {
    isPickingMode = false;
    isPickingClientMode = false; // Reset Client Picker

    // Switch to Editor View
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });

    const editor = document.getElementById('quoteEditor');
    editor.classList.remove('hidden');
    editor.classList.add('active');

    // Deseleziona tutti i pulsanti nav poiché siamo in overlay
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    // Force Render - Always call these
    if (typeof renderEditorState === 'function') {
        renderEditorState();
    }

    // Always sync agent display when editor opens
    if (typeof renderAgentSelector === 'function') {
        renderAgentSelector();
    }

}


// --- AGENT LOGIC MOVED TO ui-core.js ---


// --- FILTERS POPULATION ---

window.renderAgentSelector = function () {
    // Delegated to agent-widget-sync.js (Redesigned Module)
    if (window.refreshAgentWidget) {
        window.refreshAgentWidget();
    } else {
        console.warn("Agent Widget Sync module not loaded, using fallback.");
        // Fallback or just do nothing as the sync script should take over
    }
}

// --- POPOLAMENTO LISTE CONDIVISE ---
window.populateSharedLists = function () {
    const vars = db.getProductVars();
    if (!vars) return;

    // Popola Agenti
    const agentSelect = document.getElementById('docAgent');
    if (agentSelect) {
        const current = agentSelect.value;
        // Merge keys from metadata and legacy list if exists
        const metaAgents = vars.agentsMetadata ? Object.keys(vars.agentsMetadata) : [];
        const listAgents = vars.agents || [];
        let allAgents = [...new Set([...metaAgents, ...listAgents])].sort();

        // FILTRO PER UTENTE LOGGATO
        // Se l'utente ha una email che corrisponde a un agente, mostra SOLO quell'agente.
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.email) {
            const userEmail = currentUser.email.toLowerCase().trim();
            // Cerca match nei metadata
            let matchedAgentKey = Object.keys(vars.agentsMetadata || {}).find(key => {
                const meta = vars.agentsMetadata[key];
                return meta && meta.email && meta.email.toLowerCase().trim() === userEmail;
            });

            // FALLBACK: Cerca nella Master List statica (se caricata)
            if (!matchedAgentKey && window.AGENT_MASTER_LIST) {
                matchedAgentKey = Object.keys(window.AGENT_MASTER_LIST).find(key => {
                    const agent = window.AGENT_MASTER_LIST[key];
                    return agent && agent.email && agent.email.toLowerCase().trim() === userEmail;
                });
            }

            if (matchedAgentKey) {
                allAgents = [matchedAgentKey];
            }
        }

        let html = '<option value="">Seleziona...</option>';
        allAgents.forEach(a => {
            html += `<option value="${a}">${a}</option>`;
        });
        agentSelect.innerHTML = html;

        // Auto-select unic option
        if (allAgents.length === 1) {
            agentSelect.value = allAgents[0];
            // Force header update immediately for single option
            setTimeout(() => {
                const nameEl = document.getElementById('docAgentName');
                if (nameEl && agentSelect.value) {
                    nameEl.textContent = agentSelect.value;
                    agentSelect.dispatchEvent(new Event('change'));
                }
            }, 100);
        }

        // Restore value if possible
        if (current && allAgents.includes(current)) {
            agentSelect.value = current;
        }

        // Trigger update of header
        if (typeof renderAgentSelector === 'function') {
            // Force header update logic without full re-bind
            const nameEl = document.getElementById('docAgentName');
            if (nameEl && agentSelect.value) {
                nameEl.textContent = agentSelect.value;
                // Manually trigger change to pull phone/email
                agentSelect.dispatchEvent(new Event('change'));
            }
        }
    }

    // Popola Stato Preventivo nell'Editor
    const statusSelect = document.getElementById('editorStatus');
    if (statusSelect) {
        const statuses = db.getStatuses();
        const currentStatus = statusSelect.value;
        statusSelect.innerHTML = statuses.map(s => `<option value="${s}">${s}</option>`).join('');
        
        // Determina lo stato corretto da impostare (priorità a currentQuote.status se disponibile)
        const targetStatus = (typeof currentQuote !== 'undefined' && currentQuote && currentQuote.status) 
            ? currentQuote.status 
            : (currentStatus || 'Aperto');
            
        if (statuses.includes(targetStatus)) {
            statusSelect.value = targetStatus;
        }
        // Trigger status color update
        if (window.updateEditorStatusUI) {
            window.updateEditorStatusUI();
        }
    }
}

// --- POPOLAMENTO FILTRI ---
function populateFilterOptions() {
    const vars = (db && db.getProductVars) ? db.getProductVars() : {};
    const prods = (db && db.getProducts) ? (db.getProducts() || []) : [];

    // Categories
    const categories = Array.from(new Set(
        prods
            .map(p => (p.category || '').trim())
            .filter(v => v && !v.toLowerCase().includes('abrasiv'))
    )).sort();

    ['filterCat', 'pickCat', 'listCat'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id.startsWith('list')) {
            el.innerHTML = categories.map(v => `<option value="${v}">`).join('');
        } else {
            const current = el.value;
            const defaultLabel = id === 'filterCat' ? 'Collezione: Tutte' : 'Tutti';
            el.innerHTML = [`<option value="">${defaultLabel}</option>`]
                .concat(categories.map(v => `<option value="${v}">${v}</option>`))
                .join('');
            if (current && categories.some(c => c.toLowerCase() === current.toLowerCase())) {
                el.value = current;
            } else {
                el.value = '';
            }
        }
    });

    // Statuses
    if (db && db.getStatuses) {
        const statuses = db.getStatuses();
        const statusEl = document.getElementById('editorStatus');
        if (statusEl) {
            const current = statusEl.value;
            statusEl.innerHTML = statuses.map(s => `<option value="${s}">${s}</option>`).join('');
            if (current && statuses.includes(current)) statusEl.value = current;
        }
    }

    updateDynamicFilters('registry');
    updateDynamicFilters('picker');
}

function updateDynamicFilters(context) {
    const prefix = context === 'registry' ? 'filter' : 'pick';
    const catEl = document.getElementById(prefix + 'Cat');
    if (!catEl) return;

    const selectedCat = (catEl.value || '').trim().toLowerCase();
    let products = (db && db.getProducts) ? (db.getProducts() || []) : [];

    if (selectedCat) {
        products = products.filter(p => (p.category || '').trim().toLowerCase() === selectedCat);
    }

    const getUsedValues = (key) => {
        const set = new Set();
        products.forEach(p => {
            const val = (p[key] || '').toString().trim();
            if (val) set.add(val);
        });
        return Array.from(set).sort();
    };

    const fields = [
        { key: 'essenza', id: prefix + 'Essenza', label: 'Essenza' },
        { key: 'tipo', id: prefix + 'Tipo', label: 'Tipologia' },
        { key: 'var1', id: prefix + 'Var1', label: 'Scelta' },
        { key: 'var2', id: prefix + 'Var2', label: 'Finitura' },
        { key: 'var3', id: prefix + 'Var3', label: 'Formato' }
    ];

    fields.forEach(f => {
        const el = document.getElementById(f.id);
        if (!el) return;

        const currentVal = el.value;
        const availableValues = getUsedValues(f.key);

        el.innerHTML = [`<option value="">${f.label}: Tutte</option>`]
            .concat(availableValues.map(v => `<option value="${v}">${v}</option>`))
            .join('');

        if (currentVal && availableValues.includes(currentVal)) {
            el.value = currentVal;
        } else {
            el.value = '';
        }

        if (availableValues.length > 0) {
            el.classList.add('available');
        } else {
            el.classList.remove('available');
        }
    });
}

function resetProdFilters() {
    ['filterCat', 'filterEssenza', 'filterTipo', 'filterVar1', 'filterVar2', 'filterVar3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const searchEl = document.getElementById('productSearchInput');
    if (searchEl) searchEl.value = '';
    const checkEl = document.getElementById('checkUseMaterialPrice');
    if (checkEl) checkEl.checked = false;
    updateDynamicFilters('registry');
    renderProductsTable();
}

window.addEventListener('genesyCacheRefreshed', () => {
    try {
        if (typeof populateFilterOptions === 'function') populateFilterOptions();
        if (typeof renderProductsTable === 'function') renderProductsTable();
    } catch (e) {
        console.error('Error refreshing products on genesyCacheRefreshed:', e);
    }
});

// --- Dashboard ---
function updateDashboard() {
    // KPI Removed by user request

    // Populate agent filter selects (admin only)
    try { _populateDashAgentSelects(); } catch (e) { }

    // Defer heavy rendering to prevent UI freeze during view switch
    setTimeout(() => {
        // Render Widget 1 (Count)
        try { renderDashboardTrendWidget(); } catch (e) { console.error("Trend Widget Error:", e); }

        // Render Widget 2 (Value)
        try { renderDashboardValueTrendWidget(); } catch (e) { console.error("Value Widget Error:", e); }

        // Restore Calendar & Reminders
        if (typeof renderCalendar === 'function') {
            try { renderCalendar(); } catch (e) { console.error("Calendar Render Error:", e); }
        }
        if (typeof renderRemindersWidget === 'function') {
            try { renderRemindersWidget(); } catch (e) { console.error("Reminders Render Error:", e); }
        }
    }, 10);
}

// Popola le select agente nelle dashboard widget (solo per admin)
function _populateDashAgentSelects() {
    if (!db || !db.isAdmin) return;
    const agents = db.getAgents ? db.getAgents() : [];
    ['dashTrendAgent', 'dashValueAgent'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        // Salva la selezione corrente prima di ricostruire le opzioni
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">Tutti gli agenti</option>';
        agents.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a;
            opt.textContent = a;
            sel.appendChild(opt);
        });
        // Ripristina la selezione precedente se ancora valida
        if (currentVal && agents.includes(currentVal)) sel.value = currentVal;
        sel.closest('.dash-agent-filter').style.display = '';
    });
    // Se la lista è vuota (dati non ancora pronti), ritenta dopo 2s
    if (agents.length === 0) {
        setTimeout(() => { try { _populateDashAgentSelects(); } catch(e){} }, 2000);
    }
}

// Ri-popola la tendina agenti quando i dati vengono aggiornati dal background refresh
if (!window._dashAgentRefreshListenerAdded) {
    window._dashAgentRefreshListenerAdded = true;
    window.addEventListener('genesyCacheRefreshed', () => {
        try { _populateDashAgentSelects(); } catch(e) {}
    });
}

window.renderDashboardTrendWidget = function () {
    // 1. Get Dates
    let startInput = document.getElementById('dashTrendStart');
    let endInput = document.getElementById('dashTrendEnd');

    // Set defaults if empty (Current Year)
    if (!startInput.value) {
        const now = new Date();
        startInput.value = `${now.getFullYear()}-01-01`;
    }
    if (!endInput.value) {
        // Today
        endInput.value = new Date().toISOString().split('T')[0];
    }

    const start = startInput.value;
    const end = endInput.value;
    const agent = document.getElementById('dashTrendAgent') ? document.getElementById('dashTrendAgent').value : '';

    // Use Count Trend instead of Status (Value) Trend
    const data = db.getMonthlyStatusCountTrend(start, end, agent || null);
    const table = document.getElementById('dashboardTrendTable');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';

    // Totals Accumulators
    let totOpen = 0, totClosed = 0, totLost = 0, totGrand = 0;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nessun dato nel periodo</td></tr>';
    } else {
        data.forEach(d => {
            totOpen += d.Aperto || 0;
            totClosed += d.Chiuso || 0;
            totLost += d.Perso || 0;
            totGrand += d.total || 0;

            const conv = d.total > 0 ? Math.round((d.Chiuso / d.total) * 100) : 0;

            tbody.innerHTML += `<tr>
                <td><strong>${d.name}</strong></td>
                <td>${d.Aperto}</td>
                <td style="color:var(--success-color)">${d.Chiuso}</td>
                <td style="color:var(--danger-color)">${d.Perso}</td>
                <td><strong>${d.total}</strong></td>
                <td>${conv}%</td>
            </tr>`;
        });
    }

    // Render Footer Totals
    document.getElementById('dashTrendTotalOpen').textContent = totOpen;
    document.getElementById('dashTrendTotalClosed').textContent = totClosed;
    document.getElementById('dashTrendTotalLost').textContent = totLost;
    document.getElementById('dashTrendTotalGrand').textContent = totGrand;

    const totalConv = totGrand > 0 ? Math.round((totClosed / totGrand) * 100) : 0;
    document.getElementById('dashTrendTotalConv').textContent = totalConv + '%';
}

window.renderDashboardValueTrendWidget = function () {
    // 1. Get Dates
    let startInput = document.getElementById('dashValueStart');
    let endInput = document.getElementById('dashValueEnd');

    // Set defaults if empty (Current Year)
    if (!startInput.value) {
        const now = new Date();
        startInput.value = `${now.getFullYear()}-01-01`;
    }
    if (!endInput.value) {
        // Today
        endInput.value = new Date().toISOString().split('T')[0];
    }

    const start = startInput.value;
    const end = endInput.value;
    const agent = document.getElementById('dashValueAgent') ? document.getElementById('dashValueAgent').value : '';

    // Use Value Trend
    const data = db.getMonthlyStatusTrend(start, end, agent || null);
    const table = document.getElementById('dashboardValueTrendTable');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';

    // Totals Accumulators
    let totOpen = 0, totClosed = 0, totLost = 0, totGrand = 0;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nessun dato nel periodo</td></tr>';
    } else {
        data.forEach(d => {
            totOpen += d.Aperto || 0;
            totClosed += d.Chiuso || 0;
            totLost += d.Perso || 0;
            totGrand += d.total || 0;

            tbody.innerHTML += `<tr>
                <td><strong>${d.name}</strong></td>
                <td>${formatCurrency(d.Aperto)} €</td>
                <td style="color:var(--success-color)">${formatCurrency(d.Chiuso)} €</td>
                <td style="color:var(--danger-color)">${formatCurrency(d.Perso)} €</td>
                <td><strong>${formatCurrency(d.total)} €</strong></td>
            </tr>`;
        });
    }

    // Render Footer Totals
    document.getElementById('dashValueTotalOpen').textContent = formatCurrency(totOpen) + ' €';
    document.getElementById('dashValueTotalClosed').textContent = formatCurrency(totClosed) + ' €';
    document.getElementById('dashValueTotalLost').textContent = formatCurrency(totLost) + ' €';
    document.getElementById('dashValueTotalGrand').textContent = formatCurrency(totGrand) + ' €';
}

window.renderCalendar = function () {
    try {
        const headerEl = document.getElementById('calendarHeader');
        const gridEl = document.getElementById('calendarGrid');

        if (!headerEl || !gridEl) {
            console.error("Calendar elements not found");
            return;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        // Month Name
        const monthName = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(now);
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        headerEl.innerHTML = `
            <h2 style="font-size: 1.5rem; color: var(--primary-dark); margin-bottom: 0.5rem;">${capitalizedMonth}</h2>
        `;

        gridEl.innerHTML = '';

        // Day Names
        const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
        dayNames.forEach(d => {
            const div = document.createElement('div');
            div.className = 'cal-day-name';
            div.textContent = d;
            gridEl.appendChild(div);
        });

        // Days Calc
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        let startCol = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Empty cells
        for (let i = 0; i < startCol; i++) {
            const div = document.createElement('div');
            div.className = 'cal-day empty';
            gridEl.appendChild(div);
        }

        // Days
        const today = now.getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const div = document.createElement('div');
            div.className = 'cal-day';
            if (i === today) div.classList.add('today');
            div.textContent = i;
            gridEl.appendChild(div);
        }

        // Daily Quote
        if (typeof renderDailyQuote === 'function') {
            try {
                renderDailyQuote();
            } catch (e) {
                console.warn("Daily Quote Error ignore:", e);
            }
        } else {
            console.warn("renderDailyQuote not found");
        }

    } catch (err) {
        console.error("Error rendering calendar:", err);
    }
}

function renderDailyQuote() {
    let quotes = [];
    if (typeof db !== 'undefined' && db.static && db.static.dailyQuotes) {
        quotes = db.static.dailyQuotes;
    }

    // Default Quotes if DB missing
    if (!quotes || quotes.length === 0) {
        quotes = [
            { text: "L'unico modo per fare un ottimo lavoro è amare quello che fai.", author: "Steve Jobs" },
            { text: "Non aspettare. Il momento non sarà mai quello giusto.", author: "Napoleon Hill" }
        ];
    }

    // Randomize on every load
    const quoteIndex = Math.floor(Math.random() * quotes.length);
    const quote = quotes[quoteIndex];

    const container = document.getElementById('dailyQuote');
    if (container) {
        container.innerHTML = `
            <p class="quote-text" style="animation:fadeIn 1s">"${quote.text}"</p>
            <p class="quote-author">- ${quote.author}</p>
        `;
    } else {
        console.warn("dailyQuote container not found");
    }
}


window.runTestSeed = async function () {
    if (confirm('Generare 15 preventivi di test con date e stati casuali?')) {
        try {
            const count = await db.seedTestQuotes();
            alert(`${count} preventivi e 5 clienti generati! Ricarico la pagina...`);
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Errore generazione test: " + window.localizeError(e));
        }
    }
}

// --- Registries: Clients ---
let isPickingClientMode = false;

window.renderGenericClientsTable = function () {
    const search = document.getElementById('clientSearchInput') ? document.getElementById('clientSearchInput').value : '';
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return; // tabella non presente nel DOM corrente

    // UI Adjustments for Picker Mode
    const headerActions = document.querySelector('#clients .header-actions');
    const btnBulkDelete = document.getElementById('btnBulkDeleteClients');
    const btnBulkCopy = document.getElementById('btnBulkCopyClients');
    if (isPickingClientMode) {
        // In picker mode: hide ONLY the bulk action buttons, keep "Nuovo Cliente" visible
        if (btnBulkDelete) btnBulkDelete.style.display = 'none';
        if (btnBulkCopy) btnBulkCopy.style.display = 'none';
        if (headerActions) headerActions.classList.remove('hidden');
    } else {
        if (headerActions) headerActions.classList.remove('hidden');
    }

    const clients = db.getClients(search) || [];

    // --- Derivazione Agente da Preventivi ---
    // Costruisce mappa clientId -> agente più frequente
    const clientAgentMap = {};
    const allQuotes = db.getAllQuotes ? db.getAllQuotes() : [];
    allQuotes.forEach(q => {
        if (!q.agent || !q.customer) return;
        const cid = (q.customer && q.customer.id) ? q.customer.id : null;
        if (!cid) return;
        if (!clientAgentMap[cid]) clientAgentMap[cid] = {};
        clientAgentMap[cid][q.agent] = (clientAgentMap[cid][q.agent] || 0) + 1;
    });
    // Resolve: prendi l'agente col conteggio più alto per ogni cliente
    const getClientAgent = (clientId) => {
        const counts = clientAgentMap[clientId];
        if (!counts) return '';
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    };

    // Costruisce tutto l'HTML in una stringa, poi scrive sul DOM UNA SOLA VOLTA
    // (evita il re-reflow del browser ad ogni riga)
    let rowsHtml = '';
    clients.forEach(c => {
        let actionsHtml = '';

        // Giobby sync status — must be declared BEFORE actionsHtml (used in button title/style)
        const hasGiobbyId = c.giobbyContactId && String(c.giobbyContactId).length > 20;
        const giobbyBadge = hasGiobbyId
            ? `<span title="Sincronizzato su Giobby (${c.idCustomer || '?'})" style="color:#10b981;font-size:0.75rem;">● Giobby</span>`
            : `<span title="Non ancora sincronizzato su Giobby" style="color:#9ca3af;font-size:0.75rem;">○ Giobby</span>`;

        if (isPickingClientMode) {
            actionsHtml = `
             <button class="btn-primary btn-sm" onclick="pickClientFromRegistry('${c.id}')">
                SELEZIONA
             </button>
             `;
        } else {
            actionsHtml = `
                <div class="actions-cell">
                    <button class="btn-action-icon" onclick="openClientModal('${c.id}')" title="Modifica Cliente"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-action-icon" onclick="if(window.CRM) window.CRM.open('${c.id}'); else alert('Modulo CRM non caricato');" title="Dashboard Cliente" style="color:#8b5cf6;position:relative;"><i class="fa-solid fa-user"></i><span style="position:absolute;bottom:2px;right:1px;font-size:6px;font-weight:700;color:#fff;background:#8b5cf6;border-radius:2px;padding:0px 3px;line-height:1.5;letter-spacing:0.03em;pointer-events:none;white-space:nowrap;">CRM</span></button>
                    <button class="btn-action-icon" onclick="manualSyncClientToGiobby('${c.id}', this)" title="${hasGiobbyId ? 'Aggiorna dati su Giobby' : 'Sincronizza su Giobby'}" style="color:${hasGiobbyId ? '#10b981' : '#f97316'};position:relative;"><i class="fa-solid fa-cloud-arrow-up"></i><span style="position:absolute;bottom:2px;right:1px;font-size:6px;font-weight:700;color:#fff;background:${hasGiobbyId ? '#10b981' : '#f97316'};border-radius:2px;padding:0px 2px;line-height:1.5;pointer-events:none;">G</span></button>
                    <button class="btn-action-icon" onclick="sendClientToGoogleSheetFromList('${c.id}')" title="Invia a Google Sheet" style="color:#15803d;"><i class="fa-solid fa-table"></i></button>
                    <button class="btn-action-icon" onclick="deleteClient('${c.id}')" title="Elimina Cliente" style="color:#ef4444;"><i class="fa-solid fa-trash"></i></button>
                </div>
             `;
        }

        const rowClickAction = isPickingClientMode ? `pickClientFromRegistry('${c.id}')` : `openClientModal('${c.id}')`;
        const agentName = getClientAgent(c.id);
        const agentCell = agentName || '<span class="text-muted">—</span>';

        rowsHtml += `<tr ondblclick="${rowClickAction}" style="cursor: pointer;">
            <td><input type="checkbox" class="client-check" value="${c.id}" onchange="updateClientDelButton()"></td>
            <td><strong style="color:#2c3e50;">${c.name} ${c.surname || ''}</strong><br>${giobbyBadge}</td>
            <td>
                ${c.address || ''}<br>
                <small class="text-muted">
                    ${[c.zip, c.city, c.addressProvince ? '(' + c.addressProvince + ')' : ''].filter(Boolean).join(' ')}
                </small>
            </td>
            <td>${c.email || '-'}<br>${c.phone || '-'}</td>
            <td>${agentCell}</td>
            <td>
                ${actionsHtml}
            </td>
        </tr>`;
    });
    tbody.innerHTML = rowsHtml;


    // Inject Cancel Button for Picker Mode (Runtime check)
    const container = document.querySelector('#clients .view-header');
    let cancelBtn = document.getElementById('btnCancelClientPick');
    if (isPickingClientMode) {
        if (!cancelBtn && container) {
            cancelBtn = document.createElement('button');
            cancelBtn.id = 'btnCancelClientPick';
            cancelBtn.className = 'btn-secondary';
            cancelBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Annulla (Torna al Preventivo)';
            cancelBtn.onclick = resumeEditor;
            cancelBtn.style.marginTop = '10px';
            container.appendChild(cancelBtn);
        }
    } else {
        if (cancelBtn) cancelBtn.remove();
    }
}

window.pickClientFromRegistry = function (id) {
    const clients = db.getClients();
    // String comparison
    const c = clients.find(x => x.id.toString() === id.toString());
    if (c) {
        if (!currentQuote) {
            console.error("No current quote active!");
            return;
        }
        // Create a deep copy to prevent mutating the Registry object
        currentQuote.customer = JSON.parse(JSON.stringify(c));
        // Sync: Client -> Quote (Referente Cantiere & Referente Contatto)
        if (c.contactPerson) currentQuote.siteContactName = c.contactPerson;
        if (c.origin) currentQuote.siteContactReference = c.origin;

        alert(`Cliente selezionato: ${c.name}`);
        resumeEditor();
    } else {
        alert("Errore: Cliente non trovato.");
    }
}

window.toggleSelectAllClients = function (source) {
    const checkboxes = document.querySelectorAll('#clientsTableBody input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = source.checked);

    // Update buttons
    const checkedCount = source.checked ? checkboxes.length : 0;
    const btnDel = document.getElementById('btnBulkDeleteClients');
    const btnCopy = document.getElementById('btnBulkCopyClients');
    const countSpan = document.getElementById('countDelClients');
    const countCopySpan = document.getElementById('countCopyClients');

    if (checkedCount > 0) {
        if (btnDel) { btnDel.style.display = 'inline-flex'; }
        if (btnCopy) { btnCopy.style.display = 'inline-flex'; }
        if (countSpan) countSpan.textContent = checkedCount;
        if (countCopySpan) countCopySpan.textContent = checkedCount;
    } else {
        if (btnDel) btnDel.style.display = 'none';
        if (btnCopy) btnCopy.style.display = 'none';
    }
};

async function deleteSelectedClients() {
    const checks = document.querySelectorAll('.client-check:checked');
    if (checks.length === 0) return;

    if (!confirm(`Sei sicuro di voler eliminare ${checks.length} clienti?`)) return;

    for (const c of checks) {
        await db.deleteClient(c.value);
    }
    renderGenericClientsTable();
    updateClientDelButton(); // Hide button
}

window.deleteClient = async function (id) {
    if (!confirm("Sei sicuro di voler eliminare questo cliente?")) return;
    try {
        await db.deleteClient(id);
        renderGenericClientsTable();
    } catch (e) {
        console.error(e);
        alert("Errore durante l'eliminazione: " + window.localizeError(e));
    }
};

window.appendToExcelMaster = async function (id) {
    // 1. Get Client Data
    const clients = db.getClients();
    const client = clients.find(c => c.id.toString() === id.toString());

    if (!client) {
        alert("Cliente non trovato!");
        return;
    }

    if (!window.showOpenFilePicker) {
        alert("Il tuo browser non supporta il salvataggio diretto su file esistenti (File System Access API). Usa Chrome, Edge o Opera su Desktop.");
        return;
    }

    try {
        // 2. Open File Picker
        const [fileHandle] = await window.showOpenFilePicker({
            types: [{
                description: 'Excel Files',
                accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xls'] }
            }],
            multiple: false
        });

        // 3. Read File
        const file = await fileHandle.getFile();
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);

        if (!workbook.SheetNames.length) {
            throw new Error("Il file Excel sembra vuoto o non valido.");
        }

        // 4. Get First Sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // 5. Convert to JSON
        let rows = XLSX.utils.sheet_to_json(worksheet);

        // Map Data
        const newRow = {
            "Ragione Sociale / Nome": client.name,
            "Indirizzo": client.address,
            "Città": client.city,
            "CAP": client.zip,
            "Provincia": client.addressProvince,
            "Stato/Regione": client.state,
            "Nazione": client.country,
            "Email": client.email,
            "PEC": client.pec,
            "Tel. Ufficio": client.phone_office,
            "Tel. Abitazione": client.phone_home,
            "Cellulare": client.mobile,
            "Fax": client.fax,
            "Partita IVA": client.vat,
            "Codice Fiscale": client.fiscal_code,
            "Codice SDI": client.sdi,
            "Origine Contatto": client.origin,
            "Data Export": new Date().toLocaleDateString('it-IT')
        };

        // Check duplicazione (opzionale) - basata su ID o Nome?
        // Per ora aggiungiamo sempre, l'utente può gestire i duplicati in Excel.
        rows.push(newRow);

        // 7. Write Back
        const newWorksheet = XLSX.utils.json_to_sheet(rows);
        const newWorkbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, firstSheetName);

        const newData = XLSX.write(newWorkbook, { type: 'array', bookType: 'xlsx' });

        // Create Writable Stream
        const writable = await fileHandle.createWritable();
        await writable.write(newData);
        await writable.close();

        alert("✅ Cliente aggiunto con successo al file Master!");

    } catch (err) {
        if (err.name === 'AbortError') {
            // User cancelled, do nothing
            return;
        }
        console.error("Errore aggiunta Excel:", err);
        alert("❌ Errore durante l'operazione: " + err.message);
    }
};

window.exportClientFromTable = function (id) {
    const clients = db.getClients();
    const client = clients.find(c => c.id.toString() === id.toString());

    if (!client) {
        alert("Cliente non trovato!");
        return;
    }

    // Reuse/Create logic similar to modal export but from object
    const exportData = [
        {
            "Ragione Sociale / Nome": client.name,
            "Indirizzo": client.address,
            "Città": client.city,
            "CAP": client.zip,
            "Provincia": client.addressProvince,
            "Stato/Regione": client.state,
            "Nazione": client.country,
            "Email": client.email,
            "PEC": client.pec,
            "Tel. Ufficio": client.phone_office,
            "Tel. Abitazione": client.phone_home,
            "Cellulare": client.mobile,
            "Fax": client.fax,
            "Partita IVA": client.vat,
            "Codice Fiscale": client.fiscal_code,
            "Codice SDI": client.sdi,
            "Origine Contatto": client.origin,
            "Data Export": new Date().toLocaleDateString('it-IT')
        }
    ];

    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wscols = Object.keys(exportData[0]).map(k => ({ wch: k.length + 10 }));
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Scheda Cliente");
        const safeName = (client.name || 'Cliente').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        XLSX.writeFile(wb, `Cliente_${safeName}.xlsx`);
    } catch (e) {
        console.error("Errore Export Excel:", e);
        alert("Errore Export: " + e.message);
    }
};

window.exportClientToExcelFromModal = function () {
    // 1. Raccogli i dati dal form modale
    const formData = {
        name: document.getElementById('newClientName').value,
        address: document.getElementById('newClientAddress').value,
        city: document.getElementById('newClientCity').value,
        zip: document.getElementById('newClientZip').value,
        province: document.getElementById('newClientAddressProvince').value,
        state: document.getElementById('newClientState').value,
        country: document.getElementById('newClientCountry').value,
        email: document.getElementById('newClientEmail').value,
        pec: document.getElementById('newClientPec').value,
        phoneOffice: document.getElementById('newClientPhoneOffice').value,
        phoneHome: document.getElementById('newClientPhoneHome').value,
        mobile: document.getElementById('newClientMobile').value,
        fax: document.getElementById('newClientFax').value,
        vat: document.getElementById('newClientVat').value,
        fiscalCode: document.getElementById('newClientFiscalCode').value,
        sdi: document.getElementById('newClientSdi').value,
        origin: document.getElementById('newClientOrigin').value
    };

    if (!formData.name) {
        alert("Inserisci almeno il Nome/Ragione Sociale per esportare.");
        return;
    }

    // 2. Mappa i dati in formato Array per Excel (Colonne Italiane)
    const exportData = [
        {
            "Ragione Sociale / Nome": formData.name,
            "Indirizzo": formData.address,
            "Città": formData.city,
            "CAP": formData.zip,
            "Provincia": formData.province,
            "Stato/Regione": formData.state,
            "Nazione": formData.country,
            "Email": formData.email,
            "PEC": formData.pec,
            "Tel. Ufficio": formData.phoneOffice,
            "Tel. Abitazione": formData.phoneHome,
            "Cellulare": formData.mobile,
            "Fax": formData.fax,
            "Partita IVA": formData.vat,
            "Codice Fiscale": formData.fiscalCode,
            "Codice SDI": formData.sdi,
            "Origine Contatto": formData.origin,
            "Data Export": new Date().toLocaleDateString('it-IT')
        }
    ];

    // 3. Genera Workbook e Worksheet
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);

        // Auto-width colonne (stima semplice)
        const wscols = Object.keys(exportData[0]).map(k => ({ wch: k.length + 10 }));
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Scheda Cliente");

        // 4. Download file
        const safeName = formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        XLSX.writeFile(wb, `Cliente_${safeName}.xlsx`);

    } catch (e) {
        console.error("Errore Export Excel:", e);
        alert("Errore durante la creazione del file Excel: " + e.message);
    }
};


// --- Registries: Products ---
function renderProductsTable() {
    try {
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? (el.value || '').trim() : '';
        };

        const cat = getVal('filterCat').toLowerCase();
        const essenza = getVal('filterEssenza').toLowerCase();
        const tipo = getVal('filterTipo').toLowerCase();
        const v1 = getVal('filterVar1').toLowerCase();
        const v2 = getVal('filterVar2').toLowerCase();
        const v3 = getVal('filterVar3').toLowerCase();
        const searchInput = document.getElementById('productSearchInput');
        const searchText = searchInput ? (searchInput.value || '').trim().toLowerCase() : '';

        let products = (db && db.getProducts) ? (db.getProducts() || []) : [];

        // Nasconde categorie abrasivi dalla lista
        products = products.filter(p => !(p.category || '').toLowerCase().includes('abrasiv'));

        // Prioritize Search
        if (searchText) {
            const tokens = searchText.split(/\s+/).filter(t => t.length > 0);
            products = products.filter(p => {
                const searchString = [
                    p.code || '',
                    p.description || '',
                    p.category || '',
                    p.essenza || '',
                    p.tipo || '',
                    p.var1 || '',
                    p.var2 || '',
                    p.var3 || '',
                    p.classe || '',
                    p.uom || ''
                ].join(' ').toLowerCase();
                return tokens.every(token => searchString.includes(token));
            });
        }

        if (cat) products = products.filter(p => (p.category || '').trim().toLowerCase() === cat);
        if (essenza) products = products.filter(p => (p.essenza || '').trim().toLowerCase() === essenza);
        if (tipo) products = products.filter(p => (p.tipo || '').trim().toLowerCase() === tipo);
        if (v1) products = products.filter(p => (p.var1 || '').trim().toLowerCase() === v1);
        if (v2) products = products.filter(p => (p.var2 || '').trim().toLowerCase() === v2);
        if (v3) products = products.filter(p => (p.var3 || '').trim().toLowerCase() === v3);

        // Update active class on filter elements
        ['filterCat', 'filterVar3', 'filterEssenza', 'filterVar1', 'filterVar2', 'filterTipo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.value) el.classList.add('active');
                else el.classList.remove('active');
            }
        });

        // Picking Mode UI adjustments
        const headerActions = document.querySelector('#products .header-actions');
        const pickingActions = document.getElementById('pickingActions');

        if (typeof isPickingMode !== 'undefined' && isPickingMode) {
            if (headerActions) headerActions.classList.add('hidden');
            if (pickingActions) pickingActions.classList.remove('hidden');
        } else {
            if (headerActions) headerActions.classList.remove('hidden');
            if (pickingActions) pickingActions.classList.add('hidden');
        }

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:20px; color:#64748b;">Nessun prodotto trovato con i filtri selezionati</td></tr>';
            return;
        }

        const showMatCol = document.getElementById('checkUseMaterialPrice')?.checked;

        let rowsHtml = '';
        products.forEach(p => {
            let actionsHtml = `<button class="btn-icon" onclick="openProductModal('${p.id}')" title="Modifica"><i class="fa-solid fa-pen"></i></button>`;

            const descText = window.toSentenceCase ? window.toSentenceCase(p.description || '') : (p.description || '');

            rowsHtml += `<tr>
                <td><input type="checkbox" class="prod-check" value="${p.id}" onchange="updateDelButton()"></td>
                <td>${p.code || '-'}</td>
                <td>${descText}</td>
                <td>${p.uom || '-'}</td>
                <td><small>${p.priceMin != null && p.priceMin !== '' ? formatCurrency(p.priceMin) + ' €' : '<span style="color:#ccc">—</span>'}</small></td>
                <td><small>${p.priceMax != null && p.priceMax !== '' ? formatCurrency(p.priceMax) + ' €' : '<span style="color:#ccc">—</span>'}</small></td>
                <td>${p.classe ? `<span style="background:#e0f2fe;color:#0369a1;border-radius:4px;padding:1px 6px;font-size:0.78em;font-weight:700;">${p.classe}</span>` : '<span style="color:#ccc">—</span>'}</td>
                <td>${actionsHtml}</td>
            </tr>`;
        });
        tbody.innerHTML = rowsHtml;
    } catch (e) {
        console.error("Error in renderProductsTable:", e);
    }
}

window.toggleProductMaterialPrice = async function (id) {
    const products = db.getProducts();
    const p = products.find(x => x.id.toString() === id.toString());
    if (!p) return;
    p.useProductPrice = !p.useProductPrice;
    try {
        await db.saveProduct(p);
        renderProductsTable();
    } catch (e) {
        alert('Errore salvataggio: ' + window.localizeError(e));
    }
};

// Bulk Delete Logic
function toggleSelectAllProds(el) {
    document.querySelectorAll('.prod-check').forEach(c => c.checked = el.checked);
    updateDelButton();
}

function updateDelButton() {
    const checked = document.querySelectorAll('.prod-check:checked').length;

    // Deletion Button (Standard Mode)
    const btnDel = document.getElementById('btnBulkDeleteProd');
    const spanDel = document.getElementById('countDelProd');

    // Picking Button (Picking Mode)
    const btnPick = document.getElementById('btnAddSelectedProd');
    const spanPick = document.getElementById('countPickProd');

    if (isPickingMode) {
        if (btnDel) btnDel.style.display = 'none'; // Ensure delete is hidden

        if (btnPick) {
            if (checked > 0) {
                btnPick.classList.remove('hidden');
                if (spanPick) spanPick.textContent = checked;
            } else {
                btnPick.classList.add('hidden');
            }
        }
    } else {
        if (btnPick) btnPick.classList.add('hidden'); // Ensure pick is hidden

        if (btnDel) {
            if (checked > 0) {
                btnDel.style.display = 'inline-flex';
                if (spanDel) spanDel.textContent = checked;
            } else {
                btnDel.style.display = 'none';
            }
        }
    }
}

window.openProductModal = function (id = null) {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('formProduct');

    if (!modal || !form) {
        console.error("Product modal or form not found");
        return;
    }

    // Reset form
    form.reset();

    if (id) {
        // Edit mode
        const products = db.getProducts();
        const product = products.find(p => p.id.toString() === id.toString());

        if (product) {
            // Populate form fields
            Object.keys(product).forEach(key => {
                const input = form.elements[key];
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = !!product[key];
                    } else {
                        input.value = product[key] || '';
                    }
                }
            });
        }
    }

    // Show modal
    modal.classList.remove('hidden');

    // Show edit view
    const editView = document.getElementById('prodModeEdit');
    if (editView) editView.classList.remove('hidden');
};

window.saveProductForm = async function () {
    const form = document.getElementById('formProduct');
    if (!form) {
        console.error("DEBUG: formProduct not found");
        return;
    }

    // 1. Validation
    const code = form.elements.code ? form.elements.code.value.trim() : "";
    const desc = form.elements.description ? form.elements.description.value.trim() : "";

    if (!code || !desc) {
        alert("⚠️ Codice e Descrizione sono obbligatori.");
        return;
    }

    // 2. Data Collection
    const productData = {
        id: form.elements.id.value || ('P-' + Date.now()),
        code: code,
        category: form.elements.category ? form.elements.category.value : "",
        description: desc,
        uom: form.elements.uom ? form.elements.uom.value : "mq",
        classe: form.elements.classe ? (form.elements.classe.value || null) : null,
        priceMin: parseFloat(form.elements.priceMin ? form.elements.priceMin.value : 0) || 0,
        priceMax: parseFloat(form.elements.priceMax ? form.elements.priceMax.value : 0) || 0,
        useProductPrice: form.elements.useProductPrice ? form.elements.useProductPrice.checked : false,
        giobby_description: form.elements.giobby_description ? form.elements.giobby_description.value.trim() : "",
        essenza: form.elements.essenza ? form.elements.essenza.value : "",
        tipo: form.elements.tipo ? form.elements.tipo.value : "",
        var1: form.elements.var1 ? form.elements.var1.value : "",
        var2: form.elements.var2 ? form.elements.var2.value : "",
        var3: parseFloat(form.elements.var3 ? form.elements.var3.value : 0) || 0
    };

    try {
        // 3. Database Save
        await db.saveProduct(productData);

        // 4. Live update in real time
        if (window._lastEditedProductRowIndex !== undefined && window._lastEditedProductRowIndex !== null) {
            if (typeof pickProductForRow === 'function') {
                pickProductForRow(window._lastEditedProductRowIndex, productData.id);
            }
            window._lastEditedProductRowIndex = null;
        }

        if (typeof currentQuote !== 'undefined' && currentQuote && currentQuote.items) {
            let updatedAny = false;
            currentQuote.items.forEach(item => {
                if (item.code && (item.code === productData.code || item.id === productData.id)) {
                    const useMat = document.getElementById('checkUseMaterialPrice')?.checked;
                    const isMat = useMat && productData.var3 && parseFloat(productData.var3) > 0;
                    const price = window.getProductEffectivePrice ? window.getProductEffectivePrice(productData, isMat) : (parseFloat(productData.priceMin) || 0);
                    item.description = productData.description || item.description;
                    item.giobby_description = productData.giobby_description || item.giobby_description;
                    item.uom = productData.uom || item.uom;
                    item.unitPrice = price;
                    item.priceMin = parseFloat(productData.priceMin) || 0;
                    item.priceMax = parseFloat(productData.priceMax) || price;
                    item.var1 = productData.var1 || '';
                    item.var2 = productData.var2 || '';
                    item.var3 = productData.var3 || '';
                    item.classe = productData.classe || '';
                    item.total = (item.quantity || 1) * price;
                    updatedAny = true;
                }
            });
            if (updatedAny && typeof renderItems === 'function') {
                renderItems();
                if (typeof calculateTotals === 'function') calculateTotals();
            }
        }

        // 5. Cleanup
        const modal = document.getElementById('productModal');
        if (modal) {
            modal.classList.add('hidden');
        } else if (typeof closeModal === 'function') {
            closeModal('productModal');
        }
        if (typeof renderProductsTable === 'function') {
            renderProductsTable();
        }

    } catch (e) {
        console.error("CRITICAL ERROR in saveProductForm:", e);
        alert("❌ Errore durante il salvataggio: " + window.localizeError(e));
    }
};

window.fetchGiobbyDescriptionForCurrentProduct = async function (btnElement) {
    const form = document.getElementById('formProduct');
    const code = form.elements.code ? form.elements.code.value.trim() : "";
    
    if (!code) {
        alert("⚠️ Inserisci prima un Codice prodotto valido a sinistra.");
        return;
    }

    const jsonConfig = localStorage.getItem('giobbyConfig');
    if (!jsonConfig) {
        alert("Configurazione Giobby mancante! Vai in Impostazioni e salvala.");
        return;
    }
    const config = JSON.parse(jsonConfig);

    // Salva lo stato del pulsante
    const originalHtml = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnElement.disabled = true;

    try {
        if (!window.searchGiobbyProduct) {
            throw new Error("Funzionalità di ricerca Giobby non disponibile p.v.m.");
        }
        
        const result = await window.searchGiobbyProduct(config, code);
        
        if (result && result.description) {
            form.elements.giobby_description.value = result.description;
            
            // Feedback visivo "Verde"
            const inputField = form.elements.giobby_description;
            inputField.style.backgroundColor = '#f0fdf4';
            inputField.style.borderColor = '#10b981';
            
            setTimeout(() => {
                inputField.style.backgroundColor = '';
                inputField.style.borderColor = '';
            }, 1000);
            
        } else {
            alert(`Nessun prodotto trovato su Giobby con il codice "${code}".\nAssicurati che il codice coincida esattamente.`);
        }
    } catch (e) {
        console.error(e);
        alert("Errore durante la ricerca su Giobby: " + e.message);
    } finally {
        btnElement.innerHTML = originalHtml;
        btnElement.disabled = false;
    }
};

window.addSelectedProductsFromRegistry = function () {
    // FIX: IDs are strings (timestamps), do NOT parse as Int
    const checked = Array.from(document.querySelectorAll('.prod-check:checked')).map(c => c.value);
    if (checked.length === 0) {
        alert("Nessun prodotto selezionato.");
        return;
    }

    const products = db.getProducts();
    let countData = 0;

    const useMaterialPrice = document.getElementById('checkUseMaterialPrice').checked;

    checked.forEach(id => {
        // Strict string comparison
        const p = products.find(x => x.id.toString() === id.toString());
        if (p) {

            // Determine Price robustly across all price fields
            let chosenPrice = window.getProductEffectivePrice(p, useMaterialPrice);

            // Console debug for price selection

            if (useMaterialPrice) {
                // User explicitly requested "Prezzo Campo Materiale" (mapped to var3)
                if (p.var3 !== undefined && p.var3 !== null && p.var3 !== '') {
                    let matPrice = 0;
                    if (typeof p.var3 === 'number') {
                        matPrice = p.var3;
                    } else if (typeof p.var3 === 'string') {
                        if (p.var3.includes(',')) matPrice = parseInput(p.var3);
                        else matPrice = parseFloat(p.var3);
                    }

                    if (!isNaN(matPrice) && matPrice > 0) {
                        chosenPrice = matPrice;
                    }
                }
            }

            // Flag per-prodotto: forza var3 (Prezzo solo materiale) se useProductPrice attivo
            if (p.useProductPrice && p.var3) {
                const matP = parseFloat(p.var3);
                if (!isNaN(matP) && matP > 0) chosenPrice = matP;
            }

            // isMaterialPrice: vera se useMaterialPrice globale o checkbox toolbar è spuntata e var3 esiste
            const _globalMatChk = document.getElementById('checkUseMaterialPrice')?.checked;
            const _isMat = (useMaterialPrice || _globalMatChk) && p.var3 && parseFloat(p.var3) > 0;

            // AUTO-GIOBBY: classi A, LAM, SPC → isParquet=true, salvo se solo materiale
            const _classeUp = (p.classe || '').toUpperCase().trim();
            const _autoParquet = !_isMat && ['A', 'B', 'LAM', 'SPC'].includes(_classeUp);

            currentQuote.items.push({
                code: p.code,
                description: p.description,
                giobby_description: p.giobby_description || '',
                uom: p.uom,
                quantity: 1,
                unitPrice: chosenPrice,
                priceMin: parseFloat(p.priceMin) || 0,
                priceMax: parseFloat(p.priceMax) || 0,
                var1: p.var1 || '',
                var2: p.var2 || '',
                var3: p.var3 || '',
                classe: p.classe || '',
                isMaterialPrice: !!_isMat,
                isParquet: _autoParquet,
                total: chosenPrice
            });
            countData++;

            // AUTO-PRESET SCOPE CHECKBOXES per prezzo 'solo materiale'
            if (_isMat) {
                // Lascia solo 'Fornitura' spuntata, togli tutte le altre
                currentQuote.inclusions = ['Fornitura'];
                setTimeout(() => {
                    const scopeContainer = document.getElementById('scopeCheckboxes');
                    if (scopeContainer) {
                        scopeContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                            cb.checked = (cb.value === 'Fornitura');
                            if (cb.parentElement) {
                                if (cb.checked) cb.parentElement.classList.remove('no-print');
                                else cb.parentElement.classList.add('no-print');
                            }
                        });
                        if (typeof updateClosingWithScope === 'function') updateClosingWithScope();
                    }
                }, 200);
            }

            // CHECK LAMINATO AUTO-ADD for Catalog Items
            if (p.description && p.description.toUpperCase().includes("LAMINATO")) {
                // Defer prompt to allow UI to render the new row first
                setTimeout(() => {
                    if (confirm(`Hai inserito: ${p.description}.\nVuoi visualizzare i materassini (SOTTOPAVIMENTO)?`)) {
                        if (typeof openCategoryView === 'function') {
                            openCategoryView("SOTTOPAVIMENTO");
                        }
                    }
                }, 500);
            }

            // CHECK SPC AUTO-ADD NYLON UNDERLAY
            const _isSpc = (p.classe || p.category || '').toUpperCase() === 'SPC' ||
                           (p.description || '').toUpperCase().includes('SPC');
            if (_isSpc) {
                const _spcQty = 1; // quantità default al momento dell'inserimento
                setTimeout(() => {
                    if (confirm(`Hai inserito: ${p.description}.\nVuoi aggiungere anche il SOTTOPAVIMENTO IN NYLON?`)) {
                        const _nylonCode = 'SOTBARVAPMY100H50ML100NEX';
                        const _allProds = db.getProducts();
                        const _nylon = _allProds.find(x => x.code === _nylonCode);
                        if (_nylon) {
                            const _nylonPrice = parseFloat(_nylon.priceMax) || parseFloat(_nylon.price) || 0;
                            currentQuote.items.push({
                                code: _nylon.code,
                                description: _nylon.description,
                                uom: _nylon.uom,
                                quantity: _spcQty,
                                unitPrice: _nylonPrice,
                                priceMin: parseFloat(_nylon.priceMin) || 0,
                                priceMax: parseFloat(_nylon.priceMax) || 0,
                                var1: _nylon.var1 || '',
                                var2: _nylon.var2 || '',
                                var3: _nylon.var3 || '',
                                total: _nylonPrice * _spcQty
                            });
                            if (typeof renderDocItems === 'function') renderDocItems();
                        } else {
                            alert('Prodotto nylon non trovato nel registro (cod: ' + _nylonCode + ')');
                        }
                    }
                }, 600);
            }
        }
    });

    if (countData > 0) {
        // Clear selection to avoid re-adding
        document.querySelectorAll('.prod-check:checked').forEach(c => c.checked = false);
        // alert(`Aggiunti ${countData} prodotti al preventivo.`); // Feedback for user
        resumeEditor();
    } else {
        alert("Errore: Impossibile trovare i prodotti selezionati nel DB.");
    }
}

async function deleteSelectedProducts() {
    const checked = Array.from(document.querySelectorAll('.prod-check:checked')).map(c => c.value);
    if (checked.length === 0) return;
    if (!confirm(`Eliminare ${checked.length} prodotti selezionati?`)) return;

    try {
        await Promise.all(checked.map(id => db.deleteProduct(id)));
        renderProductsTable();
        updateDelButton();
        // Uncheck master
        const master = document.querySelector('input[type="checkbox"][onchange="toggleSelectAllProds(this)"]');
        if (master) master.checked = false;
    } catch (e) {
        console.error("Delete Error:", e);
        alert("Errore eliminazione: " + window.localizeError(e));
    }
}

window.deleteProduct = function (id) {
    if (confirm('Sei sicuro di voler eliminare questo prodotto?')) {
        db.deleteProduct(id);
        renderProductsTable();
    }
}

// --- QUOTE EDITOR ---
// (updateEditorStatusUI consolidated at line ~2732)


// Generate random alphanumeric quote code (4 characters with at least 1 number)
function generateQuoteCode() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    let code = '';

    // First character: random (letter or number)
    code += chars.charAt(Math.floor(Math.random() * chars.length));

    // Second character: guaranteed number
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));

    // Remaining 2 characters: random
    for (let i = 0; i < 2; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
}

window.openEditor = function (quoteId = null) {
    const editor = document.getElementById('quoteEditor');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));

    editor.classList.remove('hidden');
    editor.classList.add('active');
    editorIsDirty = false; // Reset dirty state on open

    const editorMain = editor.querySelector('.editor-main');
    if (editorMain) {
        editorMain.scrollTop = 0;
    }

    const btnLayout = document.getElementById('btnLayoutEdit');
    if (btnLayout) {
        if (db.isAdmin) {
            btnLayout.classList.remove('hidden');
        } else {
            btnLayout.classList.add('hidden');
        }
    }

    if (quoteId) {
        currentQuote = JSON.parse(JSON.stringify(db.getQuote(quoteId)));

        // AUTO-MEMO LOGIC
        if (currentQuote.status === 'Aperto') {
            const d = new Date(currentQuote.date || currentQuote.createdAt);
            const now = new Date();
            const ageDays = (now - d) / (1000 * 60 * 60 * 24);
            if (ageDays > 10) {
                let notes = currentQuote.internalNotes || '';
                const memoText = "E' il caso di richiamare";
                // Add only if not present
                if (!notes.includes(memoText)) {
                    if (notes) notes += "\n";
                    notes += memoText;
                    currentQuote.internalNotes = notes;
                }
            }
        }

        // AUTO-DEFAULT NOTES:
        // - Preventivo nuovo (senza id): applica sempre il testo di default se le note sono vuote
        // - Preventivo esistente (con id): applica il default SOLO se notes è null/undefined
        //   (mai compilato prima), ma NON se è una stringa vuota "" (utente ha cancellato deliberatamente)
        const _shouldApplyDefaultNotes = !currentQuote.id
            ? (!currentQuote.notes || currentQuote.notes.trim() === '') // nuovo preventivo: applica se vuoto
            : (currentQuote.notes === null || currentQuote.notes === undefined); // esistente: applica solo se mai salvato
        if (_shouldApplyDefaultNotes) {
            currentQuote.notes = "Il presente preventivo ha una validita' di gg. 30\nIl preventivo si intende valido salvo sopraluogo";
        }

        // AUTO-REFRESH CUSTOMER SNAPSHOT
        // Ensure editable fields (Address, City, Zip) are in sync with Registry
        if (currentQuote.customer && currentQuote.customer.id) {
            const freshClient = db.getClients().find(c => c.id == currentQuote.customer.id);
            if (freshClient) {
                // FIX: Check if Name matches before overwriting. prevent ID collision/corruption issues.
                // This prevents "Accetta Michael" (ID X) from overwriting "Falcini" (ID X) if they share an ID by mistake.
                const currentName = (currentQuote.customer.name || '').trim().toLowerCase();
                const freshName = (freshClient.name || '').trim().toLowerCase();

                // Allow update only if names are reasonably similar (fuzzy match or direct match)
                // If completely different, assume Data Corruption and DO NOT overwrite.
                if (currentName === freshName || freshName.includes(currentName) || currentName.includes(freshName)) {
                    currentQuote.customer = JSON.parse(JSON.stringify(freshClient));
                } else {
                    console.warn(`Customer ID Mismatch detected: Quote has '${currentQuote.customer.name}' encoded with ID '${currentQuote.customer.id}', but Registry has '${freshClient.name}' for that ID. Preventing overwrite.`);
                    // Optional: Detach ID to prevent future confusion?
                    // currentQuote.customer.id = null; 
                }
            }
        }

        renderEditorState();
    } else {
        const agents = db.getAgents() || [];

        // AUTO-ASSIGN AGENT ON NEW QUOTE
        let defaultAgent = '';
        if (currentUser && currentUser.email) {
            defaultAgent = db.getAgentByEmail(currentUser.email) || '';
        }

        // const defaultAgent = agents.length > 0 ? agents[0] : ''; // REMOVED: User requested no persistence/default

        const initialZone = '';

        const today = new Date();

        currentQuote = {
            id: null,
            quoteCode: generateQuoteCode(), // Auto-generated 4-char code
            date: today.toISOString().split('T')[0],
            deliveryDate: '',
            agent: defaultAgent, // Set from Login
            zone: '',
            jobType: '',
            material: '',
            contact: '',
            executionYear: '2026',
            customer: null,
            items: [],
            notes: "Il presente preventivo ha una validita' di gg. 30\nIl preventivo si intende valido salvo sopraluogo",
            status: 'Aperto',
            siteSignboard: ''
        };

        renderEditorState();

        // Removed auto-modal for zones since agent is empty
    }
}



window.updateDocumentTitle = function () {
    if (localStorage.getItem('debugMode')) console.log("Updating Title...", currentQuote);

    // Check status via DOM or object (priority to DOM for visual consistency)
    const domStatus = document.getElementById('editorStatus') ? document.getElementById('editorStatus').value : (currentQuote?.status || 'Aperto');

    if (currentQuote && currentQuote.customer && (currentQuote.customer.name || currentQuote.customer.vat)) {
        if (domStatus === 'Chiuso') {
            // Chiuso Logic
            const surname = currentQuote.customer.surname || '';
            const name = currentQuote.customer.name || 'Cliente';
            const fullName = [surname, name].filter(Boolean).join(' ').trim();
            document.title = `${fullName} Conferma d'ordine`;
        } else {
            // Standard Logic - Include both surname and name
            const surname = currentQuote.customer.surname || '';
            const name = currentQuote.customer.name || currentQuote.customer.vat || 'Cliente';
            const fullName = [surname, name].filter(Boolean).join(' ').trim();
            const safeName = fullName.replace(/[^a-zA-Z0-9 àèìòùÀÈÌÒÙ\-_()]/g, ' ').trim();
            document.title = `Preventivo ${safeName}`;
        }
    } else {
        document.title = 'Preventivi Parquet Romagna (IT)';
    }
}

function closeEditor() {
    if (!editorIsDirty || confirm('Uscire senza salvare?')) {
        const editor = document.getElementById('quoteEditor');
        editor.classList.remove('active'); // Vital for hiding the overlay
        editor.classList.add('hidden');
        document.getElementById('floatingCalc').classList.add('hidden');
        document.querySelector('[data-target="quotes"]').click();

        // Reset Title
        document.title = 'Preventivi Parquet Romagna (IT)';
    }
}

window.markEditorClean = function () {
    editorIsDirty = false;
}

function renderEditorState() {
    if (!currentQuote) {
        return;
    }

    // FIX: Verify editor is visible to prevent DOM errors when modal is open
    const editorView = document.getElementById('quoteEditor');
    if (!editorView || editorView.classList.contains('hidden')) {

        return;
    }

    // Update Document Title for PDF/Share
    updateDocumentTitle();

    try {
        // --- GIOBBY BUTTON VISIBILITY ---
        const btnOpenGiobby = document.getElementById('btnOpenGiobby');
        if (btnOpenGiobby) {
            if (currentQuote.giobbyDocumentId) {
                btnOpenGiobby.classList.remove('hidden');
            } else {
                btnOpenGiobby.classList.add('hidden');
            }
        }
        // --------------------------------

        const docDate = document.getElementById('docDate');
        if (docDate) {
            // Update Sidebar Input from Model
            docDate.value = currentQuote.date ? currentQuote.date.split('T')[0] : '';

            // 1. Sidebar -> Model & Paper
            docDate.onchange = function () {
                if (currentQuote) {

                    // Mark as manually modified (NEW FLAG)
                    currentQuote._dateModifiedManually = true;
                    currentQuote._customDate = this.value;

                    currentQuote.date = this.value;
                    editorIsDirty = true;
                    window.updateDocumentTitle();
                }

                // Update Paper View
                const datePlaceholder = document.getElementById('printDatePlaceholder');
                if (datePlaceholder && this.value) {
                    const d = new Date(this.value);
                    if (!isNaN(d.getTime())) {
                        datePlaceholder.textContent = `Data: ${d.toLocaleDateString('it-IT')}`;
                    }
                }
            };

            // 2. Paper -> Model & Sidebar
            const datePlaceholder = document.getElementById('printDatePlaceholder');
            if (datePlaceholder) {
                // Initial Render (One-way)
                if (currentQuote.date) {
                    const d = new Date(currentQuote.date);
                    if (!isNaN(d.getTime())) {
                        datePlaceholder.textContent = `Data: ${d.toLocaleDateString('it-IT')}`;
                    }
                }

                // Make Editable & Listen
                datePlaceholder.contentEditable = true; // Ensure it is editable

                // Remove old listeners to prevent stacking (if any)
                // (Native implementation replaces element or we rely on re-render clearing it? 
                // re-render replaces innerHTML of parent? No, renderEditorState usually updates values.
                // We should be careful about duplicate listeners if we don't clone. 
                // But datePlaceholder is static in HTML structure usually.
                // Let's use a named function or just simple one-off if renderEditorState is called often.
                // Better approach: Assign 'onblur' directly which overrides previous one.

                datePlaceholder.onblur = function () {
                    const text = this.textContent.replace('Data:', '').trim();
                    // Parse Italian Date: DD/MM/YYYY
                    const parts = text.split('/');
                    if (parts.length === 3) {
                        const day = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10) - 1; // JS Month is 0-indexed
                        const year = parseInt(parts[2], 10);

                        const newDate = new Date(year, month, day);
                        // Validate
                        if (!isNaN(newDate.getTime()) && newDate.getFullYear() === year) {
                            // Valid Date
                            // Format to YYYY-MM-DD for Input
                            const isoDate = newDate.toISOString().split('T')[0];

                            // Update Model directly
                            currentQuote.date = isoDate;
                            editorIsDirty = true;

                            // Sync Sidebar
                            docDate.value = isoDate;
                            window.updateDocumentTitle();
                        } else {
                            // Invalid date, revert to model
                            // console.warn("Invalid date entered, reverting.");
                            const d = new Date(currentQuote.date);
                            this.textContent = `Data: ${d.toLocaleDateString('it-IT')}`;
                        }
                    } else {
                        // Revert if format is completely wrong
                        const d = new Date(currentQuote.date);
                        this.textContent = `Data: ${d.toLocaleDateString('it-IT')}`;
                    }
                };

                // Allow "Enter" to blur
                datePlaceholder.onkeydown = function (e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.blur();
                    }
                };
            }
        }

        // === QUOTE CODE DISPLAY (Read-only) ===
        // Code is auto-generated and not editable
        // Simply ensure it exists for new quotes
        if (!currentQuote.quoteCode) {
            currentQuote.quoteCode = generateQuoteCode();
            // Save immediately to persist the code
            if (currentQuote.id) {
                db.saveQuote(currentQuote).then(() => {

                }).catch(err => {
                    console.error('Failed to save quote code:', err);
                });
            } else {
                editorIsDirty = true; // For new quotes not yet saved
            }
        }

        // Always update the PDF display
        const printQuoteCode = document.getElementById('printQuoteCode');
        if (printQuoteCode) {
            if (currentQuote.quoteCode) {
                printQuoteCode.textContent = currentQuote.quoteCode;
            } else {
                printQuoteCode.textContent = '';
            }
        }
        // ========================

        // Ensure lists are populated/fresh
        try {
            populateSharedLists();
            if (typeof updateProductDatalist === 'function') updateProductDatalist();
        } catch (e) {
            console.error("Error in populateSharedLists:", e);
        }

        const docAgent = document.getElementById('docAgent');
        const docZone = document.getElementById('docZone');

        // Robustness: If agent is not in the list (e.g. archived), add it temporarily so it displays
        if (docAgent && currentQuote.agent && !Array.from(docAgent.options).some(o => o.value === currentQuote.agent)) {
            const opt = document.createElement('option');
            opt.value = currentQuote.agent;
            opt.textContent = currentQuote.agent + ' (N/D)';
            docAgent.appendChild(opt);
        }

        if (docAgent) {
            docAgent.value = currentQuote.agent;
            // Trigger update for header display
            docAgent.dispatchEvent(new Event('change'));
        }

        // Crucial: Update Zone Options based on the agent we just set
        if (typeof updateZoneOptions === 'function') {
            try {
                updateZoneOptions(currentQuote.agent, currentQuote.zone);
            } catch (e) { console.error("Error in updateZoneOptions:", e); }
        }


        if (docZone) docZone.value = currentQuote.zone;

        // NEW FIELDS POPULATION
        // Strategy:
        // - currentQuote[field] !== undefined → usa il modello (imposta DOM, anche se '')
        // - currentQuote[field] === undefined (preventivo vecchio) → preserva il valore DOM
        const docJobType = document.getElementById('docJobType');
        if (docJobType) {
            if (currentQuote.jobType !== undefined) {
                docJobType.value = currentQuote.jobType; // Imposta dal modello (anche '')
            } else if (docJobType.value) {
                currentQuote.jobType = docJobType.value; // Preventivo vecchio: preserva selezione utente
            }
        }

        const docMaterial = document.getElementById('docMaterial');
        if (docMaterial) {
            if (currentQuote.material !== undefined) {
                docMaterial.value = currentQuote.material;
            } else if (docMaterial.value) {
                currentQuote.material = docMaterial.value;
            }
        }

        const docContact = document.getElementById('docContact');
        if (docContact) {
            if (currentQuote.contact !== undefined) {
                docContact.value = currentQuote.contact;
            } else if (docContact.value) {
                currentQuote.contact = docContact.value;
            }
        }

        if (typeof window.initExecutionYearOptions === 'function') {
            window.initExecutionYearOptions();
        }
        const docExecutionYear = document.getElementById('docExecutionYear');
        if (docExecutionYear) {
            if (!currentQuote.executionYear) {
                currentQuote.executionYear = currentQuote.date ? currentQuote.date.split('-')[0] : '2026';
            }
            docExecutionYear.value = currentQuote.executionYear;
        }


        const docWarehouse = document.getElementById('docWarehouse');
        if (docWarehouse) docWarehouse.value = currentQuote.warehouse || '';

        const docDeliveryAddress = document.getElementById('docDeliveryAddress');
        if (docDeliveryAddress) docDeliveryAddress.value = currentQuote.deliveryAddress || '';

        const docNotes = document.getElementById('docNotes');
        if (docNotes) {
            // Se il textarea ha il focus (utente sta scrivendo), aggiorna prima il modello
            // per non perdere l'input non ancora sincronizzato, poi NON resettare il DOM
            if (document.activeElement === docNotes) {
                currentQuote.notes = docNotes.value;
            } else {
                docNotes.value = currentQuote.notes || '';
            }
        }

        const docReference = document.getElementById('docReference');
        if (docReference) {
            if (currentQuote.reference) {
                // Valore già salvato → mostralo com'è
                docReference.value = currentQuote.reference;
            } else {
                // Auto-compila: NomeCliente [Cognome] + CodicePreventivo (solo se lo abbiamo entrambi)
                const clientName = (currentQuote.customer && currentQuote.customer.name)
                    ? currentQuote.customer.name.trim()
                    : '';
                const clientSurname = (currentQuote.customer && currentQuote.customer.surname)
                    ? currentQuote.customer.surname.trim()
                    : '';
                const fullName = [clientName, clientSurname].filter(Boolean).join(' ');
                const code = currentQuote.quoteCode || '';
                if (fullName && code) {
                    docReference.value = `${fullName} - ${code}`;
                    // Salva come riferimento del preventivo (così viene usato da Giobby)
                    currentQuote.reference = docReference.value;
                } else {
                    docReference.value = '';
                }
            }
        }

        const docInternalNotes = document.getElementById('docInternalNotes');
        if (docInternalNotes) {
            if (document.activeElement === docInternalNotes) {
                currentQuote.internalNotes = docInternalNotes.value;
            } else {
                docInternalNotes.value = currentQuote.internalNotes || currentQuote.notesInternal || '';
            }
        }

        const edStatus = document.getElementById('editorStatus');
        if (edStatus) {
            edStatus.value = currentQuote.status || 'Aperto';
            updateEditorStatusUI();
        }


        const docBank = document.getElementById('docBank');
        if (docBank) docBank.value = currentQuote.bank || '';

        // Timeline & Payment Terms
        const elTimeline = document.getElementById('docTimeline');
        if (elTimeline && currentQuote.timeline !== undefined) {
            elTimeline.innerHTML = currentQuote.timeline;
        }

        const elPaymentTerms = document.getElementById('docPaymentTerms');
        if (elPaymentTerms && currentQuote.paymentTerms !== undefined) {
            elPaymentTerms.innerHTML = currentQuote.paymentTerms;
        }

        // LOGISTICS
        const docDel = document.getElementById('docDeliveryDate');
        if (docDel) docDel.value = currentQuote.deliveryDate || '';

        const docAddr = document.getElementById('docSiteAddress');
        if (docAddr) docAddr.value = currentQuote.siteAddress || '';

        const docSiteCity = document.getElementById('docSiteCity');
        if (docSiteCity) docSiteCity.value = currentQuote.siteCity || '';

        const docSiteZip = document.getElementById('docSiteZip');
        if (docSiteZip) docSiteZip.value = currentQuote.siteZip || '';

        const docSiteProv = document.getElementById('docSiteProvince');
        if (docSiteProv) docSiteProv.value = currentQuote.siteProvince || '';

        const docCont = document.getElementById('docSiteContactName');
        if (docCont) docCont.value = currentQuote.siteContactName || '';

        const docRef = document.getElementById('docSiteContactReference');
        if (docRef) docRef.value = currentQuote.siteContactReference || '';

        const docRole = document.getElementById('docSiteContactRole');
        if (docRole) docRole.value = currentQuote.siteContactRole || '';

        const docPhone = document.getElementById('docSiteContactPhone');
        if (docPhone) docPhone.value = currentQuote.siteContactPhone || '';

        const docSiteSignboard = document.getElementById('docSiteSignboard');
        if (docSiteSignboard) docSiteSignboard.value = currentQuote.siteSignboard || '';


        const cDisplay = document.getElementById('clientDisplay');
        if (cDisplay) {
            if (currentQuote.customer) {
                const c = currentQuote.customer;
                const isPrivate = c.type === 'private';
                const vatLabel = isPrivate ? 'C.F.' : 'P.IVA';

                let content = `<div style="text-align: left; cursor: pointer;" title="Doppio click per modificare" ondblclick="openClientModal('${c.id}')">`;
                content += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">`;
                // FIX: Include surname for Giobby-imported clients
                const fullName = [c.name, c.surname].filter(Boolean).join(' ').trim() || c.name || '';
                content += `<div style="font-size:1.1em; font-weight:bold;">${fullName}</div>`;
                content += `</div>`;

                content += `<div style="font-size:0.95em; color:#374151; margin-bottom:2px;">
                    ${c.address || ''}<br>
                    ${[c.zip, c.city, c.addressProvince ? '(' + c.addressProvince + ')' : ''].filter(Boolean).join(' ')}
                </div>`;

                // --- SHOW SITE ADDRESS ---
                if (c.siteAddress) {
                    content += `<div style="font-size:0.85em; color:#0e7490; margin-top:4px; padding-top:2px; border-top:1px dashed #e5e7eb;">
                        <i class="fa-solid fa-truck-fast"></i> <strong>Cantiere:</strong> ${c.siteAddress}`;
                    if (c.siteAddressProvince) content += ` (${c.siteAddressProvince})`;
                    content += `</div>`;
                }

                // --- CONDITIONAL SHOW VAT / FISCAL CODE ---
                if (c.type === 'private') {
                    // Check fiscal_code preference first, fallback to vat if misused
                    const cf = c.fiscal_code || c.vat;
                    if (cf) {
                        content += `<div style="font-size:0.9em; color:#6b7280; margin-top: 4px;">C.F.: ${cf}</div>`;
                    }
                } else {
                    // Company -> Show P.IVA
                    if (c.vat) {
                        content += `<div style="font-size:0.9em; color:#6b7280; margin-top: 4px;">P.IVA: ${c.vat}</div>`;
                    }
                }

                if (c.contactPerson) {
                    content += `<div style="margin-top:4px; font-size:0.9em;"><strong>Ref:</strong> ${c.contactPerson}</div>`;
                }

                content += `<div style="margin-top:4px; font-size:0.85em; color:#777;">`;
                if (c.phone) content += `<i class="fa-solid fa-phone"></i> ${c.phone} &nbsp; `;
                if (c.email) content += `<i class="fa-solid fa-envelope"></i> ${c.email}`;
                content += `</div>`;

                cDisplay.innerHTML = content;
                cDisplay.classList.remove('placeholder-text');
                cDisplay.classList.remove('client-placeholder'); // Remove conflicting styles
            } else {
                cDisplay.innerHTML = '<i class="fa-solid fa-user-plus"></i> Clicca per selezionare un cliente...';
                cDisplay.classList.add('placeholder-text');
                cDisplay.classList.add('client-placeholder'); // Revert to placeholder style
            }
        }


        // Restore Legal Footer Content
        const elLegalNotes = document.getElementById('docLegalNotes');
        if (elLegalNotes) {
            if (document.activeElement === elLegalNotes) {
                // In editing: sync to model instead of overwriting DOM
                currentQuote.legalNotes = elLegalNotes.innerHTML;
            } else if (currentQuote.legalNotes) {
                elLegalNotes.innerHTML = currentQuote.legalNotes;
            }
            // Binding live: sincronizza al modello a ogni modifica (oninput/onblur)
            elLegalNotes.oninput = function () {
                currentQuote.legalNotes = this.innerHTML;
                editorIsDirty = true;
            };
            elLegalNotes.onblur = function () {
                currentQuote.legalNotes = this.innerHTML;
                editorIsDirty = true;
            };
        }

        // Internal Notes (duplicate assignment guard - already handled above)
        // Note: docInternalNotes is also managed above with focus protection

        const elLegalGlossary = document.getElementById('docLegalGlossary');
        if (elLegalGlossary) {
            if (document.activeElement === elLegalGlossary) {
                currentQuote.legalGlossary = elLegalGlossary.innerHTML;
            } else if (currentQuote.legalGlossary) {
                elLegalGlossary.innerHTML = currentQuote.legalGlossary;
            }
            // Binding live
            elLegalGlossary.oninput = function () {
                currentQuote.legalGlossary = this.innerHTML;
                editorIsDirty = true;
            };
            elLegalGlossary.onblur = function () {
                currentQuote.legalGlossary = this.innerHTML;
                editorIsDirty = true;
            };
        }

        // Closing Text Binding
        // Closing Text / Checkboxes Binding
        const elClosingText = document.getElementById('docClosingText'); // Might be removed
        if (elClosingText) {
            elClosingText.value = currentQuote.closingText || '';
            elClosingText.onchange = function () { currentQuote.closingText = this.value; };
        }

        // --- RESTORE CHECKBOXES ---
        const scopeContainer = document.getElementById('scopeCheckboxes');
        if (scopeContainer) {
            const checkboxes = scopeContainer.querySelectorAll('input[type="checkbox"]');

            // Logic: 
            // 1. If currentQuote.inclusions exists (Array), use it.
            // 2. If NOT exists (New Quote or Legacy), check ALL by default (User Request).
            //    (Legacy quotes won't have the field, so we default to checked, which is safer/better than empty)

            const inclusions = currentQuote.inclusions;

            checkboxes.forEach(cb => {
                if (inclusions && Array.isArray(inclusions)) {
                    // Explicit state saved
                    cb.checked = inclusions.includes(cb.value);
                } else {
                    // Default: All Checked
                    cb.checked = true;
                }

                // Trigger visibility logic (no-print class) based on state
                if (cb.parentElement) {
                    if (cb.checked) cb.parentElement.classList.remove('no-print');
                    else cb.parentElement.classList.add('no-print');
                }
            });
        }

        // Auto-Enable "Print Totals" default behavior
        const toggleTotals = document.getElementById('togglePrintTotals');
        if (toggleTotals) {
            // Initialize model if missing (Default to TRUE for all statuses per user request)
            if (currentQuote.printTotals === undefined) {
                currentQuote.printTotals = true;
            }

            // Optional: Enforce TRUE for Closed/Orders if strict business rule needed
            // But allowing user to toggle even then might be better. 
            // For now, we trust the default.
            if (currentQuote.status === 'Chiuso' || currentQuote.status === 'Ordine Confermato') {
                currentQuote.printTotals = true;
            }

            toggleTotals.checked = currentQuote.printTotals;

            // Apply visibility
            if (typeof toggleTotalsPrint === 'function') {
                toggleTotalsPrint(toggleTotals.checked);
            }

            // Bind to Model to persist choice during session
            toggleTotals.onchange = function () {
                currentQuote.printTotals = this.checked;
                if (typeof toggleTotalsPrint === 'function') {
                    toggleTotalsPrint(this.checked);
                }
            };
        }

        renderDocItems();


        renderDocItems();

        // Restore VAT Selection
        const docVatSelect = document.getElementById('docVatSelect');
        if (docVatSelect) {
            let val = (currentQuote.vatRate !== undefined && currentQuote.vatRate !== null) ? currentQuote.vatRate : '0.22';
            if (val === 0 || val === '0' || val === '0_apply' || val === '0_zero') {
                val = '0.22'; // Map old numeric 0 or removed 0% rates to 22% default
            }
            
            // Check if the option exists in the select dropdown
            const optionExists = Array.from(docVatSelect.options).some(opt => opt.value === val);
            if (!optionExists) {
                val = '0.22'; // Fallback to 22% if option is missing
            }
            
            docVatSelect.value = val;

            // FIX: Bind VAT Select
            docVatSelect.onchange = function () {
                currentQuote.vatRate = this.value; // Save selection raw value (e.g., '0_rc', '0.22') so it persists
                editorIsDirty = true;
                updateDocTotal(); // Recalculate totals immediately
            };
        }

        // --- FIX: BIND SIDEBAR INPUTS TO MODEL (PREVENT DATA LOSS ON RERENDER) ---

        // Helper to bind input to model property
        function bindInput(id, prop, isInt = false) {
            const el = document.getElementById(id);
            if (el) {
                el.oninput = function () {
                    currentQuote[prop] = this.value;
                    editorIsDirty = true;
                };
                el.onchange = function () {
                    currentQuote[prop] = this.value;
                    editorIsDirty = true;
                };
            }
        }

        bindInput('docDeliveryDate', 'deliveryDate');
        bindInput('docWarehouse', 'warehouse');
        bindInput('docDeliveryAddress', 'deliveryAddress');
        bindInput('docNotes', 'notes');
        bindInput('docInternalNotes', 'internalNotes'); // Corrected from notesInternal
        bindInput('docReference', 'reference');
        bindInput('docBank', 'bank');

        // Required fields (Tipo Lavoro, Materiale, Origine Contatto, Anno Esecuzione)
        bindInput('docJobType', 'jobType');
        bindInput('docMaterial', 'material');
        bindInput('docContact', 'contact');
        bindInput('docExecutionYear', 'executionYear');

        // Logistics / Site
        bindInput('docSiteAddress', 'siteAddress');
        bindInput('docSiteCity', 'siteCity');
        bindInput('docSiteZip', 'siteZip');
        bindInput('docSiteProvince', 'siteProvince');
        bindInput('docSiteContactName', 'siteContactName');
        bindInput('docSiteContactReference', 'siteContactReference');
        bindInput('docSiteContactRole', 'siteContactRole');
        bindInput('docSiteContactPhone', 'siteContactPhone');
        bindInput('docSiteSignboard', 'siteSignboard');

        // Agent & Zone Binding
        // Agent & Zone Binding
        // docAgent and docZone are already declared above (Line ~1547)

        // FORCE AGENT INIT if missing (Critical for Giobby Export visibility)
        if (docAgent && !currentQuote.agent && currentUser && currentUser.email) {
            const foundAgent = db.getAgentByEmail(currentUser.email);
            if (foundAgent) {
                currentQuote.agent = foundAgent;
                docAgent.value = foundAgent;
            }
        }

        if (docAgent) {
            docAgent.onchange = function () {
                currentQuote.agent = this.value;
                editorIsDirty = true;
                // Update Zone Options
                if (typeof updateZoneOptions === 'function') {
                    updateZoneOptions(currentQuote.agent, currentQuote.zone);
                }
            };
        }

        if (docZone) {
            docZone.onchange = function () {
                currentQuote.zone = this.value;
                editorIsDirty = true;
            };
        }

        updateDocTotal();
        updateEditorStatusUI();
    } catch (e) {
        console.error("FATAL ERROR in renderEditorState:", e);
        alert("Errore rendering Editor: " + window.localizeError(e));
    }
}


function renderDocItems() {
    const tbody = document.getElementById('docItemsBody');
    if (!tbody) {
        console.error("renderDocItems: tbody not found!");
        return;
    }
    tbody.innerHTML = '';


    currentQuote.items.forEach((item, index) => {
        // --- FREE TEXT ROW ---
        if (item.type === 'text') {
            const tr = document.createElement('tr');
            tr.className = 'free-text-row' + (item.printOnPdf === false ? ' no-print' : '');
            tr.style.cssText = 'background: #fffbeb; border-bottom: 1px dashed #d97706;';
            tr.innerHTML = `
                <td colspan="8" style="padding: 4px 6px;">
                    <div style="display:flex; align-items:flex-start; gap:6px;">
                        <span class="no-print" style="color:#d97706; font-size:1.1em; margin-top:2px;" title="Riga Testo Libero"><i class="fa-solid fa-align-left"></i></span>
                        <textarea id="freetext_input_${index}" class="cell-input" placeholder="Testo libero..." style="flex:1; resize:vertical; min-height:1.8em; background:transparent; border:none; border-bottom:1px dashed #d97706; padding:2px; font-style:italic; color:#374151;"
                            oninput="this.style.height=''; this.style.height=this.scrollHeight+'px'; updateFreeTextItem(${index}, 'description', this.value)" onblur="_freeTextBlurCheck(${index})">${item.description || ''}</textarea>
                        <label class="no-print" style="display:flex; align-items:center; gap:4px; font-size:0.78rem; color:#6b7280; white-space:nowrap; margin-top:4px; cursor:pointer;" title="Includi questa riga nella stampa PDF">
                            <input type="checkbox" ${item.printOnPdf !== false ? 'checked' : ''}
                                onchange="updateFreeTextItem(${index}, 'printOnPdf', this.checked)"> PDF
                        </label>
                        <button class="btn-icon delete no-print" onclick="removeDocItem(${index})" title="Elimina riga testo"
                            onmouseover="showTooltip(event,'Elimina riga testo')" onmousemove="moveTooltip(event)" onmouseout="hideTooltip()">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                </td>
            `;
            // Auto-height
            setTimeout(() => {
                const ta = tr.querySelector('textarea');
                if (ta) { ta.style.height = ta.scrollHeight + 'px'; }
            }, 0);
            tbody.appendChild(tr);
            return; // skip standard row rendering
        }

        // AUTO-HEAL: If item has description but 0 price and no explicit Omaggio flag, check DB
        if ((!item.unitPrice || item.unitPrice === 0) && item.description && !item.isOmaggioConfirmed && window.db && window.db.getProducts) {
            const products = window.db.getProducts();
            const descClean = item.description.trim().toLowerCase();
            const match = products.find(p => 
                (item.code && p.code && p.code.toLowerCase() === item.code.toLowerCase()) ||
                (p.description && p.description.trim().toLowerCase() === descClean) ||
                (p.description && descClean.length > 2 && (p.description.trim().toLowerCase().includes(descClean) || descClean.includes(p.description.trim().toLowerCase())))
            );
            if (match) {
                const useMat = document.getElementById('checkUseMaterialPrice')?.checked;
                const price = window.getProductEffectivePrice(match, useMat || item.isMaterialPrice);
                if (price > 0) {
                    item.unitPrice = price;
                    if (!item.code && match.code) item.code = match.code;
                    if ((!item.uom || item.uom === 'pz') && match.uom) item.uom = match.uom;
                    item.priceMin = parseFloat(match.priceMin) || 0;
                    item.priceMax = parseFloat(match.priceMax) || window.getProductDefaultPrice(match);
                    item.total = (item.quantity || 1) * price;
                }
            }
        }

        const tr = document.createElement('tr');
        const vars = db.getProductVars();

        // Tooltip logic for price
        // Tooltip logic for price & Margin
        // Tooltip logic for price
        let priceTooltip = '';
        const isAdmin = (db.role === 'admin');

        if (item.priceMin) {
            // Always show Price Min? Or only if Admin? 
            // User said: "lascia intatto alert prezzo" -> implies keeping validation/awareness.
            // But usually "margin" implies cost data. 
            // Let's keep Price Min in tooltip if it was there, but REMOVE Margin % for non-admins.
            // Actually, showing Price Min allows calculating margin manually easily. 
            // However, request specifically said "nascondi il calcolo del margine".

            if (isAdmin) {
                const margin = item.unitPrice > 0 ? ((item.unitPrice - item.priceMin) / item.unitPrice) * 100 : 0;
                const marginStr = margin.toFixed(1) + '%';
                priceTooltip = `Prezzo Min: ${formatCurrency(item.priceMin)} €\nMargine: ${marginStr}`;
            } else {
                // For Agents: Maybe just show Price Min? Or nothing?
                // "lascia intatto alert prezzo" might refer to the POPUP when you go below min.
                // In the tooltip, showing Price Min is useful.
                priceTooltip = `Prezzo Min: ${formatCurrency(item.priceMin)} €`;
            }
        }

        // Escape quotes to prevent breaking the HTML attribute.
        // We only need to escape double quotes because we put this in data-tooltip="..."
        const safeTooltip = priceTooltip.replace(/"/g, "&quot;");


        // Legacy attributes or clean tr
        tr.dataset.itemCode = item.code || ''; // Keep dataset for reference if needed


        tr.innerHTML = `
            <td>
                <div style="display:flex; align-items:flex-start; gap:4px; margin:0; padding:0; width:100%;">
                    <div style="flex:1; position:relative;">
                        <textarea id="desc_input_${index}" class="cell-input" rows="1" style="resize:none; min-height:unset; width:100%; overflow:hidden;"
                               onfocus="this.select(); if (this.value && this.value.trim().length >= 1) _rowPickerDebounce(${index}, this.value)"
                               oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'; _rowPickerDebounce(${index}, this.value)"
                               ondblclick="openProductFromEditor('${(item.code || '').replace(/'/g, "\\'")}')"
                               onchange="updateItem(${index}, 'description', this.value)"
                               onkeydown="_rowPickerKeyNav(event, ${index})"
                               placeholder="Digita per cercare prodotto o battiscopa..."
                               >${item.description ? item.description.charAt(0).toUpperCase() + item.description.slice(1).toLowerCase() : ''}</textarea>
                        <div id="row-ac-${index}" class="row-autocomplete-dropdown" style="display:none;" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();" onclick="event.stopPropagation();"></div>
                    </div>
                    <button class="btn-row-picker no-print" onmousedown="window._isModalPickerOpen = true;" onclick="openRowPickerModal(${index})" title="Cerca nel catalogo prodotti">
                        <i class="fa-solid fa-search"></i>
                    </button>
                </div>
            </td>
            <td class="text-center no-print">
                ${(() => {
                    const _cls = (item.classe || '').toUpperCase().trim();
                    const _showGiobby = ['A', 'B', 'LAM', 'SPC'].includes(_cls) || item.isParquet;
                    if (!_showGiobby) return '';
                    return `<div style="display:flex; align-items:center; justify-content:center; gap:2px;">
                        <input type="checkbox" ${item.isParquet ? 'checked' : ''}
                               onchange="updateItem(${index}, 'isParquet', this.checked)"
                               title="Segna come Parquet">
                        ${item.isParquet ? `<button class="btn-xs btn-secondary" onclick="openParquetSettings(${index})" title="Configura Sfrido e Colla"><i class="fa-solid fa-cog"></i></button>` : ''}
                    </div>`;
                })()} 
            </td>
            <td>
                <input type="text" id="uom_input_${index}" class="cell-input text-center" value="${item.uom}"
                    onchange="updateItem(${index}, 'uom', this.value)">
            </td>
            <td>
                <input type="text" id="qty_input_${index}" class="cell-input text-right" value="${formatQuantity(item.quantity)}" 
                    onchange="updateItem(${index}, 'quantity', this.value)">
            </td>
            <td>
                <input type="text" id="price_input_${index}" class="cell-input text-right${item.isMaterialPrice ? ' mat-price-cell' : ''}" value="${formatInput(item.unitPrice)}" 
                   data-tooltip="${safeTooltip}"
                   onmouseover="showTooltip(event, this.getAttribute('data-tooltip'))"
                   onmousemove="moveTooltip(event)"
                   onmouseout="hideTooltip()"
                   onchange="updateItem(${index}, 'unitPrice', this.value)"
                   style="${item.isMaterialPrice ? 'color:#16a34a;font-weight:600;' : ''}">
            </td>
            <td class="text-right"><strong>${item.total === 0 ? '<span style="color:var(--success-color);">OMAGGIO</span>' : formatCurrency(item.total)}</strong></td>
            <td class="text-center no-print">
                <input type="checkbox" ${item.includeInStats !== false ? 'checked' : ''} 
                       onchange="updateItem(${index}, 'includeInStats', this.checked)"
                       onmouseover="showTooltip(event, 'Includi voce nel totale e nelle statistiche')"
                       onmousemove="moveTooltip(event)"
                       onmouseout="hideTooltip()">
            </td>
            <td class="no-print" style="display:flex; gap:2px; justify-content:center;">
                <button class="btn-icon" onclick="moveDocItem(${index}, -1)" 
                        onmouseover="showTooltip(event, 'Sposta riga su')" onmousemove="moveTooltip(event)" onmouseout="hideTooltip()"
                        ${index === 0 ? 'disabled style="opacity:0.3"' : ''}>
                    <i class="fa-solid fa-arrow-up"></i>
                </button>
                <button class="btn-icon" onclick="moveDocItem(${index}, 1)" 
                        onmouseover="showTooltip(event, 'Sposta riga giù')" onmousemove="moveTooltip(event)" onmouseout="hideTooltip()"
                        ${index === currentQuote.items.length - 1 ? 'disabled style="opacity:0.3"' : ''}>
                    <i class="fa-solid fa-arrow-down"></i>
                </button>
                <button class="btn-icon" onclick="openAdditionalWorks()" 
                        onmouseover="showTooltip(event, 'Aggiungi voci extra/collegate')" onmousemove="moveTooltip(event)" onmouseout="hideTooltip()">
                    <i class="fa-solid fa-list-check"></i>
                </button>
                <button class="btn-icon delete" onclick="removeDocItem(${index})" 
                        onmouseover="showTooltip(event, 'Elimina questa riga')" onmousemove="moveTooltip(event)" onmouseout="hideTooltip()">
                    <i class="fa-solid fa-times"></i>
                </button>
            </td>
        `;

        // --- SHORTCUT F4 (Voci Extra) ---
        // Attach keydown listener to inputs in this row
        const rowInputs = tr.querySelectorAll('input, textarea');
        rowInputs.forEach(el => {
            el.addEventListener('keydown', function (e) {
                if (e.key === 'F4') {
                    e.preventDefault();
                    window.openAdditionalWorks();
                }
            });
        });

        tbody.appendChild(tr);

        // Trigger height adjustment
        const ta = tr.querySelector('textarea');
        if (ta) { ta.style.height = ta.scrollHeight + 'px'; }
    });

    // --- GHOST ROWS LOGIC ---
    const MIN_ROWS = 10;
    const currentCount = currentQuote.items.length;
    if (currentCount < MIN_ROWS) {
        const rowsNeeded = MIN_ROWS - currentCount;
        for (let i = 0; i < rowsNeeded; i++) {
            const tr = document.createElement('tr');
            tr.className = 'ghost-row'; // Style hook
            // Interactive Ghost Row: Click to ACTIVATE
            tr.setAttribute('onclick', 'activateGhostRow()');
            tr.style.cursor = 'pointer';
            tr.setAttribute('title', 'Clicca per aggiungere una riga');

            tr.innerHTML = `
                <td><div class="ghost-cell" style="min-height: 2.5em; display:flex; align-items:center;">
                    
                </div></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td class="no-print"></td>
                <td class="no-print"></td>
            `;
            tbody.appendChild(tr);
        }
    }
}

async function updateItem(index, field, value) {
    const item = currentQuote.items[index];
    if (field === 'quantity' || field === 'unitPrice') {
        const val = parseInput(value);

        // Price Validation Logic
        if (field === 'unitPrice') {
            // Price Validation Logic

            // 1. Check for OMAGGIO (Price = 0)
            if (val === 0) {
                let confirmed = false;
                if (typeof showCustomConfirm === 'function') {
                    confirmed = await showCustomConfirm(
                        "Hai inserito un prezzo pari a 0.\nConfermi di voler inserire questo articolo come OMAGGIO?",
                        "Conferma Omaggio"
                    );
                } else {
                    confirmed = confirm("Hai inserito un prezzo pari a 0.\nConfermi di voler inserire questo articolo come OMAGGIO?");
                }

                if (!confirmed) {
                    renderEditorState(); // Revert
                    return;
                }
                // If confirmed, allow 0 and SKIP priceMin check
            }
            // 2. Check Price Min (only if > 0 AND input was a valid number)
            // This check is now INSIDE the unitPrice block to apply ONLY to price field
            else {
                const min = parseFloat(item.priceMin) || 0;
                // Only check price min if the input was actually a number (not text like "um")
                const isValidNumberInput = typeof value === 'string' && !/^[a-zA-Z]+$/.test(value.trim());
                if (min > 0 && val < min && val > 0 && isValidNumberInput) {
                    // Restore Custom Confirm
                    // Ensure we are looking at the editor (handle race condition if user clicked away)
                    resumeEditor();

                    let confirmed = false;
                    if (typeof showCustomConfirm === 'function') {
                        try {
                            confirmed = await showCustomConfirm(
                                `Il prezzo inserito (${formatCurrency(val)} €) è inferiore al minimo consentito (${formatCurrency(min)} €).\nVuoi confermare l'inserimento?`,
                                "Attenzione: Prezzo Sotto Minimo"
                            );
                        } catch (e) {
                            confirmed = confirm(`Attenzione: Il prezzo inserito è sotto il minimo (${formatCurrency(min)} €).\nConfermi?`);
                        }
                    } else {
                        confirmed = confirm(`Attenzione: Il prezzo inserito è sotto il minimo (${formatCurrency(min)} €).\nConfermi?`);
                    }

                    if (!confirmed) {
                        // Revert
                        if (document.getElementById(`price_input_${index}`)) {
                            document.getElementById(`price_input_${index}`).value = formatInput(item.unitPrice);
                        }
                        return;
                    }
                }
            }
        } // End of unitPrice validation block
        // Expose DB for external modules
        window.db = db;

        item[field] = val;
        item.total = item.quantity * item.unitPrice;

        // AUTO-SYNC SOTTOPAVIMENTO: aggiorna la riga successiva se è un sottopavimento associato
        if (field === 'quantity') {
            const descUp = (item.description || '').toUpperCase();
            const classUp = (item.classe || '').toUpperCase().trim();
            const isSpc = classUp === 'SPC' || descUp.includes('SPC');
            const isLam = descUp.includes('LAMINATO') || classUp === 'LAM';

            if (isSpc || isLam) {
                const nextItem = currentQuote.items[index + 1];
                if (nextItem) {
                    const nextDesc = (nextItem.description || '').toUpperCase();
                    const nextCode = (nextItem.code || '').toUpperCase();
                    const isUnderlay =
                        nextCode === 'SOTBARVAPMY100H50ML100NEX' ||
                        nextDesc.includes('NYLON') ||
                        nextDesc.includes('MATERASSINO') ||
                        nextDesc.includes('SOTTOPAVIMENTO') ||
                        nextDesc.includes('BARRIERA VAPORE');
                    if (isUnderlay) {
                        nextItem.quantity = val;
                        nextItem.total = nextItem.quantity * nextItem.unitPrice;
                        // Aggiorna visivamente il campo quantità del sottopavimento
                        const nextQtyInput = document.getElementById(`qty_input_${index + 1}`);
                        if (nextQtyInput) nextQtyInput.value = formatQuantity(val);
                    }
                }
            }
        }
    } else if (field === 'isParquet') {
        item[field] = value;
        // --- AUTO-CONFIGURE GIOBBY SETTINGS ON CHECKBOX CHECK ---
        if (value === true) {
            const desc = (item.description || "").toLowerCase();
            const isBattiscopa = window.isBattiscopa(item);

            // 1. Set Defaults
            if (desc.includes('spina')) {
                item.parquetWaste = 18;
            } else {
                item.parquetWaste = 10;
            }

            // 2. Battiscopa Specifics
            if (isBattiscopa) {
                item.parquetGlueCoeff = 0; // No coefficient for battiscopa

                // Auto-detect type from BATTISCOPA_MAP
                // Auto-detect type from BATTISCOPA_MAP
                // Normalize spaces
                const descNormalized = desc.trim().replace(/\s+/g, ' ');
                let foundCode = null;

                // Try to find matching code in BATTISCOPA_MAP
                if (typeof BATTISCOPA_MAP !== 'undefined') {
                    if (BATTISCOPA_MAP[descNormalized]) {
                        foundCode = BATTISCOPA_MAP[descNormalized].code;
                    } else {
                        // Fuzzy search: Check if any map key is contained in description
                        // OR if description contains any map key (normalized)
                        const key = Object.keys(BATTISCOPA_MAP).find(k => {
                            const kNorm = k.toLowerCase();
                            // Handle cases where description has extra words
                            return descNormalized.includes(kNorm) || kNorm.includes(descNormalized.replace('battiscopa ', ''));
                        });
                        if (key) {
                            foundCode = BATTISCOPA_MAP[key].code;
                        }
                    }
                } else {
                    console.error("❌ BATTISCOPA_MAP is undefined in this scope!");
                }

                if (foundCode) {
                    item.parquetGlueType = foundCode;

                    // 3. Auto-Lookup Price for the glue type (which is actually the battiscopa code for Giobby)
                    if (window.db && window.db.getProducts) {
                        const allProducts = window.db.getProducts();
                        // Find product by code (exact match)
                        const glueProd = allProducts.find(p => p.code === foundCode);
                        if (glueProd) {
                            // Priority: price > priceMax > priceMin
                            let price = parseFloat(glueProd.price) || parseFloat(glueProd.priceMax) || parseFloat(glueProd.priceMin) || 0;
                            if (price > 0) {
                                item.parquetGluePrice = price;
                            }
                        }
                    }
                } else {
                    console.warn("⚠️ Auto-Config Battiscopa: No matching Giobby code found in MAP");
                }
            }
            // 3. Standard Parquet Defaults
            else {
                item.parquetGlueCoeff = 1.4;
                item.parquetGlueType = 'COLBICULTP9132KCHKG010MAP'; // Default Chiara
                // Optional: Lookup price for default glue if needed, but usually standard glue has fixed price logic or is manual
            }
        }
    } else {
        item[field] = value;
    }

    // --- AUTO-POPULATE PRICE FROM PRODUCT REGISTRY ---
    if (field === 'description' && value && window.db && window.db.getProducts) {
        const allProducts = window.db.getProducts();
        const descNormalized = value.trim().toLowerCase();

        let productMatch = allProducts.find(p =>
            (p.description || '').trim().toLowerCase() === descNormalized ||
            (p.code || '').trim().toLowerCase() === descNormalized
        );

        if (!productMatch && descNormalized.length > 2) {
            const matches = allProducts.filter(p => {
                const pDesc = (p.description || '').trim().toLowerCase();
                const pCode = (p.code || '').trim().toLowerCase();
                return pDesc.includes(descNormalized) || descNormalized.includes(pDesc) || (pCode && pCode.includes(descNormalized));
            });
            if (matches.length > 0) {
                productMatch = matches[0];
            }
        }

        if (productMatch) {
            const useMat = document.getElementById('checkUseMaterialPrice')?.checked;
            const effectivePrice = window.getProductEffectivePrice(productMatch, useMat || item.isMaterialPrice);

            if (effectivePrice > 0 && (!item.unitPrice || item.unitPrice === 0)) {
                item.unitPrice = effectivePrice;
                item.total = (item.quantity || 1) * item.unitPrice;
            }

            if (productMatch.code && !item.code) {
                item.code = productMatch.code;
            }
            if (productMatch.uom && (!item.uom || item.uom === 'pz')) {
                item.uom = productMatch.uom;
            }
            item.priceMin = parseFloat(productMatch.priceMin) || 0;
            item.priceMax = parseFloat(productMatch.priceMax) || window.getProductDefaultPrice(productMatch);
            if (productMatch.var1) item.var1 = productMatch.var1;
            if (productMatch.var2) item.var2 = productMatch.var2;
            if (productMatch.var3) item.var3 = productMatch.var3;
            if (productMatch.classe) item.classe = productMatch.classe;
        }
    }

    // --- SUGGESTION LOGIC: MATERASSINO FOR LAMINATO ---
    if (field === 'description') {
        const descUpper = (value || "").toUpperCase();
        if (descUpper.includes("LAMINATO")) {
            // Check if NEXT item is already Materassino to avoid spamming
            const nextItem = currentQuote.items[index + 1];
            const hasUnderlayNext = nextItem && (nextItem.description || "").toUpperCase().includes("MATERASSINO");

            if (!hasUnderlayNext) {
                // Confirm with User (Refactored Strategy: Open Category)
                // Use setTimeout to ensure the row is visible/processed
                setTimeout(() => {
                    if (confirm("Hai selezionato un pavimento in LAMINATO.\\nVuoi visualizzare la sezione SOTTOPAVIMENTO?")) {
                        // Open View
                        if (typeof openCategoryView === 'function') {
                            openCategoryView("SOTTOPAVIMENTO");
                        } else {
                            console.error("openCategoryView function missing");
                        }
                    }
                }, 500);
            }
        }
    }

        // Se l'utente sta interagendo con l'autocomplete o con il battiscopa builder, NON distruggere il DOM della riga
    const _acEl = document.getElementById('row-ac-' + index);
    if (field === 'description' && _acEl && _acEl.style.display !== 'none') {
        return;
    }

        // Per modifiche al campo descrizione o durante l'interazione con l'autocomplete, NON distruggere il DOM della tabella
    const _acDropdown = document.getElementById('row-ac-' + index);
    const _isAcOpen = _acDropdown && _acDropdown.style.display !== 'none';
    if (field === 'description' && _isAcOpen) {
        return;
    }

    renderEditorState();
}


function removeDocItem(index) {
    if (window.hideTooltip) window.hideTooltip();
    currentQuote.items.splice(index, 1);
    renderEditorState();
}

window.updateFreeTextItem = function (index, field, value) {
    if (currentQuote.items[index]) {
        currentQuote.items[index][field] = value;
        editorIsDirty = true;
        
        if (field === 'printOnPdf') {
            const tbody = document.getElementById('docItemsBody');
            if (tbody && tbody.children[index]) {
                if (value === false) {
                    tbody.children[index].classList.add('no-print');
                } else {
                    tbody.children[index].classList.remove('no-print');
                }
            }
        }
    }
};

// Wrapper for interactive ghost row click
window.activateGhostRow = function () {
    addEmptyDocRow();
};

window.addEmptyDocRow = function () {
    currentQuote.items.push({
        code: '',
        description: '',
        uom: 'pz',
        quantity: 1,
        unitPrice: 0,
        total: 0,
        priceMin: 0,
        isParquet: false,
        parquetWaste: 10,
        parquetGlueType: 'Colla 2k chiara',
        parquetGlueCoeff: 1.4,
        includeInStats: true
    });
    renderEditorState();
    setTimeout(() => {
        const lastIndex = currentQuote.items.length - 1;
        const input = document.getElementById(`desc_input_${lastIndex}`);
        if (input) {
            input.focus({ preventScroll: true });
            input.select();
        }
    }, 50);
};

window.addFreeTextRow = function () {
    currentQuote.items.push({
        type: 'text',
        description: '',
        printOnPdf: true
    });
    renderEditorState();
    setTimeout(() => {
        const lastIndex = currentQuote.items.length - 1;
        const ta = document.getElementById(`freetext_input_${lastIndex}`);
        if (ta) {
            ta.focus({ preventScroll: true });
        }
    }, 50);
};

window.moveDocItem = function (index, direction) {
    if (window.hideTooltip) window.hideTooltip();
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentQuote.items.length) return;

    // Swap
    const temp = currentQuote.items[index];
    currentQuote.items[index] = currentQuote.items[newIndex];
    currentQuote.items[newIndex] = temp;

    renderEditorState();
};

function updateDocTotal() {
    const sum = currentQuote.items.reduce((acc, i) => {
        // Skip text rows (no monetary value)
        if (i.type === 'text') return acc;
        // PER USER REQUEST: Only sum items checked in the editor (includeInStats !== false)
        if (i.includeInStats === false) return acc;
        return acc + i.total;
    }, 0);


    // Margin Calculation
    let totalCost = 0;
    currentQuote.items.forEach(i => {
        if (i.type === 'text') return; // Skip text rows
        if (i.includeInStats === false) return; // Also exclude from margin cost
        const cost = (parseFloat(i.priceMin) || 0) * i.quantity;
        totalCost += cost;
    });
    const totalMarginVal = sum - totalCost;
    const totalMarginPct = sum > 0 ? (totalMarginVal / sum) * 100 : 0;

    // Update UI
    const elMargin = document.getElementById('docMarginTotal');
    if (elMargin) {
        if (db.role === 'admin') {
            elMargin.style.display = 'inline'; // Ensure visible
            // Also ensure label is visible if it's separate? Usually it's in the text or separate span.
            // Looking at HTML (inferred): standard is <span>Margine: <span id="docMarginTotal">...</span></span>
            // If we just hide the value, the label remains.
            // Best to find the PARENT container if possible, or just empty the text.
            // "elimina anche etichetta" -> User wants label gone. 
            // Since I don't see the HTML structure for the parent, I will try to hide the *parent* if it has a specific class or ID, 
            // but `docMarginTotal` is likely just the value. 
            // Let's assume the label is near it.
            // Safe bet: elMargin.parentElement.style.display = 'none' if it contains just that.
            // Or safer: elMargin.textContent = ''; and try to find label.

            // Let's try to set display:none on the element itself.
            // User said "elimina anche etichetta". 
            // I will assume the element `docMarginTotal` might be the container OR I need to hide its parent/sibling.
            // Without HTML, I'll check if I can see where `docMarginTotal` is used in index.html to be sure.
            // But to be quick, I will check index.html first.

            elMargin.textContent = `${formatCurrency(totalMarginVal)} € (${totalMarginPct.toFixed(1)}%)`;
            // Color coding: Warning if below 20%
            if (totalMarginPct < 20) elMargin.style.color = '#ef4444';
            else elMargin.style.color = '#64748b';

            // Ensure parent is visible if we hid it previously
            if (elMargin.closest('.summary-row')) elMargin.closest('.summary-row').style.display = '';

        } else {
            // Hide checking parent
            // Ideally we hide the whole line "Margine: 100€"
            const container = elMargin.closest('div') || elMargin.parentElement;
            if (container && container.textContent.includes('Margine')) {
                container.style.display = 'none';
            } else {
                elMargin.style.display = 'none';
            }
        }
    }

    // Get VAT rate from dropdown
    const vatSelect = document.getElementById('docVatSelect');
    let vatRate = 0.22;
    if (vatSelect) {
        let val = vatSelect.value;
        if (!val) {
            val = '0.22';
            vatSelect.value = '0.22';
        }
        vatRate = parseFloat(val) || 0;
        const vatPrintLabel = document.getElementById('docVatSelectPrintLabel');
        if (vatPrintLabel) {
            if (val === '0_rc') {
                vatPrintLabel.textContent = '0% Reverse Charge — Art. 17, c.6, D.P.R. 633/1972 (N6)';
            } else if (val === '0_apply') {
                vatPrintLabel.textContent = '0% Esente — da applicare (N4)';
            } else {
                const selectedOpt = vatSelect.options[vatSelect.selectedIndex];
                vatPrintLabel.textContent = selectedOpt ? selectedOpt.text : '';
            }
        }
    }

    const vat = sum * vatRate;
    const final = sum + vat;

    // Update DOM
    const elTotal = document.getElementById('docTotal');
    const elVatAmount = document.getElementById('docVatAmount'); // Use specific ID
    const elFinal = document.getElementById('docTotalFinal');

    if (elTotal) elTotal.textContent = formatCurrency(sum) + ' €';
    if (elVatAmount) elVatAmount.textContent = formatCurrency(vat) + ' €';
    if (elFinal) elFinal.textContent = formatCurrency(final) + ' €';

    currentQuote.total = sum; // Taxable
    // Only update if not already matching the correct rate, to prevent overwriting unique string selections (e.g. '0_rc', '0_apply') with numeric 0
    if (currentQuote.vatRate === undefined || currentQuote.vatRate === null || parseFloat(currentQuote.vatRate) !== vatRate) {
        currentQuote.vatRate = vatRate; // Track current rate
    }
    currentQuote.grandTotal = final; // Store final too
}

// --- Year Dropdown Populator ---
window.initExecutionYearOptions = function () {
    const select = document.getElementById('docExecutionYear');
    const filterSelect = document.getElementById('quoteFilterYear');
    const currYear = new Date().getFullYear(); // 2026
    const nextYear = currYear + 1; // 2027

    // Sidebar dropdown: strictly current year (2026) first and next year (2027) following
    if (select && select.options.length <= 1) {
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Seleziona Anno --</option>' +
            `<option value="${currYear}">${currYear}</option>` +
            `<option value="${nextYear}">${nextYear}</option>`;
        if (currentVal) select.value = currentVal;
    }

    // Filter toolbar dropdown: Tutti gli Anni, 2026, 2027
    if (filterSelect && (filterSelect.options.length <= 1 || !filterSelect.value)) {
        const filterYears = [currYear, nextYear];
        if (window.db && window.db.data && window.db.data.quotes) {
            window.db.data.quotes.forEach(q => {
                const y = parseInt(q.executionYear || (q.extra_fields && q.extra_fields.executionYear) || (q.date ? q.date.split('-')[0] : '2026'));
                if (y && !filterYears.includes(y)) filterYears.push(y);
            });
        }
        filterYears.sort((a, b) => b - a);

        const currentVal = (filterSelect.value && filterSelect.value !== '') ? filterSelect.value : 'all';
        filterSelect.innerHTML = '<option value="all">Tutti gli Anni</option>' +
            filterYears.map(y => `<option value="${y}">${y}</option>`).join('');
        filterSelect.value = currentVal;
    }
};

// --- Status UI Logic (Consolidated) ---
window.updateEditorStatusUI = function () {
    const elStatus = document.getElementById('editorStatus');
    const status = elStatus ? elStatus.value : (currentQuote ? currentQuote.status : 'Aperto');
    const isOrder = (status === 'Chiuso' || status === 'Ordine Confermato');
    const isLost = (status === 'Perso');

    // Update Model if triggered by event
    if (currentQuote && elStatus) {
        currentQuote.status = elStatus.value;
    }

    // 1. Status Color on <select> element
    if (elStatus) {
        elStatus.classList.remove('status-open', 'status-closed', 'status-lost');
        elStatus.style.color = '';
        elStatus.style.backgroundColor = '';
        elStatus.style.borderColor = '';

        if (status === 'Aperto') {
            elStatus.classList.add('status-open');
            elStatus.style.setProperty('color', '#1e3a8a', 'important');
            elStatus.style.setProperty('background-color', '#eff6ff', 'important');
            elStatus.style.setProperty('border-color', '#1e3a8a', 'important');
            elStatus.style.setProperty('font-weight', '700', 'important');
        } else if (isOrder) {
            elStatus.classList.add('status-closed');
            elStatus.style.setProperty('color', '#14532d', 'important');
            elStatus.style.setProperty('background-color', '#f0fdf4', 'important');
            elStatus.style.setProperty('border-color', '#14532d', 'important');
            elStatus.style.setProperty('font-weight', '700', 'important');
        } else if (isLost) {
            elStatus.classList.add('status-lost');
            elStatus.style.setProperty('color', '#7f1d1d', 'important');
            elStatus.style.setProperty('background-color', '#fef2f2', 'important');
            elStatus.style.setProperty('border-color', '#7f1d1d', 'important');
            elStatus.style.setProperty('font-weight', '700', 'important');
        }
    }

    // 2. Memo Label Logic
    const lbl = document.getElementById('lblInternalNotes');
    if (elStatus && lbl) {
        if (status === 'Aperto') {
            lbl.textContent = 'Memo';
            lbl.style.color = '#d97706';
            lbl.style.fontWeight = 'bold';
        } else {
            lbl.textContent = 'Appunti Interni (Preventivo)';
            lbl.style.color = '';
            lbl.style.fontWeight = 'normal';
        }
    }

    // 2b. Dynamic Asterisk & Border for Delivery Date & Execution Year based on Status
    const lblDelivery = document.getElementById('lblDeliveryDate');
    const elDeliveryDate = document.getElementById('docDeliveryDate');
    if (lblDelivery && elDeliveryDate) {
        if (isOrder) {
            lblDelivery.innerHTML = 'Data Lavori Prevista <span style="color: #ef4444; font-weight: bold;">*</span>';
            elDeliveryDate.style.borderLeft = '3px solid #ef4444'; // Red border
        } else {
            lblDelivery.textContent = 'Data Lavori Prevista';
            elDeliveryDate.style.borderLeft = '3px solid #f59e0b'; // Yellow/orange border
        }
    }

    const lblExecutionYear = document.getElementById('lblExecutionYear');
    const elExecutionYear = document.getElementById('docExecutionYear');
    if (lblExecutionYear && elExecutionYear) {
        if (isOrder) {
            lblExecutionYear.innerHTML = 'Anno <span style="color: #ef4444; font-weight: bold;">*</span> <i class="fa-solid fa-circle-info" style="color:#3b82f6; cursor:pointer;" title="Anno di esecuzione del lavoro" onclick="showCustomAlert(\'Anno di esecuzione del lavoro\', \'Informazione\')"></i>';
            elExecutionYear.style.borderLeft = '3px solid #ef4444';
        } else {
            lblExecutionYear.innerHTML = 'Anno <i class="fa-solid fa-circle-info" style="color:#3b82f6; cursor:pointer;" title="Anno di esecuzione del lavoro" onclick="showCustomAlert(\'Anno di esecuzione del lavoro\', \'Informazione\')"></i>';
            elExecutionYear.style.borderLeft = '1px solid #cbd5e1';
        }
    }

    // 3. Toggle Signature Blocks
    const sigBlock = document.getElementById('f-signature');
    if (sigBlock) {
        if (isOrder) {
            sigBlock.classList.remove('hidden');
            sigBlock.style.display = 'block';
        } else {
            sigBlock.classList.add('hidden');
            sigBlock.style.display = 'none';
        }
    }
    const signatureSection = document.getElementById('signatureSection');
    if (signatureSection) {
        if (isOrder) {
            signatureSection.classList.remove('hidden');
        } else {
            signatureSection.classList.add('hidden');
        }
    }

    // 4. Change Header Title based on Status
    const printTitle = document.getElementById('printTitle');
    if (printTitle) {
        if (isOrder) {
            printTitle.textContent = "CONFERMA D'ORDINE";
            printTitle.style.color = "#0F9D58";
            printTitle.style.textDecoration = "none";
            printTitle.style.opacity = "1";
        } else if (isLost) {
            printTitle.textContent = "Preventivo";
            printTitle.style.color = "#991b1b";
            printTitle.style.textDecoration = "line-through";
            printTitle.style.opacity = "0.7";
        } else {
            printTitle.textContent = "Preventivo";
            printTitle.style.color = "#cbd5e1";
            printTitle.style.textDecoration = "none";
            printTitle.style.opacity = "1";
        }
    }

    // 5. Auto-Enable Print Totals on Chiuso
    if (isOrder) {
        const toggleTotals = document.getElementById('togglePrintTotals');
        if (toggleTotals && !toggleTotals.checked) {
            toggleTotals.checked = true;
            if (typeof toggleTotalsPrint === 'function') toggleTotalsPrint(true);
        }
    }

    // 6. Toggle Order Confirmation Fields (Tempistiche & Pagamento)
    const confFields = document.getElementById('orderConfirmationFields');
    if (confFields) {
        if (isOrder) {
            confFields.classList.remove('hidden');
            confFields.style.display = 'flex';
        } else {
            confFields.classList.add('hidden');
            confFields.style.display = 'none';
        }
    }

    // 7. Toggle Bottom Bar (Sustainability & Socials) - Hide when Chiuso
    const bottomBar = document.getElementById('f-bottom-bar');
    if (bottomBar) {
        if (isOrder) {
            bottomBar.classList.add('hidden');
            bottomBar.style.display = 'none';
        } else {
            bottomBar.classList.remove('hidden');
            bottomBar.style.display = 'block';
        }
    }

    // 8. Toggle Notes Field (Hide when Chiuso)
    const notesContainer = document.getElementById('notesContainer');
    if (notesContainer) {
        if (isOrder) {
            notesContainer.classList.add('hidden');
            notesContainer.style.display = 'none';
        } else {
            notesContainer.classList.remove('hidden');
            notesContainer.style.display = 'block';
        }
    }
};

// --- Validation Logic ---
window.validateQuote = function () {
    const elAgent = document.getElementById('docAgent');
    const elZone = document.getElementById('docZone');
    const elDeliveryDate = document.getElementById('docDeliveryDate');
    const elStatus = document.getElementById('editorStatus');

    const elJobType = document.getElementById('docJobType');
    const elMaterial = document.getElementById('docMaterial');
    const elContact = document.getElementById('docContact');

    const agent = elAgent ? elAgent.value.trim() : '';
    const zone = elZone ? elZone.value.trim() : '';
    const status = elStatus ? elStatus.value : 'Aperto';
    const deliveryDate = elDeliveryDate ? elDeliveryDate.value : '';
    const jobType = elJobType ? elJobType.value : '';
    const material = elMaterial ? elMaterial.value : '';
    const contact = elContact ? elContact.value : '';

    if (!agent || agent === '' || agent === 'null' || agent === 'undefined') {
        showCustomAlert("L'Agente di Riferimento è obbligatorio. Seleziona un agente.");
        if (elAgent) setTimeout(() => elAgent.focus(), 300); // Focus after a bit
        return false;
    }
    if (!zone || zone === '' || zone === 'null' || zone === 'undefined') {
        showCustomAlert("La Zona / Area è obbligatoria. Seleziona una zona.");
        if (elZone) setTimeout(() => elZone.focus(), 300);
        return false;
    }
    if (!jobType) {
        showCustomAlert("Il Tipo Lavoro è obbligatorio. Effettua una selezione.");
        if (elJobType) setTimeout(() => elJobType.focus(), 300);
        return false;
    }
    if (!material) {
        showCustomAlert("Il Materiale Principale è obbligatorio. Effettua una selezione.");
        if (elMaterial) setTimeout(() => elMaterial.focus(), 300);
        return false;
    }
    if (!contact) {
        showCustomAlert("L'Origine Contatto è obbligatoria. Effettua una selezione.");
        if (elContact) setTimeout(() => elContact.focus(), 300);
        return false;
    }

    // Delivery Date & Execution Year mandatory ONLY if Closed
    const elExecutionYear = document.getElementById('docExecutionYear');
    const executionYear = elExecutionYear ? elExecutionYear.value : '';
    if (status === 'Chiuso') {
        if (!deliveryDate) {
            showCustomAlert("La Data Lavori Prevista è obbligatoria per confermare l'ordine (Stato: Chiuso).");
            if (elDeliveryDate) setTimeout(() => elDeliveryDate.focus(), 300);
            return false;
        }
        if (!executionYear) {
            showCustomAlert("L'Anno di esecuzione del lavoro è obbligatorio quando lo stato è 'Chiuso'. Seleziona l'Anno.");
            if (elExecutionYear) setTimeout(() => elExecutionYear.focus(), 300);
            return false;
        }
    }

    return true;
};

// --- Custom Alert Helpers ---
window.showCustomAlert = function (message, title = "Attenzione") {
    const modal = document.getElementById('customAlertModal');
    const msgEl = document.getElementById('customAlertMessage');
    const titleEl = document.getElementById('customAlertTitle');

    if (modal && msgEl) {
        msgEl.textContent = message;
        if (titleEl) titleEl.textContent = title;
        modal.classList.remove('hidden');
    } else {
        // Fallback if modal missing
        alert(message);
    }
};

window.closeCustomAlert = function () {
    const modal = document.getElementById('customAlertModal');
    if (modal) modal.classList.add('hidden');
};

// --- PDF Export & Sharing Logic (html2pdf) ---

window.getPDFOptions = function () {
    let filename;
    if (currentQuote.status === 'Chiuso') {
        // Format: Surname Name Conferma d'ordine
        const surname = currentQuote.customer?.surname || '';
        const name = currentQuote.customer?.name || 'Cliente';
        const fullName = [surname, name].filter(Boolean).join(' ').trim();
        filename = `${fullName} Conferma d'ordine.pdf`;
    } else {
        // Standard format: Preventivo_Number_Surname_Name
        const surname = currentQuote.customer?.surname || '';
        const name = currentQuote.customer?.name || 'Cliente';
        const fullName = [surname, name].filter(Boolean).join('_').trim().replace(/[^a-z0-9_]/gi, '_');
        filename = `Preventivo_${currentQuote.number || 'Draft'}_${fullName}.pdf`;
    }
    return {
        margin: [0, 0, 0, 0], // Margini 0 perché gestiti dal CSS del #printArea
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        enableLinks: true,
        html2canvas: {
            scale: 2,
            allowTaint: true, // Permette export di canvas con immagini locali
            useCORS: false, // Disabilitato per file locali
            logging: false,
            scrollY: 0,
            windowWidth: 794 // A4 width in px
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
};

window.saveQuoteToPDF = async function () {
    if (!currentQuote || !currentQuote.customer) {
        alert("Nessun preventivo caricato.");
        return;
    }

    try {
        // 💾 AUTO-SAVE: Salva il preventivo su Genesy prima del download PDF
        if (currentQuote.id && window.db && window.db.saveQuote) {
            currentQuote.pdfSavedDate = new Date().toISOString();
            try {
                await db.saveQuote(currentQuote);
                editorIsDirty = false;

            } catch (saveErr) {
                console.error("⚠️ Errore salvataggio pre-PDF:", saveErr);
            }
        }

        let fileName;
        if (currentQuote.status === 'Chiuso') {
            // Format: Surname Name Conferma d'ordine
            const surname = currentQuote.customer?.surname || '';
            const name = currentQuote.customer?.name || 'Cliente';
            const fullName = [surname, name].filter(Boolean).join(' ').trim();
            fileName = `${fullName} Conferma d'ordine.pdf`;

        } else {
            // Standard format: Preventivo_Surname_Name_QuoteId
            const surname = currentQuote.customer?.surname || '';
            const name = currentQuote.customer?.name || 'Cliente';
            const fullName = [surname, name].filter(Boolean).join('_').trim().replace(/[^a-z0-9_]/gi, '_');
            const quoteId = currentQuote.number ? `N.${currentQuote.number}` : (currentQuote.id || 'Draft');
            fileName = `Preventivo_${fullName}_${quoteId}.pdf`;

        }

        // Generate HTML Content
        const content = generateQuoteHTML(currentQuote);

        // Create a temporary container
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = content;

        // FORCE EXACT A4 SIZE @ 96DPI
        // FORCE EXACT A4 SIZE @ 96DPI
        tempContainer.style.width = '794px';
        tempContainer.style.height = '1123px';
        tempContainer.style.position = 'fixed'; // Use fixed to ensure it's in viewport
        tempContainer.style.left = '0';
        tempContainer.style.top = '0';
        tempContainer.style.zIndex = '9999'; // ON TOP to ensure rendering
        tempContainer.style.background = 'white'; // Ensure background is white
        tempContainer.style.overflow = 'hidden'; // Cut off any overflow beyond one page

        document.body.appendChild(tempContainer);

        // Small delay to ensure rendering
        await new Promise(r => setTimeout(r, 200));

        document.body.appendChild(tempContainer);

        const opt = {
            margin: 0,
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2, // Higher scale for better quality
                useCORS: true,
                letterRendering: true,
                windowWidth: 794,
                windowHeight: 1123
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: 'avoid-all' }
        };

        // Output to Blob and Download
        await html2pdf().set(opt).from(tempContainer).save();

        document.body.removeChild(tempContainer);
        // showCustomSuccess("PDF Scaricato con successo!");

    } catch (e) {
        console.error("PDF Error:", e);
        alert("Errore generazione PDF: " + e.message);
    }
};

window.printQuote = async function () {
    if (!validateQuote()) return;

    // Mark as synced/saved since user is printing/saving to PDF
    if (currentQuote) {
        currentQuote.driveSyncDate = new Date().toISOString();
        await db.saveQuote(currentQuote);
        editorIsDirty = false; // Autosave confirmation
    }

    // --- PDF FILENAME LOGIC FOR BROWSER PRINT ---
    // Ensure title is up to date globally
    window.updateDocumentTitle();

    // Add afterprint listener to ask if PDF was saved
    const afterPrintHandler = async () => {
        window.removeEventListener('afterprint', afterPrintHandler);

        // Ask user if they saved as PDF
        if (confirm('Hai salvato il preventivo come PDF?')) {
            if (currentQuote) {
                currentQuote.pdfSavedDate = new Date().toISOString();
                await db.saveQuote(currentQuote);
            }
        }
    };

    window.addEventListener('afterprint', afterPrintHandler);
    window.print(); // Native print

};

window.downloadQuotePDF = async function () {
    if (!validateQuote()) return;

    // Mark as synced/saved
    if (currentQuote) {
        currentQuote.driveSyncDate = new Date().toISOString();
        await db.saveQuote(currentQuote);
    }

    // Usa la stampa nativa del browser
    alert('Usa la funzione di stampa del browser (Ctrl+P o Cmd+P) e seleziona "Salva come PDF" come destinazione.');

    // --- PDF FILENAME LOGIC FOR DOWNLOAD ---
    window.updateDocumentTitle();

    // DEBUG ALERT (Removed)

    window.print();
};

window.toggleTotalsPrint = function (show) {
    const block = document.getElementById('totalsSectionBlock');
    const msg = document.getElementById('msgVatApply');

    if (block) {
        if (show) {
            block.classList.remove('no-print');
            block.style.display = ''; // Show the block
        } else {
            block.classList.add('no-print');
            block.style.display = 'none'; // Hide the block
        }
    }

    if (msg) {
        if (show) msg.style.display = 'none';
        else msg.style.display = 'block';
    }
};


window.updateClosingWithScope = function () {
    const container = document.getElementById('scopeCheckboxes');
    if (!container) return;

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');

    // Dependency Rule: If "battiscopa" is unchecked, force uncheck "Sfrido* battiscopa"
    // Find specific elements first
    let cbBattiscopa = null;
    let cbSfridoBattiscopa = null;

    checkboxes.forEach(cb => {
        if (cb.value === 'battiscopa') cbBattiscopa = cb;
        if (cb.value === 'Sfrido* battiscopa') cbSfridoBattiscopa = cb;
    });

    if (cbBattiscopa && !cbBattiscopa.checked && cbSfridoBattiscopa && cbSfridoBattiscopa.checked) {
        cbSfridoBattiscopa.checked = false;
    }

    const checkedValues = [];

    checkboxes.forEach(cb => {
        // Toggle Print Visibility based on checked state
        // Parent is the label
        if (cb.parentElement) {
            if (cb.checked) {
                cb.parentElement.classList.remove('no-print');
                checkedValues.push(cb.value);
            } else {
                cb.parentElement.classList.add('no-print');
            }
        }
    });

    // const values = Array.from(checkboxes).map(cb => cb.value); // Old logic
    const values = checkedValues;

    // Persist to Model
    currentQuote.inclusions = checkedValues;

    // Hide/Show the header label based on whether any checkbox is checked
    const sectionHeader = document.getElementById('section-closing-text');
    if (sectionHeader) {
        const headerLabel = sectionHeader.querySelector('label');
        if (headerLabel) {
            if (checkedValues.length === 0) {
                // All unchecked - hide the label
                headerLabel.style.display = 'none';
            } else {
                // At least one checked - show the label
                headerLabel.style.display = 'block';
            }
        }
    }

    // Trigger dirty state (removed text generation logic)
    editorIsDirty = true;
}

// --- Address Copy Helper ---
window.copyClientAddressToSite = function () {
    if (!currentQuote || !currentQuote.customer) {
        showCustomAlert("Seleziona prima un cliente.");
        return;
    }

    // Try to get address from current quote object (if already enriched)
    // OR look up in DB to be sure we have the latest
    let address = currentQuote.customer.street || '';
    if (currentQuote.customer.city) address += `, ${currentQuote.customer.city}`;

    // If empty in quote object, look up client by ID
    if (!address || address.trim() === ',') {
        const clients = db.getClients();
        const client = clients.find(c => c.id == currentQuote.customer.id || c.name === currentQuote.customer.name);
        if (client) {
            address = client.street || '';
            if (client.city) address += `, ${client.city}`;
        }
    }

    if (!address || address.trim() === ',' || address.trim() === '') {
        showCustomAlert("Indirizzo non presente nell'anagrafica cliente.");
        return;
    }

    const el = document.getElementById('docSiteAddress');
    if (el) {
        el.value = address;
        el.classList.add('input-flash'); // Add visual feedback class if it exists
        setTimeout(() => el.classList.remove('input-flash'), 500);
        // showCustomSuccess("Indirizzo copiato!");
    }
};

// --- Sync Indicator Helpers ---
window.showSyncStatus = function () {
    const el = document.getElementById('syncIndicator');
    if (el) el.classList.remove('hidden');
};

window.hideSyncStatus = function () {
    const el = document.getElementById('syncIndicator');
    if (el) el.classList.add('hidden');
};

// --------------------------------------------------------------------------------
// MODALS
// --------------------------------------------------------------------------------

// --- Global Save Lock ---
let isSaving = false;

window.saveCurrentQuote = async function () {
    if (isSaving) return; // Block double submissions

    if (!validateQuote()) return;

    // Show Sync Indicator
    showSyncStatus();

    // 1. Capture Editor Inputs (Always sync DOM to Object first)
    // ---------------------------------------------------------
    const today = new Date().toISOString().split('T')[0];
    const docDate = document.getElementById('docDate');

    // Get current date from field (what user sees/modified)
    const currentDateInField = docDate ? docDate.value : currentQuote.date;

    // Check if the date is different from today (manual modification or old quote)
    if (currentDateInField && currentDateInField !== today) {
        // Format dates for display
        const customDate = new Date(currentDateInField);
        const formattedCustom = customDate.toLocaleDateString('it-IT');
        const formattedToday = new Date(today).toLocaleDateString('it-IT');

        // Ask for confirmation
        const useCustomDate = confirm(
            `⚠️ ATTENZIONE - Data Diversa da Oggi\n\n` +
            `Data attuale del preventivo:\n` +
            `📅 ${formattedCustom}\n\n` +
            `Data odierna:\n` +
            `📅 ${formattedToday}\n\n` +
            `Vuoi MANTENERE la data del preventivo?\n\n` +
            `• OK = Mantieni data (${formattedCustom})\n` +
            `• Annulla = Aggiorna ad oggi (${formattedToday})`
        );

        if (useCustomDate) {
            // Keep existing date
            currentQuote.date = currentDateInField;
            if (docDate) docDate.value = currentDateInField;
        } else {
            // Update to today
            currentQuote.date = today;
            if (docDate) docDate.value = today;
        }
    } else {
        // Date is already today or empty - auto-update to today (default behavior)
        if (docDate) {
            docDate.value = today;
            currentQuote.date = today;
        } else {
            currentQuote.date = today;
        }
    }

    const docStatus = document.getElementById('editorStatus');
    if (docStatus) currentQuote.status = docStatus.value;

    const docAgent = document.getElementById('docAgent');
    if (docAgent) currentQuote.agent = docAgent.value;

    const docZone = document.getElementById('docZone');
    if (docZone) currentQuote.zone = docZone.value;

    const docJobType = document.getElementById('docJobType');
    if (docJobType) currentQuote.jobType = docJobType.value;

    const docMaterial = document.getElementById('docMaterial');
    if (docMaterial) currentQuote.material = docMaterial.value;

    const docContact = document.getElementById('docContact');
    if (docContact) currentQuote.contact = docContact.value;

    const docExecutionYear = document.getElementById('docExecutionYear');
    if (docExecutionYear) currentQuote.executionYear = docExecutionYear.value;

    // NEW FIELDS
    const docWarehouse = document.getElementById('docWarehouse');
    if (docWarehouse) currentQuote.warehouse = docWarehouse.value;

    // IMPORTANT: Capture Side Address (Indirizzo Cantiere)
    const docSiteAddr = document.getElementById('docSiteAddress');
    if (docSiteAddr) currentQuote.siteAddress = docSiteAddr.value;

    const docSiteCity = document.getElementById('docSiteCity');
    if (docSiteCity) currentQuote.siteCity = docSiteCity.value;

    const docSiteZip = document.getElementById('docSiteZip');
    if (docSiteZip) currentQuote.siteZip = docSiteZip.value;

    const docSiteProv = document.getElementById('docSiteProvince');
    if (docSiteProv) currentQuote.siteProvince = docSiteProv.value;

    const docDeliveryAddress = document.getElementById('docDeliveryAddress');
    if (docDeliveryAddress) currentQuote.deliveryAddress = docDeliveryAddress.value;

    const docNotes = document.getElementById('docNotes');
    if (docNotes) currentQuote.notes = docNotes.value;

    // Timeline & Payment Terms (Editable DIVs)
    const elTimeline = document.getElementById('docTimeline');
    if (elTimeline) currentQuote.timeline = elTimeline.innerHTML;

    const elPaymentTerms = document.getElementById('docPaymentTerms');
    if (elPaymentTerms) currentQuote.paymentTerms = elPaymentTerms.innerHTML;

    // Correct mapping for Internal Notes (HTML ID: docInternalNotes -> Model: internalNotes)
    const docInternalNotes = document.getElementById('docInternalNotes');
    if (docInternalNotes) {
        currentQuote.internalNotes = docInternalNotes.value;
        // Legacy/Redundant property cleanup if desired, or keep sync
        currentQuote.notesInternal = docInternalNotes.value;
    }

    // Capture Reference field
    const docReference = document.getElementById('docReference');
    if (docReference) currentQuote.reference = docReference.value;

    // Logistics
    const docDel = document.getElementById('docDeliveryDate');
    if (docDel) currentQuote.deliveryDate = docDel.value;

    // docSiteAddress handled above explicitly

    const docCont = document.getElementById('docSiteContactName');
    if (docCont) currentQuote.siteContactName = docCont.value;

    const docRef = document.getElementById('docSiteContactReference');
    if (docRef) currentQuote.siteContactReference = docRef.value;

    const docRole = document.getElementById('docSiteContactRole');
    if (docRole) currentQuote.siteContactRole = docRole.value;

    const docPhone = document.getElementById('docSiteContactPhone');
    if (docPhone) currentQuote.siteContactPhone = docPhone.value;

    const docBank = document.getElementById('docBank');
    if (docBank) currentQuote.bank = docBank.value;

    // Explicit VAT Capture
    const docVatSelect = document.getElementById('docVatSelect');
    if (docVatSelect) {
        currentQuote.vatRate = docVatSelect.value; // Store raw value (string) so choice persists
    }

    // Update Date Placeholder
    const datePlaceholder = document.getElementById('printDatePlaceholder');
    if (datePlaceholder && currentQuote.date) {
        const d = new Date(currentQuote.date);
        if (!isNaN(d.getTime())) {
            datePlaceholder.textContent = `Data: ${d.toLocaleDateString('it-IT')}`;
        }
    }

    const elLegalNotes = document.getElementById('docLegalNotes');
    if (elLegalNotes) currentQuote.legalNotes = elLegalNotes.innerHTML;

    // Ensure inclusions is captured/initialized if never touched
    if (!currentQuote.inclusions) {
        const scopeContainer = document.getElementById('scopeCheckboxes');
        if (scopeContainer) {
            const checkboxes = scopeContainer.querySelectorAll('input[type="checkbox"]:checked');
            currentQuote.inclusions = Array.from(checkboxes).map(cb => cb.value);
        }
    }

    const elLegalGlossary = document.getElementById('docLegalGlossary');
    if (elLegalGlossary) currentQuote.legalGlossary = elLegalGlossary.innerHTML;

    // Calculate Totals
    updateDocTotal();

    // 2. Validate Data
    // ----------------
    if (!currentQuote.customer) {
        alert("Attenzione: Nessun cliente selezionato!");
        return;
    }
    if (!currentQuote.items || currentQuote.items.length === 0) {
        if (!confirm("Attenzione: Il preventivo non ha righe. Vuoi salvare comunque?")) return;
    }

    // LOCK UI
    isSaving = true;
    const saveBtn = document.getElementById('btnSaveQuote');
    // Ensure we don't capture the spinner itself as the original text
    const originalBtnText = saveBtn ? (saveBtn.innerHTML.includes('spinner') ? '<i class="fa-solid fa-save"></i> Salva Preventivo' : saveBtn.innerHTML) : '';

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvataggio...';
        saveBtn.style.opacity = '0.7';
    }

    try {
        // 2b. Check for duplicates (Client Name)
        // --------------------------------------
        if (currentQuote.customer && currentQuote.customer.name) {
            const clientName = currentQuote.customer.name.trim().toLowerCase();
            // Check local cache for duplicates
            if (window.db && window.db.data && window.db.data.quotes) {
                const existing = window.db.data.quotes.filter(q =>
                    q.customer &&
                    q.customer.name &&
                    q.customer.name.trim().toLowerCase() === clientName &&
                    q.id != currentQuote.id && // Loose equality for safety (string vs number)
                    q.status !== 'Cestinato'
                );

                if (existing.length > 0) {
                    const confirmDup = await showCustomConfirmAsync(
                        `Esistono già ${existing.length} preventivi per il cliente "${currentQuote.customer.name}".\nVuoi procedere con il salvataggio?`,
                        "Cliente già presente"
                    );
                    if (!confirmDup) {
                        isSaving = false;
                        if (saveBtn) {
                            saveBtn.disabled = false;
                            saveBtn.innerHTML = originalBtnText;
                            saveBtn.style.opacity = '1';
                        }
                        return;
                    }
                }
            }
        }

        // 3. DECISION POINT: Overwrite or New?
        // ------------------------------------
        // docStatus is already defined at start of function
        const isClosed = (docStatus && docStatus.value === 'Chiuso') || currentQuote.status === 'Chiuso';

        if (currentQuote.id || isClosed) {
            // Existing Quote OR New Quote that is Closed -> Prompt User
            // (If New & Closed, we want to offer the Rename/Save as Order flow)
            openModal('saveChoiceModal');

            // RELEASE LOCK HERE because control passes to Modal Buttons
            // (The modal prevents interaction with the main save button anyway, 
            // but we reset state so if they Cancel the modal, they can try again)
            isSaving = false;
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnText;
                saveBtn.style.opacity = '1';
            }
            return; // WAITING FOR USER INPUT via Modal
        } else {
            // It's a new quote (Open/Draft) -> Proceed directly

            // TIMEOUT WRAPPER to prevent infinite spinner
            await Promise.race([
                _executeSave(false),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout: Il salvataggio sta impiegando troppo tempo.")), 15000))
            ]);

            // Lock release is handled inside finally block
        }

    } catch (e) {
        console.error(e);
        alert("Errore durante il salvataggio: " + e.message);
    } finally {
        // Unlock (if we didn't return early for Modal)
        // We check if isSaving is true because if we opened modal, we already set it false.
        if (isSaving) {
            isSaving = false;
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnText;
                saveBtn.style.opacity = '1';
            }
        }
        hideSyncStatus();
    }
};

// --- SAVE HELPERS ---

window.confirmSaveOption = async function (mode) {
    closeModal('saveChoiceModal');
    if (mode === 'overwrite') {
        await _executeSave(false); // Overwrite existing ID
    } else if (mode === 'new') {
        // OLD: _executeSave(true);
        // NEW: Open Rename Modal
        const renameModal = document.getElementById('renameInputModal');
        const renameInput = document.getElementById('renameQuoteInput');
        if (renameModal && renameInput) {
            // Preserve both surname and name
            let baseName = '';
            if (currentQuote.customer) {
                const surname = currentQuote.customer.surname || '';
                const name = currentQuote.customer.name || '';
                baseName = [surname, name].filter(Boolean).join(' ').trim();
            }

            // NOTE: Do NOT add "Conferma d'ordine" suffix here!
            // The suffix is automatically added by updateDocumentTitle() and PDF generation functions
            // based on the quote status. Adding it here would cause duplications when re-saving.

            renameInput.value = baseName;
            renameModal.classList.remove('hidden');
            renameInput.focus();
        } else {
            // Fallback
            await _executeSave(true);
        }
    }
};

window.confirmRenameAndSave = async function () {
    const input = document.getElementById('renameQuoteInput');
    if (!input) return;
    const newName = input.value.trim();

    if (!newName) {
        alert("Inserisci un nome valido.");
        return;
    }

    // Update Customer Name
    if (!currentQuote.customer) currentQuote.customer = {};

    // Build the original full name the same way confirmSaveOption does
    const originalSurname = currentQuote.customer.surname || '';
    const originalName = currentQuote.customer.name || '';
    const originalFullName = [originalSurname, originalName].filter(Boolean).join(' ').trim();

    if (newName !== originalFullName) {
        // Name was manually changed -> unlink client ID and store the new name flat
        // Clear surname to avoid double-concatenation (e.g. "Rossi Mario Rossi Mario")
        currentQuote.customer.id = null;
        currentQuote.customer.surname = '';
        currentQuote.customer.name = newName;
    }
    // If the name is unchanged, leave the customer object untouched (preserves name + surname correctly)

    // Close Modal
    closeModal('renameInputModal');

    // Execute Save as NEW COPY
    await _executeSave(true);
};

window._executeSave = async function (forceNew = false) {
    let giobbyExportNeeded = false;

    // Logic for Status Change / Giobby Trigger
    // We need to re-check status change logic here?
    // Actually, capture logic set currentQuote.status.
    // If it's a NEW copy, oldStatus is technically undefined for the new entry, so no comparison needed usually?
    // Or we consider it "New" status?
    // Let's assume strict logic: trigger export only if user explicitly changed to Closed.
    // If we save as new, it's a new quote. Does it inherit 'Chiuso'? 
    // Usually 'Save as New' implies a new proposal, maybe should reset status to 'Aperto'?
    // User didn't specify, but standard practice is Reset to Open.
    // However, user might want to clone a sold quote.
    // Let's KEEP user selection but maybe force 'Aperto' if it was 'Chiuso'?
    // For now, respect what is on screen (docStatus.value).

    const docStatus = document.getElementById('editorStatus');
    const newStatus = docStatus ? docStatus.value : currentQuote.status;

    // Giobby Logic (Simplified for this refactor, relying on currentQuote.status)
    // We already updated currentQuote.status in capture phase.

    if (forceNew) {
        // EXCLUDE ORIGINAL QUOTE FROM STATISTICS IF CLOSED
        // When creating a new copy of a closed quote, mark the original as excluded from stats
        const originalQuoteId = currentQuote.id;
        if (originalQuoteId && newStatus === 'Chiuso') {
            try {
                const originalQuote = db.getQuote(originalQuoteId);
                if (originalQuote && !originalQuote.excludeFromStats) {
                    originalQuote.excludeFromStats = true;
                    await db.saveQuote(originalQuote);
                }
            } catch (err) {
                console.warn('Failed to exclude original quote from statistics:', err);
            }
        }

        // RESET IDENTITY
        currentQuote.id = null;
        currentQuote.number = null; // Let DB assign new number
        currentQuote.createdAt = null;
        currentQuote.giobbyDocumentId = null; // Reset Giobby link so copy is treated as new
        currentQuote.giobbySyncDate = null;
        // Optional: Reset Status to 'Aperto' automatically on copy?
        // currentQuote.status = 'Aperto'; // Uncomment if desired
        // If we reset, update UI too:
        // if (docStatus) docStatus.value = 'Aperto';
    } else {
    }

    /* Track changes for Giobby Export (Legacy Check) */
    /* Note: Ideally we compare against DB state, but we don't have it handy here easily without re-fetch.
       We rely on the fact that if it's 'Chiuso', we might want to ensure export. */
    // if (currentQuote.status === 'Chiuso') {
    //     // DISABLING AUTO-EXPORT PER USER REQUEST (2025-01-23)
    //     // giobbyExportNeeded = true;
    // }

    // Track Sales Cycle
    if (currentQuote.status === 'Chiuso' && !currentQuote.acceptedAt) {
        currentQuote.acceptedAt = new Date().toISOString();
    }

    try {
        // AUTO-SAVE NEW EXTRA ITEMS
        if (typeof autoHarvestExtraItems === 'function') {
            await autoHarvestExtraItems(currentQuote);
        }

        // --- NEW: SYNC CLIENT DATA BACK TO REGISTRY ---
        if (currentQuote.customer && currentQuote.customer.id) {
            try {
                // Fetch fresh reference
                const clientToUpdate = window.db.getClients().find(c => c.id == currentQuote.customer.id);
                if (clientToUpdate) {
                    let clientDirty = false;

                    // Sync: Referente Cantiere (Quote) -> Referente in loco (Client.contactPerson)
                    const qContact = (currentQuote.siteContactName || '').trim();
                    const cContact = (clientToUpdate.contactPerson || '').trim();
                    if (qContact && qContact !== cContact) {
                        clientToUpdate.contactPerson = qContact;
                        clientDirty = true;
                    }

                    // Sync: Referente Contatto (Quote) -> Provenienza contatto (Client.origin)
                    const qOrigin = (currentQuote.siteContactReference || '').trim();
                    const cOrigin = (clientToUpdate.origin || '').trim();
                    if (qOrigin && qOrigin !== cOrigin) {
                        clientToUpdate.origin = qOrigin;
                        clientDirty = true;
                    }

                    if (clientDirty) {
                        await window.db.saveClient(clientToUpdate);
                    }
                }
            } catch (errSync) {
                console.warn("Client Sync Warning:", errSync);
                // Non-blocking
            }
        }
        // ----------------------------------------------

        const savedId = await db.saveQuote(currentQuote);
        currentQuote.id = savedId; // Update ID with real one (returned by DB)

        // Save to Drive via Print Dialog (Workflow)
        // MOVED TO MODAL ACTION BUTTON
        // We now just show the success modal with the "Save PDF" button enabled for all saves.

        editorIsDirty = false;

        // Success Modal
        const successMsg = forceNew ? "Salvato come NUOVO preventivo!" : "Preventivo aggiornato con successo!";
        showCustomSuccess(successMsg, "Operazione Completata", false); // false = hide Drive Button

        // GIOBBY EXPORT
        if (giobbyExportNeeded && window.exportQuoteToGiobby) {
            await window.exportQuoteToGiobby(currentQuote);
            editorIsDirty = false; // Force clean state after export
        }

        // Refresh Lists
        updateDashboard();
        renderRemindersWidget();

        // Update Title with new data (ID, verify client name)
        updateDocumentTitle();

    } catch (e) {
        console.error("Save Error:", e);
        showCustomAlert("Errore CRITICO durante il salvataggio: " + e.message);
    } finally {
        isSaving = false;

        // Always reset the save button state
        const saveBtn = document.getElementById('btnSaveQuote');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-save"></i> Salva Preventivo';
            saveBtn.style.opacity = '1';
        }

        hideSyncStatus();
    }
};

// --- Custom Confirmation / Success Helpers ---

window.showCustomSuccess = function (message, title = "Operazione Completata", showDriveButton = false) {
    const modal = document.getElementById('customSuccessModal');
    const msgEl = document.getElementById('customSuccessMessage');
    const titleEl = document.getElementById('customSuccessTitle');
    // Drive Button Logic Removed as requested

    if (modal && msgEl) {
        msgEl.textContent = message;
        if (titleEl) titleEl.textContent = title;

        modal.classList.remove('hidden');
    }
};

/**
 * Updates the editor logo based on the selected agent.
 * Requested by user: Change to Bologna logo if agent is Filippo Mondello.
 */
window.updateEditorLogo = function () {
    const agentSelect = document.getElementById('docAgent');
    const logoImg = document.getElementById('editorLogoImg');

    if (!agentSelect || !logoImg) return;

    const val = agentSelect.value || '';
    const text = agentSelect.options[agentSelect.selectedIndex] ? agentSelect.options[agentSelect.selectedIndex].text : '';
    // const opts = Array.from(agentSelect.options).map(o => o.value).join(', ');

    // NORMALIZE
    const vNorm = val.trim().toLowerCase();
    const tNorm = text.trim().toLowerCase();

    // Also check currentQuote.agent as fallback source of truth
    let modelAgent = '';
    if (typeof currentQuote !== 'undefined' && currentQuote && currentQuote.agent) {
        modelAgent = currentQuote.agent.trim().toLowerCase();
    }

    // ARRAY OF TARGET NAMES
    const bolognaTargets = ['filippo mondello', 'mondello filippo', 'f.mondello@parquetbologna.net'];
    const venetoTargets = ['gallon marco', 'marco gallon', 'm.gallon@parquetveneto.it'];

    const isBologna = bolognaTargets.includes(vNorm) || bolognaTargets.includes(tNorm) || bolognaTargets.includes(modelAgent);
    const isVeneto = venetoTargets.includes(vNorm) || venetoTargets.includes(tNorm) || venetoTargets.includes(modelAgent);

    if (isBologna) {
        if (!logoImg.src.includes('logo_bologna.png')) {
            logoImg.src = 'logo_bologna.png';
        }
    } else if (isVeneto) {
        if (!logoImg.src.includes('logo_parquet_veneto.png')) {
            logoImg.src = 'logo_parquet_veneto.png';
        }
    } else {
        if (!logoImg.src.includes('logo_parquet_romagna_final.png')) {
            logoImg.src = 'logo_parquet_romagna_final.png';
        }
    }
};


window.closeCustomSuccess = function () {
    const modal = document.getElementById('customSuccessModal');
    if (modal) modal.classList.add('hidden');
};

// Async Confirm Wrapper
window.showCustomConfirmAsync = function (message, title = "Attenzione", style = "warning") {
    return new Promise((resolve) => {
        const modal = document.getElementById('customConfirmModal');
        const msgEl = document.getElementById('customConfirmMessage');
        const titleEl = document.getElementById('customConfirmTitle');
        const iconWrapper = document.getElementById('customConfirmIconWrapper');
        const icon = document.getElementById('customConfirmIcon');

        if (modal && msgEl) {
            msgEl.textContent = message;
            if (titleEl) titleEl.textContent = title;

            // STYLE HANDLING
            if (style === 'proposal' || style === 'info') {
                // Friendly Blue Style
                if (iconWrapper) iconWrapper.style.background = '#dbeafe'; // Blue-100
                if (icon) {
                    icon.className = 'fa-solid fa-cloud-arrow-up fa-2x'; // Cloud Upload
                    icon.style.color = '#3b82f6'; // Blue-500
                }
            } else {
                // Default Warning Style
                if (iconWrapper) iconWrapper.style.background = '#fef9c3'; // Yellow-100
                if (icon) {
                    icon.className = 'fa-solid fa-triangle-exclamation fa-2x';
                    icon.style.color = '#eab308'; // Yellow-500
                }
            }

            modal.classList.remove('hidden');

            // Override global callback
            window.closeCustomConfirm = function (result) {
                modal.classList.add('hidden');
                resolve(result);
            };
        } else {
            // Fallback
            resolve(confirm(message));
        }
    });
};


// Auto-Backup Check (PRE-SAVE to preserve User Gesture)

// Duplicate saveCurrentQuote removed.

// (initResizeLogoScale — using improved version below ~3779 that preserves translate)

// --- Logo Dragging Logic (Pan) ---
window.initLogoDrag = function (e) {
    e.preventDefault();
    e.stopPropagation();

    const img = document.querySelector('#h-logo-group img');
    if (!img) return;

    // Current Translate
    const style = window.getComputedStyle(img);
    const transform = style.transform;
    let currentX = 0;
    let currentY = 0;
    let currentScale = 1.5;

    // Parse Matrix (complex because we have scale + translate mixed if not carefully handled)
    // Simpler approach: read inline style if set, or maintain state variable. 
    // But inline style might be 'scale(1.5)'. We should append translate.
    // Let's parse the inline string manually for simplicity since we control it.

    // Parse Scale
    if (img.style.transform && img.style.transform.includes('scale')) {
        const match = img.style.transform.match(/scale\(([^)]+)\)/);
        if (match) currentScale = parseFloat(match[1]);
    }

    // Parse Translate
    if (img.style.transform && img.style.transform.includes('translate')) {
        const match = img.style.transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
        if (match) {
            currentX = parseFloat(match[1]);
            currentY = parseFloat(match[2]);
        }
    }

    const startX = e.clientX;
    const startY = e.clientY;

    function onMouseMove(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        const newX = currentX + dx;
        const newY = currentY + dy;

        // Apply
        updateLogoTransform(img, currentScale, newX, newY);
    }

    function onMouseUp(e) {
        // Finalize state (logic handles it by reading inline style next time)
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function updateLogoTransform(img, scale, x, y) {
    img.style.transform = `scale(${scale}) translate(${x}px, ${y}px)`;
}
// Modify Scale logic to preserve translate
window.initResizeLogoScale = function (e) {
    e.preventDefault();
    e.stopPropagation();

    const img = document.querySelector('#h-logo-group img');
    if (!img) return;

    // Get current state
    let currentScale = 1.5;
    let currentX = 0;
    let currentY = 0;

    if (img.style.transform) {
        // Scale
        const matchS = img.style.transform.match(/scale\(([^)]+)\)/);
        if (matchS) currentScale = parseFloat(matchS[1]);

        // Translate
        const matchT = img.style.transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
        if (matchT) {
            currentX = parseFloat(matchT[1]); // Note: Translate is applied AFTER scale implies value scaled? 
            // Standard CSS: transform functions are applied right to left. 
            // `scale(s) translate(tb)` -> Translate then Scale. 
            // `translate(tx, ty) scale(s)` -> Scale then Translate.
            // Our update function uses `scale() translate()`. 
            // So we are scaling... and translating in SCALED coordinate system? No, standard flow.
            // Actually, `transform: scale(1.5) translate(10px, 0)` means:
            // 1. Translate 10px to right.
            // 2. Scale result by 1.5. 
            // So visual shift is 15px?
            // Let's stick to updateLogoTransform convention.
            currentY = parseFloat(matchT[2]);
        }
    }

    const startY = e.clientY;

    function onMouseMove(e) {
        const dy = startY - e.clientY;
        const delta = dy / 200;
        let newScale = currentScale + delta;

        // Limits
        if (newScale < 0.5) newScale = 0.5;
        if (newScale > 3.0) newScale = 3.0;

        updateLogoTransform(img, newScale, currentX, currentY);
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

let clientClickTimer = null;

window.handleClientBoxClick = function () {
    if (clientClickTimer) {
        // Double Click -> Edit Client
        clearTimeout(clientClickTimer);
        clientClickTimer = null;

        if (currentQuote && currentQuote.customer && currentQuote.customer.id) {
            // Open Client Card
            if (typeof openClientModal === 'function') {
                openClientModal(currentQuote.customer.id);
            } else {
                console.error("openClientModal not found");
            }
        } else {
            // No client selected? Open picker
            openClientPicker();
        }
    } else {
        // Single Click -> Select Client (Delayed)
        clientClickTimer = setTimeout(() => {
            clientClickTimer = null;
            openClientPicker();
        }, 250);
    }
}

window.openClientPicker = function (initialTab = 'select') {
    isPickingClientMode = true;
    const modal = document.getElementById('clientModal');
    if (modal) {
        modal.classList.remove('hidden');
        switchClientTab(initialTab);
        renderClientPicker();
    }
}

function switchClientTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));

    // Toggle Giobby Buttons Visibility
    const giobbyBtns = [document.getElementById('btnForceNewGiobby'), document.getElementById('btnImportGiobby')];
    giobbyBtns.forEach(btn => {
        if (btn) {
            if (tab === 'select') btn.classList.add('hidden');
            else btn.classList.remove('hidden');
        }
    });

    if (tab === 'select') {
        document.querySelector('[onclick="switchClientTab(\'select\')"]').classList.add('active');
        document.getElementById('tabClientSelect').classList.remove('hidden');
    } else {
        document.querySelector('[onclick="switchClientTab(\'create\')"]').classList.add('active');
        document.getElementById('tabClientCreate').classList.remove('hidden');
    }
}

function renderClientPicker() {
    const search = document.getElementById('clientSearchPicker').value;
    const list = document.getElementById('clientPickerList');
    list.innerHTML = '';

    db.getClients(search).forEach(c => {
        const div = document.createElement('div');
        div.className = 'picker-item';
        div.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>${c.name}</strong>
            <small style="color:#666; text-align:right;">
                ${c.address || ''}<br>
                ${[c.zip, c.city, c.addressProvince ? '(' + c.addressProvince + ')' : ''].filter(Boolean).join(' ')}
            </small>
        </div>`;
        div.onclick = () => {
            currentQuote.customer = c;
            renderEditorState();
            closeModal('clientModal');
        };
        list.appendChild(div);
    });
}


// --- Additional Works Logic ---

window.openAdditionalWorks = function () {
    document.getElementById('worksModal').classList.remove('hidden');
    renderWorksList();
}

// Editing State
let editingWorkIndex = -1;

function renderWorksList() {
    const container = document.getElementById('worksListContainer');
    container.innerHTML = '';
    const works = db.getAdditionalWorks();

    if (works.length === 0) {
        container.innerHTML = '<div style="padding:10px; color:#aaa; font-style:italic;">Nessuna voce extra salvata.</div>';
        return;
    }

    works.forEach((work, index) => {
        const div = document.createElement('div');
        div.className = 'picker-item';
        div.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; width:100%;">
            <input type="checkbox" id="work_${index}" value="${index}">
            <label for="work_${index}" style="flex:1; cursor:pointer;">
                <strong>${work.description}</strong> <span style="color:#666;">(${formatCurrency(work.price)} / ${work.uom})</span>
            </label>
            <button class="btn-icon" onclick="editWorkItem(${index})" title="Modifica">
                <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-icon delete" onclick="deleteWorkItem(${index})" title="Elimina">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
        `;
        container.appendChild(div);
    });
}

window.toggleNewWorkForm = function () {
    const form = document.getElementById('newWorkForm');
    form.classList.toggle('hidden');
    // Reset if we were editing and toggled closed/open
    if (form.classList.contains('hidden')) {
        resetWorkForm();
    }
}

window.editWorkItem = function (index) {
    editingWorkIndex = index;
    const works = db.getAdditionalWorks();
    const work = works[index];
    if (!work) return;

    document.getElementById('newWorkDesc').value = work.description;
    document.getElementById('newWorkUom').value = work.uom;
    document.getElementById('newWorkPrice').value = formatInput(work.price);

    // Show form
    const form = document.getElementById('newWorkForm');
    form.classList.remove('hidden');

    // Change Button Text
    const btn = form.querySelector('button');
    if (btn) btn.textContent = 'Aggiorna Voce';
}

function resetWorkForm() {
    editingWorkIndex = -1;
    document.getElementById('newWorkDesc').value = '';
    document.getElementById('newWorkUom').value = '';
    document.getElementById('newWorkPrice').value = '';

    const form = document.getElementById('newWorkForm');
    const btn = form.querySelector('button');
    if (btn) btn.textContent = 'Salva Voce';
}

window.addNewWorkItem = async function () {
    const desc = document.getElementById('newWorkDesc').value;
    const uom = document.getElementById('newWorkUom').value || '-';
    // Use raw value to check if empty, only parse if present
    const rawPrice = document.getElementById('newWorkPrice').value;
    const price = rawPrice ? parseInput(rawPrice) : 0;

    if (!desc) {
        alert('Inserisci almeno la descrizione.');
        return;
    }

    const payload = { description: desc, uom: uom, price: price };

    try {
        if (editingWorkIndex >= 0) {
            await db.updateAdditionalWork(editingWorkIndex, payload);
        } else {
            await db.saveAdditionalWork(payload);
        }
    } catch (error) {
        console.error('Error saving work:', error);
        alert('Errore nel salvataggio della voce: ' + error.message);
        return;
    }

    resetWorkForm();
    document.getElementById('newWorkForm').classList.add('hidden');
    renderWorksList();
}

window.deleteWorkItem = async function (index) {
    if (confirm('Eliminare questa voce dalle lavorazioni abituali?')) {
        await db.deleteAdditionalWork(index);
        renderWorksList();
    }
}

window.addSelectedWorks = function () {
    const checked = document.querySelectorAll('#worksListContainer input[type="checkbox"]:checked');
    const works = db.getAdditionalWorks();

    checked.forEach(chk => {
        const work = works[parseInt(chk.value)];
        currentQuote.items.push({
            code: 'SRV-' + Math.floor(Math.random() * 1000),
            description: work.description,
            uom: work.uom,
            quantity: 1,
            unitPrice: work.price,
            priceMin: 0,
            priceMax: work.price,
            total: work.price,
            var1: '', var2: '', var3: ''
        });
    });

    if (checked.length > 0) {
        renderEditorState();
        closeModal('worksModal');
    } else {
        alert('Seleziona almeno una voce.');
    }
}

// --- Calculator Logic ---
window.toggleCalculator = function () {
    const calc = document.getElementById('floatingCalc');
    calc.classList.toggle('hidden');
    if (!calc.classList.contains('hidden')) {
        calcClear();
    }
}
// Alias for the toolbar button if needed, or update HTML to call toggleCalculator directly
window.openCalculator = window.toggleCalculator;

window.calcAppend = function (val) {
    const display = document.getElementById('calcDisplay');
    if (display.value === '0' && val !== '.') display.value = val;
    else display.value += val;
}

window.calcOp = function (op) {
    const display = document.getElementById('calcDisplay');
    // Basic check to avoid double operators if desired, but simple append works for eval
    const lastChar = display.value.slice(-1);
    if (['+', '-', '*', '/'].includes(lastChar)) {
        // Replace last operator
        display.value = display.value.slice(0, -1) + op;
    } else {
        display.value += op;
    }
}

window.calcClear = function () {
    document.getElementById('calcDisplay').value = '0';
}

window.calcEval = function () {
    try {
        const res = eval(document.getElementById('calcDisplay').value);
        document.getElementById('calcDisplay').value = res;
    } catch (e) {
        document.getElementById('calcDisplay').value = 'Error';
    }
}

// Product Picker Logic (Legacy Removed)

window.openClientModal = function (id = null) {
    const modal = document.getElementById('clientModal');
    if (modal) modal.classList.remove('hidden');

    // Initialize Autocomplete
    if (window.setupCityAutocomplete) window.setupCityAutocomplete();

    const form = document.getElementById('formClient');
    if (form) form.reset();

    let idInput = document.getElementById('clientIdHidden');
    if (!idInput && form) {
        idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.id = 'clientIdHidden';
        form.appendChild(idInput);
    }
    if (idInput) idInput.value = '';

    // --- ENHANCED AGENT POPULATION LOGIC (Copied/Adapted from populateSharedLists) ---
    const vars = db.getProductVars();
    const agentSelect = document.getElementById('newClientAgent');

    if (agentSelect && vars) {
        // Merge keys from metadata, legacy list, AND Master List (Fallback)
        const metaAgents = vars.agentsMetadata ? Object.keys(vars.agentsMetadata) : [];
        const listAgents = vars.agents || [];
        const masterAgents = window.AGENT_MASTER_LIST ? Object.keys(window.AGENT_MASTER_LIST) : [];

        let allAgents = [...new Set([...metaAgents, ...listAgents, ...masterAgents])].sort();

        // FILTRO PER UTENTE LOGGATO
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.email) {
            const userEmail = currentUser.email.toLowerCase().trim();
            // Cerca match nei metadata
            let matchedAgentKey = Object.keys(vars.agentsMetadata || {}).find(key => {
                const meta = vars.agentsMetadata[key];
                return meta && meta.email && meta.email.toLowerCase().trim() === userEmail;
            });

            // FALLBACK: Cerca nella Master List statica (se caricata)
            if (!matchedAgentKey && window.AGENT_MASTER_LIST) {
                matchedAgentKey = Object.keys(window.AGENT_MASTER_LIST).find(key => {
                    const agent = window.AGENT_MASTER_LIST[key];
                    return agent && agent.email && agent.email.toLowerCase().trim() === userEmail;
                });
            }

            if (matchedAgentKey) {
                allAgents = [matchedAgentKey];
            } else {
            }
        }

        let html = '<option value="">- Seleziona -</option>';
        allAgents.forEach(a => {
            html += `<option value="${a}">${a}</option>`;
        });
        agentSelect.innerHTML = html;

        // Define/Update Handler FIRST (must exist before being called below)
        window.onNewClientAgentChange = function (agentName) {
            const idField = document.getElementById('newClientAgentGiobbyId');
            if (!idField) return;

            if (!agentName) {
                idField.value = '';
                return;
            }

            // Lookup in Metadata
            const _v = db.getProductVars();
            const _meta = (_v && _v.agentsMetadata) || {};
            // Case-insensitive lookup
            const _infoKey = Object.keys(_meta).find(k =>
                k === agentName || k.trim().toLowerCase() === agentName.trim().toLowerCase()
            );
            const _info = _infoKey ? _meta[_infoKey] : null;

            if (_info && _info.giobbyAgentId) {
                idField.value = _info.giobbyAgentId;
            } else {
                idField.value = ''; // Not found
            }
        };

        // Auto-select single option (agent-user mode)
        if (allAgents.length === 1) {
            agentSelect.value = allAgents[0];
        }

        // If opening from editor for a NEW client, pre-fill with the current quote's agent
        if (!id && typeof currentQuote !== 'undefined' && currentQuote && currentQuote.agent) {
            const quoteAgent = currentQuote.agent;
            // Only pre-fill if the agent is in the select
            if (Array.from(agentSelect.options).some(o => o.value === quoteAgent)) {
                agentSelect.value = quoteAgent;
            }
        }

        // TRIGGER UPDATE of ID Field based on current selection
        console.log('🔍 [openClientModal] Agent populate debug:', {
            agentSelectFound: !!agentSelect,
            varsFound: !!vars,
            allAgentsCount: allAgents.length,
            allAgents: allAgents,
            currentUserEmail: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.email : 'N/A',
            currentQuoteAgent: (typeof currentQuote !== 'undefined' && currentQuote) ? currentQuote.agent : 'N/A',
            finalSelectedValue: agentSelect.value,
            agentsMetadataKeys: Object.keys(vars.agentsMetadata || {})
        });
        if (window.onNewClientAgentChange && agentSelect.value) {
            window.onNewClientAgentChange(agentSelect.value);
        }

    } else {
        console.warn("DEBUG: agentSelect or vars missing", { hasSelect: !!agentSelect, hasVars: !!vars });
    }
    document.getElementById('clientModal').classList.remove('hidden');

    // Define/Update Handler (no-op redeclaration since already defined above, kept for safety)
    if (!window.onNewClientAgentChange) {
        window.onNewClientAgentChange = function (agentName) {
            const idField = document.getElementById('newClientAgentGiobbyId');
            if (!idField) return;
            if (!agentName) { idField.value = ''; return; }
            const vars = db.getProductVars();
            const meta = vars.agentsMetadata || {};
            const info = meta[agentName];
            if (info && info.giobbyAgentId) { idField.value = info.giobbyAgentId; }
            else { idField.value = ''; }
        };
    }

    // --------------------------------------------------------------------------

    if (id) {
        // Edit Mode
        switchClientTab('create');

        const client = db.getClients().find(c => c.id == id);
        if (client) {
            if (idInput) idInput.value = client.id;
            if (document.getElementById('newClientName')) document.getElementById('newClientName').value = client.name || '';
            if (document.getElementById('newClientSurname')) document.getElementById('newClientSurname').value = client.surname || '';

            // Show Giobby button in EDIT mode
            const _btnGiobby = document.getElementById('btnClientModalPushGiobby');
            const _bdgGiobby = document.getElementById('clientModalGiobbyBadge');
            if (_btnGiobby) {
                const _hasGiobby = !!(client.giobbyContactId || client.giobbyCustomerId || client.idCustomer);
                _btnGiobby.style.display = 'flex';
                _btnGiobby.style.background = _hasGiobby ? '#0284c7' : '#e11d48';
                _btnGiobby.innerHTML = _hasGiobby
                    ? '<i class="fa-solid fa-cloud-arrow-up"></i> Aggiorna su Giobby'
                    : '<i class="fa-solid fa-cloud-arrow-up"></i> Invia su Giobby';
                _btnGiobby.disabled = false;
            }
            if (_bdgGiobby) {
                const _gCode = client.idCustomer || client.giobbyCustomerId || null;
                if (_gCode) {
                    _bdgGiobby.style.display = 'flex';
                    let giobbyLinkHtml = '';
                    try {
                        const jsonConfig = localStorage.getItem('giobbyConfig');
                        if (jsonConfig) {
                            const config = JSON.parse(jsonConfig);
                            const tenantId = config.apiUrl ? (config.apiUrl.match(/GiobbyApi(\d+)/i)?.[1] || '00554') : '00554';
                            const giobbyLink = `https://app.giobby.com/Giobby${tenantId}/company/Contact.xhtml?IDCUSTOMER=${_gCode}&ftrID=cust_n&idFeature=cust_n`;
                            giobbyLinkHtml = ` <a href="${giobbyLink}" target="_blank" style="margin-left:8px; color:#0ea5e9; text-decoration:underline; font-size: 13px; font-weight: normal;"><i class="fa-solid fa-external-link-alt"></i> Apri su Giobby</a>`;
                        }
                    } catch (e) {}
                    _bdgGiobby.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#22c55e;"></i> Già su Giobby &mdash; cod. <strong>#${_gCode}</strong>${giobbyLinkHtml}`;
                    _bdgGiobby.style.color = '#15803d';
                } else {
                    _bdgGiobby.style.display = 'flex';
                    _bdgGiobby.innerHTML = '<i class="fa-regular fa-circle-xmark" style="color:#94a3b8;"></i> Non ancora su Giobby';
                    _bdgGiobby.style.color = '#94a3b8';
                }
            }

            if (document.getElementById('newClientVat')) document.getElementById('newClientVat').value = client.vat || '';
            if (document.getElementById('newClientSdi')) document.getElementById('newClientSdi').value = client.sdi || '';
            if (document.getElementById('newClientAddress')) document.getElementById('newClientAddress').value = client.address || '';
            if (document.getElementById('newClientAddressProvince')) document.getElementById('newClientAddressProvince').value = client.addressProvince || '';
            if (document.getElementById('newClientCity')) document.getElementById('newClientCity').value = client.city || '';
            if (document.getElementById('newClientZip')) document.getElementById('newClientZip').value = client.zip || '';
            if (document.getElementById('newClientSiteAddress')) document.getElementById('newClientSiteAddress').value = client.siteAddress || '';
            if (document.getElementById('newClientSiteAddressProvince')) document.getElementById('newClientSiteAddressProvince').value = client.siteAddressProvince || '';

            if (document.getElementById('newClientContact')) document.getElementById('newClientContact').value = client.contactPerson || '';
            if (document.getElementById('newClientPhoneOffice')) document.getElementById('newClientPhoneOffice').value = client.phone_office || '';
            if (document.getElementById('newClientPhoneHome')) document.getElementById('newClientPhoneHome').value = client.phone_home || '';
            if (document.getElementById('newClientMobile')) document.getElementById('newClientMobile').value = client.mobile || '';
            if (document.getElementById('newClientFax')) document.getElementById('newClientFax').value = client.fax || '';
            if (document.getElementById('newClientIdCustomer')) document.getElementById('newClientIdCustomer').value = client.idCustomer || '';
            if (document.getElementById('newClientEmail')) document.getElementById('newClientEmail').value = client.email || '';
            if (document.getElementById('newClientPec')) document.getElementById('newClientPec').value = client.pec || '';
            if (document.getElementById('newClientFiscalCode')) document.getElementById('newClientFiscalCode').value = client.fiscal_code || '';
            if (document.getElementById('newClientGiobbyContactId')) document.getElementById('newClientGiobbyContactId').value = client.giobbyContactId || '';

            if (document.getElementById('newClientState')) document.getElementById('newClientState').value = client.state || '';
            if (document.getElementById('newClientCountry')) document.getElementById('newClientCountry').value = client.country || 'Italia';
            if (document.getElementById('newClientLang')) document.getElementById('newClientLang').value = client.language || 'Italiano';
            if (document.getElementById('newClientSector')) document.getElementById('newClientSector').value = client.sector || '';
            if (document.getElementById('newClientOrigin')) document.getElementById('newClientOrigin').value = client.origin || '';

            // AUTO-POPULATE MISSING FIELDS
            // 1. Infer region from province if state is empty
            const stateField = document.getElementById('newClientState');
            if (stateField && (!client.state || client.state === '')) {
                const province = client.addressProvince || document.getElementById('newClientAddressProvince').value;
                if (province && window.inferRegionFromProvince) {
                    const inferredRegion = window.inferRegionFromProvince(province);
                    if (inferredRegion) {
                        stateField.value = inferredRegion;
                    }
                }
            }

            // 2. Default country to Italia if empty
            const countryField = document.getElementById('newClientCountry');
            if (countryField && (!client.country || client.country === '')) {
                countryField.value = 'Italia';
            }


            // Set Agent after population
            if (document.getElementById('newClientAgent')) {
                let savedAgent = client.agent || '';

                // FALLBACK: Auto-select current logged-in agent se l'agente non è salvato
                if (!savedAgent && typeof currentUser !== 'undefined' && currentUser && currentUser.email && window.db && typeof db.getAgentByEmail === 'function') {
                    savedAgent = db.getAgentByEmail(currentUser.email) || '';
                }

                // If provided agent is not in the list, add it temporarily so it displays correctly
                if (savedAgent && !Array.from(document.getElementById('newClientAgent').options).some(o => o.value === savedAgent)) {
                    const opt = document.createElement('option');
                    opt.value = savedAgent;
                    opt.textContent = savedAgent + ' (Archiviato/Esterno)';
                    document.getElementById('newClientAgent').appendChild(opt);
                }

                if (savedAgent) {
                    // Seleziona l'agente salvato
                    document.getElementById('newClientAgent').value = savedAgent;
                    // Popola ID Giobby: usa quello salvato sul cliente, o quello dei metadata se manca
                    const savedAgentGiobbyId = client.agentGiobbyId || '';
                    if (savedAgentGiobbyId) {
                        // Usa il valore già salvato sul cliente (non sovrascrivere dai metadata)
                        const idField = document.getElementById('newClientAgentGiobbyId');
                        if (idField) idField.value = savedAgentGiobbyId;
                    } else {
                        // Nessun ID salvato: cerca dai metadata dell'agente
                        if (window.onNewClientAgentChange) window.onNewClientAgentChange(savedAgent);
                    }
                } else {
                    // Agente non salvato: se c'è una sola opzione disponibile (modalità utente-agente), auto-selezionala
                    const opts = Array.from(document.getElementById('newClientAgent').options).filter(o => o.value !== '');
                    if (opts.length === 1) {
                        document.getElementById('newClientAgent').value = opts[0].value;
                        if (window.onNewClientAgentChange) window.onNewClientAgentChange(opts[0].value);
                    }
                }
            }

            // Explicit Province Debug & Fallback
            const provField = document.getElementById('newClientAddressProvince');
            // Now relying on data-supabase.js normalized mapping, but keeping fallback just in case
            const targetProv = client.addressProvince || client.address_province || client.province || '';

            if (provField) {
                provField.value = targetProv;
            }

            // Populate Visible Inputs for Shipping/Logistics
            if (document.getElementById('newClientSiteAddress_Input')) document.getElementById('newClientSiteAddress_Input').value = client.siteAddress || '';
            if (document.getElementById('newClientSiteAddressProvince_Input')) document.getElementById('newClientSiteAddressProvince_Input').value = client.siteAddressProvince || '';
            if (document.getElementById('newClientContact_Input')) document.getElementById('newClientContact_Input').value = client.contactPerson || '';
            if (document.getElementById('newClientOrigin_Input')) document.getElementById('newClientOrigin_Input').value = client.origin || '';

            if (client.type === 'private') {
                const r = document.querySelector('input[name="clientType"][value="private"]');
                if (r) r.checked = true;
            } else {
                const r = document.querySelector('input[name="clientType"][value="company"]');
                if (r) r.checked = true;
            }
            if (typeof toggleClientType === 'function') toggleClientType();

            // Populate Print Prefs
            if (client.printPrefs) {
                if (document.getElementById('visQuoteVat')) document.getElementById('visQuoteVat').checked = client.printPrefs.quote.vat;
                if (document.getElementById('visQuoteSdi')) document.getElementById('visQuoteSdi').checked = client.printPrefs.quote.sdi;
                if (document.getElementById('visQuoteAddress')) document.getElementById('visQuoteAddress').checked = client.printPrefs.quote.address;
                if (document.getElementById('visQuoteSite')) document.getElementById('visQuoteSite').checked = client.printPrefs.quote.site;
                if (document.getElementById('visQuoteContact')) document.getElementById('visQuoteContact').checked = client.printPrefs.quote.contact;
                if (document.getElementById('visQuoteEmail')) document.getElementById('visQuoteEmail').checked = client.printPrefs.quote.email;
                if (document.getElementById('visQuotePhone')) document.getElementById('visQuotePhone').checked = client.printPrefs.quote.phone;

                if (document.getElementById('visOrderVat')) document.getElementById('visOrderVat').checked = client.printPrefs.order.vat;
                if (document.getElementById('visOrderSdi')) document.getElementById('visOrderSdi').checked = client.printPrefs.order.sdi;
                if (document.getElementById('visOrderAddress')) document.getElementById('visOrderAddress').checked = client.printPrefs.order.address;
                if (document.getElementById('visOrderSite')) document.getElementById('visOrderSite').checked = client.printPrefs.order.site;
                if (document.getElementById('visOrderContact')) document.getElementById('visOrderContact').checked = client.printPrefs.order.contact;
                if (document.getElementById('visOrderEmail')) document.getElementById('visOrderEmail').checked = client.printPrefs.order.email;
                if (document.getElementById('visOrderPhone')) document.getElementById('visOrderPhone').checked = client.printPrefs.order.phone;
            }
        }
    } else {
        // Create Mode
        switchClientTab('create');
        if (typeof toggleClientType === 'function') toggleClientType();

        // AUTO-POPULATE DEFAULTS FOR NEW CLIENT
        // 1. Set default country to Italia
        const countryField = document.getElementById('newClientCountry');
        if (countryField) {
            countryField.value = 'Italia';
        }

        // 2. Agent is already auto-selected above if only one available (lines 3648-3655)
        // No additional action needed here

        // Show Giobby button in CREATE mode with different label
        const _btnG = document.getElementById('btnClientModalPushGiobby');
        const _bdgG = document.getElementById('clientModalGiobbyBadge');
        if (_btnG) {
            _btnG.style.display = 'flex';
            _btnG.style.background = '#e11d48';
            _btnG.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Salva e invia su Giobby';
            _btnG.disabled = false;
        }
        if (_bdgG) _bdgG.style.display = 'none';
    }
}

/**
 * Called from the Giobby button inside clientModal.
 * Reads the clientId from the hidden field, fetches the full client object,
 * and pushes it to Giobby (find-or-create) with feedback on the button.
 */
window.pushClientToGiobbyFromModal = async function () {
    const btn = document.getElementById('btnClientModalPushGiobby');
    const badge = document.getElementById('clientModalGiobbyBadge');
    let clientId = (document.getElementById('clientIdHidden') || {}).value || '';

    // Validate Giobby config first (fail fast before any save)
    const jsonConfig = localStorage.getItem('giobbyConfig');
    if (!jsonConfig) {
        alert('Giobby non configurato. Vai in Impostazioni \u2192 Giobby e accedi prima.');
        return;
    }
    const config = JSON.parse(jsonConfig);
    if (!config.accessToken || !config.apiUrl) {
        alert('Sessione Giobby non valida. Accedi nuovamente alle impostazioni Giobby.');
        return;
    }

    // Spinner
    const origLabel = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvataggio e invio...'; }

    let client = null;

    try {
        if (!clientId) {
            // ---- NEW CLIENT: collect form data and save first ----
            const nameVal = (document.getElementById('newClientName') || {}).value || '';
            if (!nameVal.trim()) {
                if (btn) { btn.innerHTML = origLabel; btn.disabled = false; }
                alert('Il nome cliente \u00e8 obbligatorio.');
                return;
            }

            const payload = {
                name: nameVal,
                surname:        (document.getElementById('newClientSurname') || {}).value || '',
                vat:            (document.getElementById('newClientVat') || {}).value || '',
                sdi:            (document.getElementById('newClientSdi') || {}).value || '',
                address:        (document.getElementById('newClientAddress') || {}).value || '',
                city:           (document.getElementById('newClientCity') || {}).value || '',
                zip:            (document.getElementById('newClientZip') || {}).value || '',
                addressProvince:(document.getElementById('newClientAddressProvince') || {}).value || '',
                siteAddress:    (document.getElementById('newClientSiteAddress_Input') || {}).value || '',
                siteAddressProvince:(document.getElementById('newClientSiteAddressProvince_Input') || {}).value || '',
                contactPerson:  (document.getElementById('newClientContact_Input') || {}).value || '',
                email:          (document.getElementById('newClientEmail') || {}).value || '',
                pec:            (document.getElementById('newClientPec') || {}).value || '',
                phone_office:   (document.getElementById('newClientPhoneOffice') || {}).value || '',
                phone_home:     (document.getElementById('newClientPhoneHome') || {}).value || '',
                mobile:         (document.getElementById('newClientMobile') || {}).value || '',
                fax:            (document.getElementById('newClientFax') || {}).value || '',
                fiscal_code:    (document.getElementById('newClientFiscalCode') || {}).value || '',
                state:          (document.getElementById('newClientState') || {}).value || '',
                country:        (document.getElementById('newClientCountry') || {}).value || 'Italia',
                language:       (document.getElementById('newClientLang') || {}).value || '',
                sector:         (document.getElementById('newClientSector') || {}).value || '',
                origin:         (document.getElementById('newClientOrigin_Input') || {}).value || '',
                agent:          (document.getElementById('newClientAgent') || {}).value || '',
                agentGiobbyId:  (document.getElementById('newClientAgentGiobbyId') || {}).value || '',
                type:           (document.querySelector('input[name="clientType"]:checked') || {}).value || 'private',
            };

            if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvataggio...';
            await db.saveClient(payload);
            // saveClient() muta payload.id in-place (es. 'C-'+Date.now())
            // quindi payload.id è già valorizzato dopo la chiamata
            client = payload;

            if (client && client.id) {
                clientId = client.id;
                // Aggiorna campo hidden così i salvataggi successivi funzionano
                const hiddenField = document.getElementById('clientIdHidden');
                if (hiddenField) hiddenField.value = clientId;
                console.log('[GiobbyModal] Nuovo cliente salvato, id:', clientId);
            } else {
                throw new Error('saveClient non ha assegnato un ID al cliente.');
            }

        } else {
            // ---- EXISTING CLIENT: load from db ----
            client = db.getClients().find(c => String(c.id) === String(clientId));
            if (!client) throw new Error('Cliente non trovato nel database locale.');
        }

        if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Invio su Giobby...';

        // Resolve agent Giobby ID
        let agentId = null;
        const agentName = client.agent || (document.getElementById('newClientAgent') || {}).value || '';
        try {
            const vars = db.getProductVars();
            const meta = (vars && vars.agentsMetadata) ? vars.agentsMetadata : {};
            const key = Object.keys(meta).find(k => k === agentName || k.trim().toLowerCase() === agentName.trim().toLowerCase());
            if (key && meta[key]) agentId = meta[key].giobbyAgentId || null;
            if (!agentId && config.giobbyAgentId) agentId = config.giobbyAgentId;
        } catch (_) {}

        // Build clientData for Giobby
        const clientData = {
            name: client.name || '',
            surname: client.surname || '',
            type: client.type || (client.vat && client.vat.length === 11 ? 'company' : 'private'),
            vat: client.vat || '',
            fiscal_code: client.fiscal_code || '',
            address: client.address || '',
            city: client.city || '',
            zip: client.zip || '',
            addressProvince: client.addressProvince || client.address_province || '',
            country: client.country || 'Italia',
            email: client.email || '',
            mobile: client.mobile || '',
            phone: client.phone || '',
            phoneOffice: client.phone_office || '',
            phoneHome: client.phone_home || '',
            pec: client.pec || '',
            fax: client.fax || '',
            sdi: client.sdi || '',
            giobbyContactId: client.giobbyContactId || '',
            giobbyCustomerId: client.giobbyCustomerId || client.idCustomer || ''
        };

        const result = await window.findOrCreateGiobbyClient(config, clientData, true, agentId);
        if (!result || (!result.idContact && !result.idCustomer)) throw new Error('Risposta vuota da Giobby.');

        const { idContact, idCustomer } = result;

        // Persist Giobby IDs back to Supabase
        const updatedClient = {
            ...client,
            giobbyContactId:  idContact  || client.giobbyContactId,
            giobbyCustomerId: idCustomer || client.giobbyCustomerId,
            idCustomer:       idCustomer || client.idCustomer
        };
        await db.saveClient(updatedClient);

        // Also refresh the client list UI without closing modal
        try { renderGenericClientsTable(); } catch (_) {}

        // Success feedback on button
        if (btn) {
            btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Inviato! Cod. #${idCustomer || '\u2013'}`;
            btn.style.background = '#16a34a';
            setTimeout(() => {
                btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Aggiorna su Giobby`;
                btn.style.background = '#0284c7';
                btn.disabled = false;
            }, 4000);
        }
        // Success badge
        if (badge) {
            badge.style.display = 'flex';
            let giobbyLinkHtml = '';
            try {
                const tenantId = config.apiUrl ? (config.apiUrl.match(/GiobbyApi(\d+)/i)?.[1] || '00554') : '00554';
                const giobbyLink = `https://app.giobby.com/Giobby${tenantId}/company/Contact.xhtml?IDCUSTOMER=${idCustomer}&ftrID=cust_n&idFeature=cust_n`;
                giobbyLinkHtml = ` <a href="${giobbyLink}" target="_blank" style="margin-left:8px; color:#0ea5e9; text-decoration:underline; font-size: 13px; font-weight: normal;"><i class="fa-solid fa-external-link-alt"></i> Apri su Giobby</a>`;
            } catch (e) {}
            badge.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#22c55e;"></i> Sincronizzato \u2014 cod. <strong>#${idCustomer}</strong>${giobbyLinkHtml}`;
            badge.style.color = '#15803d';
        }

    } catch (err) {
        console.error('[GiobbyModal] Errore push:', err);
        if (btn) {
            btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Errore`;
            btn.style.background = '#dc2626';
            setTimeout(() => { btn.innerHTML = origLabel; btn.style.background = '#e11d48'; btn.disabled = false; }, 5000);
        }
        alert('Errore invio su Giobby: ' + (err.message || err));
    }
};



window.saveAndPickClient = async function () {
    const id = document.getElementById('clientIdHidden').value;
    const name = document.getElementById('newClientName').value;
    const surname = document.getElementById('newClientSurname') ? document.getElementById('newClientSurname').value : '';
    const vat = document.getElementById('newClientVat').value;
    const sdi = document.getElementById('newClientSdi').value;
    const address = document.getElementById('newClientAddress').value;
    const city = document.getElementById('newClientCity').value;
    const zip = document.getElementById('newClientZip').value;
    const province = document.getElementById('newClientAddressProvince').value;
    const siteAddress = document.getElementById('newClientSiteAddress_Input') ? document.getElementById('newClientSiteAddress_Input').value : '';
    const siteAddressProvince = document.getElementById('newClientSiteAddressProvince_Input') ? document.getElementById('newClientSiteAddressProvince_Input').value : '';
    const contactPerson = document.getElementById('newClientContact_Input') ? document.getElementById('newClientContact_Input').value : '';
    const email = document.getElementById('newClientEmail').value;
    const pec = document.getElementById('newClientPec').value;
    const phoneOffice = document.getElementById('newClientPhoneOffice').value;
    const phoneHome = document.getElementById('newClientPhoneHome').value;
    const mobile = document.getElementById('newClientMobile').value;
    const fax = document.getElementById('newClientFax').value;
    const idCustomer = document.getElementById('newClientIdCustomer') ? document.getElementById('newClientIdCustomer').value : '';
    const giobbyContactId = document.getElementById('newClientGiobbyContactId') ? document.getElementById('newClientGiobbyContactId').value : '';
    const fiscalCode = document.getElementById('newClientFiscalCode').value;
    const state = document.getElementById('newClientState').value;
    const country = document.getElementById('newClientCountry').value;
    const language = document.getElementById('newClientLang').value;
    const sector = document.getElementById('newClientSector').value;
    const origin = document.getElementById('newClientOrigin_Input') ? document.getElementById('newClientOrigin_Input').value : '';

    const agent = document.getElementById('newClientAgent').value;
    const agentGiobbyId = document.getElementById('newClientAgentGiobbyId') ? document.getElementById('newClientAgentGiobbyId').value : '';

    const typeRadio = document.querySelector('input[name="clientType"]:checked');
    const type = typeRadio ? typeRadio.value : 'private';

    if (!name) {
        alert("Il nome è obbligatorio.");
        return;
    }

    const payload = {
        name: name,
        surname: surname, // SAVE SURNAME
        vat: vat,
        sdi: sdi,
        address: address,
        city: city,
        zip: zip,
        addressProvince: province,
        siteAddress: siteAddress,
        siteAddressProvince: siteAddressProvince,
        contactPerson: contactPerson,
        email: email,
        pec: pec,
        phone_office: phoneOffice,
        phone_home: phoneHome,
        mobile: mobile,
        fax: fax,
        idCustomer: idCustomer,
        giobbyContactId: giobbyContactId,
        fiscal_code: fiscalCode,
        state: state,
        country: country,
        language: language,
        sector: sector,
        origin: origin,
        agent: agent,
        agentGiobbyId: agentGiobbyId,
        type: type,
        // Save print preferences
        printPrefs: {
            quote: {
                vat: document.getElementById('visQuoteVat').checked,
                sdi: document.getElementById('visQuoteSdi').checked,
                address: document.getElementById('visQuoteAddress').checked,
                site: document.getElementById('visQuoteSite').checked,
                contact: document.getElementById('visQuoteContact').checked,
                email: document.getElementById('visQuoteEmail').checked,
                phone: document.getElementById('visQuotePhone').checked
            },
            order: {
                vat: document.getElementById('visOrderVat').checked,
                sdi: document.getElementById('visOrderSdi').checked,
                address: document.getElementById('visOrderAddress').checked,
                site: document.getElementById('visOrderSite').checked,
                contact: document.getElementById('visOrderContact').checked,
                email: document.getElementById('visOrderEmail').checked,
                phone: document.getElementById('visOrderPhone').checked
            }
        }
    };

    if (id) payload.id = id;

    try {

        await db.saveClient(payload);

        // --- GIOBBY AUTO-SYNC ON CLIENT SAVE ---
        // Runs AFTER the modal is closed (setTimeout 0) so it never blocks saving.
        const _syncAgentName = agent;
        const _syncAgentGiobbyId = agentGiobbyId;
        const _syncClientName = name;
        const _syncClientVat = vat;
        const _syncPayload = { ...payload }; // snapshot BEFORE any async operations
        setTimeout(() => {
            try {
                const clients = (db && db.getClients) ? (db.getClients() || []) : [];
                const _savedClientForSync = clients.find(c =>
                    c.name === _syncClientName && (_syncClientVat ? c.vat === _syncClientVat : true)
                ) || _syncPayload;

                if (typeof syncClientToGiobbyOnSave === 'function') {
                    syncClientToGiobbyOnSave(_savedClientForSync, _syncAgentName, _syncAgentGiobbyId).catch(e => {
                        console.warn('[GiobbySync] Background sync failed (non-blocking):', e.message);
                    });
                }
            } catch (_syncSetupErr) {
                console.warn('[GiobbySync] Sync setup failed (non-blocking):', _syncSetupErr.message);
            }
        }, 300); // small delay to let db.saveClient finish updating the local cache

        try { closeModal('clientModal'); } catch (e) { console.error("Error closing modal", e); }

        // If in picker mode, auto-select
        if (isPickingClientMode) {

            // Reload table
            try { renderGenericClientsTable(); } catch (e) { console.error("Error rendering table", e); throw new Error("Render Table Failed: " + e.message); }

            // Try to pick if we edited an existing one
            if (id) {

                pickClientFromRegistry(id);
            } else {
                // Try to find the new client

                const clients = db.getClients();
                const newC = clients.find(c => c.name === name && c.vat === vat);
                if (newC) {

                    pickClientFromRegistry(newC.id);
                } else {
                    console.warn("New client NOT found for picking");
                }
            }
        } else {

            renderGenericClientsTable();
        }

    } catch (e) {
        console.error(e);
        // Specialized error message
        const step = e.message.includes("Render") ? "Render Table" : "Save/Other";
        alert(`DEBUG (${step}): ` + e.message);
    }
}

// closeModal defined in ui-core.js

/**
 * Sync a client to Giobby immediately after saving locally.
 * Called in background (fire-and-forget) from saveAndPickClient.
 * Saves giobbyContactId + idCustomer to the local record so future exports are instant.
 *
 * @param {object} client - The saved client object (from db.getClients())
 * @param {string} agentName - Agent name (from the form select)
 * @param {string} agentGiobbyId - Agent's Giobby numeric ID (pre-resolved from agentsMetadata)
 */
window.syncClientToGiobbyOnSave = async function (client, agentName, agentGiobbyId) {
    // 1. Check Giobby config
    const _raw = localStorage.getItem('giobbyConfig');
    if (!_raw) {

        return;
    }
    const adminConfig = JSON.parse(_raw);
    if (!adminConfig.accessToken || !adminConfig.apiUrl) {

        return;
    }

    // 2. If client already has a giobbyContactId, just update data (no re-create)
    if (client.giobbyContactId && String(client.giobbyContactId).length > 20) {
        console.log(`[GiobbySync] Cliente "${client.name}" già presente su Giobby (${client.giobbyContactId}). Aggiornamento dati...`);
        try {
            if (window.updateGiobbyClient) {
                await window.updateGiobbyClient(adminConfig, client, client.giobbyContactId, agentGiobbyId || null);

            }
        } catch (e) {
            console.warn('[GiobbySync] Update failed (non-blocking):', e.message);
        }
        return;
    }

    // 3. Resolve agent token (use agent credentials if available, fallback to admin token)
    let syncConfig = { ...adminConfig };
    let resolvedAgentId = agentGiobbyId || '';

    try {
        const vars = window.db ? window.db.getProductVars() : {};
        const meta = vars.agentsMetadata || {};

        // Find agent metadata (case-insensitive)
        const agentKey = Object.keys(meta).find(k =>
            k === agentName || k.trim().toLowerCase() === (agentName || '').trim().toLowerCase()
        );
        const agentMeta = agentKey ? meta[agentKey] : null;

        // Resolve agentId from metadata if not already available
        if (!resolvedAgentId && agentMeta) {
            resolvedAgentId = agentMeta.giobbyAgentId || agentMeta.idGiobby || agentMeta.giobbyId || '';
        }

        // Try to get agent-specific token for proper ownership assignment
        if (agentMeta && agentMeta.giobbyUsername && agentMeta.giobbyPassword) {
            try {

                const agentToken = await window.authenticateAgent(
                    agentMeta.giobbyUsername, agentMeta.giobbyPassword, adminConfig
                );
                if (agentToken) {
                    syncConfig = { ...adminConfig, accessToken: agentToken };

                }
            } catch (authErr) {
                console.warn(`[GiobbySync] Auth agente fallita, uso token admin:`, authErr.message);
            }
        }
    } catch (metaErr) {
        console.warn('[GiobbySync] Errore lettura metadati agente:', metaErr);
    }

    // 4. Find or Create client on Giobby
    console.log(`[GiobbySync] Sincronizzazione cliente "${client.name}" su Giobby (agentId: ${resolvedAgentId || 'none'})...`);
    let contactInfo = null;
    try {
        if (!window.findOrCreateGiobbyClient) {
            console.warn('[GiobbySync] findOrCreateGiobbyClient non disponibile.');
            return;
        }
        // autoCreate = true → non mostra dialoghi di conflitto
        contactInfo = await window.findOrCreateGiobbyClient(syncConfig, client, true, resolvedAgentId || null);
    } catch (syncErr) {
        console.warn('[GiobbySync] findOrCreateGiobbyClient failed:', syncErr.message);
        // Try again with admin token if agent token failed
        if (syncConfig.accessToken !== adminConfig.accessToken) {

            try {
                contactInfo = await window.findOrCreateGiobbyClient(adminConfig, client, true, resolvedAgentId || null);
            } catch (e2) {
                console.warn('[GiobbySync] Retry admin fallito:', e2.message);
            }
        }
    }

    // 5. Persist giobbyContactId + idCustomer back to local record
    if (contactInfo && contactInfo.idContact && String(contactInfo.idContact).length > 20) {

        try {
            const updatedClient = {
                ...client,
                giobbyContactId: contactInfo.idContact,
                idCustomer: contactInfo.idCustomer || client.idCustomer || ''
            };
            await window.db.saveClient(updatedClient);

            // Also update currentQuote.customer in memory if this client is assigned to the current quote
            if (typeof currentQuote !== 'undefined' && currentQuote && currentQuote.customer) {
                if (currentQuote.customer.id == client.id || currentQuote.customer.name === client.name) {
                    currentQuote.customer.giobbyContactId = contactInfo.idContact;
                    if (contactInfo.idCustomer) currentQuote.customer.idCustomer = contactInfo.idCustomer;

                }
            }
        } catch (saveErr) {
            console.warn('[GiobbySync] Salvataggio GUID locale fallito:', saveErr.message);
        }
    } else if (contactInfo && contactInfo.idCustomer) {
        // Partial sync: got numeric code but not GUID (will resolve on next export)
        console.warn(`[GiobbySync] Cliente creato su Giobby (code: ${contactInfo.idCustomer}) ma GUID non ancora disponibile. Sarà risolto all'export.`);
        try {
            const updatedClient = { ...client, idCustomer: contactInfo.idCustomer };
            await window.db.saveClient(updatedClient);
        } catch (_) { }
    } else {
        console.warn(`[GiobbySync] Sync completata senza GUID per "${client.name}". Il cliente sarà creato/cercato all'export.`);
    }
};


// --- Quotes List ---
function toggleSelectAllQuotes(el) {
    document.querySelectorAll('.quote-check').forEach(c => c.checked = el.checked);
    updateQuoteDelButton();
}

function updateQuoteDelButton() {
    const checked = document.querySelectorAll('.quote-check:checked').length;

    const btnDelete = document.getElementById('btnBulkDeleteQuotes');
    const btnRestore = document.getElementById('btnBulkRestoreQuotes');
    const btnPermDelete = document.getElementById('btnBulkPermDeleteQuotes');

    // Reset all first
    if (btnDelete) btnDelete.classList.add('hidden');
    if (btnRestore) btnRestore.classList.add('hidden');
    if (btnPermDelete) btnPermDelete.classList.add('hidden');

    if (checked > 0) {
        if (activeQuoteStatus === 'deleted') {
            // Trash Mode: Show Restore & Perm Delete
            if (btnRestore) {
                btnRestore.classList.remove('hidden');
                const span = document.getElementById('countResQuotes');
                if (span) span.textContent = checked;
            }
            if (btnPermDelete) {
                btnPermDelete.classList.remove('hidden');
                const span = document.getElementById('countPermDelQuotes');
                if (span) span.textContent = checked;
            }
        } else {
            // Normal Mode: Show Delete (Bin)
            if (btnDelete) {
                btnDelete.classList.remove('hidden');
                const span = document.getElementById('countDelQuotes');
                if (span) span.textContent = checked;
            }
        }
    }
}

async function deleteSelectedQuotes() {
    const checked = Array.from(document.querySelectorAll('.quote-check:checked')).map(c => c.value);
    if (checked.length === 0) return;

    if (!confirm(`Spostare ${checked.length} preventivi nel Cestino?`)) return;

    // Show Progress
    showLoadingSpinner(`Eliminazione 0/${checked.length}...`);
    const barContainer = document.getElementById('loadingProgressBarContainer');
    const bar = document.getElementById('loadingProgressBar');
    if (barContainer) barContainer.style.display = 'block';
    if (bar) bar.style.width = '0%';

    try {
        // Use loop to delete (soft delete)
        for (let i = 0; i < checked.length; i++) {
            const id = checked[i];
            await db.deleteQuote(String(id));

            // Update UI
            const percent = Math.round(((i + 1) / checked.length) * 100);
            if (bar) bar.style.width = `${percent}%`;
            const txt = document.getElementById('loadingText');
            if (txt) txt.textContent = `Eliminazione ${i + 1}/${checked.length}...`;

            // Small delay for UI update
            await new Promise(r => setTimeout(r, 20));
        }

        renderQuotesTable();
        updateDashboard();

        // Reset master checkbox
        const master = document.querySelector('input[onchange="toggleSelectAllQuotes(this)"]');
        if (master) master.checked = false;
        updateQuoteDelButton();

    } catch (e) {
        console.error("Bulk Delete Failed:", e);
        alert("Errore durante l'eliminazione: " + e.message);
    } finally {
        hideLoadingSpinner();
        if (barContainer) barContainer.style.display = 'none';
        if (bar) bar.style.width = '0%';
    }
}

async function restoreSelectedQuotes() {
    // Get checked items
    const checked = Array.from(document.querySelectorAll('.quote-check:checked')).map(c => c.value);
    if (checked.length === 0) return;

    if (!confirm(`Spostare ${checked.length} preventivi dal Cestino ai rispettivi stati originali?`)) return;

    showLoadingSpinner(`Ripristino 0/${checked.length}...`);

    try {
        for (let i = 0; i < checked.length; i++) {
            await db.restoreQuote(checked[i]);
        }
        renderQuotesTable();
        updateDashboard();
        updateQuoteDelButton();
        alert(`${checked.length} preventivi ripristinati con successo.`);
    } catch (e) {
        console.error("Bulk Restore Error:", e);
        alert("Errore ripristino: " + e.message);
    } finally {
        hideLoadingSpinner();
    }
}

async function permanentDeleteSelectedQuotes() {
    const checked = Array.from(document.querySelectorAll('.quote-check:checked')).map(c => c.value);
    if (checked.length === 0) return;

    if (!confirm(`ATTENZIONE: Stai per eliminare DEFINITIVAMENTE ${checked.length} preventivi.\n\nNon potranno essere recuperati.\n\nProcedere?`)) return;
    if (!confirm(`CONFERMA FINALE: Elimina per sempre ${checked.length} elementi?`)) return;

    showLoadingSpinner(`Eliminazione Definitiva 0/${checked.length}...`);

    try {
        for (let i = 0; i < checked.length; i++) {
            await db.permanentDeleteQuote(checked[i]);
        }
        renderQuotesTable();
        updateDashboard();
        updateQuoteDelButton();
        alert(`${checked.length} preventivi eliminati definitivamente.`);
    } catch (e) {
        console.error("Bulk PermDelete Error:", e);
        alert("Errore eliminazione: " + e.message);
    } finally {
        hideLoadingSpinner();
    }
}


// --- QUOTES REDESIGN LOGIC ---
let activeQuoteStatus = 'all';

window.filterQuotesByStatus = function (status) {
    activeQuoteStatus = status;
    document.querySelectorAll('.status-tab').forEach(btn => {
        if (btn.dataset.status === status) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    renderQuotesTable();
}

function renderQuotesTable() {
    const tbody = document.getElementById('quotesTableBody');
    const emptyState = document.getElementById('quotesEmptyState');
    tbody.innerHTML = '';

    const searchStr = document.getElementById('quoteSearch') ? document.getElementById('quoteSearch').value.toLowerCase() : '';
    const sortMode = document.getElementById('quoteSort') ? document.getElementById('quoteSort').value : 'date-desc';

    let quotes = [];

    if (typeof window.initExecutionYearOptions === 'function') {
        window.initExecutionYearOptions();
    }

    if (activeQuoteStatus === 'deleted') {
        quotes = db.getDeletedQuotes();
    } else {
        quotes = db.getAllQuotes();
        if (activeQuoteStatus !== 'all') {
            quotes = quotes.filter(q => q.status === activeQuoteStatus);
        } else {
            quotes = quotes.filter(q => q.status !== 'deleted');
        }
    }

    const yearFilterEl = document.getElementById('quoteFilterYear');
    const yearFilter = (yearFilterEl && yearFilterEl.value && yearFilterEl.value.trim() !== '') ? yearFilterEl.value : 'all';
    if (yearFilter && yearFilter !== 'all') {
        quotes = quotes.filter(q => String(q.executionYear || (q.extra_fields && q.extra_fields.executionYear) || (q.date ? q.date.split('-')[0] : '2026')) === String(yearFilter));
    }

    if (searchStr) {
        const searchTokens = searchStr.split(/\s+/).filter(t => t.length > 0);

        quotes = quotes.filter(q => {
            // Build a full corpus of text for this quote
            const parts = [
                q.customer ? `${q.customer.name || ''} ${q.customer.surname || ''}` : '',
                `preventivo ${q.id}`,
                formatDate(q.date),
                q.reference || '',
                q.agent || '',
                q.zone || '',
                q.siteAddress || '',
                q.siteContactName || '',
                q.notes || ''
            ];

            // Add Items description and code
            if (q.items) {
                q.items.forEach(i => {
                    parts.push(i.description || '');
                    parts.push(i.code || '');
                });
            }

            const fullText = parts.join(' ').toLowerCase();

            // Check if ALL tokens are present in the full text
            return searchTokens.every(token => fullText.includes(token));
        });
    }

    if (sortMode) {
        // ... sort logic handled below
    }

    quotes.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt).getTime();
        const dateB = new Date(b.date || b.createdAt).getTime();
        const amtA = a.total || 0;
        const amtB = b.total || 0;

        switch (sortMode) {
            case 'date-desc': return dateB - dateA;
            case 'date-asc': return dateA - dateB;
            case 'amount-desc': return amtB - amtA;
            case 'amount-asc': return amtA - amtB;
            case 'client-asc': {
                const nameA = (a.customer && (a.customer.name || a.customer.vat)) ? (a.customer.name || a.customer.vat) : '';
                const nameB = (b.customer && (b.customer.name || b.customer.vat)) ? (b.customer.name || b.customer.vat) : '';
                return nameA.localeCompare(nameB);
            }
            case 'client-desc': {
                const nameA = (a.customer && (a.customer.name || a.customer.vat)) ? (a.customer.name || a.customer.vat) : '';
                const nameB = (b.customer && (b.customer.name || b.customer.vat)) ? (b.customer.name || b.customer.vat) : '';
                return nameB.localeCompare(nameA);
            }
            case 'agent-asc': return (a.agent || '').localeCompare(b.agent || '');
            case 'agent-desc': return (b.agent || '').localeCompare(a.agent || '');
            default: return dateB - dateA;
        }
    });

    if (quotes.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const isTrash = activeQuoteStatus === 'deleted';

    // Late Calculation Logic (Safe Access)
    const avgCycle = (window.predictiveState && window.predictiveState.avgCycleDays) ? window.predictiveState.avgCycleDays : 30; // Default 30 if not calc
    const lateThreshold = avgCycle + 15;
    const now = new Date();

    quotes.forEach(q => {
        // ALWAYS show checkboxes, even in Trash
        const checkCell = `<input type="checkbox" class="quote-check" value="${q.id}" onchange="updateQuoteDelButton()">`;
        // FIX: Include surname for full name display
        const fullName = q.customer ? [q.customer.name, q.customer.surname].filter(Boolean).join(' ').trim() : '';
        const customerName = fullName || '<span class="text-muted">Nessun Cliente</span>';
        const dateDisplay = formatDate(q.date || q.createdAt);

        // Check Late Status
        let lateClass = '';
        if (['Aperto', 'In Attesa', 'Bozza'].includes(q.status)) {
            const start = new Date(q.date || q.createdAt);
            const ageDays = Math.ceil(Math.abs(now - start) / (1000 * 60 * 60 * 24));
            if (ageDays > lateThreshold) {
                lateClass = 'status-late';
            }
        }

        let actionsHtml = '';
        if (isTrash) {
            actionsHtml = `
                <div class="actions-cell">
                    <button class="btn-action-icon" onclick="restoreQuote('${q.id}')" title="Ripristina"><i class="fa-solid fa-trash-restore"></i></button>
                    <button class="btn-action-icon danger" onclick="permanentDeleteQuote('${q.id}')" title="Elimina per sempre"><i class="fa-solid fa-ban"></i></button>
                </div>
            `;
        } else {
            // Cerca ID cliente: prima dal preventivo, poi per nome nel registro
            let clientIdForCrm = (q.customer && q.customer.id) ? q.customer.id : (q.client_id || '');
            if (!clientIdForCrm && q.customer && q.customer.name) {
                const allClients = db.getClients();
                const qName = (q.customer.name + ' ' + (q.customer.surname || '')).trim().toLowerCase();
                const matched = allClients.find(c => {
                    const cName = (c.name + ' ' + (c.surname || '')).trim().toLowerCase();
                    // Richiede match esatto su nome+cognome per evitare false corrispondenze
                    return cName === qName;
                });
                if (matched) clientIdForCrm = matched.id;
            }
            // Fallback: usa i dati del preventivo anche senza ID (es. account agente)
            const crmFallbackObj = q.customer ? { name: q.customer.name || '', surname: q.customer.surname || '', email: q.customer.email || '', phone: q.customer.phone || '', company: q.customer.company || '' } : null;
            const hasCrm = !!clientIdForCrm; // Solo con ID certo — no fallback per nome (rischio cliente sbagliato)
            const safeFbKey = clientIdForCrm || ('fb_' + (q.id || Date.now()));
            if (crmFallbackObj) window._crmFbCache = window._crmFbCache || {}; if (crmFallbackObj) window._crmFbCache[safeFbKey] = crmFallbackObj;
            const clientNameHint = q.customer ? [q.customer.name, q.customer.surname].filter(Boolean).join(' ') : '';
            const crmOnclick = hasCrm
                ? `window._openCrmForQuote('${clientIdForCrm}','${safeFbKey}')`
                : `alert('Cliente "${clientNameHint.replace(/'/g, "'")}" non trovato in anagrafica.\n\nIl CRM non può essere aperto per evitare di mostrare la scheda sbagliata.\n\nSoluzione: apri l\'anagrafica, cerca questo cliente e collegalo al preventivo.');`;

            actionsHtml = `
                <div class="actions-cell">
                    ${q.giobbyDocumentId ? `<button class="btn-action-icon" style="color:#0ea5e9;position:relative;" onclick="(function(){var cfg=JSON.parse(localStorage.getItem('giobbyConfig')||'{}');var tid=cfg.cid||'';window.open('https://app.giobby.com/'+tid+'/sales/order/Order.xhtml?IDORDER=${q.giobbyDocumentId}&ftrID=odv_v&idFeature=odv_v','_blank');})()" title="Apri su Giobby (ID: ${q.giobbyDocumentId})"><i class="fa-solid fa-cloud-arrow-up"></i><span style="position:absolute;bottom:2px;right:1px;font-size:6px;font-weight:700;color:#fff;background:#0ea5e9;border-radius:2px;padding:0px 3px;line-height:1.5;letter-spacing:0.03em;pointer-events:none;white-space:nowrap;">GIO</span></button>` : ''}
                    ${q.pdfSavedDate ? `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-file-pdf" style="color:#d4a017; font-size:1.1em;" title="Salvato come PDF il ${new Date(q.pdfSavedDate).toLocaleDateString('it-IT')}"></i></div>` : ''}
                    ${hasCrm ? `<button class="btn-action-icon" style="color:#8b5cf6;position:relative;" onclick="${crmOnclick}" title="Apri Scheda Cliente"><i class="fa-solid fa-user"></i><span style="position:absolute;bottom:2px;right:1px;font-size:6px;font-weight:700;color:#fff;background:#8b5cf6;border-radius:2px;padding:0px 3px;line-height:1.5;letter-spacing:0.03em;pointer-events:none;white-space:nowrap;">CRM</span></button>` : ''}
                    <button class="btn-action-icon" onclick="openEditor('${q.id}')" title="Modifica Preventivo"><i class="fa-solid fa-file-pen"></i></button>
                </div>
            `;
        }

        const row = document.createElement('tr');



        row.innerHTML = `
            <td>${checkCell}</td>
            <td>${dateDisplay}</td>
            <td><strong style="font-family: inherit; color: #1e293b; font-weight: 500;">${q.quoteCode || '-'}</strong></td>
            <td class="text-center"><span class="badge-year" style="background:#e0f2fe; color:#0369a1; font-weight:600; padding:2px 7px; border-radius:4px; font-size:0.82rem;">${q.executionYear || (q.date ? q.date.split('-')[0] : '2026')}</span></td>
            <td>
                <div style="font-weight:600;">${customerName}</div>
                <div style="font-size:0.8rem; color:#666;">${q.reference || ''}</div>
            </td>
            <td>${q.agent || '-'}</td>
            <td>${q.zone || '-'}</td>
            <td class="text-right" style="font-weight:600;">€ ${formatCurrency(q.total || 0)}</td>
            <td class="text-center">
                <i class="fa-solid ${q.excludeFromStats ? 'fa-eye-slash' : 'fa-chart-line'}" 
                   style="cursor:pointer; color: ${q.excludeFromStats ? '#94a3b8' : '#10b981'};" 
                   onclick="toggleQuoteStats('${q.id}', event)" 
                   title="${q.excludeFromStats ? 'Escluso dalle Statistiche' : 'Incluso nelle Statistiche'}">
                </i>
            </td>
            <td class="text-center">
                <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                    <span class="status-badge status-${(q.status || 'aperto').toLowerCase().replace(/\s/g, '-')} ${lateClass}">
                        ${q.status || 'Aperto'}
                    </span>

                </div>
            </td>
            <td>${actionsHtml}</td>
        `;

        // Apply faded styling if excluded from stats
        if (q.excludeFromStats) {
            row.style.opacity = '0.5';
            row.style.color = '#94a3b8';
        }

        tbody.appendChild(row);
    });

    // Check for High Priority Quotes (Debounced)
    if (window.checkTimeout) clearTimeout(window.checkTimeout);
    window.checkTimeout = setTimeout(() => {
        if (window.checkForHighPriorityQuotes) window.checkForHighPriorityQuotes();
    }, 2000);
}

window.deleteQuote = async function (id) {
    if (confirm('Spostare questo preventivo nel Cestino?')) {
        try {
            // Force string treatment for generated IDs
            const strId = String(id);
            await db.deleteQuote(strId);
            renderQuotesTable();
            updateDashboard(); // Stats might change
        } catch (e) {
            console.error("Delete failed:", e);
            alert("Errore durante l'eliminazione: " + e.message);
        }
    }
}

window.restoreQuote = async function (id) {
    if (confirm('Ripristinare questo preventivo?')) {
        try {
            const strId = String(id);
            await db.restoreQuote(strId);
            renderQuotesTable();
            updateDashboard();
        } catch (e) {
            console.error("Restore failed:", e);
            alert("Errore durante il ripristino: " + e.message);
        }
    }
}

window.permanentDeleteQuote = async function (id) {
    if (confirm('ATTENZIONE: Eliminare DEFINITIVAMENTE questo preventivo? Non potrà essere recuperato.')) {
        try {
            const strId = String(id);
            await db.permanentDeleteQuote(strId);
            renderQuotesTable();
            updateDashboard();
        } catch (e) {
            console.error("Permanent delete failed:", e);
            alert("Errore eliminazione definitiva: " + e.message);
        }
    }
}

// Placeholder for Giobby/Prospect sync
window.syncToProspect = async function (quoteId) {
    alert("Funzionalità di sincronizzazione con Prospect in fase di sviluppo.");
    // Implement actual sync logic here
    // Example:
    // const quote = db.getQuote(quoteId);
    // await api.syncQuoteToProspect(quote);
    // quote.prospectSyncDate = new Date().toISOString();
    // await db.saveQuote(quote);
    // renderQuotesTable();
}


/**
 * Apre il CRM per una riga preventivo, usando il fallback dati cliente se non in anagrafica
 */
window._openCrmForQuote = function (clientId, fbKey) {
    if (!window.CRM) return;
    const fallback = (window._crmFbCache && fbKey) ? window._crmFbCache[fbKey] : null;
    window.CRM.open(clientId || '', '', fallback);
};

/**
 * Apre il CRM sulla scheda Giobby filtrando per il preventivo selezionato
 */
window.showRelatedGiobbyDocs = async function (quoteId) {
    const q = db.getQuotes().find(x => x.id == quoteId);
    if (!q) return;

    // Risoluzione ID Cliente per CRM
    let clientId = (q.customer && q.customer.id) ? q.customer.id : (q.client_id || '');
    if (!clientId && q.customer && q.customer.name) {
        const allClients = db.getClients();
        const qName = (q.customer.name + ' ' + (q.customer.surname || '')).trim().toLowerCase();
        const matched = allClients.find(c => {
            const cName = (c.name + ' ' + (c.surname || '')).trim().toLowerCase();
            return cName === qName || c.name.toLowerCase() === q.customer.name.toLowerCase();
        });
        if (matched) clientId = matched.id;
    }

    if (clientId || (q.customer && q.customer.name)) {
        if (window.CRM) {
            const ref = q.quoteCode || q.id;
            // Fallback dati cliente per account agente (senza accesso anagrafica)
            const fallback = q.customer ? {
                name: q.customer.name || '',
                surname: q.customer.surname || '',
                email: q.customer.email || '',
                phone: q.customer.phone || '',
                company: q.customer.company || ''
            } : null;
            await window.CRM.open(clientId, ref, fallback);

            // Attendi caricamento e scrolla alla sezione Giobby
            setTimeout(() => {
                const giobbyContainer = document.getElementById('crmGiobbyBody');
                if (giobbyContainer) {
                    // Scrolla la card Giobby in vista
                    const card = giobbyContainer.closest('.crm-card');
                    if (card) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        // Effetto flash per attirare l'attenzione
                        card.style.transition = 'outline 0.3s';
                        card.style.outline = '3px solid #fb923c';
                        setTimeout(() => card.style.outline = 'none', 1500);
                    }
                }
            }, 600);

        } else {
            alert("Il modulo CRM non è caricato correttamente.");
        }
    } else {
        alert("Impossibile aprire il CRM: Cliente non trovato in anagrafica.");
    }
};

window.toggleQuoteStats = async function (id, event) {
    if (event) event.stopPropagation();

    const quote = db.getQuote(id);
    if (!quote) return;

    // Toggle
    quote.excludeFromStats = !quote.excludeFromStats;

    try {
        await db.saveQuote(quote);
        // Refresh UI without full reload if possible, but renderQuotesTable is fast enough
        renderQuotesTable();
        // Also update dashboard/stats if they are visible
        if (typeof updateDashboard === 'function') updateDashboard();
    } catch (e) {
        console.error("Error toggling stats:", e);
        alert("Errore aggiornamento flag statistiche: " + e.message);
    }
}

// Helper to display sync status icons
// Helper to display sync status icons
// Helper to display sync status icons - REWRITTEN V3


// --- Stats Logic ---
window.refreshStats = function () {
    const mode = document.getElementById('btnStatsData').classList.contains('btn-primary') ? 'data' : 'charts';
    if (mode === 'data') renderStats();
    else renderStatsCharts();
}

window.resetStatsFilter = function () {
    document.getElementById('statsDateStart').value = '';
    document.getElementById('statsDateEnd').value = '';
    refreshStats();
}


let currentStatsMode = 'data';

window.switchStatsMode = function (mode) {
    currentStatsMode = mode;

    // Toggle Buttons
    const btnData = document.getElementById('btnStatsData');
    const btnPivot = document.getElementById('btnStatsPivot');
    const btnCharts = document.getElementById('btnStatsCharts');

    if (btnData) {
        btnData.classList.toggle('active', mode === 'data');
        btnData.classList.toggle('btn-primary', mode === 'data');
        btnData.classList.toggle('btn-secondary', mode !== 'data');
    }
    if (btnPivot) {
        btnPivot.classList.toggle('active', mode === 'pivot');
        btnPivot.classList.toggle('btn-primary', mode === 'pivot');
        btnPivot.classList.toggle('btn-secondary', mode !== 'pivot');
    }
    if (btnCharts) {
        btnCharts.classList.toggle('active', mode === 'charts');
        btnCharts.classList.toggle('btn-primary', mode === 'charts');
        btnCharts.classList.toggle('btn-secondary', mode !== 'charts');
    }

    // Toggle Views
    const viewData = document.getElementById('statsModeData');
    const viewPivot = document.getElementById('statsModePivot');
    const viewCharts = document.getElementById('statsModeCharts');

    if (viewData) viewData.classList.add('hidden');
    if (viewPivot) viewPivot.classList.add('hidden');
    if (viewCharts) viewCharts.classList.add('hidden');

    if (mode === 'data' && viewData) viewData.classList.remove('hidden');
    if (mode === 'pivot' && viewPivot) viewPivot.classList.remove('hidden');
    if (mode === 'charts' && viewCharts) viewCharts.classList.remove('hidden');

    renderStats();
}

window.renderOverviewWidgets = function () {
    const start = document.getElementById('statsDateStart').value;
    const end = document.getElementById('statsDateEnd').value;

    const fillTable = (id, data, isCurrency = true) => {
        const table = document.getElementById(id);
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">Nessun dato</td></tr>';
            return;
        }
        data.forEach(d => {
            let val = d.value;
            if (isCurrency) val = formatCurrency(val) + ' €';
            else if (id === 'tableConversion' || id === 'tableStatus') val = d.value;

            if (id === 'tableConversion') val = d.value + '%';

            let extraCol = '';
            if (id === 'tableStatus' && d.total !== undefined) {
                extraCol = `<td>${formatCurrency(d.total)} €</td>`;
            } else if ((id === 'tableProductsQuoted' || id === 'tableProductsSold' || id === 'tableProductsLost') && d.qty !== undefined) {
                extraCol = `<td>${d.qty}</td>`;
            }

            tbody.innerHTML += `<tr>
                <td><strong>${d.name}</strong></td>
                <td>${val}</td>
                ${extraCol}
            </tr>`;
        });
    };

    // 1. Trend (Monthly Status Breakdown)
    const trendData = db.getMonthlyStatusTrend(start, end);
    const trendTable = document.getElementById('tableTrend');
    if (trendTable) {
        const tbody = trendTable.querySelector('tbody');
        tbody.innerHTML = '';
        if (!trendData || trendData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nessun dato</td></tr>';
        } else {
            trendData.forEach(d => {
                tbody.innerHTML += `<tr>
                    <td><strong>${d.name}</strong></td>
                    <td style="color:width:20%">${formatCurrency(d.Aperto)} €</td>
                    <td style="color:var(--success-color); width:20%">${formatCurrency(d.Chiuso)} €</td>
                    <td style="color:var(--danger-color); width:20%">${formatCurrency(d.Perso)} €</td>
                    <td><strong>${formatCurrency(d.total)} €</strong></td>
                </tr>`;
            });
        }
    }
    // fillTable('tableTrend', db.getMonthlyTrend(start, end)); // OLD

    // 2. Status
    fillTable('tableStatus', db.getQuotesByStatus(start, end), false);

    // 3. Products
    fillTable('tableProductsQuoted', db.getTopProductsQuoted(start, end));
    fillTable('tableProductsSold', db.getTopProductsSold(start, end));
    fillTable('tableProductsLost', db.getTopProductsLost(start, end));

    // 4. Conversion
    fillTable('tableConversion', db.getConversionByAgent(start, end), false);

    // 5. Zone
    fillTable('tableZone', db.getTurnoverByZone(start, end));

    // 6. Top Clients
    fillTable('tableTopClients', db.getTopClients(start, end));
}

window.renderStats = function () {
    if (currentStatsMode === 'data') {
        // Check which tab is active in the HTML logic (not just the mode logic)
        // Actually, if we are in 'data' mode, we might be in 'Overview' tab OR 'Reports' tab?
        // switchStatsTab sets the PANE visibility.
        // switchStatsMode toggles Data/Charts WITHIN the Overview pane.

        // If Overview Pane is visible:
        const overviewPane = document.getElementById('tabStatsOverview');
        if (overviewPane && !overviewPane.classList.contains('hidden')) {
            renderOverviewWidgets();
        }

        // Also render detailed reports if that pane is active (handled by switchStatsTab calling renderReportsTab)
        if (window.renderReportsTab) renderReportsTab();

    } else if (currentStatsMode === 'pivot') {
        if (window.renderPivotTable) renderPivotTable();
    } else if (currentStatsMode === 'charts') {
        if (window.renderStatsCharts) renderStatsCharts();
    }
}

window.exportOverviewToExcel = function() {
    if (!window.XLSX) {
        alert("Libreria XLSX non trovata!");
        return;
    }
    
    const wb = XLSX.utils.book_new();

    const addTableToSheet = (tableId, sheetName) => {
        const table = document.getElementById(tableId);
        if (table) {
            const clone = table.cloneNode(true);
            clone.querySelectorAll('td, th').forEach(cell => {
                if(cell.textContent.includes('€')) {
                    cell.textContent = cell.textContent.replace(/€/g, '').trim();
                }
            });
            const ws = XLSX.utils.table_to_sheet(clone);
            XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Max 31 chars for sheet name
        }
    };

    addTableToSheet('tableTrend', 'Andamento Mensile');
    addTableToSheet('tableStatus', 'Distribuzione Stati');
    addTableToSheet('tableProductsQuoted', 'Top Prod. Preventivati');
    addTableToSheet('tableProductsSold', 'Top Prod. Venduti');
    addTableToSheet('tableProductsLost', 'Top Prod. Persi');
    addTableToSheet('tableConversion', 'Conversione Agente');
    addTableToSheet('tableZone', 'Prev. per Zona');
    addTableToSheet('tableTopClients', 'Top Clienti');

    const d = new Date();
    XLSX.writeFile(wb, `Panoramica_Statistiche_${d.getFullYear()}${('0'+(d.getMonth()+1)).slice(-2)}${('0'+d.getDate()).slice(-2)}.xlsx`);
}


// --- NEW STATISTICS LOGIC ---

window.switchStatsTab = function (tabId) {
    // Buttons
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        if (b.dataset.tab === tabId) b.classList.add('active');
    });

    // Panes
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    const activePane = document.getElementById('tabStats' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    if (activePane) {
        activePane.classList.remove('hidden');
        if (tabId === 'overview') {
            renderStats();
            document.getElementById('statsChartsGrid').style.display = 'none'; // Reset to grid view
            if (typeof renderStatsCharts === 'function' && document.getElementById('btnStatsCharts').classList.contains('btn-primary')) {
                document.getElementById('statsChartsGrid').style.display = 'grid';
            }
        } else if (tabId === 'matrix') {
            // Optional: Auto render if not done? 
        } else if (tabId === 'reports') {
            renderReportsTab();
        }
    }
}

window.renderPivotTable = function () {
    const rowKey = document.getElementById('pivotRow').value;
    const rowKey2 = document.getElementById('pivotRow2') ? document.getElementById('pivotRow2').value : 'none'; // Secondary Row
    const colKey = document.getElementById('pivotCol').value;
    const valKey = document.getElementById('pivotValue').value;
    const start = document.getElementById('statsDateStart').value;
    const end = document.getElementById('statsDateEnd').value;
    const useHeatmap = document.getElementById('pivotHeatmap') ? document.getElementById('pivotHeatmap').checked : false;

    const quotes = db.getAllQuotes().filter(q => {
        if (start && q.date < start) return false;
        if (end && q.date > end) return false;
        return true;
    });

    // Helper to get nested/computed value
    const getValue = (q, key) => {
        const d = new Date(q.date);
        if (key === 'year') return d.getFullYear();
        if (key === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()} `;
        if (key === 'month') return q.date.substr(0, 7); // YYYY-MM
        if (key === 'week') {
            const onejan = new Date(d.getFullYear(), 0, 1);
            const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
            return `W${week < 10 ? '0' + week : week} ${d.getFullYear()} `;
        }
        if (key === 'day') return q.date; // YYYY-MM-DD

        if (key === 'customer') return q.customer ? q.customer.name : 'Sconosciuto';
        if (key === 'city') return (q.customer && q.customer.address) ? q.customer.address.split(',').pop().trim() : 'N/D';
        if (key === 'agent') return q.agent || 'N/D';
        if (key === 'zone') return q.zone || 'N/D';
        if (key === 'status') return q.status || 'N/D';

        return q[key] || 'N/A';
    };

    // 1. Group Data
    // Structure: matrix[row1][row2][col] = {stats}
    const matrix = {};
    const colHeaders = new Set();
    const row1Headers = new Set();
    // No set for row2, depends on row1

    quotes.forEach(q => {
        const r1 = getValue(q, rowKey);
        const r2 = rowKey2 !== 'none' ? getValue(q, rowKey2) : '__SINGLE__';
        const c = colKey === 'none' ? 'Totale' : getValue(q, colKey);

        row1Headers.add(r1);
        colHeaders.add(c);

        if (!matrix[r1]) matrix[r1] = {};
        if (!matrix[r1][r2]) matrix[r1][r2] = {};
        if (!matrix[r1][r2][c]) matrix[r1][r2][c] = { sum: 0, count: 0, items: 0, qty: 0, margin: 0, discountSum: 0 };

        let val = 0;
        let margin = 0;
        let qty = 0;
        let discountPctSum = 0;

        q.items.forEach(item => {
            const t = item.total || 0;
            const q_item = parseFloat(item.quantity || 0);
            val += t;
            qty += q_item;

            const cost = item.priceMin || 0;
            if (cost > 0) {
                margin += (item.unitPrice - cost) * q_item;
            }

            const max = item.priceMax || 0;
            if (max > 0) {
                const discount = Math.max(0, (max - item.unitPrice) / max);
                discountPctSum += (discount * t);
            }
        });

        const cell = matrix[r1][r2][c];
        cell.sum += val;
        cell.count += 1;
        cell.items += q.items.length;
        cell.qty += qty;
        cell.margin += margin;
        cell.discountSum += discountPctSum;
    });

    // 2. Sort Headers
    const sortedRow1 = Array.from(row1Headers).sort();
    const sortedCols = Array.from(colHeaders).sort();

    // Calculate Max per Column for Heatmap
    const colMax = {};
    if (useHeatmap) {
        sortedCols.forEach(c => {
            let max = 0;
            sortedRow1.forEach(r1 => {
                const r2Keys = matrix[r1] ? Object.keys(matrix[r1]) : [];
                r2Keys.forEach(r2 => {
                    const cell = matrix[r1][r2][c];
                    if (cell) {
                        let v = 0;
                        if (valKey === 'total') v = cell.sum;
                        else if (valKey === 'count') v = cell.count;
                        else if (valKey === 'qty') v = cell.qty;
                        else if (valKey === 'margin') v = cell.margin;
                        if (v > max) max = v;
                    }
                });
            });
            colMax[c] = max;
        });
    }

    const getBgColor = (val, max) => {
        if (!useHeatmap || !max || max === 0) return '';
        const intensity = Math.min(1, Math.max(0, val / max));
        // Green scale: rgba(78, 173, 122, alpha)
        return `background-color: rgba(78, 173, 122, ${intensity * 0.6})`; // max opacity 0.6 for readability
    };

    // 3. Build Table HTML
    let html = '<table class="simple-table pivot-table">';

    // Header Row
    // Column Headers
    html += '<thead><tr>';
    html += `<th>${rowKey.toUpperCase()}</th>`;
    if (rowKey2 !== 'none') html += `<th>${rowKey2.toUpperCase()}</th>`;

    // Columns
    sortedCols.forEach(c => {
        html += `<th>${formatLabel(colKey, c)}</th>`;
    });
    html += '<th>TOTALE</th></tr></thead><tbody>';

    // Data Rows
    sortedRow1.forEach(r1 => {
        const r1Data = matrix[r1];
        const r2Keys = Object.keys(r1Data).sort();

        // Calculate Subtotals for R1 if expanded
        // (Optional, maybe for now just list rows)

        r2Keys.forEach((r2, index) => {
            html += '<tr>';

            // Row Header 1 (Span if multiple r2)
            if (index === 0) {
                const rowSpan = r2Keys.length;
                // Format if needed
                const displayR1 = formatLabel(rowKey, r1);
                html += `<td rowspan="${rowSpan}" style="vertical-align:top; font-weight:bold; background:var(--bg-secondary); white-space:nowrap;">${displayR1}</td>`;
            }

            // Row Header 2
            if (rowKey2 !== 'none') {
                const displayR2 = formatLabel(rowKey2, r2);
                html += `<td>${displayR2}</td>`;
            }

            // Data Cells
            let rSum = 0, rCount = 0, rItems = 0, rQty = 0, rMargin = 0, rDisc = 0;

            sortedCols.forEach(c => {
                const cell = r1Data[r2][c];
                let displayVal = '-';
                let style = '';

                if (cell) {
                    rSum += cell.sum;
                    rCount += cell.count;
                    rItems += cell.items;
                    rQty += cell.qty;
                    rMargin += cell.margin;
                    rDisc += cell.discountSum;

                    let numericVal = 0;

                    if (valKey === 'total') { displayVal = formatCurrency(cell.sum); numericVal = cell.sum; }
                    else if (valKey === 'count') { displayVal = cell.count; numericVal = cell.count; }
                    else if (valKey === 'avg') displayVal = formatCurrency(cell.sum / cell.count);
                    else if (valKey === 'items') displayVal = cell.items;
                    else if (valKey === 'qty') { displayVal = cell.qty; numericVal = cell.qty; }
                    else if (valKey === 'margin') { displayVal = formatCurrency(cell.margin); numericVal = cell.margin; }
                    else if (valKey === 'discount') {
                        const pct = cell.sum > 0 ? ((cell.discountSum / cell.sum) * 100) : 0;
                        displayVal = pct.toFixed(1) + '%';
                    }

                    style = getBgColor(numericVal, colMax[c]);
                }
                html += `<td style="${style}">${displayVal}</td>`;
            });

            // Row Total
            let totalDisplay = '-';
            if (valKey === 'total') totalDisplay = formatCurrency(rSum);
            else if (valKey === 'count') totalDisplay = rCount;
            else if (valKey === 'avg') totalDisplay = rCount ? formatCurrency(rSum / rCount) : '-';
            else if (valKey === 'items') totalDisplay = rItems;
            else if (valKey === 'qty') totalDisplay = rQty;
            else if (valKey === 'margin') totalDisplay = formatCurrency(rMargin);
            else if (valKey === 'discount') totalDisplay = rSum > 0 ? ((rDisc / rSum) * 100).toFixed(1) + '%' : '0%';

            html += `<td><strong>${totalDisplay}</strong></td></tr>`;
        });
    });

    html += '</tbody></table>';
    document.getElementById('pivotResultContainer').innerHTML = html;
}

function formatLabel(key, value) {
    if (!value || value === 'N/A' || value === 'N/D') return value;

    if (key === 'month') {
        // value is YYYY-MM
        const [y, m] = value.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, 1);
        const monthName = date.toLocaleString('it-IT', { month: 'long' });
        return monthName.charAt(0).toUpperCase() + monthName.slice(1) + ' ' + y;
    }
    if (key === 'day') {
        const date = new Date(value);
        return date.toLocaleDateString('it-IT');
    }
    if (key === 'quarter') {
        // value is "Q1 2024 "
        // It's already sort of EN/Universal, let's localize Q -> Trimestre
        return value.replace('Q', 'Trim. ');
    }
    if (key === 'week') {
        return value.replace('W', 'Sett. ');
    }

    return value;
}

// Reports Tab logic disabled as per user request
window.renderReportsTab = function () {
}

window.renderAnalysisMatrix = window.renderPivotTable;

window.renderTopClients = function (quotes) {
    // Top Clients Logic
    const map = {};
    quotes.forEach(q => {
        // Filter by Status: Closed or Confirmed
        if (!['Chiuso', 'Ordine Confermato'].includes(q.status)) return;

        const clientName = q.customer ? (q.customer.name || q.customer.vat || 'Sconosciuto') : 'Sconosciuto';
        const val = q.items.reduce((acc, i) => acc + (i.total || 0), 0);

        if (!map[clientName]) map[clientName] = 0;
        map[clientName] += val;
    });

    // Sort and Slice
    const sorted = Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10

    let html = `
    <table class="simple-table" style="width:100%">
        <thead>
            <tr>
                <th>Cliente</th>
                <th>Fatturato Rigenerato</th>
            </tr>
        </thead>
        <tbody>`;

    if (sorted.length === 0) {
        html += '<tr><td colspan="2" class="text-center text-muted">Nessun cliente trovato con ordini confermati nel periodo.</td></tr>';
    } else {
        sorted.forEach(([name, val]) => {
            html += `<tr>
                <td><strong>${name}</strong></td>
                <td>${formatCurrency(val)} €</td>
            </tr>`;
        });
    }
    html += '</tbody></table>';

    const container = document.getElementById('reportTopClientsContainer');
    if (container) container.innerHTML = html;
}


function renderAgentReport(quotes) {
    const agents = db.getAgents();
    let html = `
            <table class="simple-table" style="width:100%">
        <thead>
            <tr>
                <th>Agente</th>
                <th>Prev. Assegnati</th>
                <th>Accettati</th>
                <th>Rifiutati</th>
                <th>Aperti</th>
                <th>Tasso Conv.</th>
                <th>Fatturato Generato</th>
            </tr>
        </thead>
        <tbody>`;

    agents.forEach(agent => {
        const agentQuotes = quotes.filter(q => q.agent === agent);
        const total = agentQuotes.length;
        const accepted = agentQuotes.filter(q => ['Chiuso', 'Ordine Confermato'].includes(q.status)).length;
        const rejected = agentQuotes.filter(q => ['Rifiutato', 'Perso'].includes(q.status)).length;
        const open = agentQuotes.filter(q => ['Aperto', 'In Attesa', 'Bozza'].includes(q.status)).length;

        const revenue = agentQuotes
            .filter(q => ['Chiuso', 'Ordine Confermato'].includes(q.status))
            .reduce((sum, q) => sum + q.items.reduce((acc, i) => acc + (i.total || 0), 0), 0);

        const conversion = total > 0 ? ((accepted / total) * 100).toFixed(1) + '%' : '-';

        html += `<tr>
            <td><strong>${agent}</strong></td>
            <td>${total}</td>
            <td><span style="color:var(--success-color)">${accepted}</span></td>
            <td><span style="color:var(--danger-color)">${rejected}</span></td>
            <td>${open}</td>
            <td><strong>${conversion}</strong></td>
            <td><strong>${formatCurrency(revenue)} €</strong></td>
        </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('reportAgentContainer').innerHTML = html;
}

function renderCustomerAnalysis(activeQuotes) {
    // Identify Customer Loyalty: New vs Recurring
    // Strategy: Get ALL historical quotes (ignoring date filter) to check if client existed before
    const allHistory = db.getAllQuotes();
    // Map client VAT/Name to first seen date
    const clientFirstSeen = {};

    allHistory.forEach(q => {
        if (!q.customer) return;
        const id = q.customer.vat || q.customer.name; // Use VAT if avail, else name
        const d = new Date(q.date);
        if (!clientFirstSeen[id] || d < clientFirstSeen[id]) {
            clientFirstSeen[id] = d;
        }
    });

    // Segments
    let newClients = { count: 0, rev: 0 };
    let recurringClients = { count: 0, rev: 0 };
    let processedClients = new Set(); // To avoid double counting clients in "Count" but usually we count quotes?
    // Let's count QUOTES and REVENUE coming from New vs Recurring Clients in this period

    const periodStart = document.getElementById('statsDateStart').value ? new Date(document.getElementById('statsDateStart').value) : new Date(0);

    activeQuotes.forEach(q => {
        if (!q.customer) return;
        // Only count revenue/loyalty for confirmed orders? Or for all activity?
        // Usually Customer Analysis focuses on SALES.
        if (!['Chiuso', 'Ordine Confermato'].includes(q.status)) return;

        const id = q.customer.vat || q.customer.name;
        const rev = q.items.reduce((acc, i) => acc + i.total, 0);

        if (clientFirstSeen[id] >= periodStart) {
            newClients.count++;
            newClients.rev += rev;
        } else {
            recurringClients.count++;
            recurringClients.rev += rev;
        }
    });

    let html = `
    <div class="dashboard-grid" style="grid-template-columns: 1fr 1fr; gap:20px;">
        <div class="card" style="background:var(--bg-secondary); text-align:center;">
            <h4 style="color:var(--text-muted)">Nuovi Clienti (Acquisizione)</h4>
            <div style="font-size:1.5rem; font-weight:bold; color:var(--primary-color)">${newClients.count}</div>
            <div>${formatCurrency(newClients.rev)} €</div>
        </div>
        <div class="card" style="background:var(--bg-secondary); text-align:center;">
            <h4 style="color:var(--text-muted)">Clienti Ricorrenti (Fidelizzazione)</h4>
            <div style="font-size:1.5rem; font-weight:bold; color:var(--secondary-color)">${recurringClients.count}</div>
            <div>${formatCurrency(recurringClients.rev)} €</div>
        </div>
    </div>
    <div style="margin-top:10px; font-size:0.9em; color:#666;">
        * Un cliente è considerato "Nuovo" se il suo primo preventivo è stato creato all'interno del periodo selezionato.
    </div>
    `;
    document.getElementById('reportCustomerContainer').innerHTML = html;
}

function renderABCAnalysis(quotes) {
    // Pareto: 80% Revenue from 20% products
    // 1. Aggregates Product Revenue
    const prodMap = {};
    let totalRevenue = 0;

    quotes.forEach(q => {
        if (!['Chiuso', 'Ordine Confermato'].includes(q.status)) return;
        if (!q.items) return;
        q.items.forEach(i => {
            const name = i.description;
            const t = i.total || 0;
            if (!prodMap[name]) prodMap[name] = 0;
            prodMap[name] += t;
            totalRevenue += t;
        });
    });

    // 2. Sort Descending
    const sortedProds = Object.entries(prodMap).sort((a, b) => b[1] - a[1]);

    // 3. Classify
    let accumulatedRev = 0;
    let counts = { A: 0, B: 0, C: 0 };
    let revs = { A: 0, B: 0, C: 0 };

    sortedProds.forEach(([name, val]) => {
        accumulatedRev += val;
        const pct = accumulatedRev / totalRevenue;

        if (pct <= 0.80) {
            counts.A++;
            revs.A += val;
        } else if (pct <= 0.95) {
            counts.B++;
            revs.B += val;
        } else {
            counts.C++;
            revs.C += val;
        }
    });

    let html = `
    <table class="simple-table" style="width:100%">
        <thead>
            <tr>
                <th>Classe</th>
                <th>Definizione</th>
                <th>N. Prodotti</th>
                <th>Fatturato Gruppo</th>
                <th>% Fatturato Tot</th>
            </tr>
        </thead>
        <tbody>
            <tr style="border-left: 5px solid #4caf50;">
                <td><strong>A</strong></td>
                <td>Top Performance (80% Fatturato)</td>
                <td>${counts.A}</td>
                <td>${formatCurrency(revs.A)} €</td>
                <td>${totalRevenue > 0 ? ((revs.A / totalRevenue) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr style="border-left: 5px solid #ff9800;">
                <td><strong>B</strong></td>
                <td>Media Performance (Next 15%)</td>
                <td>${counts.B}</td>
                <td>${formatCurrency(revs.B)} €</td>
                <td>${totalRevenue > 0 ? ((revs.B / totalRevenue) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr style="border-left: 5px solid #f44336;">
                <td><strong>C</strong></td>
                <td>Bassa Performance (Bottom 5%)</td>
                <td>${counts.C}</td>
                <td>${formatCurrency(revs.C)} €</td>
                <td>${totalRevenue > 0 ? ((revs.C / totalRevenue) * 100).toFixed(1) : 0}%</td>
            </tr>
        </tbody>
    </table>
    `;
    document.getElementById('reportABCContainer').innerHTML = html;

}

function renderProductReport(quotes) {
    const productMap = {};
    quotes.forEach(q => {
        if (!['Chiuso', 'Ordine Confermato'].includes(q.status)) return;
        if (!q.items) return;
        q.items.forEach(item => {
            const name = item.description || 'N/D';
            if (!productMap[name]) productMap[name] = { qty: 0, rev: 0, count: 0 };
            productMap[name].qty += parseFloat(item.quantity || 0);
            productMap[name].rev += parseFloat(item.total || 0);
            productMap[name].count += 1;
        });
    });

    let htmlProd = `
    <table class="simple-table" style="width:100%">
        <thead>
            <tr>
                <th>Prodotto</th>
                <th>Quantità Venduta</th>
                <th>Ricavo Totale</th>
                <th>Prezzo Medio</th>
            </tr>
        </thead>
        <tbody>`;

    // Sort by Revenue descending
    Object.entries(productMap)
        .sort((a, b) => b[1].rev - a[1].rev)
        .slice(0, 50) // Top 50 products
        .forEach(([name, data]) => {
            htmlProd += `<tr>
                <td>${name}</td>
                <td>${data.qty}</td>
                <td>${formatCurrency(data.rev)} €</td>
                <td>${data.qty > 0 ? formatCurrency(data.rev / data.qty) : '-'} €</td>
            </tr>`;
        });
    htmlProd += '</tbody></table>';
    document.getElementById('reportProductContainer').innerHTML = htmlProd;
}

function renderZoneReport(quotes) {
    const zoneMap = {};
    quotes.forEach(q => {
        let zone = (q.zone || '').trim().toUpperCase();
        if (zone) {
            zone = zone.replace(/Ì/g, 'I')
                       .replace(/[ÈÉ]/g, 'E')
                       .replace(/Ò/g, 'O')
                       .replace(/À/g, 'A')
                       .replace(/Ù/g, 'U');
        } else {
            zone = 'N/D';
        }
        if (!zoneMap[zone]) zoneMap[zone] = { total: 0, rev: 0, count: 0 };
        zoneMap[zone].total += 1;
        if (['Chiuso', 'Ordine Confermato'].includes(q.status)) {
            zoneMap[zone].rev += q.items.reduce((acc, i) => acc + (i.total || 0), 0);
        }
    });

    let htmlZone = `
    <table class="simple-table" style="width:100%">
        <thead>
            <tr>
                <th>Zona</th>
                <th>N. Preventivi</th>
                <th>Fatturato (Accettato)</th>
                <th>Media per Prev.</th>
            </tr>
        </thead>
        <tbody>`;

    Object.entries(zoneMap)
        .sort((a, b) => b[1].rev - a[1].rev)
        .forEach(([name, data]) => {
            htmlZone += `<tr>
                <td>${name}</td>
                <td>${data.total}</td>
                <td>${formatCurrency(data.rev)} €</td>
                <td>${data.total > 0 ? formatCurrency(data.rev / data.total) : '-'} €</td>
            </tr>`;
        });
    htmlZone += '</tbody></table>';
    document.getElementById('reportZoneContainer').innerHTML = htmlZone;
}

let charts = {};

// Chart Global State
window.charts = window.charts || {};

window.renderStatsCharts = function () {
    if (typeof Chart === 'undefined') return;

    const ctxTrend = document.getElementById('chartTrend').getContext('2d');
    const ctxStatus = document.getElementById('chartStatus').getContext('2d');
    const ctxProductsQuoted = document.getElementById('chartProductsQuoted').getContext('2d');
    const ctxProductsSold = document.getElementById('chartProductsSold').getContext('2d');
    const ctxProductsLost = document.getElementById('chartProductsLost').getContext('2d');
    const ctxConversion = document.getElementById('chartConversion').getContext('2d');

    const start = document.getElementById('statsDateStart').value || null;
    const end = document.getElementById('statsDateEnd').value || null;

    const trendData = db.getMonthlyTrend(start, end);
    const statusData = db.getQuotesByStatus(start, end);
    
    const productQuotedData = db.getTopProductsQuoted(start, end);
    const productSoldData = db.getTopProductsSold(start, end);
    const productLostData = db.getTopProductsLost(start, end);
    
    const conversionData = db.getConversionByAgent(start, end);

    const destroyChart = (key) => { if (window.charts[key]) window.charts[key].destroy(); };
    const commonOptions = { responsive: true, maintainAspectRatio: false };

    // 1. Trend (Line)
    destroyChart('trend');
    window.charts['trend'] = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: trendData.map(d => d.name),
            datasets: [{
                label: 'Fatturato (€)',
                data: trendData.map(d => d.value),
                borderColor: '#4ead7a',
                backgroundColor: 'rgba(78, 173, 122, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: commonOptions
    });

    // 2. Status (Doughnut)
    destroyChart('status');
    window.charts['status'] = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: statusData.map(d => d.name),
            datasets: [{
                data: statusData.map(d => d.value),
                backgroundColor: ['#4ead7a', '#a6c1ee', '#e9a1a1', '#f0dc82'],
            }]
        },
        options: commonOptions
    });

    // 3a. Products Quoted (Horizontal Bar)
    destroyChart('productsQuoted');
    window.charts['productsQuoted'] = new Chart(ctxProductsQuoted, {
        type: 'bar',
        data: {
            labels: productQuotedData.map(d => {
                const n = d.name || 'N/A';
                return n.length > 20 ? n.substring(0, 20) + '...' : n;
            }),
            datasets: [{
                label: 'Preventivato (€)',
                data: productQuotedData.map(d => d.value),
                backgroundColor: 'rgba(100, 116, 139, 0.7)',
                borderColor: '#64748b',
                borderWidth: 1
            }]
        },
        options: {
            ...commonOptions,
            indexAxis: 'y',
            scales: { x: { beginAtZero: true } }
        }
    });

    // 3b. Products Sold (Horizontal Bar)
    destroyChart('productsSold');
    window.charts['productsSold'] = new Chart(ctxProductsSold, {
        type: 'bar',
        data: {
            labels: productSoldData.map(d => {
                const n = d.name || 'N/A';
                return n.length > 20 ? n.substring(0, 20) + '...' : n;
            }),
            datasets: [{
                label: 'Venduto (€)',
                data: productSoldData.map(d => d.value),
                backgroundColor: 'rgba(20, 83, 45, 0.7)',
                borderColor: '#14532d',
                borderWidth: 1
            }]
        },
        options: {
            ...commonOptions,
            indexAxis: 'y',
            scales: { x: { beginAtZero: true } }
        }
    });

    // 3c. Products Lost (Horizontal Bar)
    destroyChart('productsLost');
    window.charts['productsLost'] = new Chart(ctxProductsLost, {
        type: 'bar',
        data: {
            labels: productLostData.map(d => {
                const n = d.name || 'N/A';
                return n.length > 20 ? n.substring(0, 20) + '...' : n;
            }),
            datasets: [{
                label: 'Perso (€)',
                data: productLostData.map(d => d.value),
                backgroundColor: 'rgba(127, 29, 29, 0.7)',
                borderColor: '#7f1d1d',
                borderWidth: 1
            }]
        },
        options: {
            ...commonOptions,
            indexAxis: 'y',
            scales: { x: { beginAtZero: true } }
        }
    });

    // 4. Conversion (Bar)
    destroyChart('conversion');
    window.charts['conversion'] = new Chart(ctxConversion, {
        type: 'bar',
        data: {
            labels: conversionData.map(d => d.name),
            datasets: [{
                label: 'Tasso Conversione (%)',
                data: conversionData.map(d => d.value),
                backgroundColor: '#f59e0b'
            }]
        },
        options: { ...commonOptions, scales: { y: { beginAtZero: true, max: 100 } } }
    });

    // 5. Zone (Bar/Doughnut) - Let's use Bar for consistency with turnover
    const ctxZone = document.getElementById('chartZone').getContext('2d');
    const zoneData = db.getTurnoverByZone(start, end);

    destroyChart('zone');
    window.charts['zone'] = new Chart(ctxZone, {
        type: 'bar', // or doughnut if preferred
        data: {
            labels: zoneData.map(d => d.name),
            datasets: [{
                label: 'Fatturato (€)',
                data: zoneData.map(d => d.value),
                backgroundColor: '#8b5cf6'
            }]
        },
        options: commonOptions
    });
}
// Removed Charts Logic as requested

// --- BULK OPERATIONS MODAL ---

window.openBulkOpsModal = function () {
    const modal = document.getElementById('bulkOpsModal');
    if (!modal) return;

    // Popola il dropdown categoria nel pannello prezzi e export
    const cats = (db.getProducts('') || []).reduce((acc, p) => {
        if (p.category && !acc.includes(p.category)) acc.push(p.category);
        return acc;
    }, []).sort();

    ['bulkPriceCategoryFilter', 'bulkExportCategoryFilter'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">— Tutte le categorie —</option>' +
            cats.map(c => `<option value="${c}"${c === currentVal ? ' selected' : ''}>${c}</option>`).join('');
    });

    updateBulkPricePreview();
    modal.classList.remove('hidden');
};

window.closeBulkOpsModal = function () {
    const modal = document.getElementById('bulkOpsModal');
    if (modal) modal.classList.add('hidden');
};

/** Aggiorna il contatore "prodotti coinvolti" nel pannello modifica prezzi */
window.updateBulkPricePreview = function () {
    const catFilter = document.getElementById('bulkPriceCategoryFilter')?.value || '';
    const preview = document.getElementById('bulkPricePreview');
    if (!preview) return;

    let products = db.getProducts('') || [];
    if (catFilter) products = products.filter(p => p.category === catFilter);
    preview.textContent = products.length;
};

/** Applica variazione % prezzi */
window.applyBulkPriceChange = async function () {
    const catFilter = document.getElementById('bulkPriceCategoryFilter')?.value || null;
    const pctRaw = document.getElementById('bulkPricePercent')?.value || '';
    const fieldTarget = document.querySelector('input[name="bulkPriceTarget"]:checked')?.value || 'both';

    const pct = parseFloat(pctRaw);
    if (isNaN(pct) || pct === 0) {
        alert('Inserisci una variazione percentuale valida (es. +10 o -5).');
        return;
    }

    let products = db.getProducts('') || [];
    if (catFilter) products = products.filter(p => p.category === catFilter);

    const fieldLabel = fieldTarget === 'priceMin' ? 'Prezzo Min' :
                       fieldTarget === 'priceMax' ? 'Prezzo Max' : 'Prezzo Min e Max';
    const scopeLabel = catFilter ? `categoria "${catFilter}"` : 'tutti i prodotti';
    const sign = pct > 0 ? '+' : '';

    if (!confirm(`Applicare una variazione di ${sign}${pct}% su ${fieldLabel} per ${scopeLabel}?\n\n${products.length} prodotti verranno aggiornati.`)) return;

    showLoadingSpinner(`Aggiornamento prezzi in corso (${sign}${pct}%)...`);
    try {
        const count = await db.bulkUpdatePrices(catFilter, fieldTarget, pct);
        await renderProductsTable();
        alert(`✅ Completato! ${count} prodotti aggiornati (${sign}${pct}% su ${fieldLabel}).`);
    } catch (e) {
        console.error('applyBulkPriceChange error:', e);
        alert('Errore durante l\'aggiornamento prezzi: ' + (e.message || e));
    } finally {
        hideLoadingSpinner();
    }
};

/** Export prodotti filtrati per categoria */
window.exportProductsByCategory = function () {
    const catFilter = document.getElementById('bulkExportCategoryFilter')?.value || '';
    let products = db.getProducts('') || [];
    if (catFilter) products = products.filter(p => p.category === catFilter);

    if (products.length === 0) {
        alert('Nessun prodotto da esportare con questo filtro.');
        return;
    }

    const rows = products.map(p => ({
        'ID':          p.id            || '',
        'Codice':      p.code          || '',
        'Classe':      p.classe        || '',
        'Collezione':  p.category      || '',
        'Descrizione': p.description   || '',
        'U.M.':        p.uom           || '',
        'Prezzo Min':  p.priceMin      ?? (p.price_min  ?? ''),
        'Prezzo Max':  p.priceMax      ?? (p.price_max  ?? ''),
        'Essenza':     p.essenza       || '',
        'Tipo':        p.tipo          || '',
        'Scelta':      p.var1          || '',
        'Finitura':    p.var2          || '',
        'PrezzoMat.':  p.var3          || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
        { wch: 22 }, { wch: 14 }, { wch: 8 }, { wch: 20 }, { wch: 50 },
        { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
        { wch: 12 }, { wch: 12 }, { wch: 14 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prodotti');

    const today = new Date().toISOString().slice(0, 10);
    const suffix = catFilter ? `_${catFilter.replace(/[^a-z0-9]/gi, '_')}` : '_Tutti';
    XLSX.writeFile(workbook, `Prodotti_Genesy${suffix}_${today}.xlsx`);

    console.log(`✅ Export ${rows.length} prodotti${catFilter ? ` (cat: ${catFilter})` : ''}.`);
};

// --- EXCEL IMPORT / EXPORT LOGIC ---

window.downloadProductTemplate = function () {
    // Columns mapping
    const headers = ['Categoria', 'Codice', 'Descrizione', 'U.M.', 'PrezzoMin', 'PrezzoMax', 'Essenza', 'Tipologia', 'Scelta', 'Finitura', 'Formato'];

    const data = [
        ['ISTRUZIONI: Compila il file partendo dalla riga sotto le intestazioni. Non modificare o spostare le colonne. I campi Categoria, Codice e Descrizione sono obbligatori.'],
        headers,
        ['Pavimenti', 'PQ-ROV-01', 'Parquet Rovere Naturale', 'mq', 45.50, 65.00, 'Rovere', 'Prefinito', '1a Scelta', 'Naturale', '150x1200'],
        ['Chimica', 'COLLA-B', 'Colla Bicimponente', 'pz', 35.00, 35.00, '', '', 'Standard', '', '10kg'],
        ['Battiscopa', 'BAT-BIANCO', 'Battiscopa Bianco 8cm', 'ml', 8.50, 8.50, 'Legno', '', '', 'Laccato', '80mm']
    ];

    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set Column Widths (friendly)
    ws['!cols'] = [
        { wch: 15 }, // Categoria
        { wch: 15 }, // Codice
        { wch: 40 }, // Descrizione
        { wch: 8 },  // UM
        { wch: 10 }, // Min
        { wch: 10 }, // Max
        { wch: 12 }, // Essenza
        { wch: 12 }, // Tipologia
        { wch: 12 }, // Scelta
        { wch: 12 }, // Finitura
        { wch: 12 }  // Formato
    ];

    // --- STYLING ---
    const range = XLSX.utils.decode_range(ws['!ref']);

    // Instructions Style (Row 0)
    const styleInstr = {
        font: { italic: true, color: { rgb: "333333" } },
        fill: { fgColor: { rgb: "FFF2CC" } }, // Light Yellow
        alignment: { wrapText: true, vertical: "center" },
        border: { bottom: { style: "thin", color: { rgb: "D9D9D9" } } }
    };

    // Header Style (Row 1)
    const styleHeader = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4472C4" } }, // Blue
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "medium" }, left: { style: "thin" }, right: { style: "thin" } }
    };

    // Data Style
    const styleData = {
        border: { bottom: { style: "thin", color: { rgb: "E2E2E2" } } }
    };

    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cell_address]) continue;

            if (R === 0) {
                // Instructions
                ws[cell_address].s = styleInstr;
            } else if (R === 1) {
                // Headers
                ws[cell_address].s = styleHeader;
            } else {
                // Data
                ws[cell_address].s = styleData;
            }
        }
    }

    // Merge Instructions Row
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } });

    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prodotti");

    // Download
    XLSX.writeFile(wb, "modello_prodotti_pro.xlsx");
}

window.importProducts = function (input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Assume first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Header:1 gives array of arrays

        if (jsonData.length < 2) {
            alert('File vuoto o formato non valido');
            return;
        }

        // Find Header Row (Robustness)
        let headerRowIndex = 0;
        for (let r = 0; r < Math.min(jsonData.length, 5); r++) {
            if (jsonData[r] && jsonData[r][0] && jsonData[r][0].toString().trim().toLowerCase() === 'categoria') {
                headerRowIndex = r;
                break;
            }
        }

        // Map data (Skip header row)
        const newProducts = [];
        let errors = 0;

        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            // Updated Order: Cat[0], Code[1], Desc[2], UM[3], Min[4], Max[5], Essenza[6], Tipo[7], Var1[8], Var2[9], Var3[10]
            try {
                const p = {
                    category: row[0] || 'Generico',
                    code: row[1] || `IMP-${Date.now()}-${i}`,
                    description: row[2] || 'Prodotto Importato',
                    uom: row[3] || 'pz',
                    priceMin: parseFloat(row[4]) || 0,
                    priceMax: parseFloat(row[5]) || 0,
                    essenza: row[6] ? row[6].toString() : '',
                    tipo: row[7] ? row[7].toString() : '',
                    var1: row[8] ? row[8].toString() : '',
                    var2: row[9] ? row[9].toString() : '',
                    var3: row[10] ? row[10].toString() : ''
                };
                newProducts.push(p);
            } catch (e) {
                console.error("Row parse error", i, e);
                errors++;
            }
        }

        if (newProducts.length > 0) {
            db.saveProductsBulk(newProducts);
            alert(`Importazione completata: ${newProducts.length} prodotti aggiunti.`);

            // Refresh UI
            populateFilterOptions();
            renderProductsTable();
        } else {
            alert('Nessun prodotto valido trovato nel file.');
        }

        input.value = ''; // Reset
    };
    reader.readAsArrayBuffer(file);
}

// --- VARS MANAGEMENT ---
let currentVarList = [];
let currentVarKey = 'categories';

window.openVarsModal = function () {
    document.getElementById('varsModal').classList.remove('hidden');
    renderVarsList();
}

window.syncCategoriesFromProducts = async function () {
    if (!confirm("Vuoi scansionare tutti i prodotti e aggiungere le categorie mancanti alla lista?")) return;

    const products = db.getProducts();
    const vars = db.getProductVars();
    const currentCats = vars.categories || [];
    const newCats = new Set(currentCats);
    let addedCount = 0;

    products.forEach(p => {
        if (p.category && p.category.trim() !== '') {
            if (!newCats.has(p.category)) {
                newCats.add(p.category);
                addedCount++;
            }
        }
    });

    if (addedCount > 0) {
        const updatedList = Array.from(newCats).sort();
        await db.updateVarList('categories', updatedList);
        renderVarsList();
        populateFilterOptions();
        alert(`Sincronizzazione completata! Aggiunte ${addedCount} nuove categorie.`);
    } else {
        alert("Nessuna nuova categoria trovata nei prodotti.");
    }
};

window.renderVarsList = function () {
    const selector = document.getElementById('varsListSelector');
    if (!selector) return;
    const currentVarKey = selector.value;

    const vars = db.getProductVars();
    currentVarList = [...(vars[currentVarKey] || [])];

    // Toggle Agent Inputs
    const agentInputs = document.getElementById('agentInputs');
    if (agentInputs) {
        if (currentVarKey === 'agents') agentInputs.classList.remove('hidden');
        else agentInputs.classList.add('hidden');
    }

    const container = document.getElementById('varsListContainer');
    container.innerHTML = '';

    // Add Sync Button for Categories
    if (currentVarKey === 'categories') {
        const syncBtn = document.createElement('button');
        syncBtn.className = 'btn-secondary w-100';
        syncBtn.style.marginBottom = '10px';
        syncBtn.innerHTML = '<i class="fa-solid fa-sync"></i> Sincronizza da Prodotti';
        syncBtn.onclick = window.syncCategoriesFromProducts;
        container.appendChild(syncBtn);
    }

    // Sort Agents specially or alphabetical? Alphabetical is fine.
    currentVarList.sort();

    currentVarList.forEach(item => {
        let extraHtml = '';
        let detailsHtml = '';

        if (currentVarKey === 'agents') {
            const zones = db.getAgentZones(item);
            const zoneDisplay = zones.length > 0 ? (zones.length > 1 ? `(${zones.length}) ${zones[0]}...` : zones[0]) : 'Nessuna';

            // Metadata
            const meta = (vars.agentsMetadata && vars.agentsMetadata[item]) || { phone: '', email: '' };
            detailsHtml = `<div style="font-size:0.75rem; color:#64748b;">
                ${meta.phone ? `<i class="fa-solid fa-phone"></i> ${meta.phone} ` : ''}
                ${meta.email ? `<i class="fa-solid fa-envelope"></i> ${meta.email}` : ''}
            </div>`;

            extraHtml = `
            <button class="btn-icon" onclick="editAgentInfo('${item}')" title="Modifica Contatti" style="width:auto; padding:0 5px; margin-right:5px; font-size:0.8em; color: #4f46e5;">
                <i class="fa-solid fa-address-card"></i>
            </button>
            <button class="btn-icon" onclick="editAgentZone('${item}')" title="Modifica Zone: ${zones.join(', ')}" style="width:auto; padding:0 5px; margin-right:5px; font-size:0.8em;">
                <i class="fa-solid fa-map-marker-alt"></i> ${zoneDisplay}
            </button>`;
        }

        const div = document.createElement('div');
        div.className = 'picker-item';
        div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid #f1f5f9;';
        div.innerHTML = `
            <div style="flex:1;">
                <div style="font-weight:500;">${item}</div>
                ${detailsHtml}
            </div>
            <div style="display:flex; align-items:center;">
                ${extraHtml}
                <button class="btn-icon delete" onclick="removeVarItem('${item}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(div);
    });
};

window.editAgentInfo = function (agentName) {
    const vars = db.getProductVars();
    const meta = (vars.agentsMetadata && vars.agentsMetadata[agentName]) || { phone: '', email: '' };

    const newPhone = prompt("Telefono per " + agentName + ":", meta.phone);
    if (newPhone === null) return; // Cancelled

    const newEmail = prompt("Email per " + agentName + ":", meta.email);
    if (newEmail === null) return; // Cancelled

    if (!vars.agentsMetadata) vars.agentsMetadata = {};
    vars.agentsMetadata[agentName] = { phone: newPhone.trim(), email: newEmail.trim() };

    db.updateVarList('agentsMetadata', vars.agentsMetadata);
    setTimeout(renderVarsList, 100); // Pulse refresh
};

window.editAgentZone = function (agent) {
    const zones = db.getZones();
    let zoneMsg = `Modifica Zone Predefinite per ${agent}\nInserisci le zone separate da virgola (es. Rimini, Cesena):`;
    if (zones.length > 0) zoneMsg += "\n(Esistenti: " + zones.join(', ') + ")";

    let current = db.getAgentZones(agent).join(', ');
    const newZone = prompt(zoneMsg, current);

    if (newZone !== null) {
        const rawZones = newZone.split(',').map(s => s.trim()).filter(s => s);

        // Auto-add new global zones
        let addedGlobal = false;
        rawZones.forEach(z => {
            if (z && !zones.includes(z)) {
                zones.push(z);
                addedGlobal = true;
            }
        });
        if (addedGlobal) db.updateVarList('zones', zones);

        db.setAgentZones(agent, rawZones);
        if (rawZones.length > 0) db.setZoneAgent(rawZones[0], agent);

        renderVarsList();
    }
}

window.addVarItem = function () {
    const input = document.getElementById('newVarInput');
    const val = input.value.trim();
    if (!val) return;

    if (!currentVarList.includes(val)) {
        currentVarList.push(val);
        currentVarList.sort();

        // Handle Metadata for Agents
        if (currentVarKey === 'agents') {
            const phone = document.getElementById('newVarPhone').value.trim();
            const email = document.getElementById('newVarEmail').value.trim();

            const vars = db.getProductVars();
            if (!vars.agentsMetadata) vars.agentsMetadata = {};
            vars.agentsMetadata[val] = { phone, email };

            // Clear inputs
            document.getElementById('newVarPhone').value = '';
            document.getElementById('newVarEmail').value = '';

            // Save Metadata implicitly via full var save? 
            // db.updateVarList only saves THE LIST.
            // I need a way to save the metadata object too.
            // DataService.updateVarList updates 'vars', which includes metadata?
            // No, updateVarList(key, list) - it sets vars[key] = list.
            // It doesn't save OTHER keys unless they are in 'vars'.

            // We need to trigger a save of the 'agentsMetadata' key as well.
            db.updateVarList('agentsMetadata', vars.agentsMetadata);
        }

        saveVars();
    }
    input.value = '';
}

window.removeVarItem = function (val) {
    if (!confirm('Rimuovere questo valore dalla lista?')) return;
    currentVarList = currentVarList.filter(i => i !== val);

    // Cleanup metadata
    if (currentVarKey === 'agents') {
        const vars = db.getProductVars();
        if (vars.agentsMetadata && vars.agentsMetadata[val]) {
            delete vars.agentsMetadata[val];
            db.updateVarList('agentsMetadata', vars.agentsMetadata);
        }
    }

    saveVars();
}

function saveVars() {
    db.updateVarList(currentVarKey, currentVarList);
    renderVarsList();
    populateFilterOptions(); // Refresh main UI
}

// --- BACKUP SYSTEM ---
window.downloadBackup = function () {
    db.exportDatabaseToExcel();
}

window.restoreBackup = function (input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const success = db.importDatabaseFromExcel(e.target.result);
        if (success) {
            alert('Backup ripristinato con successo! La pagina verrà ricaricata.');
            window.location.reload();
        }
    };
    reader.readAsArrayBuffer(file);
}

// --- ADMIN UI UPDATE ---
window.updateAdminUI = function () {
    if (!db || !db.cacheLoaded) return; // Wait for DB

    // Auto-Sync Giobby if needed
    if (window.syncGiobbyConfig) window.syncGiobbyConfig();

    // 1. Settings Button
    const btn = document.getElementById('btnSettings') || document.querySelector('button[onclick="openSettings()"]');
    if (btn) {
        // ALWAYS VISIBLE (Content filtered inside by updateSettingsVisibility)
        btn.classList.remove('hidden');
        btn.style.display = 'flex'; // Force flex/block to ensure it shows
    }

    // 2. Admin Filters (Reminders) handled in widget render

    // 3. Hide Advanced Tools Button
    const restrictedIds = [
        'btnExplodeHeader', 'btnExplodeFooter', 'btnCompEditor', 'btnPageGuides',
        'btnA4Optimization'
    ];
    restrictedIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (db.isAdmin) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    });
};

/**
 * Returns the proxied URL for Giobby API calls.
 * - On localhost: uses corsproxy.io (free for local dev)
 * - On production (Netlify): uses our own server-side function (no limits, no CORS)
 */
window.getGiobbyProxiedUrl = function (url) {
    const isLocalhost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
    if (isLocalhost) {
        return 'https://corsproxy.io/?' + encodeURIComponent(url);
    }
    return '/.netlify/functions/giobby-proxy?url=' + encodeURIComponent(url);
};

// Monitor DB load for UI update
// Auto-Sync Giobby Config for Non-Admins
window.authenticateGiobby = async function (config) {
    if (!config.clientId || (!config.clientSecret && (!config.user || !config.password || !config.cid))) {
        console.warn("Auth Giobby: Missing credentials");
        return null; // Cannot login
    }

    let baseUrlAuth = config.isQA ? "https://authqa.giobby.com" : "https://auth.giobby.com";
    let tokenUrl = baseUrlAuth + "/auth/realms/api-server/protocol/openid-connect/token";

    if (config.useProxy) {
        tokenUrl = window.getGiobbyProxiedUrl(tokenUrl);
    }

    const bodyParams = new URLSearchParams();
    if (config.clientSecret) {
        bodyParams.append('grant_type', 'client_credentials');
        bodyParams.append('client_id', config.clientId);
        bodyParams.append('client_secret', config.clientSecret);
    } else {
        bodyParams.append('grant_type', 'password');
        bodyParams.append('client_id', config.clientId);
        bodyParams.append('username', config.user);
        bodyParams.append('password', config.password);
        bodyParams.append('cid', config.cid);
    }

    try {
        const tokenRes = await fetch(tokenUrl, {
            method: 'POST',
            body: bodyParams
        });

        if (!tokenRes.ok) {
            console.warn("Auth Giobby Failed:", tokenRes.statusText);
            return null;
        }

        const tokenData = await tokenRes.json();
        return tokenData.access_token;
    } catch (e) {
        console.error("Auth Giobby Error:", e);
        return null;
    }
};

/**
 * Decodes a JWT token (without verification) to extract the payload.
 * @param {string} token - The JWT access_token string.
 * @returns {object|null} The decoded payload, or null on error.
 */
window.decodeJwt = function (token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        // Base64url decode the payload (second part)
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(atob(base64).split('').map(c =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        return JSON.parse(json);
    } catch (e) {
        console.warn('[Giobby] JWT decode failed:', e);
        return null;
    }
};

/**
 * Resolves the real Giobby API endpoint URL using the official discovery endpoint.
 * Per doc: decode JWT → extract idCompany → GET /GiobbyApiLogin/v1/endpoint?idCompany=...
 * @param {string} accessToken - The Giobby access token.
 * @param {boolean} useProxy - Whether to route through corsproxy.io.
 * @param {string} [fallbackCid] - Fallback CID if JWT decode fails.
 * @returns {string|null} The resolved GiobbyApiURL, or null on failure.
 */
window.resolveGiobbyApiUrl = async function (accessToken, useProxy, fallbackCid) {
    // Step 1: Decode JWT to extract idCompany
    const payload = window.decodeJwt(accessToken);
    const idCompany = payload && (payload.idCompany || payload.company_id || payload.cid);

    if (!idCompany) {
        console.warn('[Giobby] idCompany not found in JWT payload. Payload:', payload);
        // Fallback: try with the CID provided at login
        if (!fallbackCid) return null;
        console.warn('[Giobby] Using fallbackCid:', fallbackCid);
    }

    const companyId = idCompany || fallbackCid;

    // Step 2: Call the official endpoint discovery URL
    let discoveryUrl = `https://app.giobby.com/GiobbyApiLogin/v1/endpoint?idCompany=${encodeURIComponent(companyId)}`;
    if (useProxy) discoveryUrl = window.getGiobbyProxiedUrl(discoveryUrl);

    try {
        const res = await fetch(discoveryUrl, {
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'X-Giobby-Realm': 'api-server'
            }
        });

        if (!res.ok) {
            console.warn('[Giobby] Endpoint discovery failed:', res.status, await res.text());
            return null;
        }

        const data = await res.json();
        const apiUrl = data.GiobbyApiURL || data.giobbyApiURL || data.apiUrl;
        if (apiUrl) {

            return apiUrl;
        } else {
            console.warn('[Giobby] Discovery response missing GiobbyApiURL field:', data);
            return null;
        }
    } catch (e) {
        console.error('[Giobby] Endpoint discovery error:', e);
        return null;
    }
};

window.syncGiobbyConfig = async function () {
    if (!db) return;
    
    // First priorities: load from app_config (the new system)
    const storedConfig = db.getGiobbyConfigDB(false) || {};
    const settings = db.getSettings() || {};

    // Check if we already have a valid config with token AND apiUrl in localStorage
    const existingJson = localStorage.getItem('giobbyConfig');
    if (existingJson) {
        const existing = JSON.parse(existingJson);
        // Only skip if we have BOTH a token AND a valid apiUrl AND the token is fresh (< 8h)
        const tokenAge = existing.lastLogin ? (Date.now() - existing.lastLogin) : Infinity;
        const tokenFresh = tokenAge < 8 * 60 * 60 * 1000; // 8 hours
        if (existing.accessToken && existing.apiUrl && !existing.apiUrl.includes('00553') && tokenFresh) return; // Already setup and fresh
    }

    // Map DB Settings to Config
    // 1. Try new app_config (storedConfig)
    // 2. Fallback to legacy settings table (snake_case or camelCase)
    const map = (keyNew, keyOld1, keyOld2) => storedConfig[keyNew] || settings[keyOld1] || settings[keyOld2] || "";

    let rawInstanceId = map('instanceId', 'giobby_instance_id', 'giobbyInstanceId');
    if (rawInstanceId === '00553') rawInstanceId = '00554';

    const config = {
        user: map('user', 'giobby_username', 'giobbyUsername'),
        password: map('password', 'giobby_password', 'giobbyPassword'),
        cid: map('cid', 'giobby_tenant_id', 'giobbyTenantId'),
        instanceId: rawInstanceId,
        clientId: map('clientId', 'giobby_client_id', 'giobbyClientId'),
        clientSecret: map('clientSecret', 'giobby_client_secret', 'giobbyClientSecret'),
        useProxy: storedConfig.useProxy !== undefined ? storedConfig.useProxy : !!(settings['giobby_use_proxy'] || settings['giobbyUseProxy']),
        isQA: storedConfig.isQA !== undefined ? storedConfig.isQA : !!(settings['giobby_qa'] || settings['giobbyQA']),
        vatRC: (function() {
            let val = map('vatRC', 'giobby_vat_rc', 'giobbyVatRC') || 'N6';
            if (val === 'N.I.Art.17,c6,DPR 633/72') return 'N6'; // Auto-migrate old default
            return val;
        })(),
        vatZero: map('vatZero', 'giobby_vat_zero', 'giobbyVatZero') || 'N4',
        apiUrl: "" // Will be discovered or set later
    };

    if (!config.clientId) return; // No config in DB

    // Auto-Login to get Token
    const token = await window.authenticateGiobby(config);
    if (token) {
        config.accessToken = token;
        config.lastLogin = new Date().getTime();

        // Step 2: Resolve the REAL API endpoint via JWT decode + official discovery
        // Per doc: decode JWT → idCompany → GET /GiobbyApiLogin/v1/endpoint?idCompany=...
        const resolvedUrl = await window.resolveGiobbyApiUrl(token, config.useProxy, config.cid);
        if (resolvedUrl) {
            config.apiUrl = resolvedUrl.endsWith('/') ? resolvedUrl : resolvedUrl + '/';

        } else {
            // Fallback: construct URL manually (old behavior)
            let baseApi = config.isQA ? "https://qa.giobby.com" : "https://app.giobby.com";
            let instId = config.instanceId || '00554';
            if (instId === '00553') instId = '00554';
            config.apiUrl = baseApi + "/GiobbyApi" + instId + "/v1/";
            console.warn('[Giobby] syncGiobbyConfig: using fallback apiUrl:', config.apiUrl);
        }

        localStorage.setItem('giobbyConfig', JSON.stringify(config));

        // Update UI if present
        if (typeof window.loadGiobbySettings === 'function') window.loadGiobbySettings();
    }
};


const checkAdminInterval = setInterval(() => {
    if (typeof db !== 'undefined' && db.cacheLoaded) {
        updateAdminUI();
        clearInterval(checkAdminInterval);
    }
}, 500);

// --- NAVIGATION HELPERS ---
// --- NAVIGATION HELPERS ---
window.updateSettingsVisibility = function () {
    if (!db) return;

    // Cards to Manage
    // ADDED: settingsToolsCard, settingsGuideCard to Admin List
    const adminCards = [
        'settingsToolsCard',
        'adminUserCard',
        'settingsImportCard',
        'settingsDriveCard',
        'settingsGuideCard'
    ];
    // agents see Giobby
    const agentCards = ['settingsGiobbyCard'];
    // shared: Info (Change Pass/Logout)
    const sharedCards = ['settingsInfoCard'];

    if (db.isAdmin) {
        // SHOW ALL
        adminCards.forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.remove('hidden'); el.style.display = ''; }
        });

        // Show List/Layout buttons inside ToolsCard?
        // Since ToolsCard is visible, its content is visible.
        // But previously I had specific logic for buttons.
        // If ToolsCard is visible, we don't need to toggle buttons inside it unless granular control is needed.
        // The buttons are: "Configura Agenti", "Gestione Liste", "Reset Layout".
        // Admins should see them.

    } else {
        // HIDE ADMIN CARDS
        adminCards.forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
        });

        // Ensure Giobby Card is Visible
        const giobbyCard = document.getElementById('settingsGiobbyCard');
        if (giobbyCard) { giobbyCard.classList.remove('hidden'); giobbyCard.style.display = ''; }

        // Ensure Info Card is Visible
        const infoCard = document.getElementById('settingsInfoCard');
        if (infoCard) { infoCard.classList.remove('hidden'); infoCard.style.display = ''; }
    }
};

// (openSettings — using version below ~6681 with Giobby/admin logic)

// Auto-Backup on Close (Best Effort)
// Auto-Backup on Close (Best Efforts)
// --- MIGRATION UTILS ---
window.migrateLocalToCloud = async function () {
    if (!confirm('Questa operazione cercherà vecchi dati salvati nel browser e proverà a caricarli online. Continuare?')) return;

    // 1. Scan LocalStorage for likely patterns
    let foundData = null;
    let foundKey = null;

    // Common keys to check
    const candidates = ['preventivi_data', 'app_data', 'store_db', 'data', 'preventivi_db'];

    for (let k of candidates) {
        const raw = localStorage.getItem(k);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed.quotes || parsed.clients || parsed.products) {
                    foundData = parsed;
                    foundKey = k;
                    break;
                }
            } catch (e) { }
        }
    }

    if (!foundData) {
        // Fallback: Check for ANY key containing the structure
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!candidates.includes(k)) {
                const raw = localStorage.getItem(k);
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && Array.isArray(parsed.quotes)) {
                        foundData = parsed;
                        foundKey = k;
                        break;
                    }
                } catch (e) { }
            }
        }
    }

    if (!foundData) {
        alert('Nessun vecchio dato trovato in questo browser.');
        return;
    }

    const countQ = foundData.quotes ? foundData.quotes.length : 0;
    const countC = foundData.clients ? foundData.clients.length : 0;
    const countP = foundData.products ? foundData.products.length : 0;

    const msg = `Trovati dati locali (${foundKey}):\n- ${countQ} Preventivi\n- ${countC} Clienti\n- ${countP} Prodotti\n\nVuoi importarli nel Cloud? (Potrebbe richiedere un po' di tempo)`;

    if (!confirm(msg)) return;

    // 2. Perform Import
    const loading = document.getElementById('loadingView');
    loading.classList.remove('hidden');

    try {
        let imported = 0;
        let errors = 0;

        // Products
        if (Array.isArray(foundData.products)) {
            for (let p of foundData.products) {
                if (!p || typeof p !== 'object') continue;
                try {
                    // Ensure ID is string if present
                    if (p.id) p.id = String(p.id);
                    await db.saveProduct({ ...p, oldId: p.id });
                    imported++;
                } catch (e) {
                    console.warn("Skipping product", p, e);
                    errors++;
                }
            }
        }

        // Clients
        if (Array.isArray(foundData.clients)) {
            for (let c of foundData.clients) {
                if (!c || typeof c !== 'object') continue;
                try {
                    if (c.id) c.id = String(c.id);
                    await db.saveClient(c);
                    imported++;
                } catch (e) {
                    console.warn("Skipping client", c, e);
                    errors++;
                }
            }
        }

        // Quotes
        if (Array.isArray(foundData.quotes)) {
            for (let q of foundData.quotes) {
                if (!q || typeof q !== 'object') continue;
                try {
                    if (q.id) q.id = String(q.id);
                    q.ownerId = currentUser ? currentUser.uid : 'legacy';
                    q.ownerEmail = currentUser ? currentUser.email : 'legacy';
                    await db.saveQuote(q);
                    imported++;
                } catch (e) {
                    console.warn("Skipping quote", q, e);
                    errors++;
                }
            }
        }

        // Configuration / Vars
        if (foundData.vars && typeof foundData.vars === 'object') {
            try {
                // Merge with existing vars to avoid destroying schema
                const doc = await firebase.firestore().collection('config').doc('global').get();
                let currentVars = {};
                if (doc.exists) {
                    currentVars = doc.data().vars || {};
                }

                // Merge logic: Add new items to arrays
                for (const [key, list] of Object.entries(foundData.vars)) {
                    if (Array.isArray(list)) {
                        const currentList = currentVars[key] || [];
                        const combined = [...new Set([...currentList, ...list])];
                        currentVars[key] = combined;
                    }
                }

                await firebase.firestore().collection('config').doc('global').set({ vars: currentVars }, { merge: true });
                imported++; // Count config as 1 item
            } catch (e) {
                console.warn("Skipping vars import", e);
                errors++;
            }
        }

        let resultMsg = `Migrazione Completata! Importati ${imported} elementi.`;
        if (errors > 0) resultMsg += `\n(Ignorati ${errors} elementi non validi)`;

        alert(resultMsg);
        location.reload();

    } catch (e) {
        console.error(e);
        alert('Errore Critico Importazione: ' + e.message);
        loading.classList.add('hidden');
    }
}


// --- DATA LIST UPDATES ---
function updateProductDatalist() {
    const dataList = document.getElementById('allProductsList');
    if (!dataList) return;

    // Safety check if db is ready
    if (!db || !db.getProducts) return;

    const products = db.getProducts();
    let opts = '';
    products.forEach(p => {
        // Escape quotes to prevent HTML breaking
        const safeDesc = p.description.replace(/"/g, '&quot;');
        opts += `<option value="${safeDesc}">`;
    });
    dataList.innerHTML = opts;
}
window.updateProductDatalist = updateProductDatalist;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    updateDashboard();
    setupDashboardWidgets();
    if (window.updateProductDatalist) window.updateProductDatalist();

    // --- PERSONALIZZAZIONE DOMINIO BOLOGNA ---
    // Se il sito gira su un dominio che contiene 'bologna', sostituisce loghi
    // e pre-imposta le credenziali Giobby di Parquet Bologna.
    const isBolognaSite = window.location.hostname.toLowerCase().includes('bologna');
    if (isBolognaSite) {
        // 1. Logo sidebar (logo.png → logo_bologna.png)
        const sidebarLogo = document.querySelector('.brand img[alt="Genesy Logo"]');
        if (sidebarLogo) {
            sidebarLogo.src = 'logo_bologna.png';
            sidebarLogo.alt = 'Parquet Bologna';
        }

        // 2. Logo schermata login (logo_parquet_romagna_final.png → logo_bologna.png)
        const loginLogo = document.querySelector('.brand-logo img');
        if (loginLogo) {
            loginLogo.src = 'logo_bologna.png';
            loginLogo.alt = 'Parquet Bologna';
        }

        // 3. Pre-imposta credenziali Giobby Bologna nel modal utente
        // (solo se non c'è già una config salvata)
        const existingConfig = localStorage.getItem('giobbyConfig');
        if (!existingConfig) {
            // Pre-riempie il modal al prossimo openUserGiobbyLogin()
            const origOpen = window.openUserGiobbyLogin;
            window.openUserGiobbyLogin = function () {
                if (origOpen) origOpen();
                // Pre-fill Bologna defaults
                setTimeout(() => {
                    const cidEl = document.getElementById('userGiobbyCID');
                    const clientIdEl = document.getElementById('userGiobbyClientId');
                    const instanceEl = document.getElementById('userGiobbyInstanceId');
                    if (cidEl && !cidEl.value) cidEl.value = 'parquetbologna';
                    if (clientIdEl && !clientIdEl.value) clientIdEl.value = 'ZX724PQB-ParquetBologna';
                    if (instanceEl && !instanceEl.value) instanceEl.value = '00554';
                }, 50);
            };
        }

    }
});

// (openVarsModal, renderVarsList, addVarItem — using richer versions above ~5866)

window.deleteVarItem = function (key, val) {
    if (!confirm('Eliminare ' + val + '?')) return;
    const dbVars = db.getProductVars();
    if (dbVars[key]) {
        const newList = dbVars[key].filter(v => v !== val);
        dbVars[key] = newList;
        db.updateVarList(key, newList);
        renderVarsList();
    }
}
// --- DASHBOARD WIDGETS LOGIC REMOVED ---
function setupDashboardWidgets() {
    // Only kept for compatibility if called elsewhere, but logic is empty
}

function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });

    const timeEl = document.getElementById('clockTime');
    const dateEl = document.getElementById('clockDate');

    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.style.display = 'none';
}


// Weather Config
let weatherConfig = {
    name: localStorage.getItem('weatherLocationName') || 'Rimini',
    lat: localStorage.getItem('weatherLat') || 44.06,
    lon: localStorage.getItem('weatherLon') || 12.56
};

window.changeWeatherLocation = function () {
    const newLoc = prompt("Inserisci la nuova località meteo:", weatherConfig.name);
    if (newLoc && newLoc.trim()) {
        const city = newLoc.trim();
        // Geocode
        fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=it&format=json`)
            .then(res => res.json())
            .then(data => {
                if (data.results && data.results.length > 0) {
                    const result = data.results[0];
                    weatherConfig.name = result.name;
                    weatherConfig.lat = result.latitude;
                    weatherConfig.lon = result.longitude;

                    // Save
                    localStorage.setItem('weatherLocationName', weatherConfig.name);
                    localStorage.setItem('weatherLat', weatherConfig.lat);
                    localStorage.setItem('weatherLon', weatherConfig.lon);

                    // Update UI immediately
                    fetchWeather();
                } else {
                    alert("Località non trovata. Riprova.");
                }
            })
            .catch(err => {
                console.error("Geocoding error", err);
                alert("Errore nel cercare la località.");
            });
    }
}

function fetchWeather() {
    // Basic UI update for name
    const locEl = document.getElementById('weatherLocation');
    if (locEl) locEl.textContent = weatherConfig.name;

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${weatherConfig.lat}&longitude=${weatherConfig.lon}&current_weather=true`)
        .then(response => response.json())
        .then(data => {
            if (data.current_weather) {
                const temp = Math.round(data.current_weather.temperature);
                const code = data.current_weather.weathercode;

                const tempEl = document.getElementById('weatherTemp');
                const iconEl = document.getElementById('weatherIcon');

                if (tempEl) tempEl.textContent = `${temp}°`;

                // Simple Icon Mapping
                let iconClass = 'fa-cloud-sun';
                if (code === 0) iconClass = 'fa-sun';
                else if (code >= 1 && code <= 3) iconClass = 'fa-cloud-sun';
                else if (code >= 45 && code <= 48) iconClass = 'fa-smog';
                else if (code >= 51 && code <= 67) iconClass = 'fa-cloud-rain';
                else if (code >= 71 && code <= 86) iconClass = 'fa-snowflake';
                else if (code >= 95) iconClass = 'fa-bolt';

                if (iconEl) iconEl.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
            }
        })
        .catch(err => console.warn("Meteo Error:", err));
}

// --- Admin User Management ---
window.openSettings = function () {
    // Show views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });
    const settingsView = document.getElementById('settings');
    settingsView.classList.remove('hidden');
    settingsView.classList.add('active');

    // Update Nav
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    // Ideally highlight the settings button if it had a data-target, but it uses onclick.
    const settingsBtn = document.querySelector('button[onclick="openSettings()"]');
    if (settingsBtn) settingsBtn.classList.add('active');

    // Load Giobby Config
    if (window.loadGiobbySettings) window.loadGiobbySettings();

    // Admin Check
    const card = document.getElementById('adminUserCard');
    if (card) {
        if (db.isAdmin) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    }
};

window.openUserManagement = async function () {
    if (!db.isAdmin) return;
    document.getElementById('userMgmtModal').classList.remove('hidden');
    await loadUserList();
}

window.closeUserMgmt = function () {
    document.getElementById('userMgmtModal').classList.add('hidden');
}

async function loadUserList() {
    const tbody = document.getElementById('userListBody');
    tbody.innerHTML = '<tr><td colspan="5">Caricamento...</td></tr>';

    try {
        const users = await db.getAllUsers();
        tbody.innerHTML = '';
        users.forEach(u => {
            const isMe = (currentUser && currentUser.email === u.email);
            const status = u.disabled ? '<span class="tag tag-danger">Disabilitato</span>' : '<span class="tag tag-success">Attivo</span>';

            // Actions
            let btnAction = '';
            if (isMe) {
                btnAction = '<span class="text-muted">(Tu)</span>';
            } else {
                // Ban Button
                btnAction += `<button class="btn-sm ${(u.disabled ? 'btn-success' : 'btn-danger')}" onclick="toggleUserBan('${u.id}', ${u.disabled || false})" style="margin-right:5px;">
                    ${u.disabled ? 'Riabilita' : 'Ban'}
                 </button>`;

                // Role Button
                const isAdm = u.role === 'admin';
                btnAction += `<button class="btn-sm btn-secondary" onclick="toggleUserRole('${u.id}', '${u.role || 'agent'}')">
                    ${isAdm ? '<i class="fa-solid fa-arrow-down"></i> Agent' : '<i class="fa-solid fa-arrow-up"></i> Admin'}
                 </button>`;

                // Delete Button
                btnAction += `<button class="btn-sm btn-danger" style="margin-left:5px;" onclick="deleteUser('${u.id}', '${u.email}')" title="Elimina Utente">
                    <i class="fa-solid fa-trash"></i>
                 </button>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td>${u.email}</td>
                    <td>${u.role || 'agent'}</td>
                    <td>${u.lastLogin ? formatDate(u.lastLogin) : '-'}</td>
                    <td>${status}</td>
                    <td>${btnAction}</td>
                </tr>
            `;
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger">Errore: ${e.message}</td></tr>`;
    }
}

window.toggleUserBan = async function (uid, currentStatus) {
    if (!confirm(currentStatus ? 'Riabilitare questo utente?' : 'Disabilitare questo utente?')) return;
    await db.toggleUserStatus(uid, currentStatus);
    loadUserList();
}

window.toggleUserRole = async function (uid, currentRole) {
    const action = currentRole === 'admin' ? 'Retrocedere ad Agente?' : 'Promuovere ad Admin?';
    if (!confirm(action)) return;
    await db.toggleUserRole(uid, currentRole);
    loadUserList();
}

window.deleteUser = async function (uid, email) {
    if (!confirm(`SEI SICURO di voler eliminare l'utente ${email}?\n\nQuesta azione è irreversibile.`)) return;
    try {
        await db.deleteUser(uid);
        alert("Utente eliminato correttamente.");
        loadUserList();
    } catch (e) {
        alert("Errore durante l'eliminazione: " + e.message);
    }
}

// --- USER REGISTRATION (ADMIN HELPER) ---
window.openRegistrationTab = function () {
    const url = window.location.href;
    prompt("⚠️ IMPORTANTE ⚠️\n\nPer non disconnetterti da Admin, devi registrare il nuovo utente in una finestra INCOGNITO o in un altro browser.\n\nCopia questo link e aprilo altrove:", url);
}

// --- DEMO DATA GENERATOR ---


// --- SEEDING TOOL (Restored for Testing) ---
window.seedDatabase = async function (count = 30) {
    const u = firebase.auth().currentUser;
    if (!u) {
        alert("Errore: Devi essere loggato per generare i dati.");
        return;
    }

    if (!confirm(`Generare ${count} preventivi CASUALI?`)) return;

    const { agents, firstNames, lastNames, cities, statuses } = db.test;
    const products = db.getProducts();

    if (products.length === 0) {
        alert("Attenzione: Nessun prodotto in anagrafica. Impossibile generare preventivi con articoli.");
        // We could just generate quotes without items, but let's warn
    }

    const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const getRandomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();

    let generatedCount = 0;

    for (let i = 0; i < count; i++) {
        // Random Agent & Customer
        const agentData = getRandomElement(agents);
        const city = getRandomElement(cities);

        const customer = {
            name: `${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`,
            email: `demo.${Date.now()}.${i}@example.com`,
            phone: `3${getRandomInt(10, 99)} ${getRandomInt(100000, 999999)}`,
            vat: `IT${getRandomInt(10000000000, 99999999999)}`,
            address: `Via ${getRandomElement(lastNames)} ${getRandomInt(1, 100)}, ${city}`,
            city: city,
            type: Math.random() > 0.7 ? 'Azienda' : 'Privato'
        };

        // Random Items
        const items = [];
        let quoteTotal = 0;

        if (products.length > 0) {
            const numItems = getRandomInt(1, 5);
            for (let j = 0; j < numItems; j++) {
                const p = getRandomElement(products);
                const qty = getRandomInt(5, 100);
                const price = parseFloat(p.priceMax) || 0;

                // Add some variance to price
                const finalPrice = Math.random() > 0.5 ? price * 0.9 : price;

                const itemTotal = qty * finalPrice;

                items.push({
                    code: p.code,
                    description: p.description,
                    uom: p.uom,
                    quantity: qty,
                    unitPrice: finalPrice,
                    total: itemTotal
                });
                quoteTotal += itemTotal;
            }
        }

        const date = getRandomDate(new Date(2024, 0, 1), new Date());

        const quote = {
            id: 'DEMO-' + Date.now() + '-' + i,
            date: date,
            createdAt: date,
            status: getRandomElement(statuses),
            customer: customer,
            agent: agentData.name,
            zone: agentData.zone,
            items: items,
            total: quoteTotal,
            notes: "",
            ownerId: u.uid,
            ownerEmail: u.email
        };

        await db.saveQuote(quote);
        generatedCount++;
    }

    alert(`Database popolato con ${generatedCount} preventivi.`);
    location.reload();
};

window.syncClientsAction = async function () {
    const u = firebase.auth().currentUser;
    if (!u) return;

    // Use the toast/tooltip system if available, else alert
    const count = await db.syncClientsFromQuotes();
    if (count > 0) {
        alert(`Sincronizzazione completata! Aggiunti ${count} nuovi clienti all'anagrafica.`);
        renderClientsTable(); // Refresh UI if open
    } else {
        alert("Nessun nuovo cliente da sincronizzare.");
    }
};

// --- DRIVE BACKUP SYSTEM ---
let backupDirHandle = null;

// IndexedDB Helper
const DB_NAME = 'ParquetRomagnaDB';
const STORE_NAME = 'settings';

function getDbPromise() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function saveDriveHandle(handle) {
    const db = await getDbPromise();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(handle, 'driveHandle');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getDriveHandle() {
    const db = await getDbPromise();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get('driveHandle');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function verifyPermission(fileHandle, readWrite) {
    const options = {};
    if (readWrite) {
        options.mode = 'readwrite';
    }
    if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true;
    }
    if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true;
    }
    return false;
}

// User Menu Logic
window.toggleUserMenu = function () {
    if (confirm("Vuoi eseguire il logout e cambiare utente?")) {
        window.logout();
    }
};

window.logout = async function () {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Error logging out:', error);
    } catch (e) {
        console.error("Logout Ex:", e);
    }
    // Force reload
    window.location.reload();
};

window.promptChangePassword = async function () {
    const newPass = prompt("Inserisci la nuova password (min. 6 caratteri):");
    if (!newPass) return; // Cancelled
    if (newPass.length < 6) {
        alert("La password deve essere di almeno 6 caratteri.");
        return;
    }

    try {
        const { data, error } = await supabase.auth.updateUser({ password: newPass });
        if (error) throw error;
        alert("Password aggiornata con successo!");
    } catch (e) {
        console.error("Change Password Error:", e);
        alert("Errore cambio password: " + e.message);
    }
};

// --- DRIVE LOGIC REMOVED PER USER REQUEST ---

function generateQuoteHTML(quote) {
    // Helper to strip HTML tags
    const stripHtml = (html) => {
        if (!html) return '';
        let text = html
            .replace(/Generato il.*/gi, '')
            .replace(/Generato automaticamente.*/gi, '')
            .replace(/Generato per test anagrafica e liste/gi, '');
        const tmp = document.createElement("DIV");
        tmp.innerHTML = text;
        return (tmp.textContent || tmp.innerText || "").trim();
    };

    // Determine Title
    const isOrder = (quote.status === 'Chiuso' || quote.status === 'Ordine Confermato');
    const baseTitle = isOrder ? "CONFERMA D'ORDINE" : "PREVENTIVO";
    let title = baseTitle;

    // Numbering
    const allQuotes = db.getAllQuotes();
    const clientName = quote.customer ? quote.customer.name : '';
    if (clientName) {
        const clientQuotes = allQuotes
            .filter(q => q.customer && q.customer.name === clientName)
            .sort((a, b) => new Date(a.date) - new Date(b.date) || (a.id || '').toString().localeCompare((b.id || '').toString()));
        const count = clientQuotes.length;
        const index = clientQuotes.findIndex(q => q.id === quote.id) + 1;
        if (count > 1 && index > 0) title = `${baseTitle} ${index}`;
    }

    // Agent & Zone
    // Items Rows Logic (handles text rows and standard rows)
    // Filtra righe vuote: escludi items senza descrizione che non siano righe testo libero
    const populatedItems = (quote.items || []).filter(i =>
        i.type === 'text' || (i.description && i.description.trim() !== '')
    );
    let itemsRows = populatedItems.map(i => {
        // --- FREE TEXT ROW ---
        if (i.type === 'text') {
            // Only include if printOnPdf is not explicitly false
            if (i.printOnPdf === false) return '';
            const text = (i.description || '').replace(/\n/g, '<br>');
            return `
        <tr style="border-bottom: 1px dashed #d97706;">
            <td colspan="5" style="padding: 6px 6px; font-style:italic; color:#374151; font-size:13px;">${text}</td>
        </tr>`;
        }
        // --- STANDARD ROW ---
        return `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 6px; border-right: 1px solid #eee;">
                <div style="font-weight:600; font-size:13px; color:#2c3e50;">${stripHtml(i.description)}</div>
                ${i.category ? `<div style="font-size:0.95em; color:#7f8c8d; margin-top:2px;">${i.category}</div>` : ''}
                ${i.notes ? `<div style="font-size:0.95em; font-style:italic; color:#7f8c8d; margin-top:2px;">${stripHtml(i.notes)}</div>` : ''}
            </td>
            <td style="padding: 8px 6px; text-align:center; border-right: 1px solid #eee; color:#555; font-size:13px;">${i.uom}</td>
            <td style="padding: 8px 6px; text-align:right; border-right: 1px solid #eee; font-family:'Roboto Mono', monospace; font-size:13px;">${i.quantity}</td>
            <td style="padding: 8px 6px; text-align:right; border-right: 1px solid #eee; font-family:'Roboto Mono', monospace; font-size:13px;">${i.unitPrice === 0 ? 'OMAGGIO' : formatCurrency(i.unitPrice)}</td>
            <td style="padding: 8px 6px; text-align:right; font-weight:600; font-family:'Roboto Mono', monospace; font-size:13px;">${i.total === 0 ? '<span style="color:#27ae60;">OMAGGIO</span>' : formatCurrency(i.total)}</td>
        </tr>`;
    }).join('');

    // Solo righe popolate — no righe vuote di padding

    // Determine Visibility Prefs
    const effectivePrefs = (quote.customer && quote.customer.printPrefs)
        ? (isOrder ? quote.customer.printPrefs.order : quote.customer.printPrefs.quote)
        : (isOrder
            ? { vat: true, sdi: true, address: true, site: true, contact: true, email: true, phone: true }
            : { vat: true, sdi: false, address: true, site: true, contact: true, email: false, phone: false }
        );

    // Map vatRate to label and percentage
    let vatLabel = '22%';
    let vatPercent = 22;
    if (quote.vatRate !== undefined && quote.vatRate !== null) {
        if (quote.vatRate === '0_rc') {
            vatLabel = '0% Reverse Charge (N6)';
            vatPercent = 0;
        } else if (quote.vatRate === '0_apply') {
            vatLabel = '0% Esente (N4)';
            vatPercent = 0;
        } else if (quote.vatRate === '0_zero' || quote.vatRate === 0 || quote.vatRate === '0') {
            vatLabel = '0% Zero';
            vatPercent = 0;
        } else {
            const parsedVat = parseFloat(quote.vatRate);
            if (isNaN(parsedVat)) {
                vatPercent = 22;
                vatLabel = '22%';
            } else {
                vatPercent = parsedVat <= 1 ? parsedVat * 100 : parsedVat;
                vatLabel = `${vatPercent}%`;
            }
        }
    }

    // Totals Calculation
    const taxAmount = (quote.total * vatPercent) / 100;
    const finalTotal = quote.total + taxAmount;
    const discountValue = quote.discount || 0;

    // TEMPLATE: Larger fonts, 50px margins (more centered look), Absolute Footer
    return `
    <div style="width: 794px; height: 1122px; padding: 0; box-sizing: border-box; position: relative; background: white; font-family: 'Inter', Helvetica, Arial, sans-serif; color: #333; line-height: 1.3; overflow: hidden;">
        
        <!-- CONTENT WRAPPER with padding (Increased to 50px for centering) -->
        <div style="padding: 40px 50px 180px 50px;">
            
            <!-- HEADER -->
            <div style="margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 10px;">
                    <!-- Logo Col -->
                    <div style="width: 100px; flex-shrink:0;">
                         <img src="logo.png" style="width:100px; height:auto;" alt="Logo">
                         <div style="text-align:center; font-weight:800; line-height:1; margin-top:3px; font-size:12px;">PARQUET<br><span style="font-weight:400;">ROMAGNA</span></div>
                    </div>

                    <!-- Info Col -->
                    <div style="text-align: right;">
                        <div style="font-size: 22px; font-weight: 800; color: #333; margin-bottom: 4px; text-transform:uppercase;">${title}</div>
                        <div style="font-weight: bold; font-size: 14px;">Parquet Romagna S.r.l.</div>
                        <div style="font-size: 10px; color: #555; margin-top: 3px; line-height:1.15;">
                            Forlì - Via A. Panagulis 7 | Cesena - Via Savio, 15<br>
                            Ravenna - Via Canale Molinetto, 31 | Riccione - Viale Murano, 24<br>
                            Bologna - Via J. Cage, 7 | Farra di Soligo - Via del sole, 24
                        </div>
                    </div>
                </div>

                <div style="font-size: 13px; color: #666; font-style: italic; line-height: 1.2;">
                    ${(localStorage.getItem('header_text') || 'Progettazione, fornitura e posa in opera<br>Parquet, Decking, Profili, Laminati, Vinilici').replace(/\n/g, '<br>')}
                </div>
            </div>

            <!-- META ROW -->
            <div style="display:flex; justify-content:space-between; margin-bottom: 15px; font-size: 13px; background: #f8f9fa; padding: 8px 12px; border-radius: 4px;">
                <div><strong>Data:</strong> ${new Date(quote.date).toLocaleDateString()}</div>
                ${effectivePrefs.sdi && quote.customer.sdi ? `<div><strong>SDI:</strong> ${quote.customer.sdi}</div>` : ''}
                ${quote.agent ? `<div><strong>Agente:</strong> ${quote.agent}</div>` : ''}
                ${quote.zone && quote.zone !== '-' ? `<div><strong>Zona:</strong> ${quote.zone}</div>` : ''}
            </div>

            <!-- CUSTOMER BOX -->
            <div style="margin-bottom: 20px; border: 1px solid #ddd; border-left: 4px solid #333; padding: 12px 15px; border-radius: 4px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="flex:1;">
                        <div style="font-size: 11px; text-transform: uppercase; color: #888; letter-spacing:1px; margin-bottom:2px;">Spett.le Cliente</div>
                        <h3 style="margin: 0 0 4px; font-size: 17px; font-weight:700;">${quote.customer.name}</h3>
                        
                        ${effectivePrefs.address ? `<div style="font-size:13px; margin-bottom:4px;">
                            ${quote.customer.address || ''} - 
                            ${[quote.customer.zip, quote.customer.city, quote.customer.addressProvince ? '(' + quote.customer.addressProvince + ')' : ''].filter(Boolean).join(' ')}
                        </div>` : ''}

                        <div style="font-size: 12px; color: #666; display:flex; gap: 12px; flex-wrap:wrap;">
                             ${effectivePrefs.vat && quote.customer.vat ? `<span><strong>P.IVA:</strong> ${quote.customer.vat}</span>` : ''}
                             ${quote.customer.fiscal_code ? `<span><strong>C.F.:</strong> ${quote.customer.fiscal_code}</span>` : ''}
                             ${effectivePrefs.email && quote.customer.email ? `<span>✉ ${quote.customer.email}</span>` : ''}
                             ${effectivePrefs.phone && quote.customer.phone ? `<span>📞 ${quote.customer.phone}</span>` : ''}
                        </div>
                    </div>
                    ${effectivePrefs.site && quote.customer.siteAddress ? `
                    <div style="flex:1; border-left:1px solid #eee; padding-left:15px; margin-left:15px; max-width:40%;">
                         <div style="font-size: 11px; text-transform: uppercase; color: #888; letter-spacing:1px; margin-bottom:2px;">Cantiere/Contatto</div>
                         <div style="font-size:13px;">${quote.customer.siteAddress}</div>
                         ${effectivePrefs.contact && quote.customer.contactPerson ? `<div style="font-size:12px; margin-top:2px;"><strong>Alla c.a.:</strong> ${quote.customer.contactPerson}</div>` : ''}
                    </div>` : ''}
                </div>
            </div>

            <!-- ITEMS TABLE -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                <thead>
                    <tr style="border-bottom: 2px solid #333; text-transform: uppercase; font-size: 12px;">
                        <th style="text-align: left; padding: 8px 6px;">Descrizione</th>
                        <th style="text-align: center; padding: 8px 6px; width:45px;">U.M.</th>
                        <th style="text-align: right; padding: 8px 6px; width:60px;">Q.tà</th>
                        <th style="text-align: right; padding: 8px 6px; width:85px;">Prezzo</th>
                        <th style="text-align: right; padding: 8px 6px; width:85px;">Totale</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>

            </table>

            <!-- CLOSING TEXT (Optional - ONLY IF ORDER/CLOSED) -->
            ${quote.closingText && isOrder ? `
            <div style="margin-bottom: 20px; font-size: 13px; line-height: 1.4; white-space: pre-wrap;">${quote.closingText}</div>` : ''}

            <!-- TOTALS & NOTES -->
            <div style="display:flex; gap:25px; align-items:flex-start;">
                
                <!-- NOTES COL -->
                <div style="flex:1;">
                     ${quote.paymentMethod ? `
                    <div style="margin-bottom: 12px; font-size:13px; padding:10px; background:#f1f2f6; border-radius:4px;">
                        <strong>Pagamento:</strong> ${quote.paymentMethod}
                        ${quote.iban ? `<br><strong>IBAN:</strong> ${quote.iban}` : ''}
                    </div>` : ''}

                    ${quote.notes ? `
                    <div style="border:1px solid #eee; padding:10px; border-radius:4px; margin-bottom:12px;">
                        <div style="font-size:12px; font-weight:bold; color:#555; margin-bottom:3px;">Note per il cliente:</div>
                        <div style="font-size:13px; font-style:italic;">${quote.notes.replace(/\n/g, '<br>')}</div>
                    </div>` : ''}
                </div>

                <!-- TOTALS COL -->
                <div style="width: 240px; flex-shrink:0;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px solid #eee;">
                        <div style="display:flex; justify-content:space-between; margin-bottom: 5px; font-size: 13px;">
                            <span style="color:#666;">Imponibile:</span>
                            <strong>${formatCurrency(quote.total)}</strong>
                        </div>
                        ${discountValue > 0 ? `
                        <div style="display:flex; justify-content:space-between; margin-bottom: 5px; font-size: 13px; color:#c0392b;">
                            <span>Sconto Global:</span>
                            <span>-${formatCurrency(discountValue)}</span>
                        </div>` : ''}
                        <div style="display:flex; justify-content:space-between; margin-bottom: 8px; font-size: 13px;">
                            <span style="color:#666;">IVA (${vatLabel}):</span>
                            <span>${formatCurrency(taxAmount)}</span>
                        </div>
                        <div style="border-top: 2px solid #ddd; padding-top: 10px; margin-top: 5px; display:flex; justify-content:space-between; font-size: 19px; font-weight: 800; color:#333; font-family: 'Roboto Mono', monospace;">
                            <span>TOTALE:</span>
                            <span>${formatCurrency(finalTotal)}</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <!-- FOOTER (ABSOLUTE BOTTOM) -->
        <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 20px 50px 25px 50px; border-top: 1px solid #ddd; background: white;">
            <div style="margin-bottom: 10px; font-size:11px; color:#555; text-align:justify; line-height:1.2;">
               <strong>Note Generali:</strong> Il preventivo (se comprensivo di posa) non include eventuali aumenti o costi extra per imprevisti. I prezzi si intendono validi per materiale non fornito ai piani, locali sgombri e massetti idonei. Contributo smaltimento materiali: € 49,30.<br>
               <strong>Glossario Tecnico:</strong> <em>Sfrido:</em> Quantità di materiale tecnicamente persa durante taglio e posa (scarto inevitabile per adattamento). <em>Spazzolatura:</em> Trattamento che risalta la venatura del legno e ne aumenta la resistenza superficiale.
            </div>
            <div style="text-align: center; font-size: 11px; color: #777;">
                <p style="margin:0 0 3px 0;">Grazie per la preferenza accordataci. | Validità offerta: 30 giorni</p>
                <p style="margin:0;">Parquet Romagna S.r.l. - P.IVA IT01234567890 - www.parquetromagna.it</p>
            </div>
            <div style="text-align:right; margin-top:5px;">
                <div style="font-size:10px; color:#999; display:inline-flex; align-items:center; gap:4px;">
                    <img src="https://img.icons8.com/ios-filled/50/27ae60/recycle-sign.png" style="width:13px; opacity:0.7;">
                    carta riciclata
                </div>
            </div>
        </div>
    </div>`;

}

let customConfirmResolve = null;

window.showCustomConfirm = function (message, title = "Attenzione") {
    return new Promise((resolve) => {
        customConfirmResolve = resolve;
        document.getElementById('customConfirmTitle').textContent = title;
        document.getElementById('customConfirmMessage').textContent = message;

        const modal = document.getElementById('customConfirmModal');
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; // Force display
        modal.style.zIndex = '99999'; // Force top
    });
};

window.closeCustomConfirm = function (result) {
    const modal = document.getElementById('customConfirmModal');
    modal.classList.add('hidden');
    modal.style.display = 'none'; // Force hide

    if (customConfirmResolve) {
        customConfirmResolve(result);
        customConfirmResolve = null;
    }
};

// (Function removed to avoid duplication - using version at end of file)


// --- VOICE DICTATION FEATURE ---
let recognition = null;
let isRecording = false;

window.toggleVoiceDictation = function (targetId, btnElement) {
    const target = document.getElementById(targetId);
    // Use provided element or fallback (though fallback is risky on mobile)
    const btn = btnElement || document.querySelector(`button[onclick="toggleVoiceDictation('${targetId}')"]`);

    // Check Support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Il tuo browser non supporta la digitazione vocale. Prova con Chrome o Safari.");
        return;
    }

    // Stop if already recording
    if (isRecording && recognition) {
        recognition.stop();
        stopDictationUI(btn, target); // Force UI reset immediately
        return;
    }

    // Initialize
    recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = function () {
        isRecording = true;
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-microphone-slash fa-fade" style="color: #ef4444;"></i>'; // Red pulsing icon
        }
        target.placeholder = "Parla ora...";
    };

    recognition.onresult = function (event) {
        let finalTranscripts = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                // Ensure spaces between sentences
                if (target.value && !target.value.endsWith(' ')) {
                    target.value += ' ';
                }
                target.value += transcript;

                // CRITICAL: Dispatch events s.t. app logic (onchange/oninput) triggers
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    };

    recognition.onerror = function (event) {
        console.error("Errore vocale:", event.error);
        if (event.error === 'not-allowed') {
            alert("Permesso microfono negato. Controlla le impostazioni del browser.");
        } else if (event.error === 'no-speech') {
            // Ignore, just stopped talking
        } else {
            alert("Errore vocale: " + event.error);
        }
        stopDictationUI(btn, target);
    };

    recognition.onend = function () {
        // Automatically restart if continuous (unless stopped manually)
        // ideally we rely on user stopping it, but on mobile it might time out
        if (isRecording) {
            stopDictationUI(btn, target);
        }
    };

    try {
        recognition.start();
    } catch (e) {
        console.error("Voice start failed:", e);
        alert("Impossibile avviare il riconoscimento vocale: " + e.message);
        stopDictationUI(btn, target);
    }
};

function stopDictationUI(btn, target) {
    isRecording = false;
    if (recognition) {
        recognition.stop();
        recognition = null;
    }
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-microphone" style="color:var(--primary-color);"></i>';
    }
    target.placeholder = "Note aggiuntive...";
}


// --- BULK TOOLS (DEBUG/ADMIN) ---
window.randomizeQuotesAgents = async function () {
    if (!confirm("ATTENZIONE: Questa operazione assegnerà un agente CASUALE a TUTTI i preventivi esistenti e aggiornerà le zone di conseguenza.\nProcedere?")) return;

    try {
        const quotes = db.getAllQuotes();
        const agents = db.getAgents();
        const globalZones = db.getZones(); // Fallback zones

        if (!agents || agents.length === 0) {
            alert("Nessun agente trovato nella lista!");
            return;
        }

        let updateCount = 0;
        for (const q of quotes) {
            // Pick Random Agent
            const randomAgent = agents[Math.floor(Math.random() * agents.length)];

            // Get Agent's Zones
            const agentZones = db.getAgentZones(randomAgent);
            // logic: Use agent's first zone, otherwise random global zone, otherwise empty
            let chosenZone = '';
            if (agentZones && agentZones.length > 0) {
                chosenZone = agentZones[0]; // Default to first personal zone
            } else if (globalZones && globalZones.length > 0) {
                chosenZone = globalZones[Math.floor(Math.random() * globalZones.length)];
            }

            // Update Quote
            q.agent = randomAgent;
            q.zone = chosenZone; // This ensures 'docZone' in Editor is filled

            // Save (awaiting each might be slow, but safe)
            await db.saveQuote(q);
            updateCount++;
        }

        alert(`Operazione completata! Aggiornati ${updateCount} preventivi.`);
        location.reload(); // Force reload to show changes
    } catch (e) {
        console.error("Error randomizing agents:", e);
        alert("Errore durante l'operazione: " + e.message);
    }
};

window.openPivotInfo = function () {
    document.getElementById('pivotInfoModal').classList.remove('hidden');
}

// --- FLOATING CALCULATOR ---
window.toggleCalculator = function () {
    const calc = document.getElementById('floatingCalc');
    calc.classList.toggle('hidden');
    if (!calc.classList.contains('hidden')) {
        document.getElementById('calcDisplay').value = '';
    }
}

window.calcAppend = function (val) {
    const display = document.getElementById('calcDisplay');
    display.value += val;
}

// Redundant Calculator Logic Removed
// --- DEDICATED AGENT CONFIGURATION LOGIC ---
window.openAgentConfigModal = function () {
    openModal('agentConfigModal');
    renderAgentConfigList();
};

window.renameAgentDirect = function (oldName, newName) {
    if (!newName || newName === oldName) {
        renderAgentConfigList(); // Reset UI if no change
        return;
    }
    newName = newName.trim();

    const vars = db.getProductVars();
    if (!vars.agents) vars.agents = [];

    if (vars.agents.includes(newName)) {
        alert("Esiste già un agente con questo nome!");
        renderAgentConfigList();
        return;
    }

    const idx = vars.agents.indexOf(oldName);
    if (idx !== -1) {
        vars.agents[idx] = newName;
        db.updateVarList("agents", vars.agents);
    }

    if (vars.agentsMetadata && vars.agentsMetadata[oldName]) {
        if (!vars.agentsMetadata) vars.agentsMetadata = {};
        vars.agentsMetadata[newName] = vars.agentsMetadata[oldName];
        delete vars.agentsMetadata[oldName];
        db.updateVarList("agentsMetadata", vars.agentsMetadata);
    }

    if (typeof db.getAgentZones === "function" && typeof db.setAgentZones === "function") {
        const zones = db.getAgentZones(oldName);
        if (zones && zones.length > 0) {
            db.setAgentZones(newName, zones);
        }
    }

    setTimeout(renderAgentConfigList, 50);
};

window.renderAgentConfigList = function () {
    const listContainer = document.getElementById("agentConfigList");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    const vars = db.getProductVars();
    const agents = vars.agents || [];
    const meta = vars.agentsMetadata || {};

    const sortedAgents = [...agents].sort((a, b) => a.localeCompare(b));

    sortedAgents.forEach(agent => {
        const info = meta[agent] || { phone: "", email: "" };

        const row = document.createElement("div");
        row.style.cssText = "display: flex; gap: 10px; align-items: center; border-bottom: 1px solid #eee; padding: 8px 0;";

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "form-control";
        nameInput.style.cssText = "flex: 1; font-weight: bold; border:1px solid transparent; background:transparent;";
        nameInput.value = agent;
        nameInput.title = "Clicca per modificare";
        nameInput.onfocus = () => { nameInput.style.border = "1px solid #cbd5e1"; nameInput.style.background = "#fff"; };
        nameInput.onblur = () => { nameInput.style.border = "1px solid transparent"; nameInput.style.background = "transparent"; };
        nameInput.onchange = function () { renameAgentDirect(agent, this.value); };

        const phoneInput = document.createElement("input");
        phoneInput.type = "text";
        phoneInput.placeholder = "Tel";
        phoneInput.className = "form-control";
        phoneInput.style.width = "120px";
        phoneInput.value = info.phone || "";
        phoneInput.onchange = function () { updateAgentMeta(agent, "phone", this.value); };

        const emailInput = document.createElement("input");
        emailInput.type = "text";
        emailInput.placeholder = "Email";
        emailInput.className = "form-control";
        emailInput.style.flex = "1";
        emailInput.value = info.email || "";
        emailInput.onchange = function () { updateAgentMeta(agent, "email", this.value); };

        const delBtn = document.createElement("button");
        delBtn.className = "btn-icon delete";
        delBtn.innerHTML = "<i class=\"fa-solid fa-trash\"></i>";
        delBtn.onclick = function () { removeAgentDirect(agent); };

        row.appendChild(nameInput);
        row.appendChild(phoneInput);
        row.appendChild(emailInput);
        row.appendChild(delBtn);

        listContainer.appendChild(row);
    });
};
window.updateAgentMeta = function (agent, field, value) {
    const vars = db.getProductVars();
    if (!vars.agentsMetadata) vars.agentsMetadata = {};
    if (!vars.agentsMetadata[agent]) vars.agentsMetadata[agent] = {};

    vars.agentsMetadata[agent][field] = value.trim();

    db.updateVarList('agentsMetadata', vars.agentsMetadata);
};

window.addNewAgentDirect = function () {
    const name = document.getElementById('newAgentName').value.trim();
    const phone = document.getElementById('newAgentPhone').value.trim();
    const email = document.getElementById('newAgentEmail').value.trim();

    if (!name) return alert("Inserisci almeno il nome");

    const vars = db.getProductVars();
    if (!vars.agents) vars.agents = [];

    if (vars.agents.includes(name)) return alert("Agente già esistente");

    vars.agents.push(name);
    db.updateVarList('agents', vars.agents); // Save list

    // Save Meta
    if (phone || email) {
        if (!vars.agentsMetadata) vars.agentsMetadata = {};
        vars.agentsMetadata[name] = { phone, email };
        db.updateVarList('agentsMetadata', vars.agentsMetadata);
    }

    renderAgentConfigList();

    // Clear inputs
    document.getElementById('newAgentName').value = '';
    document.getElementById('newAgentPhone').value = '';
    document.getElementById('newAgentEmail').value = '';
};

window.removeAgentDirect = function (agent) {
    if (!confirm("Eliminare agente " + agent + "?")) return;

    const vars = db.getProductVars();
    vars.agents = vars.agents.filter(a => a !== agent);
    db.updateVarList('agents', vars.agents);

    renderAgentConfigList();
};

// Draggable Logic
document.addEventListener('DOMContentLoaded', () => {
    const calc = document.getElementById('floatingCalc');
    const header = document.getElementById('calcHeader');

    if (calc && header) {
        let isDragging = false;
        let offset = { x: 0, y: 0 };

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offset.x = e.clientX - calc.offsetLeft;
            offset.y = e.clientY - calc.offsetTop;
            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();

            // Remove transform centering once we start moving
            calc.style.transform = 'none';
            calc.style.margin = '0'; // clear potential margins

            calc.style.left = (e.clientX - offset.x) + 'px';
            calc.style.top = (e.clientY - offset.y) + 'px';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'move';
        });
    }
});

// --- NEW CLIENT LOGIC ---
// --- CITY AUTOCOMPLETE SETUP ---
setTimeout(() => {
    setupCityAutocomplete();
}, 100);

// Initial check
window.toggleClientType = function () {
    const type = document.querySelector('input[name="clientType"]:checked');
    if (!type) return; // Guard: no radio selected

    const lblName = document.getElementById('lblClientName');
    const lblVat = document.getElementById('lblClientVat');

    // FIX: Guard against null elements (modal may be closed/hidden)
    if (!lblName) return;

    if (type.value === 'company') {
        lblName.textContent = 'Ragione Sociale';
        // lblVat.textContent = 'P.IVA'; // Already static
        const nameInput = document.getElementById('newClientName');
        if (nameInput) nameInput.placeholder = 'Es. Rossi S.r.l.';
    } else {
        lblName.textContent = 'Cognome e Nome';
        // lblVat.textContent = 'Codice Fiscale'; // No longer needed, strict fields
        const nameInput = document.getElementById('newClientName');
        if (nameInput) nameInput.placeholder = 'Es. Mario Rossi';
    }
}

/**
 * Saves the client from the modal and sets it as the active customer for the current quote.
 */
window.saveAndPickClient = async function () {
    const form = document.getElementById('formClient');
    if (!form.reportValidity()) return;

    // Helper: Safely get value by ID
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };

    // Helper: Safely get checked state
    const getChecked = (id) => {
        const el = document.getElementById(id);
        return el ? el.checked : false;
    };

    const typeEl = document.querySelector('input[name="clientType"]:checked');
    const type = typeEl ? typeEl.value : 'company';

    const clientId = getVal('clientIdHidden') || undefined;
    const newIdCustomer = getVal('newClientIdCustomer');

    // Check if customer ID was manually changed to clear stale contact mappings
    let finalGiobbyContactId = getVal('newClientGiobbyContactId');
    if (clientId && window.db && window.db.getClients) {
        const existing = window.db.getClients().find(c => c.id.toString() === clientId.toString());
        if (existing) {
            const oldId = (existing.idCustomer || existing.giobbyCustomerId || '').trim();
            const newId = (newIdCustomer || '').trim();
            if (oldId && newId && oldId !== newId) {
                console.log(`⚠️ ID Cliente Giobby modificato da "${oldId}" to "${newId}". Resetting contact ID.`);
                finalGiobbyContactId = '';
            }
        }
    }

    // Construct Client Object
    const client = {
        id: clientId,
        type: type,
        name: getVal('newClientName'),
        surname: getVal('newClientSurname'), // FIX: Include surname field for Giobby compatibility
        vat: getVal('newClientVat'),
        fiscal_code: getVal('newClientFiscalCode'),
        sdi: getVal('newClientSdi').toUpperCase(),
        address: getVal('newClientAddress'),
        city: getVal('newClientCity'),
        zip: getVal('newClientZip'),
        state: getVal('newClientState'),
        country: getVal('newClientCountry'),
        addressProvince: getVal('newClientAddressProvince').toUpperCase(),

        siteAddress: getVal('newClientSiteAddress'),
        siteAddressProvince: getVal('newClientSiteAddressProvince').toUpperCase(),

        email: getVal('newClientEmail'),
        pec: getVal('newClientPec'),
        phone_office: getVal('newClientPhoneOffice'),
        phone_home: getVal('newClientPhoneHome'),
        mobile: getVal('newClientMobile'),
        fax: getVal('newClientFax'),
        // Backward compatibility for generic 'phone'
        phone: getVal('newClientMobile') || getVal('newClientPhoneOffice') || '',

        idCustomer: newIdCustomer, // Save manually entered ID
        giobbyCustomerId: newIdCustomer,
        giobbyContactId: finalGiobbyContactId,
        agentGiobbyId: getVal('newClientAgentGiobbyId'),

        contactPerson: getVal('newClientContact'),
        agent: getVal('newClientAgent'),

        language: getVal('newClientLang'),
        sector: getVal('newClientSector'),
        origin: getVal('newClientOrigin'),
        createdAt: new Date().toISOString(),
        printPrefs: {
            quote: {
                vat: getChecked('visQuoteVat'),
                sdi: getChecked('visQuoteSdi'),
                address: getChecked('visQuoteAddress'),
                site: getChecked('visQuoteSite'),
                contact: getChecked('visQuoteContact'),
                email: getChecked('visQuoteEmail'),
                phone: getChecked('visQuotePhone')
            },
            order: {
                vat: getChecked('visOrderVat'),
                sdi: getChecked('visOrderSdi'),
                address: getChecked('visOrderAddress'),
                site: getChecked('visOrderSite'),
                contact: getChecked('visOrderContact'),
                email: getChecked('visOrderEmail'),
                phone: getChecked('visOrderPhone')
            }
        }
    };

    try {
        const result = await db.saveClient(client);

        // Normalize result (can be ID string or full object depending on DB adapter)
        let savedClient = { ...client };
        if (result && typeof result === 'object') {
            savedClient = result;
        } else if (result && typeof result === 'string') {
            savedClient.id = result;
        }

        // Action: Set as current customer
        if (currentQuote) {
            // Use a copy to avoid linking to the registry reference
            currentQuote.customer = JSON.parse(JSON.stringify(savedClient));

            // Sync: Client -> Quote (Referente Cantiere & Referente Contatto)
            if (savedClient.contactPerson) currentQuote.siteContactName = savedClient.contactPerson;
            if (savedClient.origin) currentQuote.siteContactReference = savedClient.origin;

            // Optionally update current quote agent if not set? 
            // currentQuote.agent = savedClient.agent || currentQuote.agent;
        }

        // UI Updates
        try {
            renderEditorState();
        } catch (e) {
            console.warn("Error during renderEditorState() after client save:", e);
            // Non-blocking: rendering will happen when editor reopens
        }
        if (typeof window.renderGenericClientsTable === 'function') {
            window.renderGenericClientsTable();
        }
        closeModal('clientModal');

        // Reset Form
        form.reset();
        if (typeof toggleClientType === 'function') toggleClientType();


        // --- GIOBBY AUTO-SYNC --- (PAUSED BY USER REQUEST)
        /*
        if (window.syncSingleClientToGiobby) {
            // Check if Giobby is configured (avoid spinner if not needed)
            if (localStorage.getItem('giobbyConfig')) {
                try {
                    // Reuse global loader or simple overlay? 
                    // Using existing showLoadingSpinner if available
                    if (typeof showLoadingSpinner === 'function') showLoadingSpinner("Salvataggio locale OK. Sincronizzazione Giobby...");
 
                    const giobbyRes = await window.syncSingleClientToGiobby(savedClient);
 
                    if (typeof hideLoadingSpinner === 'function') hideLoadingSpinner();
 
                    if (giobbyRes && (giobbyRes.idCustomer || giobbyRes.idContact)) {
                        const targetId = giobbyRes.idCustomer || giobbyRes.idContact;
 
                        // Update Local Client with Giobby ID if missing
                        if (targetId && savedClient && (!savedClient.idCustomer || savedClient.idCustomer !== targetId)) {
                            savedClient.idCustomer = targetId;
                            try { await db.saveClient(savedClient); } catch (ex) { console.warn("Could not persist Giobby ID locally", ex); }
                        }
 
                        // const link = `https://app.giobby.com/company/Contact.xhtml?IDCUSTOMER=${targetId}`; 
 
                        // Simply notify success without asking to open link
                        alert(`Cliente salvato e sincronizzato su Giobby! (ID: ${targetId})`);
                    }
                } catch (errSync) {
                    if (typeof hideLoadingSpinner === 'function') hideLoadingSpinner();
                    console.error("Giobby Sync Failed", errSync);
                    alert("Cliente salvato in locale, ma Errore Sincronizzazione Giobby:\n" + errSync.message);
                }
            }
        }
        */


    } catch (e) {
        console.error("Error in saveAndPickClient:", e);
        alert("Errore salvataggio cliente: " + e.message);
    }
}

// --- GIOBBY MANUAL SYNC & FEEDBACK ---

/**
 * Show a small toast notification for Giobby sync status.
 */
window.showGiobbySyncToast = function (message, type = 'info') {
    const colors = { info: '#3b82f6', success: '#10b981', error: '#ef4444', warn: '#f59e0b' };
    const icons = { info: '⟳', success: '✅', error: '❌', warn: '⚠️' };
    let toast = document.getElementById('giobbySyncToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'giobbySyncToast';
        toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:10px 18px;border-radius:10px;color:#fff;font-size:0.9rem;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:opacity 0.4s;pointer-events:none;';
        document.body.appendChild(toast);
    }
    toast.style.background = colors[type] || colors.info;
    toast.style.opacity = '1';
    toast.textContent = (icons[type] || '') + ' Giobby: ' + message;
    clearTimeout(toast._hideTimer);
    if (type !== 'info') {
        toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 4000);
    }
};

/**
 * Manually trigger Giobby sync for a client from the clients table.
 * @param {string} clientId - Local client ID
 * @param {HTMLElement} btn - The button element (for visual feedback)
 */
window.manualSyncClientToGiobby = async function (clientId, btn) {
    const client = (db.getClients() || []).find(c => String(c.id) === String(clientId));
    if (!client) return alert('Cliente non trovato.');

    // Visual feedback on button
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; }

    window.showGiobbySyncToast(`Sincronizzazione "${client.name}" in corso...`, 'info');

    try {
        // Get agent info from client or from quote history
        const agentName = client.agent || '';
        const vars = window.db ? window.db.getProductVars() : {};
        const meta = vars.agentsMetadata || {};
        const agentKey = Object.keys(meta).find(k =>
            k === agentName || k.trim().toLowerCase() === agentName.trim().toLowerCase()
        );
        const agentMeta = agentKey ? meta[agentKey] : null;
        const agentGiobbyId = agentMeta ? (agentMeta.giobbyAgentId || '') : '';

        await window.syncClientToGiobbyOnSave(client, agentName, agentGiobbyId);

        // Check result (reload from DB)
        const updated = (db.getClients() || []).find(c => String(c.id) === String(clientId));
        const ok = updated && updated.giobbyContactId && String(updated.giobbyContactId).length > 20;

        window.showGiobbySyncToast(
            ok ? `"${client.name}" sincronizzato (ID: ${updated.idCustomer || '?'})` : `"${client.name}": sync in background, ricarica la lista tra poco`,
            ok ? 'success' : 'warn'
        );

        if (btn) { btn.innerHTML = ok ? '<i class="fa-solid fa-cloud-arrow-up"></i><span style="position:absolute;bottom:2px;right:1px;font-size:6px;font-weight:700;color:#fff;background:#10b981;border-radius:2px;padding:0px 2px;line-height:1.5;pointer-events:none;">G</span>' : origHtml; btn.style.color = ok ? '#10b981' : '#f97316'; btn.disabled = false; }

        // Refresh table to update badge
        setTimeout(() => renderGenericClientsTable(), 500);

    } catch (e) {
        window.showGiobbySyncToast('Errore sync: ' + e.message, 'error');
        if (btn) { btn.innerHTML = origHtml; btn.disabled = false; }
    }
};



function initDragAndDrop() {
    const draggables = document.querySelectorAll('.draggable-section');
    draggables.forEach(elem => {
        // Clean up old listeners to prevent duplicates
        elem.removeEventListener('dragstart', handleDragStart);
        elem.removeEventListener('dragenter', handleDragEnter);
        elem.removeEventListener('dragover', handleDragOver);
        elem.removeEventListener('dragleave', handleDragLeave);
        elem.removeEventListener('drop', handleDrop);
        elem.removeEventListener('dragend', handleDragEnd);

        // Attach listeners
        elem.addEventListener('dragstart', handleDragStart);
        elem.addEventListener('dragenter', handleDragEnter);
        elem.addEventListener('dragover', handleDragOver);
        elem.addEventListener('dragleave', handleDragLeave);
        elem.addEventListener('drop', handleDrop);
        elem.addEventListener('dragend', handleDragEnd);

        // Default: Disabled
        elem.setAttribute('draggable', 'false');
    });
}

window.isLayoutEditing = false;
window.toggleLayoutEditMode = function () {
    window.isLayoutEditing = !window.isLayoutEditing;
    const draggables = document.querySelectorAll('.draggable-section, .header-item');
    draggables.forEach(elem => {
        elem.setAttribute('draggable', window.isLayoutEditing ? 'true' : 'false');
    });

    const btn = document.getElementById('btnLayoutEdit');
    if (btn) {
        if (window.isLayoutEditing) {
            btn.classList.add('active'); // Ensure you have active styles or inline logic
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Fine Modifica Layout';
            document.body.classList.add('layout-editing-active');

            // Visual feedback
            alert("Modalità Layout Attiva: Ora puoi trascinare le sezioni per riordinarle.");
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right"></i> Modifica Layout';
            document.body.classList.remove('layout-editing-active');
        }
    }
};

let dragSrcEl = null;

function handleDragStart(e) {
    this.style.opacity = '0.4';
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    if (e.preventDefault) {
        e.preventDefault();
    }

    if (dragSrcEl !== this) {
        const bounding = this.getBoundingClientRect();
        const offset = bounding.y + (bounding.height / 2);

        // Determine drop position relative to center of element
        if (e.clientY - offset > 0) {
            this.parentNode.insertBefore(dragSrcEl, this.nextSibling);
        } else {
            this.parentNode.insertBefore(dragSrcEl, this);
        }
    }
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    this.classList.remove('dragging');
    document.querySelectorAll('.draggable-section').forEach(function (item) {
        item.classList.remove('drag-over');
    });
}

// Initialize Drag & Drop with a slight delay to ensure DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initDragAndDrop, 1500);
});

window.reinitDragDrop = initDragAndDrop;

// --- DASHBOARD WIDGET INTEGRATION ---
// Helper to update the new Health Widget
window.updateDashWidgets = function () {
    const container = document.getElementById('dashboardHealthWidget');
    if (!container) return;

    // Calculate Global Stats for Widget
    const quotes = db.getAllQuotes();
    const openQuotes = quotes.filter(q => ['Aperto', 'In Attesa'].includes(q.status));

    // 1. Avg Cycle (from predictive state or calc)
    const avgCycle = window.predictiveState ? window.predictiveState.avgCycleDays : 30;

    // 2. Global Conversion Probability (Simple)
    // In a real app, this would be per-quote. Here we show global health.
    // Or we show the health of the "Oldest Open Quote"? 
    // Let's show "Global Pipeline Health":
    // Probability = Conversion Rate * (1 - (AvgAge / AvgCycle)) ??
    // Let's stick to the User Request Concept: An example widget.
    // We will calculate stats for the "Most Recent Open Quote" or Average.
    // Let's do Average Health of Open Quotes.

    // Simplification: Display Health of the ENTIRE Pipeline
    // Probability = Aggregate Conversion Rate
    const won = quotes.filter(q => ['Ordine Confermato', 'Chiuso'].includes(q.status)).length;
    const total = quotes.length;
    let prob = total > 0 ? (won / total) * 100 : 0;

    // Adjust prob based on age? No, keep it simple for the demo.

    // Days Open: Avg age of open quotes
    let totalAge = 0;
    openQuotes.forEach(q => {
        const d = new Date(q.date || q.createdAt);
        const age = Math.ceil((new Date() - d) / (1000 * 60 * 60 * 24));
        totalAge += age;
    });
    const avgOpenDays = openQuotes.length > 0 ? Math.round(totalAge / openQuotes.length) : 0;

    renderQuoteHealthWidget(container, {
        probability: Math.round(prob),
        daysOpen: avgOpenDays,
        avgCycle: avgCycle,
        mode: 'dashboard'
    });
};

// Hook into app initialization and updates
// We monkey-patch renderQuotesTable to trigger widget update
if (typeof window.renderQuotesTable === 'function') {
    const originalRenderQuotesTable = window.renderQuotesTable;
    window.renderQuotesTable = function () {
        originalRenderQuotesTable();
        window.updateDashWidgets();
    };
} else {
    // If not found (e.g. race condition), try to hook later or just run it
    console.warn("renderQuotesTable not found for hooking. Widget may not update automatically.");
    // Retry hook after 1s
    setTimeout(() => {
        if (typeof window.renderQuotesTable === 'function') {
            const original = window.renderQuotesTable;
            window.renderQuotesTable = function () {
                original();
                window.updateDashWidgets();
            };
            window.updateDashWidgets();
        }
    }, 1000);
}

// Hook Editor Widget
if (typeof window.renderEditorState === 'function') {
    const originalRenderEditorState = window.renderEditorState;
    window.renderEditorState = function () {
        originalRenderEditorState();
        if (typeof window.updateEditorHealthWidget === 'function' && currentQuote) {
            window.updateEditorHealthWidget(currentQuote);
        }
        // Update label for Memo/Appunti Interni
        if (typeof window.updateEditorStatusUI === 'function') {
            window.updateEditorStatusUI();
        }
    };
} else {
    // Retry hook
    setTimeout(() => {
        if (typeof window.renderEditorState === 'function') {
            const original = window.renderEditorState;
            window.renderEditorState = function () {
                original();
                if (window.updateEditorHealthWidget) window.updateEditorHealthWidget(currentQuote);
                // Update label for Memo/Appunti Interni
                if (window.updateEditorStatusUI) window.updateEditorStatusUI();
            };
        }
    }, 1000);
}


// --- NOTIFICATION SYSTEM (High Priority) ---
// Configuration
const NOTIFICATION_CONFIG = {
    SCORE_THRESHOLD: 85,
    WEBHOOK_URL: 'https://hooks.slack.com/services/PLACEHOLDER/YOUR/WEBHOOK' // Replace with real URL
};

window.sendWebhookNotification = async function (quote, score) {

    // Simulate API Call
    const payload = {
        text: ` *ALTA PROBABILITÃ€ DI CHIUSURA*\nIl preventivo #${quote.id} per *${quote.customer ? quote.customer.name : 'Unknown'}* ha uno score AI del ${score}%.\nValore: €${formatCurrency(quote.items.reduce((s, i) => s + (i.total || 0), 0))}`
    };

    try {
        // Uncomment to actually send if URL is valid
        // await fetch(NOTIFICATION_CONFIG.WEBHOOK_URL, {
        //     method: 'POST',
        //     body: JSON.stringify(payload),
        //     headers: { 'Content-Type': 'application/json' }
        // });

        // Show Browser Notification (Toast)
        // Simple Alert for demo
        const note = document.createElement('div');
        note.style.cssText = 'position:fixed; top:20px; right:20px; background:#22c55e; color:white; padding:15px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.2); z-index:9999; animation: slideIn 0.5s ease-out;';
        note.innerHTML = `<strong> Alta Probabilità!</strong><br>Preventivo #${quote.id}: Score ${score}%`;
        document.body.appendChild(note);
        setTimeout(() => note.remove(), 5000);

    } catch (e) {
        console.error("Webhook Error:", e);
    }
};

window.checkForHighPriorityQuotes = async function () {
    if (typeof window.calculateQuoteScore !== 'function') return;

    const quotes = db.getAllQuotes();
    const openQuotes = quotes.filter(q => ['Aperto', 'Inviato', 'In Attesa'].includes(q.status));

    let updatesMade = false;

    for (const q of openQuotes) {
        // Skip if already notified
        if (q.highPriorityNotified) continue;

        const stats = window.calculateQuoteScore(q);
        if (stats.score >= NOTIFICATION_CONFIG.SCORE_THRESHOLD) {
            // Trigger Notification
            await window.sendWebhookNotification(q, stats.score);

            // Mark as notified to prevent spam
            q.highPriorityNotified = true;
            await db.saveQuote(q); // Save flag
            updatesMade = true;
        }
    }

    // If we saved, table might re-render, creating a loop?
    // db.saveQuote calls renderQuotesTable.
    // So we must be careful. 
    // If updatesMade is TRUE, we just triggered a save -> render -> check loop.
    // BUT only if `q.highPriorityNotified` wasn't true before.
    // Since we set it to true, next check will skip it. Loop terminates.
};

// (Monkey patch removed - logic integrated into main function)

// --- ADVANCED SEEDING (Request v2) ---
window.runAdvancedSeed = async function (n = 100) {
    if (!confirm(`Generare ${n} preventivi di test realistici (Ultimi 6 mesi)?\nATTENZIONE: I dati generati si sommeranno a quelli esistenti.`)) return;

    const agents = Array.from({ length: 10 }, (_, i) => `User_${i + 1}`);
    const statuses = ["Bozza", "Aperto", "Ordine Confermato", "Perso"];
    const weights = [0.1, 0.4, 0.3, 0.2]; // Weights: 10, 40, 30, 20

    const getRandomStatus = () => {
        const rand = Math.random();
        let sum = 0;
        for (let i = 0; i < weights.length; i++) {
            sum += weights[i];
            if (rand < sum) return statuses[i];
        }
        return statuses[statuses.length - 1]; // Fallback
    };

    const now = new Date();
    const start_date = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000));

    let count = 0;

    for (let i = 0; i < n; i++) {
        // Random Date between start and now
        const offset = Math.floor(Math.random() * 180);
        const created_at = new Date(start_date.getTime() + (offset * 24 * 60 * 60 * 1000));

        const status = getRandomStatus();
        let accepted_at = null;

        if (status === "Ordine Confermato") {
            // cycle 2-25 days
            const cycle = Math.floor(Math.random() * 23) + 2; // 2+0..23 = 2..25
            accepted_at = new Date(created_at.getTime() + (cycle * 24 * 60 * 60 * 1000));
            if (accepted_at > now) accepted_at = now;
        }

        const total = Math.round((Math.random() * 14500) + 500); // 500-15000

        const q = {
            id: 'MOCK-' + Math.floor(Math.random() * 1000000),
            createdAt: created_at.toISOString(),
            date: created_at.toISOString().split('T')[0],
            status: status,
            agent: agents[Math.floor(Math.random() * agents.length)],
            customer: {
                name: `Cliente ${Math.floor(Math.random() * 50) + 1}`,
                address: 'Via Test, 100'
            },
            items: [{
                description: 'Fornitura Parquet Test',
                quantity: 1,
                unitPrice: total,
                total: total,
                uom: 'mq'
            }],
            notes: 'Generato automaticamente dallo script Python->JS',
            acceptedAt: accepted_at ? accepted_at.toISOString() : null
        };

        await db.saveQuote(q);
        count++;
    }

    alert(`✅ Generati ${count} preventivi di test realistici!`);
    window.location.reload();
};

// --- TOOLTIP LOGIC START ---
let tooltipTimer = null;

window.showTooltip = function (e, content) {
    if (!content) return;

    if (tooltipTimer) clearTimeout(tooltipTimer);

    let tooltip = document.getElementById('tooltip');
    if (!tooltip) {
        // Fallback if not in HTML
        tooltip = document.createElement('div');
        tooltip.id = 'tooltip';
        document.body.appendChild(tooltip);
    }

    // Ensure listeners are attached (idempotent check via custom property)
    if (!tooltip.hasAttribute('data-listeners-attached')) {
        tooltip.addEventListener('mouseenter', () => {
            if (tooltipTimer) clearTimeout(tooltipTimer);
        });
        tooltip.addEventListener('mouseleave', () => {
            window.hideTooltip();
        });
        tooltip.setAttribute('data-listeners-attached', 'true');
    }

    tooltip.innerHTML = content;
    tooltip.style.display = 'block';

    // Position
    const offset = 15;
    let left = e.pageX + offset;
    let top = e.pageY + offset;

    // Boundary check
    if (left + 250 > window.innerWidth) {
        left = Math.max(0, e.pageX - 260);
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
};

window.moveTooltip = function (e) {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        const offset = 15;
        let left = e.pageX + offset;
        let top = e.pageY + offset;
        if (left + 250 > window.innerWidth) left = Math.max(0, e.pageX - 260);
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }
};

window.hideTooltip = function () {
    // Delay hide to allow moving into tooltip
    tooltipTimer = setTimeout(() => {
        const tooltip = document.getElementById('tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }, 300);
};

window.openProductFromEditor = function (code) {
    if (!code) return;
    const products = db.getProducts() || [];
    const p = products.find(x => x.code === code);
    if (p) {
        if (typeof openProductModal === 'function') {
            openProductModal(p.id);
        } else {
            console.error("openProductModal function not found.");
            alert("Errore: impossibile aprire la scheda prodotto.");
        }
    } else {
        console.warn("Prodotto non trovato nel DB:", code);
        // Optional: alert("Prodotto non trovato nel database.");
    }
};

// DEPRECATED: Old renderRemindersWidget removed. Using the new definition below (around line 8100)

window.completeReminder = async function (id, type) {
    const q = db.getQuote(id);
    if (!q) return;

    if (type === 'deadline') {
        if (confirm("Segnare la consegna come completata?")) {
            q.deliveryCompleted = true;
            await db.saveQuote(q);
            renderRemindersWidget(); // Refresh UI
        }
    } else if (type === 'note' || type === 'callback') {
        if (confirm("Rimuovere il promemoria? (Cancella le note interne)")) {
            q.internalNotes = ""; // Clear note to remove from list
            await db.saveQuote(q);
            renderRemindersWidget(); // Refresh UI
        }
    }
};

window.importFromGiobby = async function () {
    let token = document.getElementById('giobbyToken').value.trim();
    // Remove "Bearer" if user pasted it
    if (token.toLowerCase().startsWith('bearer ')) {
        token = token.slice(7);
    }
    // Remove ALL spaces/newlines (common copy-paste error)
    token = token.replace(/\s/g, '');

    const status = document.getElementById('giobbyStatus').value;
    const limit = document.getElementById('giobbyLimit').value || 20;
    const msgEl = document.getElementById('giobbyStatusMsg');
    // Get Base URL from input or default
    let baseUrl = document.getElementById('giobbyEndpoint').value.trim();
    if (!baseUrl) baseUrl = "https://api.giobby.com/vendite/offerte";

    if (!token) {
        alert("Inserisci il Token API di Giobby.");
        return;
    }

    msgEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connessione a Giobby...';
    msgEl.style.color = 'var(--text-muted)';

    try {
        // Prepare Headers
        const headers = {
            "Authorization": "Bearer " + token,
            "Accept": "application/json",
            "X-Giobby-Realm": "api-server"
        };

        // Construct URL (Proxy workaround might be needed if direct call fails)
        // Endpoint: /vendite/offerte
        let url = `${baseUrl}?limite=${limit}`;

        // PROXY BYPASS
        if (document.getElementById('giobbyProxy') && document.getElementById('giobbyProxy').checked) {
            url = 'https://corsproxy.io/?' + encodeURIComponent(url);
        }

        if (status) {
            // Mapping Giobby statuses...
        }

        // FETCH
        const response = await fetch(url, { method: 'GET', headers: headers });

        if (!response.ok) {
            const errText = await response.text();
            console.error("API Error Details:", errText);
            throw new Error(`Status ${response.status}: ${errText.substring(0, 100)}`); // Show first 100 chars of error
        }

        const data = await response.json();
        // Assume data is array or { preventivi: [...] }
        const quotesList = Array.isArray(data) ? data : (data.preventivi || []);

        msgEl.textContent = `Scaricati ${quotesList.length} preventivi. Elaborazione...`;

        let importedCount = 0;

        for (const remote of quotesList) {
            // MAP to Local Quote
            // Need to inspect remote structure. For now, best effort mapping.
            // Expected fields based on typical Giobby: 
            // numero, data, cliente (nome), totale, righe...

            const newQuote = {
                id: null, // New ID
                date: remote.data ? new Date(remote.data).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                status: 'Aperto', // Default to Open unless logic says otherwise
                customer: {
                    name: remote.clienteNome || 'Cliente Giobby',
                    vat: remote.clientePIVA || '',
                    address: remote.clienteIndirizzo || '',
                    type: 'company'
                },
                items: [],
                total: remote.totaleImponibile || 0,
                vatRate: 0.22, // Default
                grandTotal: remote.totaleDocumento || 0,
                notes: `Importato da Giobby (Rif: ${remote.numero})`
            };

            // Map Items if available
            if (remote.righe && Array.isArray(remote.righe)) {
                newQuote.items = remote.righe.map(r => ({
                    code: r.codice || '',
                    description: r.descrizione || '',
                    quantity: r.qta || 1,
                    unitPrice: r.prezzo || 0,
                    total: (r.qta || 1) * (r.prezzo || 0),
                    var1: '', var2: '', var3: ''
                }));
            } else {
                // Fallback item
                newQuote.items.push({
                    description: 'Totale Preventivo Importato',
                    quantity: 1,
                    unitPrice: newQuote.total,
                    total: newQuote.total
                });
            }
            // Save Client to Registry ensuring synchronization
            try {
                // Map Giobby fields to Genesy fields (Best Effort)
                // Note: Giobby 'List' response might be lean. If fields are missing they will be empty.
                newQuote.customer.city = remote.clienteCitta || remote.city || '';
                newQuote.customer.zip = remote.clienteCap || remote.zip || '';
                newQuote.customer.province = remote.clienteProvincia || remote.province || '';
                newQuote.customer.addressProvince = remote.clienteProvincia || remote.province || '';
                newQuote.customer.state = ''; // Not standard in list
                newQuote.customer.country = remote.clienteNazione || 'Italia';

                // Map Contact Info
                newQuote.customer.email = remote.clienteEmail || '';
                newQuote.customer.pec = remote.clientePec || '';
                newQuote.customer.phone_office = remote.clienteTelefono || '';
                newQuote.customer.mobile = remote.clienteCellulare || remote.mobile || '';
                newQuote.customer.fax = remote.clienteFax || '';

                // Map Fiscal
                newQuote.customer.vat = remote.clientePIVA || '';
                newQuote.customer.fiscal_code = remote.clienteCodiceFiscale || remote.fiscalCode || '';

                if (newQuote.customer.name) {
                    await db.saveClient(newQuote.customer);
                }
            } catch (errC) {
                console.warn("Could not save client during import:", errC);
            }

            // Save
            await db.saveQuote(newQuote);
            importedCount++;
        }

        msgEl.style.color = 'green';
        msgEl.innerHTML = `<i class="fa-solid fa-check"></i> Importati ${importedCount} preventivi con successo!`;

        // Refresh Table
        renderQuotesTable();

    } catch (e) {
        console.error("Giobby Import Error:", e);
        msgEl.style.color = 'red';
        if (e.message.includes('CORS') || e.message.includes('Failed to fetch')) {
            msgEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Errore CORS. Installa un plugin 'CORS Unblock' o usa un proxy.`;
        } else {
            msgEl.textContent = "Errore: " + e.message;
        }
    }
};

// --- REMINDERS & NOTIFICATIONS ---

// Global Filter State for Admin
window.adminReminderFilter = 'all';

window.renderRemindersWidget = function () {
    const listEl = document.getElementById('reminderList');
    const badgeEl = document.getElementById('countReminders');
    // Helper to find the widget header container to inject controls
    const widgetHeader = listEl ? listEl.parentElement.querySelector('div') : null; // The header div above list

    if (!listEl) return;

    // --- ADMIN FILTER UI INJECTION ---
    if (db.isAdmin) {
        // Check if filter exists, if not create it
        let filterSel = document.getElementById('adminReminderFilterSel');
        if (!filterSel && widgetHeader) {
            // Create container for controls if needed, or append to existing
            // The header has flex behavior: <h3>, <div>(badge, icons)</div>
            // We want to insert the Select in the middle or right.

            const controlsDiv = widgetHeader.lastElementChild; // The div with badge and icon

            filterSel = document.createElement('select');
            filterSel.id = 'adminReminderFilterSel';
            filterSel.className = 'filter-select';
            filterSel.style.fontSize = '0.75rem';
            filterSel.style.padding = '2px 4px';
            filterSel.style.marginRight = '8px';
            filterSel.style.maxWidth = '120px';

            // Populate
            const agents = db.getAgents();
            let opts = `<option value="all">Tutti</option>`;
            agents.forEach(a => opts += `<option value="${a}">${a}</option>`);
            filterSel.innerHTML = opts;

            filterSel.value = window.adminReminderFilter;

            filterSel.onchange = function () {
                window.adminReminderFilter = this.value;
                renderRemindersWidget(); // Re-render
            };

            // Insert before the badge/refresh icon container items
            controlsDiv.insertBefore(filterSel, controlsDiv.firstChild);
        } else if (filterSel) {
            // Refresh options just in case
            const agents = db.getAgents();
            // Preserve value
            const curr = window.adminReminderFilter;
            let opts = `<option value="all">Tutti</option>`;
            agents.forEach(a => opts += `<option value="${a}" ${a === curr ? 'selected' : ''}>${a}</option>`);
            // Only update if innerHTML changed to avoid flicker? simple string compare
            if (filterSel.innerHTML !== opts) filterSel.innerHTML = opts;
            filterSel.value = curr;
        }
    }
    // ---------------------------------

    const now = new Date();
    const allQuotes = db.getAllQuotes();

    const reminders = allQuotes.filter(q => {
        if (q.status === 'Perso' || q.status === 'Deleted' || q.status === 'Cestinato') return false;

        // ADMIN FILTER
        if (db.isAdmin && window.adminReminderFilter !== 'all') {
            if (q.agent !== window.adminReminderFilter) return false;
        }
        // NON-ADMIN: Filter by own agent (Future proofing/Safety)
        if (!db.isAdmin && db.role === 'agent') {
            // Logic to filter by current user's agent name if mapped? 
            // Currently app allows seeing all. Keeping inconsistent with Admin Filter would be weird.
            // For now, respect current behavior (show all) OR enforce 'My Quotes' if user mapping exists.
            // Let's stick to "Admin sees what they want", Agent sees what logic dictated before (likely all for collaboration).
        }

        // Show if has active delivery deadline
        if (q.deliveryDate && !q.deliveryCompleted) return true;

        // Show if has internal notes
        if (q.internalNotes && q.internalNotes.trim().length > 0) return true;

        return false;
    });

    reminders.sort((a, b) => {
        // Prioritize Deadlines over Notes? No, user wants urgency.
        // Use a far future date for items without any date so they go to bottom
        const dateA = a.deliveryDate ? new Date(a.deliveryDate) : (a.date ? new Date(a.date) : new Date(8640000000000000));
        const dateB = b.deliveryDate ? new Date(b.deliveryDate) : (b.date ? new Date(b.date) : new Date(8640000000000000));
        return dateA - dateB;
    });

    if (badgeEl) badgeEl.textContent = reminders.length;

    listEl.innerHTML = '';

    if (reminders.length === 0) {
        listEl.innerHTML = '<div class="text-muted text-center" style="padding: 20px;">Nessun promemoria o appunto.</div>';
        return;
    }

    reminders.forEach(q => {
        // Types
        const isDeadline = q.deliveryDate && !q.deliveryCompleted;
        const hasNote = q.internalNotes && q.internalNotes.trim().length > 0;

        const clientName = q.customer ? q.customer.name : 'Cliente Sconosciuto';
        let mainContent = '';
        let statusColor = '#e2e8f0';
        let icon = 'fa-note-sticky';

        if (isDeadline) {
            const deadline = new Date(q.deliveryDate);
            const diffTime = deadline - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const formattedDate = formatDate(q.deliveryDate);

            if (diffDays < 15) {
                statusColor = '#ef4444'; // Red
                icon = 'fa-exclamation-circle';
            } else if (diffDays < 30) {
                statusColor = '#f59e0b'; // Yellow
                icon = 'fa-clock';
            } else {
                statusColor = '#10b981'; // Green
                icon = 'fa-check-circle';
            }

            mainContent = `
                <div style="font-size: 0.8rem; color: #666; margin-bottom: 2px;">
                    <i class="fa-solid ${icon}" style="color: ${statusColor}; margin-right: 4px;"></i> 
                    Scadenza: <strong>${formattedDate}</strong> (${diffDays} gg)
                </div>
            `;
        } else {
            // Just a note
            statusColor = '#f59e0b'; // Amber
            const date = formatDate(q.date || q.createdAt);
            mainContent = `<div style="font-size: 0.75rem; color: #94a3b8;"><i class="fa-regular fa-clock"></i> ${date}</div>`;
        }

        // Compact Layout Logic
        const diffDaysText = isDeadline ? `(${Math.ceil((new Date(q.deliveryDate) - now) / (1000 * 60 * 60 * 24))} gg)` : '';

        // Universal Completion Button Logic
        let actionType = 'callback';
        let actionTitle = 'Segna come gestito';

        if (isDeadline) {
            actionType = 'deadline';
            actionTitle = 'Segna consegna completata';
        } else if (hasNote) {
            actionType = 'note';
            actionTitle = 'Rimuovi nota';
        }

        const completeBtn = `<button class="btn-icon-small" onclick="event.stopPropagation(); window.completeReminder('${q.id}', '${actionType}')" title="${actionTitle}" style="font-size: 0.8rem; padding: 2px 4px; border:1px solid #cbd5e1; background:white; color:#64748b; margin-right:4px;"><i class="fa-solid fa-check"></i></button>`;

        // Compact Layout Logic
        const html = `
            <div style="background: #fff; border-left: 3px solid ${statusColor}; padding: 6px 8px; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 4px; display: flex; flex-direction: column; gap: 2px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1; min-width: 0; padding-right: 5px;">
                        <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                            <span style="font-weight: 700; font-size: 0.9rem; color:#1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${clientName}</span>
                            ${isDeadline ?
                `<span style="font-size: 0.75rem; color: ${statusColor}; font-weight: 600; white-space: nowrap;">
                                    <i class="fa-solid ${icon}"></i> ${formatDate(q.deliveryDate)} ${diffDaysText}
                                </span>`
                :
                `<span style="font-size: 0.75rem; color: #94a3b8;">${formatDate(q.date)}</span>`
            }
                        </div>
                    </div>
                    <div style="display: flex; gap: 4px; flex-shrink: 0;">
                        ${completeBtn}
                        <button class="btn-icon-small" onclick="event.stopPropagation(); openEditor('${q.id}')" title="Apri" style="font-size: 0.8rem; padding: 2px 4px;"><i class="fa-solid fa-arrow-right"></i></button>
                    </div>
                </div>
                ${hasNote ? `
                <div style="font-size: 0.8rem; color: #475569; background: #f1f5f9; padding: 3px 6px; border-radius: 3px; line-height: 1.3;">
                    <i class="fa-regular fa-comment-dots" style="color:#cbd5e1; margin-right:4px;"></i>${q.internalNotes}
                </div>` : ''}
            </div>
        `;
        listEl.innerHTML += html;
    });

    // Notify logic removed
}

window.markDeliveryComplete = async function (id) {
    if (!confirm("Confermi che la consegna è stata completata?")) return;
    const q = db.getQuote(id);
    if (q) {
        q.deliveryCompleted = true;
        await db.saveQuote(q); // Save to DB
        renderRemindersWidget(); // Refresh UI
    }
}

// function checkNotificationsPermission removed

// function checkAndNotifyDeadlines removed

// function checkStartupReminders removed

// --- AUTO-SAVE EXTRA ITEMS LOGIC ---

/**
 * Updates the #allProductsList datalist with both Products and Additional/Extra Works.
 * This ensures the autocomplete works for both standard products and custom extra items.
 */
window.updateProductDatalist = function () {
    const dataList = document.getElementById('allProductsList');
    if (!dataList) return;

    dataList.innerHTML = ''; // Clear

    // 1. Standard Products
    const products = db.getProducts() || [];
    products.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.description;
        dataList.appendChild(opt);
    });

    // 2. Additional / Extra Works
    const extraWorks = db.getAdditionalWorks() || [];
    extraWorks.forEach(w => {
        // Prevent duplicates if description matches a product
        if (!products.some(p => p.description === w.description)) {
            const opt = document.createElement('option');
            opt.value = w.description;
            opt.label = "Extra";
            dataList.appendChild(opt);
        }
    });
};

/**
 * Auto-harvests new items from the current quote and saves them to the "Additional Works" list.
 * Only saves items that are NOT standard products and NOT already in the list.
 */
window.autoHarvestExtraItems = async function (quote) {
    if (!quote || !quote.items) return;

    const products = db.getProducts() || [];
    const existingExtras = db.getAdditionalWorks() || [];
    let addedCount = 0;

    for (const item of quote.items) {
        if (!item.description || !item.description.trim()) continue;
        const desc = item.description.trim();

        // 1. Check if it's a Standard Product (by Code or Exact Description)
        const isProduct = products.some(p => p.code === item.code || p.description === desc);
        if (isProduct) continue;

        // 2. Check if it's already in Extras
        const isKnownExtra = existingExtras.some(e => e.description === desc);
        if (isKnownExtra) continue;

        // 3. New Candidate Found! Save it.
        const newWork = {
            description: desc,
            uom: item.uom || '-',
            price: item.unitPrice || 0
        };

        // Persist
        await db.saveAdditionalWork(newWork);
        existingExtras.push(newWork); // Add to local list immediately
        addedCount++;
    }

    if (addedCount > 0) {
        updateProductDatalist();
    }
};

// --- GIOBBY INTEGRATION ---

// --- GIOBBY INTEGRATION (Full Auth) ---

// Helper: Decode JWT to get Payload
function parseJwt(token) {
    try {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) { return null; }
}

window.loginToGiobby = async function () {
    const user = document.getElementById('giobbyUsername').value.trim();
    const pass = document.getElementById('giobbyPassword').value.trim();
    const cid = document.getElementById('giobbyTenantId').value.trim();
    const instanceId = document.getElementById('giobbyInstanceId') ? document.getElementById('giobbyInstanceId').value.trim() : '';
    const clientId = document.getElementById('giobbyClientId').value.trim();
    const clientSecret = document.getElementById('giobbyClientSecret') ? document.getElementById('giobbyClientSecret').value.trim() : '';
    const useProxy = document.getElementById('giobbyUseProxy').checked;
    const isQA = document.getElementById('giobbyQA').checked;

    if (!clientId || (!clientSecret && (!user || !pass || !cid))) {
        alert("Inserisci Client ID e (Secret oppure User/Pass/CID).");
        return;
    }

    const statusEl = document.getElementById('giobbyStatus');
    statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connessione in corso...';
    statusEl.style.color = 'orange';

    // 1. GET TOKEN (Password Grant)
    // Auth URL depends on environment
    // Prod: https://auth.giobby.com/auth/realms/api-server/protocol/openid-connect/token
    // QA: https://authqa.giobby.com/auth/realms/api-server/protocol/openid-connect/token
    let baseUrlAuth = isQA ? "https://authqa.giobby.com" : "https://auth.giobby.com";
    let tokenUrl = baseUrlAuth + "/auth/realms/api-server/protocol/openid-connect/token";

    if (useProxy) {
        tokenUrl = "https://corsproxy.io/?" + encodeURIComponent(tokenUrl);
    }

    const bodyParams = new URLSearchParams();
    if (clientSecret) {
        bodyParams.append('grant_type', 'client_credentials');
        bodyParams.append('client_id', clientId);
        bodyParams.append('client_secret', clientSecret);
        // Note: CID is NOT sent in token request for Client Credentials, but used for fallback discovery
    } else {
        bodyParams.append('grant_type', 'password');
        bodyParams.append('client_id', clientId);
        bodyParams.append('username', user);
        bodyParams.append('password', pass);
        bodyParams.append('cid', cid);
    }

    try {
        const tokenRes = await fetch(tokenUrl, {
            method: 'POST',
            body: bodyParams
        });

        if (!tokenRes.ok) {
            let errorMsg = tokenRes.statusText;
            try {
                const errJson = await tokenRes.json();
                if (errJson.error_description) errorMsg += " - " + errJson.error_description;
                else if (errJson.error) {
                    const eDetail = (typeof errJson.error === 'object') ? JSON.stringify(errJson.error) : errJson.error;
                    errorMsg += " - " + eDetail;
                }
            } catch (e) {
                // Fallback for HTML/Text errors (502 Bad Gateway)
                try {
                    const txt = await tokenRes.text();
                    if (txt) errorMsg += " - " + txt.substring(0, 100);
                } catch (ex) { }
            }
            throw new Error("Login fallito (Token): " + tokenRes.status + " " + errorMsg);
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;

        // 2. DISCOVER ENDPOINT
        const decoded = parseJwt(accessToken);
        const idCompany = decoded ? decoded.companyId : null;

        // 4. Discover Endpoint (or use Instance ID)
        let apiUrl = "";

        // IF USER PROVIDED INSTANCE ID, USE IT DIRECTLY (Most Reliable)
        if (instanceId && instanceId.length > 0) {
            let baseApi = isQA ? "https://qa.giobby.com" : "https://app.giobby.com";
            // Check if Instance ID is just numeric (e.g. 1234) or full path? Usually number.
            // Prod URL pattern: https://giobby.com/GiobbyApi[ID]/v1
            // QA URL pattern: https://qa.giobby.com/GiobbyApi[ID]/v1
            apiUrl = baseApi + "/GiobbyApi" + instanceId + "/v1";
        }
        else {
            // Fallback to auto-discovery
            let discoveryHost = isQA ? "https://qa.giobby.com" : "https://app.giobby.com";
            // QA Discovery path might be different? Assuming similar structure or using fixed logic.
            // Prod: https://app.giobby.com/GiobbyApiLogin/v1/endpoint
            let endpointUrl = discoveryHost + "/GiobbyApiLogin/v1/endpoint";

            if (idCompany) endpointUrl += "?idCompany=" + idCompany;
            else endpointUrl += "?idCompany=" + cid;

            let finalEndpointUrl = endpointUrl;
            if (useProxy) finalEndpointUrl = window.getGiobbyProxiedUrl(endpointUrl);

            try {
                const endpointRes = await fetch(finalEndpointUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + accessToken
                    }
                });

                if (!endpointRes.ok) {
                    throw new Error("Endpoint Discovery Failed: " + endpointRes.status);
                }

                const epData = await endpointRes.json();
                if (epData && epData.GiobbyApiURL) {
                    apiUrl = epData.GiobbyApiURL;
                } else if (epData && epData.url) {
                    apiUrl = epData.url; // Legacy support just in case
                } else if (typeof epData === 'string' && epData.startsWith('http')) {
                    apiUrl = epData;
                }

                // FORCE CORRECTION: The server might return 'giobby.com', but we need 'app.giobby.com'
                if (apiUrl && apiUrl.includes("https://giobby.com") && !apiUrl.includes("qa.giobby.com")) {
                    apiUrl = apiUrl.replace("https://giobby.com", "https://app.giobby.com");
                } else {
                    console.error("Endpoint JSON:", epData);
                    throw new Error("Endpoint Invalid JSON (No GiobbyApiURL)");
                }

            } catch (e) {
                console.warn("Giobby Endpoint Discovery Failed. Using fallback with CID.", e);
                // Fallback
                let baseFallback = isQA ? "https://qa.giobby.com" : "https://app.giobby.com";
                apiUrl = baseFallback + "/GiobbyApi" + cid + "/v1";
                alert("Attenzione: Impossibile recuperare URL automatico. Uso URL basato su CID: " + apiUrl);
            }
        }

        let vatRC = document.getElementById('giobbyVatRC') ? document.getElementById('giobbyVatRC').value.trim() : 'N6';
        if (vatRC === 'N.I.Art.17,c6,DPR 633/72') vatRC = 'N6';
        let vatZero = document.getElementById('giobbyVatZero') ? document.getElementById('giobbyVatZero').value.trim() : 'N4';
        const config = {
            user: user,
            password: pass,
            clientSecret: clientSecret,
            cid: cid,
            instanceId: instanceId,
            clientId: clientId,
            useProxy: useProxy,
            isQA: isQA,
            vatRC: vatRC,
            vatZero: vatZero,
            accessToken: accessToken,
            refreshToken: refreshToken,
            apiUrl: apiUrl,
            lastLogin: new Date().getTime()
        };
        localStorage.setItem('giobbyConfig', JSON.stringify(config));
        
        // --- NEW: SAVE TO CLOUD (APP_CONFIG) ---
        if (db && typeof db.saveGiobbyConfigDB === 'function') {
            await db.saveGiobbyConfigDB(config, false); // false = Genesy (Romagna)
        }

        statusEl.innerHTML = '<i class="fa-solid fa-check"></i> Connesso! (API: ' + apiUrl + ')';
        statusEl.style.color = 'green';
        alert("Connessione Giobby Riuscita!\nURL API: " + apiUrl);

    } catch (e) {
        console.error(e);
        statusEl.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Errore: ' + e.message;
        statusEl.style.color = 'red';
        alert("Errore Login Giobby:\n" + e.message);
    }
};

window.loadGiobbySettings = function () {
    const json = localStorage.getItem('giobbyConfig');
    if (json) {
        try {
            const config = JSON.parse(json);
            if (document.getElementById('giobbyUsername')) document.getElementById('giobbyUsername').value = config.user || '';
            if (document.getElementById('giobbyTenantId')) document.getElementById('giobbyTenantId').value = config.cid || '';
            if (document.getElementById('giobbyInstanceId')) document.getElementById('giobbyInstanceId').value = config.instanceId || '';
            if (document.getElementById('giobbyClientId')) document.getElementById('giobbyClientId').value = config.clientId || '';
            if (document.getElementById('giobbyClientSecret') && config.clientSecret) document.getElementById('giobbyClientSecret').value = config.clientSecret;
            if (document.getElementById('giobbyPassword') && config.password) document.getElementById('giobbyPassword').value = config.password;
            if (document.getElementById('giobbyUseProxy')) document.getElementById('giobbyUseProxy').checked = !!config.useProxy;
            if (document.getElementById('giobbyQA')) document.getElementById('giobbyQA').checked = !!config.isQA;
            if (document.getElementById('giobbyVatRC')) {
                let displayRC = config.vatRC || 'N6';
                if (displayRC === 'N.I.Art.17,c6,DPR 633/72') displayRC = 'N6';
                document.getElementById('giobbyVatRC').value = displayRC;
            }
            if (document.getElementById('giobbyVatZero')) {
                document.getElementById('giobbyVatZero').value = config.vatZero || 'N4';
            }

            const statusEl = document.getElementById('giobbyStatus');
            if (config.accessToken && statusEl) {
                statusEl.innerHTML = '<i class="fa-solid fa-check"></i> Connesso (Salvato)';
                statusEl.style.color = 'green';
            }
        } catch (e) { console.error("Error loading giobby config", e); }
    }
};


// --- USER GIOBBY LOGIN (Public) ---
window.openUserGiobbyLogin = function () {
    const m = document.getElementById('userGiobbyLoginModal');
    if (m) {
        m.classList.remove('hidden');
        m.classList.add('flex');

        // Pre-fill if some config exists
        const json = localStorage.getItem('giobbyConfig');
        if (json) {
            try {
                const c = JSON.parse(json);
                if (c.user) document.getElementById('userGiobbyUser').value = c.user;
                if (c.cid) document.getElementById('userGiobbyCID').value = c.cid;
                if (c.clientId) document.getElementById('userGiobbyClientId').value = c.clientId;
            } catch (e) { }
        }
    }
};

window.closeUserGiobbyLogin = function () {
    const m = document.getElementById('userGiobbyLoginModal');
    if (m) {
        m.classList.add('hidden');
        m.classList.remove('flex');
    }
};

/**
 * Cancella il config Giobby salvato e riapre il modal di login.
 * Utile quando il token è scaduto o l'endpoint è sbagliato.
 */
window.forceGiobbyRelogin = function () {
    localStorage.removeItem('giobbyConfig');

    openUserGiobbyLogin();
};

window.performUserGiobbyLogin = async function () {
    const user = document.getElementById('userGiobbyUser').value.trim();
    const pass = document.getElementById('userGiobbyPass').value.trim();
    const cid = document.getElementById('userGiobbyCID').value.trim();
    const clientId = document.getElementById('userGiobbyClientId').value.trim();
    const statusEl = document.getElementById('userGiobbyStatus');

    if (!user || !pass || !cid) {
        alert("Inserisci User, Password e CID.");
        return;
    }

    if (statusEl) {
        statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connessione...';
        statusEl.style.color = 'orange';
    }

    const config = {
        user: user,
        password: pass,
        cid: cid,
        clientId: clientId || "GiobbyApp", // Default if empty? Or keep empty.
        isQA: false, // Default to Prod for agents
        useProxy: true // Safer default for browser
    };

    // Use our helper
    const token = await window.authenticateGiobby(config);

    if (token) {
        config.accessToken = token;
        config.lastLogin = new Date().getTime();

        // Resolve the REAL API endpoint via JWT decode + official discovery
        if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Risoluzione endpoint API...';
        const resolvedUrl = await window.resolveGiobbyApiUrl(token, config.useProxy, cid);
        if (resolvedUrl) {
            config.apiUrl = resolvedUrl.endsWith('/') ? resolvedUrl : resolvedUrl + '/';

        } else {
            // Fallback: construct URL manually
            config.apiUrl = "https://app.giobby.com/GiobbyApi" + cid + "/v1/";
            console.warn('[Giobby] performUserGiobbyLogin: using fallback apiUrl:', config.apiUrl);
        }

        localStorage.setItem('giobbyConfig', JSON.stringify(config));

        if (statusEl) {
            statusEl.innerHTML = '<i class="fa-solid fa-check"></i> Connesso! Endpoint: ' + config.apiUrl;
            statusEl.style.color = 'green';
        }

        setTimeout(() => {
            closeUserGiobbyLogin();
            alert("Connessione riuscita!\nEndpoint: " + config.apiUrl);
        }, 1500);
    } else {
        if (statusEl) {
            statusEl.innerHTML = '<i class="fa-solid fa-times"></i> Errore Login.';
            statusEl.style.color = 'red';
        }
        alert("Login Fallito. Controlla le credenziali.");
    }
};

window.exportToGiobby = async function (quote) {
    // Autosave if we are exporting the current working quote
    if (currentQuote && (!quote || quote.id === currentQuote.id)) {
        if (!quote) quote = currentQuote;
        try {
            await db.saveQuote(quote);
            editorIsDirty = false;
        } catch (e) {
            console.error("Autosave before export failed:", e);
        }
    }

    const json = localStorage.getItem('giobbyConfig');
    if (!json) {
        console.warn("No Giobby config found.");
        openUserGiobbyLogin();
        return;
    }
    const config = JSON.parse(json);
    if (!config.accessToken || !config.apiUrl) {
        console.warn("Incomplete Giobby config. Please Login.");
        openUserGiobbyLogin();
        return;
    }

    // Auto-refresh token if needed? (For minimal scope, we skip unless it fails with 401)

    let baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
    let endpoint = baseUrl + 'sales/orders';
    if (config.useProxy) endpoint = 'https://corsproxy.io/?' + endpoint;

    // MAP DATA
    const todayMillis = new Date().getTime();
    // MAP VAT RATE
    // Simple mapper: 0.22 -> "22", 0.10 -> "10", 0.04 -> "4", 0 -> "0"
    // Ideally we should have a map of Giobby VAT IDs. Assuming standard numeric strings work.
    let vatCode = "22"; // default
    if (quote.vatRate !== undefined) {
        if (quote.vatRate == 0) vatCode = "0"; // Or specific exempt code
        else if (quote.vatRate == 0.04) vatCode = "4";
        else if (quote.vatRate == 0.10) vatCode = "10";
        else if (quote.vatRate == 0.22) vatCode = "22";
    }

    // PRE-FLIGHT: Update Customer Address on Giobby
    // Use already-known giobbyContactId if available to avoid fuzzy-search errors
    if (quote.customer && typeof window.findOrCreateGiobbyClient === 'function') {
        try {
            let contactInfo = null;

            // PRIORITY: Use saved giobbyContactId to avoid wrong-client fuzzy match
            if (quote.customer.giobbyContactId && quote.customer.idCustomer) {
                contactInfo = {
                    idContact: quote.customer.giobbyContactId,
                    idCustomer: quote.customer.idCustomer
                };

            } else {
                // Fallback: resolve by search (only if no ID is saved)
                console.warn(`[Pre-flight] giobbyContactId mancante per ${quote.customer.name}, eseguendo ricerca...`);
                contactInfo = await window.findOrCreateGiobbyClient(config, quote.customer);
            }

            if (contactInfo && contactInfo.idContact) {
                try {
                    if (typeof window.updateGiobbyClient === 'function') {
                        // Safe merge: avoids wiping out existing fields like nation or country
                        await window.updateGiobbyClient(config, quote.customer, contactInfo.idContact);
                    } else {
                        console.warn('window.updateGiobbyClient not found, skipping pre-flight update.');
                    }
                } catch (updateErr) {
                    console.warn('PRE-FLIGHT: Contact Update Failed', updateErr);
                }
            } else {
            }
        } catch (e) {
            console.warn("Pre-flight contact sync error:", e);
            alert("Errore durante la sincronizzazione dati cliente: " + e.message);
        }
    }

    // Use sales/offers for Quotes if available in config or default
    if (endpoint.includes('sales/documents') || endpoint.endsWith('documents')) {
        // Switch to specific endpoint if we know it works better
        // endpoint = endpoint.replace('documents', 'offers'); // Risky if config wrong
    }

    const allProducts = (typeof db !== 'undefined' && typeof db.getProducts === 'function') ? (db.getProducts() || []) : [];

    const rows = quote.items.map(i => {
        const price = typeof i.unitPrice === 'number' ? i.unitPrice : parseFloat(i.unitPrice) || 0;
        const qty = typeof i.quantity === 'number' ? i.quantity : parseFloat(i.quantity) || 0;

        let finalDesc = i.description || "Articolo";
        if (i.code) {
             const cleanItemCode = String(i.code).toUpperCase().replace(/[^A-Z0-9]/g, '');
             const p = allProducts.find(prod => {
                 const c1 = prod.code ? String(prod.code).toUpperCase().replace(/[^A-Z0-9]/g, '') : "";
                 const c2 = prod.giobby_code ? String(prod.giobby_code).toUpperCase().replace(/[^A-Z0-9]/g, '') : "";
                 return c1 === cleanItemCode || c2 === cleanItemCode;
             });
             if (p) {
                 // PRIORITÀ: usa la descrizione Giobby se presente, altrimenti quella Genesy
                 if (p.giobby_description && p.giobby_description.trim() !== "") {
                     finalDesc = p.giobby_description.trim();
                 } else if (p.description && p.description.trim() !== "") {
                     finalDesc = p.description.trim();
                 }
             }
        }

        return {
            "idMaterial": null,
            "description": finalDesc,
            "quantity": qty.toString(),
            "price": price.toString(),
            "idVat": vatCode,
            "idPosType": "1",
            "idAttributeCombination": 0,
            "idOrderType": "1"
        };
    });

    const payload = {
        "docNumber": (quote.friendlyId || quote.id).toString(),
        "idVendor": null,
        "idDocumentType": 0,
        "idOrderType": "1",
        "idCustomer": (quote.customer && quote.customer.idCustomer) ? quote.customer.idCustomer : "CLI_DEFAULT",
        "docDate": todayMillis.toString(),
        "deliveryDate": quote.deliveryDate ? new Date(quote.deliveryDate).getTime().toString() : null,
        "dateDelivery": quote.deliveryDate ? new Date(quote.deliveryDate).getTime().toString() : null, // Try alias
        "docStatus": "CREATED",
        "docCurrency": "EUR",
        "rows": rows,
        "reference": "Rif. " + (quote.friendlyId || quote.id),
        "yourReference": "Rif. " + (quote.friendlyId || quote.id), // Try alias
        "externalRef": "Rif. " + (quote.friendlyId || quote.id), // Try alias
        "note": quote.notes || "Generato da Antigravity/Preventivi",
        "notes": quote.notes || "Generato da Antigravity/Preventivi", // Try alias
        "description": quote.notes || "Generato da Antigravity/Preventivi", // Try alias
        "internalNote": quote.internalNotes || "",
        "internalNotes": quote.internalNotes || "", // Try alias

        // CUSTOMER ADDRESS (Billing/Intestazione)
        // Was dest* which maps to Shipping. User wants Main Address.
        "customerName": quote.customer ? quote.customer.name : "",
        "customerAddress": quote.customer ? quote.customer.address : "",
        "customerCity": quote.customer ? quote.customer.city : "",
        "customerZipCode": quote.customer ? quote.customer.zip : "",
        "customerProvince": quote.customer ? (quote.customer.province || quote.customer.addressProvince) : "",
        "customerEmail": quote.customer ? quote.customer.email : "",
        "customerVatCode": quote.customer ? quote.customer.vat : "", // P.IVA
        "customerFiscalCode": quote.customer ? quote.customer.fiscal_code : "", // CF
        "customerCountry": "IT", // Force Country as IT for Giobby API

        // ALIASES FOR MAIN ADDRESS (Shotgun)
        "address": quote.customer ? quote.customer.address : "",
        "city": quote.customer ? quote.customer.city : "",
        "zipCode": quote.customer ? quote.customer.zip : "",
        "province": quote.customer ? (quote.customer.province || quote.customer.addressProvince) : "",

        "billingAddress": quote.customer ? quote.customer.address : "",
        "billingCity": quote.customer ? quote.customer.city : "",
        "billingZip": quote.customer ? quote.customer.zip : "",

        "clienteIndirizzo": quote.customer ? quote.customer.address : "",
        "clienteCitta": quote.customer ? quote.customer.city : "",
        "clienteCap": quote.customer ? quote.customer.zip : "",
        "clienteProvincia": quote.customer ? (quote.customer.province || quote.customer.addressProvince) : "",

        // SHIPPING ADDRESS (Destinazione Merce) -> From "Cantiere"
        "destName": quote.siteContactName || (quote.customer ? quote.customer.name : ""),
        "destAddress": quote.siteAddress || "",
        "destCity": "", // We don't have separate City for Site yet, Giobby might parse or we leave empty
        "destZipCode": "",
        "destProvince": "",
        // "destContact": quote.siteContactReference || "", // Not standard Giobby field, maybe add to internal notes?

        // EXTRAS
        "agent": quote.agent || "", // Try sending Name, Giobby might link it
        "idAgent": null, // If we had an ID mapping
        "payment": quote.paymentMethod || "",
        "bank": quote.bank || "",
        "carrier": "",
        "transport": "",

        "customField1": quote.siteContactReference ? "Ref. Cantiere: " + quote.siteContactReference : "",
        "customField2": quote.siteContactPhone ? "Tel. Cantiere: " + quote.siteContactPhone : ""
    };

    if (confirm("Vuoi esportare questo ordine su Giobby ora?")) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + config.accessToken,
                    'Content-Type': 'application/json',
                    'X-Giobby-Realm': 'api-server'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                // Handle potentially empty or non-JSON response
                let resJson = {};
                try {
                    const text = await response.text();
                    if (text && text.length > 0) {
                        resJson = JSON.parse(text);
                    }
                } catch (parseErr) {
                    console.warn("Giobby response not JSON:", parseErr);
                }

                const newId = resJson.id || resJson.codice || ''; // Try common ID fields

                // Salva l'ID Giobby nel preventivo per mostrare l'icona nella lista
                if (newId && typeof db !== 'undefined' && db.saveQuote && typeof currentQuote !== 'undefined' && currentQuote) {
                    try {
                        currentQuote.giobbyDocumentId = String(newId);
                        await db.saveQuote(currentQuote);

                    } catch (saveErr) {
                        console.warn('[Giobby] Errore salvataggio giobbyDocumentId:', saveErr);
                    }
                }

                // Notifica successo e apri automaticamente il documento su Giobby
                const tenantId = config.cid || 'Giobby00554';
                const link = newId ? `https://app.giobby.com/${tenantId}/sales/order/Order.xhtml?IDORDER=${newId}&ftrID=odv_v&idFeature=odv_v` : null;
                alert('✅ Esportazione Riuscita su Giobby!' + (newId ? '\nID Documento: ' + newId : ''));
                if (link) window.open(link, '_blank');

            } else {
                const txt = await response.text();
                // Check for common errors
                if (response.status === 401) alert("Errore 401: Token scaduto o non valido. Riconnettiti.");
                else alert("Errore Giobby (" + response.status + "): \n" + txt);
            }
        } catch (e) {
            console.error(e);
            alert("Errore di Rete Giobby: " + e.message);
        }
    }
};

window.debugGiobbyOrder = async function () {
    const json = localStorage.getItem('giobbyConfig');
    if (!json) return alert("Non connesso.");
    const config = JSON.parse(json);

    let baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
    // Try to find a valid Customer ID since Orders are failing
    // Common endpoints: registry/customers, sales/customers, contacts
    // Let's try 'registry/customers' first, then 'sales/customers' if that fails (logic implemented via error handling or sequential calls if I could, but let's stick to one likely candidate).
    // Actually, let's try 'sales/customers' which seems symmetric to 'sales/orders'.
    let endpoint = baseUrl + 'sales/customers';
    if (config.useProxy) endpoint = 'https://corsproxy.io/?' + endpoint;

    try {
        let response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + config.accessToken,
                'Content-Type': 'application/json',
                'X-Giobby-Realm': 'api-server'
            }
        });

        // Fallback to registry/customers if 404
        if (response.status === 404) {
            endpoint = baseUrl + 'registry/customers';
            if (config.useProxy) endpoint = 'https://corsproxy.io/?' + endpoint;
            response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + config.accessToken,
                    'Content-Type': 'application/json',
                    'X-Giobby-Realm': 'api-server'
                }
            });
        }

        if (response.ok) {
            const data = await response.json();

            let msg = "Clienti Trovati: ";
            const list = data.customers || data.contacts || data; // Flexible parsing

            if (Array.isArray(list) && list.length > 0) {
                msg += list.length;
                const first = list[0];
                msg += "\n\nCOPIA QUESTO ID:\n";
                // Try to find the ID field (id, idCustomer, idContact)
                const id = first.id || first.idCustomer || first.idContact;
                msg += "ID Cliente: " + id + "\n";
                msg += "Nome: " + (first.name || first.companyName || "N/A");
            } else {
                msg += "0. Impossibile trovare un ID Cliente valido.";
            }
            alert(msg);
        } else {
            const txt = await response.text();
            alert("Errore Ricerca Clienti: " + response.status + "\n" + txt);
        }
    } catch (e) {
        alert("Errore Debug Clienti: " + e.message);
    }
};

// --- ITALIAN CITIES AUTOCOMPLETE ---
window.italianCities = null;

window.fetchItalianCities = async function () {
    if (window.italianCities) return window.italianCities;
    try {
        // Using GitHub Raw CDN for reliability
        const res = await fetch('https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json');
        if (!res.ok) throw new Error('Failed to load cities');
        const data = await res.json();

        // Map to simpler structure for memory efficiency
        window.italianCities = data.map(c => ({
            name: c.nome,
            zip: (c.cap && c.cap.length > 0) ? c.cap[0] : '', // Use first CAP
            province: c.sigla
        }));
        return window.italianCities;
    } catch (e) {
        console.error("Error loading cities:", e);
        return [];
    }
};

window.setupCityAutocomplete = async function () {
    const cityInput = document.getElementById('newClientCity');
    const zipInput = document.getElementById('newClientZip');
    const provInput = document.getElementById('newClientAddressProvince');

    if (!cityInput) return;

    // Create Datalist if not exists
    let datalist = document.getElementById('cityList');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'cityList';
        document.body.appendChild(datalist);
        cityInput.setAttribute('list', 'cityList');
    }

    // Load Data
    const cities = await window.fetchItalianCities();
    if (!cities || cities.length === 0) return;

    // Input Handler for filtering
    cityInput.oninput = function () {
        const val = this.value.toLowerCase();
        if (val.length < 2) return;

        // Filter suggestions (Limit 20 for performance)
        const matches = cities.filter(c => c.name.toLowerCase().startsWith(val)).slice(0, 20);

        datalist.innerHTML = '';
        matches.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            datalist.appendChild(opt);
        });

        // Auto-fill if exact match found during typing
        const exact = cities.find(c => c.name.toLowerCase() === val);
        if (exact) {
            // Only auto-fill if empty to avoid overwriting user edits? 
            // User requested automation, so overwriting is likely expected behavior for corrections.
            if (zipInput) zipInput.value = exact.zip;
            if (provInput) provInput.value = exact.province;
        }
    };

    // Select Handler (Change)
    cityInput.onchange = function () {
        const val = this.value;
        // Case insensitive match
        const exact = cities.find(c => c.name.toLowerCase() === val.toLowerCase());
        if (exact) {
            if (zipInput) zipInput.value = exact.zip;
            if (provInput) provInput.value = exact.province;
        }
    }
};

// --- GIOBBY LINK HELPER ---
window.openGiobbyClientLink = async function () {
    const idInput = document.getElementById('newClientIdCustomer');
    if (!idInput) return;
    let id = idInput.value ? idInput.value.trim() : '';
    let targetWindow = null;

    if (!id) {
        // UX Enhancement: Ask to Sync instead of blocking
        const nameInput = document.getElementById('newClientName');
        if (!nameInput || !nameInput.value.trim()) {
            alert("Inserisci almeno il Nome del cliente per poterlo sincronizzare.");
            return;
        }

        if (!confirm("Codice Cliente mancante. Vuoi sincronizzare questo cliente su Giobby ora?")) {
            return;
        }

        // OPEN WINDOW IMMEDIATELY TO BYPASS POPUP BLOCKER
        targetWindow = window.open("", "_blank");
        if (targetWindow) {
            targetWindow.document.write("<html><head><title>Sincronizzazione...</title></head><body style='font-family:sans-serif; text-align:center; padding-top:50px;'><h2>Sincronizzazione con Giobby in corso...</h2><p>Attendere prego, non chiudere questa finestra.</p></body></html>");
        } else {
            alert("Popup bloccato! Impossibile aprire Giobby.");
            return;
        }

        // Gather Data directly from Modal Inputs
        const typeRadio = document.querySelector('input[name="clientType"]:checked');
        const type = typeRadio ? typeRadio.value : 'private';

        const clientData = {
            name: document.getElementById('newClientName').value.trim(),
            vat: document.getElementById('newClientVat').value.trim(),
            fiscal_code: document.getElementById('newClientFiscalCode').value.trim(),
            type: type,
            // Note: createGiobbyClient derives type/fiscalCode from logic, but good to pass if we have specific field?
            // giobby.js uses name, vat, address, city, zip, email...
            address: document.getElementById('newClientAddress').value.trim(),
            city: document.getElementById('newClientCity').value.trim(),
            zip: document.getElementById('newClientZip').value.trim(),
            addressProvince: document.getElementById('newClientAddressProvince').value.trim(),
            country: document.getElementById('newClientCountry').value.trim(),
            email: document.getElementById('newClientEmail').value.trim(),
            pec: document.getElementById('newClientPec').value.trim(),
            phoneOffice: document.getElementById('newClientPhoneOffice').value.trim(),
            phoneHome: document.getElementById('newClientPhoneHome').value.trim(),
            mobile: document.getElementById('newClientMobile').value.trim(),
            fax: document.getElementById('newClientFax').value.trim(),
            sdi: document.getElementById('newClientSdi').value.trim()
        };

        try {
            if (typeof showLoadingSpinner === 'function') showLoadingSpinner("Sincronizzazione Giobby...");

            // Check availability
            if (typeof window.syncSingleClientToGiobby !== 'function') {
                throw new Error("Modulo Giobby non caricato correttamente.");
            }

            const result = await window.syncSingleClientToGiobby(clientData);
            alert("DEBUG GIOBBY: " + JSON.stringify(result));

            if (result && result.idCustomer) {
                id = result.idCustomer;
                idInput.value = id;
                // Add visual feedback
                idInput.classList.add('input-flash');
                setTimeout(() => idInput.classList.remove('input-flash'), 1000);
            } else {
                throw new Error("Sincronizzazione completata ma nessun ID ricevuto.");
            }
        } catch (e) {
            console.error("Giobby Sync Error:", e);
            alert("Errore Sincronizzazione: " + e.message);
            if (targetWindow) targetWindow.close();
            return; // Stop here, don't open link
        } finally {
            if (typeof hideLoadingSpinner === 'function') hideLoadingSpinner();
        }
    }

    // Double check we have an ID now
    if (!id) {
        if (targetWindow) targetWindow.close();
        return;
    }

    const json = localStorage.getItem('giobbyConfig');
    let tenantId = 'Giobby00554'; // Fallback default
    if (json) {
        try {
            const config = JSON.parse(json);
            if (config.cid) tenantId = config.cid;
        } catch (e) { }
    }

    const link = `https://app.giobby.com/${tenantId}/company/Contact.xhtml?IDCUSTOMER=${id}&ftrID=cust_n&idFeature=cust_n`;
    // Redirect the pre-opened window OR open new if didn't exist
    if (targetWindow) {
        targetWindow.location.href = link;
    } else {
        window.open(link, '_blank');
    }
};

// --- RESPONSIVE SIDEBAR LOGIC ---
window.toggleSidebar = function () {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('hidden');
};

// Ensure listener is attached
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            // Only close if active
            if (document.querySelector('.sidebar.active')) window.toggleSidebar();
        });
    }
});

// --- USER MANAGEMENT (ADMIN) ---
window.openUserMgmt = async function () {
    const listBody = document.getElementById('userListBody');
    listBody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento...</td></tr>';

    document.getElementById('userMgmtModal').classList.remove('hidden');
    // Hide parent modal to avoid stacking issues? Or keep it?
    // Let's keep varsModal open or close it? Better close it to focus.
    closeModal('varsModal');
    document.getElementById('userMgmtModal').classList.remove('hidden'); // Re-ensure

    try {
        await window.renderUserList();
    } catch (e) {
        console.error(e);
        listBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Errore: ${e.message}</td></tr>`;
    }
}

window.closeUserMgmt = function () {
    closeModal('userMgmtModal');
    // Optionally re-open settings? No.
}

window.renderUserList = async function () {
    const users = await db.getAllUsers();
    const listBody = document.getElementById('userListBody');
    listBody.innerHTML = '';

    if (!users || users.length === 0) {
        listBody.innerHTML = '<tr><td colspan="5" class="text-center">Nessun utente trovato</td></tr>';
        return;
    }

    users.forEach(u => {
        const tr = document.createElement('tr');

        const isMe = (db.user && db.user.email === u.email);
        const isAdmin = (u.role === 'admin');
        const isDisabled = !!u.disabled;

        let roleBadge = isAdmin
            ? '<span class="badge" style="background:#ef4444; color:white;">ADMIN</span>'
            : '<span class="badge" style="background:#3b82f6; color:white;">AGENTE</span>';

        if (isDisabled) roleBadge += ' <span class="badge" style="background:#64748b; color:white;">BLOCCATO</span>';

        tr.innerHTML = `
            <td>
                <div style="font-weight:bold;">${u.email}</div>
                <div style="font-size:0.8em; color:#888;">ID: ${u.id.substr(0, 8)}...</div>
            </td>
            <td>${roleBadge}</td>
            <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '-'}</td>
            <td>
                <span style="color:${isDisabled ? 'red' : 'green'}; font-size:1.2em;">
                    ${isDisabled ? '<i class="fa-solid fa-ban"></i>' : '<i class="fa-solid fa-check-circle"></i>'}
                </span>
            </td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn-icon" title="Cambia Ruolo" onclick="toggleUserRole('${u.id}', '${u.role}')" ${isMe ? 'disabled' : ''}>
                        <i class="fa-solid fa-user-shield"></i>
                    </button>
                    ${!isMe ? `
                    <button class="btn-icon" title="${isDisabled ? 'Sblocca' : 'Blocca'}" onclick="toggleUserStatus('${u.id}', ${isDisabled})">
                        <i class="fa-solid ${isDisabled ? 'fa-unlock' : 'fa-lock'}" style="${isDisabled ? 'color:green' : 'color:red'}"></i>
                    </button>
                    ` : ''}
                </div>
            </td>
        `;
        listBody.appendChild(tr);
    });
}

window.toggleUserRole = async function (uid, currentRole) {
    if (!confirm(`Cambiare ruolo da ${currentRole} a ${currentRole === 'admin' ? 'agent' : 'admin'}?`)) return;
    try {
        await db.toggleUserRole(uid, currentRole);
        renderUserList();
    } catch (e) { alert("Errore: " + e.message); }
}

window.toggleUserStatus = async function (uid, currentDisabled) {
    if (!confirm(`${currentDisabled ? 'Sbloccare' : 'Bloccare'} questo utente?`)) return;
    try {
        await db.toggleUserStatus(uid, currentDisabled);
        renderUserList();
    } catch (e) { alert("Errore: " + e.message); }
}

window.openRegistrationTab = function () {
    document.getElementById('addUserModal').classList.remove('hidden');
}

window.saveNewUser = async function () {
    const email = document.getElementById('newUserEmail').value;
    const pass = document.getElementById('newUserPass').value;
    // const role = document.getElementById('newUserRole').value; // Role setting relies on DB trigger or default? 
    // Supabase SignUp doesn't allow setting role in metadata directly unless allowed. 
    // We will SignUp then Admin-Update role if needed, OR just create as Agent.

    if (!email || !pass) return alert("Compila tutti i campi");

    try {
        showLoadingSpinner("Creazione utente...");

        // Use Supabase Auth to create user. 
        // WARNING: This logs the current user out if we are not careful?
        // Supabase JS v2 'signUp' generally signs in the new user immediately if email confirmation is off.
        // If we are admin, we don't want to lose our session.
        // The proper way is using Service Role Key on backend, but we are client-side.
        // Workaround: We can't easily create another user without a session switch unless we use a secondary specific client/method or invite.
        // Let's try 'signUp'. If it switches session, we are in trouble.
        // Actually, inviteUserByEmail is admin only (service key).
        // Let's try to see if we can just do it. If we get logged out, we must warn user.

        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: pass
        });

        if (error) throw error;

        // If success, and we are still logged in as Admin? 
        // We can check `supabase.auth.getUser()`.
        const { data: currUser } = await supabase.auth.getUser();

        if (currUser && currUser.user && currUser.user.email !== db.user.email) {
            // Needed to re-login admin? 
            alert("Utente creato! ATTENZIONE: Sei stato loggato come il nuovo utente. Effettua il logout e rientra come Admin.");
            location.reload();
            return;
        }

        alert("Utente creato con successo!");
        document.getElementById('addUserModal').classList.add('hidden');
        document.getElementById('formAddUser').reset();

        // Refresh list (might not show new user immediately if not confirmed?)
        setTimeout(renderUserList, 1000);

    } catch (e) {
        console.error(e);
        alert("Errore creazione: " + e.message);
    } finally {
        hideLoadingSpinner();
    }
}

window.copyClientAddressToSite = function () {
    if (!currentQuote || !currentQuote.customer) {
        alert("Nessun cliente selezionato!");
        return;
    }

    const c = currentQuote.customer;

    // Map Address
    const addr = c.address || '';
    const city = c.city || '';
    const zip = c.zip || '';
    const prov = c.addressProvince || c.province || ''; // Handle both conventions

    // Populate Sidebar Inputs (if they exist)
    const elAddr = document.getElementById('docSiteAddress');
    const elCity = document.getElementById('docSiteCity');
    const elZip = document.getElementById('docSiteZip');
    const elProv = document.getElementById('docSiteProvince');

    if (elAddr) elAddr.value = addr;
    if (elCity) elCity.value = city;
    if (elZip) elZip.value = zip;
    if (elProv) elProv.value = prov;

    // Update Quote Object directly
    currentQuote.siteAddress = addr;
    currentQuote.siteCity = city;
    currentQuote.siteZip = zip;
    currentQuote.siteProvince = prov;

    // Trigger saving dirty state
    editorIsDirty = true;

    // Provide visual feedback
    const btn = document.querySelector('button[onclick="copyClientAddressToSite()"]');
    if (btn) {
        const originalInfo = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiato!';
        setTimeout(() => {
            btn.innerHTML = originalInfo;
        }, 1500);
    }
};

/* --- AUTOCOMPLETE MUNICIPALITIES --- */
// Initializes the CityManager for various input groups
document.addEventListener('DOMContentLoaded', () => {
    if (typeof CityManager !== 'undefined') {
        // 1. Quote Editor Sidebar (Site Address)
        CityManager.enableAutocomplete('docSiteCity', 'docSiteZip', 'docSiteProvince');

        // 2. Client Modal - Legal Address
        CityManager.enableAutocomplete('newClientCity', 'newClientZip', 'newClientAddressProvince');

        // 3. Client Modal - Logistics (Optional Site Address)
        // Using the _Input fields which trigger logic on change
        CityManager.enableAutocomplete('newClientSiteCity_Input', 'newClientSiteZip_Input', 'newClientSiteAddressProvince_Input');
    }
});

// --- TRASH / BIN MANAGEMENT ---

window.renderTrashView = function () {
    const deletedQuotes = db.getDeletedQuotes();
    const tbody = document.getElementById('trashTableBody');

    if (!tbody) {
        console.error('Trash table body not found');
        return;
    }

    tbody.innerHTML = '';

    // Reset master checkbox
    const master = document.querySelector('input[onchange="toggleSelectAllTrash(this)"]');
    if (master) master.checked = false;
    updateTrashBulkButtons();

    if (deletedQuotes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #94a3b8;">
                    <i class="fa-solid fa-trash" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                    <p>Il cestino è vuoto</p>
                </td>
            </tr>
        `;
        return;
    }

    deletedQuotes.forEach(q => {
        const customerName = q.customer && q.customer.name ? q.customer.name : 'N/A';
        const date = q.date ? new Date(q.date).toLocaleDateString('it-IT') : 'N/A';
        const deletedDate = q.deleted_at ? new Date(q.deleted_at).toLocaleDateString('it-IT') : 'N/A';
        const total = q.total ? formatCurrency(q.total) : '0';

        tbody.innerHTML += `
            <tr>
                <td><input type="checkbox" class="trash-check" value="${q.id}" onchange="updateTrashBulkButtons()"></td>
                <td><strong>${customerName}</strong></td>
                <td>${date}</td>
                <td>${q.zone || '-'}</td>
                <td>${q.agent || '-'}</td>
                <td>${deletedDate}</td>
                <td style="white-space: nowrap;">
                    <button class="btn-sm" style="background: #16a34a; color: white; margin-right: 5px;" 
                            onclick="confirmRestore('${q.id}')" title="Ripristina">
                        <i class="fa-solid fa-rotate-left"></i> Ripristina
                    </button>
                    <button class="btn-sm" style="background: #dc2626; color: white;" 
                            onclick="confirmPermanentDelete('${q.id}')" title="Elimina Definitivamente">
                        <i class="fa-solid fa-trash"></i> Elimina
                    </button>
                </td>
            </tr>
        `;
    });
}


// --- BULK TRASH ACTIONS ---

window.toggleSelectAllTrash = function (source) {
    document.querySelectorAll('.trash-check').forEach(c => c.checked = source.checked);
    updateTrashBulkButtons();
}

window.updateTrashBulkButtons = function () {
    const checked = document.querySelectorAll('.trash-check:checked').length;

    const btnRestore = document.getElementById('btnBulkRestoreTrash');
    const btnPermDel = document.getElementById('btnBulkPermDeleteTrash');

    if (btnRestore) {
        if (checked > 0) btnRestore.classList.remove('hidden');
        else btnRestore.classList.add('hidden');
        const span = document.getElementById('countResTrash');
        if (span) span.textContent = checked;
    }

    if (btnPermDel) {
        if (checked > 0) btnPermDel.classList.remove('hidden');
        else btnPermDel.classList.add('hidden');
        const span = document.getElementById('countPermDelTrash');
        if (span) span.textContent = checked;
    }
}

window.restoreSelectedTrashQuotes = async function () {
    const checked = Array.from(document.querySelectorAll('.trash-check:checked')).map(c => c.value);
    if (checked.length === 0) return;

    if (!confirm(`Vuoi ripristinare ${checked.length} preventivi selezionati?`)) return;

    try {
        for (const id of checked) {
            await db.restoreQuote(id);
        }
        renderTrashView();
        updateTrashBadge();
        updateDashboard(); // Stats might change
        alert(`${checked.length} preventivi ripristinati.`);
    } catch (e) {
        console.error("Bulk Restore Error:", e);
        alert("Errore durante il ripristino multiplo: " + window.localizeError(e));
    }
}

window.permanentDeleteSelectedTrashQuotes = async function () {
    const checked = Array.from(document.querySelectorAll('.trash-check:checked')).map(c => c.value);
    if (checked.length === 0) return;

    if (!confirm(`ATTENZIONE: Stai per eliminare DEFINITIVAMENTE ${checked.length} preventivi.\n\nNon potranno essere recuperati.\n\nProcedere?`)) return;
    if (!confirm(`Ultima conferma: Confermi l'eliminazione definitiva di ${checked.length} elementi?`)) return;

    try {
        for (const id of checked) {
            await db.permanentDeleteQuote(id);
        }
        renderTrashView();
        updateTrashBadge();
        updateDashboard();
        alert(`${checked.length} preventivi eliminati definitivamente.`);
    } catch (e) {
        console.error("Bulk PermDelete Error:", e);
        alert("Errore durante l'eliminazione multipla: " + window.localizeError(e));
    }
}

window.confirmRestore = async function (id) {
    if (!confirm('Vuoi ripristinare questo preventivo?')) return;

    try {
        await db.restoreQuote(id);
        alert('Preventivo ripristinato con successo!');
        renderTrashView();
        updateTrashBadge();
    } catch (e) {
        console.error('Restore error:', e);
        alert('Errore durante il ripristino: ' + window.localizeError(e));
    }
}

window.confirmPermanentDelete = async function (id) {
    if (!confirm('⚠️ ATTENZIONE: Questa azione eliminerà DEFINITIVAMENTE il preventivo.\n\nNon sarà più possibile recuperarlo.\n\nSei sicuro?')) return;

    // Double confirmation for permanent delete
    if (!confirm('ULTIMA CONFERMA: Vuoi eliminare definitivamente questo preventivo?')) return;

    try {
        await db.permanentDeleteQuote(id);
        alert('Preventivo eliminato definitivamente.');
        renderTrashView();
        updateTrashBadge();
    } catch (e) {
        console.error('Permanent delete error:', e);
        alert('Errore durante l\'eliminazione: ' + window.localizeError(e));
    }
}

window.updateTrashBadge = function () {
    const badge = document.getElementById('trashBadge');
    if (!badge) return;

    const count = db.getDeletedQuotes().length;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}


// --- PARQUET SETTINGS MODAL LOGIC ---

window.openParquetSettings = function (index) {
    const item = currentQuote.items[index];
    if (!item) return;

    document.getElementById('pqItemIndex').value = index;

    const desc = (item.description || "").trim();
    const descLower = desc.toLowerCase();
    const isBattiscopa = window.isBattiscopa(item);

    // 1. Sfrido
    if (item.parquetWaste === undefined) {
        if (descLower.includes('spina')) {
            item.parquetWaste = 18;
        } else {
            item.parquetWaste = 10;
        }
    }
    document.getElementById('pqWaste').value = item.parquetWaste;

    const glueTypeSelect = document.getElementById('pqGlueType');
    const glueTypeLabel = document.getElementById('pqGlueTypeLabel');
    const coeffField = document.getElementById('pqGlueCoeff');
    const coeffContainer = coeffField ? (coeffField.closest('.form-group') || coeffField.parentElement) : null;
    const wasteMemo = document.getElementById('pqWasteMemo');
    const productCodeInput = document.getElementById('pqProductCode');

    if (isBattiscopa) {
        if (glueTypeLabel) glueTypeLabel.textContent = 'Tipo battiscopa';
        item.parquetGlueCoeff = 0;

        // Auto-resolve matching battiscopa
        const match = window.resolveBattiscopaMatch ? window.resolveBattiscopaMatch(item.description, item.parquetGlueType || item.code) : null;
        let selectedCode = (item.parquetGlueType && item.parquetGlueType !== 'COLBICULTP9132KCHKG010MAP' && item.parquetGlueType !== 'Colla 2k chiara')
            ? item.parquetGlueType
            : (match ? match.code : (item.code || '100BTSM'));

        if (!item.code && match && match.code && match.code !== item.description) {
            item.code = match.code;
        }
        item.parquetGlueType = selectedCode;

        if (glueTypeSelect) {
            glueTypeSelect.innerHTML = '';
            const addedCodes = new Set();

            // 1. Standard options from BATTISCOPA_MAP
            if (typeof BATTISCOPA_MAP !== 'undefined') {
                Object.keys(BATTISCOPA_MAP).forEach(key => {
                    const batt = BATTISCOPA_MAP[key];
                    if (!addedCodes.has(batt.code)) {
                        addedCodes.add(batt.code);
                        const opt = document.createElement('option');
                        opt.value = batt.code;
                        opt.textContent = batt.description;
                        glueTypeSelect.appendChild(opt);
                    }
                });
            }

            // 2. Options from Product Registry
            if (window.db && window.db.getProducts) {
                const dbProds = window.db.getProducts() || [];
                dbProds.forEach(p => {
                    const pDesc = (p.description || '').toLowerCase();
                    const pCode = p.code || '';
                    if (pCode && !addedCodes.has(pCode) && (pDesc.includes('battiscopa') || pCode.toLowerCase().startsWith('prbat') || pCode.toLowerCase().startsWith('bat'))) {
                        addedCodes.add(pCode);
                        const opt = document.createElement('option');
                        opt.value = pCode;
                        opt.textContent = p.description || pCode;
                        glueTypeSelect.appendChild(opt);
                    }
                });
            }

            // 3. Custom item option if not present
            if (selectedCode && !addedCodes.has(selectedCode)) {
                addedCodes.add(selectedCode);
                const opt = document.createElement('option');
                opt.value = selectedCode;
                opt.textContent = item.description || selectedCode;
                glueTypeSelect.appendChild(opt);
            }

            glueTypeSelect.value = selectedCode;
        }

        if (coeffContainer) coeffContainer.style.display = 'none';
        if (wasteMemo) wasteMemo.style.display = 'none';

    } else {
        // Parquet standard
        if (glueTypeLabel) glueTypeLabel.textContent = 'Tipo Colla';

        if (item.parquetGlueType === undefined || item.parquetGlueType === '' || (typeof BATTISCOPA_MAP !== 'undefined' && Object.values(BATTISCOPA_MAP).some(b => b.code === item.parquetGlueType))) {
            item.parquetGlueType = 'COLBICULTP9132KCHKG010MAP';
        }
        if (item.parquetGlueCoeff === undefined || item.parquetGlueCoeff === 0) {
            item.parquetGlueCoeff = 1.4;
        }

        const docAgentField = document.getElementById('docAgent');
        const agentName = docAgentField ? (docAgentField.value || "").toLowerCase() : "";
        if (agentName.includes('filippo') && agentName.includes('mondello')) {
            item.parquetGlueType = 'PRCOLTOVMSSTART';
            item.parquetGlueCoeff = 1.2;
        }

        if (glueTypeSelect) {
            glueTypeSelect.innerHTML = `
                <option value="COLBICULTP9132KCHKG010MAP">PRCOL ULTRABOND P913 2K CHIARA COLLANTE BICOMPONENTE</option>
                <option value="COLBICULTP9132KSCKG010MAP">PRCOL ULTRABOND P913 2K SCURA COLLANTE BICOMPONENTE</option>
                <option value="86">TOVCOL TP5 COLLA VINILICA PER POSA FLOTTANTE 500 ML</option>
                <option value="PRCOLTOVMSSTART">PRCOL TOVCOL COLLA MONOCOMPONENTE MS START SCATOLA+SACCHETTI 15 KG 7,5X2</option>
            `;
            glueTypeSelect.value = item.parquetGlueType;
        }

        if (coeffContainer) coeffContainer.style.display = 'block';
        if (wasteMemo) wasteMemo.style.display = 'block';
    }

    if (coeffField) {
        coeffField.value = item.parquetGlueCoeff !== undefined ? item.parquetGlueCoeff : (isBattiscopa ? 0 : 1.4);
    }

    const modal = document.getElementById('parquetSettingsModal');
    modal.classList.remove('hidden');
    modal.classList.add('active');
    modal.style.display = 'block';

    const descUpper = desc.toUpperCase();
    const hideGlue = descUpper.includes("LAMINATO") || descUpper.includes("GRIT") || descUpper.includes("SPC");

    if (glueTypeSelect && coeffField) {
        const glueContainer = glueTypeSelect.parentElement.classList.contains('form-group') ? glueTypeSelect.parentElement : glueTypeSelect.closest('.form-group');
        const coeffContainer2 = coeffField.parentElement.classList.contains('form-group') ? coeffField.parentElement : coeffField.closest('.form-group');
        const codeContainer = productCodeInput ? (productCodeInput.parentElement.classList.contains('form-group') ? productCodeInput.parentElement : productCodeInput.closest('.form-group')) : null;

        if (glueContainer) glueContainer.style.display = hideGlue ? 'none' : 'block';
        if (coeffContainer2) coeffContainer2.style.display = (hideGlue || isBattiscopa) ? 'none' : 'block';
        if (codeContainer) codeContainer.style.display = hideGlue ? 'none' : 'block';
    }

    updateParquetModalUI();
};

window.updateParquetModalUI = function () {
    const glueSelect = document.getElementById('pqGlueType');
    const selectedVal = glueSelect ? (glueSelect.value || '').trim() : '';
    const productCodeField = document.getElementById('pqProductCode');
    const coeffField = document.getElementById('pqGlueCoeff');

    if (productCodeField) {
        let realCode = '';
        
        // Check if selectedVal is a standard Glue code
        const standardGlues = ['COLBICULTP9132KCHKG010MAP', 'COLBICULTP9132KSCKG010MAP', '86', 'PRCOLTOVMSSTART'];
        if (standardGlues.includes(selectedVal)) {
            realCode = selectedVal;
        } else if (typeof BATTISCOPA_MAP !== 'undefined' && Object.values(BATTISCOPA_MAP).some(b => b.code === selectedVal)) {
            // Standard battiscopa code from map (e.g. 97BTSM, 100BTSM)
            realCode = selectedVal;
        } else if (window.db && window.db.getProducts && window.db.getProducts().some(p => p.code === selectedVal)) {
            // Real product code from product catalog
            realCode = selectedVal;
        } else {
            // Not a recognized product code (custom description / unmapped) -> leave blank
            realCode = '';
        }

        productCodeField.value = realCode;
    }

    if (coeffField && selectedVal === 'PRCOLTOVMSSTART') {
        coeffField.value = '1.2';
    }
};

window.saveParquetSettings = function () {
    const index = parseInt(document.getElementById('pqItemIndex').value);
    const item = currentQuote.items[index];
    if (!item) return;

    const glueSelect = document.getElementById('pqGlueType');
    const glueTypeLabel = document.getElementById('pqGlueTypeLabel');
    const labelText = glueTypeLabel ? (glueTypeLabel.textContent || '').toLowerCase() : '';
    const desc = (item.description || '').toLowerCase();
    
    const isBattiscopa = labelText.includes('battiscopa') ||
        desc.includes('battiscopa') ||
        desc.startsWith('bat') ||
        (item.category && item.category.toLowerCase().includes('battiscopa')) ||
        (item.code && (item.code.toLowerCase().startsWith('bat') || item.code.toLowerCase().startsWith('prbat') || item.code.toLowerCase().endsWith('btsm'))) ||
        (typeof BATTISCOPA_MAP !== 'undefined' && Object.values(BATTISCOPA_MAP).some(b => b.code === glueSelect?.value));

    item.parquetWaste = parseFloat(document.getElementById('pqWaste').value) || 0;
    item.parquetGlueType = glueSelect ? glueSelect.value : '';
    item.parquetGlueCoeff = isBattiscopa ? 0 : (parseFloat(document.getElementById('pqGlueCoeff').value) || 0);

    if (isBattiscopa && item.parquetGlueType) {
        item.code = item.parquetGlueType;
        const selectedOption = glueSelect && glueSelect.options ? glueSelect.options[glueSelect.selectedIndex] : null;
        if (selectedOption && selectedOption.textContent) {
            item.description = selectedOption.textContent.trim();
        }
        item.isParquet = true;
    }

    // Auto-populate price if available
    if (item.parquetGlueType && window.db && window.db.getProducts) {
        const allProducts = window.db.getProducts() || [];
        const productMatch = allProducts.find(p => p.code === item.parquetGlueType || p.id === item.parquetGlueType);

        if (productMatch) {
            const price = parseFloat(productMatch.price) || parseFloat(productMatch.priceMax) || parseFloat(productMatch.priceMin) || 0;
            if (isBattiscopa) {
                if (!item.unitPrice || item.unitPrice === 0) {
                    item.unitPrice = price;
                    item.total = (item.quantity || 1) * item.unitPrice;
                }
            } else {
                item.parquetGluePrice = price;
            }
        }
    }

    closeModal('parquetSettingsModal');
    editorIsDirty = true;
    if (typeof renderDocItems === 'function') renderDocItems();
    if (typeof renderEditorState === 'function') renderEditorState();
};


// =====================================================
// INLINE ROW PRODUCT PICKER — Opzione A + B
// Autocomplete dropdown + Mini Modal
// =====================================================

// ---- Stato interno picker ----
let _rowPickerTimer = null;
let _rowPickerHighlight = -1;
let _rowPickerItems = [];

// Debounce sull'input del textarea: avvia ricerca dopo 220ms
window._rowPickerDebounce = function(index, query) {
    clearTimeout(_rowPickerTimer);
    const q = (query || '').trim();
    if (q.length < 1) {
        _hideRowAutocomplete(index);
        return;
    }
    _rowPickerTimer = setTimeout(() => {
        _showRowAutocomplete(index, q);
    }, 120);
};


// =====================================================
// BATTISCOPA SU ORDINAZIONE — Helper & Preview
// =====================================================

window._updateBattiscopaPreview = function(index) {
    const modEl = document.getElementById('rac_mod_' + index);
    const modCustomEl = document.getElementById('rac_mod_custom_' + index);
    const modCustomWrap = document.getElementById('rac_mod_custom_wrap_' + index);

    const fmtEl = document.getElementById('rac_fmt_' + index);

    const colEl = document.getElementById('rac_col_' + index);
    const ralEl = document.getElementById('rac_ral_' + index);
    const colCustomEl = document.getElementById('rac_col_custom_' + index);
    const colCustomWrap = document.getElementById('rac_col_custom_wrap_' + index);

    const prevEl = document.getElementById('rac_prev_' + index);
    if (!prevEl) return '';

    // Modello
    let modStr = '';
    const isModCustom = modCustomWrap && modCustomWrap.style.display !== 'none';
    if (isModCustom) {
        modStr = modCustomEl ? modCustomEl.value.trim() : '';
    } else {
        modStr = modEl ? modEl.value : 'Becco Civetta';
        if (modStr === 'Altro') modStr = '';
    }

    // Formato
    let fmt = fmtEl ? fmtEl.value.trim() : '';

    // Colore
    let colStr = '';
    const isColCustom = colCustomWrap && colCustomWrap.style.display !== 'none';
    if (isColCustom) {
        colStr = colCustomEl ? colCustomEl.value.trim() : '';
    } else {
        let colVal = colEl ? colEl.value : 'RAL';
        if (colVal === 'RAL') {
            let ralVal = ralEl ? ralEl.value.trim() : '';
            colStr = ralVal ? ('RAL ' + ralVal) : 'RAL';
        } else if (colVal === 'Altro') {
            colStr = '';
        } else {
            colStr = colVal;
        }
    }

    const parts = ['Battiscopa'];
    if (modStr) parts.push(modStr);
    if (fmt) parts.push(fmt);
    if (colStr) parts.push(colStr);

    const desc = parts.join(' ');
    prevEl.textContent = 'Anteprima: ' + desc;
    return desc;
};

window._onBattiscopaModChange = function(index) {
    const modEl = document.getElementById('rac_mod_' + index);
    const modCustomWrap = document.getElementById('rac_mod_custom_wrap_' + index);
    const modCustomEl = document.getElementById('rac_mod_custom_' + index);
    if (!modEl || !modCustomWrap) return;

    if (modEl.value === 'Altro') {
        modEl.style.display = 'none';
        modCustomWrap.style.display = 'block';
        if (modCustomEl) {
            modCustomEl.value = '';
            modCustomEl.focus();
        }
    } else {
        modEl.style.display = 'block';
        modCustomWrap.style.display = 'none';
    }
    window._updateBattiscopaPreview(index);
};

window._resetBattiscopaModSelect = function(index) {
    const modEl = document.getElementById('rac_mod_' + index);
    const modCustomWrap = document.getElementById('rac_mod_custom_wrap_' + index);
    const modCustomEl = document.getElementById('rac_mod_custom_' + index);
    if (!modEl || !modCustomWrap) return;

    modEl.style.display = 'block';
    modEl.value = 'Becco Civetta';
    modCustomWrap.style.display = 'none';
    if (modCustomEl) modCustomEl.value = '';
    window._updateBattiscopaPreview(index);
};

window._onBattiscopaColChange = function(index) {
    const colEl = document.getElementById('rac_col_' + index);
    const colPresetWrap = document.getElementById('rac_col_preset_wrap_' + index);
    const ralEl = document.getElementById('rac_ral_' + index);
    const colCustomWrap = document.getElementById('rac_col_custom_wrap_' + index);
    const colCustomEl = document.getElementById('rac_col_custom_' + index);
    if (!colEl) return;

    const val = colEl.value;
    if (val === 'Altro') {
        if (colPresetWrap) colPresetWrap.style.display = 'none';
        if (colCustomWrap) colCustomWrap.style.display = 'block';
        if (colCustomEl) {
            colCustomEl.value = '';
            colCustomEl.focus();
        }
    } else {
        if (colPresetWrap) colPresetWrap.style.display = 'flex';
        if (colCustomWrap) colCustomWrap.style.display = 'none';
        if (val === 'RAL') {
            if (ralEl) {
                ralEl.style.display = 'inline-block';
                ralEl.placeholder = 'N° es. 9010';
                if (!ralEl.value) ralEl.value = '9010';
            }
        } else {
            if (ralEl) ralEl.style.display = 'none';
        }
    }
    window._updateBattiscopaPreview(index);
};

window._resetBattiscopaColSelect = function(index) {
    const colEl = document.getElementById('rac_col_' + index);
    const colPresetWrap = document.getElementById('rac_col_preset_wrap_' + index);
    const ralEl = document.getElementById('rac_ral_' + index);
    const colCustomWrap = document.getElementById('rac_col_custom_wrap_' + index);
    const colCustomEl = document.getElementById('rac_col_custom_' + index);

    if (colPresetWrap) colPresetWrap.style.display = 'flex';
    if (colCustomWrap) colCustomWrap.style.display = 'none';
    if (colEl) colEl.value = 'RAL';
    if (ralEl) {
        ralEl.style.display = 'inline-block';
        ralEl.value = '9010';
    }
    if (colCustomEl) colCustomEl.value = '';
    window._updateBattiscopaPreview(index);
};

window._insertCustomBattiscopa = function(index) {
    const desc = window._updateBattiscopaPreview(index) || 'Battiscopa su ordinazione';
    _hideRowAutocomplete(index);

    const descInput = document.getElementById('desc_input_' + index);
    if (descInput) {
        descInput.onchange = null;
        descInput.value = desc;
    }

    if (!currentQuote || !currentQuote.items) return;
    const item = currentQuote.items[index];
    if (!item) return;

    item.description = desc;
    
    // Auto-resolve battiscopa code
    const matched = window.resolveBattiscopaMatch ? window.resolveBattiscopaMatch(desc) : null;
    item.code = (matched && matched.code && matched.code !== desc) ? matched.code : '';
    item.parquetGlueType = (matched && matched.code) ? matched.code : (item.code || desc);
    item.uom = 'ML';
    item.isParquet = true; // Spunta Giobby attiva di default
    item.parquetWaste = 10;
    item.parquetGlueCoeff = 0; // Battiscopa non usa coefficiente colla
    item.isMaterialPrice = false;
    if (!item.quantity || item.quantity <= 0) item.quantity = 1;

    // Lookup price if available
    if (item.parquetGlueType && window.db && window.db.getProducts) {
        const prod = window.db.getProducts().find(p => p.code === item.parquetGlueType);
        if (prod) {
            const price = parseFloat(prod.price) || parseFloat(prod.priceMax) || parseFloat(prod.priceMin) || 0;
            if (price > 0 && (!item.unitPrice || item.unitPrice === 0)) {
                item.unitPrice = price;
            }
        }
    }

    item.total = item.quantity * (item.unitPrice || 0);

    editorIsDirty = true;
    if (typeof renderDocItems === 'function') renderDocItems();
    if (typeof renderEditorState === 'function') renderEditorState();

    setTimeout(() => {
        const priceInput = document.getElementById('price_input_' + index);
        if (priceInput) {
            priceInput.focus();
            priceInput.select();
        }
    }, 100);
};

// Controllo ed eliminazione automatica delle righe vuote
window._checkAndRemoveEmptyRow = function(index) {
    if (!currentQuote || !currentQuote.items || !currentQuote.items[index]) return;
    
    // Se c'è un modal aperto o stiamo aprendo la scheda prodotto, non rimuovere
    if (window._isModalPickerOpen || (window._lastEditedProductRowIndex !== undefined && window._lastEditedProductRowIndex !== null)) {
        return;
    }

    const item = currentQuote.items[index];
    const desc = (item.description || '').trim();
    const code = (item.code || '').trim();
    const inputEl = document.getElementById('desc_input_' + index) || document.getElementById('freetext_input_' + index);
    const inputVal = inputEl ? inputEl.value.trim() : '';

    // Considera la riga vuota se non ha testo né codice prodotto
    if (!desc && !code && !inputVal) {
        if (typeof removeDocItem === 'function') {
            removeDocItem(index);
        } else {
            currentQuote.items.splice(index, 1);
            if (typeof renderEditorState === 'function') renderEditorState();
        }
    }
};

// Chiudi dropdown autocomplete quando si clicca altrove
if (!window._acGlobalClickListenerAttached) {
    window._acGlobalClickListenerAttached = true;
    const handleOutsideAcClick = (e) => {
        // Se il click è dentro un dropdown autocomplete o un suo elemento/builder, NON chiudere
        if (e.target.closest('.row-autocomplete-dropdown') || 
            e.target.closest('.btn-row-picker') || 
            e.target.closest('.rac-battiscopa-builder')) {
            return;
        }

        const allDropdowns = document.querySelectorAll('.row-autocomplete-dropdown');
        allDropdowns.forEach(dropdown => {
            if (dropdown.style.display !== 'none') {
                const index = dropdown.id.replace('row-ac-', '');
                const input = document.getElementById('desc_input_' + index);
                if (e.target !== input) {
                    _hideRowAutocomplete(index);
                    _checkAndRemoveEmptyRow(index);
                }
            }
        });
    };
    document.addEventListener('pointerdown', handleOutsideAcClick);
    document.addEventListener('mousedown', handleOutsideAcClick);
}

window._freeTextBlurCheck = function(index) {
    setTimeout(() => {
        _checkAndRemoveEmptyRow(index);
    }, 280);
};

// Navigazione con frecce e Enter nel dropdown autocomplete
window._rowPickerKeyNav = function(e, index) {
    const dropdown = document.getElementById('row-ac-' + index);
    if (!dropdown || dropdown.style.display === 'none') return;
    const items = dropdown.querySelectorAll('.row-autocomplete-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        _rowPickerHighlight = Math.min(_rowPickerHighlight + 1, items.length - 1);
        items.forEach((el, i) => el.classList.toggle('highlighted', i === _rowPickerHighlight));
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _rowPickerHighlight = Math.max(_rowPickerHighlight - 1, 0);
        items.forEach((el, i) => el.classList.toggle('highlighted', i === _rowPickerHighlight));
    } else if (e.key === 'Enter' && _rowPickerHighlight >= 0) {
        e.preventDefault();
        const highlighted = items[_rowPickerHighlight];
        if (highlighted) highlighted.click();
    } else if (e.key === 'Escape') {
        _hideRowAutocomplete(index);
    }
};

// Mostra il dropdown autocomplete
function _showRowAutocomplete(index, query) {
    const dropdown = document.getElementById('row-ac-' + index);
    if (!dropdown) return;

    const products = (window.db && window.db.getProducts) ? window.db.getProducts() : [];
    const q = query.toLowerCase();
    const useMat = document.getElementById('checkUseMaterialPrice')?.checked;

    _rowPickerHighlight = -1;
    _rowPickerItems = products.filter(p => {
        const desc = (p.description || '').toLowerCase();
        const code = (p.code || '').toLowerCase();
        return desc.includes(q) || code.includes(q);
    }).slice(0, 12); // max 12 risultati

    const isBattQuery = q.includes('bat') || q.includes('batt') || q.includes('battiscopa');
    
    let battiscopaBuilderHtml = '';
    if (isBattQuery) {
                                                        battiscopaBuilderHtml = `
        <div class="rac-battiscopa-builder" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">
            <div class="rac-bb-header">
                <span class="rac-bb-title"><i class="fa-solid fa-layer-group"></i> Battiscopa su ordinazione</span>
                <span class="rac-bb-badge">Da ordinare</span>
            </div>
            <div class="rac-bb-grid">
                <div class="rac-bb-field">
                    <label>Formato</label>
                    <input type="text" id="rac_fmt_${index}" class="rac-bb-input" placeholder="es. 70x10"  oninput="_updateBattiscopaPreview(${index})" value="" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">
                </div>
                <div class="rac-bb-field">
                    <label>Modello</label>
                    <select id="rac_mod_${index}" class="rac-bb-select" onchange="_onBattiscopaModChange(${index})" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">
                        <option value="Becco Civetta" selected>Becco Civetta</option>
                        <option value="Squadrato">Squadrato</option>
                        <option value="Grezzo">Grezzo</option>
                        <option value="Altro">Altro (digita a mano)...</option>
                    </select>
                    <div id="rac_mod_custom_wrap_${index}" style="display:none; position:relative; width:100%;">
                        <input type="text" id="rac_mod_custom_${index}" class="rac-bb-input" placeholder="Digita modello (es. Onda)" style="padding-right:26px; width:100%;" oninput="_updateBattiscopaPreview(${index})" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">
                        <button type="button" class="rac-reset-select-btn" onclick="_resetBattiscopaModSelect(${index})" title="Torna alla lista modelli" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();"><i class="fa-solid fa-list"></i></button>
                    </div>
                </div>
                <div class="rac-bb-field">
                    <label>Colore / Finitura</label>
                    <div id="rac_col_preset_wrap_${index}" style="display:flex; gap:4px; width:100%;">
                        <select id="rac_col_${index}" class="rac-bb-select" style="flex:1;" onchange="_onBattiscopaColChange(${index})" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">
                            <option value="RAL" selected>RAL...</option>
                            <option value="A Campione">A Campione</option>
                            <option value="Grezzo">Grezzo</option>
                            <option value="Altro">Altro (digita a mano)...</option>
                        </select>
                        <input type="text" id="rac_ral_${index}" class="rac-bb-input" placeholder="N° es. 9010" style="width:75px;" oninput="_updateBattiscopaPreview(${index})" value="9010" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">
                    </div>
                    <div id="rac_col_custom_wrap_${index}" style="display:none; position:relative; width:100%;">
                        <input type="text" id="rac_col_custom_${index}" class="rac-bb-input" placeholder="Digita colore/finitura a mano" style="padding-right:26px; width:100%;" oninput="_updateBattiscopaPreview(${index})" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">
                        <button type="button" class="rac-reset-select-btn" onclick="_resetBattiscopaColSelect(${index})" title="Torna alla lista finiture" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();"><i class="fa-solid fa-list"></i></button>
                    </div>
                </div>
            </div>
            <div class="rac-bb-footer">
                <div class="rac-bb-preview" id="rac_prev_${index}">Anteprima: Battiscopa Becco Civetta RAL 9010</div>
                <button type="button" class="rac-bb-btn" onmousedown="event.preventDefault(); _insertCustomBattiscopa(${index})" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">
                    <i class="fa-solid fa-plus"></i> Inserisci
                </button>
            </div>
        </div>
        `;
    }

    let itemsHtml = '';
    if (_rowPickerItems.length > 0) {
        if (isBattQuery) {
            itemsHtml += `<div class="rac-section-divider"><i class="fa-solid fa-boxes-stacked"></i> A Magazzino (Disponibili a listino)</div>`;
        }
        itemsHtml += _rowPickerItems.map((p, i) => {
            const price = window.getProductEffectivePrice(p, useMat);
            const priceStr = price > 0 ? `${price.toFixed(2)} €` : '—';
            const descDisplay = p.description ? p.description.charAt(0).toUpperCase() + p.description.slice(1).toLowerCase() : '';
            return `<div class="row-autocomplete-item" onmousedown="event.preventDefault(); pickProductForRow(${index}, '${p.id}')">
                <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                    <span class="rac-desc">${descDisplay}</span>
                    ${p.code ? `<span class="rac-code">${p.code}</span>` : ''}
                </div>
                <div class="rac-actions">
                    <span class="rac-price">${priceStr}</span>
                    <button type="button" class="rac-edit-btn" title="Apri scheda prodotto ${p.code || ''}" onmousedown="event.stopPropagation(); event.preventDefault(); window._openProductCardFromAutocomplete(${index}, '${p.id}')">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </button>
                </div>
            </div>`;
        }).join('');
    } else if (!isBattQuery) {
        itemsHtml = `<div class="row-autocomplete-empty">Nessun prodotto trovato per "${query}"</div>`;
    }

    dropdown.innerHTML = itemsHtml + battiscopaBuilderHtml;
    dropdown.style.display = 'block';
    if (isBattQuery) {
        setTimeout(() => window._updateBattiscopaPreview(index), 10);
    }
}


window._openProductCardFromAutocomplete = function(rowIndex, productId) {
    _hideRowAutocomplete(rowIndex);
    window._lastEditedProductRowIndex = rowIndex;
    if (typeof openProductModal === 'function') {
        openProductModal(productId);
    }
};

// Nasconde il dropdown
function _hideRowAutocomplete(index) {
    const dropdown = document.getElementById('row-ac-' + index);
    if (dropdown) dropdown.style.display = 'none';
    _rowPickerHighlight = -1;
}

// Popola la riga con i dati del prodotto scelto
window.pickProductForRow = function(index, productId) {
    const products = (window.db && window.db.getProducts) ? window.db.getProducts() : [];
    const p = products.find(x => String(x.id) === String(productId) || (x.code && x.code === productId));
    if (!p || !currentQuote || !currentQuote.items) return;

    const useMat = document.getElementById('checkUseMaterialPrice')?.checked;
    const isMat = useMat && p.var3 && parseFloat(p.var3) > 0;
    const price  = window.getProductEffectivePrice(p, isMat);
    const classeUp = (p.classe || '').toUpperCase().trim();
    const autoParquet = !isMat && ['A', 'B', 'LAM', 'SPC'].includes(classeUp);
    const effectivePriceMax = parseFloat(p.priceMax) || window.getProductDefaultPrice(p);

    // Disable pending onchange on the textarea before updating item
    const descInput = document.getElementById('desc_input_' + index);
    if (descInput) {
        descInput.onchange = null;
        descInput.value = p.description || '';
    }

    // Aggiorna l'item in memoria
    const item = currentQuote.items[index];
    if (!item) return;
    item.code         = p.code || '';
    item.description  = p.description || '';
    item.giobby_description   = p.giobby_description || '';
    item.uom          = p.uom || '';
    item.unitPrice    = price;
    item.priceMin     = parseFloat(p.priceMin) || 0;
    item.priceMax     = effectivePriceMax;
    item.var1         = p.var1 || '';
    item.var2         = p.var2 || '';
    item.var3         = p.var3 || '';
    item.classe       = p.classe || '';
    item.isMaterialPrice = !isMat;
    item.isParquet    = item.isParquet || autoParquet;
    item.total        = (item.quantity || 1) * price;

    editorIsDirty = true;

    // Chiudi autocomplete o modal e re-renderizza
    _hideRowAutocomplete(index);
    closeRowPickerModal();
    if (typeof renderDocItems === 'function') renderDocItems();
    if (typeof renderEditorState === 'function') renderEditorState();

    // CHECK SPC: proponi aggiunta sottopavimento nylon
    const _isSpc = classeUp === 'SPC' || (p.description || '').toUpperCase().includes('SPC');
    if (_isSpc) {
        setTimeout(() => {
            if (confirm(`Hai inserito: ${p.description}.\nVuoi aggiungere anche il SOTTOPAVIMENTO IN NYLON?`)) {
                const _nylonCode = 'SOTBARVAPMY100H50ML100NEX';
                const _allProds = db.getProducts();
                const _nylonProd = _allProds.find(x => x.code === _nylonCode);
                if (_nylonProd) {
                    const _sqm = item.quantity || 1;
                    const _nylonPrice = window.getProductEffectivePrice(_nylonProd, false);
                    currentQuote.items.splice(index + 1, 0, {
                        type: 'product',
                        code: _nylonProd.code,
                        description: _nylonProd.description,
                        uom: _nylonProd.uom || 'mq',
                        quantity: _sqm,
                        unitPrice: _nylonPrice,
                        priceMin: parseFloat(_nylonProd.priceMin) || 0,
                        priceMax: parseFloat(_nylonProd.priceMax) || _nylonPrice,
                        total: _sqm * _nylonPrice,
                        isParquet: false,
                        includeInStats: true
                    });
                    editorIsDirty = true;
                    if (typeof renderDocItems === 'function') renderDocItems();
                    if (typeof renderEditorState === 'function') renderEditorState();
                } else {
                    alert('Prodotto nylon non trovato nel registro (cod: ' + _nylonCode + ')');
                }
            }
        }, 600);
    }

    // Focus sull'input quantità della riga appena valorizzata
    setTimeout(() => {
        const qtyEl = document.getElementById('qty_input_' + index);
        if (qtyEl) qtyEl.focus();
    }, 80);
};

// ---- OPZIONE B: Mini Modal ----

window.openRowPickerModal = function(index) {
    window._isModalPickerOpen = true;
    window._activePickerRowIndex = index;
    // Rimuovi eventuali modal precedenti
    closeRowPickerModal();

    // Testo già presente nel textarea come ricerca iniziale
    const textarea = document.getElementById('desc_input_' + index);
    const initialQuery = textarea ? textarea.value.trim() : '';

    // Opzioni categoria
    const products = (window.db && window.db.getProducts) ? window.db.getProducts() : [];
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
    const catOptions = ['<option value="">Tutte le categorie</option>']
        .concat(cats.map(c => `<option value="${c}">${c}</option>`))
        .join('');

    const overlay = document.createElement('div');
    overlay.id = 'rowPickerOverlay';
    overlay.innerHTML = `
        <div class="row-picker-modal" onclick="event.stopPropagation()">
            <div class="row-picker-header">
                <i class="fa-solid fa-search" style="color:#94a3b8; flex-shrink:0;"></i>
                <input type="text" id="rowPickerSearch" placeholder="Cerca prodotto..." value="${initialQuery.replace(/"/g, '&quot;')}" autocomplete="off">
                <select id="rowPickerCat">${catOptions}</select>
                <button class="btn-close-picker" onclick="closeRowPickerModal()" title="Chiudi"><i class="fa-solid fa-times"></i></button>
            </div>
            <div class="row-picker-list" id="rowPickerList"></div>
            <div class="row-picker-footer">
                <i class="fa-solid fa-keyboard"></i> Clicca un prodotto per inserirlo nella riga ${index + 1}
            </div>
        </div>`;

    // Chiudi cliccando fuori
    overlay.addEventListener('click', closeRowPickerModal);

    // Tasto Escape
    overlay._escHandler = (e) => { if (e.key === 'Escape') closeRowPickerModal(); };
    document.addEventListener('keydown', overlay._escHandler);

    document.body.appendChild(overlay);

    // Rende la lista
    _renderRowPickerList(index, initialQuery, '');

    // Focus + live search
    const searchEl = document.getElementById('rowPickerSearch');
    const catEl    = document.getElementById('rowPickerCat');
    if (searchEl) {
        searchEl.focus();
        searchEl.select();
        searchEl.addEventListener('input', () => _renderRowPickerList(index, searchEl.value, catEl.value));
    }
    if (catEl) {
        catEl.addEventListener('change', () => _renderRowPickerList(index, searchEl.value, catEl.value));
    }
};

function _renderRowPickerList(index, query, catFilter) {
    const listEl = document.getElementById('rowPickerList');
    if (!listEl) return;

    const products = (window.db && window.db.getProducts) ? window.db.getProducts() : [];
    const q = (query || '').toLowerCase().trim();
    const useMat = document.getElementById('checkUseMaterialPrice')?.checked;

    let filtered = products;
    if (catFilter) filtered = filtered.filter(p => p.category === catFilter);
    if (q.length >= 1) {
        filtered = filtered.filter(p => {
            const desc = (p.description || '').toLowerCase();
            const code = (p.code || '').toLowerCase();
            return desc.includes(q) || code.includes(q);
        });
    }
    filtered = filtered.slice(0, 60); // max 60 risultati

    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="row-picker-empty"><i class="fa-solid fa-box-open"></i><br>Nessun prodotto trovato</div>';
        return;
    }

    listEl.innerHTML = filtered.map(p => {
        const price = window.getProductEffectivePrice(p, useMat);
        const priceStr = price > 0 ? `${price.toFixed(2)} €` : '—';
        const descDisplay = p.description ? p.description.charAt(0).toUpperCase() + p.description.slice(1).toLowerCase() : '';
        const meta = [p.code, p.category, p.uom].filter(Boolean).join(' · ');
        return `<div class="row-picker-item" onclick="pickProductForRow(${index}, '${p.id}')">
            <div>
                <div class="rpi-desc">${descDisplay}</div>
                ${meta ? `<div class="rpi-meta">${meta}</div>` : ''}
            </div>
            <span class="rpi-price">${priceStr}</span>
        </div>`;
    }).join('');
}

// === AUTO-UPDATER UI LOGIC ===
let _pendingUpdateData = null;

window.checkAppUpdatesOnStartup = async function () {
    try {
        if (!window.db || typeof window.db.checkForUpdates !== 'function') return;
        const updateInfo = await window.db.checkForUpdates();
        if (updateInfo && updateInfo.updateAvailable) {
            _pendingUpdateData = updateInfo;
            window.showUpdateModal(updateInfo);
        }
    } catch (e) {
        console.warn('[AutoUpdater] Startup check error:', e);
    }
};

window.showUpdateModal = function (info) {
    const modal = document.getElementById('updateModal');
    if (!modal) return;

    const titleEl = document.getElementById('updateModalTitle');
    const badgeEl = document.getElementById('updateModalBadge');
    const changelogEl = document.getElementById('updateModalChangelog');

    if (titleEl) titleEl.textContent = info.title || 'Nuovo Aggiornamento Disponibile!';
    if (badgeEl) badgeEl.textContent = 'v' + (info.version || '1.0.1');

    if (changelogEl) {
        changelogEl.innerHTML = '';
        const list = Array.isArray(info.changelog) ? info.changelog : (info.changelog || '').split('\n').filter(Boolean);
        if (list.length === 0) {
            changelogEl.innerHTML = '<li>Miglioramenti generali delle prestazioni e risoluzione bug.</li>';
        } else {
            list.forEach(item => {
                changelogEl.innerHTML += `<li>${item.replace(/^[•\-\*]\s*/, '')}</li>`;
            });
        }
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
};

window.closeUpdateModal = function (snooze = true) {
    const modal = document.getElementById('updateModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.setProperty('display', 'none', 'important');
    }
    if (snooze) {
        const until = Date.now() + (24 * 60 * 60 * 1000);
        localStorage.setItem('genesy_update_snoozed_until', String(until));
    }
};

window.triggerAutoUpdateDownload = function () {
    const btnStart = document.getElementById('btnStartAutoUpdate');
    const btnPostpone = document.getElementById('btnPostponeUpdate');
    const progressBox = document.getElementById('updateProgressBox');
    const progressBar = document.getElementById('updateProgressBar');
    const progressPct = document.getElementById('updateProgressPct');
    const progressText = document.getElementById('updateProgressText');

    if (btnStart) btnStart.style.display = 'none';
    if (progressBox) progressBox.style.display = 'block';

    const downloadUrl = (_pendingUpdateData && _pendingUpdateData.downloadUrl) || 'Genesy_Desktop_Setup.exe';
    const newVersion = (_pendingUpdateData && _pendingUpdateData.version) || 'latest';

    if (window.electronAPI && typeof window.electronAPI.downloadAndInstallUpdate === 'function') {
        if (btnPostpone) btnPostpone.style.display = 'none';
        if (progressText) progressText.textContent = 'Download aggiornamento in corso...';
        if (progressBar) progressBar.style.width = '0%';
        if (progressPct) progressPct.textContent = '0%';

        window.electronAPI.onUpdateProgress((data) => {
            const pct = (data && data.pct) ? data.pct : 0;
            if (progressBar) progressBar.style.width = pct + '%';
            if (progressPct) progressPct.textContent = pct + '%';
            if (progressText) progressText.textContent = 'Download in corso... (' + pct + '%)';
        });

        window.electronAPI.onUpdateComplete(() => {
            if (progressBar) progressBar.style.width = '100%';
            if (progressPct) progressPct.textContent = '100%';
            if (progressText) progressText.textContent = 'Download completato! Avvio installatore in corso...';
            localStorage.removeItem('genesy_update_snoozed_until');
        });

        window.electronAPI.onUpdateError((err) => {
            if (progressText) progressText.textContent = 'Errore durante il download: ' + (err.error || 'Riprova più tardi');
            if (progressBar) progressBar.style.background = '#ef4444';
            if (btnPostpone) {
                btnPostpone.textContent = 'Chiudi';
                btnPostpone.style.display = 'inline-block';
            }
        });

        window.electronAPI.downloadAndInstallUpdate({
            url: downloadUrl,
            version: newVersion
        });
    } else {
        // Modalità Web / Browser: Scarica direttamente il file installer nel browser
        if (progressBar) {
            progressBar.style.width = '100%';
            progressBar.style.background = 'linear-gradient(90deg, #16a34a, #22c55e)';
        }
        if (progressPct) progressPct.textContent = '100%';
        if (progressText) {
            progressText.innerHTML = '<span style="color:#16a34a; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Download avviato nel browser!</span><br><span style="font-size:0.85rem; color:#475569; margin-top:4px; display:inline-block;">Apri il file <strong>Genesy_Desktop_Setup.exe</strong> scaricato per installare la versione v' + newVersion + '.</span>';
        }

        // Trigger effettivo del download file nel browser
        const dlLink = document.createElement('a');
        dlLink.href = downloadUrl;
        dlLink.setAttribute('download', 'Genesy_Desktop_Setup.exe');
        dlLink.target = '_blank';
        document.body.appendChild(dlLink);
        dlLink.click();
        dlLink.remove();

        // Snooze per evitare che riappaia subito dopo il click
        localStorage.setItem('genesy_update_snoozed_until', String(Date.now() + (24 * 60 * 60 * 1000)));

        if (btnPostpone) {
            btnPostpone.textContent = 'Chiudi';
            btnPostpone.style.display = 'inline-block';
        }
    }
};

// Check for updates when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const btnPostpone = document.getElementById('btnPostponeUpdate');
    if (btnPostpone) {
        btnPostpone.addEventListener('click', (e) => {
            if (e) e.stopPropagation();
            window.closeUpdateModal();
        });
    }
    setTimeout(() => {
        if (window.checkAppUpdatesOnStartup) {
            window.checkAppUpdatesOnStartup();
        }
    }, 2800);
});

window.closeRowPickerModal = function() {
    const overlay = document.getElementById('rowPickerOverlay');
    if (overlay) {
        if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler);
        overlay.remove();
    }
};
