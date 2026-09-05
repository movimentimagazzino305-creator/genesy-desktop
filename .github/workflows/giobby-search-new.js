/**
 * NEW GIOBBY SEARCH LOGIC WITH INTERACTIVE CANDIDATE SELECTION - FIXED VERSION
 * This file contains the improved search/selection functions with debugging
 */

// Main Search Function - collects ALL candidates from multiple strategies
window.findOrCreateGiobbyClient_NEW = async function (config, clientData, autoCreate = false) {
    const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
    let fetchUrl = baseUrl + "contacts";

    // === STEP 0: Direct ID Lookup (bypasses Giobby visibility filter) ===
    if (clientData.giobbyContactId) {
        try {
            let directUrl = baseUrl + "contacts/" + clientData.giobbyContactId;
            if (config.useProxy) directUrl = "https://corsproxy.io/?" + encodeURIComponent(directUrl);
            const directRes = await fetch(directUrl, { headers: getGiobbyHeaders(config.accessToken) });
            if (directRes.ok) {
                const directContact = await directRes.json();
                if (directContact && (directContact.id || directContact.idCustomer)) {
                    console.log(`✅ [Giobby Search NEW] Contatto trovato via ID diretto: id=${directContact.id}, idCustomer=${directContact.idCustomer}`);
                    return { idContact: directContact.id, idCustomer: directContact.idCustomer };
                }
            }
        } catch (e) { console.warn("[Giobby Search NEW] Direct ID lookup failed:", e); }
    }

    // === STEP 0b: Lookup via idCustomer (se abbiamo il codice cliente ma non il GUID) ===
    if (clientData.giobbyCustomerId) {
        try {
            let codeUrl = fetchUrl + "?freeText=" + encodeURIComponent(clientData.giobbyCustomerId);
            if (config.useProxy) codeUrl = "https://corsproxy.io/?" + encodeURIComponent(codeUrl);
            const codeRes = await fetch(codeUrl, { headers: getGiobbyHeaders(config.accessToken) });
            if (codeRes.ok) {
                const codeData = await codeRes.json();
                const list = codeData.contacts || (Array.isArray(codeData) ? codeData : []);
                const found = list.find(c => String(c.idCustomer) === String(clientData.giobbyCustomerId) || String(c.code) === String(clientData.giobbyCustomerId));
                if (found) {
                    console.log(`✅ [Giobby Search NEW] Contatto trovato via idCustomer=${clientData.giobbyCustomerId}: id=${found.id}`);
                    return { idContact: found.id, idCustomer: found.idCustomer };
                }
            }
        } catch (e) { console.warn(`[Giobby Search NEW] Lookup via idCustomer failed:`, e); }
    }

    // Collection of unique candidates (Map by ID to avoid duplicates)
    const candidates = new Map();

    const addCandidates = (list, source) => {
        if (!list || !Array.isArray(list)) return;
        list.forEach(c => {
            if (!candidates.has(c.id)) {
                c._matchSource = source; // Debug info
                candidates.set(c.id, c);
            }
        });
    };

    // Helper: Perform Search
    const doSearch = async (params) => {
        let url = fetchUrl + params;
        if (config.useProxy) url = "https://corsproxy.io/?" + encodeURIComponent(url);
        console.log("[Giobby Search] 🔍 GET", url);
        try {
            const res = await fetch(url, { headers: getGiobbyHeaders(config.accessToken) });
            console.log("[Giobby Search] 📡 Status:", res.status, "for", params);
            if (res.ok) {
                const data = await res.json();
                const found = data.contacts || [];
                console.log("[Giobby Search] ✅ Found", found.length, "results for", params, found.map(c => c.name + ' | VAT:' + c.vatCode));
                return found;
            } else {
                const errText = await res.text().catch(() => '');
                console.warn("[Giobby Search] ❌ HTTP", res.status, "for", params, errText.slice(0, 200));
            }
        } catch (e) {
            console.warn("[Giobby Search] 💥 Exception for:", params, e);
        }
        return [];
    };

    // Helper: Sanitize Client Name (Remove "Conferma d'ordine", "Preventivo", etc.)
    const sanitizeClientName = (name) => {
        if (!name) return "";
        let clean = name;
        // Case-insensitive remove of common suffixes
        clean = clean.replace(/conferma\s+d['']?ordine/gi, "");
        clean = clean.replace(/preventivo/gi, "");
        // Remove potential trailing dates or non-alphanumeric noise at end (optional, keeping it simple for now)
        return clean.trim();
    };


    // Helper: Normalize VAT/CF (remove country prefix like "IT", uppercase)
    const normalizeVat = (v) => (v || '').toUpperCase().replace(/^IT/, '').trim();

    // STRATEGY A1: Search by VAT (Strongest)
    if (clientData.vat) {
        const results = await doSearch("?vatCode=" + encodeURIComponent(clientData.vat));
        addCandidates(results, 'vat');
        // Also try without country prefix in case Giobby stores it without "IT"
        const vatStripped = normalizeVat(clientData.vat);
        if (vatStripped !== clientData.vat.toUpperCase()) {
            const results2 = await doSearch("?vatCode=" + encodeURIComponent(vatStripped));
            addCandidates(results2, 'vat_stripped');
        }
    }

    // STRATEGY A2: Search by Fiscal Code
    if (clientData.fiscal_code) {
        const results = await doSearch("?fiscalCode=" + encodeURIComponent(clientData.fiscal_code));
        addCandidates(results, 'fiscal_code');

        // Sometimes Giobby users put fiscal code in vatCode field, let's also search there
        if (!clientData.vat) {
            const resultsFallback = await doSearch("?vatCode=" + encodeURIComponent(clientData.fiscal_code));
            addCandidates(resultsFallback, 'vat_fallback');
        }
    }

    // STRATEGY B: Search by Full Name (Sanitized)
    if (clientData.name) {
        const cleanName = sanitizeClientName(clientData.name);

        // 1. Search with original name (just in case)
        if (cleanName !== clientData.name.trim()) {
            // If sanitizer changed something, we search BOTH original and clean
            const resultsOrg = await doSearch("?freeText=" + encodeURIComponent(clientData.name));
            addCandidates(resultsOrg, 'name_full_original');
        }

        if (cleanName.length > 2) {
            const results = await doSearch("?freeText=" + encodeURIComponent(cleanName));
            addCandidates(results, 'name_full_clean');
        }
    }

    // STRATEGY C: Search by First Token (Broad Search for partial/inverted names)
    if (clientData.name) {
        const cleanName = sanitizeClientName(clientData.name);
        if (cleanName.length > 0) {
            const tokens = cleanName.split(/\s+/).filter(t => t.length > 2);
            if (tokens.length > 0) {
                const firstToken = tokens[0];
                // Only search if it's different from full name (avoid duplicate search)
                if (firstToken !== cleanName) {
                    const results = await doSearch("?freeText=" + encodeURIComponent(firstToken));
                    addCandidates(results, 'name_token');
                }

                // STRATEGY C2: If first token looks like an abbreviation (contains dots, e.g. "L.A.B.A."),
                // also try the second meaningful longer token (e.g. "Libera")
                const isAbbreviation = /[.]/.test(firstToken);
                if (isAbbreviation && tokens.length > 1) {
                    // Find next token without dots and length > 3
                    const secondToken = tokens.find((t, i) => i > 0 && t.length > 3 && !/[.]/.test(t));
                    if (secondToken) {
                        console.log("[Giobby Search] 🔠 Abbreviation detected, trying secondary token:", secondToken);
                        const results2 = await doSearch("?freeText=" + encodeURIComponent(secondToken));
                        addCandidates(results2, 'name_token_secondary');
                    }
                }
            }
        }
    }

    const candidateList = Array.from(candidates.values());

    // STEP 1: Look for Perfect Match
    let bestMatch = null;
    let matchType = null;

    // Check for VAT exact match (normalize both sides: strip country prefix, uppercase)
    if (clientData.vat) {
        const myVat = normalizeVat(clientData.vat);
        const vatMatches = candidateList.filter(c => normalizeVat(c.vatCode) === myVat);
        if (vatMatches.length === 1) {
            bestMatch = vatMatches[0];
            matchType = 'vat_exact';
        } else if (vatMatches.length > 1) {
            console.log("[Giobby Search] ⚠️ Multiple contacts found with the same VAT. Forcing interactive selection instead of auto-matching first.");
        }
    }

    // Check for Fiscal Code exact match (normalize both sides)
    if (!bestMatch && clientData.fiscal_code) {
        const myCf = normalizeVat(clientData.fiscal_code);
        bestMatch = candidateList.find(c =>
            normalizeVat(c.fiscalCode) === myCf ||
            normalizeVat(c.vatCode) === myCf
        );
        if (bestMatch) matchType = 'fiscal_code_exact';
    }

    // Check for Exact Name Match (Case Insensitive)
    if (!bestMatch && clientData.name) {
        bestMatch = candidateList.find(c => c.name && c.name.trim().toLowerCase() === clientData.name.trim().toLowerCase());
        if (bestMatch) matchType = 'name_exact';
    }

    // STEP 2: CONFIRM STRONG MATCH (with detailed logging)
    if (bestMatch) {

        try {
            const useExisting = await showExactMatchConfirmation(clientData, bestMatch, matchType);

            if (useExisting === true) {
                await updateGiobbyClient(config, clientData, bestMatch.id);

                const result = { idContact: bestMatch.id, idCustomer: bestMatch.idCustomer };
                return result;
            } else {
                const newClient = await window.createGiobbyClient(config, clientData);
                return newClient;
            }
        } catch (e) {
            console.error("❌ Error in confirmation dialog:", e);
            throw e;
        }
    }

    // STEP 3: Interactive Selection (if we have candidates but no perfect match)
    if (candidateList.length > 0) {
        try {
            const selectedClient = await showClientSelectionModal_NEW(clientData, candidateList);
            if (selectedClient) {
                await updateGiobbyClient(config, clientData, selectedClient.id);
                return { idContact: selectedClient.id, idCustomer: selectedClient.idCustomer };
            } else {
                // User chose "Create New" from modal
                return await window.createGiobbyClient(config, clientData);
            }
        } catch (e) {
            if (e === 'cancel') throw new Error("Operazione annullata.");
            throw e;
        }
    }

    // STEP 4: Not Found -> Prompt for Creation
    console.warn("❌ No candidates found");
    if (autoCreate || confirm(`Cliente "${clientData.name}" non trovato su Giobby.\n(Nessuna corrispondenza per P.IVA: ${clientData.vat || 'N/A'} o Nome)\n\nVuoi crearlo ora?`)) {
        return await window.createGiobbyClient(config, clientData);
    }

    throw new Error("Cliente non trovato e creazione annullata.");
};

// Confirmation Modal for Exact Match
window.showExactMatchConfirmation = async function (clientData, existingClient, matchType) {
    return new Promise((resolve) => {
        const matchTypeLabel = matchType === 'vat_exact' ? '🏢 P.IVA identica' : '📝 Nome identico';

        // FIX: Build full name from clientData (which should have name + surname separated)
        // Fallback to existingClient.name if clientData doesn't have the full info
        const fullName = [clientData.name, clientData.surname].filter(Boolean).join(' ').trim();
        const displayName = fullName || existingClient.name || 'Nome non disponibile';

        const modalHtml = `
            <div id="giobbyExactMatchModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:200000; backdrop-filter: blur(4px);">
                <div style="background:white; padding:28px; border-radius:12px; width:90%; max-width:550px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);">
                    <div style="text-align:center; margin-bottom:24px;">
                        <div style="width:64px; height:64px; background:#dbeafe; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 16px; font-size:32px;">
                            ✅
                        </div>
                        <h3 style="margin:0 0 8px 0; color:#111827; font-size:22px; font-weight:700;">Cliente Esistente Trovato</h3>
                        <p style="color:#6b7280; margin:0; font-size:14px;">${matchTypeLabel}</p>
                    </div>
                    
                    <div style="background:#f9fafb; border:2px solid #e5e7eb; border-radius:8px; padding:16px; margin-bottom:24px;">
                        <div style="font-weight:600; font-size:16px; color:#111827; margin-bottom:8px;">${displayName}</div>
                        <div style="font-size:13px; color:#6b7280; line-height:1.6;">
                            ${existingClient.vatCode ? '🏢 P.IVA: ' + existingClient.vatCode + '<br>' : ''}
                            ${existingClient.fiscalCode ? '👤 C.F.: ' + existingClient.fiscalCode + '<br>' : ''}
                            ${existingClient.address ? '📍 ' + existingClient.address + '<br>' : ''}
                            ${existingClient.city ? existingClient.city + (existingClient.province ? ' (' + existingClient.province + ')' : '') + '<br>' : ''}
                            ${existingClient.idCustomer ? '🔑 Codice: ' + existingClient.idCustomer : '<span style="color:#f59e0b;">⚠️ Codice Cliente mancante</span>'}
                        </div>
                    </div>

                    <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:12px 16px; border-radius:6px; margin-bottom:24px;">
                        <div style="font-size:13px; color:#92400e; line-height:1.5;">
                            <strong>💡 Cosa succederà:</strong><br>
                            Selezionando "<strong>Usa Esistente</strong>", i dati del cliente su Giobby verranno <strong>aggiornati</strong> con le informazioni del preventivo corrente (indirizzo, telefono, ecc.).
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:12px; flex-direction:column;">
                        <button id="btnUseExisting" style="padding:14px; background:#3b82f6; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600; font-size:15px; transition: background 0.2s;"
                            onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
                            ✅ Usa Esistente e Aggiorna Dati
                        </button>
                        <button id="btnCreateNew" style="padding:12px; background:#f3f4f6; border:1px solid #d1d5db; color:#374151; border-radius:8px; cursor:pointer; font-weight:500; font-size:14px; transition: background 0.2s;"
                            onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                            ➕ Crea Nuovo Cliente Comunque
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('giobbyExactMatchModal');

        document.getElementById('btnUseExisting').onclick = () => {
            modal.remove();
            resolve(true);
        };

        document.getElementById('btnCreateNew').onclick = () => {
            modal.remove();
            resolve(false);
        };

        // ESC key = use existing (default safe choice)
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escHandler);
                modal.remove();
                resolve(true);
            }
        };
        document.addEventListener('keydown', escHandler);
    });
};

// Interactive Selection Modal
window.showClientSelectionModal_NEW = async function (clientData, candidates) {
    return new Promise((resolve, reject) => {
        // Create Modal HTML
        const rowsHtml = candidates.map(c => `
            <div class="candidate-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #e5e7eb; gap:12px; transition: background 0.2s;">
                <div style="flex:1;">
                    <div style="font-weight:600; font-size:15px; color:#111827; margin-bottom:4px;">${c.name || 'Nome non disponibile'}</div>
                    <div style="font-size:13px; color:#6b7280;">
                        ${c.vatCode ? '🏢 P.IVA: ' + c.vatCode : ''}
                        ${c.fiscalCode ? (c.vatCode ? ' | ' : '') + '👤 C.F.: ' + c.fiscalCode : (!c.vatCode ? '👤 Privato' : '')}
                        ${c.city ? ' | 📍 ' + c.city : ''}
                        ${c.province ? ' (' + c.province + ')' : ''}
                    </div>
                    ${!c.idCustomer ? '<div style="font-size:12px; color:#f59e0b; margin-top:4px;">⚠️ Cod. Cliente mancante (verrà rigenerato)</div>' : ''}
                </div>
                <button type="button" class="btn-select-candidate" data-id="${c.id}" 
                    style="padding:8px 16px; background:#3b82f6; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:500; font-size:14px; white-space:nowrap; transition: background 0.2s;"
                    onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
                    Seleziona →
                </button>
            </div>
        `).join('');

        const modalHtml = `
            <div id="giobbySelectionModal_NEW" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:200000; backdrop-filter: blur(4px);">
                <div style="background:white; padding:24px; border-radius:12px; width:90%; max-width:650px; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);">
                    <div style="margin-bottom:20px;">
                        <h3 style="margin:0 0 8px 0; color:#111827; font-size:20px; font-weight:700;">🔍 Clienti Trovati su Giobby</h3>
                        <p style="color:#6b7280; margin:0; font-size:14px;">Ho trovato ${candidates.length} cliente${candidates.length > 1 ? 'i' : ''} simile${candidates.length > 1 ? 'i' : ''} a "<strong>${clientData.name}</strong>". Seleziona quello corretto:</p>
                    </div>
                    
                    <div style="flex:1; overflow-y:auto; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:20px; max-height:400px; background:#f9fafb;">
                        ${rowsHtml}
                    </div>

                    <div style="display:flex; justify-content:space-between; gap:12px; padding-top:16px; border-top:1px solid #e5e7eb;">
                        <button id="giobbySelCancel_NEW" style="padding:10px 20px; background:#f3f4f6; border:1px solid #d1d5db; border-radius:6px; cursor:pointer; font-weight:500; color:#374151; transition: background 0.2s;"
                            onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                            ✕ Annulla
                        </button>
                        <button id="giobbySelCreate_NEW" style="padding:10px 20px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:500; transition: background 0.2s;"
                            onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
                            ➕ Crea Nuovo Cliente: "${clientData.name}"
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('giobbySelectionModal_NEW');

        // Add hover effect to rows
        const rows = modal.querySelectorAll('.candidate-row');
        rows.forEach(row => {
            row.addEventListener('mouseenter', () => row.style.background = '#f3f4f6');
            row.addEventListener('mouseleave', () => row.style.background = 'transparent');
        });

        // Handlers
        const btns = modal.getElementsByClassName('btn-select-candidate');
        for (let btn of btns) {
            btn.onclick = () => {
                const id = btn.getAttribute('data-id');
                const client = candidates.find(c => c.id == id);
                modal.remove();
                resolve(client);
            };
        }

        document.getElementById('giobbySelCreate_NEW').onclick = () => {
            modal.remove();
            resolve(null); // Null implies "Create New"
        };

        document.getElementById('giobbySelCancel_NEW').onclick = () => {
            modal.remove();
            reject('cancel');
        };

        // Close on ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escHandler);
                modal.remove();
                reject('cancel');
            }
        };
        document.addEventListener('keydown', escHandler);
    });
};
