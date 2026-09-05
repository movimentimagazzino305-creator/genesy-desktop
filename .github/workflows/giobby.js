/**
 * Giobby Integration - Export Logic
 * Handles Client Search/Creation and Quote Export
 */

// Auto-migration to ensure 00553 is upgraded to 00554 in localStorage
(function migrateGiobbyStorage() {
    try {
        ['giobbyConfig', 'giobbyConfigROMAGNA', 'giobbyConfigBOLOGNA', 'cruscotto_giobby_config_romagna', 'cruscotto_giobby_config_bologna'].forEach(key => {
            const raw = localStorage.getItem(key);
            if (raw && raw.includes('00553')) {
                const migrated = raw
                    .replace(/GiobbyApi00553/g, 'GiobbyApi00554')
                    .replace(/Giobby00553/g, 'Giobby00554')
                    .replace(/"00553"/g, '"00554"')
                    .replace(/'00553'/g, "'00554'");
                localStorage.setItem(key, migrated);
                console.log(`[Giobby Migration] ✅ Migrata chiave ${key} da 00553 a 00554`);
            }
        });
    } catch (e) {
        console.warn('[Giobby Migration] Errore:', e);
    }
})();

// Helper to get headers
function getGiobbyHeaders(accessToken) {
    return {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        'X-Giobby-Realm': 'api-server'
    };
}

// Helper to sanitize region names for Giobby
function sanitizeRegionForGiobby(regionName) {
    if (!regionName) return "";
    // Giobby stores and validates regions in UPPERCASE (e.g. "EMILIA ROMAGNA").
    // The VAT class lookup is keyed on the uppercase region string.
    // Normalize dashes to spaces, collapse whitespace, then UPPERCASE.
    return regionName.trim()
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

// 0. Agent Authentication (Silent Login)
window.authenticateAgent = async function (username, password, config) {
    // Replicates logic from valid loginToGiobby
    // Config keys in giobbyConfig are: clientId, cid, isQA, useProxy
    const isQA = config.isQA || config.giobbyQA || false;
    const clientId = config.clientId || config.giobbyClientId;
    const cid = config.cid || config.giobbyTenantId; // Tenant ID (e.g. 'parquetromagna')
    const useProxy = config.useProxy || config.giobbyUseProxy || false;

    if (!username || !password || !clientId || !cid) {
        console.error("Agent Auth Missing Data:", { username, hasPass: !!password, clientId, cid });
        throw new Error("Dati mancanti per login agente (User, Pass, ClientID, TenantID)");
    }

    let baseUrlAuth = isQA ? "https://authqa.giobby.com" : "https://auth.giobby.com";
    let tokenUrl = baseUrlAuth + "/auth/realms/api-server/protocol/openid-connect/token";

    if (useProxy) {
        tokenUrl = "https://corsproxy.io/?" + encodeURIComponent(tokenUrl);
    }

    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'password');
    bodyParams.append('client_id', clientId);
    bodyParams.append('username', username);
    bodyParams.append('password', password);
    bodyParams.append('cid', cid);

    try {
        const res = await fetch(tokenUrl, {
            method: 'POST',
            body: bodyParams
        });

        if (!res.ok) {
            let errText = await res.text();
            throw new Error(`Login Agente fallito (${res.status}): ${errText}`);
        }

        const data = await res.json();
        return data.access_token;
    } catch (err) {
        console.error("DEBUG: authenticateAgent error", err);
        throw err;
    }
};

// Show modal dialog for client conflict resolution (Simplified)
async function showClientConflictDialog(clientData, foundClient) {
    return new Promise((resolve) => {
        // DEBUG: Log clientData to diagnose missing surname
        console.log("🔍 [showClientConflictDialog] clientData:", clientData);
        console.log("🔍 [showClientConflictDialog] foundClient:", foundClient);

        // TEMPORARY DEBUG ALERT - Rimuovere dopo fix
        alert("DEBUG: surname = '" + (clientData.surname || "VUOTO") + "' | name = '" + (clientData.name || "VUOTO") + "'");

        // FIX: Build full name from clientData (which has name + surname separated)
        // If surname is empty but name contains spaces, try to split it
        let name = clientData.name || '';
        let surname = clientData.surname || '';

        if (name && !surname && name.includes(' ')) {
            // Name contains space but no surname - split it
            const parts = name.trim().split(/\s+/);
            if (parts.length > 1) {
                surname = parts.pop(); // Last word is surname
                name = parts.join(' '); // Rest is name
                console.log("⚠️ [Modal] Split full name:", { original: clientData.name, name, surname });
            }
        }

        const fullName = [name, surname].filter(Boolean).join(' ').trim();
        const displayName = fullName || foundClient.name || 'Nome non disponibile';
        const customerCode = foundClient.idCustomer ? `Codice: ${foundClient.idCustomer}` : '';

        console.log("✅ [Modal] Display name:", displayName);

        // Create modal HTML
        const modalHtml = `
            <div id="giobbyClientConflictModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                 background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
                <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                    <h3 style="margin-top: 0; color: #333;">Cliente Esistente Trovato</h3>
                    <p>È stato trovato un cliente esistente su Giobby:</p>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <strong>${displayName}</strong><br>
                        ${customerCode ? customerCode + '<br>' : ''}
                        ${foundClient.vatCode ? 'P.IVA: ' + foundClient.vatCode + '<br>' : ''}
                        ${foundClient.address ? foundClient.address + '<br>' : ''}
                    </div>
                    <p>Cosa vuoi fare?</p>
                    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
                        <button id="giobbyUseExisting" style="padding: 12px; border: none; border-radius: 5px; 
                                background: #4CAF50; color: white; cursor: pointer; font-size: 14px;">
                            ✓ Usa Cliente Esistente
                        </button>
                        <button id="giobbyCreateNew" style="padding: 12px; border: none; border-radius: 5px; 
                                background: #FF9800; color: white; cursor: pointer; font-size: 14px;">
                            + Crea Nuovo (Forza Creazione)
                        </button>
                        <button id="giobbyCancel" style="padding: 12px; border: 1px solid #ccc; border-radius: 5px; 
                                background: white; color: #666; cursor: pointer; font-size: 14px;">
                            ✕ Annulla
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Append to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add event listeners
        document.getElementById('giobbyUseExisting').onclick = () => {
            document.getElementById('giobbyClientConflictModal').remove();
            resolve('use');
        };
        // Removed explicit Update button - Use implies Update logic now
        document.getElementById('giobbyCreateNew').onclick = () => {
            document.getElementById('giobbyClientConflictModal').remove();
            resolve('create');
        };
        document.getElementById('giobbyCancel').onclick = () => {
            document.getElementById('giobbyClientConflictModal').remove();
            resolve('cancel');
        };
    });
}

// --- SETTINGS MANAGEMENT ---
// Defer to app.js for loadGiobbySettings to avoid conflict
// window.loadGiobbySettings = ... (Removed)
// window.saveGiobbySettings = ... (Removed)

// ENDPOINT DISCOVERY CACHE
const ENDPOINT_CANDIDATES = {
    'customers': ['contacts', 'customers', 'registry/customers'],
    'customer_write': ['contacts'],
    'documents': ['sales/offers', 'offers', 'orders', 'sales/orders', 'sales/documents', 'export/document'],
    'sales_offers': ['sales/offers', 'offers']
};

async function getEffectiveEndpoint(config, resourceKey) {
    // UPDATED: User docs confirm 'contacts' is the correct endpoint for users/companies
    if (resourceKey === 'customers') return 'contacts';
    if (resourceKey === 'sales_offers') return 'sales/offers';

    // Fallback Probe (from legacy logic, kept for robustness)
    const cacheKey = `giobby_ep_v10_${resourceKey}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached && !config.forceProbe) return cached;

    // Default fallback
    return ENDPOINT_CANDIDATES[resourceKey] ? ENDPOINT_CANDIDATES[resourceKey][0] : resourceKey;
}

// 1b. Helper: Search Giobby Contact (Refactored for reuse)
window.findGiobbyContact = async function (config, searchTerm) {
    if (!searchTerm) return [];

    const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
    let fetchUrl = baseUrl + "contacts";

    // A. VAT/Code Search (Long strings -> VAT)
    if (searchTerm.length >= 11) {
        let url = fetchUrl + "?vatCode=" + encodeURIComponent(searchTerm);
        if (config.useProxy) url = "https://corsproxy.io/?" + encodeURIComponent(url);
        try {
            const res = await fetch(url, { headers: getGiobbyHeaders(config.accessToken) });
            if (res.ok) {
                const data = await res.json();
                if (data.contacts && data.contacts.length > 0) return data.contacts;
            }
        } catch (e) { console.warn("Search helper: VAT scan failed", e); }
    }

    // A2. Short Numeric Search (Likely Customer Code -> try 'code' param)
    // We try specific params to bypass potential FreeText indexing delays
    if (searchTerm.length < 11 && /^\d+$/.test(searchTerm)) {
        const codeParams = ['code', 'customCode', 'idCustomer'];
        for (const param of codeParams) {
            let urlCode = fetchUrl + `?${param}=` + encodeURIComponent(searchTerm);
            if (config.useProxy) urlCode = "https://corsproxy.io/?" + encodeURIComponent(urlCode);
            try {
                const res = await fetch(urlCode, { headers: getGiobbyHeaders(config.accessToken) });
                if (res.ok) {
                    const data = await res.json();
                    if (data.contacts && data.contacts.length > 0) {
                        console.log(`✅ Search helper: Match found via ${param}=${searchTerm}`);
                        return data.contacts;
                    }
                }
            } catch (e) { }
        }
    }

    // B. FreeText Search (Fallback)
    let urlName = fetchUrl + "?freeText=" + encodeURIComponent(searchTerm);
    if (config.useProxy) urlName = "https://corsproxy.io/?" + encodeURIComponent(urlName);
    try {
        const res = await fetch(urlName, { headers: getGiobbyHeaders(config.accessToken) });
        if (res.ok) {
            const data = await res.json();
            if (data.contacts && data.contacts.length > 0) return data.contacts;
        }
    } catch (e) { console.warn("Search helper: FreeText scan failed", e); }

    return [];
};

// 1. Find or Create Client
window.findOrCreateGiobbyClient = async function (config, clientData, autoCreate = false, agentId = null) {
    const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
    let fetchUrl = baseUrl + "contacts";
    let foundClient = null;

    // FIX: Try searching by VAT first (more precise)
    let matchMethod = null; // 'vat', 'name', 'scan', 'direct_id', 'direct_customer_id'

    // === STEP 0: Direct ID Lookup (bypasses Giobby visibility filter) ===
    // Contacts set as "Visibile a me" (private) do NOT appear in search results (freeText, vatCode, etc.)
    // but CAN be accessed directly via GET /contacts/{id} with any valid token.
    // If we have a saved giobbyContactId from a previous export, we use it directly.
    if (clientData.giobbyContactId) {
        try {
            let directUrl = baseUrl + "contacts/" + clientData.giobbyContactId;
            if (config.useProxy) directUrl = "https://corsproxy.io/?" + encodeURIComponent(directUrl);
            const directRes = await fetch(directUrl, { headers: getGiobbyHeaders(config.accessToken) });
            if (directRes.ok) {
                const directContact = await directRes.json();
                if (directContact && (directContact.id || directContact.idCustomer)) {
                    foundClient = directContact;
                    matchMethod = 'direct_id';
                    console.log(`✅ [Step 0] Contatto trovato via ID diretto ("Visibile a me" bypass): id=${directContact.id}, idCustomer=${directContact.idCustomer}`);
                }
            } else {
                console.warn(`[Step 0] GET /contacts/${clientData.giobbyContactId} → HTTP ${directRes.status}. Procedo con ricerca normale.`);
            }
        } catch (e) { console.warn("[Step 0] Direct ID lookup fallito:", e); }
    }

    // === STEP 0b: fallback via idCustomer (se abbiamo il codice cliente ma non il GUID) ===
    if (!foundClient && clientData.giobbyCustomerId) {
        const codeParams = ['idCustomer', 'code', 'customerCode'];
        for (const param of codeParams) {
            if (foundClient) break;
            try {
                let codeUrl = fetchUrl + `?${param}=` + encodeURIComponent(clientData.giobbyCustomerId);
                if (config.useProxy) codeUrl = "https://corsproxy.io/?" + encodeURIComponent(codeUrl);
                const codeRes = await fetch(codeUrl, { headers: getGiobbyHeaders(config.accessToken) });
                if (codeRes.ok) {
                    const codeData = await codeRes.json();
                    const list = codeData.contacts || (Array.isArray(codeData) ? codeData : []);
                    if (list.length > 0) {
                        foundClient = list[0];
                        matchMethod = 'direct_customer_id';
                        console.log(`✅ [Step 0b] Contatto trovato via ${param}=${clientData.giobbyCustomerId}: id=${foundClient.id}`);
                    }
                }
            } catch (e) { console.warn(`[Step 0b] Lookup via ${param} fallito:`, e); }
        }
    }

    if (!foundClient && clientData.vat) {
        let url = fetchUrl + "?vatCode=" + encodeURIComponent(clientData.vat);
        if (config.useProxy) url = "https://corsproxy.io/?" + encodeURIComponent(url);

        try {
            const res = await fetch(url, { headers: getGiobbyHeaders(config.accessToken) });
            if (res.ok) {
                const data = await res.json();
                const list = data.contacts || [];
                if (list.length > 0) {
                    foundClient = list[0];
                    matchMethod = 'vat';
                }
            }
        } catch (e) { console.warn("Search by VAT failed", e); }
    }

    // 2. Fallback: Search by Name (FreeText) if not found by VAT
    if (!foundClient && clientData.name) {
        // FIX: Include surname in search for better match
        const searchName = [clientData.name, clientData.surname].filter(Boolean).join(' ').trim();
        console.log("🔍 Giobby Search - clientData:", { name: clientData.name, surname: clientData.surname, searchName });
        let url = fetchUrl + "?freeText=" + encodeURIComponent(searchName);
        if (config.useProxy) url = "https://corsproxy.io/?" + encodeURIComponent(url);
        try {
            const res = await fetch(url, { headers: getGiobbyHeaders(config.accessToken) });
            if (res.ok) {
                const data = await res.json();
                const list = data.contacts || [];
                if (list.length > 0) {
                    foundClient = list[0];
                    matchMethod = 'name';
                }
            }
        } catch (e) { console.warn("Search by Name failed", e); }
    }

    // 3. Fallback: Scan Default List (Client-side Search)
    if (!foundClient) {
        try {
            // UPDATED: Fetch more contacts (pageSize=500) to increase hit rate on fallback
            let url = fetchUrl + "?pageSize=500";
            if (config.useProxy) url = "https://corsproxy.io/?" + encodeURIComponent(url);
            const res = await fetch(url, { headers: getGiobbyHeaders(config.accessToken) });
            if (res.ok) {
                const data = await res.json();
                const list = data.contacts || [];

                // Tokenize search name for smarter matching (e.g. "Rossi Mario" finds "Mario Rossi")
                // FIX: Include surname in tokens
                const fullSearchName = [clientData.name, clientData.surname].filter(Boolean).join(' ').trim();
                // FIX ANTI-FALSE-MATCH: only keep tokens longer than 3 chars to avoid common short words
                const searchTokens = fullSearchName ? fullSearchName.toLowerCase().split(/\s+/).filter(t => t.length > 3) : [];

                // Strict match on VAT or Smart match on Name
                // FIX: require at least 2 significant tokens OR an exact full-name match
                // to prevent false positives like "Aldo Cammarata" matching on a single token
                foundClient = list.find(c => {
                    if (clientData.vat && c.vatCode === clientData.vat) {
                        matchMethod = 'vat_scan';
                        return true;
                    }

                    if (c.name && searchTokens.length > 0) {
                        const targetName = c.name.toLowerCase();

                        // EXACT FULL NAME MATCH (highest confidence)
                        if (targetName === fullSearchName.toLowerCase()) {
                            matchMethod = 'name_scan_exact';
                            console.log(`✅ [Scan] Exact match: "${c.name}"`);
                            return true;
                        }

                        // REQUIRE at least 2 tokens to match (prevents single-token false positives)
                        if (searchTokens.length >= 2) {
                            const matchCount = searchTokens.filter(token => targetName.includes(token)).length;
                            // All significant tokens must match AND at least 2 of them
                            if (matchCount >= 2 && matchCount === searchTokens.length) {
                                matchMethod = 'name_scan_smart';
                                console.log(`✅ [Scan] Multi-token match (${matchCount}/${searchTokens.length} tokens): "${c.name}"`);
                                return true;
                            }
                        }
                        // Single-token: only allow if it's a long and specific token (> 6 chars)
                        else if (searchTokens.length === 1 && searchTokens[0].length > 6) {
                            if (targetName.includes(searchTokens[0])) {
                                matchMethod = 'name_scan_single_long';
                                console.log(`✅ [Scan] Single long-token match: "${c.name}"`);
                                return true;
                            }
                        }
                    }
                    return false;
                });

                if (foundClient) {
                    console.log(`🔍 [findOrCreateGiobbyClient Scan] Trovato: "${foundClient.name}" (ID: ${foundClient.id}, idCustomer: ${foundClient.idCustomer}) via ${matchMethod}`);
                } else {
                    console.log(`🔍 [findOrCreateGiobbyClient Scan] Nessun match su ${list.length} contatti per "${fullSearchName}" (tokens: ${JSON.stringify(searchTokens)})`);
                }
            }
        } catch (e) { console.warn("Fallback scan failed", e); }
    }


    // If found, show dialog (unless autoCreate is set to skip dialog)
    if (foundClient) {
        // VALIDATION & FIX: Check if idCustomer is present
        // If missing, we MUST fix it or consider the client 'invalid' (effectively not found for our purposes)
        if (!foundClient.idCustomer) {
            console.warn("Cliente Giobby trovato ma senza idCustomer. Tento aggiornamento per forzare assegnazione...", foundClient);

            try {
                // Tentativo di aggiornamento per forzare Giobby a generare idCustomer
                await updateGiobbyClient(config, clientData, foundClient.id, agentId);

                // Rileggiamo il contatto aggiornato per vedere se ora ha il codice
                const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
                let refreshUrl = baseUrl + "contacts/" + foundClient.id;
                if (config.useProxy) refreshUrl = "https://corsproxy.io/?" + encodeURIComponent(refreshUrl);

                const refreshRes = await fetch(refreshUrl, { headers: getGiobbyHeaders(config.accessToken) });
                if (refreshRes.ok) {
                    const refreshed = await refreshRes.json();
                    if (refreshed.idCustomer) {
                        foundClient.idCustomer = refreshed.idCustomer; // Update local reference
                        foundClient = refreshed;
                    }
                }
            } catch (e) {
                console.warn("Tentativo di fix idCustomer fallito:", e);
            }

            // NEW STRATEGY: PROMOTE CONTACT TO CUSTOMER
            // If we have a Contact ID but no Customer ID, we must "create" the customer using the same data.
            // This is effectively a "Promotion" in Giobby.
            if (!foundClient.idCustomer) {
                console.warn("Manca idCustomer. Tento PROMOZIONE a Cliente (Create)...");
                try {
                    // Force Creation to generate Customer ID
                    const promoResult = await window.createGiobbyClient(config, clientData, agentId);
                    if (promoResult && promoResult.idCustomer) {
                        foundClient.idCustomer = promoResult.idCustomer;
                        // We might also get a new idContact, but usually we just want the customer code
                    }
                } catch (promoErr) {
                    console.error("Promozione fallita:", promoErr);
                    // If promotion fails, we proceed without idCustomer. 
                    // The mapping logic will then fallback to CLI_DEFAULT (Occasional) to at least allow export.
                }
            }
        }

        if (foundClient) {
            // --- AUTO-ACCEPT LOGIC ---
            // If we found it via VAT (Strong) or Exact Name (Strong), we skip the dialog!
            const isExactName = foundClient.name && clientData.name && foundClient.name.trim().toLowerCase() === clientData.name.trim().toLowerCase();

            if (matchMethod === 'vat' || isExactName) {
                // Proceed as if 'use' was chosen
                await updateGiobbyClient(config, clientData, foundClient.id, agentId);
                return { idContact: foundClient.id, idCustomer: foundClient.idCustomer };
            }

            if (autoCreate) {
                // ... existing autoCreate logic ...
                await updateGiobbyClient(config, clientData, foundClient.id, agentId);
                return { idContact: foundClient.id, idCustomer: foundClient.idCustomer };
            }

            const choice = await showClientConflictDialog(clientData, foundClient);

            if (choice === 'use' || choice === 'update') {
                // OPTIMIZATION: Always update on 'use' to ensure address/data is fresh
                await updateGiobbyClient(config, clientData, foundClient.id, agentId);
                return { idContact: foundClient.id, idCustomer: foundClient.idCustomer };
            } else if (choice === 'create') {
                // Force create new even if name exists
                return await window.createGiobbyClient(config, clientData, agentId);
            } else {
                // 'cancel'
                throw new Error("Operazione annullata dall'utente.");
            }
        }
    }

    // Still not found? Create it!
    if (autoCreate || confirm(`Cliente "${clientData.name}" non trovato su Giobby.\n(Nessuna corrispondenza per P.IVA: ${clientData.vat || 'N/A'} o Nome)\n\nVuoi crearlo ora?`)) {
        return await window.createGiobbyClient(config, clientData, agentId);
    }

    throw new Error("Cliente non trovato e creazione annullata.");
};

// (fetchGiobbyUsers — using robust multi-endpoint version at line ~738)\r\n
// UPDATED: Uses POST /customers to guarantee ID assignment
window.createGiobbyClient = async function (config, clientData, agentId = null) {
    const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
    // Use /customers endpoint as verified by experiment
    let url = baseUrl + "customers";
    if (config.useProxy) url = "https://corsproxy.io/?" + encodeURIComponent(url);

    // Determine Type
    // Genesy explicitly sets clientData.type to 'private' or 'company'
    let isPrivate = clientData.type === 'private';

    // Fallback for legacy clients without 'type' explicit field
    if (!clientData.type) {
        if (clientData.fiscal_code && clientData.fiscal_code.length === 16 && !clientData.vat) {
            isPrivate = true;
        } else if (clientData.vat && clientData.vat.length === 16) {
            isPrivate = true; // Legacy fallback
        }
    }

    let stateVal = clientData.state || clientData.region || "";
    if (!stateVal && clientData.addressProvince && window.inferRegionFromProvince) {
        stateVal = window.inferRegionFromProvince(clientData.addressProvince);
    }
    stateVal = sanitizeRegionForGiobby(stateVal);

    // Construct Nested Payload
    // Note: The API requires the contact data to be inside a "contact" object
    const contactPayload = {
        "type": isPrivate ? "PRIVATE_PERSON" : "COMPANY",
        "vatCode": isPrivate ? "" : (clientData.vat || ""),
        "fiscalCode": clientData.fiscal_code || (isPrivate ? (clientData.vat || "") : ""),
        "address": clientData.address || "",
        "city": clientData.city || "",
        "postalCode": clientData.zip || "",
        "pr": clientData.addressProvince || "",
        "region": stateVal,
        "stateOrRegion": stateVal,
        "state": stateVal,
        "country": (clientData.country || "Italia").toLowerCase() === "italia" ? "IT" : (clientData.country || "IT"),
        "email": clientData.email || "",
        "certifiedEmail": clientData.pec || "",
        "phone": clientData.phoneOffice || clientData.phoneHome || clientData.phone || "",
        "mobile": clientData.mobile || "",
        "fax": clientData.fax || "",
        "electronicInvoicingCode": clientData.sdi || "",
        "status": "ACTIVE",
        "visibilityType": "ALL",
        "source": "Antigravity/Genesy"
    };

    // Handle Name/Surname split based on contact type
    if (isPrivate) {
        // For private persons, use separate name and lastName fields
        contactPayload.name = clientData.name || "";
        contactPayload.lastName = clientData.surname || "";
    } else {
        // For companies, combine name and surname as company name
        const fullName = [clientData.name, clientData.surname].filter(Boolean).join(" ").trim();
        contactPayload.name = fullName || clientData.name || "";
        // EXPLICITLY omit lastName for COMPANY to prevent API error 400 (errorCode: 2101)
    }

    // Agent Assignment & Ownership Transfer
    if (agentId) {
        contactPayload.idSalesman = String(agentId);
        contactPayload.idUserAgent1 = parseInt(agentId);

        // Force Ownership to Agent (Simulate "Created By Agent")
        // We try multiple common keys since API is undocumented
        contactPayload.idOwner = String(agentId);
        contactPayload.ownerId = String(agentId);
        // contactPayload.idCreator = String(agentId); // Less likely but possible
    }

    const fullPayload = {
        "contact": contactPayload,
        "currency": "EUR",
        "priceListEnabled": false
    };

    // GIOBBY FIX: The agent assignment for a Customer belongs to the Customer root, not just the Contact object!
    if (agentId) {
        fullPayload.idSalesman = String(agentId);
        fullPayload.idUserAgent1 = parseInt(agentId);
        fullPayload.idOwner = String(agentId);
        fullPayload.ownerId = String(agentId);
    }

    let res = await fetch(url, {
        method: 'POST',
        headers: getGiobbyHeaders(config.accessToken),
        body: JSON.stringify(fullPayload)
    });

    // RETRY STRATEGY FOR AGENTS (Permission Issues)
    // Agents might not have permission to set "visibilityType: ALL" or "source".
    // If the first attempt fails, we try a "Safe Payload".
    if (!res.ok) {
        console.warn("Standard Create failed. Retrying with SAFE payload (Agent Compatibility)...");

        const safeContact = { ...contactPayload };
        delete safeContact.visibilityType; // Often restricted for Agents
        // delete safeContact.source; // Optional: keep unless proven problematic

        const safePayload = {
            ...fullPayload, // Preserve root agent assignments (idSalesman, idOwner)
            contact: safeContact
        };

        const retryRes = await fetch(url, {
            method: 'POST',
            headers: getGiobbyHeaders(config.accessToken),
            body: JSON.stringify(safePayload)
        });

        if (retryRes.ok) {
            res = retryRes; // Override response with the successful one
        } else {
            console.warn("Safe Creation also failed:", await retryRes.text());
            // We fall through to the original error handling with the original 'res' (or we could expose the retry error)
            // Let's stick to the original 'res' error unless we want to be very specific. 
            // Better yet, if retry failed, let's keep the original error which might be more descriptive?
            // Actually, usually the first error is "Permission Denied" and second might be same or different.
        }
    }

    if (!res.ok) {
        const txt = await res.text();
        throw new Error("Errore creazione cliente: " + txt);
    }

    // Now expecting JSON with idCustomer
    const data = await res.json();

    // Prioritize the direct idCustomer field from the new endpoint
    let newIdCustomer = data.idCustomer;
    // We might not get 'idContact' directly in this response, but usually 'id' or 'responseCode'
    // If idContact is missing, we might need to rely on lookup or just proceed if idCustomer is enough.
    // However, findOrCreate usually returns {idContact, idCustomer}.
    // Let's check if 'id' is present (might be the contact ID or customer ID).
    // In the trace provided: "idCustomer": "1639"

    // We need an internal contact ID for other operations?
    // If not returned, we might have issues if we try to link purely by contact ID later.
    // But mapQuoteToGiobbyModel uses 'idContact' AND 'idCustomer'.
    // If we only have idCustomer, is that enough? 
    // The previous logic for mapQuoteToGiobbyModel says: "idContact must be populated".
    // Let's assume for now we use idCustomer as idContact if missing, OR we do a quick lookup by code.

    let newIdContact = data.id || data.contactId; // Guessing

    // FIX: If newIdContact is missing OR it looks like a numeric ID (length < 20),
    // it implies we didn't get the GUID. We MUST attempt to resolve it via search.
    // Otherwise Update will fail (404/Bad Request).
    const isInvalidGuid = !newIdContact ;

    if (isInvalidGuid && newIdCustomer) {
        console.warn("New endpoint returned numeric idCustomer but no valid idContact GUID. Attempting resolution...");

        // FIX: Always use Admin Token for resolution to bypass Agent visibility restrictions
        let adminConfig = config; 
        try {
            const _adminCfgRaw = localStorage.getItem('giobbyConfig');
            if (_adminCfgRaw) {
                const _parsed = JSON.parse(_adminCfgRaw);
                if (_parsed && _parsed.accessToken) adminConfig = _parsed;
            }
        } catch(e) {}

        // STRATEGY 1: Direct Fetch via /customers/{id}
        // Since we just created it via POST /customers, GET /customers/{id} should exist.
        try {
            const baseUrl = adminConfig.apiUrl.endsWith('/') ? adminConfig.apiUrl : adminConfig.apiUrl + '/';
            let urlFetch = baseUrl + "customers/" + newIdCustomer;
            if (adminConfig.useProxy) urlFetch = "https://corsproxy.io/?" + encodeURIComponent(urlFetch);
            const resFetch = await fetch(urlFetch, { headers: getGiobbyHeaders(adminConfig.accessToken) });

            if (resFetch.ok) {
                const custData = await resFetch.json();
                // GUID Resolution Logic
                if (custData.id ) {
                    newIdContact = custData.id;
                } else if (custData.contactId ) {
                    newIdContact = custData.contactId;
                } else if (custData.contact && custData.contact.id ) {
                    newIdContact = custData.contact.id; // Nested contact object
                }
            } else {
                console.warn("Resolution: GET /customers/" + newIdCustomer + " failed (" + resFetch.status + ")");

                // STRATEGY 1b: Try 'registry/customers' (Legacy/Alternate path)
                try {
                    let urlRegistry = baseUrl + "registry/customers/" + newIdCustomer;
                    if (adminConfig.useProxy) urlRegistry = "https://corsproxy.io/?" + encodeURIComponent(urlRegistry);
                    const resReg = await fetch(urlRegistry, { headers: getGiobbyHeaders(adminConfig.accessToken) });
                    if (resReg.ok) {
                        const regData = await resReg.json();
                        if (regData.id ) {
                            newIdContact = regData.id;
                        } else if (regData.contact && regData.contact.id ) {
                            newIdContact = regData.contact.id;
                        }
                    }
                } catch (e) { }
            }
        } catch (fetchErr) {
            console.warn("Resolution: Direct fetch error", fetchErr);
        }

        // STRATEGY 1c: Search contacts by ?idCustomer= and ?code= (most reliable for numeric codes)
        if (!newIdContact) {
            const baseUrl = adminConfig.apiUrl.endsWith('/') ? adminConfig.apiUrl : adminConfig.apiUrl + '/';
            const codeSearchUrls = [
                baseUrl + "contacts?idCustomer=" + newIdCustomer,
                baseUrl + "contacts?code=" + newIdCustomer,
                baseUrl + "contacts?customerCode=" + newIdCustomer
            ];
            for (const rawUrl of codeSearchUrls) {
                if (newIdContact ) break;
                try {
                    let searchUrl = adminConfig.useProxy ? "https://corsproxy.io/?" + encodeURIComponent(rawUrl) : rawUrl;
                    const res = await fetch(searchUrl, { headers: getGiobbyHeaders(adminConfig.accessToken) });
                    if (res.ok) {
                        const data = await res.json();
                        const contacts = data.contacts || data.items || (Array.isArray(data) ? data : []);
                        const found = contacts.find(c =>
                            c.idCustomer == newIdCustomer || c.code == newIdCustomer || c.customerCode == newIdCustomer
                        ) || (contacts.length === 1 ? contacts[0] : null);
                        if (found && found.id ) {
                            newIdContact = found.id;
                            console.log(`✅ [GUID] Trovato via code search: ${rawUrl} → ${newIdContact}`);
                        }
                    }
                } catch (_e) { console.warn('Strategy 1c failed for', rawUrl, _e); }
            }
        }

        // STRATEGY 2 (FAST ADMIN FALLBACK): Prova subito con token admin prima dei retry lenti
        // Il token agente spesso non ha accesso al listing completo.
        // Il token admin (globale) vede tutto — questo dovrebbe risolvere immediatamente nella maggior parte dei casi.
        if (!newIdContact) {
            try {
                const _adminCfgRaw = localStorage.getItem('giobbyConfig');
                if (_adminCfgRaw) {
                    const _adminCfg = JSON.parse(_adminCfgRaw);
                    if (_adminCfg && _adminCfg.accessToken) {
                        console.log('🔧 [GUID S2] Lookup immediato con token admin...');
                        // Wait briefly to let Giobby propagate the new record
                        await new Promise(r => setTimeout(r, 2000));
                        const searchTerms = [newIdCustomer, clientData.vat, clientData.name].filter(Boolean);
                        for (const term of searchTerms) {
                            if (newIdContact ) break;
                            const adminResults = await window.findGiobbyContact(_adminCfg, String(term));
                            if (adminResults && adminResults.length > 0) {
                                const adminMatch = adminResults.find(c =>
                                    String(c.idCustomer) === String(newIdCustomer) ||
                                    String(c.code) === String(newIdCustomer)
                                ) || (adminResults.length === 1 ? adminResults[0] : null);
                                if (adminMatch && adminMatch.id ) {
                                    newIdContact = adminMatch.id;
                                    console.log(`✅ [GUID S2] Risolto con token admin (fast): ${newIdContact}`);
                                }
                            }
                        }
                    }
                }
            } catch (_s2Err) {
                console.warn('[GUID S2] Fast admin lookup fallito:', _s2Err);
            }
        }

        // STRATEGY 3: Search with RETRY (Slow Fallback — usato solo se tutto il resto ha fallito)
        if (!newIdContact) {
            const maxRetries = 5;
            // Aumentati i delay perché Giobby QA o Prod può essere molto lento ad indicizzare nuovi record
            const delays = [4000, 6000, 10000, 15000, 20000]; // Total ~55s

            for (let i = 0; i < maxRetries; i++) {
                if (newIdContact ) break;
                try {
                    await new Promise(r => setTimeout(r, delays[i]));

                    // IMPROVED SEARCH STRATEGY: Code -> VAT -> Fiscal Code -> Name
                    const searchTerms = [];
                    if (newIdCustomer) searchTerms.push(newIdCustomer);
                    if (clientData.vat) searchTerms.push(clientData.vat);
                    if (clientData.fiscal_code) searchTerms.push(clientData.fiscal_code);
                    if (clientData.name) searchTerms.push(clientData.name);

                    // Try both agent token and admin token
                    const configsToTry = [config];
                    try {
                        const _raw = localStorage.getItem('giobbyConfig');
                        if (_raw) {
                            const _adm = JSON.parse(_raw);
                            if (_adm && _adm.accessToken) configsToTry.push(_adm);
                        }
                    } catch (_) { }

                    for (const cfg of configsToTry) {
                        if (newIdContact ) break;
                        for (const term of searchTerms) {
                            if (newIdContact ) break;
                            const searchResults = await window.findGiobbyContact(cfg, term);

                            if (searchResults && searchResults.length > 0) {
                                const match = searchResults.find(c =>
                                    (newIdCustomer && (c.idCustomer == newIdCustomer || c.code == newIdCustomer)) ||
                                    (clientData.vat && c.vatCode === clientData.vat)
                                ) || searchResults[0];

                                if (match && match.id) {
                                    newIdContact = match.id;
                                }
                            }
                        }
                    }
                } catch (retryErr) { console.warn("Retry failed", retryErr); }
            }
        }
    }

    // STRATEGY 4 (ULTIMO FALLBACK): tentativo finale con admin (nel caso tutto il resto fallisca)
    if (!newIdContact) {
        try {
            const _adminCfgRaw = localStorage.getItem('giobbyConfig');
            if (_adminCfgRaw) {
                const _adminCfg = JSON.parse(_adminCfgRaw);
                if (_adminCfg && _adminCfg.accessToken) {
                    console.log('🔧 [GUID S4] Ultimo tentativo con token admin...');
                    const searchTerms = [newIdCustomer, clientData.vat, clientData.name].filter(Boolean);
                    for (const term of searchTerms) {
                        if (newIdContact ) break;
                        const adminResults = await window.findGiobbyContact(_adminCfg, String(term));
                        if (adminResults && adminResults.length > 0) {
                            const adminMatch = adminResults.find(c =>
                                String(c.idCustomer) === String(newIdCustomer) ||
                                String(c.code) === String(newIdCustomer)
                            ) || adminResults[0];
                            if (adminMatch && adminMatch.id ) {
                                newIdContact = adminMatch.id;
                                console.log(`✅ [GUID S4] Risolto con token admin (last resort): ${newIdContact}`);
                            }
                        }
                    }
                }
            }
        } catch (_s4Err) {
            console.warn('[GUID S4] Last resort admin fallback fallita:', _s4Err);
        }
    }

    // FINALIZATION: Force Update/Refinement of Data (using ADMIN token to ensure agent assignment sticks)
    if (newIdContact ) {
        try {
            let adminConfig = config; 
            try {
                const _cfg = localStorage.getItem('giobbyConfig');
                if (_cfg) {
                    const _p = JSON.parse(_cfg);
                    if (_p && _p.accessToken) adminConfig = _p;
                }
            } catch(e) {}
            await window.updateGiobbyClient(adminConfig, clientData, newIdContact, agentId);
        } catch (updErr) { console.warn("Follow-up Update failed:", updErr); }
    } else {
        console.warn(`[GUID WARNING] Cliente creato in Giobby (idCustomer: ${newIdCustomer}) ma idContact (GUID) non rintracciato nei tempi previsti. L'export preventivo userà il fallback Cliente Occasionale temporaneamente.`);
        // Non blocchiamo l'esportazione con un alert intrusivo che rompe il flusso del preventivo,
        // ma ritorniamo il newIdCustomer sperando che il preventivo si adatti,
        // oppure forziamo idContact nullo in modo che mapQuoteToGiobbyModel fall-backhi a CLI_DEFAULT.
    }

    return { idContact: newIdContact || "", idCustomer: newIdCustomer || "" };
};

window.updateGiobbyClient = async function (config, clientData, contactId, agentId = null) {
    if (!contactId) return;


    // DEBUG: Log what we're receiving

    const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';

    // Step 1: GET existing contact to have full object
    let getUrl = baseUrl + "contacts/" + contactId;
    if (config.useProxy) getUrl = "https://corsproxy.io/?" + encodeURIComponent(getUrl);

    let existingContact = null;
    try {
        const getRes = await fetch(getUrl, {
            method: 'GET',
            headers: getGiobbyHeaders(config.accessToken)
        });

        if (getRes.ok) {
            existingContact = await getRes.json();
        } else {
            console.warn("Could not fetch existing contact, will create payload from scratch");
        }
    } catch (e) {
        console.warn("GET contact failed:", e);
    }

    // Step 2: Merge existing data with new data
    let isPrivate = clientData.type === 'private';

    // Fallback for legacy clients without 'type' explicit field
    if (!clientData.type) {
        if (clientData.fiscal_code && clientData.fiscal_code.length === 16 && !clientData.vat) {
            isPrivate = true;
        } else if (clientData.vat && clientData.vat.length === 16) {
            isPrivate = true; // Legacy fallback
        }
    }

    // Start with existing contact or create new payload
    const payload = existingContact || {
        "id": contactId,
        "status": "ACTIVE",
        "visibilityType": "ALL"
    };

    // Update with new data (override only fields we have)
    // Only update fields that have actual values to avoid overwriting with empty strings
    payload.id = contactId;
    payload.type = isPrivate ? "PRIVATE_PERSON" : "COMPANY";

    // Handle Name/Surname split based on contact type
    if (isPrivate) {
        // For private persons, use separate name and lastName fields
        if (clientData.name) payload.name = clientData.name;
        if (clientData.surname) payload.lastName = clientData.surname;
    } else {
        // For companies, combine name and surname as company name
        const fullName = [clientData.name, clientData.surname].filter(Boolean).join(" ").trim();
        if (fullName) payload.name = fullName;
        else if (clientData.name) payload.name = clientData.name;

        // EXPLICITLY omit lastName for COMPANY to prevent API error 400 (errorCode: 2101)
        delete payload.lastName;
    }

    if (clientData.vat) payload.vatCode = clientData.vat;
    if (clientData.fiscal_code) payload.fiscalCode = clientData.fiscal_code;
    else if (isPrivate && clientData.vat) payload.fiscalCode = clientData.vat; // Fallback if fiscal_code missing but it's private


    if (clientData.address) payload.address = clientData.address;
    if (clientData.city) payload.city = clientData.city;
    if (clientData.zip) payload.postalCode = clientData.zip;
    if (clientData.addressProvince) payload.pr = clientData.addressProvince;
    // CRITICAL FIX: Explicitly null out all region/state fields on the payload.
    // updateGiobbyClient fetches the existing contact as the base payload (line above),
    // and the existing contact may already have region="Emilia Romagna" from a previous sync.
    // Giobby uses the customer record's region for VAT class lookup — if region is set,
    // it looks for a specific IT/REGION VAT class entry that is NOT configured (only
    // "Tutte le nazioni" is). Setting to null (not empty string!) tells Giobby to clear it.
    // NOTE: Giobby returns 500 if these are set to "" (empty string); null is required.
    payload.region = null;
    payload.state = null;
    payload.stateOrRegion = null;
    // NOTE: Do NOT sync state/region to the Giobby customer record.
    // Giobby uses the customer record's region for VAT class lookup.
    // Since only "Tutte le nazioni" is configured (not IT/REGION-specific entries),
    // setting a region on the customer causes Giobby to look for a specific
    // IT/REGION VAT class entry that does not exist → export fails.
    // Leaving region empty forces Giobby to use "Tutte le nazioni" → VAT class found ✓

    if (clientData.country) {
        payload.country = (clientData.country.toLowerCase() === 'italia') ? 'IT' : clientData.country;
    }
    if (clientData.email) payload.email = clientData.email;
    if (clientData.pec) payload.certifiedEmail = clientData.pec;
    if (clientData.phone || clientData.phoneOffice || clientData.phoneHome) {
        payload.phone = clientData.phoneOffice || clientData.phoneHome || clientData.phone;
    }
    if (clientData.mobile) payload.mobile = clientData.mobile;
    if (clientData.fax) payload.fax = clientData.fax;
    if (clientData.sdi) payload.electronicInvoicingCode = clientData.sdi;

    // Agent Assignment Update
    if (agentId) {
        payload.idSalesman = String(agentId);
        payload.idUserAgent1 = parseInt(agentId); 
        payload.idOwner = String(agentId);
        payload.ownerId = String(agentId);
    }

    payload.status = "ACTIVE";
    payload.visibilityType = "ALL";

    // Step 3: PUT updated contact
    let putUrl = baseUrl + "contacts/" + contactId;
    if (config.useProxy) putUrl = "https://corsproxy.io/?" + encodeURIComponent(putUrl);

    const res = await fetch(putUrl, {
        method: 'PUT',
        headers: getGiobbyHeaders(config.accessToken),
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const txt = await res.text();
        console.error("Update Client Failed. Payload:", JSON.stringify(payload, null, 2));
        console.error("Response:", txt);
        throw new Error("Errore aggiornamento cliente: " + txt);
    }
};

// 209: NEW: Auto-Sync Function
window.syncSingleClientToGiobby = async function (clientData) {
    const jsonConfig = localStorage.getItem('giobbyConfig');
    if (!jsonConfig) {
        throw new Error("Configurazione Giobby mancante. Vai in Impostazioni.");
    }
    const config = JSON.parse(jsonConfig);

    try {
        // Pass "true" to skip second confirmation, since we asked in app.js
        const result = await findOrCreateGiobbyClient(config, clientData, true);
        return result; // Return full object { idContact, idCustomer }
    } catch (e) {
        console.error("Auto-Sync Error:", e);
        throw e;
    }
};

// 268: Fetch Numerators
window.fetchGiobbyNumerators = async function (config) {
    const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
    const candidates = ["numerators", "registry/numerators"];


    for (const ep of candidates) {
        let url = baseUrl + ep;
        if (config.useProxy) url = "https://corsproxy.io/?" + encodeURIComponent(url);
        try {
            const res = await fetch(url, { headers: getGiobbyHeaders(config.accessToken) });
            if (res.ok) {
                const data = await res.json();
                const list = data.numerators || data;
                if (Array.isArray(list) && list.length > 0) return list;
            }
        } catch (e) { console.warn("Fetch Numerators failed for " + ep, e); }
    }
    return [];
};

// Fetch VAT classes from Giobby to discover the correct idVat code for 0%/RC
window.fetchGiobbyVatClasses = async function (config) {
    const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
    const candidates = ["registry/vatclasses", "vatclasses", "registry/vat", "vat", "accounting/vatclasses", "config/vatclasses"];
    for (const ep of candidates) {
        let url = baseUrl + ep;
        if (config.useProxy) url = "https://corsproxy.io/?url=" + encodeURIComponent(url);
        try {
            const res = await fetch(url, { headers: getGiobbyHeaders(config.accessToken) });
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data) ? data : (data.vatClasses || data.vatclasses || data.items || data.objects || []);
                if (Array.isArray(list) && list.length > 0) {
                    console.log(`✅ [fetchGiobbyVatClasses] Found ${list.length} VAT classes at "${ep}":`, JSON.stringify(list.slice(0, 5)));
                    return list;
                }
            }
        } catch (e) { console.warn("Fetch VAT classes failed for " + ep, e); }
    }
    return [];
};

// 300: NEW: Fetch Users (Agents)
window.fetchGiobbyUsers = async function (config) {
    const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
    // Try multiple endpoints to be safe
    const candidates = ["users", "registry/users", "sales/salesmen"];

    for (const ep of candidates) {
        let url = baseUrl + ep;
        if (config.useProxy) url = "https://corsproxy.io/?" + encodeURIComponent(url);

        try {
            const res = await fetch(url, { headers: getGiobbyHeaders(config.accessToken) });
            if (res.ok) {
                const data = await res.json();
                // Normalize list
                const list = Array.isArray(data) ? data : (data.users || data.items || data.salesmen || []);

                if (list.length > 0) {
                    // DEBUG: log primo elemento per scoprire la struttura reale
                    console.log(`🔍 [fetchGiobbyUsers] endpoint "${ep}" - primo elemento:`, JSON.stringify(list[0]));

                    // Map to standard format { id, name, username }
                    // Campi reali API Giobby: idUser, firstname, lastname
                    return list.map(u => {
                        const id = u.idUser || u.id || u.userId || u.idSalesman || u.code;
                        const username = u.username || u.login || u.email || u.userName || "";
                        // Combina firstname+lastname (campo reale API Giobby)
                        const name =
                            u.fullName ||
                            u.displayName ||
                            ((u.firstname || u.firstName || u.nome)
                                ? `${(u.firstname || u.firstName || u.nome || '').trim()} ${(u.lastname || u.lastName || u.cognome || u.surname || '').trim()}`.trim()
                                : null) ||
                            u.name ||
                            u.lastname || u.lastName ||
                            u.description ||
                            username ||
                            `ID:${id}`;
                        return { id, name, username };
                    });
                }
            }
        } catch (e) {
            console.warn("Fetch Users failed for " + ep, e);
        }
    }
    return [];
};


// ===========================================================================
// PRODUCT CATALOG LOOKUP
// ===========================================================================

// ===========================================================================
// CLIENT HISTORY EXTENSION
// ===========================================================================

/**
 * Validates Giobby Config and returns headers/base url
 */
function getGiobbyContext() {
    const jsonConfig = localStorage.getItem('giobbyConfig');
    if (!jsonConfig) throw new Error("Giobby non configurato.");
    const config = JSON.parse(jsonConfig);
    const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
    return { config, baseUrl };
}


/**
 * Fetches Documents for a specific Client from Giobby.
 * Types: Preventivi, Ordini Cliente, DDT, Entrata Merci, Ordine Fornitore
 * Filters client-side by contactId (Giobby API may ignore server-side filter).
 * @param {Object} client - The local client object
 */
window.fetchGiobbyDocuments = async function (client) {
    if (!client) return [];

    // 1. Get Context
    const { config, baseUrl } = getGiobbyContext();

    // Diagnostica: mostra config e client in console
    console.log('[CRM Giobby] 🔍 fetchGiobbyDocuments chiamato per cliente:', {
        name: client.name,
        surname: client.surname,
        vat: client.vat,
        giobbyContactId: client.giobbyContactId,
        giobbyCustomerId: client.giobbyCustomerId
    });
    console.log('[CRM Giobby] 🔑 Config apiUrl:', config.apiUrl, '| useProxy:', config.useProxy);

    // Extract company ID from apiUrl for building UI links
    // apiUrl examples:
    //   "https://app.giobby.com/GiobbyApi00554/v1/"  -> companyId = "GiobbyApi00554"
    //   "https://qa.giobby.com/GiobbyApi00554/v1/"   -> companyId = "GiobbyApi00554"
    const companyMatch = config.apiUrl.match(/\/(GiobbyApi\d+)\//i);
    const companyId = companyMatch ? companyMatch[1] : null;
    const giobbyBase = companyId ? `https://app.giobby.com/${companyId.replace('Api', '')}/company/` : null;

    // 2. Resolve Contact ID
    // Per API reale: GET /contacts restituisce { id: 994 (numerico), idCustomer: "114" (stringa) }
    // I documenti usano { idContact: 994 (numerico), idCustomer: "CLI_DEFAULT" (stringa) }
    // Quindi il campo chiave per filtrare è idContact numerico = id del contatto
    let giobbyContactId = client.giobbyContactId;   // id numerico del contatto
    let giobbyCustomerCode = client.giobbyCustomerId; // codice cliente stringa (es. "114")

    if (!giobbyContactId) {
        const searchTerms = [];
        if (client.vat) searchTerms.push(client.vat);
        if (client.codice_fiscale) searchTerms.push(client.codice_fiscale);
        const fullName = (client.name + " " + (client.surname || "")).trim();
        if (fullName) searchTerms.push(fullName);

        for (const term of searchTerms) {
            if (!term) continue;
            try {
                const results = await window.findGiobbyContact(config, term);
                if (results && results.length > 0) {
                    // API reale: results[0].id è numerico (es. 994)
                    giobbyContactId = results[0].id;
                    // results[0].idCustomer è il codice stringa (es. "114")
                    if (results[0].idCustomer) giobbyCustomerCode = String(results[0].idCustomer);
                    console.log('[CRM Giobby] Found contact via search:', results[0]);
                    break;
                }
            } catch (e) { console.warn("Search failed for", term, e); }
        }
    }

    if (!giobbyContactId) {
        console.warn("[CRM Giobby] ❌ Cliente non trovato su Giobby, impossibile recuperare documenti.");
        console.log('[CRM Giobby] Termini cercati:', [
            client.vat,
            client.codice_fiscale,
            (client.name + ' ' + (client.surname || '')).trim()
        ].filter(Boolean));
        return [];
    }

    console.log("[CRM Giobby] Resolved contactId (numeric):", giobbyContactId, "| customerCode:", giobbyCustomerCode);

    // 3. Define document types to fetch
    // Tutti gli endpoint Giobby — il 404 viene gestito silenziosamente
    // ftrID: parametro richiesto dall'URL di Giobby per aprire il documento corretto
    const docTypes = [
        { endpoint: 'sales/offers', label: 'Preventivo', xhtmlPage: 'Offer.xhtml', ftrID: 'offer_v', extraParams: '' },
        { endpoint: 'sales/orders', label: 'Ordine Cliente', xhtmlPage: 'Order.xhtml', ftrID: 'odv_v', extraParams: '&iddocumenttype=3' },
        { endpoint: 'purchases/orders', label: 'Ordine Fornitore', xhtmlPage: 'Order.xhtml', ftrID: 'oda_v', extraParams: '' },
        { endpoint: 'purchases/goodsreceipt', label: 'Entrata Merci', xhtmlPage: 'GoodsReceiptIssue.xhtml', ftrID: 'g_receipt_v', extraParams: '&iddocumenttype=' },
        { endpoint: 'sales/goodsissue', label: 'DDT', xhtmlPage: 'GoodsReceiptIssue.xhtml', ftrID: 'g_issue_v', extraParams: '&iddocumenttype=1' },
    ];

    // Helper: scarica TUTTI i documenti di un endpoint con paginazione sequenziale
    // Pagina finché la risposta restituisce meno di PAGE_SIZE (= fine dei dati)
    // Il server Giobby di produzione restituisce sempre totalCount=PAGE_SIZE, quindi
    // non possiamo basarci su quello — usiamo la lunghezza della risposta come stop condition
    async function fetchAllPaginated(endpoint, label, xhtmlPage, ftrID, extraParams) {
        const PAGE_SIZE = 500;
        const MAX_PAGES = 30; // sicurezza: max 15.000 documenti
        const baseEndpointUrl = baseUrl + endpoint;

        const buildUrl = (offset) => {
            // Per tutti i tipi di documenti di acquisto (purchases/orders, purchases/goodsreceipt)
            // il campo idContact è il FORNITORE, non il cliente.
            // Non applichiamo filtri server-side: scarichiamo tutto e filtriamo per reference lato client.
            let url = `${baseEndpointUrl}?limit=${PAGE_SIZE}&offset=${offset}`;
            if (config.useProxy) url = "https://corsproxy.io/?" + encodeURIComponent(url);
            return url;
        };

        const extractList = (data) => {
            if (Array.isArray(data)) return data;
            if (data.documentsHeaders) return data.documentsHeaders;
            if (data.objects) return data.objects;
            if (data.items) return data.items;
            return [];
        };

        // ---- MATCHING PER ENTRATE MERCI via campo "reference" ----
        // Alias salvati dall'utente in precedenza (chiave: giobby_em_alias_<clientId>)
        const clientKey = client.id || client.giobbyContactId || clientFullName;
        let savedAliases = [];
        try {
            savedAliases = JSON.parse(localStorage.getItem('giobby_em_alias_' + clientKey) || '[]');
        } catch (e) { savedAliases = []; }

        // Blacklist: reference esclusi per omonimia o match errato
        let excludedRefs = [];
        try {
            excludedRefs = JSON.parse(localStorage.getItem('giobby_em_exclude_' + clientKey) || '[]');
        } catch (e) { excludedRefs = []; }

        // Token del nome cliente (parole significative >= 3 chars)
        const nameTokens = [
            ...(client.name || '').toUpperCase().split(/\s+/),
            ...(client.surname || '').toUpperCase().split(/\s+/)
        ].filter(w => w.length >= 3);

        // Restituisce: 'confirmed' | 'possible' | null
        const matchTypeForRef = (ref) => {
            if (!ref || !ref.trim()) return null;
            const refNorm = ref.trim().toUpperCase();
            // 0. Blacklist: escluso dall'utente (omonimia)
            if (excludedRefs.some(e => e.trim().toUpperCase() === refNorm)) return null;
            // 1. Alias confermati dall'utente
            if (savedAliases.some(a => a.trim().toUpperCase() === refNorm)) return 'confirmed';
            // 2. Match token: il reference contiene il token come parola separata
            const refWords = refNorm.split(/\s+/);
            const matchedTokens = nameTokens.filter(t => refWords.includes(t));
            if (matchedTokens.length >= 2) return 'confirmed';
            if (matchedTokens.length === 1) return 'possible';
            return null;
        };

        // Funzione di matching standard (idContact / idCustomer)
        const matchesClientDirect = (item) =>
            item.idContact == giobbyContactId ||
            item.contactId == giobbyContactId ||
            (giobbyCustomerCode &&
                giobbyCustomerCode !== 'CLI_DEFAULT' &&
                item.idCustomer &&
                item.idCustomer !== 'CLI_DEFAULT' &&
                String(item.idCustomer) === String(giobbyCustomerCode));

        let matched = [];
        let possible = [];   // ← match parziali, da confermare
        let offset = 0;
        let pageNum = 0;

        while (pageNum < MAX_PAGES) {
            let res;
            try {
                res = await fetch(buildUrl(offset), { headers: getGiobbyHeaders(config.accessToken) });
            } catch (e) {
                console.warn(`[CRM Giobby] ${endpoint} - fetch error at offset ${offset}:`, e);
                break;
            }

            if (!res.ok) {
                if (pageNum === 0) console.log(`[CRM Giobby] ${endpoint} - HTTP ${res.status} (endpoint non disponibile)`);
                break;
            }

            const data = await res.json();
            const list = extractList(data);

            if (pageNum === 0) {
                console.log(`[CRM Giobby] ${endpoint}: prima pagina=${list.length} docs (offset=0)`);
                // 🔍 DIAGNOSTICA: stampa il primo elemento per identificare campi ID disponibili
                if (list.length > 0) {
                    const sample = list[0];
                    console.log(`[CRM Giobby] 🔑 ${endpoint} — campi ID trovati nel primo doc:`, {
                        id: sample.id, idOffer: sample.idOffer, idOrder: sample.idOrder,
                        idDocument: sample.idDocument, documentId: sample.documentId,
                        offerId: sample.offerId, orderId: sample.orderId
                    });
                }
            }

            if (list.length === 0) break;

            list.forEach(item => {
                if (matchesClientDirect(item)) {
                    matched.push({ ...item, _matchType: 'confirmed' });
                } else if (endpoint === 'purchases/goodsreceipt') {
                    // Per EM: match via reference (logica alias + token)
                    const mt = matchTypeForRef(item.reference);
                    if (mt === 'confirmed') matched.push({ ...item, _matchType: 'confirmed' });
                    else if (mt === 'possible') possible.push({ ...item, _matchType: 'possible' });
                } else if (endpoint === 'purchases/orders' || endpoint === 'sales/goodsissue') {
                    // Per Ordini Acquisto e DDT: match via reference (stesso meccanismo alias)
                    const mt = matchTypeForRef(item.reference);
                    if (mt === 'confirmed') matched.push({ ...item, _matchType: 'confirmed' });
                    else if (mt === 'possible') possible.push({ ...item, _matchType: 'possible' });
                }
            });

            console.log(`[CRM Giobby] ${endpoint} offset=${offset}: ${list.length} docs, ${matched.length} confermati, ${possible.length} possibili`);

            if (list.length < PAGE_SIZE) break;

            offset += PAGE_SIZE;
            pageNum++;
        }

        console.log(`[CRM Giobby] ✅ ${endpoint}: ${matched.length} confermati, ${possible.length} possibili`);

        const mapDoc = (item) => {
            // Giobby usa nomi diversi per l'ID a seconda del tipo di documento:
            // Preventivi  → idOffer / id
            // Ordini      → idOrder / id
            // DDT / EM    → idDocument / id
            const docId = item.id
                || item.idOffer
                || item.idOrder
                || item.idDocument
                || item.idReceipt
                || item.documentId
                || item.offerId
                || item.orderId
                || null;
            const giobbyUrl = (docId)
                ? `https://app.giobby.com/Giobby${config.apiUrl.match(/GiobbyApi(\d+)/i)?.[1] || '00554'}/company/${xhtmlPage}?id=${docId}${extraParams || ''}&ftrID=${ftrID}&idFeature=${ftrID}`
                : null;
            return {
                type: label,
                id: docId,
                docNumber: item.docNumber || item.number || item.documentNumber || item.code || '-',
                date: item.docDate || item.documentDate || item.date || item.createdAt || null,
                deliveryDate: null, // non disponibile via API per questo account
                note: item.note || item.internalNote || null,  // note utente (es. data consegna)
                total: item.totalAmount || item.total || item.amount || 0,
                status: item.docStatus || item.status || item.state || null,
                statusDesc: item.docStatusDesc || item.statusDesc || null,
                giobbyUrl: giobbyUrl,
                matchType: item._matchType || 'confirmed',
                reference: item.reference || null,  // per alias
                clientName: item.companyName || item.customerName || item.contactName || item.name || null,  // nome fornitore/cliente/contatto
            };
        };

        return {
            confirmed: matched.map(mapDoc),
            possible: possible.map(mapDoc),
        };
    }

    // 4. Fetch tutti i tipi di documento in parallelo con paginazione
    const clientFullName = (client.name + ' ' + (client.surname || '')).trim().toLowerCase();
    const requests = docTypes.map(({ endpoint, label, xhtmlPage, ftrID, extraParams }) =>
        fetchAllPaginated(endpoint, label, xhtmlPage, ftrID, extraParams)
    );

    // 5. Merge and sort by date descending
    const results = await Promise.all(requests);
    const sortByDate = (arr) => arr.sort((a, b) => {
        const da = a.date ? new Date(a.date) : new Date(0);
        const db = b.date ? new Date(b.date) : new Date(0);
        return db - da;
    });

    const allConfirmed = sortByDate(results.flatMap(r => r.confirmed || []));
    const allPossible = sortByDate(results.flatMap(r => r.possible || []));

    // Chiave cliente per alias localStorage (passata a crm-core)
    const clientKey = client.id || (client.name + (client.surname || '')).replace(/\s/g, '');

    return { docs: allConfirmed, possibleDocs: allPossible, clientKey };
};


/**
 * Recupera le fatture emesse da Giobby per il cliente corrente.
 * Endpoint: sales/invoices  (con filtro ?idContact=<id>)
 * Ritorna array di: { docNumber, date, total, isPaid, paymentStatus, giobbyUrl }
 */
window.fetchGiobbyInvoices = async function (client) {
    if (!client) return [];

    const { config, baseUrl } = getGiobbyContext();
    console.log('[Fatture] 🔎 fetchGiobbyInvoices avviato per:', client.name, client.surname);
    console.log('[Fatture] 🔑 baseUrl:', baseUrl, '| useProxy:', config.useProxy);

    // Resolve contact ID
    let giobbyContactId = client.giobbyContactId;
    console.log('[Fatture] ContactId già presente?', giobbyContactId);
    if (!giobbyContactId) {
        const searchTerms = [];
        if (client.vat) searchTerms.push(client.vat);
        const fullName = (client.name + ' ' + (client.surname || '')).trim();
        if (fullName) searchTerms.push(fullName);
        console.log('[Fatture] 🔍 Cerco contatto con termini:', searchTerms);
        for (const term of searchTerms) {
            try {
                const results = await window.findGiobbyContact(config, term);
                console.log('[Fatture] Risultati ricerca "' + term + '":', results);
                if (results && results.length > 0) {
                    giobbyContactId = results[0].id;
                    console.log('[Fatture] ✅ ContactId trovato:', giobbyContactId);
                    break;
                }
            } catch (e) {
                console.warn('[Fatture] ⚠️ Ricerca fallita per "' + term + '":', e.message);
            }
        }
    }

    if (!giobbyContactId) {
        console.warn('[Fatture] ❌ Impossibile risolvere contactId. Nessuna fattura caricata.');
        return [];
    }

    // Determina base URL per link UI
    const companyMatch = config.apiUrl.match(/\/(GiobbyApi\d+)\//i);
    const companyId = companyMatch ? companyMatch[1] : null;
    const giobbyBase = companyId ? `https://app.giobby.com/${companyId}/company/` : null;

    // Helper: costruisce URL fatture con filtro idContact
    const buildInvoiceUrl = (offset) => {
        let url = `${baseUrl}sales/invoices?limit=200&offset=${offset}&idContact=${giobbyContactId}`;
        if (config.useProxy) url = 'https://corsproxy.io/?' + encodeURIComponent(url);
        return url;
    };

    const headers = getGiobbyHeaders(config.accessToken);
    const invoices = [];

    try {
        let offset = 0;
        const PAGE_SIZE = 200;
        for (let page = 0; page < 10; page++) {
            const url = buildInvoiceUrl(offset);
            console.log(`[Fatture] 📡 GET pagina ${page + 1}:`, url);
            const res = await fetch(url, { headers });
            console.log(`[Fatture] HTTP status: ${res.status} ${res.statusText}`);
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                console.error('[Fatture] ❌ Risposta non OK. Body:', errText.substring(0, 500));
                break;
            }
            const data = await res.json();
            console.log('[Fatture] 📦 Risposta JSON (prime 3 chiavi):', Object.keys(data).slice(0, 5));
            const list = Array.isArray(data) ? data
                : (data.documentsHeaders || data.objects || data.items || []);
            console.log(`[Fatture] 📋 Fatture in questa pagina: ${list.length}`);
            if (list.length > 0) {
                console.log('[Fatture] 🔬 Struttura prima fattura:', JSON.stringify(list[0], null, 2));
            }
            if (!list.length) break;
            list.forEach(inv => {
                const ps = (inv.paymentStatus || inv.payment_status || '').toLowerCase();
                let isPaid = false;
                let paymentLabel = 'Non pagata';
                let paymentColor = '#ef4444';

                if (ps === 'paid' || ps === 'pagata' || ps === 'chiusa') {
                    isPaid = true; paymentLabel = 'Pagata'; paymentColor = '#22c55e';
                } else if (ps === 'partial' || ps === 'parziale') {
                    paymentLabel = 'Parziale'; paymentColor = '#f59e0b';
                } else if (!ps) {
                    const total = parseFloat(inv.totalAmount || inv.total || inv.grandTotal || 0);
                    const paid = parseFloat(inv.paymentTotal || inv.paymentTotalIC || inv.totalPaid || inv.amountPaid || 0);
                    const byDate = inv.paymentDate && inv.paymentDate !== null;
                    if (byDate || (total > 0 && paid >= total)) {
                        isPaid = true; paymentLabel = 'Pagata'; paymentColor = '#22c55e';
                    } else if (paid > 0 && paid < total) {
                        paymentLabel = 'Parziale'; paymentColor = '#f59e0b';
                    }
                }

                const docNum = inv.documentNumber || inv.docNumber || inv.number || inv.id || '-';
                const docId = inv.id || '';
                const numericId = config.apiUrl.match(/GiobbyApi(\d+)/i)?.[1] || '00554';
                const docTypeId = inv.idDocumentType || 10;
                const giobbyUrl = giobbyBase && docId
                    ? `https://app.giobby.com/Giobby${numericId}/company/Invoice.xhtml?iddocumenttype=${docTypeId}&id=${docId}&ftrID=c_inv_2_v&idFeature=c_inv_2_v`
                    : null;

                invoices.push({
                    docNumber: docNum, date: inv.date || inv.documentDate || (inv.docDate ? new Date(inv.docDate).toISOString() : null),
                    total: parseFloat(inv.totalAmount || inv.total || inv.grandTotal || 0),
                    isPaid, paymentLabel, paymentColor, giobbyUrl,
                    id: String(docId),
                    docDescription: inv.docDescription || inv.description || '',
                    docDate: inv.docDate ? new Date(inv.docDate).toLocaleDateString('it-IT') : null,
                    paymentDate: inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString('it-IT') : null,
                });
            });
            if (list.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }
    } catch (e) {
        console.error('[Fatture] 💥 Eccezione durante il fetch:', e);
    }

    console.log(`[Fatture] ✅ Totale fatture raccolte: ${invoices.length}`);
    invoices.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return invoices;
};



/**
 * Search for a product in Giobby's catalog by code
 * ✅ WORKING - Uses GET / products / { productCode } endpoint

    * 
 * DISCOVERY(2026-02-07):
 * -----------------------
 * After testing multiple approaches, discovered that Giobby provides a direct
    * product lookup endpoint: GET / products / { productCode }
        * 
 * This endpoint:
 * • Returns 200 + product object if found
    * • Returns 404 if product code doesn't exist in catalog
        * • Is much more efficient than downloading all products
            * 
 * CACHING:
 * --------
 * Results are cached in memory(both positive and negative) to avoid
    * redundant API calls during a single export session.
 * Call clearGiobbyProductCache() at the start of each export.
 * 
 * @param { Object } config - Giobby configuration
    * @param { string } productCode - Product code to search for
 * @returns { Promise<{ id: string, code: string, description: string }| null >}
 */
window.searchGiobbyProduct = async function (config, productCode) {
    if (!productCode || !productCode.trim()) {
        return null;
    }

    const cacheKey = productCode.trim().toUpperCase();

    // Check cache first
    if (window._giobbyProductCache && window._giobbyProductCache.has(cacheKey)) {
        return window._giobbyProductCache.get(cacheKey);
    }

    try {
        const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';

        // ✅ CORRECT ENDPOINT: GET /products/{productCode}
        // Discovered 2026-02-07: Giobby supports direct product lookup by code
        const endpoint = `products/${encodeURIComponent(productCode)}`;
        let url = baseUrl + endpoint;

        if (config.useProxy) {
            url = "https://corsproxy.io/?" + encodeURIComponent(url);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: window.getGiobbyHeaders(config.accessToken),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();

                // ⚠️ IMPORTANT: Giobby wraps product in a response object!
                // Structure: { responseCode: 200, product: { id: "...", ... } }
                const productData = data.product || data;

                const productId = productData.id || productData.idMaterial || productData.productId || productData.idProduct;

                if (productId) {
                    const result = {
                        id: String(productId),
                        code: productData.id || productCode,
                        description: productData.description || productData.description_IT || ""
                    };

                    // Cache the result
                    if (!window._giobbyProductCache) {
                        window._giobbyProductCache = new Map();
                    }
                    window._giobbyProductCache.set(cacheKey, result);
                    return result;
                } else {
                    console.warn(`⚠️ Product found but no ID in response:`, productData);
                }
            } else if (response.status === 404) {
                // Product not found in catalog
            }
        } catch (fetchError) {
            clearTimeout(timeoutId);
            console.warn(`⚠️ Error fetching product ${productCode}:`, fetchError.message);
        }

        // Cache negative result
        if (!window._giobbyProductCache) {
            window._giobbyProductCache = new Map();
        }
        window._giobbyProductCache.set(cacheKey, null);
        return null;

    } catch (error) {
        console.error(`❌ Error searching product ${productCode}:`, error);
        return null;
    }
};

/**
 * Clear product cache (call at start of each export)
 */
window.clearGiobbyProductCache = function () {
    window._giobbyProductCache = new Map();
};

// 2. Map Quote

window.mapQuoteToGiobbyModel = async function (quote, clientInfo, config, agentId, agentName) {
    const docDateMillis = new Date(quote.date).getTime().toString();
    const deliveryDateMillis = quote.deliveryDate ? new Date(quote.deliveryDate).getTime().toString() : docDateMillis;

    // Map quote.vatRate to standard Giobby VAT percentage (numeric)
    let quoteVatPct = 22;
    if (quote.vatRate !== undefined && quote.vatRate !== null) {
        if (quote.vatRate === '0_rc' || quote.vatRate === '0_apply' || quote.vatRate === '0_zero') {
            quoteVatPct = 0;
        } else {
            const parsedVat = parseFloat(quote.vatRate);
            if (!isNaN(parsedVat)) {
                quoteVatPct = parsedVat <= 1 ? Math.round(parsedVat * 100) : Math.round(parsedVat);
            }
        }
    }
    // True when the quote uses Reverse Charge (Art.17 c.6 DPR 633/72).
    // RC is exported with 22% VAT + RC note (silent strategy — no N6 class lookup).
    const isRcQuote = (quote.vatRate === '0_rc');
    // True when VAT is genuinely 0% non-RC (N4/Esente/Zero) — triggers region/country clearing.
    // RC is excluded because it now uses 22% and doesn't need region suppression.
    const isZeroVatQuote = (quoteVatPct === 0 && !isRcQuote);


    let custState = (quote.customer && (quote.customer.state || quote.customer.region)) || "";
    const custProv = (quote.customer && (quote.customer.province || quote.customer.addressProvince || "")).trim().toUpperCase();
    if (!custState && custProv && window.inferRegionFromProvince) {
        custState = window.inferRegionFromProvince(custProv);
    }
    custState = sanitizeRegionForGiobby(custState);

    const hasSite = !!(quote.siteAddress && quote.siteAddress.trim());
    // When there is no site address, send empty destination fields so Giobby
    // uses the "Tutte le nazioni" VAT class rule instead of requiring a specific
    // IT/REGION entry (which is not configured in Giobby).
    const destAddress = hasSite ? (quote.siteAddress || "") : "";
    const destCity = hasSite ? (quote.siteCity || "") : "";
    const destZip = hasSite ? (quote.siteZip || "") : "";
    
    const destProvRaw = hasSite ? (quote.siteProvince || "") : "";
    const destProvClean = hasSite ? (function(p){ return (p && typeof p === 'string' && p.trim().length === 2) ? p.trim().toUpperCase() : ""; })(destProvRaw) : "";

    let destState = hasSite ? (quote.siteRegion || quote.siteState || "") : "";
    if (hasSite && !destState && destProvClean && window.inferRegionFromProvince) {
        destState = window.inferRegionFromProvince(destProvClean);
    }
    destState = hasSite ? sanitizeRegionForGiobby(destState) : "";


    let rcCode = (config && config.vatRC) ? config.vatRC : "N.I.Art.17,c6,DPR 633/72";
    // Fix stale RC codes: "N6" and "N6.3" are no longer valid in this Giobby installation.
    // The correct idVat is the original Giobby-native code visible in ManageTax > Codice column.
    if (rcCode === "N6" || rcCode === "N6.3") {
        rcCode = "N.I.Art.17,c6,DPR 633/72";
        if (config) {
            config.vatRC = "N.I.Art.17,c6,DPR 633/72";
            try { localStorage.setItem('giobbyConfig', JSON.stringify(config)); } catch(_) {}
        }
        console.log("🔄 [IVA] Corretto codice RC → N.I.Art.17,c6,DPR 633/72 (codice Giobby nativo)");
    }
    let zeroCode = (config && config.vatZero) ? config.vatZero : "N4";
    const std22VatCode = (config && config.vat22) ? config.vat22 : "22";
    const getRowIdVat = (itemVat) => {
        const rawVat = itemVat !== undefined && itemVat !== null ? itemVat : quote.vatRate;
        if (rawVat === '0_rc') {
            // RC: export silently with 22% VAT + note. No N6 class lookup needed.
            return std22VatCode;
        }
        if (rawVat === '0_apply' || rawVat === '0_zero' || rawVat === '0') {
            return zeroCode;
        }
        const parsed = parseFloat(rawVat);
        if (!isNaN(parsed)) {
            return String(parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed));
        }
        return String(quoteVatPct);
    };

    let idContact = clientInfo ? clientInfo.idContact : "";
    let idCustomer = clientInfo ? clientInfo.idCustomer : "";

    // GIOBBY UI FIX: If we have an idContact but no idCustomer, the Giobby Web UI will crash 
    // with "Contatto non presente in anagrafica" when opening the Quote.
    if (!idCustomer || idCustomer === "undefined" || idCustomer === "null") {
        console.warn("⚠️ [Giobby] idCustomer mancante. Forzo CLI_DEFAULT per evitare crash anagrafica.");
        idCustomer = "CLI_DEFAULT";
    }

    if (idCustomer === "CLI_DEFAULT") {
        idContact = ""; // Remove conflicting GUIDs for default client
    }

    // Map rows (with product catalog lookup)
    const rows = [];

    for (const item of quote.items) {
        // --- LOGIC: PARQUET (+Waste% + Aux Row) ---
        if (item.isParquet) {

            // Defaults (safeguard for legacy items without updated structure)
            const wastePct = (item.parquetWaste !== undefined) ? item.parquetWaste : 10;
            const glueType = item.parquetGlueType || "Colla 2k chiara";
            const glueCoeff = (item.parquetGlueCoeff !== undefined) ? item.parquetGlueCoeff : 1.4;

            const originalQty = parseFloat(item.quantity || 0);
            const augmentedQty = originalQty * (1 + (wastePct / 100));

            // 🏷️ BATTISCOPA DETECTION: Check if this is a battiscopa product
            const battiscopaCodesMap = {
                '97BTSM': 'PRBAT SM BATTISCOPA 50X10 TANG 9010',
                '96BTSM': 'PRBAT SM BATTISCOPA 50X10 TANG BIANCO',
                '98BTSM': 'PRBAT SM BATTISCOPA 50X10 TANG ROVERE',
                '100BTSM': 'PRBAT SM BATTISCOPA 70X10 TANG 9010',
                '99BTSM': 'PRBAT SM BATTISCOPA 70X10 TANG BIANCO',
                '119BTSM': 'PRBAT SM BATTISCOPA 70X10 TANG ROVERE'
            };
            const isBattiscopa = battiscopaCodesMap.hasOwnProperty(glueType);

            // 1. Original Item (Adjusted Quantity +Waste%)
            // ⚠️ SKIP for Battiscopa - we only want the battiscopa product row
            if (!isBattiscopa) {
                // ✅ ENABLED - Product catalog lookup
                // Uses GET /products/{code} endpoint (discovered 2026-02-07)
                const giobbyProduct = await window.searchGiobbyProduct(config, item.code);

                rows.push({
                    "idMaterial": giobbyProduct ? giobbyProduct.id : "",  // ✅ Use catalog ID if found
                    "description": item.giobby_description || item.description || "",
                    "unitOfMeasure": (item.uom || item.unit || "pz").toUpperCase(),
                    "quantity": augmentedQty.toFixed(2), // Round 2 dec
                    "price": String(item.unitPrice !== undefined ? item.unitPrice : (item.price || 0)),
                    "idVat": getRowIdVat(item.vat),
                    "idPosType": "1", // 1 = Material/Product
                    "idAttributeCombination": 0
                });
            }

            // 2. Aux Row: Glue / Battiscopa (Qty * Coeff OR just Qty for battiscopa)
            // Only add if coeff > 0 AND not excluded by type (Laminato, Grit, SPC)
            const descUpper = (item.description || "").toUpperCase();
            const isFloating = descUpper.includes("LAMINATO") || descUpper.includes("GRIT") || descUpper.includes("SPC");

            if ((glueCoeff > 0 || isBattiscopa) && !isFloating) {
                // For battiscopa: use original quantity (already includes waste)
                // For glue: use coefficient multiplier
                const auxQty = isBattiscopa ? augmentedQty : (originalQty * glueCoeff);

                // Map glue types to product code <-> description
                // If glueType is a product code (from new dropdown options), use it as code
                // Otherwise use glueType as description directly
                const glueCodeMap = {
                    // Glue products
                    'COLBICULTP9132KCHKG010MAP': 'PRCOL ULTRABOND P913 2K CHIARA COLLANTE BICOMPONENTE',
                    'COLBICULTP9132KSCKG010MAP': 'PRCOL ULTRABOND P913 2K SCURA COLLANTE BICOMPONENTE',
                    '86': 'TOVCOL TP5 COLLA VINILICA PER POSA FLOTTANTE 500 ML',
                    'PRCOLTOVMSSTART': 'PRCOL TOVCOL COLLA MONOCOMPONENTE MS START SCATOLA+SACCHETTI 15 KG 7,5X2',
                    // Battiscopa products
                    ...battiscopaCodesMap
                };

                let glueCode = '';
                let glueDescription = glueType;

                // Check if glueType is actually a product code
                if (glueCodeMap[glueType]) {
                    glueCode = glueType;
                    glueDescription = glueCodeMap[glueType];
                }

                // ✅ ENABLED - Product catalog lookup for glue/pad
                // Uses GET /products/{code} endpoint (discovered 2026-02-07)
                const giobbyGlue = await window.searchGiobbyProduct(config, glueCode);

                rows.push({
                    "idMaterial": giobbyGlue ? giobbyGlue.id : "",  // ✅ Use catalog ID if found
                    "description": glueDescription,
                    "unitOfMeasure": isBattiscopa ? "ML" : "KG", // Battiscopa in ML, Glue in KG
                    "quantity": auxQty.toFixed(2),
                    "price": isBattiscopa ? String(item.unitPrice !== undefined ? item.unitPrice : (item.price || 0)) : "0",
                    "idVat": getRowIdVat(item.vat),
                    "idPosType": "1",
                    "idAttributeCombination": 0
                });
            }

        } else {
            // --- STANDARD ITEM ---

            // ✅ ENABLED - Product catalog lookup
            // Uses GET /products/{code} endpoint (discovered 2026-02-07)
            const giobbyProduct = await window.searchGiobbyProduct(config, item.code);

            rows.push({
                "idMaterial": giobbyProduct ? giobbyProduct.id : "",  // ✅ Use catalog ID if found
                "description": item.giobby_description || item.description || "",
                "unitOfMeasure": (item.uom || item.unit || "pz").toUpperCase(),
                "quantity": String(item.quantity || 1),
                "price": String(item.unitPrice !== undefined ? item.unitPrice : (item.price || 0)),
                "idVat": getRowIdVat(item.vat),
                // Key fields likely required:
                "idPosType": "1", // 1 = Material/Product
                "idAttributeCombination": 0
            });
        }
    }


    const payload = {
        "idDocumentType": 0,
        "idDocumentTypeExt": "0",
        "docStatus": "CREATED",
        "docDate": docDateMillis,
        "docCurrency": "EUR",


        "idCustomer": idCustomer,

        "customerProvince": (function(p){ return (p && typeof p === 'string' && p.trim().length === 2) ? p.trim().toUpperCase() : ""; })(quote.customer.province || quote.customer.addressProvince || ""),
        "destProvince": destProvClean,

        // NAME SNAPSHOTS (Overrides Linked Client Name)
        "customerName": quote.customer.name,
        "companyName": quote.customer.name,

        // Boilerplate from Example (Required?)
        "idOrderType": "1", // Sales Quote?
        "idBu": (function () {
            if (quote.agent && window.db && window.db.getProductVars) {
                const vars = window.db.getProductVars();
                const meta = vars.agentsMetadata || {};
                // Try Exact or Insensitive
                if (meta[quote.agent] && meta[quote.agent].giobbyBu) return meta[quote.agent].giobbyBu;

                const searchKey = quote.agent.trim().toLowerCase();
                const foundKey = Object.keys(meta).find(k => k.trim().toLowerCase() === searchKey);
                if (foundKey && meta[foundKey].giobbyBu) return meta[foundKey].giobbyBu;
            }
            return "U1"; // Default
        })(),
        "idNumerator": (config && config.defaultNumerator) ? String(config.defaultNumerator) : "1",
        "idPaymentTerm": 0,

        // AGENT ASSIGNMENT
        // idSalesman -> Standard Field (Legacy)
        // idUserAgent1 -> Custom/New Field (Requested)
        "idSalesman": agentId ? String(agentId) : "",
        "idUserAgent1": agentId ? parseInt(agentId) : 0,

        "idAgent": "", // Commission Agent (unused for now)

        "note": quote.notesExternal || " ",
        "internalNote": (function() {
            let note = quote.notesInternal || quote.internalNotes || "";
            if (quote.siteSignboard === 'SI') {
                const marker = "Cartello di cantiere: SI";
                if (!note.includes(marker)) {
                    note = marker + (note.trim() ? "\n" + note : "");
                }
            }
            if (isRcQuote) {
                const rcMarker = "[RC] Reverse Charge — IVA 22% esposta per compatibilità Giobby (non addebitata al cliente).";
                if (!note.includes('[RC]')) note = rcMarker + (note.trim() ? "\n" + note : "");
            }
            return note.trim() || " ";
        })(),
        "reference": quote.reference || "", // Campo Riferimento mappato da Genesy

        // BILLING ADDRESS (Customer's registered address - always include)
        "customerAddress": quote.customer.address || "",
        "customerCity": quote.customer.city || "",
        "customerZip": quote.customer.zip || "",
        // customerProvince already sanitized above

        // For RC quotes: country IS sent (22% works with any country/region — no lookup issue).
        // For 0% non-RC (N4/Esente): clear country so Giobby uses "Tutte le nazioni" VAT rule.
        "customerCountry": (isZeroVatQuote && !isRcQuote) ? "" : "Italia",

        // NOTE: Do NOT send customerRegion/customerState in the payload.
        // Giobby uses these to look for a specific IT/REGION VAT class entry.
        // Since only "Tutte le nazioni" is configured (not IT-specific entries),
        // sending a region causes VAT class lookup to fail.
        // Giobby will derive region from the client record set during pre-export update.

        // CUSTOM FIELDS (Backup Name)
        "customField1": agentName || quote.agent || "",

        // DESTINATION / SHIPPING
        // When no site address: send empty dest fields so Giobby uses "Tutte le nazioni" VAT class.
        // Sending destCountry="Italia" + destState="EMILIA ROMAGNA" causes Giobby to look for
        // a specific IT/EMILIA-ROMAGNA VAT entry which is not configured — only "Tutte le nazioni" is.
        // FIX: When VAT is 0% (RC or Esente), also clear destRegion/destState so Giobby uses
        // the "Tutte le nazioni" rule where N6/N4 IS configured, instead of the region-specific
        // rule where it is not. For non-zero VAT, region can be sent normally.
        "destCompanyName": hasSite ? (quote.siteCompanyName || "") : "",
        "destAddress": destAddress,
        "destCity": destCity,
        "destZip": destZip,
        "destCountry": (hasSite && !isZeroVatQuote) ? "Italia" : "",
        "destRegion": isZeroVatQuote ? "" : destState,
        "destState": isZeroVatQuote ? "" : destState,
        "destStateOrRegion": isZeroVatQuote ? "" : destState,

        "destEmail": quote.customer.email || " ",
        "destPhone": quote.siteContactPhone || quote.customer.phone || " ", // Use Site Contact Phone if available

        "rows": rows
    };

    if (idContact) {
        payload.idContact = idContact;
    }

    return payload;
};

// Helper to search an existing Giobby offer by its reference (up to last 500 items)
async function findExistingGiobbyOfferByReference(config, reference) {
    if (!reference || !reference.trim()) return null;
    const refNorm = reference.trim().toLowerCase();
    
    try {
        const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
        const docEndpoint = await getEffectiveEndpoint(config, 'sales_offers');
        
        // Fetch last 500 offers
        let fetchUrl = `${baseUrl}${docEndpoint}?limit=500`;
        if (config.useProxy) fetchUrl = "https://corsproxy.io/?" + encodeURIComponent(fetchUrl);
        
        // 15-second timeout to avoid hanging forever on slow Giobby responses
        const dupAbort = new AbortController();
        const dupTimeout = setTimeout(() => dupAbort.abort(), 15000);
        let res;
        try {
            res = await fetch(fetchUrl, {
                method: 'GET',
                headers: getGiobbyHeaders(config.accessToken),
                signal: dupAbort.signal
            });
        } finally {
            clearTimeout(dupTimeout);
        }
        
        if (!res.ok) {
            console.warn(`[Giobby Search Ref] Fetch offers list failed: ${res.status}`);
            return null;
        }
        
        const data = await res.json();
        const list = data.documentsHeaders || data.objects || data.items || [];
        
        // DEBUG LOGGING to check keys returned by Giobby API list endpoint
        if (list.length > 0) {
            console.log("🔍 [Giobby Search Ref] Total items fetched:", list.length);
            console.log("🔍 [Giobby Search Ref] Keys of first item in list:", Object.keys(list[0]));
            console.log("🔍 [Giobby Search Ref] First item data:", JSON.stringify(list[0]));
        } else {
            console.log("🔍 [Giobby Search Ref] Empty list returned by Giobby.");
        }
        
        for (const item of list) {
            const itemRef = (item.reference || item.project || item.job || item.customerReference || "").trim().toLowerCase();
            if (itemRef === refNorm && item.id) {
                console.log(`🔍 Found matching Giobby offer by reference "${reference}": ID ${item.id}`);
                return item.id;
            }
        }
    } catch (err) {
        console.warn("[Giobby Search Ref] Error querying offers by reference:", err);
    }
    return null;
}

// 3. Main Export Function (FIXED)
window.exportQuoteToGiobby = async function (input) {
    let quote = null;
    if (typeof input === 'string') {
        quote = (window.quotes || []).find(q => q.id === input);
    } else if (typeof input === 'object' && input !== null) {
        quote = input;
    }

    if (!quote) return alert("Preventivo non trovato!");

    // FIX: usa riferimento cachato prima degli await (window.db diventa undefined dopo)
    const dbRef = window.db;


    // ✅ STATUS CHECK: Only allow export for "Chiuso" status
    if (quote.status !== 'Chiuso') {
        return alert("⚠️ Esportazione non consentita!\n\nPuoi esportare su Giobby solo i preventivi con status \"Chiuso\".\n\nStatus attuale: " + (quote.status || "Non definito"));
    }

    // ✅ VALIDATION: Ensure "Cartello di cantiere" has been selected
    if (!quote.siteSignboard || quote.siteSignboard === '') {
        return alert("⚠️ Esportazione non consentita!\n\nÈ obbligatorio specificare se è presente o meno il \"Cartello di cantiere\" (Sì/No) nel pannello Logistica & Cantiere.");
    }

    // Site address fields are no longer required for Giobby export (as requested by user)

    // 🔍 DEBUG: Log quote structure to diagnose empty items
    console.log("🔍 [Giobby Export Debug] Quote object:", quote);
    console.log("🔍 [Giobby Export Debug] Quote.items:", quote.items);
    console.log("🔍 [Giobby Export Debug] Quote.items length:", quote.items ? quote.items.length : "UNDEFINED");

    if (!quote.items || quote.items.length === 0) {
        console.error("❌ [Giobby Export] Quote has no items! Full quote object:", JSON.stringify(quote, null, 2));
        return alert("Impossibile esportare: Il preventivo non contiene articoli (righe).\n\nControlla la console (F12) per maggiori dettagli.");
    }

    // ✅ VALIDATION: Ensure all Parquet items have been configured via the modal
    for (let i = 0; i < quote.items.length; i++) {
        const item = quote.items[i];
        if (item.isParquet) {
            // Check if it's unconfigured or has the old legacy default description
            if (item.parquetWaste === undefined || !item.parquetGlueType || item.parquetGlueType === 'Colla 2k chiara') {
                alert(`Attenzione: È necessario completare la "Configurazione Giobby" (Sfrido, Colla) per l'articolo in preventivo:\n\n"${item.description || 'Articolo Parquet'}"\n\nSi aprirà automaticamente il pannello di configurazione. Clicca su "Salva" e poi potrai riprovare l'esportazione.`);
                if (window.openParquetSettings) {
                    window.openParquetSettings(i);
                }
                return; // Prevent further execution and export
            }
        }
    }

    const jsonConfig = localStorage.getItem('giobbyConfig');
    if (!jsonConfig) return alert("Configurazione Giobby mancante! Vai in Impostazioni.");
    const config = JSON.parse(jsonConfig);

    if (!await showCustomConfirmAsync(`Esportare il preventivo ${quote.friendlyId || quote.id} su Giobby?`, "Esportazione Giobby", "proposal")) return;

    // 🎉 Celebrate for closing the quote! (3 seconds)
    if (typeof window.celebrateSuccess === 'function') {
        window.celebrateSuccess();
    }

    // Wait 3 seconds for celebration
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Stop celebration before showing modals
    if (typeof window.stopCelebration === 'function') {
        window.stopCelebration();
    }

    // Declare variables outside try block for catch/retry scope
    let agentId = "";
    let agentName = quote.agent || "";
    let clientInfo = null;
    let clientConfig = null;
    let giobbyJson = null;

    // ✅ Check for existing export or duplicate reference
    let isPreviouslyExported = !!(quote.giobbyDocumentId);
    
    if (isPreviouslyExported) {
        const confirmExport = confirm(`⚠️ PREVENTIVO GIÀ ESPORTATO SU GIOBBY!\n\nQuesto preventivo è già stato esportato su Giobby (ID Giobby: ${quote.giobbyDocumentId}).\n\nLe API di Giobby non consentono di modificare i preventivi esistenti. Se procedi, verrà creata una NUOVA COPIA (preventivo duplicato) su Giobby.\n\nVuoi procedere comunque ed esportare una nuova copia?`);
        if (!confirmExport) return;
    } else if (quote.reference && quote.reference.trim() !== '') {
        try {
            showLoadingSpinner("Ricerca preventivi duplicati su Giobby...");
            let matchedId = null;
            try {
                matchedId = await Promise.race([
                    findExistingGiobbyOfferByReference(config, quote.reference),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000))
                ]);
            } catch (dupErr) {
                console.warn('[Giobby Export] Ricerca duplicati fallita o scaduta (skip):', dupErr.message);
                matchedId = null;
            }
            hideLoadingSpinner();
            if (matchedId) {
                const confirmExport = confirm(`⚠️ RILEVATO PREVENTIVO CON LO STESSO RIFERIMENTO SU GIOBBY!\n\nÈ stato trovato un preventivo esistente su Giobby con lo stesso riferimento: "${quote.reference}" (ID Giobby: ${matchedId}).\n\nLe API di Giobby non consentono di modificare i preventivi esistenti. Se procedi, verrà creata una NUOVA COPIA (preventivo duplicato) su Giobby.\n\nVuoi procedere comunque ed esportare una nuova copia?`);
                if (!confirmExport) return;
            }
        } catch (errSearch) {
            console.warn("Error looking up duplicate offers by reference:", errSearch);
            hideLoadingSpinner();
        }
    }

    // 💾 AUTO-SAVE: Salva il preventivo prima dell'export per preservare modifiche pendenti
    if (quote.id && dbRef && dbRef.saveQuote) {
        try {
            showLoadingSpinner("Salvataggio preventivo in corso...");
            await dbRef.saveQuote(quote);
            console.log("✅ Preventivo salvato automaticamente prima dell'export Giobby");
        } catch (saveErr) {
            console.error("⚠️ Errore durante il salvataggio preliminare:", saveErr);
            // Non blocchiamo l'export, ma avvertiamo l'utente
            const isPermissionError = saveErr && saveErr.message && saveErr.message.includes('row-level security');
            const msg = isPermissionError 
                ? "⚠️ ERRORE DI PERMESSI: Non sei l'autore originale di questo preventivo e non hai i permessi per modificarlo/salvarlo.\n\nCONSIGLIO: Chiudi questa finestra, clicca l'iconcina della freccia accanto a Salva e usa 'Salva copia come nuovo'. Potrai esportare la nuova copia!\n\nVuoi comunque forzare l'export su Giobby (ATTENZIONE: i dati di link a Giobby non verranno salvati su Supabase)?"
                : `⚠️ Il salvataggio automatico del preventivo è fallito.\nErrore: ${saveErr.message || 'Sconosciuto'}\n\nVuoi comunque procedere con l'export su Giobby?`;
            
            if (!confirm(msg)) {
                hideLoadingSpinner();
                return;
            }
        }
    }

    try {
        showLoadingSpinner("Esportazione su Giobby in corso...");

        // --- AGENT MAPPING CHECK (Visibility Safety) ---
        // Cache anche le credenziali agente qui (sync, prima degli await)
        let _cachedAgentMeta = null; // Usato poi nel blocco impersonazione
        if (quote.agent) {
            const vars = window.db ? window.db.getProductVars() : {};
            const meta = vars.agentsMetadata || {};
            const agentInfo = meta[quote.agent];

            // Cache credenziali per impersonazione (window.db diventa undefined dopo gli await)
            const _metaEntries = Object.entries(meta);
            const _metaEntry = _metaEntries.find(([k]) =>
                k === quote.agent || k.trim().toLowerCase() === quote.agent.trim().toLowerCase()
            );
            _cachedAgentMeta = _metaEntry ? _metaEntry[1] : null;
            console.log(`🔐 [Giobby Export] Credenziali agente cachate (sync):`, _cachedAgentMeta ? { hasUser: !!_cachedAgentMeta.giobbyUsername, hasPass: !!_cachedAgentMeta.giobbyPassword } : 'none');
            // DUMP DIAGNOSTICO: mostra tutte le chiavi di agentsMetadata
            console.log('🗂️ agentsMetadata keys:', JSON.stringify(Object.keys(meta)));
            console.log('🗂️ agentsMetadata[quote.agent]:', JSON.stringify(meta[quote.agent]));
            console.log('🗂️ quote.agent raw:', JSON.stringify(quote.agent));

            if (!agentInfo || !agentInfo.giobbyAgentId) {
                // Double check if metadata exists but key is different (trim issue?)
                // Try to find case-insensitive match
                const foundKey = Object.keys(meta).find(k => k.trim().toLowerCase() === quote.agent.trim().toLowerCase());

                if (foundKey && meta[foundKey].giobbyAgentId) {
                    // Continue safe
                } else {
                    // Agent not mapped!
                    // OLD STRATEGY: Prompt for ID
                    // NEW STRATEGY (2025-01-24): Proceed without ID. 
                    // The Name will be sent via 'customField1' (agente1) as per user request.
                    console.warn(`[Export] Agent '${quote.agent}' has no mapped Giobby ID. Proceeding with name only in customField1.`);
                }
            }
        }
        // -----------------------------------------------

        // AGENT RESOLUTION (eseguita PRIMA della logica cliente, così agentId è disponibile)
        // 1. Fetch Users from Giobby
        agentId = "";
        agentName = quote.agent || "";
        let skipSelection = false; // FIX: dichiarata PRIMA di qualsiasi utilizzo

        // 0. CHECK GLOBAL AGENT CONFIG (Priority)
        // User requested to use ID from "Configura Agenti"
        if (window.db && window.db.getProductVars) {
            try {
                const vars = window.db.getProductVars();
                if (vars && vars.agentsMetadata && vars.agentsMetadata[quote.agent]) {
                    const meta = vars.agentsMetadata[quote.agent];
                    // Check various possible keys since I couldn't verify the exact column name
                    const configId = meta.idGiobby || meta.giobbyId || meta.giobbyAgentId || meta.id_giobby;

                    if (configId) {
                        console.log(`✅ Trovato ID Giobby in configurazione per ${quote.agent}: ${configId}`);
                        agentId = String(configId);
                        // Ensure we have a name, fallback to quote.agent
                        agentName = meta.giobbyName || quote.agent;
                        skipSelection = true;
                    }
                }
            } catch (errConfig) {
                console.warn("Errore lettura configurazione agenti:", errConfig);
            }
        }

        // PERSISTENCE: Check local storage first
        const savedMappings = JSON.parse(localStorage.getItem('giobbyAgentMappings') || '{}');
        const savedMap = savedMappings[quote.agent];

        if (!skipSelection && savedMap && savedMap.id) {
            // Se il nome salvato è "Unknown" o vuoto, non fidarsi: andremo a risolvere il nome reale
            const savedNameIsValid = savedMap.name && savedMap.name !== 'Unknown' && savedMap.name.trim().length > 0;

            if (confirm(`Usare l'agente Giobby salvato per "${quote.agent}"?\n\nNome: ${savedMap.name || '(sconosciuto)'}\nID: ${savedMap.id}`)) {
                agentId = savedMap.id;
                agentName = savedMap.name || quote.agent;

                if (savedNameIsValid) {
                    skipSelection = true; // Nome già buono, salta il fetch
                } else {
                    // L'ID è confermato, ma il nome va recuperato da Giobby
                    console.warn(`[Giobby Export] agentName salvato è "${savedMap.name}" — tento di recuperare il nome reale da Giobby.`);
                    try {
                        const usersForName = await window.fetchGiobbyUsers(config);
                        const foundUser = usersForName && usersForName.find(u => String(u.id) === String(agentId));
                        if (foundUser && foundUser.name && foundUser.name !== 'Unknown') {
                            agentName = foundUser.name;
                            // Aggiorna il mapping salvato con il nome corretto
                            savedMappings[quote.agent] = { id: agentId, name: agentName };
                            localStorage.setItem('giobbyAgentMappings', JSON.stringify(savedMappings));
                            console.log(`✅ [Giobby Export] Nome agente corretto: "${agentName}" (ID: ${agentId})`);
                        }
                    } catch (nameErr) {
                        console.warn('[Giobby Export] Impossibile recuperare il nome reale dell\'agente:', nameErr);
                    }
                    skipSelection = true; // L'ID è quello giusto comunque
                }
            }
        }

        if (!skipSelection) {
            try {
                const giobbyUsers = await window.fetchGiobbyUsers(config);

                if (giobbyUsers && giobbyUsers.length > 0) {
                    const searchName = agentName.toLowerCase().trim();
                    const nameTokens = searchName.split(/\s+/).filter(t => t.length > 3);

                    // PASS 1: Exact full-name match (name or username contains full agent name)
                    let match = giobbyUsers.find(u =>
                        (u.name && u.name.toLowerCase().includes(searchName)) ||
                        (u.username && u.username.toLowerCase().includes(searchName))
                    );

                    // PASS 2: Token match — cerca ogni token del nome agente in username/name
                    // es. "Monti Giacomo" → cerca "monti" o "giacomo" in "giacomo.riccione"
                    if (!match && nameTokens.length > 0) {
                        match = giobbyUsers.find(u => {
                            const uName = (u.name || '').toLowerCase();
                            const uUser = (u.username || '').replace(/[._\-]/g, ' ').toLowerCase();
                            return nameTokens.some(token => uName.includes(token) || uUser.includes(token));
                        });
                        if (match) console.log(`✅ [Agent Match] Token match trovato: "${quote.agent}" → "${match.name}" (${match.username})`);
                    }

                    // PASS 3: giobbyUsername esplicito da agentsMetadata
                    if (!match && window.db && window.db.getProductVars) {
                        try {
                            const _vars = window.db.getProductVars();
                            const _meta = _vars && _vars.agentsMetadata && _vars.agentsMetadata[quote.agent];
                            if (_meta && _meta.giobbyUsername) {
                                match = giobbyUsers.find(u =>
                                    u.username && u.username.toLowerCase() === _meta.giobbyUsername.toLowerCase()
                                );
                                if (match) console.log(`✅ [Agent Match] Username esplicito match: "${_meta.giobbyUsername}" → ID ${match.id}`);
                            }
                        } catch (_e) { /* ignora */ }
                    }

                    // PASS 4 (HARDCODE): Fallback speciale per Filippo Mondello / Parquet Bologna
                    if (!match && searchName.includes('filippo') && searchName.includes('mondello')) {
                        match = giobbyUsers.find(u => (u.username || '').toLowerCase() === 'filippo');
                        if (match) {
                            console.log(`✅ [Agent Match] Trovato Filippo Mondello tramite username esatto "Filippo": ID ${match.id}`);
                        } else {
                            // Se le API non lo espongono (spesso succede per limitazioni permessi Giobby),
                            // usiamo l'ID 4 come forzatura per "Preventivi Bologna"
                            match = { id: 4, name: "Filippo Mondello" };
                            console.log(`✅ [Agent Match] Forzato Filippo Mondello a ID 4`);
                        }
                    }

                    if (match) {
                        agentId = match.id;
                        agentName = match.name;
                        // AUTO-SAVE: persisti l'ID trovato in agentsMetadata così il prossimo
                        // export lo usa direttamente senza dover ri-cercare
                        if (quote.agent && window.db && window.db.getProductVars && window.db.saveProductVars) {
                            try {
                                const _vars2 = window.db.getProductVars();
                                if (!_vars2.agentsMetadata) _vars2.agentsMetadata = {};
                                if (!_vars2.agentsMetadata[quote.agent]) _vars2.agentsMetadata[quote.agent] = {};
                                if (!_vars2.agentsMetadata[quote.agent].giobbyAgentId) {
                                    _vars2.agentsMetadata[quote.agent].giobbyAgentId = String(match.id);
                                    _vars2.agentsMetadata[quote.agent].giobbyName = match.name;
                                    await window.db.saveProductVars(_vars2);
                                    console.log(`💾 [Agent AutoSave] giobbyAgentId salvato per "${quote.agent}": ${match.id}`);
                                }
                            } catch (_saveErr) {
                                console.warn('⚠️ Auto-save giobbyAgentId fallito:', _saveErr);
                            }
                        }
                    } else {
                        // Nessun match automatico → prompt manuale
                        let promptMsg = `Non ho trovato una corrispondenza automatica per l'agente "${quote.agent}".\n\nSeleziona l'Utente Giobby dalla lista (inserisci il numero ID):\n\n`;

                        // Limit list to avoid massive prompt
                        const displayList = giobbyUsers.map(u => `[${u.id}] ${u.name} (${u.username})`).slice(0, 15);
                        promptMsg += displayList.join('\n');
                        if (giobbyUsers.length > 15) promptMsg += `\n... (+${giobbyUsers.length - 15} altri)`;

                        promptMsg += `\n\n(Lascia vuoto per nessuno)`;

                        const input = prompt(promptMsg);
                        if (input && input.trim()) {
                            agentId = input.trim();
                            // Try to update name for customField1
                            const selectedUser = giobbyUsers.find(u => String(u.id) === agentId);
                            if (selectedUser) {
                                agentName = selectedUser.name;
                                // SAVE MAPPING (Only if manual selection happened)
                                if (quote.agent) {
                                    savedMappings[quote.agent] = { id: agentId, name: agentName };
                                    localStorage.setItem('giobbyAgentMappings', JSON.stringify(savedMappings));
                                    // Salva anche in agentsMetadata per export futuri
                                    if (window.db && window.db.getProductVars && window.db.saveProductVars) {
                                        try {
                                            const _v = window.db.getProductVars();
                                            if (!_v.agentsMetadata) _v.agentsMetadata = {};
                                            if (!_v.agentsMetadata[quote.agent]) _v.agentsMetadata[quote.agent] = {};
                                            _v.agentsMetadata[quote.agent].giobbyAgentId = agentId;
                                            _v.agentsMetadata[quote.agent].giobbyName = agentName;
                                            await window.db.saveProductVars(_v);
                                        } catch (_e) { /* ignora */ }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // No users fetched?
                    console.warn("Nessun utente Giobby trovato o errore fetch.");
                    const nameIn = prompt("Impossibile caricare lista utenti. Inserisci Nome Agente manualmente:", agentName);
                    if (nameIn !== null) agentName = nameIn;
                }

            } catch (e) {
                console.error("Error handling agent selection:", e);
            }
        }

        console.log(`🧑‍💼 [Giobby Export] agentId risolto: "${agentId}", agentName: "${agentName}"`);

        // IMPERSONAZIONE AGENTE: usa la variabile globale `db` (post-await, Supabase già caricato)
        clientConfig = { ...config }; // Default: token admin
        let isImpersonating = false;
        try {
            const _liveVars = (typeof db !== 'undefined' && db.getProductVars) ? db.getProductVars() : {};
            const _liveMeta = _liveVars.agentsMetadata || {};
            const _liveEntries = Object.entries(_liveMeta);
            const _liveEntry = _liveEntries.find(([k]) =>
                k === quote.agent || k.trim().toLowerCase() === quote.agent.trim().toLowerCase()
            );
            const _effectiveMeta = _liveEntry ? _liveEntry[1] : null;
            console.log('🔍 [Impersonazione] Credenziali agente (post-await, db):', _effectiveMeta
                ? { hasUser: !!_effectiveMeta.giobbyUsername, hasPass: !!_effectiveMeta.giobbyPassword, totalAgents: _liveEntries.length }
                : { notFound: true, totalAgents: _liveEntries.length, keys: Object.keys(_liveMeta) });
            if (_effectiveMeta && _effectiveMeta.giobbyUsername && _effectiveMeta.giobbyPassword) {
                showLoadingSpinner(`Autenticazione agente "${agentName}" su Giobby...`);
                try {
                    const agentToken = await window.authenticateAgent(_effectiveMeta.giobbyUsername, _effectiveMeta.giobbyPassword, config);
                    if (agentToken) {
                        clientConfig = { ...config, accessToken: agentToken };
                        isImpersonating = true;
                        console.log(`🔑 [Giobby Export] Token agente ottenuto per "${agentName}". Clienti creati come agente.`);
                    }
                } catch (authErr) {
                    console.warn(`[Giobby Export] Autenticazione agente fallita (${agentName}):`, authErr.message);
                }
                showLoadingSpinner("Esportazione su Giobby in corso...");
            }
        } catch (_impErr) {
            console.warn('[Giobby Export] Errore lettura credenziali agente:', _impErr);
        }

        // Client Strategy: Find or Create (FIX: agentId ora disponibile)
        clientInfo = null;
        try {
            // 0. CHECK PRE-DATA (Two-Step Sync)
            // FIX: se stiamo impersonando l'agente, NON usiamo i dati cached perché
            // il cliente potrebbe essere di proprietà dell'admin → forziamo il lookup/creazione con token agente
            if (!isImpersonating && quote.customer && quote.customer.giobbyContactId && quote.customer.idCustomer) {
                clientInfo = {
                    idContact: quote.customer.giobbyContactId,
                    idCustomer: quote.customer.idCustomer
                };
            }

            // map quote.customer to partial clientData needed for search
            if (!clientInfo) {
                // 0. REFRESH CUSTOMER DATA FROM REGISTRY (Crucial for Surname)
                // If the quote is old, quote.customer might lack the 'surname' field.
                // We try to find the up-to-date client in the registry.
                if (window.db && window.db.getClients) {
                    const latestClients = window.db.getClients();
                    let registryClient = null;

                    if (quote.customer.id) {
                        registryClient = latestClients.find(c => c.id == quote.customer.id);
                    }

                    // Fallback by name if ID not found or partial
                    if (!registryClient && quote.customer.name) {
                        registryClient = latestClients.find(c => c.name.trim().toLowerCase() === quote.customer.name.trim().toLowerCase());
                    }

                    if (registryClient) {
                        console.log("🔄 [Giobby Export] Refreshed customer data from Registry:", registryClient);
                        quote.customer.surname = registryClient.surname || "";
                        quote.customer.fiscal_code = registryClient.fiscal_code || quote.customer.fiscal_code;
                        quote.customer.vat = registryClient.vat || quote.customer.vat;
                        quote.customer.giobbyContactId = registryClient.giobbyContactId || quote.customer.giobbyContactId || "";
                        quote.customer.idCustomer = registryClient.idCustomer || quote.customer.idCustomer || "";

                        console.log("📝 [Export] Customer after registry merge:", {
                            name: quote.customer.name,
                            surname: quote.customer.surname,
                            registrySurname: registryClient.surname
                        });
                    } else {
                        console.warn("⚠️ [Export] Could not find client in registry to refresh surname!");
                    }
                }

                // Combine Name + Surname for Giobby
                const fullName = (quote.customer.name || "").trim() + (quote.customer.surname ? " " + quote.customer.surname.trim() : "");

                // map quote.customer to partial clientData needed for search
                const searchData = {
                    name: quote.customer.name || fullName,
                    surname: quote.customer.surname || "",
                    vat: quote.customer.vat || "",
                    fiscal_code: quote.customer.fiscal_code || "",
                    fiscalCode: quote.customer.fiscal_code || "",
                    address: quote.customer.address || "",
                    email: quote.customer.email || "",
                    city: quote.customer.city || "",
                    zip: quote.customer.zip || "",
                    addressProvince: quote.customer.province || quote.customer.addressProvince || "",
                    state: quote.customer.state || "",
                    country: quote.customer.country || "Italia",
                    phone: quote.customer.phone || "",
                    phoneOffice: quote.customer.phone_office || quote.customer.phoneOffice || "",
                    phoneHome: quote.customer.phone_home || quote.customer.phoneHome || "",
                    mobile: quote.customer.mobile || "",
                    pec: quote.customer.pec || "",
                    sdi: quote.customer.sdi || "",
                    fax: quote.customer.fax || "",
                    // FIX: Includi ID Giobby salvati → Step 0 di findOrCreateGiobbyClient
                    // li usa per accesso diretto (bypass filtro "Visibile a me")
                    giobbyContactId: quote.customer.giobbyContactId || "",
                    giobbyCustomerId: quote.customer.idCustomer || quote.customer.giobbyCustomerId || "",
                    type: quote.customer.type || ""
                };

                clientInfo = await findOrCreateGiobbyClient(clientConfig, searchData, false, agentId);

                // FIX GUID: Giobby's server sometimes takes up to 15-30s to index the newly created Customer.
                // We MUST have the idContact (GUID), otherwise the Giobby Web UI will crash when opening the Quote.
                if (clientInfo && clientInfo.idCustomer && !clientInfo.idContact) {
                    showLoadingSpinner("Giobby sta elaborando il nuovo cliente... (Attendi 10s)");
                    console.log('🔧 [Export] GUID non risolto al primo tentativo. Inizio polling...');
                    
                    for (let pass = 1; pass <= 5; pass++) {
                        await new Promise(r => setTimeout(r, 3000)); // wait 3s per pass
                        try {
                            // adminConfig is the global 'config' because we used clientConfig for Impersonation earlier
                            const adminSearchResults = await window.findGiobbyContact(config, String(clientInfo.idCustomer));
                            if (adminSearchResults && adminSearchResults.length > 0) {
                                const guidMatch = adminSearchResults.find(c =>
                                    String(c.idCustomer) === String(clientInfo.idCustomer) ||
                                    String(c.code) === String(clientInfo.idCustomer)
                                ) || adminSearchResults[0];
                                
                                if (guidMatch && guidMatch.id) {
                                    clientInfo.idContact = guidMatch.id;
                                    console.log(`✅ [Export] GUID risolto in polling (pass ${pass}):`, clientInfo.idContact);
                                    break;
                                }
                            }
                        } catch (_guidErr) {
                            console.warn(`[Export] Polling GUID (pass ${pass}) fallito:`, _guidErr);
                        }
                    }

                    if (!clientInfo.idContact) {
                        hideLoadingSpinner();
                        return alert("⚠️ ERRORE DI GIOBBY (API Lenta)\n\nIl cliente è stato creato con successo su Giobby, ma il server Giobby è attualmente sovraccarico e non ci ha restituito l'ID del contatto.\n\nPer evitare che il preventivo si blocchi (Schermata Rossa su Giobby), l'esportazione è stata messa in pausa.\n\n👉 COSA FARE: Clicca OK, aspetta 10 secondi e clicca di nuovo su 'Esporta in Giobby'. Il sistema troverà il cliente appena creato e l'esportazione andrà a buon fine!");
                    }
                }

                // Update Giobby contact + persist IDs
                if (clientInfo && clientInfo.idContact) {
                    try {
                        // FORCE UPDATE Giobby contact ONLY when IVA is 0% (RC/Esente) to ensure Province/Region are set
                        // This prevents the "Stato/Regione null" error from Giobby API
                        const isZeroVat = (quote.vatRate === '0_rc' || quote.vatRate === '0_apply' || quote.vatRate === '0_zero' || quote.vatRate === 0 || quote.vatRate === '0');
                        if (isZeroVat) {
                            try {
                                console.log("🔄 [Giobby Export] IVA 0% rilevata — aggiorno Provincia/Regione cliente su Giobby prima dell'export...");
                                showLoadingSpinner("Aggiorno Provincia/Regione cliente su Giobby...");
                                let custRegion = quote.customer.state || quote.customer.region || "";
                                const custProvForUpdate = (quote.customer.province || quote.customer.addressProvince || "").trim().toUpperCase();
                                if (!custRegion && custProvForUpdate && window.inferRegionFromProvince) {
                                    custRegion = window.inferRegionFromProvince(custProvForUpdate);
                                }
                                if (typeof sanitizeRegionForGiobby === 'function') {
                                    custRegion = sanitizeRegionForGiobby(custRegion);
                                }
                                const updatePayload = {
                                    type: quote.customer.type || "company",
                                    name: quote.customer.name,
                                    surname: quote.customer.surname || "",
                                    vat: quote.customer.vat || "",
                                    fiscal_code: quote.customer.fiscal_code || "",
                                    fiscalCode: quote.customer.fiscal_code || "",
                                    address: quote.customer.address || "",
                                    city: quote.customer.city || "",
                                    zip: quote.customer.zip || "",
                                    addressProvince: custProvForUpdate,
                                    // Do NOT set state/region here: Giobby uses customer record's region
                                    // for VAT class lookup. Setting it causes "IT/REGION" lookup which
                                    // fails if no specific IT/REGION VAT class entry is configured.
                                    // Leave region empty → Giobby uses "Tutte le nazioni" → works ✓
                                    country: quote.customer.country || "Italia",
                                    email: quote.customer.email || "",
                                    phone: quote.customer.phone || "",
                                    phoneOffice: quote.customer.phone_office || quote.customer.phoneOffice || "",
                                    mobile: quote.customer.mobile || "",
                                    pec: quote.customer.pec || "",
                                    sdi: quote.customer.sdi || "",
                                    fax: quote.customer.fax || ""
                                };
                                // FIX: Use admin config (config), NOT agent config (clientConfig).
                                // Agent token (U2) cannot update contacts belonging to U1 → 500.
                                // Admin token has write access to all contacts.
                                await window.updateGiobbyClient(config, updatePayload, clientInfo.idContact, agentId);
                                // Also explicitly null region from the Giobby customer record.
                                // Giobby rejects empty strings ("") for region with 500 — must use null.
                                try {
                                    const baseUrlC = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
                                    let clearUrl = baseUrlC + "contacts/" + clientInfo.idContact;
                                    if (config.useProxy) clearUrl = "https://corsproxy.io/?" + encodeURIComponent(clearUrl);
                                    const clearRes = await fetch(clearUrl, {
                                        method: 'PUT',
                                        headers: getGiobbyHeaders(config.accessToken),
                                        body: JSON.stringify({ state: null, region: null, stateOrRegion: null })
                                    });
                                    if (clearRes.ok) {
                                        console.log("✅ [Giobby Export] Regione cliente azzerata su Giobby per compatibilità IVA");
                                    } else {
                                        const clearTxt = await clearRes.text();
                                        console.warn("⚠️ [Giobby Export] Clear region HTTP " + clearRes.status + ":", clearTxt);
                                    }
                                } catch (clearErr) {
                                    console.warn("⚠️ Clear region failed (non-blocking):", clearErr);
                                }
                                showLoadingSpinner("Esportazione su Giobby in corso...");
                            } catch (updateErr) {
                                console.warn("⚠️ [Giobby Export] Aggiornamento preventivo cliente fallito (non bloccante):", updateErr);
                                showLoadingSpinner("Esportazione su Giobby in corso...");
                            }
                        }

                        // --- PERSISTENCE FIX (2025-01-23) ---
                        if (quote.customer) {
                            // Update Quote Memory
                            quote.customer.giobbyContactId = clientInfo.idContact;
                            quote.customer.idCustomer = clientInfo.idCustomer;

                            // Update Registry Memory (if client exists in DB)
                            if (window.db && window.db.saveClient) {
                                const dbClients = window.db.getClients();
                                let realClient = dbClients.find(c => c.id == quote.customer.id);
                                if (!realClient && quote.customer.name) {
                                    realClient = dbClients.find(c => c.name === quote.customer.name);
                                }

                                if (realClient) {
                                    realClient.giobbyContactId = clientInfo.idContact;
                                    realClient.idCustomer = clientInfo.idCustomer;
                                    await window.db.saveClient(realClient);
                                } else {
                                    // Cliente non presente nel registry locale → creazione automatica
                                    const newLocalClient = {
                                        ...quote.customer,
                                        giobbyContactId: clientInfo.idContact,
                                        idCustomer: clientInfo.idCustomer,
                                        agent: quote.agent || quote.customer.agent || ''
                                    };
                                    if (!newLocalClient.id) {
                                        newLocalClient.id = 'C-' + Date.now();
                                    }
                                    try {
                                        await window.db.saveClient(newLocalClient);
                                        console.log('✅ [Giobby Export] Cliente creato automaticamente nel registry locale:', newLocalClient.name, '— Agente:', newLocalClient.agent);
                                    } catch (createErr) {
                                        console.warn('⚠️ [Giobby Export] Impossibile creare il cliente nel registry locale:', createErr);
                                    }
                                }
                            }
                            // Also save the quote to persist these fields on the document itself immediately
                            if (window.db && window.db.saveQuote) {
                                await window.db.saveQuote(quote);
                            }
                        }
                        // ------------------------------------

                    } catch (updErr) {
                        console.warn("Failed to update/persist Giobby Client data:", updErr);
                        // Continue, don't block export
                    }
                }
            }
        } catch (err) {
            console.error("Giobby Info Client Error:", err);
            if (!confirm(`Impossibile identificare il cliente: ${err.message}.\n\nVuoi procedere usando il cliente generico (CLI_DEFAULT)?\n(Il preventivo apparirà come 'Cliente Occasionale')`)) {
                throw err;
            }
            clientInfo = { idContact: "", idCustomer: "CLI_DEFAULT" }; // Fallback risky
        }

        // CLEAR PRODUCT CACHE (start fresh for this export)
        window.clearGiobbyProductCache();

        // DEBUG: log clientInfo per diagnosticare 'cliente non riconosciuto'
        console.log("🧾 [Giobby Export] clientInfo prima del mapping:", JSON.stringify(clientInfo));

        giobbyJson = await mapQuoteToGiobbyModel(quote, clientInfo, config, agentId, agentName);

        // Check if quote already has a Giobby document ID (used to determine success message format)
        const isUpdate = !!(quote.giobbyDocumentId);

        // DEBUG: log i campi cliente nel payload
        console.log("📤 [Giobby Export] Payload cliente:", {
            idCustomer: giobbyJson.idCustomer,
            idContact: giobbyJson.idContact,
            idSalesman: giobbyJson.idSalesman,
            idUserAgent1: giobbyJson.idUserAgent1
        });

        // Giobby API does not support PUT updates or DELETE for offers.
        // We always use POST to create a new document on Giobby.
        const method = 'POST';
        const endpoint = "sales/offers";
        let url = (config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/') + endpoint;

        if (config.useProxy) {
            url = "https://corsproxy.io/?" + encodeURIComponent(url);
        }

        console.log('[Giobby Export] FINAL PAYLOAD:', JSON.stringify(giobbyJson, null, 2));
        let res = await fetch(url, {
            method: method,
            headers: getGiobbyHeaders(config.accessToken),
            body: JSON.stringify(giobbyJson)
        });

        if (!res.ok) {
            const txt = await res.text();
            console.error('🔴 [Giobby API Error] Raw response body:', txt);

            // AUTO-HEAL 3222 (Invalid Numerator)
            if (txt.includes("3222") || txt.includes("IdNumerator")) {
                console.warn("Numerator '1' (or current) is invalid. Attempting to fetch valid numerators...");
                const numerators = await window.fetchGiobbyNumerators(config);
                if (numerators && numerators.length > 0) {
                    // Try 'id' first, then 'numeratorId', then 'code'
                    const validId = numerators[0].id || numerators[0].numeratorId || numerators[0].code;

                    if (validId) {

                        // Update Config
                        config.defaultNumerator = validId;
                        localStorage.setItem('giobbyConfig', JSON.stringify(config));

                        // Update Payload
                        giobbyJson.idNumerator = String(validId);
                        // Retry Fetch
                        res = await fetch(url, {
                            method: method,
                            headers: getGiobbyHeaders(config.accessToken),
                            body: JSON.stringify(giobbyJson)
                        });

                        if (!res.ok) {
                            const txt2 = await res.text();
                            throw new Error(`Giobby API Error (Retry Failed) (${res.status}): ${txt2}`);
                        }
                    } else {
                        throw new Error(`Giobby API Error (${res.status}): ${txt} (Numerator found but ID unclear)`);
                    }
                } else {
                    console.warn(`Giobby API Error (${res.status}): ${txt} (Auto-discovery of numerators failed: none found)`);
                    const fallbackNum = prompt("L'errore 3222 indica che manca un campo obbligatorio.\n\nPotrebbe essere il Numeratore (se non è 1) OPPURE mancano dati come Codice Fiscale, P.IVA o Provincia.\n\nSe credi sia il numeratore, inserisci l'ID (es. 2, 3), altrimenti annulla e controlla l'anagrafica cliente:");
                    if (fallbackNum && fallbackNum.trim()) {
                        config.defaultNumerator = fallbackNum.trim();
                        localStorage.setItem('giobbyConfig', JSON.stringify(config));
                        giobbyJson.idNumerator = String(fallbackNum.trim());
                        res = await fetch(url, {
                            method: method,
                            headers: getGiobbyHeaders(config.accessToken),
                            body: JSON.stringify(giobbyJson)
                        });
                        if (!res.ok) {
                            const txt3 = await res.text();
                            throw new Error(`Giobby API Error (Riprova Manuale Fallito) (${res.status}): ${txt3}\n\nAssicurati che il cliente abbia Codice Fiscale / P.IVA validi!`);
                        }
                    } else {
                        throw new Error(`Giobby API Error (${res.status}): ${txt} (Esportazione annullata. Controlla campi obbligatori del cliente)`);
                    }
                }
            } else if (txt.includes("Codice classe IVA assente") || txt.includes("classe Iva")) {
                console.warn("⚠️ VAT Class Error detected. Attempting to auto-discover the correct 0% VAT class from Giobby...");
                showLoadingSpinner("Cerco codice IVA 0% su Giobby...");
                
                let vatFixed = false;
                try {
                    const vatClasses = await window.fetchGiobbyVatClasses(config);
                    if (vatClasses && vatClasses.length > 0) {
                        console.log("📋 [VAT Fix] Classi IVA disponibili su Giobby:", JSON.stringify(vatClasses));
                        // Look for a 0% class: percentage === 0, or name/description contains '0', 'N6', 'RC', 'esente', 'inversione'
                        const zeroClass = vatClasses.find(v => {
                            const pct = parseFloat(v.percentage || v.vatPercentage || v.aliquota || v.value || -1);
                            const desc = (v.description || v.name || v.desc || v.idVat || "").toLowerCase();
                            return pct === 0 || desc.includes('rc') || desc.includes('reverse') || desc.includes('inversione') || desc.includes('esente') || desc.includes('n6') || desc.includes('n4');
                        });
                        if (zeroClass) {
                            const zeroId = String(zeroClass.idVat || zeroClass.id || zeroClass.code || zeroClass.vatCode || "");
                            if (zeroId) {
                                console.log("✅ [VAT Fix] Trovata classe IVA 0%:", zeroId, zeroClass);
                                // Patch all rows to use the correct idVat
                                if (giobbyJson.rows) {
                                    giobbyJson.rows = giobbyJson.rows.map(row => ({ ...row, idVat: zeroId }));
                                }
                                // Save to config so future exports use the correct code
                                const isRC = (quote.vatRate === '0_rc');
                                if (isRC) { config.vatRC = zeroId; } else { config.vatZero = zeroId; }
                                localStorage.setItem('giobbyConfig', JSON.stringify(config));
                                
                                showLoadingSpinner(`Riprovo con codice IVA "${zeroId}"...`);
                                res = await fetch(url, {
                                    method: method,
                                    headers: getGiobbyHeaders(config.accessToken),
                                    body: JSON.stringify(giobbyJson)
                                });
                                vatFixed = true;
                                if (!res.ok) {
                                    const txt2 = await res.text();
                                    throw new Error(`Giobby API Error (Retry VAT ${zeroId} fallito) (${res.status}): ${txt2}`);
                                }
                            }
                        } else {
                            // Log all available VAT classes so the user can configure correctly
                            const available = vatClasses.map(v => `${v.idVat || v.id || v.code} (${v.percentage || v.vatPercentage || '?'}%)`).join(', ');
                            console.warn("⚠️ [VAT Fix] Nessuna classe IVA 0% trovata. Disponibili:", available);
                            alert(`⚠️ Nessuna classe IVA 0% trovata su Giobby.\n\nClassi IVA disponibili:\n${available}\n\nConfigura il campo "Codice IVA RC" o "Codice IVA Esente / 0%" nelle Impostazioni Giobby di Genesy con uno dei codici disponibili.`);
                            throw new Error(`Giobby API Error (${res.status}): ${txt}`);
                        }
                    }
                } catch (vatErr) {
                    if (vatErr.message.includes('Giobby API Error')) throw vatErr; // Re-throw API errors
                    console.warn("⚠️ [VAT Fix] Ricerca classi IVA fallita:", vatErr);
                }
                
                if (!vatFixed) {
                    // ─── FALLBACK 0: Retry with BU=U1 (original VAT code) ─────────────────────
                    // N6/N4 is configured only for Sede centrale (U1), not for sub-units like U2.
                    // When the error mentions a non-U1 BU, switch to U1 and retry with the same
                    // VAT code (N6/N4) before falling back to 22%.
                    const currentBu = giobbyJson.idBu || "U1";
                    const errorMentionsNonU1Bu = txt.includes("unità aziendale") && !txt.includes("U1");
                    if (currentBu !== "U1" || errorMentionsNonU1Bu) {
                        showLoadingSpinner(`N6 non configurata per BU=${currentBu} — riprovo con Sede Centrale (U1)...`);
                        console.warn(`⚠️ [VAT Fallback 0] N6 non presente su BU=${currentBu}. Riprovo con idBu=U1 (dove N6 è configurata)...`);
                        const u1Json = JSON.parse(JSON.stringify(giobbyJson)); // deep clone
                        u1Json.idBu = "U1";
                        const resU1 = await fetch(url, {
                            method: method,
                            headers: getGiobbyHeaders(config.accessToken),
                            body: JSON.stringify(u1Json)
                        });
                        if (resU1.ok) {
                            res = resU1;
                            vatFixed = true;
                            console.log("✅ [VAT Fallback 0] Esportazione riuscita con idBu=U1.");
                        } else {
                            const txtU1 = await resU1.text();
                            console.warn(`⚠️ [VAT Fallback 0] Retry con U1 fallito (${resU1.status}): ${txtU1}`);
                        }
                    }

                    if (!vatFixed) {
                        // ─── FALLBACK 1: Retry with 22% standard VAT ──────────────────────────────
                        // When 0% VAT classes (N4, N6) are not configured for IT/REGION in Giobby,
                        // we export with 22% (always configured) and add a prominent RC note.
                        const std22Code = config.vat22 || "22";
                        const isRcFallback = (quote.vatRate === '0_rc');
                        const rcNoteText = isRcFallback
                            ? "⚠️ INVERSIONE CONTABILE (Art. 17 c.6 DPR 633/72) – Esportato con IVA 22% per compatibilità Giobby. Correggere classe IVA in Giobby."
                            : "⚠️ IVA ESENTE/0% – Esportato con IVA 22% per compatibilità Giobby. Correggere classe IVA in Giobby.";

                        const fallbackJson = JSON.parse(JSON.stringify(giobbyJson)); // deep clone
                        if (fallbackJson.rows) {
                            fallbackJson.rows = fallbackJson.rows.map(row => ({ ...row, idVat: std22Code }));
                        }
                        fallbackJson.note = ((fallbackJson.note || "").trim() + "\n" + rcNoteText).trim();
                        fallbackJson.internalNote = ((fallbackJson.internalNote || "").trim() + "\n" + rcNoteText).trim();

                        showLoadingSpinner("IVA 0% non configurata — riprovo con IVA 22%...");
                        console.warn("⚠️ [VAT Fallback] 0% VAT class not configured. Retrying with 22%...");
                        const resFallback = await fetch(url, {
                            method: method,
                            headers: getGiobbyHeaders(config.accessToken),
                            body: JSON.stringify(fallbackJson)
                        });

                        if (resFallback.ok) {
                            res = resFallback;
                            vatFixed = true;
                            console.warn("⚠️ [VAT Fallback] Esportato con IVA 22% (fallback).", rcNoteText);
                        } else {
                            // ─── FALLBACK 2: Change idBu to U1 ────────────────────────────────────
                            showLoadingSpinner("Forzo esportazione su Unità Aziendale Principale (U1)...");
                            giobbyJson.idBu = "U1";
                            res = await fetch(url, {
                                method: method,
                                headers: getGiobbyHeaders(config.accessToken),
                                body: JSON.stringify(giobbyJson)
                            });
                            if (!res.ok) {
                                const txt2 = await res.text();
                                throw new Error(`Giobby API Error (Retry U1 fallito) (${res.status}): ${txt2}`);
                            }
                        }
                    }
                }

            } else {
                throw new Error(`Giobby API Error (${res.status}): ${txt}`);
            }

        }

        const result = await res.json();

        // DEBUG: log response to help diagnose API updates
        console.log("📥 [Giobby Export] Response result:", JSON.stringify(result));

        // Save the document ID to the quote for future updates (with fallbacks for different Giobby endpoints returning id/idDocument/documentId/idOffer)
        let returnedId = result.idDocument || result.id || result.documentId || result.idOffer || (result.data && (result.data.id || result.data.idDocument));
        
        // Handle array response if returned
        if (!returnedId && Array.isArray(result) && result.length > 0) {
            const first = result[0];
            returnedId = first.idDocument || first.id || first.documentId || first.idOffer;
        }

        if (returnedId) {
            quote.giobbyDocumentId = String(returnedId);
            quote.giobbySyncDate = new Date().toISOString(); // NEW: Sync Timestamp

            // Persist to Supabase if quote has an ID
            if (quote.id && window.db && window.db.saveQuote) {
                try {
                    await window.db.saveQuote(quote);
                } catch (saveErr) {
                    console.warn("⚠️ Could not save document ID and Sync Date to database:", saveErr);
                }
            }
        } else {
            // Diagnostic Alert
            alert("⚠️ ID Giobby non rilevato nella risposta!\n\nIl preventivo è stato esportato su Giobby, ma il codice non è riuscito a rilevare l'ID del documento creato per associarlo. Le modifiche future creeranno dei duplicati.\n\nRisposta del server: " + JSON.stringify(result));
        }

        // FIX: nascondi lo spinner PRIMA dell'alert, altrimenti resta visibile durante il dialog
        hideLoadingSpinner();

        alert(isUpdate
            ? `Esportazione completata con successo come nuova copia aggiornata!\n(Nuovo Doc #${quote.giobbyDocumentId})`
            : `Esportazione completata con successo!\n(Doc #${quote.giobbyDocumentId || "Generato"})`
        );

        // CLEAR DIRTY FLAGS
        if (window.markEditorClean) window.markEditorClean();

        // OPEN IN GIOBBY
        if (confirm("Vuoi aprire il preventivo su Giobby?")) {
            // Stop celebration effects
            if (typeof window.stopCelebration === 'function') {
                window.stopCelebration();
            }

            // Dynamic URL (2026-01-24)
            // Example: https://app.giobby.com/Giobby00554/company/Offer.xhtml?id=963&ftrID=offer_v
            const docId = quote.giobbyDocumentId || "";
            if (docId) {
                window.open(`https://app.giobby.com/Giobby00554/company/Offer.xhtml?id=${docId}&ftrID=offer_v&idFeature=offer_v`, "_blank");
            } else {
                alert("Impossibile aprire il preventivo: ID documento mancante.");
            }
        } else {
            // Also stop if user declines to open
            if (typeof window.stopCelebration === 'function') {
                window.stopCelebration();
            }
        }

        // DOUBLE SAFETY: Ensure editor is clean after dialog interaction
        if (window.markEditorClean) window.markEditorClean();

    } catch (e) {
        // Specific handling for VAT Class / Null Region error (Error 324)
        if (e.message.includes("Codice classe IVA assente") || e.message.includes("classe Iva") || e.message.includes("Stato/Regione null")) {
            console.warn("VAT Class / Null Region Error detected. Attempting auto-fix by updating Giobby contact...");
            
            if (clientInfo && clientInfo.idContact) {
                try {
                    showLoadingSpinner("Tento auto-correzione Stato/Regione del cliente su Giobby...");
                    
                    const activeConfig = clientConfig || config;
                    const searchData = {
                        type: quote.customer.type || "company",
                        name: quote.customer.name,
                        vat: quote.customer.vat || "",
                        fiscal_code: quote.customer.fiscal_code || "",
                        fiscalCode: quote.customer.fiscal_code || "",
                        address: quote.customer.address || "",
                        email: quote.customer.email || "",
                        city: quote.customer.city || "",
                        zip: quote.customer.zip || "",
                        addressProvince: quote.customer.province || quote.customer.addressProvince || "",
                        state: quote.customer.state || "",
                        country: quote.customer.country || "Italia",
                        phone: quote.customer.phone || "",
                        phoneOffice: quote.customer.phone_office || quote.customer.phoneOffice || "",
                        phoneHome: quote.customer.phone_home || quote.customer.phoneHome || "",
                        mobile: quote.customer.mobile || "",
                        pec: quote.customer.pec || "",
                        sdi: quote.customer.sdi || "",
                        fax: quote.customer.fax || ""
                    };

                    // Force update Giobby contact to fill in Province/Region
                    await window.updateGiobbyClient(activeConfig, searchData, clientInfo.idContact, agentId);

                    // FIX: Also explicitly clear the region on the Giobby customer record.
                    // If the customer already has a region set, Giobby will use it for IVA class lookup
                    // and fail with "Codice classe IVA assente" if no specific IT/REGION rule exists.
                    // Clearing it forces Giobby to use the "Tutte le nazioni" rule which works. ✓
                    try {
                        const baseUrlCatch = activeConfig.apiUrl.endsWith('/') ? activeConfig.apiUrl : activeConfig.apiUrl + '/';
                        let clearUrlCatch = baseUrlCatch + "contacts/" + clientInfo.idContact;
                        if (activeConfig.useProxy) clearUrlCatch = "https://corsproxy.io/?" + encodeURIComponent(clearUrlCatch);
                        await fetch(clearUrlCatch, {
                            method: 'PUT',
                            headers: getGiobbyHeaders(activeConfig.accessToken),
                            body: JSON.stringify({ state: "", region: "", stateOrRegion: "" })
                        });
                        console.log("✅ [Giobby Catch Fix] Regione cliente azzerata su Giobby per compatibilità IVA");
                    } catch (clearErrCatch) {
                        console.warn("⚠️ [Giobby Catch Fix] Clear region failed (non-blocking):", clearErrCatch);
                    }

                    // FIX: Try VAT auto-discovery before retrying, in case N6/N4 is not configured.
                    // This mirrors the logic in the !res.ok handler and patches giobbyJson with the
                    // correct idVat before we re-send, instead of blindly re-sending what already failed.
                    try {
                        showLoadingSpinner("Cerco codice IVA 0% su Giobby...");
                        const vatClassesCatch = await window.fetchGiobbyVatClasses(activeConfig);
                        if (vatClassesCatch && vatClassesCatch.length > 0) {
                            console.log("📋 [VAT Fix / Catch] Classi IVA disponibili su Giobby:", JSON.stringify(vatClassesCatch));
                            const zeroClassCatch = vatClassesCatch.find(v => {
                                const pct = parseFloat(v.percentage || v.vatPercentage || v.aliquota || v.value || -1);
                                const desc = (v.description || v.name || v.desc || v.idVat || "").toLowerCase();
                                return pct === 0 || desc.includes('rc') || desc.includes('reverse') || desc.includes('inversione') || desc.includes('esente') || desc.includes('n6') || desc.includes('n4');
                            });
                            if (zeroClassCatch) {
                                const zeroIdCatch = String(zeroClassCatch.idVat || zeroClassCatch.id || zeroClassCatch.code || zeroClassCatch.vatCode || "");
                                if (zeroIdCatch) {
                                    console.log("✅ [VAT Fix / Catch] Trovata classe IVA 0%:", zeroIdCatch, zeroClassCatch);
                                    if (giobbyJson.rows) {
                                        giobbyJson.rows = giobbyJson.rows.map(row => ({ ...row, idVat: zeroIdCatch }));
                                    }
                                    // Save to config so future exports use the correct code
                                    const isRCCatch = (quote.vatRate === '0_rc');
                                    if (isRCCatch) { activeConfig.vatRC = zeroIdCatch; } else { activeConfig.vatZero = zeroIdCatch; }
                                    localStorage.setItem('giobbyConfig', JSON.stringify(activeConfig));
                                }
                            }
                        }
                    } catch (vatErrCatch) {
                        console.warn("⚠️ [VAT Fix / Catch] Auto-discovery IVA fallita (non-blocking):", vatErrCatch);
                    }

                    showLoadingSpinner("Anagrafica corretta. Riprovo esportazione preventivo...");

                    // FIX: Always use POST — Giobby does not support PUT for offers.
                    // Using PUT was causing the retry to always fail silently.
                    const retryEndpoint = "sales/offers";
                    let retryUrl = (activeConfig.apiUrl.endsWith('/') ? activeConfig.apiUrl : activeConfig.apiUrl + '/') + retryEndpoint;
                    if (activeConfig.useProxy) retryUrl = "https://corsproxy.io/?" + encodeURIComponent(retryUrl);

                    const retryRes = await fetch(retryUrl, {
                        method: 'POST',
                        headers: getGiobbyHeaders(activeConfig.accessToken),
                        body: JSON.stringify(giobbyJson)
                    });

                    if (retryRes.ok) {
                        const retryResult = await retryRes.json();
                        let returnedId = retryResult.idDocument || retryResult.id || retryResult.documentId || retryResult.idOffer || (retryResult.data && (retryResult.data.id || retryResult.data.idDocument));
                        if (!returnedId && Array.isArray(retryResult) && retryResult.length > 0) {
                            const first = retryResult[0];
                            returnedId = first.idDocument || first.id || first.documentId || first.idOffer;
                        }
                        if (returnedId) {
                            quote.giobbyDocumentId = String(returnedId);
                            if (window.db && window.db.saveQuote) {
                                await window.db.saveQuote(quote);
                            }
                        }

                        alert("Esportazione completata con successo! (Stato/Regione cliente auto-corretto su Giobby)");
                        if (window.markEditorClean) window.markEditorClean();
                        
                        // Open in Giobby
                        if (confirm("Vuoi aprire il preventivo su Giobby?")) {
                            const docId = quote.giobbyDocumentId || "";
                            if (docId) {
                                window.open(`https://app.giobby.com/Giobby00554/company/Offer.xhtml?id=${docId}&ftrID=offer_v&idFeature=offer_v`, "_blank");
                            }
                        }
                        return; // Success!
                    } else {
                        console.warn("Auto-fix retry failed to post document. Proceeding to manual alert.");
                    }
                } catch (autoFixErr) {
                    console.error("Auto-fix customer update failed:", autoFixErr);
                } finally {
                    hideLoadingSpinner();
                }
            }
            
            let debugCustState = (quote.customer && (quote.customer.state || quote.customer.region)) || "";
            const debugCustProv = (quote.customer && (quote.customer.province || quote.customer.addressProvince || "")).trim().toUpperCase();
            if (!debugCustState && debugCustProv && window.inferRegionFromProvince) {
                debugCustState = window.inferRegionFromProvince(debugCustProv);
            }
            if (typeof sanitizeRegionForGiobby === 'function') {
                debugCustState = sanitizeRegionForGiobby(debugCustState);
            }

            // Extract the actual Giobby error from the exception message
            console.error("VAT Class / Null Region Error:", e);
            let giobbyErrMsg = e.message || "";
            // Try to extract developerMessage from JSON in the error
            try {
                const jsonStart = giobbyErrMsg.indexOf('{');
                if (jsonStart >= 0) {
                    const parsed = JSON.parse(giobbyErrMsg.slice(jsonStart));
                    if (parsed.developerMessage || parsed.userMessage) {
                        giobbyErrMsg = (parsed.developerMessage || parsed.userMessage).replace(/\\n/g, '\n');
                    }
                }
            } catch (_) {}

            // Check if it's specifically a VAT class code configuration issue
            const vatCodeMatch = giobbyErrMsg.match(/classe Iva (\S+)/i) || giobbyErrMsg.match(/class IVA (\S+)/i);
            const missingVatCode = vatCodeMatch ? vatCodeMatch[1] : null;

            if (missingVatCode) {
                // VAT class code not configured in Giobby — give specific instructions
                alert(`⚠️ ERRORE: Classe IVA "${missingVatCode}" non configurata su Giobby\n\n` +
                    `Messaggio Giobby:\n${giobbyErrMsg}\n\n` +
                    `👉 COME RISOLVERE (scegli una delle seguenti):\n\n` +
                    `OPZIONE 1 — Configura "${missingVatCode}" in Giobby:\n` +
                    `  • Vai su Giobby → Impostazioni → Gestione IVA e Tax\n` +
                    `  • Assicurati che "${missingVatCode}" sia configurata per BU=U1, Nazione=IT, Regione=Emilia Romagna\n\n` +
                    `OPZIONE 2 — Usa un codice IVA diverso in Genesy:\n` +
                    `  • Vai in Impostazioni → Giobby e modifica il campo "Codice IVA Esente / 0%" con il codice corretto dal tuo Giobby\n\n` +
                    `OPZIONE 3 — Se il preventivo è Reverse Charge:\n` +
                    `  • Cambia il tipo IVA del preventivo in Genesy da "0% Esente" a "0% Reverse Charge" (usa il codice N6.3 che è già configurato)`);  
            } else {
                // Generic VAT/Region error — show actual Giobby message
                alert(`⚠️ ERRORE ESPORTAZIONE GIOBBY\n\n${giobbyErrMsg || e.message}`);
            }
            return;
        }

        // ERROR 324: CLIENTE NON PRESENTE (Stale ID or Invalid "CLI_DEFAULT")
        // Try to recover by clearing cached IDs and retrying ONCE.
        if (e.message.includes("324") || e.message.includes("Cliente non presente")) {
            console.warn("Error 324 detected. Cached Client IDs might be stale. Retrying with fresh search...");

            // 1. Clear cached IDs on the quote object to force fresh search
            if (quote.customer) {
                delete quote.customer.giobbyContactId;
                delete quote.customer.idCustomer;
            }

            // 2. Clear clientInfo to force regeneration
            // We need to re-run the discovery logic. 
            // Since we can't easily "goto" top, we will recursively call exportQuoteToGiobby but we need to ensure we don't loop infinitely.
            // A simpler approach is to copy the logic here or restructure.
            // Let's restructure slightly to allow a retry or just copy the search logic block.

            // Actually, simply clearing the IDs and telling the user to retry might be safer, BUT automating is better.
            // Let's try to notify user and ask to retry if we can't easily loop. 
            // WAIT! We can just call exportQuoteToGiobby again? 
            // Yes, but we need to make sure we don't infinite loop if it fails again.
            // Let's add a flag? No, simpler: Just alert helpful message.
            // OR better: Implement the retry cleanly.

            try {
                showLoadingSpinner("Errore Cliente (324). Riprovo sincronizzazione anagrafica...");

                // Re-run Find/Create logic manually here
                const searchData = {
                    type: quote.customer.type || "company", // Fallback, normally populated
                    name: quote.customer.name,
                    vat: quote.customer.vat || "",
                    fiscal_code: quote.customer.fiscal_code || "",
                    fiscalCode: quote.customer.fiscal_code || "",
                    address: quote.customer.address || "",
                    email: quote.customer.email || "",
                    city: quote.customer.city || "",
                    zip: quote.customer.zip || "",
                    addressProvince: quote.customer.province || quote.customer.addressProvince || "",
                    state: quote.customer.state || "",
                    country: quote.customer.country || "Italia",
                    phone: quote.customer.phone || "",
                    phoneOffice: quote.customer.phone_office || quote.customer.phoneOffice || "",
                    phoneHome: quote.customer.phone_home || quote.customer.phoneHome || "",
                    mobile: quote.customer.mobile || "",
                    pec: quote.customer.pec || "",
                    sdi: quote.customer.sdi || "",
                    fax: quote.customer.fax || ""
                };

                // Force full search
                const newClientInfo = await findOrCreateGiobbyClient(config, searchData);

                // Update quote customer with new fresh IDs
                if (newClientInfo && newClientInfo.idContact) {
                    quote.customer.giobbyContactId = newClientInfo.idContact;
                    quote.customer.idCustomer = newClientInfo.idCustomer;
                    // Persist this fix locally so next time it's correct
                    await db.saveQuote(quote);
                }

                // Re-map (FIX: added missing await and arguments)
                const newGiobbyJson = await mapQuoteToGiobbyModel(quote, newClientInfo, config, agentId, agentName);

                // Re-construct URL and Method for retry
                const isRetryUpdate = !!(quote.giobbyDocumentId);
                const retryMethod = isRetryUpdate ? 'PUT' : 'POST';
                const retryEndpoint = isRetryUpdate ? `sales/offers/${quote.giobbyDocumentId}` : "sales/offers";

                let retryUrl = (config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/') + retryEndpoint;
                if (config.useProxy) retryUrl = "https://corsproxy.io/?" + encodeURIComponent(retryUrl);

                // Re-send
                const retryRes = await fetch(retryUrl, {
                    method: retryMethod,
                    headers: getGiobbyHeaders(config.accessToken),
                    body: JSON.stringify(newGiobbyJson)
                });

                if (!retryRes.ok) {
                    const retryTxt = await retryRes.text();
                    throw new Error(`Retry Fallito (${retryRes.status}): ${retryTxt}`);
                }

                const retryResult = await retryRes.json();
                alert("Esportazione completata con successo! (Anagrafica rigenerata)");
                if (window.markEditorClean) window.markEditorClean();
                return; // Exit success

            } catch (retryErr) {
                console.error("Retry Failed:", retryErr);
                alert("Non è stato possibile risolvere l'errore sull'anagrafica cliente.\n\nDettaglio: " + retryErr.message);
                return;
            }
        }

        console.error("Giobby Export Failed:", e);
        alert("Errore durante l'esportazione: " + e.message);
    } finally {
        hideLoadingSpinner();
    }
};

// UI Helpers
function showLoadingSpinner(msg) {
    let loader = document.getElementById('loadingView');
    if (loader) {
        loader.classList.remove('hidden');
        loader.style.display = 'flex';
        let txt = document.getElementById('loadingText');
        if (txt) txt.textContent = msg;
    }
}
function hideLoadingSpinner() {
    let loader = document.getElementById('loadingView');
    if (loader) {
        loader.classList.add('hidden');
        loader.style.display = 'none';
    }
}


// --- RESTORED LEGACY FUNCTIONS (Import/Sync) ---

// 4. Import Contacts from Giobby
window.importGiobbyContacts = async function () {
    const jsonConfig = localStorage.getItem('giobbyConfig');
    if (!jsonConfig) return alert("Non sei connesso a Giobby!");
    const config = JSON.parse(jsonConfig);

    if (!confirm("Avviare l'importazione dei clienti da Giobby?\\nI clienti esistenti verranno aggiornati se la P.IVA corrisponde.")) return;

    try {
        showLoadingSpinner("Importazione Clienti da Giobby...");

        const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
        let endpointPath = await getEffectiveEndpoint(config, 'customers');
        let fetchUrl = baseUrl + endpointPath + "?pageSize=500";
        if (config.useProxy) fetchUrl = "https://corsproxy.io/?" + encodeURIComponent(fetchUrl);

        const res = await fetch(fetchUrl, {
            method: 'GET',
            headers: getGiobbyHeaders(config.accessToken)
        });

        const type = res.headers.get('content-type');
        if (!res.ok) {
            const txt = await res.text();
            if (type && type.includes('text/html')) {
                throw new Error(`Errore Ricerca Clienti: ${res.status}\\n Endpoint errato o risposta HTML non valida.\\nURL: ${fetchUrl}`);
            }
            throw new Error(`Fetch Failed (${res.status}): ${txt.substring(0, 100)}`);
        }

        const data = await res.json();
        const list = data.customers || data.contacts || (Array.isArray(data) ? data : []);

        if (list.length === 0) return alert("Nessun cliente trovato su Giobby.");

        let importedCount = 0;
        let updatedCount = 0;
        const existingClients = db.getClients();

        for (const gClient of list) {
            const vat = gClient.vatCode || "";
            const fiscalCode = gClient.fiscalCode || "";
            const name = gClient.name || gClient.ragioneSociale || "Sconosciuto";
            if (!name) continue;

            const clientObj = {
                name: name,
                vat: vat,
                fiscal_code: fiscalCode,
                address: (gClient.address || "") + (gClient.city ? " - " + gClient.city : ""),
                email: gClient.email || "",
                phone: gClient.phone || gClient.phone1 || gClient.mobile || "",
            };

            let match = null;
            if (vat) match = existingClients.find(c => c.vat === vat);
            if (!match && fiscalCode) match = existingClients.find(c => c.fiscal_code === fiscalCode);
            if (!match) match = existingClients.find(c => c.name.toLowerCase() === name.toLowerCase());

            if (match) {
                clientObj.id = match.id;
                await db.saveClient(clientObj);
                updatedCount++;
            } else {
                await db.saveClient(clientObj);
                importedCount++;
            }
        }
        if (window.renderGenericClientsTable) renderGenericClientsTable();
        alert(`Importazione Completata!\\nNuovi: ${importedCount}\\nAggiornati: ${updatedCount}`);
    } catch (e) {
        console.error(e);
        alert("Errore Importazione: " + e.message);
    } finally {
        hideLoadingSpinner();
    }
};

// 5. Sync Clients TO Giobby (Export)
window.syncClientsToGiobby = async function () {
    localStorage.removeItem('giobby_ep_v7_customers');
    localStorage.removeItem('giobby_ep_v7_registry/customers');

    const jsonConfig = localStorage.getItem('giobbyConfig');
    if (!jsonConfig) return alert("Non sei connesso a Giobby!");
    const config = JSON.parse(jsonConfig);

    const localClients = db.getClients();
    if (localClients.length === 0) return alert("Nessun cliente locale da esportare.");

    if (!confirm(`Trovati ${localClients.length} clienti locali.\\nAvviare l'esportazione su Giobby?\\n(I clienti esistenti su Giobby verranno ignorati)`)) return;

    let errors = [];
    try {
        showLoadingSpinner(`Avvio export di ${localClients.length} clienti...`);
        await new Promise(r => setTimeout(r, 100));

        for (let i = 0; i < localClients.length; i++) {
            const client = localClients[i];
            showLoadingSpinner(`Esportazione (${i + 1}/${localClients.length}): ${client.name}`);
            try {
                const giobbyData = {
                    name: client.name,
                    vatNumber: client.vat,
                    taxCode: client.taxCode || "",
                    email: client.email,
                    phone: client.phone,
                    address: client.address
                };
                await findOrCreateGiobbyClient(config, giobbyData);
            } catch (err) {
                console.error(`Export Error for ${client.name}:`, err);
                errors.push(`${client.name}: ${err.message}`);
            }
            await new Promise(r => setTimeout(r, 200));
        }

        let msg = `Esportazione Completata!`;
        if (errors.length > 0) {
            msg += `\\nErrori: ${errors.length}`;
            msg += "\\n\\nPrimi errori riscontrati:\\n" + errors.slice(0, 3).join("\\n");
        }
        alert(msg);
    } catch (e) {
        console.error(e);
        alert("Errore Generale Esportazione: " + e.message);
    } finally {
        hideLoadingSpinner();
    }
};

// 6. Import Last 100 Quotes from Giobby
window.importRecentQuotesFromGiobby = async function () {
    const jsonConfig = localStorage.getItem('giobbyConfig');
    if (!jsonConfig) return alert("Non sei connesso a Giobby!");
    const config = JSON.parse(jsonConfig);

    if (!confirm("Vuoi importare gli ultimi 100 preventivi da Giobby?\\nI preventivi esistenti verranno aggiornati.")) return;

    try {
        showLoadingSpinner("Importazione preventivi da Giobby...");
        const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
        let docEndpoint = await getEffectiveEndpoint(config, 'sales_offers');
        let fetchUrl = baseUrl + docEndpoint + "?limit=100";
        if (config.useProxy) fetchUrl = "https://corsproxy.io/?" + encodeURIComponent(fetchUrl);
        const res = await fetch(fetchUrl, {
            method: 'GET',
            headers: getGiobbyHeaders(config.accessToken)
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Errore Fetch Lista (${res.status}) su ${fetchUrl}: ${txt.substring(0, 200)}...`);
        }

        const data = await res.json();
        const list = data.documentsHeaders || data.objects || data.items || [];

        if (list.length === 0) return alert("Nessun preventivo trovato.");

        let importedCount = 0;
        showLoadingSpinner(`Trovati ${list.length} preventivi. Inizio importazione dettagli...`);

        for (let i = 0; i < list.length; i++) {
            const header = list[i];
            if (i % 5 === 0) showLoadingSpinner(`Importazione ${i + 1}/${list.length} (Doc: ${header.docNumber})...`);

            try {
                let detailPath = `sales/offers/${header.id}`;
                let detailUrl = baseUrl + detailPath;
                if (config.useProxy) detailUrl = "https://corsproxy.io/?" + encodeURIComponent(detailUrl);

                let resDetail = await fetch(detailUrl, {
                    method: 'GET',
                    headers: getGiobbyHeaders(config.accessToken)
                });

                let detailDoc = null;
                if (!resDetail.ok && resDetail.status === 404) {
                    let queryPath = `sales/offers?id=${header.id}`;
                    let queryUrl = baseUrl + queryPath;
                    if (config.useProxy) queryUrl = "https://corsproxy.io/?" + encodeURIComponent(queryUrl);
                    const resQuery = await fetch(queryUrl, { headers: getGiobbyHeaders(config.accessToken) });
                    if (resQuery.ok) {
                        const qData = await resQuery.json();
                        if (qData.items && qData.items.length > 0) detailDoc = qData.items[0];
                        else if (qData.objects && qData.objects.length > 0) detailDoc = qData.objects[0];
                        else detailDoc = qData;
                    }
                } else if (resDetail.ok) {
                    detailDoc = await resDetail.json();
                }

                if (!detailDoc) detailDoc = header;
                const quote = mapGiobbyDocumentToQuote(detailDoc, header);
                if (quote) {
                    await db.saveQuote(quote);
                    importedCount++;
                }
                await new Promise(r => setTimeout(r, 50));
            } catch (err) {
                console.error(`Error importing doc ${header.id}`, err);
            }
        }
        if (window.renderQuotesTable) renderQuotesTable();
        alert(`Importazione completata: ${importedCount} preventivi.`);
    } catch (e) {
        console.error(e);
        alert("Errore Importazione: " + e.message);
    } finally {
        hideLoadingSpinner();
    }
};

// Helper: Map Giobby Doc to Local Quote
function mapGiobbyDocumentToQuote(doc, headerFallback = {}) {
    try {
        const rawRows = doc.rows || doc.items || [];
        const lines = rawRows.map(r => ({
            code: r.itemCode || r.code || r.idMaterial || "",
            description: r.description || "",
            unit: r.unitOfMeasure || r.uom || "pz",
            quantity: parseFloat(r.quantity) || 1,
            price: parseFloat(r.unitPrice) || parseFloat(r.price) || 0,
            vat: parseFloat(r.vatRate) || parseFloat(r.idVat) || 22,
            total: (parseFloat(r.quantity) || 1) * (parseFloat(r.unitPrice) || parseFloat(r.price) || 0)
        }));

        let dateVal = doc.docDate || headerFallback.docDate || new Date();
        let dateStr = new Date().toISOString().split('T')[0];
        try {
            if (typeof dateVal === 'string' && /^\d+$/.test(dateVal)) {
                dateStr = new Date(parseInt(dateVal)).toISOString().split('T')[0];
            } else if (typeof dateVal === 'number') {
                dateStr = new Date(dateVal).toISOString().split('T')[0];
            } else if (typeof dateVal === 'string') {
                dateStr = dateVal.split('T')[0];
            }
        } catch (e) { }

        let custName = "Cliente Giobby";
        if (doc.destCompanyName && doc.destCompanyName.trim().length > 0) custName = doc.destCompanyName;
        else if (doc.companyName && doc.companyName.trim().length > 0) custName = doc.companyName;
        else if (doc.customerName) custName = doc.customerName;
        else if (doc.customer && doc.customer.name) custName = doc.customer.name;
        else if (doc.customerData && doc.customerData.name) custName = doc.customerData.name;
        else if (headerFallback.customerName) custName = headerFallback.customerName;
        else if (headerFallback.companyName) custName = headerFallback.companyName;

        let addr = "";
        const cd = doc.deliveryData || doc.customerData || headerFallback.customerData;
        if (doc.destAddress) {
            const parts = [doc.destAddress, doc.destCity, doc.destZip, doc.destProvince].filter(Boolean);
            addr = parts.join(", ");
        }
        else if (cd) {
            const parts = [cd.street || cd.address, cd.city, cd.zip].filter(Boolean);
            addr = parts.join(", ");
        }

        let finalId = doc.docNumber || headerFallback.docNumber || doc.number || headerFallback.number || doc.id || headerFallback.id;
        if (!finalId) return null;

        const totalAmount = doc.totalAmount || headerFallback.totalAmount || lines.reduce((sum, l) => sum + l.total, 0);

        return {
            id: String(finalId),
            date: dateStr,
            status: "Aperto",
            customer: {
                name: custName,
                vat: doc.vatCode || headerFallback.vatCode || "",
                address: addr,
                email: doc.destEmail || "",
                phone: doc.destPhone || ""
            },
            items: lines,
            total: parseFloat(totalAmount) || 0,
            reference: doc.reference || doc.project || doc.job || headerFallback.reference || "",
            notesInternal: doc.internalNote || doc.note || headerFallback.note || "",
            notesExternal: "",
            deliveryDate: doc.deliveryDate ? (String(doc.deliveryDate).includes('-') ? doc.deliveryDate.split('T')[0] : "") : ""
        };
    } catch (e) {
        console.warn("Skipping doc due to mapping error:", doc, e);
        return null;
    }
}

/**
 * Reads the client data from the Modal Form and attempts to sync/create it on Giobby.
 * Used by the stand-alone "Sync Giobby" button in the Client Modal.
 */
window.syncCurrentClientToGiobby = async function (forceNew = false) {
    // 1. Read Data from Form
    const name = document.getElementById('newClientName').value.trim();
    if (!name) {
        alert("Inserisci almeno il Nome/Ragione Sociale.");
        return;
    }

    const clientTypeEl = document.querySelector('input[name="clientType"]:checked');
    const clientType = clientTypeEl ? clientTypeEl.value : 'private';

    const clientData = {
        name: name,
        type: clientType,
        address: document.getElementById('newClientAddress').value.trim(),
        city: document.getElementById('newClientCity').value.trim(),
        zip: document.getElementById('newClientZip').value.trim(),
        province: document.getElementById('newClientAddressProvince').value.trim(),
        country: document.getElementById('newClientCountry').value.trim(),
        email: document.getElementById('newClientEmail').value.trim(),
        pec: document.getElementById('newClientPec').value.trim(),
        phone: document.getElementById('newClientPhoneOffice').value.trim(), // Ufficio
        phoneHome: document.getElementById('newClientPhoneHome').value.trim(),
        mobile: document.getElementById('newClientMobile').value.trim(),
        fax: document.getElementById('newClientFax').value.trim(),
        vat: document.getElementById('newClientVat').value.trim(),
        fiscalCode: document.getElementById('newClientFiscalCode').value.trim(),
        sdi: document.getElementById('newClientSdi').value.trim(),
        // Extra fields
        language: document.getElementById('newClientLang').value,
        sector: document.getElementById('newClientSector').value,
        origin: document.getElementById('newClientOrigin').value
    };

    // 2. Prepare Config
    let config = null;
    try {
        if (typeof loadGiobbySettings === 'function') config = await loadGiobbySettings();
        else if (window.GiobbySettings) config = window.GiobbySettings;

        // Fallback: Check localStorage manually if not found via global helper
        if (!config) {
            const jsonConfig = localStorage.getItem('giobbyConfig');
            if (jsonConfig) config = JSON.parse(jsonConfig);
        }
    } catch (e) { }


    if (!config || !config.accessToken) {
        alert("Configurazione Giobby assente o incompleta. Controlla le Impostazioni.");
        return;
    }

    // 3. AGENT CONTEXT & AUTH (MULTI-AGENT)
    // Extract Agent ID from selected agent in dropdown
    let targetAgentId = null;
    let effectiveConfig = { ...config }; // Default to Admin Config

    const agentSelect = document.getElementById('newClientAgent');
    if (agentSelect && agentSelect.value) {
        const agentName = agentSelect.value;
        const vars = db.getProductVars();

        // MANUAL ID OVERRIDE (Input Field)
        const manualIdInput = document.getElementById('newClientAgentGiobbyId');
        const manualId = manualIdInput ? manualIdInput.value.trim() : null;

        if (vars && vars.agentsMetadata) {
            const meta = vars.agentsMetadata[agentName];

            // A. ID Assignment (Prioritize Manual Input, then Metadata)
            if (manualId) {
                targetAgentId = manualId;

                // SAVE FOR FUTURE: Update Metadata if different
                if (window.updateAgentMeta && (!meta || meta.giobbyAgentId !== manualId)) {
                    window.updateAgentMeta(agentName, 'giobbyAgentId', manualId);
                }
            }
            else if (meta && meta.giobbyAgentId) {
                targetAgentId = meta.giobbyAgentId;
            } else {
                console.warn(`[Sync] Agent '${agentName}' selected but no ID found (Metadata/Manual).`);
            }

            // B. IMPERSONATION (Multi-Agent Auth)
            if (meta && meta.giobbyUsername && meta.giobbyPassword) {
                const btn = document.getElementById('btnSyncGiobby');
                if (btn) btn.innerHTML = '<i class="fa-solid fa-key fa-spin"></i> Login Agente...';

                try {
                    const agentToken = await window.authenticateAgent(meta.giobbyUsername, meta.giobbyPassword, config);

                    if (agentToken) {
                        effectiveConfig.accessToken = agentToken; // SWAP TOKEN
                    }
                } catch (authErr) {
                    console.error("[Sync] Agent Auth Failed:", authErr);
                    alert(`Errore Autenticazione Agente (${agentName}):\n${authErr.message}\n\nLa sincronizzazione è stata annullata per evitare errori di proprietà.`);
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = btn.getAttribute('data-original-text') || 'Sync Giobby';
                    }
                    return; // Abort
                }
            }
        }
    }

    // 4. Force New Check
    // If 'forceNew' is passed, we skip 'findOrCreate' and call 'createGiobbyClient' directly.
    let result = null;

    // Add logic to confirm action if forceNew is NOT passed but we might want to ask?
    // User interface handles this via separate button now.

    const btnForce = document.getElementById('btnForceNewGiobby');

    if (btnForce) btnForce.disabled = true;

    if (btnForce) btnForce.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creazione...';

    try {

        // ALWAYS FORCE NEW (since UI only offers this now, effectively)
        // But function signature allows both. 
        if (forceNew) {
            // DIRECT CREATE
            if (!confirm("Sei sicuro di voler creare una NUOVA anagrafica su Giobby?\n(Verranno ignorati eventuali duplicati esistenti)")) {
                throw new Error("Operazione annullata dall'utente.");
            }
            result = await window.createGiobbyClient(effectiveConfig, clientData, targetAgentId);
        } else {
            // BACKWARD COMPATIBILITY / FALLBACK
            result = await findOrCreateGiobbyClient(effectiveConfig, clientData, true, targetAgentId);
        }

        if (result && result.idCustomer) {
            // Success!
            const elId = document.getElementById('newClientIdCustomer');
            if (elId) {
                elId.value = result.idCustomer;
                elId.classList.add('input-success');
                setTimeout(() => elId.classList.remove('input-success'), 3000);
            }
            // Save Internal ID too
            const elContactId = document.getElementById('newClientGiobbyContactId');
            if (elContactId && result.idContact) elContactId.value = result.idContact;

            alert(`Sincronizzazione Completata!\n\nCodice Giobby Assegnato: ${result.idCustomer}\n\nIl contatto è stato aggiornato/creato su Giobby.`);

            // Auto-open Giobby Page (User Request: "Crea e Apri")
            // No confirmation needed as button explicit action is "Create & Open"
            if (window.openGiobbyClientLink) {
                window.openGiobbyClientLink();
            } else {
                console.warn("Funzione 'openGiobbyClientLink' non disponibile.");
            }
        } else if (result && result.idContact) {
            // Found contact but no Customer ID
            alert(`Contatto sincronizzato (ID: ${result.idContact}) ma Giobby non ha restituito il Codice Cliente.\nVerifica che P.IVA/CF siano corretti.`);
        } else {
            // Fallback warning
            alert("Sincronizzazione completata ma nessun dato restituito. Controlla il codice cliente se è apparso.");
        }

    } catch (e) {
        console.error("Sync Error:", e);
        alert("Errore durante la sincronizzazione: " + e.message);
    } finally {
        if (btnForce) {
            btnForce.disabled = false;
            // Restore original text via hardcoded value or attribute
            btnForce.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Nuovo su Giobby';
        }
    }
};

// 4. Open in Giobby Helper
// (Function definition follows below)

// 4. Open in Giobby Helper
window.openQuoteInGiobby = function (input) {
    // Support both string ID and object with giobbyDocumentId
    let docId = null;

    if (typeof input === 'string') {
        docId = input;
    } else if (typeof input === 'object' && input !== null) {
        docId = input.giobbyDocumentId;
    }

    if (!docId) {
        console.error("openQuoteInGiobby called with invalid input:", input);
        alert("Questo preventivo non è ancora stato esportato su Giobby (Manca ID Documento).");
        return;
    }

    const jsonConfig = localStorage.getItem('giobbyConfig');
    if (!jsonConfig) {
        // Fallback or alert
        alert("Configurazione Giobby mancante.");
        return;
    }
    const config = JSON.parse(jsonConfig);

    // Construct URL
    // Pattern: https://app.giobby.com/Giobby00554/company/Offer.xhtml?id=830&ftrID=offer_v

    // Attempt to find Tenant ID (e.g. Giobby00554)
    let tenantId = config.giobbyInstanceId || "Giobby00554"; // Fallback to safe default
    if (tenantId === "Giobby00553" || tenantId === "00553") tenantId = "Giobby00554";

    // Heuristic: extract from API URL if available and specific
    if (config.apiUrl && config.apiUrl.includes("app.giobby.com")) {
        try {
            // https: / / app.giobby.com / Giobby00554 / ...
            const parts = config.apiUrl.split('/');
            if (parts.length >= 4 && parts[3].startsWith('Giobby')) {
                tenantId = parts[3].replace("GiobbyApi", "Giobby");
                if (tenantId === "Giobby00553") tenantId = "Giobby00554";
            }
        } catch (e) { }
    }

    const url = `https://app.giobby.com/${tenantId}/company/Offer.xhtml?id=${docId}&ftrID=offer_v&idFeature=offer_v`;

    console.log("Opening Giobby document:", { docId, tenantId, url });

    window.open(url, '_blank');
};

// 5. Open Giobby Client Link Helper
window.openGiobbyClientLink = function () {
    const inputEl = document.getElementById('newClientIdCustomer');
    const inputId = document.getElementById('newClientGiobbyContactId');

    // Priority: Internal GUID > Customer Code
    let clientId = inputId ? inputId.value : "";
    if (!clientId && inputEl) clientId = inputEl.value;

    if (!clientId) {
        console.warn("No Client ID found (neither Internal GUID nor Customer Code).");
        alert("ID Cliente non trovato. Assicurati di aver sincronizzato il contatto.");
        return;
    }

    const jsonConfig = localStorage.getItem('giobbyConfig');
    if (!jsonConfig) {
        alert("Configurazione Giobby mancante.");
        return;
    }
    const config = JSON.parse(jsonConfig);

    // Construct URL
    // Pattern provided by User: https://app.giobby.com/{tenantId}/company/Contact.xhtml?ftrID=cust_n

    // Attempt to find Tenant ID (e.g. Giobby00554)
    let tenantId = config.giobbyInstanceId || "Giobby00554"; // Fallback to safe default
    if (tenantId === "Giobby00553" || tenantId === "00553") tenantId = "Giobby00554";

    // Heuristic: extract from API URL if available and specific
    if (config.apiUrl && config.apiUrl.includes("app.giobby.com")) {
        try {
            const parts = config.apiUrl.split('/');
            if (parts.length >= 4 && parts[3].startsWith('Giobby')) {
                tenantId = parts[3];
                // FIX: If API URL contains 'GiobbyApi...', remove 'Api' for the Web UI URL
                // Example: GiobbyApi00554 -> Giobby00554
                tenantId = tenantId.replace("GiobbyApi", "Giobby");
                if (tenantId === "Giobby00553") tenantId = "Giobby00554";
            }
        } catch (e) { }
    }

    // Base URL for Contacts (New/List mode)
    let url = `https://app.giobby.com/${tenantId}/company/Contact.xhtml?ftrID=cust_n&idFeature=cust_n`;

    // If we have a specific ID, append it
    if (clientId) {
        url += `&id=${clientId}`;
    }

    window.open(url, '_blank');
};

// 6. Open NEW Giobby Client Tab (Link only) with Credentials Helper
window.openNewGiobbyClientTab = async function () {
    const jsonConfig = localStorage.getItem('giobbyConfig');
    if (!jsonConfig) return alert("Configurazione Giobby mancante.");
    const config = JSON.parse(jsonConfig);

    let tenantId = config.giobbyInstanceId || "Giobby00554";
    if (tenantId === "Giobby00553" || tenantId === "00553") tenantId = "Giobby00554";
    if (config.apiUrl && config.apiUrl.includes("app.giobby.com")) {
        try {
            const parts = config.apiUrl.split('/');
            if (parts.length >= 4 && parts[3].startsWith('Giobby')) {
                tenantId = parts[3].replace("GiobbyApi", "Giobby");
                if (tenantId === "Giobby00553") tenantId = "Giobby00554";
            }
        } catch (e) { }
    }

    // Agent Credentials Logic
    const agentSelect = document.getElementById('newClientAgent');
    let agentName = agentSelect ? agentSelect.value : "";

    let userToCopy = "";
    let passToCopy = "";
    let agentFound = false;

    // Look up metadata from globally exposed variable (loaded in app.js)
    if (window.agentsMetadata) {
        const meta = window.agentsMetadata[agentName];
        if (meta && meta.giobbyUsername && meta.giobbyPassword) {
            userToCopy = meta.giobbyUsername;
            passToCopy = meta.giobbyPassword;
            agentFound = true;
        }
    }

    if (agentFound) {
        // Copy Password to Clipboard
        if (window.copyToClipboard) {
            await window.copyToClipboard(passToCopy);
        }

        const msg = `Per creare il contatto come '${agentName}', devi essere loggato con il suo account.\n\n` +
            `Utente: ${userToCopy}\n` +
            `Password: [COPIATA NEGLI APPUNTI]\n\n` +
            `Clicca OK per aprire Giobby.\n(Se richiesto il login, incolla la password)`;

        if (!confirm(msg)) return;
    }

    // Correct URL for New Customer provided by user
    // https://app.giobby.com/Giobby00553/company/Contact.xhtml?ftrID=cust_n
    const url = `https://app.giobby.com/${tenantId}/company/Contact.xhtml?ftrID=cust_n&idFeature=cust_n`;

    // DEBUG: Mostra URL generato
    console.log('[DEBUG] Opening Giobby URL:', url);
    console.log('[DEBUG] TenantID:', tenantId);
    console.log('[DEBUG] API URL:', config.apiUrl);

    window.open(url, '_blank');
};

// Helper: Show Client Selector Modal (Clickable List)
function showGiobbyClientSelectorModal(clients, searchTerm) {
    return new Promise((resolve) => {
        // Create modal container
        const modal = document.createElement('div');
        modal.id = 'giobbyClientSelectModal';
        modal.className = 'modal';
        modal.style.display = 'flex';

        // Build client rows
        let rowsHtml = '';
        clients.forEach((c, idx) => {
            const displayName = [c.lastName, c.name].filter(Boolean).join(" ").trim() || c.name || "N/A";
            const rowClass = idx % 2 === 0 ? 'even' : 'odd';
            rowsHtml += `
                <div class="client-row ${rowClass}" data-index="${idx}" style="
                    padding: 12px 16px;
                    cursor: pointer;
                    border-bottom: 1px solid #e2e8f0;
                    transition: background-color 0.15s;
                ">
                    <div style="font-weight: 600; font-size: 0.95rem; color: #1e293b; margin-bottom: 4px;">
                        ${displayName}
                    </div>
                    <div style="font-size: 0.85rem; color: #64748b;">
                        <span style="margin-right: 16px;"><strong>Cod:</strong> ${c.idCustomer || '-'}</span>
                        <span style="margin-right: 16px;"><strong>Città:</strong> ${c.city || '-'}</span>
                        <span style="margin-right: 16px;"><strong>P.IVA:</strong> ${c.vatCode || '-'}</span>
                        <span><strong>C.F.:</strong> ${c.fiscalCode || '-'}</span>
                    </div>
                </div>
            `;
        });

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 750px; max-height: 85vh; display: flex; flex-direction: column;">
                <div class="modal-header" style="padding: 20px 24px; border-bottom: 2px solid #e2e8f0; flex-shrink: 0;">
                    <h2 style="margin: 0; font-size: 1.3rem; color: #1e293b;">
                        <i class="fa-solid fa-users" style="margin-right: 10px; color: #3b82f6;"></i>
                        Seleziona Cliente da Giobby
                    </h2>
                    <p style="margin: 8px 0 0 0; font-size: 0.9rem; color: #64748b;">
                        Trovati <strong>${clients.length}</strong> risultati per "${searchTerm}"
                    </p>
                    <button class="close-btn" style="
                        position: absolute;
                        top: 20px;
                        right: 24px;
                        background: none;
                        border: none;
                        font-size: 1.8rem;
                        color: #94a3b8;
                        cursor: pointer;
                        line-height: 1;
                        padding: 0;
                        width: 32px;
                        height: 32px;
                    ">&times;</button>
                </div>
                <div class="client-list-container" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 0;
                    background: #ffffff;
                ">
                    ${rowsHtml}
                </div>
                <div style="padding: 16px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0; text-align: center;">
                    <button class="btn-secondary" id="cancelClientSelect" style="min-width: 120px;">
                        <i class="fa-solid fa-times"></i> Annulla
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add hover effects to rows
        const rows = modal.querySelectorAll('.client-row');
        rows.forEach(row => {
            row.addEventListener('mouseenter', () => {
                row.style.backgroundColor = '#f1f5f9';
            });
            row.addEventListener('mouseleave', () => {
                row.style.backgroundColor = '';
            });
            row.addEventListener('click', () => {
                const index = parseInt(row.getAttribute('data-index'));
                modal.remove();
                resolve(clients[index]);
            });
        });

        // Close handlers
        const closeBtn = modal.querySelector('.close-btn');
        const cancelBtn = modal.querySelector('#cancelClientSelect');

        const closeModal = () => {
            modal.remove();
            resolve(null);
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    });
}

// 7. Import Current Client from Giobby
window.importCurrentClientFromGiobby = async function () {
    const inputId = document.getElementById('newClientIdCustomer');
    const inputName = document.getElementById('newClientName');
    const inputSurname = document.getElementById('newClientSurname'); // NEW: Get Surname

    const clientId = inputId ? inputId.value.trim() : "";
    const clientName = inputName ? inputName.value.trim() : "";
    const clientSurname = inputSurname ? inputSurname.value.trim() : ""; // NEW: Get Surname Value

    if (!clientId && !clientName && !clientSurname) { // UPDATED CHECK
        alert("Inserisci almeno il Nome, Cognome o il Codice Cliente per cercare su Giobby.");
        return;
    }

    const jsonConfig = localStorage.getItem('giobbyConfig');
    if (!jsonConfig) {
        alert("Configurazione Giobby mancante.");
        return;
    }
    const config = JSON.parse(jsonConfig);
    const btn = document.getElementById('btnImportGiobby');
    const origText = btn ? btn.innerHTML : '';

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
        let foundClient = null;
        let method = "";

        const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
        const fetchUrl = baseUrl + "contacts";

        // Strategy 1: Search by ID (Client Code) via FreeText if present
        if (clientId) {
            // Note: API doesn't have direct idCustomer filter, we try freeText or scan
            // Let's try freeText first
            let url = fetchUrl + "?freeText=" + encodeURIComponent(clientId);
            if (config.useProxy) url = "https://corsproxy.io/?" + encodeURIComponent(url);

            const res = await fetch(url, { headers: getGiobbyHeaders(config.accessToken) });
            if (res.ok) {
                const data = await res.json();
                const list = data.contacts || [];
                // Look for exact match on idCustomer
                foundClient = list.find(c => c.idCustomer === clientId);
                if (foundClient) method = "Codice Cliente";
            }
        }

        // Strategy 2: Search by Name/Surname if not found yet
        // Combine Name + Surname for search
        const searchName = [clientName, clientSurname].filter(Boolean).join(" ");

        if (!foundClient && searchName) {
            let url = fetchUrl + "?freeText=" + encodeURIComponent(searchName);
            if (config.useProxy) url = "https://corsproxy.io/?" + encodeURIComponent(url);

            const res = await fetch(url, { headers: getGiobbyHeaders(config.accessToken) });
            if (res.ok) {
                const data = await res.json();
                const list = data.contacts || [];
                if (list.length > 0) {
                    // Match Logic:
                    // If 1 result -> Auto-select
                    // If >1 result -> Prompt User

                    if (list.length === 1) {
                        foundClient = list[0];
                        method = "Nome (Unico)";
                    } else {
                        // Multiple results - Show clickable modal
                        foundClient = await showGiobbyClientSelectorModal(list, searchName);
                        if (foundClient) {
                            method = "Selezione Modale";
                        } else {
                            // User cancelled
                            return;
                        }
                    }
                }
            }
        }

        if (!foundClient) {
            alert("Nessun cliente trovato su Giobby con questi dati.");
            return;
        }

        // Confirm
        const displayName = [foundClient.lastName, foundClient.name].filter(Boolean).join(" ").trim() || foundClient.name || "N/A";
        const confirmMsg = `Trovato: ${displayName}\nCodice: ${foundClient.idCustomer || 'N/A'}\nP.IVA: ${foundClient.vatCode || 'N/A'}\n\nVuoi importare i dati in Genesy?`;
        if (!confirm(confirmMsg)) return;

        // Populate Form
        // FIX: Giobby restituisce firstName e lastName separati
        // Genesy vuole un campo unico nel formato "COGNOME NOME"

        // DEBUG: Vediamo cosa contiene foundClient
        console.log('[IMPORT DEBUG] Full foundClient object:', foundClient);

        // Estrai NOME da tutti i possibili campi
        // IMPORTANTE: Giobby usa "name" per il NOME (non per il nome completo!)
        const firstName = foundClient.name || foundClient.firstName || foundClient.first_name ||
            foundClient.givenName || foundClient.given_name ||
            foundClient.name1 || "";

        // Estrai COGNOME da tutti i possibili campi
        const lastName = foundClient.lastName || foundClient.last_name ||
            foundClient.surname || foundClient.familyName ||
            foundClient.family_name || foundClient.name2 || "";

        console.log('[IMPORT DEBUG] Extracted firstName:', firstName);
        console.log('[IMPORT DEBUG] Extracted lastName:', lastName);

        // NEW: Populate separate fields instead of combining
        if (inputName) inputName.value = firstName;
        if (inputSurname) inputSurname.value = lastName;

        // --- ENRICHMENT STEP: Fetch Full Customer Details if idCustomer is present ---
        if (foundClient.idCustomer) {
            try {
                const btn = document.getElementById('btnImportGiobby');
                if (btn) btn.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> Dettagli...';

                let custEndpoint = "customers";
                if (typeof getEffectiveEndpoint === 'function') {
                    custEndpoint = await getEffectiveEndpoint(config, 'customers');
                }

                let custUrl = baseUrl + custEndpoint + "?freeText=" + encodeURIComponent(foundClient.idCustomer);
                if (config.useProxy) custUrl = "https://corsproxy.io/?" + encodeURIComponent(custUrl);

                const resCust = await fetch(custUrl, { headers: getGiobbyHeaders(config.accessToken) });
                if (resCust.ok) {
                    const dataCust = await resCust.json();
                    const listCust = dataCust.customers || dataCust.contacts || (Array.isArray(dataCust) ? dataCust : []);

                    // Find exact match
                    const detailedCust = listCust.find(c => c.idCustomer === foundClient.idCustomer);
                    if (detailedCust) {
                        // Merge strategies: Prefer Detailed Customer data for fiscal fields,
                        // but preserve contact address/region if customer fields are empty/null.
                        const merged = { ...foundClient };

                        if (detailedCust.idCustomer) merged.idCustomer = detailedCust.idCustomer;
                        if (detailedCust.vatCode) merged.vatCode = detailedCust.vatCode;
                        if (detailedCust.taxCode) merged.fiscalCode = detailedCust.taxCode;
                        if (detailedCust.emailPec) merged.emailPec = detailedCust.emailPec;
                        if (detailedCust.phone) merged.phone = detailedCust.phone;

                        // Address fields: only overwrite if detailedCust has them populated
                        if (detailedCust.address) merged.address = detailedCust.address;
                        if (detailedCust.city) merged.city = detailedCust.city;
                        if (detailedCust.postalCode) merged.postalCode = detailedCust.postalCode;
                        if (detailedCust.pr) merged.pr = detailedCust.pr;
                        if (detailedCust.province) merged.province = detailedCust.province;
                        if (detailedCust.region) merged.region = detailedCust.region;
                        if (detailedCust.stateOrRegion) merged.stateOrRegion = detailedCust.stateOrRegion;
                        if (detailedCust.state) merged.state = detailedCust.state;
                        if (detailedCust.country) merged.country = detailedCust.country;

                        foundClient = merged;
                    }
                }
            } catch (err) {
                console.warn("Enrichment Warning:", err);
            }
        }
        // -----------------------------------------------------------------------------

        // Smarter Province Mapping: Try 'pr' (Giobby API field) first, then 'province', then 'state'
        // FIX: Giobby returns province abbreviation in 'pr' (e.g. "TN"), NOT in 'province'
        let provinceVal = (foundClient.pr || foundClient.province || foundClient.state || "").trim().toUpperCase();

        // FIX: If province is invalid (too long), try to ignore it OR infer from City
        if (provinceVal.length > 2 || !provinceVal) {
            // Try to infer from City using CityManager
            if (window.CityManager && foundClient.city) {
                const cityMatch = window.CityManager.getDetails(foundClient.city);
                if (cityMatch && cityMatch.sigla) {
                    provinceVal = cityMatch.sigla;
                } else {
                    // It's likely a region name found in the province field and we couldn't infer from city
                    if (!foundClient.region) foundClient.region = provinceVal;
                    provinceVal = ""; // Clear province so we don't put garbage
                }
            } else {
                // Fallback without CityManager
                if (provinceVal.length > 2) {
                    if (!foundClient.region) foundClient.region = provinceVal;
                    provinceVal = "";
                }
            }
        }

        // DEBUG DIAGNOSTICS FOR USER (Remove after fix)
        // Removed after collecting data: idUserOwner seems to be agent, email2 might be PEC or secondary email.

        // Normalize Country from Giobby's "Nessuno"
        let rawCountry = (foundClient.country || foundClient.nation || '').trim();
        let targetCountry = 'Italia';
        if (rawCountry.toLowerCase() === 'estero') targetCountry = 'Estero';
        // If it's something else but not "Nessuno"
        else if (rawCountry && rawCountry.toLowerCase() !== 'nessuno' && rawCountry.toLowerCase() !== 'nessuna' && rawCountry.toLowerCase() !== 'italia') {
            targetCountry = rawCountry; // Best effort, but UI select only supports "Italia" / "Estero"
            // Let's force it to Italia if it's not Estero and not explicitly empty, maybe better to default to Italia?
            // Actually, if it's something unknown, the select will clear. We'll default unknown to Italia unless it's obviously foreign.
            if (rawCountry.length > 0) targetCountry = 'Italia'; // Force default for safety
        }

        const map = {
            'newClientAddress': foundClient.address,
            'newClientCity': foundClient.city,
            'newClientZip': foundClient.postalCode,
            'newClientState': foundClient.region || foundClient.stateOrRegion || foundClient.state, // Region (MUST BE BEFORE PROVINCE so province auto-infer doesn't overwrite / is only fallback)
            'newClientAddressProvince': provinceVal, // Use the processed provinceVal
            'newClientCountry': targetCountry,
            'newClientEmail': foundClient.email,
            'newClientPec': foundClient.emailPec || foundClient.certifiedEmail || foundClient.pec || foundClient.email2, // Added email2 fallback
            'newClientSdi': foundClient.sdiCode || foundClient.electronicInvoicingCode || foundClient.recipientCode, // SDI
            'newClientPhoneOffice': foundClient.phone || foundClient.phoneNumber || foundClient.officePhone || foundClient.phone1, // Added fallbacks
            'newClientMobile': foundClient.mobile || foundClient.cellPhone,
            'newClientFax': foundClient.fax,
            'newClientVat': foundClient.vatCode || foundClient.vatNumber || foundClient.vat, // Added fallbacks
            'newClientFiscalCode': foundClient.fiscalCode || foundClient.taxCode || foundClient.codiceFiscale, // Added fallbacks
            'newClientLang': foundClient.language, // Language
            'newClientSector': foundClient.sector || foundClient.industry, // Sector
            'newClientOrigin': foundClient.origin || foundClient.source, // Source/Origin
            'newClientIdCustomer': foundClient.idCustomer,
            'newClientGiobbyContactId': foundClient.id, // Store internal ID
            'newClientAgentGiobbyId': foundClient.idSalesman || foundClient.salesmanId || foundClient.idUserOwner // Added idUserOwner fallback
        };

        for (const [id, val] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (el) {
                el.value = val || "";
                // If province field and we have inference, trigger it
                if (id === 'newClientAddressProvince' && val) {
                    el.dispatchEvent(new Event('change')); // Trigger auto-region
                }
                // If agent field is set but no ID provided, trigger change to infer ID
                if (id === 'newClientAgent' && val && !map['newClientAgentGiobbyId']) {
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }

        // Feedback
        alert("Dati importati con successo!");

    } catch (e) {
        console.error("Import Error:", e);
        alert("Errore importazione: " + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }
};

