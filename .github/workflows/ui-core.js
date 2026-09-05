/**
 * Genesy - UI Core & Interactions
 * Handles Modals, Sidebar, Navigation and Generic UI interactions.
 */

// --- Modal Helpers ---
window.openModal = function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
};

window.closeModal = function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
};

// Global Overlay Click Listener to Close Modals
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal')) {
        // Prevent closing if it's a "static" modal (optional logic, but for now allow all to close)
        // Check if allow-close is disabled? No, usually safe to close.
        e.target.classList.add('hidden');
    }
});

// --- NAVIGAZIONE & SIDEBAR ---
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('hidden');
}

function setupNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            try {
                const targetId = btn.getAttribute('data-target');

                if (!targetId) return; // Ignore buttons with custom handlers (Settings, Logout)

                // Resetta Modalità Selezione su navigazione manuale
                if (targetId === 'products') isPickingMode = false;

                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                views.forEach(v => {
                    v.style.display = ''; // Clear inline override from openSettings
                    if (v.id === targetId) {
                        v.classList.add('active');
                        v.classList.remove('hidden');
                    } else {
                        v.classList.remove('active');
                        v.classList.add('hidden'); // Rimossa l'attesa di 300ms per fluidità
                    }
                });

                // Se mobile, chiudi sidebar
                if (window.innerWidth <= 1024) {
                    toggleSidebar();
                }

                if (targetId === 'dashboard') updateDashboard();
                if (targetId === 'quotes') renderQuotesTable();
                if (targetId === 'clients') renderGenericClientsTable();
                if (targetId === 'products') {
                    populateFilterOptions();
                    renderProductsTable();
                }
                if (targetId === 'trash') {
                    if (typeof renderTrashView === 'function') renderTrashView();
                    if (typeof updateTrashBadge === 'function') updateTrashBadge();
                }
                if (targetId === 'adv_reports') {
                    if (typeof initAdvFilters === 'function') initAdvFilters();
                    if (typeof renderAdvancedReports === 'function') renderAdvancedReports();
                }
                if (targetId === 'report_explorer') {
                    if (typeof initReport2 === 'function') initReport2();
                }
                if (targetId === 'map_report') {
                    if (typeof initMapReport === 'function') initMapReport();
                }
                if (targetId === 'prospect') {
                    if (typeof initProspectFilters === 'function') initProspectFilters();
                    if (typeof renderProspect === 'function') renderProspect();
                }
                if (targetId === 'stats') {
                    switchStatsMode('data'); // Default to data
                    renderStats();
                }
            } catch (error) {
                console.error("Navigation Error:", error);
                alert("Errore durante la navigazione: " + error.message);
            }
        });
    });
}

// --- DEDICATED AGENT CONFIGURATION LOGIC (Inline) ---
window.toggleAgentConfigInline = function () {
    const container = document.getElementById('agentConfigInlineContainer');
    const chevron = document.getElementById('agentConfigChevron');

    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        chevron.classList.remove('fa-chevron-down');
        chevron.classList.add('fa-chevron-up');
        renderAgentConfigInline();
    } else {
        container.classList.add('hidden');
        chevron.classList.remove('fa-chevron-up');
        chevron.classList.add('fa-chevron-down');
    }
};

// --- SYNC AGENTS LOGIC ---
// --- SYNC AGENTS LOGIC ---
window.syncGiobbyAgents = async function () {
    const jsonConfig = localStorage.getItem('giobbyConfig');
    if (!jsonConfig) return alert("Configurazione Giobby mancante!");
    const config = JSON.parse(jsonConfig);

    if (!confirm("Scarico gli utenti da Giobby e li associo agli Agenti per nome?")) return;

    const listBtn = document.getElementById('btnSyncAgents');
    if (listBtn) listBtn.textContent = "⏳...";

    try {
        const users = await window.fetchGiobbyUsers(config);

        const vars = db.getProductVars();
        const agents = vars.agents || [];
        if (!vars.agentsMetadata) vars.agentsMetadata = {};

        let matchCount = 0;

        agents.forEach(agentName => {
            // Fuzzy/Smart Match
            // Agent Name: "Rossi Mario" or "Mario Rossi"

            // Normalize Agent Name
            const agentParts = agentName.toLowerCase().split(/\s+/);
            const agentFull = agentName.toLowerCase();

            const match = users.find(u => {
                // Support both new normalized format (name) and old format (firstname/lastname)
                const uFirst = (u.firstName || u.firstname || "").toLowerCase();
                const uLast = (u.lastName || u.lastname || "").toLowerCase();
                const uName = (u.name || "").toLowerCase();
                const uUsername = (u.username || "").toLowerCase();

                // 1. Direct Name Match
                if (uName && uName.includes(agentFull)) return true;
                if (uName && (uName.includes(agentParts[0]) && uName.includes(agentParts[1] || agentParts[0]))) return true;

                // 2. Direct Username Match
                if (uUsername.includes(agentFull)) return true;

                // 3. First/Last Split Match (if available)
                if (uFirst && uLast) {
                    const userFull = uFirst + " " + uLast;
                    const userFullRev = uLast + " " + uFirst;

                    if (agentParts.length >= 2) {
                        return (userFull.includes(agentParts[0]) && userFull.includes(agentParts[1])) ||
                            (userFullRev.includes(agentParts[0]) && userFullRev.includes(agentParts[1]));
                    }
                    return uFirst === agentParts[0] || uLast === agentParts[0];
                }

                return false;
            });

            if (match) {
                // Update Metadata
                const validId = match.id || match.idUser; // Normalized use 'id'
                if (!vars.agentsMetadata[agentName]) vars.agentsMetadata[agentName] = {};

                // Only update if missing or if force? Let's overwrite to ensure sync
                vars.agentsMetadata[agentName].giobbyAgentId = validId;
                matchCount++;
            }
        });

        await db.updateVarList('agentsMetadata', vars.agentsMetadata);
        renderAgentConfigInline();
        alert(`Sincronizzazione completata! Associati ${matchCount} agenti.`);

    } catch (e) {
        alert("Errore Sync: " + e.message);
    } finally {
        if (listBtn) listBtn.textContent = "🔄 Sync Giobby";
    }
};

window.toggleLayoutTools = function () {
    const container = document.getElementById('layoutToolsContainer');
    const chevron = document.getElementById('chevronLayout');

    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        if (chevron) {
            chevron.classList.remove('fa-chevron-down');
            chevron.classList.add('fa-chevron-up');
        }
    } else {
        container.classList.add('hidden');
        if (chevron) {
            chevron.classList.remove('fa-chevron-up');
            chevron.classList.add('fa-chevron-down');
        }
    }
};

window.renderAgentConfigInline = function () {
    const listContainer = document.getElementById('inlineAgentList');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const vars = db.getProductVars();
    const agents = vars.agents || [];
    const meta = vars.agentsMetadata || {};

    const currentUserEmail = currentUser?.email || '';

    agents.sort().forEach(agent => {
        const info = meta[agent] || { phone: '', email: '' };
        // Escape quotes for onclick handler
        const safeAgent = agent.replace(/'/g, "\\'");

        const row = document.createElement('div');
        row.style.cssText = "display: flex; flex-direction: column; gap: 5px; border-bottom: 1px solid #eee; padding: 10px 0; min-width: 600px;";

        row.innerHTML = `
            <div style="display: flex; gap: 5px; align-items: center;">
                <input type="text" class="form-control" style="flex: 1.5; min-width: 130px; font-weight: bold; font-size: 0.9rem;" 
                       value="${agent}" onchange="renameAgentInline('${safeAgent}', this.value)" placeholder="Nome Agente">
                <input type="text" placeholder="Tel" class="form-control" style="width: 100px; font-size:0.85rem;" 
                       value="${info.phone || ''}" onchange="updateAgentMeta('${safeAgent}', 'phone', this.value)">
                <input type="text" placeholder="Email" class="form-control" style="flex: 1.5; min-width: 150px; font-size:0.85rem;" 
                       value="${info.email || ''}" onchange="updateAgentMeta('${safeAgent}', 'email', this.value)">
                <input type="text" placeholder="ID" class="form-control" style="width: 60px; font-size:0.85rem; padding: 5px;" 
                       value="${info.giobbyAgentId || ''}" onchange="updateAgentMeta('${safeAgent}', 'giobbyAgentId', this.value)" title="ID Utente Giobby">
                <input type="text" placeholder="U1" class="form-control" style="width: 40px; font-size:0.85rem; padding: 5px;" 
                       value="${info.giobbyBu || 'U1'}" onchange="updateAgentMeta('${safeAgent}', 'giobbyBu', this.value)" title="Business Unit (Default: U1)">
                <button class="btn-icon delete" onclick="removeAgentDirect('${safeAgent}')" style="width:30px; padding:0; display:flex; align-items:center; justify-content:center; height: 30px;"><i class="fa-solid fa-trash" style="font-size:0.8rem;"></i></button>
            </div>
            <div style="display: flex; gap: 5px; align-items: center; background: #f9f9f9; padding: 5px; border-radius: 4px;">
                <i class="fa-solid fa-key" style="color: #bbb; font-size: 0.8rem; margin: 0 5px;"></i>
                <input type="text" placeholder="Giobby Username" class="form-control" style="flex: 1; font-size:0.8rem;" 
                       value="${info.giobbyUsername || ''}" onchange="updateAgentMeta('${safeAgent}', 'giobbyUsername', this.value)">
                <input type="password" placeholder="Giobby Password" class="form-control" style="flex: 1; font-size:0.8rem;" 
                       value="${info.giobbyPassword || ''}" onchange="updateAgentMeta('${safeAgent}', 'giobbyPassword', this.value)">
                <label style="font-size: 0.75rem; color: #888;">(Per export proprietario su Giobby)</label>
            </div>
        `;
        listContainer.appendChild(row);
    });
};

window.addAgentInline = function () {
    const name = document.getElementById('inlineNewName').value.trim();
    const phone = document.getElementById('inlineNewPhone').value.trim();
    const email = document.getElementById('inlineNewEmail').value.trim();
    const giobbyAgentId = document.getElementById('inlineNewGiobbyId').value.trim();

    if (!name) return alert("Inserisci almeno il nome");

    const vars = db.getProductVars();
    if (!vars.agents) vars.agents = [];

    if (vars.agents.includes(name)) return alert("Agente già esistente");

    vars.agents.push(name);
    db.updateVarList('agents', vars.agents);

    if (phone || email || giobbyAgentId) {
        if (!vars.agentsMetadata) vars.agentsMetadata = {};
        vars.agentsMetadata[name] = { phone, email, giobbyAgentId };
        db.updateVarList('agentsMetadata', vars.agentsMetadata);
    }

    renderAgentConfigInline();

    document.getElementById('inlineNewName').value = '';
    document.getElementById('inlineNewPhone').value = '';
    document.getElementById('inlineNewEmail').value = '';
    document.getElementById('inlineNewGiobbyId').value = '';
};

window.removeAgentDirect = async function (agent) {
    if (!confirm("Eliminare agente " + agent + "?")) return;
    const vars = db.getProductVars();

    // Remove from List
    vars.agents = vars.agents.filter(a => a !== agent);
    await db.updateVarList('agents', vars.agents);

    // Remove Metadata (Cleanup)
    if (vars.agentsMetadata && vars.agentsMetadata[agent]) {
        delete vars.agentsMetadata[agent];
        await db.updateVarList('agentsMetadata', vars.agentsMetadata);
    }

    renderAgentConfigInline();
};

window.renameAgentInline = function (oldName, newName) {
    const trimmedNewName = newName.trim();

    if (!trimmedNewName) {
        alert("Il nome dell'agente non può essere vuoto");
        renderAgentConfigInline();
        return;
    }

    if (trimmedNewName === oldName) return;

    const vars = db.getProductVars();
    const agents = vars.agents || [];

    if (agents.includes(trimmedNewName)) {
        alert(`Esiste già un agente con il nome "${trimmedNewName}"`);
        renderAgentConfigInline();
        return;
    }

    const index = agents.indexOf(oldName);
    if (index !== -1) {
        agents[index] = trimmedNewName;
        db.updateVarList('agents', agents);
    }

    if (vars.agentsMetadata && vars.agentsMetadata[oldName]) {
        vars.agentsMetadata[trimmedNewName] = vars.agentsMetadata[oldName];
        delete vars.agentsMetadata[oldName];
        db.updateVarList('agentsMetadata', vars.agentsMetadata);
    }

    if (vars.agentZones && vars.agentZones[oldName]) {
        vars.agentZones[trimmedNewName] = vars.agentZones[oldName];
        delete vars.agentZones[oldName];
        db.updateVarList('agentZones', vars.agentZones);
    }

    if (vars.zoneAgentMap) {
        Object.keys(vars.zoneAgentMap).forEach(zone => {
            if (vars.zoneAgentMap[zone] === oldName) {
                vars.zoneAgentMap[zone] = trimmedNewName;
            }
        });
        db.updateVarList('zoneAgentMap', vars.zoneAgentMap);
    }

    // Update in Quotes
    const quotes = db.getQuotes();
    const quotesToUpdate = quotes.filter(quote => quote.agent === oldName);

    if (quotesToUpdate.length > 0) {
        quotesToUpdate.forEach(async (quote) => {
            quote.agent = trimmedNewName;
            try {
                await db.saveQuote(quote);
            } catch (error) {
                console.error(`Errore aggiornamento preventivo ${quote.id}:`, error);
            }
        });
    }

    renderAgentConfigInline();
    populateSharedLists();
};

window.updateAgentMeta = function (agentName, key, value) {
    if (!agentName) return;
    const vars = db.getProductVars();
    if (!vars.agentsMetadata) vars.agentsMetadata = {};
    if (!vars.agentsMetadata[agentName]) vars.agentsMetadata[agentName] = {};

    // Auto-trim values
    const cleanValue = value ? value.trim() : '';

    vars.agentsMetadata[agentName][key] = cleanValue;

    db.updateVarList('agentsMetadata', vars.agentsMetadata);
};

// --- AGENT CONTACT CONFIGURATION ---
const AGENT_CONTACTS = {
    'Luca': { phone: '333 1234567', email: 'luca@parquetromagna.it' },
    'Filippo': { phone: '333 7654321', email: 'filippo@parquetromagna.it' },
    'Giacomo': { phone: '', email: '' },
    'Beatrice': { phone: '', email: '' },
    'Francesco': { phone: '', email: '' },
    'Daniel': { phone: '', email: 'daniel@parquetromagna.it' },
    'Admin': { phone: '', email: 'info@parquetromagna.it' },
    // Data from User Image
    'Fagioli Daniel': { phone: '3463079406', email: 'd.fagioli@parquetromagna.it' },
    'Lolla Beatrice': { phone: '3517401660', email: 'commerciale@parquetromagna.it' },
    'Mondello Filippo': { phone: '3313634839', email: 'f.mondello@parquetbologna.net' },
    'Monti Giacomo': { phone: '3296472805', email: 'g.monti@parquetromagna.it' },
    'Russo Edoardo': { phone: '3520263108', email: 'e.russo@parquetromagna.it' },
    'Russo Francesco': { phone: '3396787579', email: 'f.russo@parquetromagna.it' }
};

window.updatePrintAgent = function (agentName) {
    const elName = document.getElementById('printAgentName');
    const elPhone = document.getElementById('printAgentPhone');
    const elEmail = document.getElementById('printAgentEmail');

    if (!elName) return;

    if (!agentName) {
        elName.textContent = '-';
        if (elPhone) elPhone.textContent = '-';
        if (elEmail) elEmail.textContent = '-';
        return;
    }

    const vars = db.getProductVars();
    const meta = (vars.agentsMetadata && vars.agentsMetadata[agentName])
        || AGENT_CONTACTS[agentName]
        || {};

    elName.textContent = agentName;

    if (elPhone) {
        const val = meta.phone || '-';
        elPhone.textContent = val;
    }

    if (elEmail) {
        const val = meta.email || '-';
        elEmail.textContent = val;
    }
};

window.saveAgentManualInput = function () {
    const data = {
        name: document.getElementById('printAgentName')?.innerText || '',
        phone: document.getElementById('printAgentPhone')?.innerText || '',
        email: document.getElementById('printAgentEmail')?.innerText || ''
    };
    localStorage.setItem('agentManualOverride_v1', JSON.stringify(data));
}

window.restoreAgentManualInput = function () {
    const stored = localStorage.getItem('agentManualOverride_v1');
    if (stored) {
        try {
            const data = JSON.parse(stored);
            const elName = document.getElementById('printAgentName');
            const elPhone = document.getElementById('printAgentPhone');
            const elEmail = document.getElementById('printAgentEmail');

            if (elName && data.name) elName.innerText = data.name;
            if (elPhone && data.phone) elPhone.innerText = data.phone;
            if (elEmail && data.email) elEmail.innerText = data.email;
        } catch (e) { console.error("Restore Error", e); }
    }
}

// --- ZONE SELECTION LOGIC ---
let pendingZoneAgent = null;

function setupAgentZoneLogic() {
    const docAgent = document.getElementById('docAgent');
    const docZone = document.getElementById('docZone');

    docZone.onchange = function () {
        // Disabilitato cambio agente automatico
    };

    docAgent.onchange = function () {
        const agent = this.value;
        localStorage.removeItem('agentManualOverride_v1');

        updatePrintAgent(agent);
        updateZoneOptions(agent);

        if (agent) {
            const defaultZones = db.getAgentZones(agent);
            if (defaultZones.length > 1) {
                openZoneSelectionModal(agent, defaultZones);
                docZone.value = '';
            } else if (defaultZones.length === 1) {
                docZone.value = defaultZones[0];
            } else {
                const map = db.getZoneAgentMap();
                const foundZone = Object.keys(map).find(z => map[z] === agent);
                if (foundZone) docZone.value = foundZone;
                else docZone.value = '';
            }
        } else {
            updateZoneOptions(null);
        }
    };
}

function openZoneSelectionModal(agent, zones) {
    pendingZoneAgent = agent;
    const modal = document.getElementById('zoneSelectionModal');
    const container = document.getElementById('zoneSelectionList');
    container.innerHTML = '';

    zones.forEach(z => {
        const div = document.createElement('div');
        div.style.marginBottom = '5px';
        div.innerHTML = `
            <label style="display:flex; align-items:center; cursor:pointer;">
                <input type="checkbox" name="selZone" value="${z}" style="margin-right:10px;">
                ${z}
            </label>
        `;
        container.appendChild(div);
    });

    // Inject Custom Input
    const divInput = document.createElement('div');
    divInput.style.marginTop = '10px';
    divInput.style.borderTop = '1px solid #eee';
    divInput.style.paddingTop = '10px';
    divInput.innerHTML = `
        <input type="text" id="customZoneInput" class="form-control" placeholder="Specifica altra zona o area..." style="width: 100%; box-sizing: border-box; padding: 5px;">
    `;
    container.appendChild(divInput);

    modal.classList.remove('hidden');
}

window.confirmZoneSelection = function () {
    const checkboxes = document.querySelectorAll('input[name="selZone"]:checked');
    const selected = Array.from(checkboxes).map(c => c.value);

    // Add Custom
    const customInput = document.getElementById('customZoneInput');
    if (customInput && customInput.value.trim()) {
        selected.push(customInput.value.trim());
    }

    if (selected.length > 0) {
        const val = selected.join(', ');
        updateZoneOptions(pendingZoneAgent, val);
    }
    closeModal('zoneSelectionModal');
}

window.quickAddAgent = function () {
    const name = prompt("Inserisci il nome del nuovo Agente:");
    if (name && name.trim()) {
        const cleanName = name.trim();
        const agents = db.getAgents();
        if (!agents.includes(cleanName)) {
            // New: Ask for Zone
            const zones = db.getZones();
            let zoneMsg = "Inserisci la Zona Predefinita per " + cleanName;
            if (zones.length > 0) zoneMsg += "\n(Esistenti: " + zones.join(', ') + ")";

            const zone = prompt(zoneMsg);

            // 1. Add Agent
            agents.push(cleanName);
            db.updateVarList('agents', agents);

            // 2. Add/Map Zone
            if (zone && zone.trim()) {
                const cleanZone = zone.trim();
                // Add to zones list if new
                if (!zones.includes(cleanZone)) {
                    zones.push(cleanZone);
                    db.updateVarList('zones', zones);
                }
                // Map it
                db.setZoneAgent(cleanZone, cleanName); // Legacy support
                db.setAgentZones(cleanName, [cleanZone]); // New array logic
            }

            populateSharedLists();

            // Auto-select
            document.getElementById('docAgent').value = cleanName;
            if (zone && zone.trim()) {
                document.getElementById('docZone').value = zone.trim();
            }
        } else {
            // Agent exists - Offer to ADD Zone
            if (confirm(`L'agente "${cleanName}" esiste già. Vuoi aggiungere questa zona alla sua lista?`)) {
                const zones = db.getZones();
                let zonePrompt = "Inserisci la zona da aggiungere:";
                if (zones.length > 0) zonePrompt += "\n(Esistenti: " + zones.join(', ') + ")";
                const zone = prompt(zonePrompt);

                if (zone && zone.trim()) {
                    const cleanZone = zone.trim();
                    if (!zones.includes(cleanZone)) {
                        zones.push(cleanZone);
                        db.updateVarList('zones', zones);
                    }

                    // Add to existing list
                    const currentZones = db.getAgentZones(cleanName);
                    if (!currentZones.includes(cleanZone)) {
                        currentZones.push(cleanZone);
                        db.setAgentZones(cleanName, currentZones);
                        db.setZoneAgent(cleanZone, cleanName); // Legacy first mapping
                    }

                    populateSharedLists();

                    // Select
                    document.getElementById('docAgent').value = cleanName;
                    document.getElementById('docZone').value = cleanZone; // Select the new one being added
                }
            }
        }
    }
}

// --- SHARED LISTS POPULATION ---

window.populateSharedLists = function () {
    // Check if elements exist (might not be in editor view)
    const docAgent = document.getElementById('docAgent');
    const docZone = document.getElementById('docZone');
    if (!docAgent || !docZone) return;

    const agents = db.getAgents();
    const zones = db.getZones();

    // Preserve existing selection if possible
    const currentAgent = docAgent.value;
    const currentZone = docZone.value;

    docAgent.innerHTML = '<option value="">- Seleziona -</option>' + agents.map(a => `<option value="${a}">${a}</option>`).join('');

    // Inizializza zone 
    if (currentAgent && agents.includes(currentAgent)) docAgent.value = currentAgent;
    updateZoneOptions(docAgent.value, currentZone);

    // Populate Status Dropdown in Editor
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

    // Attach Listeners
    if (typeof setupAgentZoneLogic === 'function') setupAgentZoneLogic();

    // Manual Input
    if (typeof restoreAgentManualInput === 'function') restoreAgentManualInput();
}

window.updateZoneOptions = function (agent, selectedValue = null) {
    const docZone = document.getElementById('docZone');
    const zoneList = document.getElementById('zoneList');
    if (!docZone) return;

    const allZones = db.getZones();
    let optsHTML = '';

    if (allZones && allZones.length > 0) {
        // I datalist su alcuni browser non supportano optgroup, quindi usiamo solo option
        optsHTML += allZones.map(z => `<option value="${z}">${z} (Zona Manageriale)</option>`).join('');
    }

    // Aggiungi l'elenco dei comuni in fondo alla tendina
    if (typeof CityManager !== 'undefined' && CityManager.cities && CityManager.cities.length > 0) {
        optsHTML += CityManager.cities.map(c => `<option value="${c.nome}">${c.nome} (${c.sigla})</option>`).join('');
    }

    if (zoneList) {
        zoneList.innerHTML = optsHTML;

        // Se c'è un valore selezionato che non è né nelle zone né nei comuni (raro, ma per fail-safe)
        if (selectedValue && !allZones.includes(selectedValue) && 
            !(typeof CityManager !== 'undefined' && CityManager.cities && CityManager.cities.some(c => c.nome === selectedValue))) {
            const opt = document.createElement('option');
            opt.value = selectedValue;
            zoneList.appendChild(opt);
        }
    }

    if (selectedValue) {
        docZone.value = selectedValue;
    }
}

// --- GENERIC TOGGLE SECTION ---
window.toggleSection = function (sectionId, iconId) {
    const section = document.getElementById(sectionId);
    const icon = document.getElementById(iconId);

    if (section) {
        if (section.classList.contains('hidden')) {
            section.classList.remove('hidden');
            if (icon) {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-down');
            }
        } else {
            section.classList.add('hidden');
            if (icon) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-right');
            }
        }
    }
};

