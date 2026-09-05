/**
 * Products Excel Import/Export
 * Richiede SheetJS (XLSX) già incluso nell'app.
 *
 * Classi prodotto disponibili: A, B, C, D (espandibile)
 */

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

window.exportProductsToExcel = function () {
    const products = db.getProducts('');
    if (!products || products.length === 0) {
        alert('Nessun prodotto da esportare.');
        return;
    }

    // Definisce colonne e ordine
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

    // Larghezze colonne (approssimate)
    worksheet['!cols'] = [
        { wch: 22 }, // ID
        { wch: 14 }, // Codice
        { wch: 8  }, // Classe
        { wch: 20 }, // Collezione
        { wch: 50 }, // Descrizione
        { wch: 6  }, // U.M.
        { wch: 12 }, // Prezzo Min
        { wch: 12 }, // Prezzo Max
        { wch: 16 }, // Essenza
        { wch: 16 }, // Tipo
        { wch: 12 }, // Scelta
        { wch: 12 }, // Finitura
        { wch: 14 }  // PrezzoMat.
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prodotti');

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Prodotti_Genesy_${today}.xlsx`);

    console.log(`✅ Export completato: ${rows.length} prodotti.`);
};

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT
// ─────────────────────────────────────────────────────────────────────────────

window.importProductsFromExcel = async function (input) {
    if (!input.files || input.files.length === 0) return;

    // Legge la modalità dal modale bulk ops (se aperto) o default a 'merge'
    const modeEl = document.querySelector('input[name="bulkImportMode"]:checked');
    const mode = modeEl ? modeEl.value : 'merge';

    const file = input.files[0];
    const reader = new FileReader();

    showLoadingSpinner('Lettura file prodotti...');

    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!rows || rows.length === 0) {
                alert('Il file sembra vuoto o non ha righe dati.');
                hideLoadingSpinner();
                return;
            }

            // ── Modalità SOSTITUISCI TUTTO ──────────────────────────────────
            if (mode === 'replace-all') {
                const total = (window.db ? window.db.getProducts('') : []).length;
                if (!confirm(`⚠️ ATTENZIONE: verranno eliminati TUTTI i ${total} prodotti esistenti prima di importare quelli del file.\n\nContinuare?`)) {
                    hideLoadingSpinner();
                    input.value = '';
                    return;
                }
                showLoadingSpinner('Eliminazione prodotti esistenti...');
                await window.db.deleteAllProducts();
            }

            // ── Modalità SOSTITUISCI PER CATEGORIA ──────────────────────────
            if (mode === 'replace-category') {
                // Estrae le categorie presenti nel file
                const normalizeKey = k => String(k).trim().replace(/\r?\n|\r/g, ' ').replace(/\./g, '').toLowerCase().replace(/[\s_]/g, '');
                const catKeys = ['Collezione', 'collezione', 'Categoria', 'categoria', 'category', 'collection', 'gruppo', 'famiglia'];
                const fileCats = new Set();
                rows.forEach(row => {
                    for (const k of catKeys) {
                        const found = Object.keys(row).find(rk => normalizeKey(rk) === normalizeKey(k));
                        if (found && row[found] && String(row[found]).trim()) {
                            fileCats.add(String(row[found]).trim());
                            break;
                        }
                    }
                });
                const catsArray = Array.from(fileCats).filter(Boolean);
                if (catsArray.length === 0) {
                    alert('Non è stato possibile determinare le categorie dal file. Verifica che la colonna "Collezione" sia presente.');
                    hideLoadingSpinner();
                    input.value = '';
                    return;
                }
                const existingInCats = (window.db ? window.db.getProducts('') : []).filter(p => catsArray.includes(p.category)).length;
                if (!confirm(`⚠️ ATTENZIONE: verranno eliminati ${existingInCats} prodotti nelle categorie:\n\n${catsArray.join(', ')}\n\nContinuare?`)) {
                    hideLoadingSpinner();
                    input.value = '';
                    return;
                }
                showLoadingSpinner('Eliminazione prodotti per categoria...');
                await window.db.deleteProductsByCategory(catsArray);
            }

            // ── Import (uguale per tutte le modalità) ───────────────────────
            const modeLabel = mode === 'replace-all' ? 'Sostituzione totale' :
                              mode === 'replace-category' ? 'Sostituzione per categoria' : 'Aggiungi/Aggiorna';
            showLoadingSpinner(`Import prodotti (${modeLabel})...`);

            const result = await _processProductImportFlex(rows);

            let skipText = '';
            if (result.skipped) {
                skipText = `\n• ${result.skipped} saltati:`;
                const maxLogs = 15;
                const logsToShow = result.skipDetails.slice(0, maxLogs);
                skipText += `\n   ` + logsToShow.join(`\n   `);
                if (result.skipDetails.length > maxLogs) {
                    skipText += `\n   ... e altri ${result.skipDetails.length - maxLogs} errori.`;
                }
            }

            alert(
                `✅ Import prodotti terminato! [${modeLabel}]\n\n` +
                `• ${result.updated} aggiornati\n` +
                `• ${result.created} creati` +
                skipText +
                (result.debugHeaders ? `\n\n[INFO COLONNE LETTE DAL FILE]:\n${result.debugHeaders.join(', ')}` : '')
            );

            // Aggiorna la cache locale e re-render UI
            if (window.renderProductsTable) renderProductsTable();
            if (window.renderProdPicker) renderProdPicker();

        } catch (err) {
            console.error('Import prodotti error:', err);
            alert('Errore durante l\'importazione: ' + err.message);
        } finally {
            hideLoadingSpinner();
            input.value = ''; // Reset input per consentire reimport
        }
    };

    reader.readAsArrayBuffer(file);
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGICA INTERNA FLESSIBILE
// Supporta il formato esatto dell'anagrafica prodotti:
//   ID | Codice | Classe | Collezione | Descrizione | U.M. | Prezzo Min | Prezzo Max
// ─────────────────────────────────────────────────────────────────────────────

async function _processProductImportFlex(rows) {
    // Normalizza le chiavi: rimuove spazi iniziali/finali, newline, e punti
    // In questo modo "U.M.", " Codice ", "Prezzo Min" vengono tutti normalizzati
    const normalizeKey = (k) => String(k).trim().replace(/\r?\n|\r/g, ' ').replace(/\./g, '').toLowerCase().replace(/[\s_]/g, '');

    const cleanedRows = rows.map(r => {
        const cleanO = {};
        for (const [k, v] of Object.entries(r)) {
            cleanO[String(k).trim().replace(/\r?\n|\r/g, ' ')] = v;
        }
        return cleanO;
    });

    // ---- Parser colonne flessibile ----
    // Cerca prima la chiave esatta, poi normalizzata (senza spazi/underscore/punti)
    const getVal = (row, keys) => {
        for (const k of keys) {
            // Match esatto
            if (row[k] !== undefined && row[k] !== '') return String(row[k]).trim();
            // Match normalizzato
            const normK = normalizeKey(k);
            const found = Object.keys(row).find(rk => normalizeKey(rk) === normK);
            if (found && row[found] !== undefined && row[found] !== '') return String(row[found]).trim();
        }
        return '';
    };

    const existingProducts = window.db ? window.db.getProducts('') : [];
    const existingByCode = {};
    const existingById = {};

    existingProducts.forEach(p => {
        if (p.code) existingByCode[p.code.trim().toUpperCase()] = p;
        if (p.id) existingById[p.id] = p;
    });

    const result = { updated: 0, created: 0, skipped: 0, skipDetails: [], debugHeaders: null };
    const totalRows = cleanedRows.length;
    let processed = 0;

    if (totalRows > 0) {
        result.debugHeaders = Object.keys(cleanedRows[0]);
    }

    for (const row of cleanedRows) {
        processed++;
        if (processed % 20 === 0) {
            showLoadingSpinner(`Elaborazione riga ${processed} di ${totalRows}...`);
            await new Promise(r => setTimeout(r, 0));
        }

        // Codice obbligatorio — prova tutti i sinonimi comuni
        const code = getVal(row, [
            'Codice', 'codice', 'code', 'cod', 'articolo', 'item_code', 'itemcode',
            'codice articolo', 'codicearticolo', 'codice prodotto', 'codiceprodotto'
        ]);
        if (!code) {
            result.skipped++;
            result.skipDetails.push(`Riga ${processed}: Codice identificativo mancante`);
            continue;
        }

        // ID riga (per aggiornamento preciso)
        const rowId = getVal(row, ['ID', 'Id', 'id', 'idprodotto', 'identificativo']);

        // Descrizione
        const description = getVal(row, [
            'Descrizione', 'descrizione', 'description', 'desc', 'nome', 'name',
            'descrizione articolo', 'nome articolo', 'titolo'
        ]);

        // Collezione / Categoria
        const category = getVal(row, [
            'Collezione', 'collezione', 'Categoria', 'categoria', 'category',
            'collection', 'gruppo', 'famiglia', 'reparto', 'marca'
        ]);

        // Unità di misura — "U.M." normalizzato diventa "um"
        const uom = getVal(row, ['U.M.', 'UM', 'um', 'uom', 'unità', 'unita', 'unit', 'unitofmeasure', 'udm']);

        // Classe prodotto (A/B/C/D)
        const classe = getVal(row, ['Classe', 'classe', 'class', 'categoria classe', 'product class']);

        // Prezzi
        const rawPriceMin = getVal(row, [
            'Prezzo Min', 'prezzo min', 'PrezzoMin', 'prezzomin',
            'prezzo_min', 'price_min', 'prezzo minimo', 'min'
        ]);
        const priceMin = rawPriceMin ? parseFloat(String(rawPriceMin).replace(',', '.')) : null;

        const rawPriceMax = getVal(row, [
            'Prezzo Max', 'prezzo max', 'PrezzoMax', 'prezzomax',
            'prezzo_max', 'price_max', 'prezzo massimo', 'max'
        ]);
        const priceMax = rawPriceMax ? parseFloat(String(rawPriceMax).replace(',', '.')) : null;

        // Campi extra (non nell'anagrafica base ma supportati)
        const essenza = getVal(row, ['Essenza', 'essenza', 'essence']);
        const tipo    = getVal(row, ['Tipo', 'tipo', 'tipologia', 'type']);
        const var1    = getVal(row, ['Scelta', 'scelta', 'var1', 'choice']);
        const var2    = getVal(row, ['Finitura', 'finitura', 'var2', 'finish']);
        const var3    = getVal(row, ['PrezzoMat.', 'prezzomat.', 'Formato', 'formato', 'var3', 'format', 'prezzo solo materiale']);

        // Lookup: prima per ID, poi per Codice
        const existing = (rowId && existingById[rowId]) || existingByCode[code.toUpperCase()] || null;

        if (existing) {
            // --- AGGIORNA prodotto esistente ---
            const updated_product = {
                ...existing,
                code:        code,
                description: description || existing.description,
                category:    category    || existing.category    || '',
                uom:         uom         || existing.uom         || 'mq',
                classe:      classe      || existing.classe      || '',
                priceMin:    priceMin  !== null ? priceMin  : existing.priceMin,
                priceMax:    priceMax  !== null ? priceMax  : existing.priceMax,
                essenza:     essenza     || existing.essenza     || '',
                tipo:        tipo        || existing.tipo        || '',
                var1:        var1        || existing.var1        || '',
                var2:        var2        || existing.var2        || '',
                var3:        var3        || existing.var3        || ''
            };

            try {
                await window.db.saveProduct(updated_product);
                result.updated++;
            } catch (e) {
                console.error(`❌ Errore aggiornamento prodotto ${code}:`, e);
                result.skipped++;
                result.skipDetails.push(`Riga ${processed} (Cod: ${code}): Errore aggiornamento DB - ${e.message}`);
            }
        } else {
            // --- CREA nuovo prodotto ---
            if (!description) {
                result.skipped++;
                result.skipDetails.push(`Riga ${processed} (Cod: ${code}): Descrizione prodotto mancante`);
                continue;
            }

            const newProduct = {
                id:          rowId || ('P-' + Date.now() + '-' + processed),
                code:        code,
                description: description,
                category:    category  || '',
                uom:         uom       || 'mq',
                classe:      classe    || '',
                priceMin:    priceMin  ?? 0,
                priceMax:    priceMax  ?? 0,
                essenza:     essenza   || '',
                tipo:        tipo      || '',
                var1:        var1      || '',
                var2:        var2      || '',
                var3:        var3      || ''
            };

            try {
                await window.db.saveProduct(newProduct);
                existingByCode[code.toUpperCase()] = newProduct; 
                existingById[newProduct.id] = newProduct;
                result.created++;
            } catch (e) {
                console.error(`❌ Errore creazione prodotto ${code}:`, e);
                result.skipped++;
                result.skipDetails.push(`Riga ${processed} (Cod: ${code}): Errore salvataggio DB - ${e.message}`);
            }
        }
    }

    if (result.created > 0 || result.updated > 0) {
        result.debugHeaders = null; // Togli il debug se ha importato qualcosa con successo
    }

    return result;
}
