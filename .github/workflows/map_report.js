let leafletMap = null;
let baseTileLayer = null;
let popDensityLayer = null;
let mapMarkers = [];
let allJobs2026 = [];
let geocodingCache = {};
let isSyncing = false;
let bgGeocodingActive = false;
let currentZoneAnalysisJobs = [];
let currentModalJobs = [];

// Risolve l'idSalesman di Giobby in nome Agente leggibile usando agentsMetadata del database
function getAgentNameById(agentId) {
    if (!agentId) return "Nessun Agente";
    const searchId = String(agentId);
    
    // Se non è un numero, assume sia già il nome completo dell'agente
    if (isNaN(Number(searchId))) {
        return searchId;
    }
    
    // Accede a db.data.vars.agentsMetadata se disponibile
    if (window.db && window.db.data && window.db.data.vars && window.db.data.vars.agentsMetadata) {
        const meta = window.db.data.vars.agentsMetadata;
        for (const [name, info] of Object.entries(meta)) {
            if (info.giobbyAgentId && String(info.giobbyAgentId) === searchId) {
                return name;
            }
        }
    }
    
    // Fallback se non trovato
    return `Agente ID: ${agentId}`;
}

// Gestione del multiselect degli agenti
window.toggleAgentMultiselect = function(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('agentMultiselectDropdown');
    if (!dropdown) return;
    const isHidden = dropdown.classList.contains('hidden');
    if (isHidden) {
        dropdown.classList.remove('hidden');
        dropdown.style.display = 'block';
    } else {
        dropdown.classList.add('hidden');
        dropdown.style.display = 'none';
    }
};

window.toggleSelectAllAgents = function(masterCb) {
    const checkboxes = document.querySelectorAll('.agent-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = masterCb.checked;
    });
    window.updateAgentMultiselectLabel();
    filterMapJobs();
};

window.onAgentCheckboxChange = function() {
    const checkboxes = document.querySelectorAll('.agent-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const selectAllCb = document.getElementById('selectAllAgents');
    
    if (selectAllCb) {
        selectAllCb.checked = (checkedCount === checkboxes.length);
        selectAllCb.indeterminate = (checkedCount > 0 && checkedCount < checkboxes.length);
    }
    
    window.updateAgentMultiselectLabel();
    filterMapJobs();
};

window.updateAgentMultiselectLabel = function() {
    const checkboxes = document.querySelectorAll('.agent-checkbox');
    const checkedCheckboxes = Array.from(checkboxes).filter(cb => cb.checked);
    const labelEl = document.getElementById('agentMultiselectLabel');
    if (!labelEl) return;
    
    if (checkedCheckboxes.length === checkboxes.length && checkboxes.length > 0) {
        labelEl.textContent = "Tutti gli agenti";
    } else if (checkedCheckboxes.length === 0) {
        labelEl.textContent = "Nessun agente";
    } else if (checkedCheckboxes.length <= 2) {
        const names = checkedCheckboxes.map(cb => {
            const fullText = cb.parentElement.textContent.trim();
            return fullText.split(' (')[0];
        });
        labelEl.textContent = names.join(', ');
    } else {
        labelEl.textContent = `${checkedCheckboxes.length} agenti selezionati`;
    }
};

document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('agentMultiselectDropdown');
    const button = document.getElementById('agentMultiselectButton');
    if (dropdown && button && !dropdown.classList.contains('hidden')) {
        if (!dropdown.contains(event.target) && !button.contains(event.target)) {
            dropdown.classList.add('hidden');
            dropdown.style.display = 'none';
        }
    }
});

// Popola dinamicamente il menu multiselect degli agenti
function populateAgentFilter(jobs) {
    const dropdown = document.getElementById('agentMultiselectDropdown');
    if (!dropdown) return;

    // Salva la selezione corrente per ripristinarla
    const previouslyChecked = Array.from(dropdown.querySelectorAll('.agent-checkbox:checked')).map(cb => cb.value);
    const hadSelection = dropdown.querySelectorAll('.agent-checkbox').length > 0;
    
    // Trova tutti gli ID agenti unici presenti nel dataset (diversi da null/undefined)
    const agentIds = [...new Set(jobs.map(j => j.agentId).filter(id => id !== null && id !== undefined))];
    
    const agentsList = agentIds.map(id => {
        return {
            id: id,
            name: getAgentNameById(id)
        };
    }).filter(agent => agent.name.toLowerCase().trim() !== 'boss');
    
    // Ordina alfabeticamente per nome
    agentsList.sort((a, b) => a.name.localeCompare(b.name));

    const hasNullAgent = jobs.some(j => j.agentId === null || j.agentId === undefined);

    let html = '';
    
    // Opzione Seleziona Tutti
    html += `
        <label class="agent-multiselect-label-item master">
            <input type="checkbox" id="selectAllAgents" onchange="window.toggleSelectAllAgents(this)" checked style="cursor: pointer;">
            Seleziona Tutti
        </label>
    `;

    // Funzione helper per verificare se deve essere marcato come checked
    const isChecked = (val) => {
        if (!hadSelection) return true; // Default tutti checked al primo caricamento
        return previouslyChecked.includes(val);
    };

    if (hasNullAgent) {
        html += `
            <label class="agent-multiselect-label-item">
                <input type="checkbox" class="agent-checkbox" value="null" onchange="window.onAgentCheckboxChange()" ${isChecked('null') ? 'checked' : ''} style="cursor: pointer;">
                Nessun Agente
            </label>
        `;
    }

    agentsList.forEach(agent => {
        html += `
            <label class="agent-multiselect-label-item">
                <input type="checkbox" class="agent-checkbox" value="${agent.id}" onchange="window.onAgentCheckboxChange()" ${isChecked(String(agent.id)) ? 'checked' : ''} style="cursor: pointer;">
                ${agent.name}
            </label>
        `;
    });

    dropdown.innerHTML = html;

    // Aggiorna lo stato della checkbox "Seleziona Tutti"
    const checkboxes = dropdown.querySelectorAll('.agent-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const selectAllCb = document.getElementById('selectAllAgents');
    if (selectAllCb) {
        selectAllCb.checked = (checkedCount === checkboxes.length);
        selectAllCb.indeterminate = (checkedCount > 0 && checkedCount < checkboxes.length);
    }

    // Aggiorniamo la label iniziale
    window.updateAgentMultiselectLabel();
}

// Popola dinamicamente il menu a discesa dell'origine contatto
function populateContactFilter(jobs) {
    const filterEl = document.getElementById('mapContactFilter');
    if (!filterEl) return;

    const currentVal = filterEl.value;

    // Trova tutte le origini contatto uniche (escludendo null/undefined/empty)
    const contacts = [...new Set(jobs.map(j => j.contact).filter(c => c !== null && c !== undefined && c.trim() !== ''))];
    
    // Ordina alfabeticamente
    contacts.sort((a, b) => a.localeCompare(b));

    filterEl.innerHTML = `<option value="">Tutte le origini</option>`;

    // Controlla se ci sono preventivi senza origine contatto specificata
    const hasEmptyContact = jobs.some(j => !j.contact || j.contact.trim() === '' || j.contact.toLowerCase() === 'non specificato');
    if (hasEmptyContact) {
        const opt = document.createElement('option');
        opt.value = "empty";
        opt.textContent = "Non Specificato";
        filterEl.appendChild(opt);
    }

    contacts.forEach(c => {
        if (c.toLowerCase() !== 'non specificato') {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            filterEl.appendChild(opt);
        }
    });

    if (currentVal && filterEl.querySelector(`option[value="${currentVal}"]`)) {
        filterEl.value = currentVal;
    }
}

async function initMapReport() {
    console.log("Inizializzazione Mappa Cantieri 2026...");
    let isFirstLoad = false;
    
    // Inizializza la mappa Leaflet se non esiste già
    if (!leafletMap) {
        isFirstLoad = true;
        // Centriamo di default sull'Emilia Romagna
        leafletMap = L.map('genesyMap').setView([44.3, 12.1], 9);
        
        // Carica i tasselli da OpenStreetMap
        baseTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(leafletMap);

        // Prepara il layer per la densità di popolazione locale (Offline, basata su comuni.json)
        popDensityLayer = L.layerGroup();
        
        // Forza l'aggiornamento delle dimensioni di Leaflet in caso sia stato caricato nascosto
        setTimeout(() => {
            leafletMap.invalidateSize();
        }, 300);
    } else {
        // Ricalcola le dimensioni se la mappa è già stata creata (evita visualizzazione grigia a pezzi)
        leafletMap.invalidateSize();
        setTimeout(() => {
            if (leafletMap) leafletMap.invalidateSize();
        }, 100);
    }

    // Applica l'eventuale selezione iniziale del tipo mappa (Standard vs Densità)
    if (typeof window.changeMapType === 'function') {
        window.changeMapType();
    }

    // Carica prima i dati salvati su Supabase/cache per caricare subito la mappa (esperienza immediata)
    await loadMapDataFromSupabase();

    // Sincronizzazione automatica all'apertura iniziale della mappa (una sola volta per sessione/caricamento pagina)
    if (isFirstLoad) {
        console.log("[Mappa] Apertura iniziale della mappa: avvio sincronizzazione automatica...");
        setTimeout(() => {
            triggerMapSync();
        }, 800);
    }
}

// Caricamento dei dati salvati precedentemente per mostrare subito la mappa
async function loadMapDataFromSupabase() {
    const totalJobsEl = document.getElementById('mapTotalJobs');
    const totalRevenueEl = document.getElementById('mapTotalRevenue');
    const syncStatusEl = document.getElementById('mapSyncStatus');
    const jobsListEl = document.getElementById('mapJobsList');
    const badgeEl = document.getElementById('mapJobsCountBadge');

    if (totalJobsEl) totalJobsEl.textContent = "...";
    if (totalRevenueEl) totalRevenueEl.textContent = "...";
    if (badgeEl) badgeEl.textContent = "Caricamento...";

    try {
        // 1. Carica la cache delle coordinate
        const cachedCoords = await getAppConfigKey('geocoding_cache');
        if (cachedCoords) {
            geocodingCache = cachedCoords;
            
            // Safe-guard: Rimuove chiavi errate della Russia o contenenti "Russi (RA)"
            let cacheDirty = false;
            for (const key in geocodingCache) {
                if (key.includes("Russi (RA)") || (geocodingCache[key] && Math.abs((geocodingCache[key].lat || 0) - 53.1899116) < 0.001)) {
                    delete geocodingCache[key];
                    cacheDirty = true;
                }
            }
            if (cacheDirty) {
                console.log("[Safe-guard] Rilevate e rimosse coordinate errate in Russia dalla cache. Riscrittura cache...");
                await saveAppConfigKey('geocoding_cache', geocodingCache);
            }
        }

        // Verifica se il database e i preventivi sono disponibili in memoria
        if (!window.db || !window.db.data || !window.db.data.quotes) {
            console.warn("[Mappa] database non inizializzato o preventivi Genesy mancanti.");
            if (jobsListEl) {
                jobsListEl.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); padding: 40px 10px; font-size: 0.9rem; grid-column: 1 / -1;">
                        Database in caricamento...
                    </div>
                `;
            }
            return;
        }

        const lastSync = await getAppConfigKey('map_jobs_last_sync');

        // 2. Filtra e mappa i preventivi del 2026
        const quotes2026 = window.db.getAllQuotes().filter(q => {
            if (!q.date) return false;
            const year = new Date(q.date).getFullYear();
            return year === 2026;
        });

        const mappedJobs = quotes2026.map(q => {
            let address = '';
            let city = q.siteCity || q.customer?.city || q.customer?.addressCity || '';
            let province = q.siteProvince || q.customer?.province || q.customer?.addressProvince || '';
            
            if (q.siteAddress && q.siteAddress.trim().length > 0) {
                address = `${q.siteAddress}, ${city} (${province}), Italy`;
            } else {
                const street = q.customer?.address || '';
                address = `${street}, ${city} (${province}), Italy`;
            }
            address = address.replace(/\s+/g, ' ').trim();
            const cleanDisplayAddress = address.replace(', Italy', '');

            let lat = null;
            let lon = null;

            if (geocodingCache[address]) {
                lat = geocodingCache[address].lat;
                lon = geocodingCache[address].lon;
            }

            return {
                id: q.id,
                docNumber: q.number || q.friendlyId || '',
                docDate: q.date,
                companyName: [q.customer?.name, q.customer?.surname].filter(Boolean).join(' ') || 'Cliente Sconosciuto',
                address: cleanDisplayAddress,
                amount: q.total || 0,
                statusDesc: q.status || 'Aperto',
                lat: lat,
                lon: lon,
                agentId: q.agent || null,
                giobbyDocumentId: q.giobbyDocumentId || null,
                jobType: q.jobType || null,
                city: city || '',
                zone: q.zone || '',
                contact: q.contact || null
            };
        });

        allJobs2026 = mappedJobs;

        // Safe-guard: Resetta coordinate in Russia per cantieri di Russi
        let jobsDirty = false;
        allJobs2026.forEach(job => {
            const isRussia = job.lat && Math.abs(job.lat - 53.1899116) < 0.001;
            const isRussiCity = job.address && job.address.toLowerCase().includes("russi");
            if (isRussia || (isRussiCity && isRussia)) {
                console.log(`[Safe-guard] Reset coordinate errate Russia per preventivo: ${job.companyName}`);
                job.lat = null;
                job.lon = null;
                jobsDirty = true;
                
                const addressWithItaly = job.address + ", Italy";
                geocodingCache[addressWithItaly] = { lat: null, lon: null };
            }
        });
        if (jobsDirty) {
            console.log("[Safe-guard] Riscrittura cache su Supabase con coordinate di Russi resettate...");
            await saveAppConfigKey('geocoding_cache', geocodingCache);
        }

        if (allJobs2026.length > 0) {
            console.log(`Caricati ${allJobs2026.length} cantieri dai preventivi Genesy 2026.`);
            
            // Aggiorna KPI
            updateKPIs();

            // Aggiorna la densità di popolazione locale
            if (typeof updatePopulationDensityLayer === 'function') {
                updatePopulationDensityLayer();
            }

            // Aggiorna l'analisi delle zone
            if (typeof updateZoneAnalysisTable === 'function') {
                updateZoneAnalysisTable();
            }

            // Aggiorna stato sincronizzazione
            if (syncStatusEl) {
                const dateStr = lastSync ? new Date(lastSync).toLocaleString('it-IT') : 'N/D';
                syncStatusEl.innerHTML = `Aggiornato: <strong>${dateStr}</strong>`;
            }

            // Popola filtro agenti
            populateAgentFilter(allJobs2026);

            // Popola filtro origine contatto
            populateContactFilter(allJobs2026);

            // Inizializza le etichette di tutti i dropdown (Agenti, Stati, Tipo Lavoro)
            updateAllDropdownLabels();

            // Renderizza i marker e la lista
            renderJobsOnMapAndList(allJobs2026);

            // Avvia la geolocalizzazione in background per eventuali cantieri non georeferenziati
            startBackgroundGeocoding();
        } else {
            console.log("Nessun preventivo Genesy 2026 trovato.");
            if (totalJobsEl) totalJobsEl.textContent = "0";
            if (totalRevenueEl) totalRevenueEl.textContent = "€0.00";
            if (syncStatusEl) syncStatusEl.innerHTML = "<strong>Nessun preventivo nel 2026</strong>";
            if (badgeEl) badgeEl.textContent = "0 cantieri";
            
            if (jobsListEl) {
                jobsListEl.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); padding: 40px 10px; font-size: 0.9rem; grid-column: 1 / -1;">
                        <i class="fa-solid fa-folder-open" style="font-size: 2rem; color: #2563eb; margin-bottom: 12px; display: block;"></i>
                        Nessun preventivo del 2026 trovato nel database.
                    </div>
                `;
            }
        }
    } catch (e) {
        console.error("Errore caricamento dati mappa da Supabase/Memory:", e);
        if (jobsListEl) {
            jobsListEl.innerHTML = `<div style="color: red; padding: 20px; font-size: 0.85rem; grid-column: 1 / -1;">Errore caricamento dati: ${e.message}</div>`;
        }
    }
}

// Aggiorna i box dei KPI
function updateKPIs() {
    const totalJobsEl = document.getElementById('mapTotalJobs');
    const totalRevenueEl = document.getElementById('mapTotalRevenue');

    if (!totalJobsEl || !totalRevenueEl) return;

    const count = allJobs2026.length;
    const revenue = allJobs2026.reduce((acc, job) => acc + (parseFloat(job.amount) || 0), 0);

    totalJobsEl.textContent = count;
    totalRevenueEl.textContent = revenue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Renderizza i marker sulla mappa e la lista a destra
function renderJobsOnMapAndList(jobsToRender) {
    // 1. Pulisce i marker esistenti
    mapMarkers.forEach(marker => {
        if (leafletMap) leafletMap.removeLayer(marker);
    });
    mapMarkers = [];

    const jobsListEl = document.getElementById('mapJobsList');
    if (jobsListEl) {
        jobsListEl.innerHTML = "";
    }

    const badgeEl = document.getElementById('mapJobsCountBadge');
    if (badgeEl) {
        badgeEl.textContent = `${jobsToRender.length} cantier${jobsToRender.length === 1 ? 'e' : 'i'}`;
    }

    if (jobsToRender.length === 0) {
        if (jobsListEl) {
            jobsListEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px; font-size: 0.85rem; grid-column: 1 / -1;">Nessun cantiere corrisponde alla ricerca.</div>`;
        }
        return;
    }

    // Array di coordinate valide per centrare la mappa in modo ottimale
    const boundsPoints = [];

    // Icona personalizzata CSS premium con colore basato sullo stato del preventivo
    const createCustomIcon = (job, isActive) => {
        let color = '#2563eb'; // Default blu (Aperto)
        if (isActive) {
            color = '#ef4444'; // Rosso (Selezionato)
        } else {
            const status = (job.statusDesc || '').toLowerCase();
            if (['chiuso', 'ordine confermato'].includes(status)) {
                color = '#16a34a'; // Verde (Chiuso/Confermato)
            } else if (['perso', 'rifiutato'].includes(status)) {
                color = '#94a3b8'; // Grigio (Perso/Rifiutato)
            }
        }
        
        return L.divIcon({
            html: `
                <div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.3); position: relative; transition: all 0.2s;">
                </div>
            `,
            className: 'custom-div-icon',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
    };

    // Estrae l'instanceId aziendale per i link Giobby
    let companyInstance = '00554';
    try {
        const giobbyConfRaw = localStorage.getItem('giobbyConfig');
        if (giobbyConfRaw) {
            const giobbyConf = JSON.parse(giobbyConfRaw);
            if (giobbyConf.instanceId && giobbyConf.instanceId !== '00553') companyInstance = giobbyConf.instanceId;
        }
    } catch (_) {}

    // Aggiungi marker ed elementi lista
    jobsToRender.forEach(job => {
        let hasCoords = job.lat !== null && job.lon !== null;
        
        if (hasCoords) {
            const marker = L.marker([job.lat, job.lon], { icon: createCustomIcon(job, false) }).addTo(leafletMap);
            marker.jobId = job.id;
            
            // Bottone d'azione principale: Apri in Genesy. Bottone d'azione secondario: Apri in Giobby (se presente)
            let giobbyButtonHtml = '';
            if (job.giobbyDocumentId) {
                giobbyButtonHtml = `
                    <a href="https://app.giobby.com/Giobby${companyInstance}/company/Order.xhtml?ID=${job.giobbyDocumentId}&ftrID=oda_v" target="_blank" class="popup-action-btn secondary">
                        <i class="fa-solid fa-up-right-from-square"></i> Apri in Giobby
                    </a>
                `;
            }

            const popupContent = `
                <div class="custom-map-popup">
                    <h4 class="popup-title">${job.companyName}</h4>
                    <div class="popup-meta">Preventivo N. ${job.docNumber} del ${new Date(job.docDate).toLocaleDateString('it-IT')}</div>
                    <div class="popup-details">
                        <strong>Indirizzo cantiere:</strong> ${job.address}<br>
                        <strong>Agente:</strong> ${getAgentNameById(job.agentId)}<br>
                        <strong>Importo:</strong> €${parseFloat(job.amount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}<br>
                        <strong>Stato:</strong> ${job.statusDesc}
                    </div>
                    <button onclick="window.openEditor('${job.id}')" class="popup-action-btn" style="border: none; cursor: pointer;">
                        <i class="fa-solid fa-pen-to-square"></i> Apri in Genesy
                    </button>
                    ${giobbyButtonHtml}
                </div>
            `;
            marker.bindPopup(popupContent);
            
            // Evento click sul marker per evidenziare la lista
            marker.on('click', () => {
                highlightListItem(job.id, false);
            });

            mapMarkers.push(marker);
            boundsPoints.push([job.lat, job.lon]);
        }

        if (jobsListEl) {
            // Elemento per la lista di destra
            const itemDiv = document.createElement('div');
            itemDiv.className = 'map-job-item';
            itemDiv.setAttribute('data-id', job.id);
            itemDiv.onclick = () => selectJob(job.id, job.lat, job.lon);

            itemDiv.innerHTML = `
                <div class="map-job-header">
                    <span class="map-job-title">${job.companyName}</span>
                    <span class="map-job-amount">€${parseFloat(job.amount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="map-job-address">
                    <i class="fa-solid ${hasCoords ? 'fa-location-dot' : 'fa-triangle-exclamation'}" style="color: ${hasCoords ? '#2563eb' : '#f59e0b'};"></i> 
                    <span class="addr-text">${job.address}</span>
                </div>
                <div class="map-job-meta">
                    <span>N. ${job.docNumber} - ${new Date(job.docDate).toLocaleDateString('it-IT')}</span>
                    <span style="color: var(--text-muted, #64748b);">Agente: <strong>${getAgentNameById(job.agentId)}</strong></span>
                    <span style="font-weight: 500; color: #475569;">${job.statusDesc}</span>
                </div>
            `;
            jobsListEl.appendChild(itemDiv);
        }
    });

    // Centra ed adatta lo zoom della mappa per contenere tutti i marker
    if (boundsPoints.length > 0 && leafletMap) {
        leafletMap.fitBounds(L.latLngBounds(boundsPoints), { padding: [30, 30] });
    }
}

// Quando un elemento della lista viene cliccato
function selectJob(jobId, lat, lon) {
    highlightListItem(jobId, true);

    if (lat !== null && lon !== null && leafletMap) {
        // Sposta la mappa sul marker con zoom ravvicinato
        leafletMap.setView([lat, lon], 14);
        
        // Trova il marker corrispondente e apri il popup
        const marker = mapMarkers.find(m => m.jobId === jobId);
        if (marker) {
            marker.openPopup();
        }
    } else {
        alert("Questo cantiere non ha coordinate geografiche valide per essere visualizzato sulla mappa. Verrà localizzato in background se possibile.");
    }
}

// Evidenzia visivamente l'elemento attivo nella lista a destra
function highlightListItem(jobId, scrollIntoView) {
    document.querySelectorAll('.map-job-item').forEach(item => {
        if (item.getAttribute('data-id') === jobId.toString()) {
            item.classList.add('active');
            if (scrollIntoView) {
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        } else {
            item.classList.remove('active');
        }
    });

    // Cambia colore al marker attivo sulla mappa
    mapMarkers.forEach(marker => {
        const isSelected = marker.jobId === jobId;
        const job = allJobs2026.find(j => j.id === marker.jobId);
        
        let color = '#2563eb'; // Default blu
        if (isSelected) {
            color = '#ef4444'; // Rosso se selezionato
        } else if (job) {
            const status = (job.statusDesc || '').toLowerCase();
            if (['chiuso', 'ordine confermato'].includes(status)) {
                color = '#16a34a'; // Verde
            } else if (['perso', 'rifiutato'].includes(status)) {
                color = '#94a3b8'; // Grigio
            }
        }
        
        // Modifica direttamente l'elemento DOM esistente per evitare di ricreare il marker
        // ed evitare così la chiusura o il malfunzionamento del popup in Leaflet.
        const el = marker.getElement();
        if (el) {
            const innerDiv = el.querySelector('div');
            if (innerDiv) {
                innerDiv.style.backgroundColor = color;
                if (isSelected) {
                    innerDiv.style.transform = 'scale(1.2)';
                    innerDiv.style.boxShadow = '0 0 8px rgba(0,0,0,0.5)';
                    innerDiv.style.border = '2.5px solid white';
                } else {
                    innerDiv.style.transform = 'scale(1)';
                    innerDiv.style.boxShadow = '0 0 6px rgba(0,0,0,0.3)';
                    innerDiv.style.border = '2px solid white';
                }
            }
        } else {
            // Fallback se il marker non è ancora nel DOM (es. inizializzazione)
            marker.setIcon(L.divIcon({
                html: `
                    <div style="background-color: ${color}; width: ${isSelected ? '12.5px' : '12px'}; height: ${isSelected ? '12.5px' : '12px'}; border-radius: 50%; border: ${isSelected ? '2.5px' : '2px'} solid white; box-shadow: 0 0 6px rgba(0,0,0,0.3); position: relative; transition: all 0.2s;">
                    </div>
                `,
                className: 'custom-div-icon',
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            }));
        }

        if (isSelected) {
            marker.setZIndexOffset(1000); // Porta in primo piano
        } else {
            marker.setZIndexOffset(0);
        }
    });
}

// Calcola e aggiorna le etichette della select degli stati
function updateStatusFilterLabels(agentJobs) {
    const statusFilterEl = document.getElementById('mapStatusFilter');
    if (!statusFilterEl) return;

    const totalCount = agentJobs.length;
    const totalAmount = agentJobs.reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0);

    const apertiJobs = agentJobs.filter(j => 
        ['aperto', 'in attesa', 'bozza', 'inviato'].includes((j.statusDesc || '').toLowerCase())
    );
    const apertiCount = apertiJobs.length;
    const apertiAmount = apertiJobs.reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0);

    const chiusiJobs = agentJobs.filter(j => 
        ['chiuso', 'ordine confermato'].includes((j.statusDesc || '').toLowerCase())
    );
    const chiusiCount = chiusiJobs.length;
    const chiusiAmount = chiusiJobs.reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0);

    const persiJobs = agentJobs.filter(j => 
        ['perso', 'rifiutato'].includes((j.statusDesc || '').toLowerCase())
    );
    const persiCount = persiJobs.length;
    const persiAmount = persiJobs.reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0);

    const apertiPercent = totalCount > 0 ? Math.round((apertiCount / totalCount) * 100) : 0;
    const chiusiPercent = totalCount > 0 ? Math.round((chiusiCount / totalCount) * 100) : 0;
    const persiPercent = totalCount > 0 ? Math.round((persiCount / totalCount) * 100) : 0;

    statusFilterEl.options[0].text = `Tutti (${totalCount} - €${Math.round(totalAmount).toLocaleString('it-IT')})`;
    statusFilterEl.options[1].text = `Aperti (${apertiPercent}% - €${Math.round(apertiAmount).toLocaleString('it-IT')})`;
    statusFilterEl.options[2].text = `Chiusi (${chiusiPercent}% - €${Math.round(chiusiAmount).toLocaleString('it-IT')})`;
    statusFilterEl.options[3].text = `Persi (${persiPercent}% - €${Math.round(persiAmount).toLocaleString('it-IT')})`;
}

// Calcola e aggiorna le etichette della select dei tipi di lavoro
function updateJobTypeFilterLabels(agentJobs) {
    const jobTypeFilterEl = document.getElementById('mapJobTypeFilter');
    if (!jobTypeFilterEl) return;

    const totalCount = agentJobs.length;
    const totalAmount = agentJobs.reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0);

    const filterByType = (type) => agentJobs.filter(j => (j.jobType || '').toUpperCase() === type.toUpperCase());

    const internoJobs = filterByType('interno');
    const esternoJobs = filterByType('esterno');
    const ripristinoJobs = filterByType('ripristino');

    const internoCount = internoJobs.length;
    const esternoCount = esternoJobs.length;
    const ripristinoCount = ripristinoJobs.length;

    const internoAmount = internoJobs.reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0);
    const esternoAmount = esternoJobs.reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0);
    const ripristinoAmount = ripristinoJobs.reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0);

    const internoCountPct = totalCount > 0 ? Math.round((internoCount / totalCount) * 100) : 0;
    const esternoCountPct = totalCount > 0 ? Math.round((esternoCount / totalCount) * 100) : 0;
    const ripristinoCountPct = totalCount > 0 ? Math.round((ripristinoCount / totalCount) * 100) : 0;

    const internoAmtPct = totalAmount > 0 ? Math.round((internoAmount / totalAmount) * 100) : 0;
    const esternoAmtPct = totalAmount > 0 ? Math.round((esternoAmount / totalAmount) * 100) : 0;
    const ripristinoAmtPct = totalAmount > 0 ? Math.round((ripristinoAmount / totalAmount) * 100) : 0;

    jobTypeFilterEl.options[0].text = `Tutti i tipi (${totalCount} - €${Math.round(totalAmount).toLocaleString('it-IT')})`;
    jobTypeFilterEl.options[1].text = `Interno (${internoCountPct}% - €${Math.round(internoAmount).toLocaleString('it-IT')} - ${internoAmtPct}%)`;
    jobTypeFilterEl.options[2].text = `Esterno (${esternoCountPct}% - €${Math.round(esternoAmount).toLocaleString('it-IT')} - ${esternoAmtPct}%)`;
    jobTypeFilterEl.options[3].text = `Ripristino (${ripristinoCountPct}% - €${Math.round(ripristinoAmount).toLocaleString('it-IT')} - ${ripristinoAmtPct}%)`;
}

// Calcola e aggiorna le etichette del dropdown Agenti in base ai filtri incrociati attivi
function updateAgentFilterLabels(filteredJobs, selectedStatus) {
    const checkboxes = document.querySelectorAll('.agent-checkbox');
    const selectAllCb = document.getElementById('selectAllAgents');
    
    checkboxes.forEach(cb => {
        const val = cb.value;
        const labelEl = cb.parentElement;
        if (!labelEl) return;
        
        let agentJobs = filteredJobs;
        if (val === "null") {
            agentJobs = filteredJobs.filter(j => j.agentId === null || j.agentId === undefined);
        } else if (val) {
            agentJobs = filteredJobs.filter(j => String(j.agentId) === String(val));
        }
        
        const total = agentJobs.length;
        let rateVal = 0;
        let rateLabel = 'Conv.';
        
        if (selectedStatus === 'aperti') {
            const aperti = agentJobs.filter(j => 
                ['aperto', 'in attesa', 'bozza', 'inviato'].includes((j.statusDesc || '').toLowerCase())
            ).length;
            rateVal = total > 0 ? Math.round((aperti / total) * 100) : 0;
            rateLabel = 'Aperti';
        } else if (selectedStatus === 'persi') {
            const persi = agentJobs.filter(j => 
                ['perso', 'rifiutato'].includes((j.statusDesc || '').toLowerCase())
            ).length;
            rateVal = total > 0 ? Math.round((persi / total) * 100) : 0;
            rateLabel = 'Persi';
        } else {
            const closed = agentJobs.filter(j => 
                ['chiuso', 'ordine confermato'].includes((j.statusDesc || '').toLowerCase())
            ).length;
            rateVal = total > 0 ? Math.round((closed / total) * 100) : 0;
            rateLabel = 'Conv.';
        }
        
        let baseName = "Nessun Agente";
        if (val !== "null") {
            baseName = getAgentNameById(val);
        }
        
        // Update label text node
        Array.from(labelEl.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                labelEl.removeChild(node);
            }
        });
        labelEl.appendChild(document.createTextNode(` ${baseName} (${rateLabel} ${rateVal}%)`));
    });

    if (selectAllCb) {
        const labelEl = selectAllCb.parentElement;
        if (labelEl) {
            const total = filteredJobs.length;
            let rateVal = 0;
            let rateLabel = 'Conv.';
            if (selectedStatus === 'aperti') {
                const aperti = filteredJobs.filter(j => 
                    ['aperto', 'in attesa', 'bozza', 'inviato'].includes((j.statusDesc || '').toLowerCase())
                ).length;
                rateVal = total > 0 ? Math.round((aperti / total) * 100) : 0;
                rateLabel = 'Aperti';
            } else if (selectedStatus === 'persi') {
                const persi = filteredJobs.filter(j => 
                    ['perso', 'rifiutato'].includes((j.statusDesc || '').toLowerCase())
                ).length;
                rateVal = total > 0 ? Math.round((persi / total) * 100) : 0;
                rateLabel = 'Persi';
            } else {
                const closed = filteredJobs.filter(j => 
                    ['chiuso', 'ordine confermato'].includes((j.statusDesc || '').toLowerCase())
                ).length;
                rateVal = total > 0 ? Math.round((closed / total) * 100) : 0;
                rateLabel = 'Conv.';
            }
            
            Array.from(labelEl.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    labelEl.removeChild(node);
                }
            });
            labelEl.appendChild(document.createTextNode(` Seleziona Tutti (${rateLabel} ${rateVal}%)`));
        }
    }
}

// Aggiorna le etichette di tutti i dropdown basandosi sull'intersezione degli altri filtri
function updateAllDropdownLabels() {
    const statusFilterEl = document.getElementById('mapStatusFilter');
    const jobTypeFilterEl = document.getElementById('mapJobTypeFilter');
    const contactFilterEl = document.getElementById('mapContactFilter');

    const selectedStatus = statusFilterEl ? statusFilterEl.value : "";
    const selectedJobType = jobTypeFilterEl ? jobTypeFilterEl.value : "";
    const selectedContact = contactFilterEl ? contactFilterEl.value : "";

    const checkboxes = document.querySelectorAll('.agent-checkbox');
    const checkedCbs = Array.from(checkboxes).filter(cb => cb.checked);
    const selectedAgentIds = checkedCbs.map(cb => cb.value);
    const isAllAgentsSelected = (checkedCbs.length === checkboxes.length || checkboxes.length === 0);

    // Helper per filtrare per agenti
    const filterByAgents = (list) => {
        if (isAllAgentsSelected) return list;
        return list.filter(job => {
            if (job.agentId === null || job.agentId === undefined) {
                return selectedAgentIds.includes("null");
            } else {
                return selectedAgentIds.includes(String(job.agentId));
            }
        });
    };

    // Helper per filtrare per contatto
    const filterByContact = (list) => {
        if (!selectedContact) return list;
        if (selectedContact === 'empty') {
            return list.filter(job => !job.contact || job.contact.trim() === '' || job.contact.toLowerCase() === 'non specificato');
        }
        return list.filter(job => job.contact === selectedContact);
    };

    // 1. Per il dropdown STATO (Status): filtriamo per Agenti selezionati + Tipo Lavoro + Origine Contatto
    let statusFiltered = allJobs2026;
    statusFiltered = filterByAgents(statusFiltered);
    statusFiltered = filterByContact(statusFiltered);
    if (selectedJobType) {
        statusFiltered = statusFiltered.filter(job => 
            (job.jobType || '').toLowerCase() === selectedJobType.toLowerCase()
        );
    }
    updateStatusFilterLabels(statusFiltered);

    // 2. Per il dropdown TIPO LAVORO (Job Type): filtriamo per Agenti selezionati + Stato + Origine Contatto
    let jobTypeFiltered = allJobs2026;
    jobTypeFiltered = filterByAgents(jobTypeFiltered);
    jobTypeFiltered = filterByContact(jobTypeFiltered);
    if (selectedStatus) {
        if (selectedStatus === 'aperti') {
            jobTypeFiltered = jobTypeFiltered.filter(job => 
                ['aperto', 'in attesa', 'bozza', 'inviato'].includes((job.statusDesc || '').toLowerCase())
            );
        } else if (selectedStatus === 'chiusi') {
            jobTypeFiltered = jobTypeFiltered.filter(job => 
                ['chiuso', 'ordine confermato'].includes((job.statusDesc || '').toLowerCase())
            );
        } else if (selectedStatus === 'persi') {
            jobTypeFiltered = jobTypeFiltered.filter(job => 
                ['perso', 'rifiutato'].includes((job.statusDesc || '').toLowerCase())
            );
        }
    }
    updateJobTypeFilterLabels(jobTypeFiltered);

    // 3. Per il dropdown AGENTE (Agent): filtriamo per Tipo Lavoro + Origine Contatto
    let agentFiltered = allJobs2026;
    agentFiltered = filterByContact(agentFiltered);
    if (selectedJobType) {
        agentFiltered = agentFiltered.filter(job => 
            (job.jobType || '').toLowerCase() === selectedJobType.toLowerCase()
        );
    }
    updateAgentFilterLabels(agentFiltered, selectedStatus);
}

// Barra di ricerca: Filtra i lavori in tempo reale (per Agente, Stato, Tipo Lavoro, Origine Contatto e Testo)
function filterMapJobs() {
    const searchInput = document.getElementById('mapSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const statusFilterEl = document.getElementById('mapStatusFilter');
    const selectedStatus = statusFilterEl ? statusFilterEl.value : "";
    const jobTypeFilterEl = document.getElementById('mapJobTypeFilter');
    const selectedJobType = jobTypeFilterEl ? jobTypeFilterEl.value : "";
    const contactFilterEl = document.getElementById('mapContactFilter');
    const selectedContact = contactFilterEl ? contactFilterEl.value : "";

    // Aggiorniamo le etichette di tutti i dropdown in base alle selezioni incrociate attive
    updateAllDropdownLabels();

    // Ora filtriamo l'elenco finale per il rendering sulla mappa
    let filtered = allJobs2026;

    // 1. Filtro Agente (Multi-selezione)
    const checkboxes = document.querySelectorAll('.agent-checkbox');
    const checkedCbs = Array.from(checkboxes).filter(cb => cb.checked);
    if (checkboxes.length > 0) {
        const selectedAgentIds = checkedCbs.map(cb => cb.value);
        filtered = filtered.filter(job => {
            if (job.agentId === null || job.agentId === undefined) {
                return selectedAgentIds.includes("null");
            } else {
                return selectedAgentIds.includes(String(job.agentId));
            }
        });
    }

    // 2. Filtro Stato
    if (selectedStatus) {
        if (selectedStatus === 'aperti') {
            filtered = filtered.filter(job => 
                ['aperto', 'in attesa', 'bozza', 'inviato'].includes((job.statusDesc || '').toLowerCase())
            );
        } else if (selectedStatus === 'chiusi') {
            filtered = filtered.filter(job => 
                ['chiuso', 'ordine confermato'].includes((job.statusDesc || '').toLowerCase())
            );
        } else if (selectedStatus === 'persi') {
            filtered = filtered.filter(job => 
                ['perso', 'rifiutato'].includes((job.statusDesc || '').toLowerCase())
            );
        }
    }

    // 2b. Filtro Tipo Lavoro
    if (selectedJobType) {
        filtered = filtered.filter(job => 
            (job.jobType || '').toLowerCase() === selectedJobType.toLowerCase()
        );
    }

    // 2c. Filtro Origine Contatto
    if (selectedContact) {
        if (selectedContact === 'empty') {
            filtered = filtered.filter(job => !job.contact || job.contact.trim() === '' || job.contact.toLowerCase() === 'non specificato');
        } else {
            filtered = filtered.filter(job => job.contact === selectedContact);
        }
    }

    // 3. Filtro di ricerca testuale
    if (query) {
        filtered = filtered.filter(job => 
            job.companyName.toLowerCase().includes(query) ||
            job.address.toLowerCase().includes(query) ||
            job.statusDesc.toLowerCase().includes(query) ||
            job.docNumber.toString().includes(query)
        );
    }

    renderJobsOnMapAndList(filtered);
    
    // Aggiorna la tabella dell'analisi per zone con i record filtrati
    if (typeof updateZoneAnalysisTable === 'function') {
        updateZoneAnalysisTable(filtered);
    }
    
    // Aggiorna la densità e la tabella dei coefficienti demografici per i record filtrati
    if (typeof updatePopulationDensityLayer === 'function') {
        updatePopulationDensityLayer(filtered);
    }
}

// helper delay per rispettare i limiti di velocità delle API esterne (Nominatim)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Funzione principale che esegue l'aggiornamento dei preventivi da Supabase e la geocodifica
async function triggerMapSync() {
    if (isSyncing) return;
    isSyncing = true;

    const btn = document.getElementById('btnSyncMap');
    const progressContainer = document.getElementById('mapSyncProgressContainer');
    const progressText = document.getElementById('mapSyncProgressText');
    const progressPercent = document.getElementById('mapSyncProgressPercent');
    const progressBar = document.getElementById('mapSyncProgressBar');
    const logEl = document.getElementById('mapSyncLog');

    // UI Loading state
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aggiornamento...';
    }
    if (progressContainer) progressContainer.classList.remove('hidden');
    
    const updateProgress = (text, percent, log = '') => {
        if (progressText) progressText.textContent = text;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (logEl) {
            logEl.textContent = log;
            logEl.style.color = '';
        }
        console.log(`[Sync Map] ${text} (${percent}%) ${log}`);
    };

    try {
        // 1. Ricarica i preventivi da Supabase
        updateProgress("Connessione a Supabase...", 10, "Ricaricamento preventivi in corso...");
        await window.db.refreshQuotes();
        
        // 2. Carica la cache degli indirizzi già geocodificati
        updateProgress("Caricamento cache indirizzi...", 30);
        const cachedCoords = await getAppConfigKey('geocoding_cache');
        if (cachedCoords) {
            geocodingCache = cachedCoords;
            // Safe-guard: Rimuove chiavi errate
            for (const key in geocodingCache) {
                if (key.includes("Russi (RA)") || (geocodingCache[key] && Math.abs((geocodingCache[key].lat || 0) - 53.1899116) < 0.001)) {
                    delete geocodingCache[key];
                }
            }
        }

        updateProgress("Mappatura preventivi...", 60, "Filtro preventivi del 2026...");
        
        // 3. Filtra e mappa i preventivi del 2026
        const quotes2026 = window.db.getAllQuotes().filter(q => {
            if (!q.date) return false;
            const year = new Date(q.date).getFullYear();
            return year === 2026;
        });

        const syncedJobs = quotes2026.map(q => {
            let address = '';
            let city = q.siteCity || q.customer?.city || q.customer?.addressCity || '';
            let province = q.siteProvince || q.customer?.province || q.customer?.addressProvince || '';
            
            if (q.siteAddress && q.siteAddress.trim().length > 0) {
                address = `${q.siteAddress}, ${city} (${province}), Italy`;
            } else {
                const street = q.customer?.address || '';
                address = `${street}, ${city} (${province}), Italy`;
            }
            address = address.replace(/\s+/g, ' ').trim();
            const cleanDisplayAddress = address.replace(', Italy', '');

            let lat = null;
            let lon = null;

            if (geocodingCache[address]) {
                lat = geocodingCache[address].lat;
                lon = geocodingCache[address].lon;
            }

            return {
                id: q.id,
                docNumber: q.number || q.friendlyId || '',
                docDate: q.date,
                companyName: [q.customer?.name, q.customer?.surname].filter(Boolean).join(' ') || 'Cliente Sconosciuto',
                address: cleanDisplayAddress,
                amount: q.total || 0,
                statusDesc: q.status || 'Aperto',
                lat: lat,
                lon: lon,
                agentId: q.agent || null,
                giobbyDocumentId: q.giobbyDocumentId || null,
                jobType: q.jobType || null,
                city: city || '',
                zone: q.zone || '',
                contact: q.contact || null
            };
        });

        // Safe-guard Russi
        syncedJobs.forEach(job => {
            const isRussia = job.lat && Math.abs(job.lat - 53.1899116) < 0.001;
            const isRussiCity = job.address && job.address.toLowerCase().includes("russi");
            if (isRussia || (isRussiCity && isRussia)) {
                job.lat = null;
                job.lon = null;
                const addressWithItaly = job.address + ", Italy";
                geocodingCache[addressWithItaly] = { lat: null, lon: null };
            }
        });

        allJobs2026 = syncedJobs;

        // Salva il timestamp dell'ultimo aggiornamento
        const now = new Date().toISOString();
        await saveAppConfigKey('map_jobs_last_sync', now);

        // Salva l'elenco dei cantieri mappati (opzionale per retrocompatibilità)
        await saveAppConfigKey('map_jobs_2026', allJobs2026);

        // Popola filtro agenti
        populateAgentFilter(allJobs2026);

        // Popola filtro origine contatto
        populateContactFilter(allJobs2026);

        // Inizializza le etichette di tutti i dropdown (Agenti, Stati, Tipo Lavoro)
        updateAllDropdownLabels();

        // Aggiorna KPI e UI
        updateKPIs();

        // Aggiorna la densità di popolazione locale
        if (typeof updatePopulationDensityLayer === 'function') {
            updatePopulationDensityLayer();
        }

        // Aggiorna l'analisi delle zone
        if (typeof updateZoneAnalysisTable === 'function') {
            updateZoneAnalysisTable();
        }
        const syncStatusEl = document.getElementById('mapSyncStatus');
        if (syncStatusEl) {
            syncStatusEl.innerHTML = `Aggiornato: <strong>${new Date(now).toLocaleString('it-IT')}</strong>`;
        }

        // Renderizza sulla mappa e lista
        renderJobsOnMapAndList(allJobs2026);
        
        updateProgress("Aggiornamento completato!", 100, `Caricati ${allJobs2026.length} cantieri. Geolocalizzazione in background...`);
        
        setTimeout(() => {
            if (progressContainer) progressContainer.classList.add('hidden');
        }, 3000);

        // 4. Avvia la geolocalizzazione in background per risolvere i nuovi indirizzi
        startBackgroundGeocoding();

    } catch (e) {
        console.error("Errore aggiornamento mappa:", e);
        alert(`Errore Aggiornamento: ${e.message}`);
        updateProgress("Errore Aggiornamento", 0, e.message);
        if (logEl) logEl.style.color = 'red';
    } finally {
        isSyncing = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Aggiorna';
        }
    }
}

// Avvia il worker in background per risolvere gli indirizzi mancanti
async function startBackgroundGeocoding() {
    if (bgGeocodingActive) return;
    bgGeocodingActive = true;
    
    console.log("[BG Geocoding] Avvio geolocalizzazione in background...");
    
    // Trova i lavori che non hanno ancora coordinate
    const pendingJobs = allJobs2026.filter(job => job.lat === null || job.lon === null);
    if (pendingJobs.length === 0) {
        console.log("[BG Geocoding] Tutti i cantieri sono già geolocalizzati.");
        bgGeocodingActive = false;
        return;
    }

    console.log(`[BG Geocoding] Trovati ${pendingJobs.length} cantieri da geolocalizzare.`);
    
    let resolvedCount = 0;
    
    for (const job of pendingJobs) {
        const address = job.address + ", Italy";
        
        // Verifica se l'indirizzo è stato geocodificato in cache in un altro ciclo
        if (geocodingCache[address]) {
            if (geocodingCache[address].lat !== null) {
                job.lat = geocodingCache[address].lat;
                job.lon = geocodingCache[address].lon;
                addSingleMarkerToMap(job);
                updateJobUIStatus(job.id, true);
            }
            continue;
        }

        // Rispetta il limite di 1 richiesta al secondo (1.2s per sicurezza)
        await delay(1200);
        
        try {
            let lat = null;
            let lon = null;
            
            // Cerca l'indirizzo esatto (rimuovendo codici di provincia tra parentesi per ottimizzare il geocoding)
            const cleanQueryAddress = address.replace(/\s*\([^)]+\)/g, '');
            const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQueryAddress)}`;
            const geoRes = await fetch(geoUrl, {
                headers: { 'Referer': window.location.origin }
            });
            
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (geoData && geoData.length > 0) {
                    lat = parseFloat(geoData[0].lat);
                    lon = parseFloat(geoData[0].lon);
                } else {
                    // Fallback città: cerca di posizionarlo nel comune corretto
                    // Estrae la città dall'indirizzo (es. "Via Monte 2, Forlì (FC)" -> "Forlì")
                    const match = job.address.match(/,\s*([^,(\n]+)\s*(?:\([^)]+\))?$/);
                    const city = match ? match[1].trim() : '';
                    
                    if (city) {
                        const fallbackAddress = `${city}, Italy`;
                        if (geocodingCache[fallbackAddress]) {
                            lat = geocodingCache[fallbackAddress].lat;
                            lon = geocodingCache[fallbackAddress].lon;
                        } else {
                            await delay(1200); // Attesa di 1 secondo per il fallback
                            const fbRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackAddress)}`, {
                                headers: { 'Referer': window.location.origin }
                            });
                            if (fbRes.ok) {
                                const fbData = await fbRes.json();
                                if (fbData && fbData.length > 0) {
                                    lat = parseFloat(fbData[0].lat);
                                    lon = parseFloat(fbData[0].lon);
                                    geocodingCache[fallbackAddress] = { lat, lon };
                                }
                            }
                        }
                    }
                }
            }

            if (lat && lon) {
                job.lat = lat;
                job.lon = lon;
                geocodingCache[address] = { lat, lon };
                resolvedCount++;
                
                // 1. Aggiungi il marker sulla mappa in tempo reale
                addSingleMarkerToMap(job);
                
                // 2. Aggiorna lo stato visivo dell'icona nella lista a destra
                updateJobUIStatus(job.id, true);
                
                // 3. Salva periodicamente la cache e i lavori aggiornati su Supabase
                if (resolvedCount % 5 === 0 || resolvedCount === pendingJobs.length) {
                    await saveAppConfigKey('geocoding_cache', geocodingCache);
                    await saveAppConfigKey('map_jobs_2026', allJobs2026);
                }
            } else {
                console.warn(`[BG Geocoding] Impossibile geolocalizzare: ${job.address}`);
                // Per evitare di ritentare all'infinito, inseriamo null in cache
                geocodingCache[address] = { lat: null, lon: null }; 
            }

        } catch (err) {
            console.error(`[BG Geocoding] Errore geocodifica:`, err);
        }
    }
    
    // Salvataggio finale
    if (resolvedCount > 0) {
        await saveAppConfigKey('geocoding_cache', geocodingCache);
        await saveAppConfigKey('map_jobs_2026', allJobs2026);
    }
    
    console.log(`[BG Geocoding] Geolocalizzazione in background completata. Risolti ${resolvedCount} indirizzi.`);
    bgGeocodingActive = false;
}

// Aggiunge un singolo marker alla mappa in tempo reale
function addSingleMarkerToMap(job) {
    if (!leafletMap || !job.lat || !job.lon) return;
    
    // Controlla se il marker per questo lavoro esiste già
    if (mapMarkers.some(m => m.jobId === job.id)) return;

    const createCustomIcon = (job, isActive) => {
        let color = '#2563eb';
        if (isActive) {
            color = '#ef4444';
        } else {
            const status = (job.statusDesc || '').toLowerCase();
            if (['chiuso', 'ordine confermato'].includes(status)) {
                color = '#16a34a';
            } else if (['perso', 'rifiutato'].includes(status)) {
                color = '#94a3b8';
            }
        }
        return L.divIcon({
            html: `
                <div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.3); position: relative; transition: all 0.2s;">
                </div>
            `,
            className: 'custom-div-icon',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
    };

    let companyInstance = '00554';
    try {
        const giobbyConfRaw = localStorage.getItem('giobbyConfig');
        if (giobbyConfRaw) {
            const giobbyConf = JSON.parse(giobbyConfRaw);
            if (giobbyConf.instanceId && giobbyConf.instanceId !== '00553') companyInstance = giobbyConf.instanceId;
        }
    } catch (_) {}

    const marker = L.marker([job.lat, job.lon], { icon: createCustomIcon(job, false) }).addTo(leafletMap);
    marker.jobId = job.id;
    
    let giobbyButtonHtml = '';
    if (job.giobbyDocumentId) {
        giobbyButtonHtml = `
            <a href="https://app.giobby.com/Giobby${companyInstance}/company/Order.xhtml?ID=${job.giobbyDocumentId}&ftrID=oda_v" target="_blank" class="popup-action-btn secondary">
                <i class="fa-solid fa-up-right-from-square"></i> Apri in Giobby
            </a>
        `;
    }

    const popupContent = `
        <div class="custom-map-popup">
            <h4 class="popup-title">${job.companyName}</h4>
            <div class="popup-meta">Preventivo N. ${job.docNumber} del ${new Date(job.docDate).toLocaleDateString('it-IT')}</div>
            <div class="popup-details">
                <strong>Indirizzo cantiere:</strong> ${job.address}<br>
                <strong>Agente:</strong> ${getAgentNameById(job.agentId)}<br>
                <strong>Importo:</strong> €${parseFloat(job.amount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}<br>
                <strong>Stato:</strong> ${job.statusDesc}
            </div>
            <button onclick="window.openEditor('${job.id}')" class="popup-action-btn" style="border: none; cursor: pointer;">
                <i class="fa-solid fa-pen-to-square"></i> Apri in Genesy
            </button>
            ${giobbyButtonHtml}
        </div>
    `;
    marker.bindPopup(popupContent);
    marker.on('click', () => highlightListItem(job.id, false));

    mapMarkers.push(marker);
}

// Aggiorna lo stato visivo dell'icona indirizzo per il cantiere appena geocodificato
function updateJobUIStatus(jobId, hasCoords) {
    const item = document.querySelector(`.map-job-item[data-id="${jobId}"]`);
    if (!item) return;

    const icon = item.querySelector('.map-job-address i');
    if (icon) {
        if (hasCoords) {
            icon.className = 'fa-solid fa-location-dot';
            icon.style.color = '#2563eb';
        } else {
            icon.className = 'fa-solid fa-triangle-exclamation';
            icon.style.color = '#f59e0b';
        }
    }
    
    const job = allJobs2026.find(j => j.id === jobId);
    if (job) {
        item.onclick = () => selectJob(job.id, job.lat, job.lon);
    }
}

// ==========================================================================
// HELPERS SUPABASE UTILS
// ==========================================================================

async function getAppConfigKey(key) {
    try {
        const { data, error } = await window.supabase
            .from('app_config')
            .select('value')
            .eq('key', key)
            .maybeSingle();
            
        if (error) throw error;
        return data ? data.value : null;
    } catch (e) {
        console.error(`Errore getAppConfigKey(${key}):`, e);
        return null;
    }
}

async function saveAppConfigKey(key, value) {
    try {
        const { error } = await window.supabase
            .from('app_config')
            .upsert({ key, value });
            
        if (error) throw error;
        return true;
    } catch (e) {
        console.error(`Errore saveAppConfigKey(${key}):`, e);
        return false;
    }
}

// Gestione dell'elenco cantieri collassabile
window.toggleJobsList = function() {
    const listContainer = document.getElementById('mapJobsListContainer');
    const toggleIcon = document.getElementById('mapJobsListToggleIcon');
    if (listContainer && toggleIcon) {
        const isHidden = listContainer.classList.contains('hidden');
        if (isHidden) {
            listContainer.classList.remove('hidden');
            toggleIcon.classList.remove('fa-chevron-right');
            toggleIcon.classList.add('fa-chevron-down');
            // Aggiorna dimensioni mappa Leaflet in caso di ridimensionamento del contenitore
            if (leafletMap) {
                setTimeout(() => {
                    leafletMap.invalidateSize();
                }, 100);
            }
        } else {
            listContainer.classList.add('hidden');
            toggleIcon.classList.remove('fa-chevron-down');
            toggleIcon.classList.add('fa-chevron-right');
        }
    }
};

// Calcola e disegna i cerchi della densità di popolazione basati su comuni.json per le città in cui ci sono cantieri,
// e calcola gli indici di impatto e penetrazione per la tabella di riepilogo.
function updatePopulationDensityLayer(jobsList = allJobs2026) {
    if (!popDensityLayer) return;
    popDensityLayer.clearLayers();

    if (typeof COMUNI_DATA === 'undefined') {
        console.warn("[Mappa] COMUNI_DATA non definito. Impossibile calcolare densità.");
        return;
    }

    const uniqueCities = {};
    jobsList.forEach(job => {
        if (job.lat && job.lon && job.city) {
            const key = job.city.trim().toLowerCase();
            if (!uniqueCities[key]) {
                const match = COMUNI_DATA.find(c => c.nome.toLowerCase() === key);
                const pop = match ? match.popolazione : 0;
                
                // Cerca la provincia sigla
                let prov = match ? match.sigla : '';
                if (!prov) {
                    const provMatch = job.address.match(/\((.*?)\)/);
                    if (provMatch) prov = provMatch[1];
                }

                uniqueCities[key] = {
                    name: job.city.trim(),
                    lat: job.lat,
                    lon: job.lon,
                    population: pop,
                    province: prov,
                    jobsCount: 0,
                    revenue: 0
                };
            }
            uniqueCities[key].jobsCount++;
            uniqueCities[key].revenue += (parseFloat(job.amount) || 0);
        }
    });

    const cityMetrics = [];

    for (const key in uniqueCities) {
        const cityData = uniqueCities[key];
        const pop = cityData.population;
        if (pop > 0) {
            // Indice di penetrazione: cantieri ogni 10.000 abitanti
            cityData.penetration = (cityData.jobsCount / pop) * 10000;
            // Fatturato pro capite
            cityData.revenuePerCapita = cityData.revenue / pop;

            cityMetrics.push(cityData);

            // Raggio visivo in metri basato sulla popolazione
            const radius = Math.sqrt(pop) * 45; 

            // Colore del gradiente di densità (da giallo/arancio a rosso scuro)
            let color = '#ffffe5'; // < 5.000
            if (pop > 100000) color = '#800026';      // > 100k
            else if (pop > 50000) color = '#d12420';   // 50k - 100k
            else if (pop > 25000) color = '#f7682a';   // 25k - 50k
            else if (pop > 10000) color = '#ffad4a';   // 10k - 25k
            else if (pop > 5000) color = '#ffe391';    // 5k - 10k

            const circle = L.circle([cityData.lat, cityData.lon], {
                radius: radius,
                fillColor: color,
                fillOpacity: 0.35,
                color: color,
                weight: 1,
                opacity: 0.6,
                interactive: true
            });

            circle.bindPopup(`
                <div style="font-family: 'Outfit', sans-serif; font-size: 0.85rem; padding: 4px; min-width: 200px;">
                    <strong style="color: #2563eb; font-size: 0.95rem;">${cityData.name} (${cityData.province || 'N/D'})</strong><br>
                    <span style="color: #64748b; font-weight: 500;">Popolazione:</span> <strong>${pop.toLocaleString('it-IT')}</strong> abitanti<br>
                    <hr style="margin: 8px 0; border: none; border-top: 1px solid #e2e8f0;">
                    <strong style="color: #1e293b; display: block; margin-bottom: 4px;">Impatto Genesy 2026:</strong>
                    • Cantieri Attivi: <strong>${cityData.jobsCount}</strong><br>
                    • Importo Totale: <strong>€${cityData.revenue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><br>
                    • Penetrazione (x10k ab.): <strong style="color: #2563eb;">${cityData.penetration.toFixed(2)}</strong><br>
                    • Fatturato Pro Capite: <strong style="color: #16a34a;">€${cityData.revenuePerCapita.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
            `);

            circle.addTo(popDensityLayer);
        }
    }

    // Ordina le città per tasso di penetrazione decrescente
    cityMetrics.sort((a, b) => b.penetration - a.penetration);

    // Popola la tabella nel DOM
    const tableBody = document.getElementById('demographicImpactTableBody');
    if (tableBody) {
        if (cityMetrics.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">
                        Nessun cantiere georeferenziato disponibile per il calcolo demografico.
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = cityMetrics.map(city => `
                <tr style="border-bottom: 1px solid var(--border-color, #e2e8f0); color: var(--text-dark, #1e293b); transition: background-color 0.2s;">
                    <td style="padding: 10px; font-weight: 600;">${city.name}</td>
                    <td style="padding: 10px; color: var(--text-muted);">${city.province}</td>
                    <td style="padding: 10px; text-align: right;">${city.population.toLocaleString('it-IT')}</td>
                    <td style="padding: 10px; text-align: right; font-weight: bold;">${city.jobsCount}</td>
                    <td style="padding: 10px; text-align: right;">€${city.revenue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="padding: 10px; text-align: right; font-weight: bold; color: var(--primary-color, #2563eb);">${city.penetration.toFixed(2)}</td>
                    <td style="padding: 10px; text-align: right; font-weight: bold; color: #16a34a;">€${city.revenuePerCapita.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            `).join('');
        }
    }
}

// Calcola e popola la tabella delle statistiche di chiusura e preventivi per zona manageriale
function updateZoneAnalysisTable(jobsList = allJobs2026) {
    currentZoneAnalysisJobs = jobsList;
    const tableBody = document.getElementById('zoneAnalysisTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = "";

    const thOpen = document.getElementById('zoneHeaderOpen');
    const thClosed = document.getElementById('zoneHeaderClosed');
    const thLost = document.getElementById('zoneHeaderLost');
    const thTotal = document.getElementById('zoneHeaderTotal');

    const zoneGroups = {};

    jobsList.forEach(job => {
        let zoneName = (job.zone || '').trim().toUpperCase();
        if (zoneName) {
            zoneName = zoneName.replace(/Ì/g, 'I')
                               .replace(/[ÈÉ]/g, 'E')
                               .replace(/Ò/g, 'O')
                               .replace(/À/g, 'A')
                               .replace(/Ù/g, 'U');
        } else {
            zoneName = 'NON ASSEGNATA';
        }
        if (!zoneGroups[zoneName]) {
            zoneGroups[zoneName] = {
                name: zoneName,
                open: 0,
                closed: 0,
                lost: 0,
                total: 0
            };
        }
        
        const status = (job.statusDesc || '').toLowerCase();
        if (['chiuso', 'ordine confermato'].includes(status)) {
            zoneGroups[zoneName].closed++;
        } else if (['perso', 'rifiutato'].includes(status)) {
            zoneGroups[zoneName].lost++;
        } else {
            zoneGroups[zoneName].open++;
        }
        zoneGroups[zoneName].total++;
    });

    const zoneMetrics = Object.values(zoneGroups);
    
    // Ordina per totale preventivi (decrescente)
    zoneMetrics.sort((a, b) => b.total - a.total);

    if (zoneMetrics.length === 0) {
        if (thOpen) thOpen.textContent = "Aperti";
        if (thClosed) thClosed.textContent = "Chiusi";
        if (thLost) thLost.textContent = "Persi";
        if (thTotal) thTotal.textContent = "Totale";

        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">
                    Nessun dato disponibile per il 2026. Sincronizza la mappa.
                </td>
            </tr>
        `;
        return;
    }

    // Calcola i totali complessivi delle colonne per le intestazioni
    let totalOpen = 0;
    let totalClosed = 0;
    let totalLost = 0;
    let totalAll = 0;

    zoneMetrics.forEach(z => {
        totalOpen += z.open;
        totalClosed += z.closed;
        totalLost += z.lost;
        totalAll += z.total;
    });

    if (thOpen) thOpen.textContent = `Aperti (${totalOpen})`;
    if (thClosed) thClosed.textContent = `Chiusi (${totalClosed})`;
    if (thLost) thLost.textContent = `Persi (${totalLost})`;
    if (thTotal) thTotal.textContent = `Totale (${totalAll})`;

    tableBody.innerHTML = zoneMetrics.map(z => {
        const successRate = z.total > 0 ? (z.closed / z.total) * 100 : 0;
        const escZoneName = z.name.replace(/'/g, "\\'");
        return `
            <tr style="border-bottom: 1px solid var(--border-color, #e2e8f0); color: var(--text-dark, #1e293b);">
                <td style="padding: 10px; font-weight: 600;">
                    <a href="#" onclick="window.showZoneQuotesModal('${escZoneName}', event)" style="color: var(--primary-color, #2563eb); text-decoration: none; border-bottom: 1px dashed var(--primary-color, #2563eb); cursor: pointer;">
                        ${z.name}
                    </a>
                </td>
                <td style="padding: 10px; text-align: right; color: #2563eb; font-weight: bold;">${z.open}</td>
                <td style="padding: 10px; text-align: right; color: #16a34a; font-weight: bold;">${z.closed}</td>
                <td style="padding: 10px; text-align: right; color: #94a3b8; font-weight: bold;">${z.lost}</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">${z.total}</td>
                <td style="padding: 10px; text-align: right; font-weight: bold; color: ${successRate > 50 ? '#16a34a' : successRate > 25 ? '#ffad4a' : '#ef4444'}">
                    ${successRate.toFixed(1)}%
                </td>
            </tr>
        `;
    }).join('');
}

// Gestisce il cambio di visualizzazione della mappa (Standard vs Densità Popolazione)
window.changeMapType = function() {
    const filterEl = document.getElementById('mapTypeFilter');
    if (!filterEl || !leafletMap || !popDensityLayer) return;

    const val = filterEl.value;
    const densityLegend = document.getElementById('densityLegend');
    const demographicImpactCard = document.getElementById('demographicImpactCard');
    const zoneAnalysisCard = document.getElementById('zoneAnalysisCard');

    if (val === 'density') {
        // Nascondi la card delle zone, mostra quella demografica
        if (zoneAnalysisCard) zoneAnalysisCard.classList.add('hidden');
        if (demographicImpactCard) demographicImpactCard.classList.remove('hidden');

        // Aggiungi il layer di densità locale alla mappa
        if (!leafletMap.hasLayer(popDensityLayer)) {
            popDensityLayer.addTo(leafletMap);
        }
        // Mostra la legenda della densità
        if (densityLegend) {
            densityLegend.classList.remove('hidden');
        }
    } else {
        // Mostra la card delle zone, nascondi quella demografica
        if (zoneAnalysisCard) zoneAnalysisCard.classList.remove('hidden');
        if (demographicImpactCard) demographicImpactCard.classList.add('hidden');

        // Rimuovi il layer di densità
        if (leafletMap.hasLayer(popDensityLayer)) {
            leafletMap.removeLayer(popDensityLayer);
        }
        // Nascondi la legenda della densità
        if (densityLegend) {
            densityLegend.classList.add('hidden');
        }
    }

    // Rigenera i dati e la tabella in base ai filtri attuali
    if (typeof filterMapJobs === 'function') {
        filterMapJobs();
    }
};

window.showZoneQuotesModal = function(zoneName, event) {
    if (event) event.preventDefault();
    
    const modal = document.getElementById('zoneQuotesModal');
    const title = document.getElementById('zoneQuotesModalTitle');
    const searchInput = document.getElementById('zoneQuotesModalSearch');
    if (!modal) return;

    if (title) {
        title.innerHTML = `<i class="fa-solid fa-list-check" style="margin-right: 8px;"></i>Preventivi Zona: ${zoneName}`;
    }
    
    // Reset search input on open
    if (searchInput) searchInput.value = "";

    // Filtra i preventivi corrispondenti alla zona selezionata (dal subset corrente)
    currentModalJobs = currentZoneAnalysisJobs.filter(job => {
        let jobZone = (job.zone || '').trim().toUpperCase();
        if (jobZone) {
            jobZone = jobZone.replace(/Ì/g, 'I')
                             .replace(/[ÈÉ]/g, 'E')
                             .replace(/Ò/g, 'O')
                             .replace(/À/g, 'A')
                             .replace(/Ù/g, 'U');
        } else {
            jobZone = 'NON ASSEGNATA';
        }
        return jobZone === zoneName.trim().toUpperCase();
    });

    // Ordina per Cliente in ordine alfabetico di default
    currentModalJobs.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));

    // Renderizza tutti i preventivi filtrati
    renderModalQuotesTable(currentModalJobs);

    window.openModal('zoneQuotesModal');
};

// Funzione helper per renderizzare la tabella dei preventivi all'interno della modale
function renderModalQuotesTable(jobs) {
    const tableBody = document.getElementById('zoneQuotesModalTableBody');
    if (!tableBody) return;

    if (jobs.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">
                    Nessun preventivo trovato.
                </td>
            </tr>
        `;
    } else {
        tableBody.innerHTML = jobs.map(job => {
            const dateStr = new Date(job.docDate).toLocaleDateString('it-IT');
            const amountStr = parseFloat(job.amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const agentName = getAgentNameById(job.agentId);
            
            // Badge di stato con colori per matchare gli standard di Genesy
            let statusColor = '#94a3b8'; // default
            let statusBg = '#f1f5f9';
            const statusLower = (job.statusDesc || '').toLowerCase();
            if (['chiuso', 'ordine confermato'].includes(statusLower)) {
                statusColor = '#16a34a';
                statusBg = '#dcfce7';
            } else if (['perso', 'rifiutato'].includes(statusLower)) {
                statusColor = '#ef4444';
                statusBg = '#fee2e2';
            } else if (['aperto', 'in attesa', 'bozza', 'inviato'].includes(statusLower)) {
                statusColor = '#2563eb';
                statusBg = '#dbeafe';
            }

            return `
                <tr style="border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
                    <td style="padding: 10px 8px; font-weight: bold; color: #1e293b;">${job.docNumber}</td>
                    <td style="padding: 10px 8px; color: #475569;">${dateStr}</td>
                    <td style="padding: 10px 8px; font-weight: 500; color: #1e293b;">${job.companyName}</td>
                    <td style="padding: 10px 8px; color: #64748b;">${agentName}</td>
                    <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #1e293b;">€${amountStr}</td>
                    <td style="padding: 10px 8px; text-align: center;">
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; color: ${statusColor}; background-color: ${statusBg}; text-transform: capitalize;">
                            ${job.statusDesc}
                        </span>
                    </td>
                    <td style="padding: 10px 8px; text-align: center;">
                        <button onclick="window.openQuoteFromMap('${job.id}')" style="background-color: var(--primary-color, #2563eb); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.78rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; transition: background-color 0.2s;">
                            <i class="fa-solid fa-pen-to-square"></i> Apri in Genesy
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

window.filterModalQuotes = function(query) {
    const term = (query || '').toLowerCase().trim();
    if (!term) {
        renderModalQuotesTable(currentModalJobs);
        return;
    }

    const filtered = currentModalJobs.filter(job => {
        const docNumber = String(job.docNumber || '');
        const dateStr = new Date(job.docDate).toLocaleDateString('it-IT');
        const companyName = (job.companyName || '').toLowerCase();
        const agentName = getAgentNameById(job.agentId).toLowerCase();
        const amountStr = parseFloat(job.amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const statusDesc = (job.statusDesc || '').toLowerCase();

        return docNumber.includes(term) ||
               dateStr.includes(term) ||
               companyName.includes(term) ||
               agentName.includes(term) ||
               amountStr.includes(term) ||
               statusDesc.includes(term);
    });

    renderModalQuotesTable(filtered);
};

window.openQuoteFromMap = function(jobId) {
    window.closeModal('zoneQuotesModal');
    window.openEditor(jobId);
};
