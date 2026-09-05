/**
 * Giobby Product Sync - Import massivo codici prodotto da Giobby a Genesy
 * Permette di scaricare il catalogo prodotti da Giobby, abbinarli ai prodotti Genesy
 * e salvare il campo giobby_code su tutti i prodotti in un'unica operazione.
 */

// ===========================================================================
// FETCH PRODOTTI DA GIOBBY
// ===========================================================================

/**
 * Scarica tutti i prodotti dal catalogo Giobby
 * @param {Object} config - Configurazione Giobby
 * @returns {Promise<Array>} - Lista prodotti Giobby
 */
async function fetchAllGiobbyProducts(config) {
    const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
    const PAGE_SIZE = 500;
    const MAX_PAGES = 20;
    let allProducts = [];

    // Endpoints da provare in ordine
    const endpoints = ['products', 'registry/products', 'items', 'materials'];

    for (const ep of endpoints) {
        let found = false;
        for (let page = 0; page < MAX_PAGES; page++) {
            const offset = page * PAGE_SIZE;
            let rawUrl = `${baseUrl}${ep}?limit=${PAGE_SIZE}&offset=${offset}`;
            let url = config.useProxy
                ? `/.netlify/functions/giobby-proxy?url=${encodeURIComponent(rawUrl)}`
                : rawUrl;

            try {
                const res = await fetch(url, {
                    headers: getGiobbyHeaders(config.accessToken)
                });

                if (!res.ok) {
                    if (page === 0) break; // Endpoint non trovato, prova il prossimo
                    break; // Fine dei dati
                }

                const data = await res.json();
                let items = Array.isArray(data) ? data
                    : (data.products || data.items || data.materials || data.objects || []);

                if (items.length === 0) break;
                
                // FILTRA PRODOTTI CANCELLATI O DISATTIVATI SU GIOBBY
                // La struttura reale restituita da Giobby usa 'salesEnabled' (bool) e 'locked' (bool)
                items = items.filter(p => {
                    if (p.salesEnabled === false) return false;   // Prodotto disabilitato alle vendite
                    if (p.locked === true) return false;          // Prodotto bloccato
                    return true;
                });

                allProducts = allProducts.concat(items);
                found = true;

                console.log(`📦 [Giobby Products] ${ep} offset=${offset}: ${items.length} prodotti attivi scaricati`);

                if (items.length < PAGE_SIZE) break; // Ultima pagina
            } catch (e) {
                console.warn(`⚠️ [Giobby Products] Endpoint ${ep} fallito:`, e.message);
                break;
            }
        }

        if (found) {
            console.log(`✅ [Giobby Products] Totale da "${ep}": ${allProducts.length} prodotti`);
            break;
        }
    }

    return allProducts;
}

/**
 * Normalizza un prodotto Giobby all'interfaccia standard
 * Prova molti nomi di campo per compatibilità con versioni diverse di Giobby
 */
function normalizeGiobbyProduct(p) {
    const code =
        p.itemNum     || p.ItemNum     ||
        p.code        || p.Code        ||
        p.productCode || p.ProductCode ||
        p.itemCode    || p.ItemCode    ||
        p.materialCode|| p.MaterialCode||
        p.codice      || p.Codice      ||
        p.sku         || p.SKU         ||
        p.articleCode || p.ArticleCode ||
        p.artCode     || p.ArtCode     ||
        p.codArticolo || p.CodArticolo ||
        p.codice_articolo ||
        p.ref         || p.Ref         ||
        p.reference   ||
        p.partNumber  || p.PartNumber  ||
        p.part_number ||
        p.barcode     ||
        p.externalCode|| p.ExternalCode||
        p.basicCode   || p.BasicCode   ||  // Giobby usa 'basicCode' come codice base
        p.id          ||  // Giobby usa 'id' come codice prodotto
        '';
    const description =
        p.description || p.Description ||
        p.name        || p.Name        ||
        p.productName || p.ProductName ||
        p.descrizione || p.Descrizione ||
        p.label       || p.Label       ||
        p.title       ||
        '';
    const category =
        p.category    || p.Category    ||
        p.categoryName|| p.CategoryName||
        p.idCategory  ||
        p.materialGroupDesc || p.MaterialGroupDesc || // Giobby usa 'materialGroupDesc'
        p.categoria   || p.Categoria   ||
        p.famiglia    || p.Famiglia    ||
        p.gruppo      || p.Gruppo      ||
        p.type        || p.Type        ||
        '';
    return {
        id: p.id || p.Id || p.ID || p.idMaterial || p.idProduct || p.idItem || '',
        code: String(code).trim(),
        description: String(description).trim(),
        uom: p.uom || p.unitOfMeasure || p.um || p.UM || p.unitaMisura || '',
        category: String(category).trim()
    };
}

// ===========================================================================
// ABBINAMENTO AUTOMATICO
// ===========================================================================

/**
 * Rimuove spazi e caratteri speciali per un match più "aggressivo" ma sicuro
 */
function normalizeForSoftMatch(str) {
    if (!str) return '';
    return String(str).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Tenta di abbinare automaticamente prodotti Giobby con prodotti Genesy
 * Strategia: 1) corrispondenza esatta, 2) giobby_code salvato, 3) soft match (senza spazi/simboli), 4) descrizione
 * @returns {Array} - Array di { genesyProduct, giobbyProduct, matchType }
 */
function autoMatchProducts(genesyProducts, giobbyProducts) {
    const results = [];
    const giobbyByCode = new Map();
    const giobbyBySoftCode = new Map();
    const giobbyByDesc = new Map();

    // Indicizza i prodotti Giobby
    giobbyProducts.forEach(gp => {
        if (gp.code) {
            giobbyByCode.set(gp.code.trim().toUpperCase(), gp);
            giobbyBySoftCode.set(normalizeForSoftMatch(gp.code), gp);
        }
        if (gp.description) giobbyByDesc.set(gp.description.trim().toUpperCase(), gp);
    });

    genesyProducts.forEach(gp => {
        const genesyCode = (gp.code || '').trim().toUpperCase();
        const genesySoftCode = normalizeForSoftMatch(gp.code);
        const genesyDesc = (gp.description || '').trim().toUpperCase();

        let matched = null;
        let matchType = 'none';

        // 1. Corrispondenza esatta per codice
        if (genesyCode && giobbyByCode.has(genesyCode)) {
            matched = giobbyByCode.get(genesyCode);
            matchType = 'code_exact';
        }

        // 2. Il codice Genesy è già salvato come giobby_code precedente
        if (!matched && gp.giobby_code) {
            const existingCode = gp.giobby_code.trim().toUpperCase();
            if (giobbyByCode.has(existingCode)) {
                matched = giobbyByCode.get(existingCode);
                matchType = 'giobby_code_saved';
            } else {
                const existingSoftCode = normalizeForSoftMatch(gp.giobby_code);
                if (giobbyBySoftCode.has(existingSoftCode)) {
                    matched = giobbyBySoftCode.get(existingSoftCode);
                    matchType = 'giobby_code_saved_soft';
                }
            }
        }

        // 3. Corrispondenza soft per codice (ignorando spazi e simboli divaricatori)
        if (!matched && genesySoftCode && giobbyBySoftCode.has(genesySoftCode)) {
            matched = giobbyBySoftCode.get(genesySoftCode);
            matchType = 'code_soft';
        }

        // 4. Corrispondenza per descrizione (solo se identica)
        if (!matched && genesyDesc && giobbyByDesc.has(genesyDesc)) {
            matched = giobbyByDesc.get(genesyDesc);
            matchType = 'desc_exact';
        }

        results.push({
            genesyProduct: gp,
            giobbyProduct: matched,
            matchType,
            selectedGiobbyCode: matched ? matched.code : (gp.giobby_code || '')
        });
    });

    return results;
}

// ===========================================================================
// SALVATAGGIO MASSIVO
// ===========================================================================

/**
 * Salva il giobby_code E la giobby_description su tutti i prodotti Genesy abbinati
 * @param {Array} mappings - Array di { genesyProduct, selectedGiobbyCode, giobbyProduct }
 * @returns {Promise<{ saved: number, errors: number }>}
 */
async function saveMassiveGiobbyCodes(mappings) {
    let saved = 0;
    let errors = 0;

    for (const m of mappings) {
        if (!m.genesyProduct) continue;

        const newCode = (m.selectedGiobbyCode || '').trim();
        const oldCode = m.genesyProduct.giobby_code || '';
        // Recupera la descrizione Giobby dal prodotto abbinato
        const newGiobbyDesc = m.giobbyProduct ? (m.giobbyProduct.description || '').trim() : '';
        const oldGiobbyDesc = m.genesyProduct.giobby_description || '';

        // Salta se non è cambiato nulla
        if (newCode === oldCode && newGiobbyDesc === oldGiobbyDesc) continue;

        try {
            const updatedProduct = {
                ...m.genesyProduct,
                giobby_code: newCode || null,
                giobby_description: newGiobbyDesc || null  // Salva anche la descrizione Giobby
            };
            await window.db.saveProduct(updatedProduct);
            m.genesyProduct.giobby_code = newCode || null;
            m.genesyProduct.giobby_description = newGiobbyDesc || null;
            saved++;
        } catch (e) {
            console.error(`❌ [Sync] Errore salvataggio ${m.genesyProduct.code}:`, e);
            errors++;
        }
    }

    return { saved, errors };
}

// ===========================================================================
// INTERFACCIA UTENTE - MODALE
// ===========================================================================

window.openGiobbyProductSyncModal = async function () {
    // Verifica configurazione Giobby
    const jsonConfig = localStorage.getItem('giobbyConfig');
    if (!jsonConfig) {
        alert('⚠️ Configura prima le credenziali Giobby in Impostazioni → Giobby.');
        return;
    }
    const config = JSON.parse(jsonConfig);

    // Rimuovi modale precedente se esiste
    const existing = document.getElementById('giobbyProductSyncModal');
    if (existing) existing.remove();

    // Crea modale
    const modal = document.createElement('div');
    modal.id = 'giobbyProductSyncModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
        z-index: 10000; font-family: 'Inter', sans-serif;
    `;

    modal.innerHTML = `
        <div style="background: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    width: 95vw; max-width: 1100px; max-height: 90vh; display: flex; flex-direction: column;
                    overflow: hidden;">

            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white;
                        padding: 20px 24px; display: flex; justify-content: space-between; align-items: center;
                        flex-shrink: 0;">
                <div>
                    <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700;">
                        🔄 Sincronizzazione Codici Prodotto Giobby
                    </h2>
                    <p style="margin: 4px 0 0; font-size: 0.85rem; opacity: 0.9;">
                        Scarica il catalogo da Giobby e abbina i codici ai prodotti Genesy
                    </p>
                </div>
                <button id="gpSyncClose" style="background: rgba(255,255,255,0.2); border: none; color: white;
                        width: 32px; height: 32px; border-radius: 50%; font-size: 1.1rem; cursor: pointer;
                        display: flex; align-items: center; justify-content: center;">✕</button>
            </div>

            <!-- Toolbar -->
            <div style="padding: 14px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc;
                        display: flex; gap: 10px; align-items: center; flex-wrap: wrap; flex-shrink: 0;">
                <button id="gpSyncFetch" style="background: #0ea5e9; color: white; border: none;
                        padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 0.875rem;
                        font-weight: 600; display: flex; align-items: center; gap: 6px;">
                    ☁️ Scarica da Giobby
                </button>
                <button id="gpSyncAutoMatch" style="background: #8b5cf6; color: white; border: none;
                        padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 0.875rem;
                        font-weight: 600;" disabled>
                    ⚡ Auto-Abbina
                </button>
                <button id="gpSyncSave" style="background: #10b981; color: white; border: none;
                        padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 0.875rem;
                        font-weight: 600;" disabled>
                    💾 Salva Tutti
                </button>
                <div style="margin-left: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <select id="gpSyncCatFilter"
                            style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 7px 10px;
                                   font-size: 0.85rem; outline: none; cursor: pointer; color:#334155;
                                   background: white;">
                        <option value="">📂 Tutte le categorie</option>
                    </select>
                    <input id="gpSyncFilter" type="text" placeholder="🔍 Filtra prodotti..."
                           style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 7px 12px;
                                  font-size: 0.85rem; width: 200px; outline: none;">
                    <label style="font-size: 0.8rem; color: #64748b; cursor: pointer; user-select: none;">
                        <input id="gpSyncOnlyUnmapped" type="checkbox"> Solo non abbinati
                    </label>
                </div>
            </div>

            <!-- Status Bar -->
            <div id="gpSyncStatus" style="padding: 10px 24px; background: #eff6ff; border-bottom: 1px solid #bfdbfe;
                    font-size: 0.8rem; color: #1e40af; display: none; flex-shrink: 0;">
                &nbsp;
            </div>

            <!-- Catalogo Giobby (collassabile) -->
            <div id="gpSyncCatalogBar" style="display:none; border-bottom: 2px solid #e2e8f0; flex-shrink: 0;">
                <button id="gpSyncCatalogToggle"
                    style="width:100%; background:#f1f5f9; border:none; border-bottom:1px solid #e2e8f0;
                           padding: 9px 24px; text-align:left; cursor:pointer; font-size:0.82rem;
                           color:#334155; font-weight:600; display:flex; align-items:center; gap:8px;">
                    <span id="gpSyncCatalogArrow" style="font-size:0.7rem;">▶</span>
                    📋 Sfoglia catalogo Giobby
                    <span id="gpSyncCatalogCount" style="background:#0ea5e9;color:white;border-radius:20px;
                           padding:1px 8px;font-size:0.72rem;font-weight:700;"></span>
                    <span style="margin-left:auto;font-size:0.75rem;color:#94a3b8;font-weight:400;">
                        Espandi per vedere tutti i prodotti Giobby e trovare il codice giusto
                    </span>
                </button>
                <div id="gpSyncCatalogPanel" style="display:none; padding:12px 24px 16px; background:#fafbfc;">
                    <div style="display:flex; gap:8px; margin-bottom:10px; align-items:center;">
                        <input id="gpSyncCatalogSearch" type="text" placeholder="🔍 Filtra catalogo Giobby..."
                               style="flex:1; border:1px solid #cbd5e1; border-radius:8px; padding:6px 12px;
                                      font-size:0.82rem; outline:none;">
                        <select id="gpSyncCatalogCat"
                                style="border:1px solid #cbd5e1; border-radius:8px; padding:6px 10px;
                                       font-size:0.82rem; outline:none; cursor:pointer; color:#334155;">
                            <option value="">📂 Tutte</option>
                        </select>
                        <span id="gpSyncCatalogInfo" style="font-size:0.75rem;color:#94a3b8;"></span>
                    </div>
                    <div id="gpSyncCatalogTable"
                         style="max-height:220px; overflow-y:auto; border:1px solid #e2e8f0;
                                border-radius:8px; background:white;"></div>
                </div>
            </div>

            <!-- Table Container -->
            <div style="flex: 1; overflow-y: auto; padding: 0;">
                <div id="gpSyncTableContainer" style="padding: 24px; text-align: center; color: #94a3b8;">
                    <div style="font-size: 3rem; margin-bottom: 12px;">📦</div>
                    <p style="font-size: 0.95rem;">Clicca "Scarica da Giobby" per caricare il catalogo prodotti</p>
                </div>
            </div>

            <!-- Footer -->
            <div id="gpSyncFooter" style="padding: 14px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc;
                    display: flex; justify-content: space-between; align-items: center;
                    font-size: 0.8rem; color: #64748b; flex-shrink: 0; display: none;">
                <span id="gpSyncStats"></span>
                <button id="gpSyncSave2" style="background: #10b981; color: white; border: none;
                        padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 0.875rem; font-weight: 600;">
                    💾 Salva Tutti i Codici
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Chiudi modale
    const closeModal = () => modal.remove();
    document.getElementById('gpSyncClose').onclick = closeModal;
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    // Stato interno
    let giobbyProducts = [];
    let mappings = [];

    // ---- Funzione di render tabella ----
    function renderTable() {
        const container = document.getElementById('gpSyncTableContainer');
        const filterText = (document.getElementById('gpSyncFilter')?.value || '').toLowerCase();
        const onlyUnmapped = document.getElementById('gpSyncOnlyUnmapped')?.checked;
        const catFilter = (document.getElementById('gpSyncCatFilter')?.value || '').toLowerCase();

        let filtered = mappings.filter(m => {
            const genesyCode = (m.genesyProduct.code || '').toLowerCase();
            const genesyDesc = (m.genesyProduct.description || '').toLowerCase();
            const genesyCat = (m.genesyProduct.category || '').toLowerCase();
            const giobbyCode = (m.selectedGiobbyCode || '').toLowerCase();
            const passesFilter = !filterText ||
                genesyCode.includes(filterText) ||
                genesyDesc.includes(filterText) ||
                giobbyCode.includes(filterText) ||
                genesyCat.includes(filterText);
            const passesCat = !catFilter || genesyCat === catFilter;
            const passesUnmapped = !onlyUnmapped || !m.selectedGiobbyCode;
            return passesFilter && passesCat && passesUnmapped;
        });

        const total = mappings.length;
        const mapped = mappings.filter(m => m.selectedGiobbyCode).length;
        const hasChanges = mappings.some(m => {
            const old = m.genesyProduct.giobby_code || '';
            return (m.selectedGiobbyCode || '') !== old;
        });

        // Aggiorna footer
        const footer = document.getElementById('gpSyncFooter');
        const stats = document.getElementById('gpSyncStats');
        if (footer) footer.style.display = 'flex';
        if (stats) stats.textContent = `${mapped} / ${total} prodotti abbinati · ${filtered.length} visualizzati`;

        const saveBtn = document.getElementById('gpSyncSave');
        const saveBtn2 = document.getElementById('gpSyncSave2');
        if (saveBtn) saveBtn.disabled = !hasChanges;
        if (saveBtn2) saveBtn2.disabled = !hasChanges;

        if (filtered.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:#94a3b8; padding: 40px;">
                <div style="font-size:2rem">🔍</div>
                <p>Nessun prodotto corrisponde al filtro</p>
            </div>`;
            return;
        }

        // (giobbyOptions non più usato — autocomplete)

        const rows = filtered.map((m, idx) => {
            const realIdx = mappings.indexOf(m);
            const matchBadge =
                m.matchType === 'code_exact' ? `<span style="color:#10b981;font-size:0.7rem;font-weight:600">✓ Codice</span>` :
                m.matchType === 'desc_exact' ? `<span style="color:#f59e0b;font-size:0.7rem;font-weight:600">✓ Descrizione</span>` :
                m.matchType === 'giobby_code_saved' ? `<span style="color:#6366f1;font-size:0.7rem;font-weight:600">✓ Salvato</span>` :
                `<span style="color:#cbd5e1;font-size:0.7rem">—</span>`;

            const rowBg = m.selectedGiobbyCode ? '#f0fdf4' : (idx % 2 === 0 ? '#fff' : '#f8fafc');
            const changed = (m.selectedGiobbyCode || '') !== (m.genesyProduct.giobby_code || '');
            const changedMark = changed ? 'border-left: 3px solid #f59e0b;' : '';

            // Prodotto Giobby: cell di sola lettura
            const selGp = m.selectedGiobbyCode
                ? giobbyProducts.find(p => p.code === m.selectedGiobbyCode)
                : null;
            const giobbyCodeCell = selGp
                ? `<div style="display:flex;flex-direction:column;gap:2px;">
                    <span style="font-family:monospace;font-weight:700;color:#0ea5e9;font-size:0.8rem">${escHtml(selGp.code)}</span>
                    <span style="color:#475569;font-size:0.75rem">${escHtml(selGp.description.substring(0, 60))}</span>
                    ${selGp.category ? `<span style="font-size:0.68rem;background:#e0f2fe;color:#0369a1;border-radius:4px;padding:1px 5px;width:fit-content">${escHtml(selGp.category)}</span>` : ''}
                   </div>`
                : `<span style="color:#cbd5e1;font-size:0.75rem">— nessuno —</span>`;

            // Nell'input mostriamo solo il codice (la desc è nella colonna)
            const inputDisplayVal = m.selectedGiobbyCode || '';
            const genesyCat = m.genesyProduct.category || '';
            return `<tr data-idx="${realIdx}" style="background: ${rowBg}; ${changedMark}">
                <td style="padding: 8px 12px; font-family: monospace; font-size: 0.8rem; color: #1e293b; white-space: nowrap; vertical-align: middle;">
                    ${escHtml(m.genesyProduct.code || '—')}
                </td>
                <td style="padding: 8px 12px; font-size: 0.82rem; color: #334155; vertical-align: middle; max-width: 260px;">
                    ${escHtml(m.genesyProduct.description || '—')}
                </td>
                <td style="padding: 8px 12px; vertical-align: middle; white-space: nowrap;">
                    ${genesyCat ? `<span style="font-size:0.72rem;background:#f1f5f9;color:#475569;border-radius:5px;padding:2px 7px;font-weight:500;">${escHtml(genesyCat)}</span>` : '<span style="color:#cbd5e1;font-size:0.72rem">—</span>'}
                </td>
                <td style="padding: 8px 12px; vertical-align: middle; max-width: 240px;">${giobbyCodeCell}</td>
                <td style="padding: 8px 12px; text-align: center; vertical-align: middle;">${matchBadge}</td>
                <td style="padding: 8px 12px; vertical-align: middle;">
                    <div class="gpAcWrapper" data-mapping-idx="${realIdx}"
                         style="display: flex; gap: 6px; align-items: flex-start; position: relative;">
                        <div style="flex: 1; position: relative;">
                            <input type="text"
                                class="gpAcInput"
                                data-mapping-idx="${realIdx}"
                                data-selected="${escHtml(m.selectedGiobbyCode || '')}"
                                data-category="${escHtml(genesyCat)}"
                                value="${escHtml(inputDisplayVal)}"
                                placeholder="🔍 Cerca..."
                                autocomplete="off"
                                style="width: 100%; box-sizing: border-box;
                                       border: 1.5px solid ${m.selectedGiobbyCode ? '#10b981' : '#cbd5e1'};
                                       border-radius: 6px; padding: 5px 10px; font-size: 0.8rem;
                                       background: ${m.selectedGiobbyCode ? '#f0fdf4' : 'white'};
                                       outline: none; cursor: text;">
                            <div class="gpAcDropdown" data-mapping-idx="${realIdx}"
                                 style="display:none; position: absolute; top: calc(100% + 2px); left: 0;
                                        min-width: 100%; max-width: 480px; max-height: 220px; overflow-y: auto;
                                        background: white; border: 1px solid #cbd5e1; border-radius: 8px;
                                        box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 9999;
                                        font-size: 0.8rem;">
                                <div class="gpAcNone" style="padding: 10px 14px; color: #94a3b8; display:none;">
                                    Nessun risultato
                                </div>
                            </div>
                        </div>
                        <button class="gpSyncClearBtn" data-mapping-idx="${realIdx}"
                            style="background: none; border: 1px solid #e2e8f0; border-radius: 6px;
                                   padding: 5px 8px; cursor: pointer; font-size: 0.8rem; color: #94a3b8;
                                   flex-shrink: 0; margin-top: 1px;"
                            title="Rimuovi abbinamento">✕</button>
                    </div>
                    ${m.genesyProduct.giobby_code ? `<div style="font-size:0.7rem;color:#64748b;margin-top:2px;">Precedente: <code>${escHtml(m.genesyProduct.giobby_code)}</code></div>` : ''}
                </td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <table style="width:100%; border-collapse: collapse; font-family: 'Inter', sans-serif;">
                <thead>
                    <tr style="background: #1e293b; color: white; text-align: left; position: sticky; top: 0; z-index: 1;">
                        <th style="padding: 10px 12px; font-size: 0.78rem; font-weight: 600; white-space: nowrap;">Codice Genesy</th>
                        <th style="padding: 10px 12px; font-size: 0.78rem; font-weight: 600;">Descrizione Genesy</th>
                        <th style="padding: 10px 12px; font-size: 0.78rem; font-weight: 600; white-space: nowrap;">Categoria</th>
                        <th style="padding: 10px 12px; font-size: 0.78rem; font-weight: 600;">Prodotto Giobby abbinato</th>
                        <th style="padding: 10px 12px; font-size: 0.78rem; font-weight: 600; text-align: center; white-space: nowrap;">Match</th>
                        <th style="padding: 10px 12px; font-size: 0.78rem; font-weight: 600; white-space: nowrap;">Abbina</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

        // ---- Autocomplete logic ----
        function buildDropdownItems(dropdown, query, mappingIdx) {
            // Rimuovi le voci precedenti (tranne gpAcNone)
            dropdown.querySelectorAll('.gpAcItem').forEach(el => el.remove());

            const q = query.toLowerCase();
            const matches = giobbyProducts.filter(p =>
                !q ||
                p.code.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q) ||
                (p.category || '').toLowerCase().includes(q)
            );

            const noneEl = dropdown.querySelector('.gpAcNone');

            if (matches.length === 0) {
                noneEl.style.display = 'block';
                return;
            }
            noneEl.style.display = 'none';

            matches.slice(0, 80).forEach(p => {
                const item = document.createElement('div');
                item.className = 'gpAcItem';
                item.dataset.code = p.code;
                item.style.cssText = `
                    padding: 8px 14px; cursor: pointer; border-bottom: 1px solid #f1f5f9;
                    display: flex; flex-direction: column; gap: 1px;
                    transition: background 0.1s;
                `;
                item.innerHTML = `
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-family:monospace;font-weight:600;color:#0ea5e9;font-size:0.78rem">${escHtml(p.code)}</span>
                        ${p.category ? `<span style="font-size:0.68rem;background:#e0f2fe;color:#0369a1;border-radius:4px;padding:1px 5px;">${escHtml(p.category)}</span>` : ''}
                    </div>
                    <span style="color:#475569;font-size:0.75rem">${escHtml(p.description.substring(0, 70))}</span>
                `;
                item.addEventListener('mouseenter', () => item.style.background = '#eff6ff');
                item.addEventListener('mouseleave', () => item.style.background = '');
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // evita blur sull'input
                    selectItem(mappingIdx, p);
                });
                dropdown.appendChild(item);
            });
        }

        function selectItem(mappingIdx, product) {
            mappings[mappingIdx].selectedGiobbyCode = product.code;
            mappings[mappingIdx].giobbyProduct = product; // Salva il prodotto completo per la descrizione
            const inp = container.querySelector(`.gpAcInput[data-mapping-idx="${mappingIdx}"]`);
            const drop = container.querySelector(`.gpAcDropdown[data-mapping-idx="${mappingIdx}"]`);
            if (inp) {
                const label = `${product.code} — ${product.description.substring(0, 50)}`;
                inp.value = label;
                inp.dataset.selected = product.code;
                inp.style.borderColor = '#10b981';
                inp.style.background = '#f0fdf4';
            }
            if (drop) drop.style.display = 'none';
            // Aggiorna i pulsanti salva
            const hasChanges = mappings.some(m => (m.selectedGiobbyCode || '') !== (m.genesyProduct.giobby_code || ''));
            const saveBtn = document.getElementById('gpSyncSave');
            const saveBtn2 = document.getElementById('gpSyncSave2');
            if (saveBtn) saveBtn.disabled = !hasChanges;
            if (saveBtn2) saveBtn2.disabled = !hasChanges;
            // Aggiorna stats
            const mapped = mappings.filter(m => m.selectedGiobbyCode).length;
            const statsEl = document.getElementById('gpSyncStats');
            if (statsEl) statsEl.textContent = `${mapped} / ${mappings.length} prodotti abbinati`;
        }

        container.querySelectorAll('.gpAcInput').forEach(inp => {
            const mappingIdx = parseInt(inp.dataset.mappingIdx);
            const dropdown = container.querySelector(`.gpAcDropdown[data-mapping-idx="${mappingIdx}"]`);

            inp.addEventListener('focus', () => {
                inp.select();
                // Se non è ancora abbinato, pre-filtra per categoria Genesy
                const preQuery = (!inp.dataset.selected && inp.dataset.category)
                    ? inp.dataset.category
                    : inp.value;
                buildDropdownItems(dropdown, preQuery, mappingIdx);
                dropdown.style.display = 'block';
            });

            inp.addEventListener('input', () => {
                buildDropdownItems(dropdown, inp.value, mappingIdx);
                dropdown.style.display = 'block';
                inp.dataset.selected = '';
            });

            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    dropdown.style.display = 'none';
                    // Ripristina label del valore corrente
                    const cur = mappings[mappingIdx].selectedGiobbyCode;
                    const gp = cur ? giobbyProducts.find(p => p.code === cur) : null;
                    inp.value = gp ? `${gp.code} — ${gp.description.substring(0, 50)}` : (cur || '');
                }
                if (e.key === 'Enter') {
                    const first = dropdown.querySelector('.gpAcItem');
                    if (first) {
                        const p = giobbyProducts.find(x => x.code === first.dataset.code);
                        if (p) selectItem(mappingIdx, p);
                    }
                }
            });

            inp.addEventListener('blur', () => {
                setTimeout(() => { dropdown.style.display = 'none'; }, 150);
            });
        });

        // Event listeners per pulsanti rimuovi
        container.querySelectorAll('.gpSyncClearBtn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.mappingIdx);
                mappings[idx].selectedGiobbyCode = '';
                renderTable();
            });
        });
    }

    // ---- Scarica da Giobby ----
    document.getElementById('gpSyncFetch').onclick = async () => {
        const statusEl = document.getElementById('gpSyncStatus');
        const container = document.getElementById('gpSyncTableContainer');
        const fetchBtn = document.getElementById('gpSyncFetch');

        fetchBtn.disabled = true;
        fetchBtn.textContent = '⏳ Download in corso...';
        statusEl.style.display = 'block';
        statusEl.textContent = '⏳ Connessione a Giobby...';
        container.innerHTML = `<div style="text-align:center; padding: 60px; color: #64748b;">
            <div style="font-size: 2.5rem; animation: spin 1s linear infinite; display: inline-block;">⏳</div>
            <p style="margin-top: 16px;">Download catalogo prodotti da Giobby...</p>
        </div>`;

        try {
            const rawProducts = await fetchAllGiobbyProducts(config);

            if (rawProducts.length === 0) {
                statusEl.style.background = '#fef2f2';
                statusEl.style.color = '#dc2626';
                statusEl.textContent = '❌ Nessun prodotto trovato su Giobby. Verifica che l\'endpoint /products sia disponibile.';
                container.innerHTML = `<div style="text-align:center; padding: 40px; color: #dc2626;">
                    <div style="font-size: 2rem">❌</div>
                    <p>Nessun prodotto trovato nel catalogo Giobby.<br>
                    <small style="color:#64748b">Potrebbe mancare l'endpoint /products — controlla la console (F12).</small></p>
                </div>`;
                return;
            }

            giobbyProducts = rawProducts.map(normalizeGiobbyProduct).filter(p => p.code);

            // Diagnostica: se arrivano dati ma nessun prodotto ha il codice riconosciuto
            if (giobbyProducts.length === 0 && rawProducts.length > 0) {
                const sample = rawProducts[0];
                const keys = Object.keys(sample).join(', ');
                console.warn('[Giobby Sync] Prodotti ricevuti ma codice non trovato. Campi disponibili:', keys, '\nPrimo prodotto:', sample);
                statusEl.style.background = '#fffbeb';
                statusEl.style.color = '#92400e';
                statusEl.textContent = `⚠️ Ricevuti ${rawProducts.length} prodotti da Giobby ma nessun campo "codice" riconosciuto. Campi disponibili: ${keys}. Apri la console (F12) per i dettagli.`;
            } else {
                statusEl.style.background = '#eff6ff';
                statusEl.style.color = '#1e40af';
                statusEl.textContent = `✅ Scaricati ${giobbyProducts.length} prodotti da Giobby. Clicca "Auto-Abbina" per tentare l'abbinamento automatico.`;
            }

            // Abbina prodotti Genesy con prodotti Giobby
            const genesyProducts = window.db ? window.db.getProducts() : [];
            mappings = autoMatchProducts(genesyProducts, giobbyProducts);

            // Popola il filtro categoria con le categorie Genesy
            const catSelect = document.getElementById('gpSyncCatFilter');
            const genesyCategories = [...new Set(
                genesyProducts.map(p => p.category || '').filter(Boolean)
            )].sort();
            catSelect.innerHTML = '<option value="">📂 Tutte le categorie</option>' +
                genesyCategories.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');

            document.getElementById('gpSyncAutoMatch').disabled = false;
            document.getElementById('gpSyncSave').disabled = false;

            // Mostra e popola il pannello catalogo Giobby
            const catalogBar = document.getElementById('gpSyncCatalogBar');
            if (catalogBar) catalogBar.style.display = 'block';
            const catalogCountEl = document.getElementById('gpSyncCatalogCount');
            if (catalogCountEl) catalogCountEl.textContent = giobbyProducts.length;
            const catalogCatSel = document.getElementById('gpSyncCatalogCat');
            if (catalogCatSel) {
                const giobbyCategories = [...new Set(
                    giobbyProducts.map(p => p.category || '').filter(Boolean)
                )].sort();
                catalogCatSel.innerHTML = '<option value="">📂 Tutte</option>' +
                    giobbyCategories.map(c => `<option value="${escHtml(c.toLowerCase())}">${escHtml(c)}</option>`).join('');
            }

            renderTable();
        } catch (e) {
            statusEl.style.background = '#fef2f2';
            statusEl.style.color = '#dc2626';
            statusEl.textContent = `❌ Errore: ${e.message}`;
            container.innerHTML = `<div style="text-align:center; padding: 40px; color: #dc2626;">
                <p>Errore durante il download:<br><code>${escHtml(e.message)}</code></p>
            </div>`;
            console.error('GP Sync fetch error:', e);
        } finally {
            fetchBtn.disabled = false;
            fetchBtn.textContent = '☁️ Scarica da Giobby';
        }
    };

    // ---- Auto-Abbina ----
    document.getElementById('gpSyncAutoMatch').onclick = () => {
        if (mappings.length === 0) return;
        // Re-applica auto-match
        const genesyProducts = window.db ? window.db.getProducts() : [];
        mappings = autoMatchProducts(genesyProducts, giobbyProducts);
        const matched = mappings.filter(m => m.selectedGiobbyCode && m.matchType !== 'none').length;
        const statusEl = document.getElementById('gpSyncStatus');
        statusEl.style.background = '#fdf4ff';
        statusEl.style.color = '#7c3aed';
        statusEl.textContent = `⚡ Auto-abbinamento completato: ${matched} prodotti abbinati su ${mappings.length}.`;
        renderTable();
    };

    // ---- Salva Tutti ----
    const doSave = async () => {
        const saveBtn = document.getElementById('gpSyncSave');
        const saveBtn2 = document.getElementById('gpSyncSave2');
        const statusEl = document.getElementById('gpSyncStatus');

        if (saveBtn) saveBtn.disabled = true;
        if (saveBtn2) saveBtn2.disabled = true;
        statusEl.style.background = '#eff6ff';
        statusEl.style.color = '#1e40af';
        statusEl.textContent = '⏳ Salvataggio in corso...';

        try {
            const { saved, errors } = await saveMassiveGiobbyCodes(mappings);

            statusEl.style.background = errors > 0 ? '#fffbeb' : '#f0fdf4';
            statusEl.style.color = errors > 0 ? '#92400e' : '#166534';
            statusEl.textContent = `✅ Salvati ${saved} prodotti.${errors > 0 ? ` ⚠️ ${errors} errori (vedi console).` : ''} Il catalogo Genesy è ora sincronizzato!`;

            renderTable();
            
            // Conferma visiva per l'utente
            alert(`Sincronizzazione completata!\n\n✅ Prodotti aggiornati: ${saved}\n${errors > 0 ? `⚠️ Errori: ${errors}\n` : ''}\nI codici Giobby sono stati salvati definitivamente nel catalogo Genesy.`);
            
        } catch (e) {
            statusEl.style.background = '#fef2f2';
            statusEl.style.color = '#dc2626';
            statusEl.textContent = `❌ Errore durante il salvataggio: ${e.message}`;
            console.error('GP Sync save error:', e);
        }
    };

    document.getElementById('gpSyncSave').onclick = doSave;
    document.getElementById('gpSyncSave2').onclick = doSave;

    // ---- Filtri tabella mappatura ----
    document.getElementById('gpSyncFilter').addEventListener('input', renderTable);
    document.getElementById('gpSyncOnlyUnmapped').addEventListener('change', renderTable);
    document.getElementById('gpSyncCatFilter').addEventListener('change', renderTable);

    // ---- Catalogo Giobby ----
    let lastFocusedMappingIdx = null; // indice dell'ultima riga autocomplete su cui ha cliccato l'utente

    // Traccia il focus dell'autocomplete per sapere dove applicare "Usa questo codice"
    document.addEventListener('focusin', (e) => {
        const inp = e.target.closest('.gpAcInput');
        if (inp) lastFocusedMappingIdx = parseInt(inp.dataset.mappingIdx);
    });

    function renderCatalog() {
        const tableEl = document.getElementById('gpSyncCatalogTable');
        const infoEl  = document.getElementById('gpSyncCatalogInfo');
        if (!tableEl) return;

        const q   = (document.getElementById('gpSyncCatalogSearch')?.value || '').toLowerCase();
        const cat = (document.getElementById('gpSyncCatalogCat')?.value || '').toLowerCase();

        const filtered = giobbyProducts.filter(p =>
            (!q   || p.code.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q)) &&
            (!cat || (p.category||'').toLowerCase() === cat)
        );

        if (infoEl) infoEl.textContent = `${filtered.length} prodotti`;

        if (filtered.length === 0) {
            tableEl.innerHTML = `<div style="padding:16px;text-align:center;color:#94a3b8;font-size:0.82rem;">Nessun prodotto trovato</div>`;
            return;
        }

        const rows = filtered.slice(0, 200).map(p => `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:6px 10px;font-family:monospace;font-size:0.78rem;font-weight:700;color:#0ea5e9;white-space:nowrap;">${escHtml(p.code)}</td>
                <td style="padding:6px 10px;font-size:0.78rem;color:#334155;max-width:300px;">${escHtml(p.description)}</td>
                <td style="padding:6px 10px;font-size:0.72rem;color:#64748b;white-space:nowrap;">${p.category ? `<span style="background:#e0f2fe;color:#0369a1;border-radius:4px;padding:1px 6px;">${escHtml(p.category)}</span>` : ''}</td>
                <td style="padding:6px 10px;white-space:nowrap;">
                    <button class="gpCatUseBtn" data-code="${escHtml(p.code)}"
                        style="background:#0ea5e9;color:white;border:none;border-radius:6px;
                               padding:3px 10px;font-size:0.75rem;cursor:pointer;font-weight:600;">
                        Usa ↑
                    </button>
                </td>
            </tr>`).join('');

        tableEl.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-family:'Inter',sans-serif;">
                <thead>
                    <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;position:sticky;top:0;">
                        <th style="padding:7px 10px;font-size:0.72rem;font-weight:600;color:#475569;text-align:left;">Codice Giobby</th>
                        <th style="padding:7px 10px;font-size:0.72rem;font-weight:600;color:#475569;text-align:left;">Descrizione</th>
                        <th style="padding:7px 10px;font-size:0.72rem;font-weight:600;color:#475569;text-align:left;">Categoria</th>
                        <th style="padding:7px 10px;font-size:0.72rem;font-weight:600;color:#475569;"></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;

        // Bottone "Usa" — assegna il codice all'ultima riga autocomplete attiva
        tableEl.querySelectorAll('.gpCatUseBtn').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.dataset.code;
                const product = giobbyProducts.find(p => p.code === code);
                if (!product) return;

                if (lastFocusedMappingIdx !== null && mappings[lastFocusedMappingIdx]) {
                    // Seleziona sulla riga mappatura
                    mappings[lastFocusedMappingIdx].selectedGiobbyCode = code;
                    renderTable();
                    // Scroll alla riga
                    const row = document.querySelector(`tr[data-idx="${lastFocusedMappingIdx}"]`);
                    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Flash verde sulla riga
                    row && (row.style.outline = '2px solid #10b981');
                    setTimeout(() => { if (row) row.style.outline = ''; }, 1500);
                } else {
                    // Nessuna riga selezionata — copia negli appunti
                    navigator.clipboard?.writeText(code).catch(() => {});
                    btn.textContent = '✓ Copiato!';
                    setTimeout(() => { btn.textContent = 'Usa ↑'; }, 1500);
                }
            });
        });
    }

    // Toggle espandi/collassa catalogo
    document.getElementById('gpSyncCatalogToggle').addEventListener('click', () => {
        const panel = document.getElementById('gpSyncCatalogPanel');
        const arrow = document.getElementById('gpSyncCatalogArrow');
        const open = panel.style.display === 'none';
        panel.style.display = open ? 'block' : 'none';
        arrow.textContent = open ? '▼' : '▶';
        if (open) renderCatalog();
    });

    document.getElementById('gpSyncCatalogSearch').addEventListener('input', renderCatalog);
    document.getElementById('gpSyncCatalogCat').addEventListener('change', renderCatalog);
};

// ===========================================================================
// HELPERS
// ===========================================================================
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

console.log('✅ [giobby-product-sync.js] Caricato');
