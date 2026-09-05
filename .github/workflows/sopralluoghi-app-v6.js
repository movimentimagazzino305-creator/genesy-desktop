/**
 * Logica per l'app Sopralluoghi Parquet
 */

const SopralluogoApp = (function() {
    
    // Stato dell'applicazione
    const state = {
        clients: [],
        currentRecord: {},
        isRecording: false,
        recognitionTarget: null,
        recent: [],
        isGuidedMode: false,
        guidedIndex: -1,
        isTableDictation: false,
        editingId: null    // ID della scheda in modifica (null = nuova)
    };

    const guidedSteps = [
        { id: 'clientName', text: 'Nome o Ragione Sociale del cliente', step: 'step-client' },
        { id: 'clientCantiere', text: 'Nome Condominio o Cantiere di riferimento', step: 'step-client' },
        { id: 'clientUnita', text: 'Identificativo singola unità, come scala o interno', step: 'step-client' },
        { id: 'clientImpresa', text: 'Architetto, Geometra o Impresa associata', step: 'step-client' },
        { id: 'clientAddress', text: 'Indirizzo completo del cantiere', step: 'step-client' },
        { id: 'clientTelefono', text: 'Numero di telefono di riferimento', step: 'step-client' },
        { id: 'clientEmail', text: 'Email del Cliente', step: 'step-client' },
        { id: 'clientPosatore', text: 'Posatore assegnato a questo cantiere', step: 'step-client' },
        { id: 'clientTempi', text: 'Tempi e tempistiche previste per consegna e posa', step: 'step-client' },
        
        { id: 'techMateriale', text: 'Prodotto previsto, inclusi formati e battiscopa', step: 'step-tech' },
        { id: 'techPosa', text: 'Metodo e verso di posa', step: 'step-tech' },
        { id: 'techAccessori', text: 'Accessori necessari come regette, scivoli, giunti', step: 'step-tech' },
        { id: 'techSottofondo', text: 'Dettagli del massetto: se è nuovo, riscaldato o necessita di primer', step: 'step-tech' },
        { id: 'techPreesistente', text: 'Dettagli su pavimento preesistente e se serve grattare', step: 'step-tech' },
        { id: 'techUmidita', text: 'Rilievi di umidità e una descrizione generale del piano di posa', step: 'step-tech' },
        { id: 'techTaglioPorte', text: 'Eventuali lavorazioni extra come il taglio di porte e finestre', step: 'step-tech' },
        { id: 'techDaOrdinare', text: 'Quantità di materiale totale da ordinare', step: 'step-tech' },
        { id: 'techLavoriCliente', text: 'Lavori a carico del cliente prima della posa. Questo andrà nella mail.', step: 'step-tech' },
        { id: 'techNotePubbliche', text: 'Note aggiuntive per il cliente. Questo andrà nella mail.', step: 'step-tech' },
        { id: 'techNoteInterne', text: 'Note interne riservate al team. Non saranno inviate al cliente.', step: 'step-tech' }
    ];

    // Istanza di Speech Recognition
    let recognition = null;

    // --- Inizializzazione ---
    async function init() {
        showLoading(true);
        try {
            // Verifica sessione Supabase
            let user = null;
            if (window.supabase) {
                const { data } = await supabase.auth.getSession();
                user = data?.session?.user || null;
                
                if(!user) {
                    alert("Per accedere alle schede di cantiere devi fare il login nel CRM.");
                    window.location.href = 'index.html';
                    return;
                }

                // Carica direttamente i clienti in modo leggero e sicuro
                const { data: clientsData, error: clientsError } = await supabase
                    .from('clients')
                    .select('*')
                    .order('name');
                    
                if(clientsError) {
                    console.error("Errore fetch clienti:", clientsError);
                } else {
                    state.clients = clientsData || [];
                    populateClientSelect();
                    
                    try {
                        const { data: profiliData } = await supabase
                            .from('products')
                            .select('code, description')
                            .ilike('category', '%profil%')
                            .order('code');
                        if (profiliData && profiliData.length > 0) {
                            const container = document.getElementById('profiliCheckboxesContainer');
                            if (container) {
                                container.innerHTML = profiliData.map(p => {
                                    const val = `${p.description} (${p.code})`.replace(/"/g, '&quot;');
                                    return `<label style="display:block; font-size:13px; color:#334155; margin-bottom:4px; cursor:pointer;"><input type="checkbox" onchange="SopralluogoApp.toggleAccessorio(this)" value="${val}"> ${val}</label>`;
                                }).join('');
                            }
                        } else {
                            const container = document.getElementById('profiliCheckboxesContainer');
                            if (container) container.innerHTML = '<span style="color:#64748b;">Nessun profilo trovato.</span>';
                        }
                    } catch(err) { console.error('Errore fetch profili', err); }
                    
                    // Pre-seleziona cliente da URL se arrivato dal CRM
                    const urlParams = new URLSearchParams(window.location.search);
                    const defaultClient = urlParams.get('client_id');
                    if(defaultClient) {
                        const sel = document.getElementById('clientSelect');
                        if(sel.querySelector(`option[value="${defaultClient}"]`)) {
                            sel.value = defaultClient;
                            onClientSelect(defaultClient);
                        }
                    }
                }
            }
            
            initSpeechRecognition();
            attachMicListeners();
            checkSqlMigration();
            await loadRecent();
            attachDraftListeners();
            
            const urlParams2 = new URLSearchParams(window.location.search);
            const loadDocId = urlParams2.get('loaddoc');
            let loadedExternalDoc = false;
            
            if(loadDocId) {
                const doc = state.recent.find(d => d.id === loadDocId);
                if(doc) {
                    loadSchedaInForm(loadDocId);
                    loadedExternalDoc = true;
                } else {
                    try {
                        // fallback if not in the latest 15 returned by loadRecent
                        const {data} = await supabase.from('sopralluoghi').select('*').eq('id', loadDocId).single();
                        if(data) {
                            state.recent.push(data);
                            loadSchedaInForm(loadDocId);
                            loadedExternalDoc = true;
                        }
                    } catch(e) { console.warn('Documento non accessibile', e); }
                }
            }
            
            if(!loadedExternalDoc) {
                checkDraft();
                // Mostra il primo step in locale o nuova
                goToStep('step-start');
            }
            
        } catch (e) {
            console.error("Errore inizializzazione App:", e);
            alert("Errore di caricamento: " + e.message);
        } finally {
            showLoading(false);
        }
    }

    function checkSqlMigration() {
        // Controllo asincrono se la tabella sopralluoghi esiste silenziando errori nativi
        if(!window.supabase) return;
        supabase.from('sopralluoghi').select('id').limit(1).then(({error}) => {
            if(error && error.code === '42P01') {
                document.getElementById('sqlModal').style.display = 'flex';
            }
        });
    }

    // --- Sistema Autosalvataggio Bozza (localStorage) ---
    const DRAFT_KEY = 'sopralluoghi_bozza_v1';
    let _draftTimer = null;

    function saveDraft() {
        try {
            const draft = {
                ts: Date.now(),
                data: getFormData()
            };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
            // Aggiorna indicatore visivo
            const ind = document.getElementById('draftIndicator');
            if(ind) {
                const t = new Date().toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
                ind.innerHTML = `<i class="fa-solid fa-floppy-disk" style="color:#10b981;"></i> Bozza salvata alle ${t}`;
                ind.style.opacity = '1';
                setTimeout(() => { if(ind) ind.style.opacity = '0.5'; }, 3000);
            }
        } catch(e) {
            console.error('[Bozza] Errore salvataggio:', e);
        }
    }

    function scheduleDraft() {
        clearTimeout(_draftTimer);
        _draftTimer = setTimeout(saveDraft, 1500);
    }

    function clearDraft() {
        localStorage.removeItem(DRAFT_KEY);
        const ind = document.getElementById('draftIndicator');
        if(ind) ind.style.display = 'none';
    }

    function attachDraftListeners() {
        // Ascolta input E change (per select e checkbox)
        const triggerDraft = (e) => {
            const tag = e.target.tagName;
            if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') scheduleDraft();
        };
        document.addEventListener('input', triggerDraft);
        document.addEventListener('change', triggerDraft);
        
        // Crea l'indicatore visivo fisso in basso a destra
        const ind = document.createElement('div');
        ind.id = 'draftIndicator';
        ind.style.cssText = 'position:fixed; bottom:12px; right:12px; background:rgba(15,23,42,0.85); color:#fff; font-size:12px; padding:6px 12px; border-radius:20px; z-index:8888; opacity:0.5; transition:opacity 0.4s; pointer-events:none; backdrop-filter:blur(4px);';
        ind.innerHTML = '';
        document.body.appendChild(ind);
    }

    function checkDraft() {
        let raw;
        try { raw = localStorage.getItem(DRAFT_KEY); } catch(e) { return; }
        if(!raw) return;
        
        let draft;
        try { draft = JSON.parse(raw); } catch(e) { localStorage.removeItem(DRAFT_KEY); return; }
        if(!draft?.data) return;
        
        // Controlla che la bozza abbia qualcosa di utile
        const d = draft.data;
        const hasData = d.clientName || d.clientAddress || d.techMateriale || d.techPosa ||
                        d.clientCantiere || d.techSottofondo ||
                        (d.techStanzeTable && d.techStanzeTable.length > 0) ||
                        (d.techScaleTable && d.techScaleTable.length > 0);
        if(!hasData) return;
        
        const age = Date.now() - (draft.ts || 0);
        const ageMin = Math.round(age / 60000);
        const ageStr = ageMin < 1 ? 'pochi secondi fa' : ageMin < 60 ? `${ageMin} min fa` : `${Math.round(ageMin/60)} ore fa`;
        const dataStr = new Date(draft.ts).toLocaleString('it-IT', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
        const nomeStr = d.clientName ? `di "${d.clientName}"` : '';
        
        // Mostra banner di ripristino
        const banner = document.createElement('div');
        banner.id = 'draftRestoreBanner';
        banner.style.cssText = 'position:fixed; top:0; left:0; right:0; background:#1e293b; color:#fff; padding:12px 16px; z-index:10000; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; box-shadow:0 2px 10px rgba(0,0,0,0.3); font-size:14px;';
        banner.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-solid fa-rotate-left" style="color:#f59e0b; font-size:18px;"></i>
                <span><strong>Bozza trovata</strong> ${nomeStr} salvata il ${dataStr} (${ageStr})</span>
            </div>
            <div style="display:flex; gap:8px; flex-shrink:0;">
                <button id="btnRestoreDraft" style="background:#10b981; color:#fff; border:none; padding:7px 14px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px;">
                    <i class="fa-solid fa-rotate-left"></i> Ripristina
                </button>
                <button id="btnDiscardDraft" style="background:#64748b; color:#fff; border:none; padding:7px 14px; border-radius:6px; cursor:pointer; font-size:13px;">
                    Ignora
                </button>
            </div>`;
        document.body.prepend(banner);
        
        document.getElementById('btnRestoreDraft').addEventListener('click', () => {
            restoreDraft(draft.data);
            banner.remove();
        });
        document.getElementById('btnDiscardDraft').addEventListener('click', () => {
            clearDraft();
            banner.remove();
        });
    }

    function restoreDraft(d) {
        const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
        setVal('clientName',     d.clientName);
        setVal('clientCantiere', d.clientCantiere);
        setVal('clientUnita',    d.clientUnita);
        setVal('clientImpresa',  d.clientImpresa);
        setVal('clientAddress',  d.clientAddress);
        setVal('clientTelefono', d.clientTelefono);
        setVal('clientEmail',    d.clientEmail);
        setVal('clientPosatore', d.clientPosatore);
        setVal('clientTempi',    d.clientTempi);
        setVal('techMateriale',  d.techMateriale);
        // Ripristina widget posa (con catch per non bloccare il resto)
        try {
            if(d.techPosaData) {
                restorePosaWidget(d.techPosaData);
            } else if(d.techPosa) {
                setVal('techPosa', d.techPosa);
            }
        } catch(posaErr) {
            console.warn('[Bozza] Errore ripristino posa:', posaErr);
            setVal('techPosa', d.techPosa || '');
        }
        if(d.techPosaData?.note) setVal('techPosaNote', d.techPosaData.note);
        setVal('techAccessori',  d.techAccessori);
        setVal('techSottofondo', d.techSottofondo);
        setVal('techPreesistente', d.techPreesistente);
        setVal('techUmidita',    d.techUmidita);
        setVal('techTaglioPorte', d.techTaglioPorte);
        setVal('techDaOrdinare', d.techDaOrdinare);
        setVal('techLavoriCliente', d.techLavoriCliente);
        setVal('techNotePubbliche', d.techNotePubbliche);
        setVal('techNoteInterne', d.techNoteInterne);
        
        // Ripristina tabella stanze
        const roomsTbody = document.getElementById('roomsTableBody');
        if(roomsTbody && d.techStanzeTable && Array.isArray(d.techStanzeTable)) {
            roomsTbody.innerHTML = '';
            d.techStanzeTable.forEach(r => addRoomRow(r.stanza || '', r.lung || '', r.larg || '', r.mq || '', r.ml || ''));
            calcTableTotals();
        }
        
        // Ripristina tabella scale
        const stairsTbody = document.getElementById('stairsTableBody');
        if(stairsTbody && d.techScaleTable && Array.isArray(d.techScaleTable)) {
            stairsTbody.innerHTML = '';
            d.techScaleTable.forEach(s => {
                addStairRow(
                    s.tipo, s.qta, s.larg, s.pedata, s.alzata,
                    s.alzMq !== false, s.lati, s.latiAlz,
                    s.tori, s.mqcad, s.mqtot, s.mlbatti, s.mltori,
                    s.exactUnitBatti, s.exactUnitTori, s.toriArrStr, s.shapeEdgesJson
                );
            });
            calcStairsTotals();
        }
        
        // Naviga al primo step
        goToStep('step-client');
        window.scrollTo(0, 0);
        
        // Aggiorna indicatore
        const ind = document.getElementById('draftIndicator');
        if(ind) {
            ind.style.display = '';
            ind.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#10b981;"></i> Bozza ripristinata';
            ind.style.opacity = '1';
            setTimeout(() => { if(ind) ind.style.opacity = '0.5'; }, 4000);
        }
    }

    // --- Widget Metodo e Verso di Posa ---

    function syncPosaField() {
        const parts = [];
        
        // Leggi tutte le checkbox spuntate e i relativi dettagli
        document.querySelectorAll('.posa-chk').forEach(chk => {
            const row = chk.closest('.posa-row');
            if(chk.checked) {
                row.classList.add('active');
                const label = chk.dataset.label || '';
                const detail = row.querySelector('.posa-detail')?.value?.trim() || '';
                parts.push(detail ? `${label}: ${detail}` : label);
            } else {
                row.classList.remove('active');
            }
        });
        
        // Aggiungi note libere
        const noteEl = document.getElementById('techPosaNote');
        if(noteEl && noteEl.value.trim()) parts.push(noteEl.value.trim());
        
        // Aggiorna la textarea nascosta
        const techPosa = document.getElementById('techPosa');
        if(techPosa) techPosa.value = parts.join(' | ');
        
        // Aggiorna l'anteprima
        const preview = document.getElementById('posaPreview');
        if(preview) {
            if(parts.length > 0) {
                preview.style.display = 'block';
                preview.textContent = 'âœï¸ ' + parts.join(' | ');
            } else {
                preview.style.display = 'none';
            }
        }
    }
    
    function getPosaData() {
        const items = [];
        document.querySelectorAll('.posa-chk').forEach(chk => {
            const row = chk.closest('.posa-row');
            items.push({
                label: chk.dataset.label,
                checked: chk.checked,
                detail: row.querySelector('.posa-detail')?.value?.trim() || ''
            });
        });
        return {
            items,
            note: document.getElementById('techPosaNote')?.value?.trim() || ''
        };
    }
    
    function restorePosaWidget(posaDat) {
        if(!posaDat) return;
        // Ripristina da struttura JSON
        if(posaDat.items && Array.isArray(posaDat.items)) {
            document.querySelectorAll('.posa-chk').forEach(chk => {
                const found = posaDat.items.find(i => i.label === chk.dataset.label);
                if(found) {
                    chk.checked = found.checked;
                    const row = chk.closest('.posa-row');
                    const detEl = row.querySelector('.posa-detail');
                    if(detEl) detEl.value = found.detail || '';
                    if(found.checked) row.classList.add('active');
                    else row.classList.remove('active');
                }
            });
        }
        const noteEl = document.getElementById('techPosaNote');
        if(noteEl && posaDat.note) noteEl.value = posaDat.note;
        syncPosaField();
    }

    async function loadRecent() {
        if(!window.supabase) return;
        
        let userId = window.crmData?.user?.id;
        if (!userId) {
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                userId = sessionData?.session?.user?.id || null;
            } catch(e) { /* silenzio */ }
        }
        if(!userId) return;

        const {data, error} = await supabase
            .from('sopralluoghi')
            .select('id, client_name, client_address, created_at, full_data_json')
            .eq('created_by', userId)
            .order('created_at', {ascending: false})
            .limit(50);
            
        if(error || !data || data.length === 0) return;
        state.recent = data;
        renderRecentList(data);
    }

    function renderRecentList(data) {
        const list = document.getElementById('recentSopralluoghiList');
        list.innerHTML = '';
        if (!data || data.length === 0) {
            list.innerHTML = '<li class="empty-state">Nessuna scheda di cantiere salvata.</li>';
            return;
        }
        data.forEach((s, idx) => {
            const date = new Date(s.created_at).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' });
            const extractedNum = (s.full_data_json && s.full_data_json.schedaNumber) || '';
            const numBadge = extractedNum
                ? `<span style="background:#0f172a; color:#fff; font-size:10px; font-weight:700; padding:2px 7px; border-radius:20px; letter-spacing:0.05em; flex-shrink:0;">${extractedNum}</span>`
                : '';
            const li = document.createElement('li');
            li.dataset.searchText = ((s.client_name || '') + ' ' + (s.client_address || '')).toLowerCase();
            li.style.cssText = 'padding:12px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; gap:8px;';
            li.innerHTML = `
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                        ${numBadge}
                        <div style="font-weight:600; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.client_name || '(senza nome)'}</div>
                    </div>
                    <div style="font-size:12px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.client_address || ''}</div>
                    <div style="font-size:11px; color:#94a3b8; margin-top:2px;"><i class="fa-regular fa-calendar"></i> ${date}</div>
                </div>
                <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button type="button" onclick="SopralluogoApp.loadSchedaInForm('${s.id}')" style="background:#10b981; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px; white-space:nowrap;" title="Carica nel form per modificare">
                        <i class="fa-solid fa-pen-to-square"></i> Modifica
                    </button>
                    <button type="button" onclick="SopralluogoApp.reopenRecentPdf('${s.id}')" style="background:#3b82f6; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px; white-space:nowrap;" title="Riapri PDF">
                        <i class="fa-solid fa-file-pdf"></i> PDF
                    </button>
                    <button type="button" onclick="SopralluogoApp.deleteScheda('${s.id}', '${(s.client_name||'').replace(/'/g,'')}', this)" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px; white-space:nowrap;" title="Elimina scheda">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>`;
            list.appendChild(li);
        });
    }

    function filterRecenti(query) {
        const q = (query || '').toLowerCase().trim();
        const list = document.getElementById('recentSopralluoghiList');
        if (!list) return;
        let visibleCount = 0;
        list.querySelectorAll('li:not(.empty-state)').forEach(li => {
            const match = !q || (li.dataset.searchText || '').includes(q);
            li.style.display = match ? '' : 'none';
            if (match) visibleCount++;
        });
        // Mostra/nascondi messaggio vuoto
        let emptyLi = list.querySelector('.empty-state');
        if (visibleCount === 0) {
            if (!emptyLi) {
                emptyLi = document.createElement('li');
                emptyLi.className = 'empty-state';
                list.appendChild(emptyLi);
            }
            emptyLi.textContent = q ? `Nessun risultato per "${query}"` : 'Nessuna scheda di cantiere salvata.';
            emptyLi.style.display = '';
        } else if (emptyLi) {
            emptyLi.style.display = 'none';
        }
    }
    
        
    
    async function loadSchedaInForm(sopralluogoId) {
        if(!window.supabase || !sopralluogoId) return;
        
        // Recupera la scheda dal DB
        const {data, error} = await supabase
            .from('sopralluoghi')
            .select('full_data_json, id')
            .eq('id', sopralluogoId)
            .single();
        
        if(error || !data?.full_data_json) {
            alert('Impossibile recuperare i dati della scheda. Forse full_data_json non è stato salvato.');
            return;
        }
        
        const d = data.full_data_json;
        
        if(!confirm(`Vuoi caricare la scheda di "${d.clientName || 'questo cantiere'}" per modificarla?\nI dati attuali nel form verranno sostituiti.`)) return;
        
        // Memorizza l'ID della scheda che stiamo modificando
        state.editingId = sopralluogoId;
        
        // --- Ripopola campi testuali ---
        const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
        setVal('clientName',    d.clientName);
        setVal('clientCantiere', d.clientCantiere);
        setVal('clientUnita',   d.clientUnita);
        setVal('clientImpresa', d.clientImpresa);
        setVal('clientAddress', d.clientAddress);
        setVal('clientTelefono', d.clientTelefono);
        setVal('clientEmail',   d.clientEmail);
        setVal('clientPosatore', d.clientPosatore);
        setVal('clientTempi',   d.clientTempi);
        setVal('techMateriale', d.techMateriale);
        // Ripristina widget posa strutturato (se disponibile) o fallback su testo
        if(d.techPosaData) { restorePosaWidget(d.techPosaData); }
        else { setVal('techPosa', d.techPosa); }
        setVal('techAccessori', d.techAccessori);
        setVal('techSottofondo', d.techSottofondo);
        setVal('techPreesistente', d.techPreesistente);
        setVal('techUmidita',   d.techUmidita);
        setVal('techTaglioPorte', d.techTaglioPorte);
        setVal('techDaOrdinare', d.techDaOrdinare);
        setVal('techLavoriCliente', d.techLavoriCliente);
        setVal('techNotePubbliche', d.techNotePubbliche);
        setVal('techNoteInterne', d.techNoteInterne);
        
        // --- Ripopola tabella stanze ---
        const roomsTbody = document.getElementById('roomsTableBody');
        if(roomsTbody) {
            roomsTbody.innerHTML = '';
            if(d.techStanzeTable && Array.isArray(d.techStanzeTable)) {
                d.techStanzeTable.forEach(r => addRoomRow(r.stanza || '', r.lung || '', r.larg || '', r.mq || '', r.ml || ''));
            }
            calcTableTotals();
        }
        
        // --- Ripopola tabella scale ---
        const stairsTbody = document.getElementById('stairsTableBody');
        if(stairsTbody) {
            stairsTbody.innerHTML = '';
            if(d.techScaleTable && Array.isArray(d.techScaleTable)) {
                d.techScaleTable.forEach(s => {
                    addStairRow(
                        s.tipo, s.qta, s.larg, s.pedata, s.alzata,
                        s.alzMq !== false,
                        s.lati, s.latiAlz,
                        s.tori, s.mqcad, s.mqtot, s.mlbatti, s.mltori,
                        s.exactUnitBatti, s.exactUnitTori, s.toriArrStr, s.shapeEdgesJson
                    );
                });
            }
            calcStairsTotals();
        }
        
        // Naviga al primo step del form
        goToStep('step-client');
        window.scrollTo(0, 0);
        
        // Mostra banner di modifica
        let banner = document.getElementById('editModeBanner');
        if(!banner) {
            banner = document.createElement('div');
            banner.id = 'editModeBanner';
            banner.style.cssText = 'position:fixed; bottom:0; left:0; right:0; background:#f59e0b; color:#fff; font-weight:bold; text-align:center; padding:10px 15px; z-index:9999; font-size:14px; display:flex; align-items:center; justify-content:center; gap:12px; box-shadow:0 -2px 8px rgba(0,0,0,0.2);';
            banner.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Stai modificando una scheda esistente. Salva per aggiornare. <button onclick="SopralluogoApp.cancelEditMode()" style="background:rgba(0,0,0,0.2); border:none; color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:13px;">Annulla Modifica</button>`;
            document.body.appendChild(banner);
        }
    }
    
    function cancelEditMode() {
        state.editingId = null;
        const banner = document.getElementById('editModeBanner');
        if(banner) banner.remove();
        goToStep('step-start');
    }
    
    async function reopenRecentPdf(sopralluogoId) {
        if(!window.supabase || !sopralluogoId) return;
        const {data, error} = await supabase
            .from('sopralluoghi')
            .select('full_data_json')
            .eq('id', sopralluogoId)
            .single();
        if(error || !data?.full_data_json) {
            alert('Impossibile recuperare i dati della scheda.');
            return;
        }
        const reportWin = window.open('', '_blank');
        if(reportWin) {
            buildPdfPreview(data.full_data_json, reportWin);
        } else {
            alert('Il browser ha bloccato il popup. Autorizza i popup per questo sito.');
        }
    }
    
    async function deleteScheda(sopralluogoId, clientName, btnEl) {
        if(!window.supabase || !sopralluogoId) return;
        
        const nome = clientName || 'questa scheda';
        if(!confirm(`Sei sicuro di voler eliminare la scheda di "${nome}"?\nL'operazione è irreversibile.`)) return;
        
        // Feedback visivo immediato
        const li = btnEl ? btnEl.closest('li') : null;
        if(li) {
            li.style.opacity = '0.4';
            li.style.pointerEvents = 'none';
        }
        
        const { error } = await supabase
            .from('sopralluoghi')
            .delete()
            .eq('id', sopralluogoId);
        
        if(error) {
            console.error('Errore eliminazione scheda:', error);
            alert('Errore durante l\'eliminazione. Riprova.');
            if(li) { li.style.opacity = '1'; li.style.pointerEvents = ''; }
            return;
        }
        
        // Rimuovi visualmente dalla lista con animazione
        if(li) {
            li.style.transition = 'max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease';
            li.style.maxHeight = li.offsetHeight + 'px';
            requestAnimationFrame(() => {
                li.style.maxHeight = '0';
                li.style.opacity = '0';
                li.style.padding = '0';
                li.style.overflow = 'hidden';
                setTimeout(() => {
                    li.remove();
                    // Se la lista è vuota, mostra messaggio
                    const list = document.getElementById('recentSopralluoghiList');
                    if(list && list.children.length === 0) {
                        list.innerHTML = '<li class="empty-state">Nessuna scheda di cantiere salvata.</li>';
                    }
                }, 320);
            });
        }
        
        // Aggiorna anche lo state locale
        state.recent = state.recent.filter(s => s.id !== sopralluogoId);
    }

    // --- Gestione Clienti ---
    function populateClientSelect() {
        const select = document.getElementById('clientSelect');
        const sorted = [...state.clients].sort((a,b) => a.name.localeCompare(b.name));
        
        // Mantieni la prima opzione intatta
        let html = '<option value="">-- Seleziona o crea nuovo --</option>';
        sorted.forEach(c => {
            html += `<option value="${c.id}">${c.name}</option>`;
        });
        select.innerHTML = html;
    }

    async function onClientSelect(clientId) {
        if(!clientId) {
            // Reset campi solo se selezione vuota
            document.getElementById('clientName').value = '';
            document.getElementById('clientAddress').value = '';
            document.getElementById('clientEmail').value = '';
            document.getElementById('techMateriale').value = '';
            return;
        }
        
        const client = state.clients.find(c => c.id == clientId);
        if(client) {
            let fullName = [client.name, client.surname].filter(Boolean).join(' ');
            document.getElementById('clientName').value = fullName || '';
            
            let addressParts = [
                client.siteAddress || client.addressProvince || client.address,
                client.city || client.citta,
                client.province || client.provincia
            ].filter(Boolean);
            document.getElementById('clientAddress').value = addressParts.join(', ') || '';
            
            document.getElementById('clientEmail').value = client.email || client.pec || '';
            
            // Auto-filtra materiale da preventivi storici
            const matEl = document.getElementById('techMateriale');
            matEl.value = 'Ricerca nel CRM in corso...';
            try {
                if(!window.supabase) throw new Error("Supabase non disponibile");
                
                const { data, error } = await supabase
                    .from('quotes')
                    .select('client_id, customer_snapshot_json, items_json')
                    .order('date', {ascending: false})
                    .limit(150); // Scarica i più recenti e filtra in JS (più sicuro in caso di colonne non JSONB)
                
                if (error) {
                    matEl.value = 'Errore DB: ' + error.message;
                    return;
                }
                
                // Filtra in JS come fa crm-core.js
                const clientQuotes = (data || []).filter(q => {
                    if (q.client_id === clientId) return true;
                    try {
                        let cust = q.customer_snapshot_json;
                        if (typeof cust === 'string') cust = JSON.parse(cust);
                        if (cust && cust.id === clientId) return true;
                    } catch(e) {}
                    return false;
                });
                
                    
                if (error) {
                    matEl.value = 'Errore DB: ' + error.message;
                    return;
                }
                
                if(clientQuotes && clientQuotes.length > 0) {
                    // Prendi il preventivo più recente
                    const latestQuote = clientQuotes[0];
                    let itemsArray = latestQuote.items_json;
                    
                    if (typeof itemsArray === 'string') {
                        try { itemsArray = JSON.parse(itemsArray); }
                        catch(e) { itemsArray = []; }
                    }

                    if (itemsArray && Array.isArray(itemsArray)) {
                        // Estrai le descrizioni dei prodotti (ignorando eventuali righe vuote o sconti)
                        const productNames = itemsArray
                            .filter(item => item.description && item.description.trim() !== '')
                            .map(item => item.description.trim());
                            
                        if (productNames.length > 0) {
                            matEl.value = productNames.join('\n');
                        } else {
                            matEl.value = 'Il preventivo non contiene articoli.';
                        }
                    } else {
                        matEl.value = 'Preventivo trovato, ma senza dettagli.';
                    }
                } else {
                    matEl.value = 'Nessun preventivo trovato per questo cliente.';
                }
            } catch(e) {
                console.error("Errore preventivi:", e);
                matEl.value = 'Errore interno CRM: ' + e.message;
            }
        }
    }

    function goToStep(stepId) {
        if (stepId === 'step-client' || stepId === 'step-tech' || stepId === 'step-review') {
            stepId = 'step-form';
        }
        // Nascondi tutti
        document.querySelectorAll('.step-container').forEach(el => el.style.display = 'none');
        // Mostra il target
        const target = document.getElementById(stepId);
        if(target) target.style.display = 'block';
        
        if (stepId === 'step-tech' && typeof update3DStairs === 'function') {
            setTimeout(update3DStairs, 100);
        }
        
        window.scrollTo(0,0);
    }

    // --- Speech Recognition ---
    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Il tuo browser non supporta la dettatura vocale. Ti consigliamo Chrome, Edge o Safari.");
            const mics = document.querySelectorAll('.btn-mic');
            mics.forEach(m => m.style.display = 'none');
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = 'it-IT';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        // Permette la dettatura continua senza staccare
        recognition.continuous = true; 

        recognition.onstart = function() {
            state.isRecording = true;
            document.getElementById('voiceFeedback').style.display = 'flex';
            if(state.recognitionTarget) {
                const btn = document.querySelector(`.btn-mic[data-target="${state.recognitionTarget.id}"]`);
                if(btn) btn.classList.add('recording');
            }
        };

        recognition.onresult = function(event) {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            
            if(state.isTableDictation && finalTranscript.trim() !== '') {
                stopRecording();
                parseTableDictation(finalTranscript);
                return;
            }

            if(state.recognitionTarget && finalTranscript.trim() !== '') {
                const text = finalTranscript.trim().toLowerCase();
                
                if (state.isGuidedMode) {
                    if (text === 'stop' || text === 'basta' || text === 'ferma' || text === 'fermati' || text === 'annulla') {
                        stopGuidedMode();
                        return;
                    }
                    
                    const magicRegex = /(?:\bavanti\b|\bprossim[oa]\b|\bsuccessivo\b)$/i;
                    if (magicRegex.test(finalTranscript)) {
                        let cleanText = finalTranscript.replace(magicRegex, '').trim();
                        if (cleanText) {
                             cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
                             const currentVal = state.recognitionTarget.value;
                             state.recognitionTarget.value = currentVal.trim() ? currentVal.trim() + ' ' + cleanText : cleanText;
                        }
                        
                        stopRecording();
                        setTimeout(() => {
                            state.guidedIndex++;
                            advanceGuidedMode();
                        }, 500);
                        return;
                    }
                }

                const currentVal = state.recognitionTarget.value;
                const formatted = finalTranscript.trim().charAt(0).toUpperCase() + finalTranscript.trim().slice(1);
                if(currentVal.trim().length > 0) {
                    state.recognitionTarget.value = currentVal + ' ' + formatted;
                } else {
                    state.recognitionTarget.value = formatted;
                }
            }
        };

        recognition.onerror = function(event) {
            console.error("Speech error", event.error);
            if (event.error === 'not-allowed') {
                alert("Permesso microfono negato. Autorizza l'uso del microfono nelle impostazioni del browser.");
            }
        };

        recognition.onend = function() {
            // Se fermato manualmente, resetta. Altrimenti riparte se era continuo
            if(state.isRecording) {
                 state.isRecording = false;
                 document.getElementById('voiceFeedback').style.display = 'none';
                 document.querySelectorAll('.btn-mic').forEach(b => b.classList.remove('recording'));
                 
                 if (state.isGuidedMode) {
                     // Riavvio automatico se si ferma per silenzio (browser timeout)
                     try { recognition.start(); } catch(e) {}
                 }
            }
        };

        // Bottone STOP manuale dal feedback
        document.getElementById('btnStopMic').addEventListener('click', () => {
             stopRecording();
        });
    }

    function stopRecording() {
        if(recognition && state.isRecording) {
            state.isRecording = false;
            state.isTableDictation = false;
            recognition.stop();
            document.getElementById('voiceFeedback').style.display = 'none';
            document.querySelectorAll('.btn-mic, .btn-primary').forEach(b => b.classList.remove('recording'));
        }
    }

    function attachMicListeners() {
        document.querySelectorAll('.btn-mic').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('data-target');
                const targetInput = document.getElementById(targetId);
                
                if(state.isRecording) {
                    stopRecording();
                    return;
                }

                state.recognitionTarget = targetInput;
                targetInput.focus();
                
                try {
                    recognition.start();
                } catch(ex) {
                    // Start ignorato se già avviato
                    console.log("Recognition error start", ex);
                }
            });
        });
    }

    // --- Guided Voice Mode ---
    function startGuidedVoice() {
        state.isGuidedMode = true;
        state.guidedIndex = 0;
        advanceGuidedMode();
    }

    function advanceGuidedMode() {
        if (!state.isGuidedMode) return;
        
        while (state.guidedIndex < guidedSteps.length) {
            const field = document.getElementById(guidedSteps[state.guidedIndex].id);
            if (!field.value.trim()) {
                break;
            }
            state.guidedIndex++;
        }

        if (state.guidedIndex >= guidedSteps.length) {
            state.isGuidedMode = false;
            speakText("Compilazione terminata. Controlla il riepilogo.");
            generateReview();
            return;
        }

        const stepObj = guidedSteps[state.guidedIndex];
        goToStep(stepObj.step);
        
        // Timeout per far renderizzare la UI
        setTimeout(() => {
            speakText(stepObj.text, () => {
                const targetInput = document.getElementById(stepObj.id);
                state.recognitionTarget = targetInput;
                targetInput.focus();
                try {
                    recognition.start();
                } catch(e) {}
            });
        }, 500);
    }

    function stopGuidedMode() {
        state.isGuidedMode = false;
        speakText("Compilazione guidata interrotta.");
        stopRecording();
    }

    // --- Generazione Report ed Estrazione ---
    
    // calculateTotals rimosso perché si usa solo la tabella analitica

    // --- Tabella Misure Analitiche ---
    function addRoomRow(stanza = '', lung = '', larg = '', mq = '', ml = '') {
        const tbody = document.getElementById('roomsTableBody');
        const tr = document.createElement('tr');
        
        // Estrai nome base (tolgo eventuale dettaglio in parentesi per compatibilità vecchi dati)
        let sBase = stanza;
        const match = stanza.match(/^(.*?)\s*\(.*?\)$/);
        if (match) sBase = match[1].trim();

        const knownRooms = ['Soggiorno','Cucina','Cucinotto','Ingresso','Disimpegno','Corridoio','Bagno','Bagno 2','Bagno padronale','Camera Singola','Camera Doppia','Camera Matrimoniale','Studio','Ripostiglio','Lavanderia','Taverna','Cantina','Garage','Esterno/Terrazzo','Scala'];

        tr.innerHTML = `
            <td style="padding: 4px; border: 1px solid #e2e8f0;">
                <select class="tbl-stanza-base" style="width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:3px; padding:4px; font-size:0.95em;" onchange="if(this.value==='Altro...'){let p=prompt('Inserisci il nome della stanza:'); if(p){let opt=document.createElement('option');opt.value=p;opt.text=p;opt.selected=true;this.add(opt,this.options[this.options.length-1]);}else{this.selectedIndex=0;}} SopralluogoApp.calcTableTotals();">
                    <option value="">-- Seleziona --</option>
                    <option value="Soggiorno" ${sBase === 'Soggiorno' ? 'selected' : ''}>Soggiorno</option>
                    <option value="Cucina" ${sBase === 'Cucina' ? 'selected' : ''}>Cucina</option>
                    <option value="Cucinotto" ${sBase === 'Cucinotto' ? 'selected' : ''}>Cucinotto</option>
                    <option value="Ingresso" ${sBase === 'Ingresso' ? 'selected' : ''}>Ingresso</option>
                    <option value="Disimpegno" ${sBase === 'Disimpegno' ? 'selected' : ''}>Disimpegno</option>
                    <option value="Corridoio" ${sBase === 'Corridoio' ? 'selected' : ''}>Corridoio</option>
                    <option value="Bagno" ${sBase === 'Bagno' ? 'selected' : ''}>Bagno</option>
                    <option value="Bagno 2" ${sBase === 'Bagno 2' ? 'selected' : ''}>Bagno 2</option>
                    <option value="Bagno padronale" ${sBase === 'Bagno padronale' ? 'selected' : ''}>Bagno padronale</option>
                    <option value="Camera Singola" ${sBase === 'Camera Singola' ? 'selected' : ''}>Camera Singola</option>
                    <option value="Camera Doppia" ${sBase === 'Camera Doppia' ? 'selected' : ''}>Camera Doppia</option>
                    <option value="Camera Matrimoniale" ${sBase === 'Camera Matrimoniale' ? 'selected' : ''}>Camera Matrimoniale</option>
                    <option value="Studio" ${sBase === 'Studio' ? 'selected' : ''}>Studio</option>
                    <option value="Ripostiglio" ${sBase === 'Ripostiglio' ? 'selected' : ''}>Ripostiglio</option>
                    <option value="Lavanderia" ${sBase === 'Lavanderia' ? 'selected' : ''}>Lavanderia</option>
                    <option value="Taverna" ${sBase === 'Taverna' ? 'selected' : ''}>Taverna</option>
                    <option value="Cantina" ${sBase === 'Cantina' ? 'selected' : ''}>Cantina</option>
                    <option value="Garage" ${sBase === 'Garage' ? 'selected' : ''}>Garage</option>
                    <option value="Esterno/Terrazzo" ${sBase === 'Esterno/Terrazzo' ? 'selected' : ''}>Esterno / Terrazzo</option>
                    <option value="Scala" ${sBase === 'Scala' ? 'selected' : ''}>Scala</option>
                    ${sBase && !knownRooms.includes(sBase) ? `<option value="${sBase}" selected>${sBase}</option>` : ''}
                    <option value="Altro...">Altro / Scrivi tu...</option>
                </select>
            </td>
            <td style="padding: 6px; border: 1px solid #e2e8f0;"><input type="number" step="0.01" style="width:100%; box-sizing:border-box; border:1.5px solid #cbd5e1; border-radius:6px; padding:10px 8px; font-size:16px; font-weight:600; color:#0f172a; height:44px; text-align:center;" class="tbl-lung" value="${lung}" oninput="SopralluogoApp.calcRoomRow(this)"></td>
            <td style="padding: 6px; border: 1px solid #e2e8f0;"><input type="number" step="0.01" style="width:100%; box-sizing:border-box; border:1.5px solid #cbd5e1; border-radius:6px; padding:10px 8px; font-size:16px; font-weight:600; color:#0f172a; height:44px; text-align:center;" class="tbl-larg" value="${larg}" oninput="SopralluogoApp.calcRoomRow(this)"></td>
            <td style="padding: 6px; border: 1px solid #e2e8f0;"><input type="number" step="0.01" style="width:100%; box-sizing:border-box; border:1.5px solid #3b82f6; border-radius:6px; padding:10px 8px; font-size:16px; font-weight:700; color:#1d4ed8; height:44px; text-align:center; background:#eff6ff;" class="tbl-mq" value="${mq}" oninput="SopralluogoApp.calcTableTotals()" onblur="SopralluogoApp.confirmMeasureEntry(this,'Mq')"></td>
            <td style="padding: 6px; border: 1px solid #e2e8f0;"><input type="number" step="0.01" style="width:100%; box-sizing:border-box; border:1.5px solid #10b981; border-radius:6px; padding:10px 8px; font-size:16px; font-weight:700; color:#065f46; height:44px; text-align:center; background:#f0fdf4;" class="tbl-ml" value="${ml}" oninput="SopralluogoApp.calcTableTotals()" onblur="SopralluogoApp.confirmMeasureEntry(this,'Ml')"></td>
            <td style="padding: 6px; border: 1px solid #e2e8f0; text-align:center; vertical-align:middle;"><button type="button" style="color:#ef4444; background:none; border:none; cursor:pointer; font-size:18px; padding:4px 8px;" onclick="this.closest('tr').remove(); SopralluogoApp.calcTableTotals();"><i class="fa-solid fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    }

    function confirmMeasureEntry(input, tipo) {
        const val = parseFloat(input.value);
        if (!val || val <= 0) return;

        const tr = input.closest('tr');
        const nomeStanza = tr.querySelector('.tbl-stanza-base')?.value || 'locale';
        const unita = tipo === 'Mq' ? 'm\u00b2' : 'ml';
        const emoji = tipo === 'Mq' ? '\uD83D\uDCD0' : '\uD83D\uDCCF';

        // Rimuovi eventuale overlay precedente
        const prev = document.getElementById('measureConfirmOverlay');
        if(prev) prev.remove();

        const overlay = document.createElement('div');
        overlay.id = 'measureConfirmOverlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.55); z-index:10999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(2px);';
        overlay.innerHTML = `
            <div style="background:#fff; border-radius:16px; padding:28px 24px 20px; max-width:300px; width:88%; box-shadow:0 24px 60px rgba(0,0,0,0.35); text-align:center;">
                <div style="font-size:42px; line-height:1; margin-bottom:10px;">${emoji}</div>
                <div style="font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; font-weight:700; margin-bottom:6px;">${tipo === 'Mq' ? 'Metri Quadri' : 'Metri Lineari'}</div>
                <div style="font-size:30px; font-weight:800; color:#0f172a; margin-bottom:4px;">${val.toFixed(2)} <span style="font-size:16px; color:#64748b; font-weight:400;">${unita}</span></div>
                <div style="font-size:14px; color:#475569; margin-bottom:24px; font-weight:500;">${nomeStanza}</div>
                <div style="display:flex; gap:10px;">
                    <button id="btnMeasureConfirm" style="flex:1; background:#10b981; color:#fff; border:none; padding:13px 0; border-radius:8px; font-size:15px; font-weight:700; cursor:pointer;">
                        &#10003; Conferma
                    </button>
                    <button id="btnMeasureEdit" style="flex:1; background:#f1f5f9; color:#334155; border:1.5px solid #cbd5e1; padding:13px 0; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer;">
                        &#9998; Modifica
                    </button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        document.getElementById('btnMeasureConfirm').addEventListener('click', () => {
            overlay.remove();
            calcTableTotals();
        });
        document.getElementById('btnMeasureEdit').addEventListener('click', () => {
            overlay.remove();
            input.value = '';
            calcTableTotals();
            setTimeout(() => input.focus(), 50);
        });
        // Click fuori = conferma implicita
        overlay.addEventListener('click', (e) => {
            if(e.target === overlay) { overlay.remove(); calcTableTotals(); }
        });
    }

    function calcRoomRow(el) {
        const tr = el.closest('tr');
        const lung = parseFloat(tr.querySelector('.tbl-lung').value) || 0;
        const larg = parseFloat(tr.querySelector('.tbl-larg').value) || 0;
        if (lung > 0 && larg > 0) {
            tr.querySelector('.tbl-mq').value = (lung * larg).toFixed(2);
        }
        calcTableTotals();
    }

    function startTableDictation() {
        if(state.isRecording) {
            stopRecording();
            return;
        }
        state.isTableDictation = true;
        try {
            recognition.start();
            document.getElementById('voiceFeedback').style.display = 'flex';
        } catch(e) {
            console.log("Recognition start error", e);
        }
    }

    function parseTableDictation(transcript) {
        state.isTableDictation = false;
        let text = transcript.toLowerCase();
        
        let regexLxL = /([\d.,]+)\s*(?:per|x|e)\s*([\d.,]+)/gi;
        let regexMq = /([\d.,]+)\s*(?:metri quadrat(?:i|o)|metri quadr(?:i|o)|mq|m2|mÂ²)/gi;
        let regexMl = /([\d.,]+)\s*(?:metri linear(?:i|e)|ml|m lineari)/gi;
        
        // Find the earliest match index to extract the stanza name
        let firstMatchIndex = text.length;
        [...text.matchAll(regexLxL)].forEach(m => firstMatchIndex = Math.min(firstMatchIndex, m.index));
        [...text.matchAll(regexMq)].forEach(m => firstMatchIndex = Math.min(firstMatchIndex, m.index));
        [...text.matchAll(regexMl)].forEach(m => firstMatchIndex = Math.min(firstMatchIndex, m.index));
        
        // Estrai e pulisci il nome della stanza
        let stanza = text.substring(0, firstMatchIndex).trim();
        stanza = stanza.replace(/^(inserisci|aggiungi|metti|scrivi|stanza|la|il|lo)\s/i, '').trim();
        if(stanza) {
            stanza = stanza.charAt(0).toUpperCase() + stanza.slice(1);
        } else {
            stanza = "Stanza Sconosciuta";
        }
        
        // Estrai tutti i pezzi
        let lxlMatches = [...text.matchAll(regexLxL)];
        let mqMatches = [...text.matchAll(regexMq)];
        let mlMatches = [...text.matchAll(regexMl)];
        
        let rowsAdded = 0;
        
        // Se ha detto N pezzi LxL, creiamo N righe
        if (lxlMatches.length > 0) {
            lxlMatches.forEach(match => {
                let lung = match[1].replace(',', '.');
                let larg = match[2].replace(',', '.');
                addRoomRow(stanza, lung, larg, '', '');
                rowsAdded++;
                // auto-calc
                let trs = document.querySelectorAll('#roomsTableBody tr');
                if(trs.length > 0) calcRoomRow(trs[trs.length - 1].querySelector('.tbl-lung'));
            });
            
            // Eventuali Mq/Ml aggiuntivi
            if (mlMatches.length > 0 || mqMatches.length > 0) {
                 let trs = document.querySelectorAll('#roomsTableBody tr');
                 let lastTr = trs[trs.length - 1];
                 if (mlMatches.length > 0) {
                     lastTr.querySelector('.tbl-ml').value = mlMatches[0][1].replace(',', '.');
                 }
                 if (mqMatches.length > 0) {
                     let mqVal = mqMatches[0][1].replace(',', '.');
                     addRoomRow(stanza + ' (Extra)', '', '', mqVal, '');
                     rowsAdded++;
                 }
                 calcTableTotals();
            }
        } 
        else {
            // Nessun LxL. Ci sono Mq o Ml?
            let mq = mqMatches.length > 0 ? mqMatches[0][1].replace(',', '.') : '';
            let ml = mlMatches.length > 0 ? mlMatches[0][1].replace(',', '.') : '';
            
            if (mq || ml || stanza !== "Stanza Sconosciuta") {
                addRoomRow(stanza, '', '', mq, ml);
                rowsAdded++;
                calcTableTotals();
            }
        }
        
        if (rowsAdded > 0) {
            speakText(`Aggiunti ${rowsAdded} elementi per ${stanza}.`);
        } else {
            speakText(`Non ho capito le dimensioni per ${stanza}.`);
        }
    }

    function calcTableTotals() {
        let totMq = 0;
        let totMl = 0;
        document.querySelectorAll('#roomsTableBody tr').forEach(tr => {
            totMq += parseFloat(tr.querySelector('.tbl-mq').value) || 0;
            totMl += parseFloat(tr.querySelector('.tbl-ml').value) || 0;
        });
        document.getElementById('tblTotMq').innerText = totMq.toFixed(2);
        document.getElementById('tblTotMl').innerText = totMl.toFixed(2);
    }

    function exportRoomsExcel() {
        const rows = getTableData();
        const stairsRows = getStairsData();
        
        if(rows.length === 0 && stairsRows.length === 0) return alert("Le tabelle misure sono vuote.");
        
        let summary = {};
        let grandMq = 0, grandMl = 0;
        let csv = "";
        
        if (rows.length > 0) {
            csv += "--- TABELLA STANZE ---\nStanza;Lunghezza (m);Larghezza (m);Mq;Ml\n";
            rows.forEach(r => {
                const nomeStr = (r.stanza || 'Senza Nome').replace(/;/g, ',');
                csv += `${nomeStr};${r.lung || 0};${r.larg || 0};${r.mq || 0};${r.ml || 0}\n`;
                
                const n = nomeStr;
                if(!summary[n]) summary[n] = {mq:0, ml:0};
                summary[n].mq += parseFloat(r.mq || 0);
                summary[n].ml += parseFloat(r.ml || 0);
                grandMq += parseFloat(r.mq || 0);
                grandMl += parseFloat(r.ml || 0);
            });

            csv += "\n--- RIEPILOGO TOTALI PER STANZA ---\nStanza;Totale Mq;Totale Ml\n";
            for(const [name, tot] of Object.entries(summary)) {
                csv += `${name};${tot.mq.toFixed(2).replace('.', ',')};${tot.ml.toFixed(2).replace('.', ',')}\n`;
            }
            csv += `TOTALE Mq STANZE;${grandMq.toFixed(2).replace('.', ',')};${grandMl.toFixed(2).replace('.', ',')}\n\n`;
        }

        let stairsTotalMq = 0;
        let stairsTotalMl = 0;
        let toriGroups = {};
        if(stairsRows.length > 0) {
            let stairsTotalToriMl = 0;
            csv += "\n--- TABELLA SCALE E GRADINI ---\nRampa/Tipo;N° Gradini;Larghezza (m);Pedata (m);Alzata (m);Rivesti Alzata (Mq);Lati Batti.;N° Tori;Mq a Gradino;Mq Totale;Ml Battiscopa;Ml Tori\n";
            stairsRows.forEach(s => {
                const tipoStr = (s.tipo || 'Senza Nome').replace(/;/g, ',');
                const alzInfo = s.alzMq ? 'SI' : 'NO';
                csv += `${tipoStr};${s.qta || 0};${s.larg || 0};${s.pedata || 0};${s.alzata || 0};${alzInfo};${s.lati || 0};${s.tori || 0};${s.mqcad || 0};${s.mqtot || 0};${s.mlbatti || 0};${s.mltori || 0}\n`;
                stairsTotalMq += parseFloat(s.mqtot || 0);
                stairsTotalMl += parseFloat(s.mlbatti || 0);
                stairsTotalToriMl += parseFloat(s.mltori || 0);
                
                let qta = parseFloat(s.qta) || 0;
                let larg = parseFloat(s.larg) || 0;
                let ped = parseFloat(s.pedata) || 0;
                let alz = parseFloat(s.alzata) || 0;
                let tori = parseInt(s.tori) || 0;
                if (tori > 0) {
                    let lenTori = larg > 0 ? larg : (ped + alz);
                    if(lenTori > 0) {
                        let key = lenTori.toFixed(2);
                        if(!toriGroups[key]) toriGroups[key] = { count: 0, ml: 0 };
                        let pieces = qta * tori;
                        toriGroups[key].count += pieces;
                        toriGroups[key].ml += (pieces * lenTori);
                    }
                }
            });
            csv += `TOTALE SCALE E BATTISCOPA E TORI;;;;;;;;;${stairsTotalMq.toFixed(2).replace('.', ',')};${stairsTotalMl.toFixed(2).replace('.', ',')};${stairsTotalToriMl.toFixed(2).replace('.', ',')}\n`;
            
            if (Object.keys(toriGroups).length > 0) {
                csv += "\n--- DISTINTA LAVORAZIONI TORO / BATTISCOPA ---\nLunghezza (m);Numero Pezzi;Totale Ml\n";
                for (let k in toriGroups) {
                    csv += `${k.replace('.', ',')};${toriGroups[k].count};${toriGroups[k].ml.toFixed(2).replace('.', ',')}\n`;
                }
            }
            csv += `\n`;
        }
        
        let megaTotalMq = grandMq + stairsTotalMq;
        let megaTotalMl = grandMl + stairsTotalMl;
        csv += `TOTALE GENERALE CANTIERE (Stanze + Scale);;;${megaTotalMq.toFixed(2).replace('.', ',')};${megaTotalMl.toFixed(2).replace('.', ',')}\n`;

        // Download Browser automatico
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        
        const clientName = document.getElementById('clientName').value.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'cantiere';
        link.setAttribute("download", `distinta_misure_${clientName}.csv`);
        
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function getTableData() {
        const rows = [];
        document.querySelectorAll('#roomsTableBody tr').forEach(tr => {
            // Leggi solo dal select (campo dettaglio rimosso)
            const base = tr.querySelector('.tbl-stanza-base')?.value ||
                         tr.querySelector('.tbl-stanza')?.value || '';
            rows.push({
                stanza: base,
                lung: tr.querySelector('.tbl-lung').value,
                larg: tr.querySelector('.tbl-larg').value,
                mq: tr.querySelector('.tbl-mq').value,
                ml: tr.querySelector('.tbl-ml').value
            });
        });
        return rows;
    }

    // --- Gestione Sagoma Step Shapes ---
    function selectStepShape(shape) {
        // Reset all cards
        document.querySelectorAll('.step-shape-card').forEach(el => el.classList.remove('active'));
        // Hide all SVGs
        document.querySelectorAll('.dimension-svg-wrapper').forEach(el => el.style.display = 'none');
        
        if (!shape) {
            document.getElementById('step-dimensions-container').style.display = 'none';
            document.getElementById('techStepShapeType').value = '';
            return;
        }

        // Activate card
        const card = document.getElementById('card-' + shape);
        if (card) card.classList.add('active');

        // Show container and corresponding SVG
        const container = document.getElementById('step-dimensions-container');
        container.style.display = 'block';
        document.getElementById('svg-' + shape).style.display = 'block';
        document.getElementById('techStepShapeType').value = shape;
        
        let typeSelect = document.getElementById('techTipoGradino');
        if (typeSelect) {
            if (shape === 'pianerottolo') typeSelect.value = "Pianerottolo";
            else if (shape === 'rettangolare') typeSelect.value = "Gradino standard";
            else if (shape === 'pie_sx') typeSelect.value = "Piè d'oca sx";
            else if (shape === 'pie_dx') typeSelect.value = "Piè d'oca dx";
            else if (shape === 'pie_sx_chius') typeSelect.value = "Piè d'oca sx (chiusura)";
            else if (shape === 'pie_dx_chius') typeSelect.value = "Piè d'oca dx (chiusura)";
        }
        
        drawStepShape();
        
        // Scroll to the dimensions container
        setTimeout(() => {
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    }
    
    function resetStepShape() {
        document.getElementById('techTipoGradino').value = "Gradino standard";
        document.getElementById('dimPianLung').value = 100;
        document.getElementById('dimPianGiu').value = 100;
        document.getElementById('dimPianProf').value = 30;
        document.getElementById('dimPianSx').value = 30;
        
        if(document.getElementById('dimRetLung')) document.getElementById('dimRetLung').value = 100;
        if(document.getElementById('dimRetProf')) document.getElementById('dimRetProf').value = 30;
        if(document.getElementById('dimPieSxTop')) document.getElementById('dimPieSxTop').value = 100;
        if(document.getElementById('dimPieSxLeft')) document.getElementById('dimPieSxLeft').value = 100;
        if(document.getElementById('dimPieDxTop')) document.getElementById('dimPieDxTop').value = 100;
        if(document.getElementById('dimPieDxRight')) document.getElementById('dimPieDxRight').value = 100;
        
        if(document.getElementById('dimPieSxChiusTop')) document.getElementById('dimPieSxChiusTop').value = 100;
        if(document.getElementById('dimPieSxChiusRight')) document.getElementById('dimPieSxChiusRight').value = 100;
        if(document.getElementById('dimPieDxChiusTop')) document.getElementById('dimPieDxChiusTop').value = 100;
        if(document.getElementById('dimPieDxChiusLeft')) document.getElementById('dimPieDxChiusLeft').value = 100;

        if(document.getElementById('dimPieDxDiag')) {
            document.getElementById('dimPieDxDiag').dataset.manual = 'false';
            document.getElementById('dimPieDxDiag').value = '';
        }
        if(document.getElementById('dimPieSxDiag')) {
            document.getElementById('dimPieSxDiag').dataset.manual = 'false';
            document.getElementById('dimPieSxDiag').value = '';
        }
        if(document.getElementById('dimPieSxChiusDiag')) {
            document.getElementById('dimPieSxChiusDiag').dataset.manual = 'false';
            document.getElementById('dimPieSxChiusDiag').value = '';
        }
        if(document.getElementById('dimPieDxChiusDiag')) {
            document.getElementById('dimPieDxChiusDiag').dataset.manual = 'false';
            document.getElementById('dimPieDxChiusDiag').value = '';
        }

        document.querySelectorAll('.dimension-svg-wrapper .edge-line').forEach(line => {
            line.classList.remove('edge-toro');
            line.classList.remove('edge-batti');
            line.classList.remove('edge-attacco');
        });

        const dimAlzata = document.getElementById('dimAlzataSagoma');
        if (dimAlzata) dimAlzata.value = "17";
        
        const chkSx = document.getElementById('chkAlzBattiSx');
        if (chkSx) chkSx.checked = false;
        
        const chkDx = document.getElementById('chkAlzBattiDx');
        if (chkDx) chkDx.checked = false;

        const pF = document.getElementById('techProfiloFrontale');
        if (pF) pF.value = "Toro";
        
        const radConAlz = document.getElementById('radRivConAlz');
        if (radConAlz) radConAlz.checked = true;

        drawStepShape();
    }
    

    
    function toggleEdgeState(line) {
        const modeInput = document.querySelector('input[name="edgeSelectMode"]:checked');
        
        if (!modeInput) {
            // Se nessuna opzione è flaggata, cliccare pulisce i latti
            line.classList.remove('edge-toro');
            line.classList.remove('edge-batti');
            line.classList.remove('edge-attacco');
            return;
        }
        
        const mode = modeInput.value;
        
        if (mode === 'toro') {
            if (line.classList.contains('edge-toro')) {
                line.classList.remove('edge-toro');
            } else {
                line.classList.add('edge-toro');
                line.classList.remove('edge-batti');
                line.classList.remove('edge-attacco');
            }
        } else if (mode === 'batti') {
            if (line.classList.contains('edge-batti')) {
                line.classList.remove('edge-batti');
            } else {
                line.classList.add('edge-batti');
                line.classList.remove('edge-toro');
                line.classList.remove('edge-attacco');
            }
        } else if (mode === 'attacco') {
            if (line.classList.contains('edge-attacco')) {
                line.classList.remove('edge-attacco');
            } else {
                line.classList.add('edge-attacco');
                line.classList.remove('edge-toro');
                line.classList.remove('edge-batti');
            }
        }
    }
    
    function setLine(id, x1, y1, x2, y2) {
        const line = document.getElementById(id);
        if(line) {
            line.setAttribute('x1', x1);  line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);  line.setAttribute('y2', y2);
        }
    }

    function drawStepShape() {
        const shape = document.getElementById('techStepShapeType').value;
        if (!shape) return;
        
        const scaleInd = document.getElementById('shape-scale-indicator');
        
        let wTop = 100, wBot = 100, hRight = 100, hLeft = 100;
        
        if (shape === 'pianerottolo') {
            wTop = parseFloat(document.getElementById('dimPianLung').value) || 100;
            hRight = parseFloat(document.getElementById('dimPianProf').value) || 100;
            wBot = parseFloat(document.getElementById('dimPianGiu').value) || 100;
            hLeft = parseFloat(document.getElementById('dimPianSx').value) || 100;
        } else if (shape === 'rettangolare') {
            wTop = parseFloat(document.getElementById('dimRetLung').value) || 100;
            wBot = wTop;
            hRight = parseFloat(document.getElementById('dimRetProf').value) || 30;
            hLeft = hRight;
        } else if (shape === 'pie_sx') {
            wTop = parseFloat(document.getElementById('dimPieSxTop').value.replace(',','.')) || 100;
            wBot = wTop;
            hLeft = parseFloat(document.getElementById('dimPieSxLeft').value.replace(',','.')) || 100;
            hRight = hLeft;
            let dg = document.getElementById('dimPieSxDiag');
            if(dg && dg.dataset.manual !== 'true') dg.value = Math.sqrt(Math.pow(wTop, 2) + Math.pow(hLeft, 2)).toFixed(2);
        } else if (shape === 'pie_dx') {
            wTop = parseFloat(document.getElementById('dimPieDxTop').value.replace(',','.')) || 100;
            wBot = wTop;
            hRight = parseFloat(document.getElementById('dimPieDxRight').value.replace(',','.')) || 100;
            hLeft = hRight;
            let dg = document.getElementById('dimPieDxDiag');
            if(dg && dg.dataset.manual !== 'true') dg.value = Math.sqrt(Math.pow(wTop, 2) + Math.pow(hRight, 2)).toFixed(2);
        } else if (shape === 'pie_sx_chius') {
            wTop = parseFloat(document.getElementById('dimPieSxChiusTop').value.replace(',','.')) || 100;
            wBot = wTop;
            hRight = parseFloat(document.getElementById('dimPieSxChiusRight').value.replace(',','.')) || 100;
            hLeft = hRight;
            let dg = document.getElementById('dimPieSxChiusDiag');
            if(dg && dg.dataset.manual !== 'true') dg.value = Math.sqrt(Math.pow(wTop, 2) + Math.pow(hRight, 2)).toFixed(2);
        } else if (shape === 'pie_dx_chius') {
            wTop = parseFloat(document.getElementById('dimPieDxChiusTop').value.replace(',','.')) || 100;
            wBot = wTop;
            hLeft = parseFloat(document.getElementById('dimPieDxChiusLeft').value.replace(',','.')) || 100;
            hRight = hLeft;
            let dg = document.getElementById('dimPieDxChiusDiag');
            if(dg && dg.dataset.manual !== 'true') dg.value = Math.sqrt(Math.pow(wTop, 2) + Math.pow(hLeft, 2)).toFixed(2);
        }
        
        // Calculate scale to fit inside 160x110 box (padding 20 inside 200x150 viewBox)
        const maxW = 160;
        const maxH = 110;
        
        let maxActualW = Math.max(wTop, wBot);
        let maxActualH = Math.max(hLeft, hRight);
        if (maxActualW <= 0) maxActualW = 100;
        if (maxActualH <= 0) maxActualH = 100;
        
        let scale = Math.min(maxW / maxActualW, maxH / maxActualH);
        
        let drawW = maxActualW * scale;
        let drawH = maxActualH * scale;

        let offsetX = (200 - drawW) / 2;
        let offsetY = (150 - drawH) / 2;
        
        if (scaleInd) {
            scaleInd.style.display = 'block';
            let ratio = Math.round(100 / scale);
            if (ratio < 1) ratio = 1;
            scaleInd.innerText = `Scala 1:${ratio} (Proporzione Reale)`;
        }
        
        // Update SVG Elements

        if (shape === 'pianerottolo' || shape === 'rettangolare') {
            let topW = wTop * scale;
            let botW = wBot * scale;
            let leftH = hLeft * scale;
            let rightH = hRight * scale;

            let xTopLeft = offsetX + (drawW - topW) / 2;
            let xTopRight = xTopLeft + topW;
            let xBotLeft = offsetX + (drawW - botW) / 2;
            let xBotRight = xBotLeft + botW;

            let yTopLeft = offsetY + (drawH - leftH) / 2;
            let yBotLeft = yTopLeft + leftH;
            
            let yTopRight = offsetY + (drawH - rightH) / 2;
            let yBotRight = yTopRight + rightH;

            let prefix = shape === 'pianerottolo' ? 'pian' : 'ret';
            const poly = document.getElementById(`poly-bg-${prefix}`);
            if(poly) poly.setAttribute('points', `${xTopLeft},${yTopLeft} ${xTopRight},${yTopRight} ${xBotRight},${yBotRight} ${xBotLeft},${yBotLeft}`);
            
            setLine(`line-${prefix}-top`, xTopLeft, yTopLeft, xTopRight, yTopRight);
            setLine(`line-${prefix}-right`, xTopRight, yTopRight, xBotRight, yBotRight);
            setLine(`line-${prefix}-bottom`, xBotRight, yBotRight, xBotLeft, yBotLeft);
            setLine(`line-${prefix}-left`, xBotLeft, yBotLeft, xTopLeft, yTopLeft);
        } else if (shape === 'pie_sx') {
            let topW = wTop * scale;
            let leftH = hLeft * scale;
            let xLeft = offsetX;
            let xRight = offsetX + topW;
            let yTop = offsetY;
            let yBot = offsetY + leftH;
            
            const poly = document.getElementById('poly-bg-piesx');
            if(poly) poly.setAttribute('points', `${xLeft},${yTop} ${xRight},${yTop} ${xLeft},${yBot}`);
            
            setLine('line-piesx-top', xLeft, yTop, xRight, yTop);
            setLine('line-piesx-diag', xRight, yTop, xLeft, yBot);
            setLine('line-piesx-left', xLeft, yBot, xLeft, yTop);
        } else if (shape === 'pie_dx') {
            let topW = wTop * scale;
            let rightH = hRight * scale;
            let xLeft = offsetX;
            let xRight = offsetX + topW;
            let yTop = offsetY;
            let yBot = offsetY + rightH;
            
            const poly = document.getElementById('poly-bg-piedx');
            if(poly) poly.setAttribute('points', `${xLeft},${yTop} ${xRight},${yTop} ${xRight},${yBot}`);
            
            setLine('line-piedx-top', xLeft, yTop, xRight, yTop);
            setLine('line-piedx-right', xRight, yTop, xRight, yBot);
            setLine('line-piedx-diag', xRight, yBot, xLeft, yTop);
        }
    }

    // --- Disegno Libero (Fuori Squadro) ---
    let liberoVertices = [];
    let liberoEdgeCm = [];        // cm confermati per ogni lato (indice = vertice di partenza)
    let _liberoWaitingSegIdx = -1; // quale segmento stiamo aspettando

    function clearLiberoShape() {
        liberoVertices = [];
        liberoEdgeCm = [];
        liberoRealCmVertices = null;
        _liberoWaitingSegIdx = -1;
        const panel = document.getElementById('libero-segment-panel');
        if (panel) panel.style.display = 'none';
        const canvas = document.getElementById('libero-draw-canvas');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0, canvas.width, canvas.height);
        document.getElementById('libero-interactive-svg').style.pointerEvents = 'none';
        const polyBg = document.getElementById('poly-bg-libero');
        if (polyBg) polyBg.setAttribute('points', '');
        const edgesGrp = document.getElementById('libero-edges-group');
        if (edgesGrp) edgesGrp.innerHTML = '';
        const labelsGrp = document.getElementById('libero-labels-group');
        if (labelsGrp) labelsGrp.innerHTML = '';
        redrawLiberoCanvas();
    }

    document.addEventListener('DOMContentLoaded', () => {
        const canvas = document.getElementById('libero-draw-canvas');
        if(canvas) {
            canvas.addEventListener('click', (e) => {
                // Se la figura è già chiusa, ignora
                if(liberoVertices.length > 0 && document.getElementById('libero-interactive-svg').style.pointerEvents === 'all') return;
                // Se stiamo aspettando la conferma di un segmento, ignora il click sul canvas
                if(_liberoWaitingSegIdx >= 0) return;

                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                let x = (e.clientX - rect.left) * scaleX;
                let y = (e.clientY - rect.top) * scaleY;

                // Snap logic per allineamento ortogonale ai punti esistenti
                if (liberoVertices.length > 0 && !e.shiftKey && !e.altKey) {
                    const SNAP_DIST = 15;
                    let snappedX = false;
                    let snappedY = false;
                    // Snappa in ordine inverso per dare priorità all'ultimo punto inserito o al primo (per chiusura)
                    let checkPoints = [liberoVertices[0], liberoVertices[liberoVertices.length - 1]];
                    for (let pt of liberoVertices) { if(!checkPoints.includes(pt)) checkPoints.push(pt); }
                    
                    for (let pt of checkPoints) {
                        if (pt) {
                            if (!snappedX && Math.abs(x - pt.x) < SNAP_DIST) { x = pt.x; snappedX = true; }
                            if (!snappedY && Math.abs(y - pt.y) < SNAP_DIST) { y = pt.y; snappedY = true; }
                        }
                    }
                }

                // Chiusura figura: click vicino al primo vertice
                if(liberoVertices.length > 2) {
                    const first = liberoVertices[0];
                    const dist = Math.sqrt(Math.pow(x - first.x, 2) + Math.pow(y - first.y, 2));
                    if(dist < 20) { // Aumentato leggermente il raggio di chiusura
                        // Chiedi la misura del lato di chiusura prima di finalizzare
                        _showLiberoSegmentPanel(liberoVertices.length, true);
                        return;
                    }
                }

                liberoVertices.push({x, y});
                redrawLiberoCanvas();

                // Dopo il secondo vertice in poi, mostra il pannello per il segmento appena disegnato
                if(liberoVertices.length >= 2) {
                    const segIdx = liberoVertices.length - 2; // indice del lato appena completato
                    _showLiberoSegmentPanel(segIdx, false);
                }
            });

            canvas.addEventListener('mousemove', (e) => {
                if(liberoVertices.length > 0 && document.getElementById('libero-interactive-svg').style.pointerEvents !== 'all') {
                    if(_liberoWaitingSegIdx >= 0) return; // non animare durante l'attesa
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    let x = (e.clientX - rect.left) * scaleX;
                    let y = (e.clientY - rect.top) * scaleY;
                    
                    // Snap logic visivo
                    if (liberoVertices.length > 0 && !e.shiftKey && !e.altKey) {
                        const SNAP_DIST = 15;
                        let snappedX = false;
                        let snappedY = false;
                        let checkPoints = [liberoVertices[0], liberoVertices[liberoVertices.length - 1]];
                        for (let pt of liberoVertices) { if(!checkPoints.includes(pt)) checkPoints.push(pt); }
                        
                        for (let pt of checkPoints) {
                            if (pt) {
                                if (!snappedX && Math.abs(x - pt.x) < SNAP_DIST) { x = pt.x; snappedX = true; }
                                if (!snappedY && Math.abs(y - pt.y) < SNAP_DIST) { y = pt.y; snappedY = true; }
                            }
                        }
                    }
                    
                    redrawLiberoCanvas(x, y);
                }
            });
        }
    });

    // Blocco eventi globali per abortire o circoscrivere
    document.addEventListener('DOMContentLoaded', () => {
        // Clic fuori campo: annulla il disegno in corso se si clicca fuori dall'area di canvas
        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('libero-canvas-wrapper');
            const panel = document.getElementById('libero-segment-panel');
            const toggleBtn = document.querySelector('button[onclick="SopralluogoApp.toggleLiberoDraw()"]');
            const redrawBtn = document.querySelector('button[onclick="SopralluogoApp.clearLiberoShape()"]');
            
            // Se stiamo disegnando attivamente (vertices > 0 e figura non ancora chiusa nel SVG)
            if (liberoVertices.length > 0 && document.getElementById('libero-interactive-svg').style.pointerEvents !== 'all') {
                if (wrapper && !wrapper.contains(e.target) && 
                    panel && !panel.contains(e.target) && 
                    (!toggleBtn || !toggleBtn.contains(e.target)) &&
                    (!redrawBtn || !redrawBtn.contains(e.target))) {
                    console.log("[Disegno Libero] Clic fuori campo rilevato. Abortendo disegno.");
                    clearLiberoShape();
                }
            }
        });

        // Blocca la propagazione di tutti gli eventi keyboard dal pannello segment
        const panel = document.getElementById('libero-segment-panel');
        if (panel) {
            panel.addEventListener('keydown', (e) => { e.stopPropagation(); });
            panel.addEventListener('keypress', (e) => { e.stopPropagation(); });
            panel.addEventListener('keyup', (e) => { e.stopPropagation(); });
            // Impedisce che Enter dentro il panel triggeri click su bottoni fuori dal panel
            panel.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') e.preventDefault();
            });
        }
    });

    // Mostra il pannello live chiedendo la misura del segmento segIdx
    function _showLiberoSegmentPanel(segIdx, isClosing) {
        _liberoWaitingSegIdx = segIdx;
        const sideColors = ['#5b21b6','#0369a1','#059669','#b45309','#be185d','#1d4ed8','#7c3aed','#0f766e'];
        const color = sideColors[segIdx % sideColors.length];
        const panel = document.getElementById('libero-segment-panel');
        const badge = document.getElementById('libero-seg-badge');
        const input = document.getElementById('libero-seg-input');
        if (!panel || !badge || !input) return;
        badge.textContent = `L${segIdx+1}`;
        badge.style.background = color;
        input.value = '';
        panel.style.display = 'block';
        // Store whether this is the closing segment
        panel.dataset.isClosing = isClosing ? '1' : '0';
        setTimeout(() => input.focus(), 50);
    }

    function confirmLiberoSegment() {
        const input = document.getElementById('libero-seg-input');
        const panel = document.getElementById('libero-segment-panel');
        if (!input || _liberoWaitingSegIdx < 0) return;
        const val = parseFloat(input.value);
        if (!val || val <= 0) {
            input.style.borderColor = '#ef4444';
            setTimeout(() => input.style.borderColor = '#7c3aed', 1000);
            return;
        }
        liberoEdgeCm[_liberoWaitingSegIdx] = val;
        const isClosing = panel && panel.dataset.isClosing === '1';
        _liberoWaitingSegIdx = -1;
        if (panel) panel.style.display = 'none';

        if (isClosing) {
            // Era il lato di chiusura: finalizza la figura
            drawLiberoFinalLayer();
        } else {
            redrawLiberoCanvas();
        }
    }

    function skipLiberoSegment() {
        const panel = document.getElementById('libero-segment-panel');
        const isClosing = panel && panel.dataset.isClosing === '1';
        _liberoWaitingSegIdx = -1;
        if (panel) panel.style.display = 'none';
        if (isClosing) {
            drawLiberoFinalLayer();
        }
    }

    function _buildRealCmVertices() {
        let N = liberoVertices.length;
        if (N < 3) return null;
        
        let E = [];
        let allEdgesValid = true;
        for (let i = 0; i < N; i++) {
            let val = parseFloat(liberoEdgeCm[i]);
            if (isNaN(val) || val <= 0) allEdgesValid = false;
            E.push(val);
        }

        // Geometric Exact Reconstruction for Triangles
        if (N === 3 && allEdgesValid) {
            let val = (E[0]*E[0] + E[2]*E[2] - E[1]*E[1]) / (2 * E[0] * E[2]);
            val = Math.max(-1, Math.min(1, val));
            let alpha = Math.acos(val);
            
            let p0 = liberoVertices[0], p1 = liberoVertices[1], p2 = liberoVertices[2];
            let theta0 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
            let cross = (p1.x - p0.x)*(p2.y - p0.y) - (p1.y - p0.y)*(p2.x - p0.x);
            let sign = cross >= 0 ? 1 : -1;
            let theta2 = theta0 + sign * alpha;

            return [
                {x: 0, y: 0},
                {x: E[0] * Math.cos(theta0), y: E[0] * Math.sin(theta0)},
                {x: E[2] * Math.cos(theta2), y: E[2] * Math.sin(theta2)}
            ];
        }

        // Geometric Exact Reconstruction for Quadrilaterals
        if (N === 4 && allEdgesValid) {
            let p = liberoVertices;
            let d_canvas = Math.hypot(p[2].x - p[0].x, p[2].y - p[0].y);
            let perim_c = 0;
            for(let i=0; i<4; i++) {
                perim_c += Math.hypot(p[(i+1)%4].x - p[i].x, p[(i+1)%4].y - p[i].y);
            }
            let perim_e = E[0] + E[1] + E[2] + E[3];
            
            let D_min = Math.max(Math.abs(E[0]-E[1]), Math.abs(E[2]-E[3]));
            let D_max = Math.min(E[0]+E[1], E[2]+E[3]);
            
            if (D_min <= D_max) {
                let D_ideal = perim_c > 0 ? d_canvas * (perim_e / perim_c) : (D_min + D_max)/2;
                let D = Math.max(D_min + 0.001, Math.min(D_max - 0.001, D_ideal));
                
                let theta0 = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
                
                let val1 = (E[0]*E[0] + D*D - E[1]*E[1]) / (2 * E[0] * D);
                let alpha1 = Math.acos(Math.max(-1, Math.min(1, val1)));
                let cross1 = (p[1].x-p[0].x)*(p[2].y-p[0].y) - (p[1].y-p[0].y)*(p[2].x-p[0].x);
                let sign1 = cross1 >= 0 ? 1 : -1;
                let theta_D = theta0 + sign1 * alpha1;

                let val2 = (D*D + E[3]*E[3] - E[2]*E[2]) / (2 * D * E[3]);
                let gamma = Math.acos(Math.max(-1, Math.min(1, val2)));
                let cross2 = (p[2].x-p[0].x)*(p[3].y-p[0].y) - (p[2].y-p[0].y)*(p[3].x-p[0].x);
                let sign2 = cross2 >= 0 ? 1 : -1;
                let theta3 = theta_D + sign2 * gamma;
                
                return [
                    {x: 0, y: 0},
                    {x: E[0] * Math.cos(theta0), y: E[0] * Math.sin(theta0)},
                    {x: D * Math.cos(theta_D), y: D * Math.sin(theta_D)},
                    {x: E[3] * Math.cos(theta3), y: E[3] * Math.sin(theta3)}
                ];
            }
        }

        // Fallback progressivo (N > 4 o misure non formano un poligono chiuso valicabile)
        let scalePxPerCm = null;
        for (let i = 0; i < N; i++) {
            let p1 = liberoVertices[i], p2 = liberoVertices[(i+1)%N];
            let pxLen = Math.sqrt(Math.pow(p2.x-p1.x,2)+Math.pow(p2.y-p1.y,2));
            if (liberoEdgeCm[i] && pxLen > 0) {
                scalePxPerCm = pxLen / parseFloat(liberoEdgeCm[i]);
                break;
            }
        }
        let result = [{x:0, y:0}];
        for (let i = 0; i < N - 1; i++) {
            let p1 = liberoVertices[i], p2 = liberoVertices[i+1];
            let dx = p2.x - p1.x, dy = p2.y - p1.y;
            let pxLen = Math.sqrt(dx*dx+dy*dy);
            let angle = pxLen > 0 ? Math.atan2(dy, dx) : 0;
            let cmLen = parseFloat(liberoEdgeCm[i]);
            if (isNaN(cmLen) || cmLen <= 0) {
                cmLen = scalePxPerCm ? pxLen / scalePxPerCm : 0;
            }
            let prev = result[result.length - 1];
            result.push({
                x: prev.x + cmLen * Math.cos(angle),
                y: prev.y + cmLen * Math.sin(angle)
            });
        }
        return result;
    }

    function redrawLiberoCanvas(curX, curY) {
        const canvas = document.getElementById('libero-draw-canvas');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
        for(let i=0; i<canvas.width; i+=20) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
        for(let i=0; i<canvas.height; i+=20) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke(); }
        
        let pts = liberoVertices || [];
        if(pts.length === 0) return;
        
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for(let i=1; i<pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        
        if(curX !== undefined && curY !== undefined) {
            ctx.lineTo(curX, curY);
            if(pts.length > 2) {
                const first = pts[0];
                const dist = Math.sqrt(Math.pow(curX - first.x, 2) + Math.pow(curY - first.y, 2));
                if(dist < 15) {
                    ctx.fillStyle = 'rgba(16, 185, 129, 0.5)';
                    ctx.beginPath(); ctx.arc(first.x, first.y, 10, 0, Math.PI*2); ctx.fill();
                }
            }
        }
        ctx.stroke();
        
        ctx.fillStyle = '#1d4ed8';
        for(let i=0; i<pts.length; i++) {
            ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 4, 0, Math.PI*2); ctx.fill();
        }

        // Durante il disegno (non chiuso): mostra label L1, L2... sui lati già confermati
        const isClosed = document.getElementById('libero-interactive-svg') &&
                         document.getElementById('libero-interactive-svg').style.pointerEvents === 'all';
        const sideColors = ['#5b21b6','#0369a1','#059669','#b45309','#be185d','#1d4ed8','#7c3aed','#0f766e'];

        if (!isClosed && pts.length >= 2) {
            // Calcola centroide del poligono disegnato
            let cx = 0, cy = 0;
            for (let p of pts) { cx += p.x; cy += p.y; }
            cx /= pts.length; cy /= pts.length;

            // Mostra etichette dei segmenti già confermati durante il disegno
            ctx.font = 'bold 9px Arial';
            ctx.textAlign = 'center';
            for (let i = 0; i < pts.length - 1; i++) {
                if (!liberoEdgeCm[i]) continue;
                let p1 = pts[i], p2 = pts[i+1];
                let mx = (p1.x + p2.x)/2, my = (p1.y + p2.y)/2;
                // Direzione dal centroide al midpoint (verso l'esterno)
                let odx = mx - cx, ody = my - cy;
                let olen = Math.sqrt(odx*odx + ody*ody) || 1;
                let ox = (odx / olen) * 22;
                let oy = (ody / olen) * 22;
                let lx = mx + ox, ly = my + oy;
                let color = sideColors[i % sideColors.length];
                let label = `L${i+1}`, txt = liberoEdgeCm[i].toFixed(1) + ' cm';
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(lx, ly - 10, 8, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = 'bold 7px Arial';
                ctx.fillText(label, lx, ly - 7.5);
                ctx.font = 'bold 8px Arial';
                let tw = ctx.measureText(txt).width + 5;
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.fillRect(lx - tw/2, ly + 1, tw, 11);
                ctx.fillStyle = color;
                ctx.fillText(txt, lx, ly + 10);
            }
        }
    } // end redrawLiberoCanvas

    function drawLiberoFinalLayer() {
        document.getElementById('libero-interactive-svg').style.pointerEvents = 'all';
        let pts = liberoVertices;
        let polyPtsHtml = pts.map(p => `${p.x},${p.y}`).join(' ');
        
        let pathBg = document.getElementById('poly-bg-libero');
        if(pathBg) pathBg.setAttribute('points', polyPtsHtml);
        
        let edgesHtml = '';
        for(let i=0; i<pts.length; i++) {
            let p1 = pts[i];
            let p2 = pts[(i+1)%pts.length];
            edgesHtml += `<line id="line-libero-${i}" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" class="edge-line" stroke-width="8" onclick="SopralluogoApp.toggleEdgeState(this)"/>`;
        }
        document.getElementById('libero-edges-group').innerHTML = edgesHtml;
        // Ricostruisci vertici reali se ci sono misure inserite live
        liberoRealCmVertices = _buildRealCmVertices();
        // Disegna le etichette nell'SVG (sopra il fill del poligono)
        _drawLiberoLabelsInSvg();
        redrawLiberoCanvas();
    }

    // Render etichette L1/L2... nel layer SVG (z-index sopra il polygon fill)
    function _drawLiberoLabelsInSvg() {
        const labelsGrp = document.getElementById('libero-labels-group');
        if (!labelsGrp) return;
        labelsGrp.innerHTML = '';
        if (!liberoRealCmVertices || liberoRealCmVertices.length < 3) return;
        const pts = liberoVertices;
        const realPts = liberoRealCmVertices;
        const sideColors = ['#5b21b6','#0369a1','#059669','#b45309','#be185d','#1d4ed8','#7c3aed','#0f766e'];

        // Centroide del poligono disegnato (coordinate canvas px)
        let cx = 0, cy = 0;
        for (let p of pts) { cx += p.x; cy += p.y; }
        cx /= pts.length; cy /= pts.length;

        let svgHtml = '';
        for (let i = 0; i < pts.length; i++) {
            let p1 = pts[i], p2 = pts[(i+1)%pts.length];
            let mx = (p1.x + p2.x)/2;
            let my = (p1.y + p2.y)/2;
            let r1 = realPts[i], r2 = realPts[(i+1)%realPts.length];
            let dx = r2.x - r1.x, dy = r2.y - r1.y;
            let lenCm = Math.sqrt(dx*dx+dy*dy).toFixed(1);
            let color = sideColors[i % sideColors.length];
            let label = `L${i+1}`;
            let txt = lenCm + ' cm';

            // Offset perpendicolare verso l'ESTERNO del poligono
            // Direzione: dal centroide verso il midpoint del lato, normalizzata
            let odx = mx - cx, ody = my - cy;
            let olen = Math.sqrt(odx*odx + ody*ody) || 1;
            let OFFSET = 26;
            let perpX = (odx / olen) * OFFSET;
            let perpY = (ody / olen) * OFFSET;

            svgHtml += `
                <g transform="translate(${mx + perpX}, ${my + perpY})" style="pointer-events:none;">
                    <circle r="9" fill="${color}" />
                    <text x="0" y="3.5" text-anchor="middle" fill="white" font-size="8" font-weight="800" font-family="Arial">${label}</text>
                    <rect x="-${txt.length*3.2}" y="11" width="${txt.length*6.4}" height="13" rx="3" fill="rgba(255,255,255,0.95)" stroke="${color}" stroke-width="0.5"/>
                    <text x="0" y="21" text-anchor="middle" fill="${color}" font-size="9" font-weight="700" font-family="Arial">${txt}</text>
                </g>`;
        }
        labelsGrp.innerHTML = svgHtml;
    }

    // --- Modal Misure Esatte Disegno Libero ---
    let liberoRealCmVertices = null; // Vertici in cm reali (dal modal)

    function openLiberoMisureModal() {
        const modal = document.getElementById('liberoMisureModal');
        if (!modal) return;
        modal.style.display = 'flex';
        const list = document.getElementById('liberoVertexInputList');
        list.innerHTML = '';
        // Se ci sono già vertici reali, popola dal precedente
        if (liberoRealCmVertices && liberoRealCmVertices.length >= 3) {
            liberoRealCmVertices.forEach((v, i) => {
                addLiberoVertexRow(v.x, v.y);
            });
        } else {
            // Aggiungi 4 vertici default (rettangolo 100x30)
            addLiberoVertexRow(0, 0);
            addLiberoVertexRow(100, 0);
            addLiberoVertexRow(100, 30);
            addLiberoVertexRow(0, 30);
        }
        updateLiberoModalPreview();
    }

    function closeLiberoMisureModal() {
        const modal = document.getElementById('liberoMisureModal');
        if (modal) modal.style.display = 'none';
    }

    function addLiberoVertexRow(x, y) {
        const list = document.getElementById('liberoVertexInputList');
        if (!list) return;
        const idx = list.children.length;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px;';
        row.innerHTML = `
            <span style="font-size:0.75em; font-weight:700; color:#5b21b6; min-width:22px; text-align:center; background:#ede9fe; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center;">${idx+1}</span>
            <label style="font-size:0.8em; color:#475569; white-space:nowrap;">X (cm):</label>
            <input type="number" step="0.1" value="${x !== undefined ? x : ''}" class="lm-vx" style="width:80px; padding:5px 7px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:0.9em; text-align:center;" oninput="SopralluogoApp.updateLiberoModalPreview()" placeholder="X">
            <label style="font-size:0.8em; color:#475569; white-space:nowrap;">Y (cm):</label>
            <input type="number" step="0.1" value="${y !== undefined ? y : ''}" class="lm-vy" style="width:80px; padding:5px 7px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:0.9em; text-align:center;" oninput="SopralluogoApp.updateLiberoModalPreview()" placeholder="Y">
            <button type="button" onclick="this.closest('div[data-vm]').remove(); SopralluogoApp.updateLiberoModalPreview(); SopralluogoApp._renumberLiberoRows();" style="background:none; border:none; color:#ef4444; font-size:1.1em; cursor:pointer; padding:2px 4px;">✕</button>
        `;
        row.setAttribute('data-vm', idx);
        list.appendChild(row);
        updateLiberoModalPreview();
    }

    function _renumberLiberoRows() {
        const list = document.getElementById('liberoVertexInputList');
        if (!list) return;
        Array.from(list.children).forEach((row, i) => {
            const badge = row.querySelector('span');
            if (badge) badge.textContent = i + 1;
            row.setAttribute('data-vm', i);
        });
    }

    function updateLiberoModalPreview() {
        const list = document.getElementById('liberoVertexInputList');
        const canvas = document.getElementById('liberoModalPreviewCanvas');
        const sideLengthsDiv = document.getElementById('liberoModalSideLengths');
        if (!list || !canvas) return;

        const rows = Array.from(list.querySelectorAll('div[data-vm]'));
        const pts = rows.map(row => ({
            x: parseFloat(row.querySelector('.lm-vx').value) || 0,
            y: parseFloat(row.querySelector('.lm-vy').value) || 0
        }));

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Grid
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5;
        for(let i=0; i<canvas.width; i+=20) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
        for(let i=0; i<canvas.height; i+=20) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke(); }

        if (pts.length < 2) { if(sideLengthsDiv) sideLengthsDiv.innerHTML = ''; return; }

        let minX = Math.min(...pts.map(p=>p.x));
        let maxX = Math.max(...pts.map(p=>p.x));
        let minY = Math.min(...pts.map(p=>p.y));
        let maxY = Math.max(...pts.map(p=>p.y));
        let rangeX = maxX - minX || 1;
        let rangeY = maxY - minY || 1;
        const pad = 28;
        let scale = Math.min((canvas.width - pad*2) / rangeX, (canvas.height - pad*2) / rangeY);
        const toScreen = (p) => ({
            x: pad + (p.x - minX) * scale,
            y: pad + (p.y - minY) * scale
        });
        const sPts = pts.map(toScreen);

        // Fill
        ctx.fillStyle = 'rgba(91,33,182,0.07)';
        ctx.beginPath();
        ctx.moveTo(sPts[0].x, sPts[0].y);
        sPts.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath(); ctx.fill();

        // Edges
        ctx.strokeStyle = '#5b21b6'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sPts[0].x, sPts[0].y);
        sPts.forEach(p => ctx.lineTo(p.x, p.y));
        if (pts.length >= 3) ctx.closePath();
        ctx.stroke();

        // Side labels + lengths on canvas
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        let sideLengthsHtml = '<strong>Lati:</strong> ';
        const sideArr = [];
        // Palette colori per i lati
        const sideColors = ['#5b21b6','#0369a1','#059669','#b45309','#be185d','#1d4ed8','#7c3aed','#0f766e'];
        for(let i=0; i<pts.length; i++) {
            let p1 = pts[i]; let p2 = pts[(i+1)%pts.length];
            let dx = p2.x - p1.x; let dy = p2.y - p1.y;
            let lenCm = Math.sqrt(dx*dx + dy*dy);
            sideArr.push(lenCm);
            let sp1 = sPts[i]; let sp2 = sPts[(i+1)%pts.length];
            let mx = (sp1.x + sp2.x)/2; let my = (sp1.y + sp2.y)/2;
            let color = sideColors[i % sideColors.length];
            let label = `L${i+1}`;
            let txt = `${lenCm.toFixed(1)} cm`;

            // Disegna il lato colorato
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(sp1.x, sp1.y);
            ctx.lineTo(sp2.x, sp2.y);
            ctx.stroke();
            ctx.restore();

            // Badge "L1" tondo colorato
            let badgeR = 9;
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(mx, my - 14, badgeR, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 8px Arial';
            ctx.fillText(label, mx, my - 11);

            // Misura sotto il badge
            ctx.font = 'bold 8px Arial';
            let tw = ctx.measureText(txt).width + 6;
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.fillRect(mx - tw/2, my - 1, tw, 12);
            ctx.fillStyle = color;
            ctx.fillText(txt, mx, my + 9);
        }

        // Dots + vertex labels (V1, V2...)
        sPts.forEach((p, i) => {
            ctx.fillStyle = '#1d4ed8';
            ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fillRect(p.x + 5, p.y - 9, 16, 12);
            ctx.fillStyle = '#1d4ed8';
            ctx.font = 'bold 8px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`V${i+1}`, p.x + 6, p.y + 1);
            ctx.textAlign = 'center';
        });

        sideLengthsHtml += sideArr.map((l,i) => {
            let color = sideColors[i % sideColors.length];
            return `<span style="display:inline-flex;align-items:center;gap:3px;"><span style="background:${color};color:#fff;border-radius:50%;font-size:10px;font-weight:700;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;">L${i+1}</span> ${l.toFixed(1)} cm</span>`;
        }).join(' &nbsp; ');
        if (sideLengthsDiv) sideLengthsDiv.innerHTML = sideLengthsHtml;
    }

    function applyLiberoMisureModal() {
        const list = document.getElementById('liberoVertexInputList');
        if (!list) return;
        const rows = Array.from(list.querySelectorAll('div[data-vm]'));
        const cmPts = rows.map(row => ({
            x: parseFloat(row.querySelector('.lm-vx').value) || 0,
            y: parseFloat(row.querySelector('.lm-vy').value) || 0
        }));
        if (cmPts.length < 3) {
            alert('Inserisci almeno 3 vertici per definire una sagoma.');
            return;
        }
        liberoRealCmVertices = cmPts;

        // Mappa in coordinate canvas (280 x 240 con padding)
        let minX = Math.min(...cmPts.map(p=>p.x));
        let maxX = Math.max(...cmPts.map(p=>p.x));
        let minY = Math.min(...cmPts.map(p=>p.y));
        let maxY = Math.max(...cmPts.map(p=>p.y));
        let rangeX = maxX - minX || 1;
        let rangeY = maxY - minY || 1;
        const cw = 280, ch = 240, pad = 24;
        let scale = Math.min((cw - pad*2) / rangeX, (ch - pad*2) / rangeY);
        liberoVertices = cmPts.map(p => ({
            x: pad + (p.x - minX) * scale,
            y: pad + (p.y - minY) * scale
        }));

        // Chiudi modal e applica
        closeLiberoMisureModal();
        drawLiberoFinalLayer();
    }

    function getStepShapeData() {
        const type = document.getElementById('techStepShapeType').value;
        if (!type) return null;

        let obj = { tipo: type };
        obj.profiloBordo = document.getElementById('techProfiloFrontale').value;
        
        // Count number of selected edges
        let edgesToro = document.querySelectorAll(`#svg-${type} .edge-toro`).length;
        obj.numLatiToro = edgesToro;
        
        let edgesBatti = document.querySelectorAll(`#svg-${type} .edge-batti`).length;
        obj.numLatiBatti = edgesBatti;
        
        // Calcola anche i metri esatti (unità per singola rampa/pezzo)
        let exactMlTori = 0;
        let exactMlBatti = 0;
        let toriArr = [];
        let shapeEdges = { toro: [], batti: [], attacco: [] };
        
        function measureEdge(id, lengthCm, edgeRole) {
            const el = document.getElementById(id);
            if (!el) return;
            let m = (parseFloat(lengthCm) || 0) / 100;
            if (el.classList.contains('edge-toro')) {
                exactMlTori += m;
                toriArr.push(m);
                if(edgeRole) shapeEdges.toro.push(edgeRole);
            }
            if (el.classList.contains('edge-batti')) {
                exactMlBatti += m;
                if(edgeRole) shapeEdges.batti.push(edgeRole);
            }
            if (el.classList.contains('edge-attacco')) {
                if(edgeRole) shapeEdges.attacco.push(edgeRole);
            }
        }

        if (type === 'pianerottolo') {
            obj.latoUp = document.getElementById('dimPianLung').value;
            obj.latoDx = document.getElementById('dimPianProf').value;
            obj.latoDown = document.getElementById('dimPianGiu').value;
            obj.latoSx = document.getElementById('dimPianSx').value;
            let techTipoGradinoSel = document.getElementById('techTipoGradino');
            obj.label = techTipoGradinoSel ? techTipoGradinoSel.value : "Pianerottolo";
            // Uses only width and height for generic quad representation lengths
            measureEdge('line-pian-top', obj.latoUp, 'top');
            measureEdge('line-pian-right', obj.latoDx, 'right');
            measureEdge('line-pian-bottom', obj.latoDown || obj.latoUp, 'bottom');
            measureEdge('line-pian-left', obj.latoSx || obj.latoDx, 'left');
        } else if (type === 'rettangolare') {
            obj.latoUp = document.getElementById('dimRetLung').value;
            obj.latoDx = document.getElementById('dimRetProf').value;
            obj.latoDown = obj.latoUp;
            obj.latoSx = obj.latoDx;
            obj.label = "Gradino standard";
            measureEdge('line-ret-top', obj.latoUp, 'top');
            measureEdge('line-ret-right', obj.latoDx, 'right');
            measureEdge('line-ret-bottom', obj.latoUp, 'bottom');
            measureEdge('line-ret-left', obj.latoDx, 'left');
        } else if (type === 'pie_sx') {
            obj.latoUp = document.getElementById('dimPieSxTop').value;
            obj.latoSx = document.getElementById('dimPieSxLeft').value;
            let dg = document.getElementById('dimPieSxDiag');
            let manualDg = (dg && dg.dataset.manual === 'true') ? parseFloat((dg.value||'').replace(',','.')) : NaN;
            let wT = parseFloat((obj.latoUp||'').replace(',','.')) || 0;
            let hL = parseFloat((obj.latoSx||'').replace(',','.')) || 0;
            obj.diag = (!isNaN(manualDg) && manualDg > 0) ? manualDg.toFixed(2) : Math.sqrt(Math.pow(wT, 2) + Math.pow(hL, 2)).toFixed(2);
            obj.label = "Piè d'oca sx";
            measureEdge('line-piesx-top', obj.latoUp, 'top');
            measureEdge('line-piesx-left', obj.latoSx, 'left');
            measureEdge('line-piesx-diag', obj.diag, 'diag');
        } else if (type === 'pie_dx') {
            obj.latoUp = document.getElementById('dimPieDxTop').value;
            obj.latoDx = document.getElementById('dimPieDxRight').value;
            let dg = document.getElementById('dimPieDxDiag');
            let manualDg = (dg && dg.dataset.manual === 'true') ? parseFloat((dg.value||'').replace(',','.')) : NaN;
            let wT = parseFloat((obj.latoUp||'').replace(',','.')) || 0;
            let hR = parseFloat((obj.latoDx||'').replace(',','.')) || 0;
            obj.diag = (!isNaN(manualDg) && manualDg > 0) ? manualDg.toFixed(2) : Math.sqrt(Math.pow(wT, 2) + Math.pow(hR, 2)).toFixed(2);
            obj.label = "Piè d'oca dx";
            measureEdge('line-piedx-top', obj.latoUp, 'top');
            measureEdge('line-piedx-right', obj.latoDx, 'right');
            measureEdge('line-piedx-diag', obj.diag, 'diag');
        } else if (type === 'pie_sx_chius') {
            obj.latoUp = document.getElementById('dimPieSxChiusTop').value;
            obj.latoDx = document.getElementById('dimPieSxChiusRight').value;
            let dg = document.getElementById('dimPieSxChiusDiag');
            let manualDg = (dg && dg.dataset.manual === 'true') ? parseFloat((dg.value||'').replace(',','.')) : NaN;
            let wT = parseFloat((obj.latoUp||'').replace(',','.')) || 0;
            let hL = parseFloat((obj.latoDx||'').replace(',','.')) || 0;
            obj.diag = (!isNaN(manualDg) && manualDg > 0) ? manualDg.toFixed(2) : Math.sqrt(Math.pow(wT, 2) + Math.pow(hL, 2)).toFixed(2);
            obj.label = "Piè d'oca sx (chiusura)";
            measureEdge('line-piesxchius-top', obj.latoUp, 'top');
            measureEdge('line-piesxchius-right', obj.latoDx, 'right');
            measureEdge('line-piesxchius-diag', obj.diag, 'diag');
        } else if (type === 'pie_dx_chius') {
            obj.latoUp = document.getElementById('dimPieDxChiusTop').value;
            obj.latoSx = document.getElementById('dimPieDxChiusLeft').value;
            let dg = document.getElementById('dimPieDxChiusDiag');
            let manualDg = (dg && dg.dataset.manual === 'true') ? parseFloat((dg.value||'').replace(',','.')) : NaN;
            let wT = parseFloat((obj.latoUp||'').replace(',','.')) || 0;
            let hR = parseFloat((obj.latoSx||'').replace(',','.')) || 0;
            obj.diag = (!isNaN(manualDg) && manualDg > 0) ? manualDg.toFixed(2) : Math.sqrt(Math.pow(wT, 2) + Math.pow(hR, 2)).toFixed(2);
            obj.label = "Piè d'oca dx (chiusura)";
            measureEdge('line-piedxchius-top', obj.latoUp, 'top');
            measureEdge('line-piedxchius-left', obj.latoSx, 'left');
            measureEdge('line-piedxchius-diag', obj.diag, 'diag');
        } else if (type === 'libero') {
            obj.label = "Gradino Libero";
            if (!liberoVertices || liberoVertices.length < 3) {
                alert("Completa il disegno manuale poligonale chiudendo la figura.");
                return null;
            }
            if (document.getElementById('libero-interactive-svg').style.pointerEvents !== 'all') {
                alert("Assicurati di aver chiuso la figura cliccando sul punto iniziale.");
                return null;
            }

            // Vertici normalizzati (0-1) per il render 2D basati sulle misure reali in cm
            let vertsToNorm = (liberoRealCmVertices && liberoRealCmVertices.length >= 3) ? liberoRealCmVertices : liberoVertices;
            let minX = Math.min(...vertsToNorm.map(v=>v.x));
            let maxX = Math.max(...vertsToNorm.map(v=>v.x));
            let minY = Math.min(...vertsToNorm.map(v=>v.y));
            let maxY = Math.max(...vertsToNorm.map(v=>v.y));
            let wPx = maxX - minX || 1;
            let hPx = maxY - minY || 1;
            let normV = vertsToNorm.map(v => ({
                x: (v.x - minX) / wPx,
                y: (v.y - minY) / hPx
            }));
            obj.customVertices = normV; // Passa array di oggetti direttamente, verrà jsonificato correttamente con data

            // Dimensioni reali: usa liberoRealCmVertices se disponibili, altrimenti bounding box pixel proporzionale
            if (liberoRealCmVertices && liberoRealCmVertices.length >= 3) {
                let rxArr = liberoRealCmVertices.map(v => v.x);
                let ryArr = liberoRealCmVertices.map(v => v.y);
                let realW = Math.max(...rxArr) - Math.min(...rxArr);
                let realH = Math.max(...ryArr) - Math.min(...ryArr);
                obj.latoUp = realW > 0 ? realW.toFixed(1) : '0';
                obj.latoDx = realH > 0 ? realH.toFixed(1) : '0';
            } else {
                obj.latoUp = '0'; obj.latoDx = '0';
            }
            obj.latoDown = "0"; obj.latoSx = "0";
            let vertsForMeasure = liberoRealCmVertices && liberoRealCmVertices.length >= 3 ? liberoRealCmVertices : [];
            for(let i=0; i<liberoVertices.length; i++) {
                let lenCm = 0;
                if (vertsForMeasure.length > 0) {
                    let p1 = vertsForMeasure[i];
                    let p2 = vertsForMeasure[(i+1) % vertsForMeasure.length];
                    let dx = p2.x - p1.x, dy = p2.y - p1.y;
                    lenCm = Math.sqrt(dx*dx + dy*dy);
                }
                measureEdge(`line-libero-${i}`, lenCm, `line${i}`);
            }
            // Calcola area reale con formula di Shoelace
            if (liberoRealCmVertices && liberoRealCmVertices.length >= 3) {
                let rverts = liberoRealCmVertices;
                let area = 0;
                let n = rverts.length;
                for (let k = 0; k < n; k++) {
                    let next = (k + 1) % n;
                    area += rverts[k].x * rverts[next].y;
                    area -= rverts[next].x * rverts[k].y;
                }
                area = Math.abs(area) / 2; // cm²
                obj.liberoMqM2 = (area / 10000).toFixed(4); // m²
            }
        }
        
        obj.unitMlTori = exactMlTori;
        obj.unitMlBatti = exactMlBatti;
        obj.toriArr = toriArr;
        obj.shapeEdgesJson = JSON.stringify(shapeEdges);
        
        let numLatiAlzataBatti = 0;
        obj.alzBattiSx = false;
        obj.alzBattiDx = false;
        if (document.getElementById('chkAlzBattiSx') && document.getElementById('chkAlzBattiSx').checked) { numLatiAlzataBatti++; obj.alzBattiSx = true; }
        if (document.getElementById('chkAlzBattiDx') && document.getElementById('chkAlzBattiDx').checked) { numLatiAlzataBatti++; obj.alzBattiDx = true; }
        obj.numLatiAlzataBatti = numLatiAlzataBatti;
        
        let alzCm = parseFloat(document.getElementById('dimAlzataSagoma') ? document.getElementById('dimAlzataSagoma').value : 0);
        obj.alzataH = alzCm > 0 ? (alzCm / 100).toFixed(2) : '';
        
        let rivConAlz = document.getElementById('radRivConAlz');
        obj.alzMq = rivConAlz ? rivConAlz.checked : true;
        
        return obj;
    }

    function addShapeToStairsTableWrapper() {
        // Blocca se il pannello di inserimento segmento è aperto (utente sta ancora disegnando)
        const segPanel = document.getElementById('libero-segment-panel');
        if (segPanel && segPanel.style.display !== 'none') {
            return; // Ignora silenziosamente - l'utente sta inserendo una misura
        }
        try {
            const data = getStepShapeData();
            if(!data) {
                alert("Seleziona prima una forma di gradino.");
                return;
            }
            
            const qtaInput = document.getElementById('dimQtaGradini');
            data.qta = qtaInput ? (parseInt(qtaInput.value) || 1) : 1;

            if (data.tipo !== 'rettangolare') {
                showDirectionMenu(data);
            } else {
                addShapeToStairsTable(data, 'straight', 'center'); 
            }
        } catch(e) {
            console.error(e);
            alert("Si è verificato un errore durante l'inserimento: " + e.message);
        }
    }

    function showDirectionMenu(data) {
        let overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0'; overlay.style.left = '0';
        overlay.style.width = '100vw'; overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';

        let modal = document.createElement('div');
        modal.style.background = '#fff'; modal.style.padding = '20px';
        modal.style.borderRadius = '12px'; modal.style.maxWidth = '400px';
        modal.style.width = '90%'; modal.style.boxShadow = '0 15px 30px rgba(0,0,0,0.3)';

        let title = document.createElement('h3');
        title.innerHTML = '<i class="fa-solid fa-diamond-turn-right"></i> Direzione Scala';
        title.style.marginTop = '0'; title.style.color = '#1e293b';

        let desc = document.createElement('p');
        desc.innerText = "Dove proseguirà la scala DOPO questo pezzo speciale?";
        desc.style.marginBottom = '20px'; desc.style.color = '#475569';

        let createBtn = (html, color, onClick) => {
            let b = document.createElement('button');
            b.innerHTML = html;
            b.style.display = 'block'; b.style.width = '100%'; b.style.marginBottom = '10px';
            b.style.padding = '12px'; b.style.fontSize = '1em'; b.style.fontWeight = 'bold';
            b.style.borderRadius = '8px'; b.style.border = 'none'; b.style.cursor = 'pointer';
            b.style.background = color || '#f1f5f9';
            b.style.color = color ? '#fff' : '#1e293b';
            b.onclick = onClick;
            return b;
        };

        let btnU = createBtn('â†‘ Prosegue DRITTO', '#0ea5e9', () => { document.body.removeChild(overlay); addShapeToStairsTable(data, 'straight', 'center'); });
        let btnDx = createBtn('â†± Curva a DESTRA (90°)', '#3b82f6', () => { document.body.removeChild(overlay); addShapeToStairsTable(data, 'right', 'left'); });
        let btnSx = createBtn('â†° Curva a SINISTRA (90°)', '#3b82f6', () => { document.body.removeChild(overlay); addShapeToStairsTable(data, 'left', 'right'); });
        let btnUDx = createBtn('â†¶ Inversione U a DESTRA (180°)', '#6366f1', () => { document.body.removeChild(overlay); addShapeToStairsTable(data, 'uturn', 'left'); });
        let btnUSx = createBtn('â†· Inversione U a SINISTRA (180°)', '#6366f1', () => { document.body.removeChild(overlay); addShapeToStairsTable(data, 'uturn', 'right'); });
        
        // Se è un "pianerottolo di arrivo", non c'è una rampa successiva. 
        // Ma per il 3D non cambia nulla, per default diamo dritto.
        let btnEnd = createBtn('â¹ï¸ Fine Scala (Arrivo)', '#10b981', () => { document.body.removeChild(overlay); addShapeToStairsTable(data, 'straight', 'center'); });

        let cancelBtn = createBtn('Annulla', null, () => document.body.removeChild(overlay));
        cancelBtn.style.marginTop = '15px';

        modal.appendChild(title); modal.appendChild(desc);
        modal.appendChild(btnU); modal.appendChild(btnDx); modal.appendChild(btnSx);
        modal.appendChild(btnUDx); modal.appendChild(btnUSx); modal.appendChild(btnEnd);
        modal.appendChild(cancelBtn);
        overlay.appendChild(modal); document.body.appendChild(overlay);
    }

    function addShapeToStairsTable(data, dirOverride = 'straight', alignOverride = 'center') {
        let w = 0; // Lunghezza (m)
        let p = 0; // Pedata (m)
        let name = data.label;
        
        if (data.tipo === 'pianerottolo') {
            w = parseFloat(data.latoUp) || 0;
            p = parseFloat(data.latoDx) || 0;
        } else if (data.tipo === 'rettangolare') {
            w = parseFloat(data.latoUp) || 0;
            p = parseFloat(data.latoDx) || 0;
        } else if (data.tipo === 'pie_sx') {
            w = parseFloat(data.latoUp) || 0;
            p = parseFloat(data.latoSx) || 0;
        } else if (data.tipo === 'pie_dx') {
            w = parseFloat(data.latoUp) || 0;
            p = parseFloat(data.latoDx) || 0;
        } else if (data.tipo === 'libero') {
            // latoUp = larghezza bounding box in cm, latoDx = pedata bounding box in cm
            w = parseFloat(data.latoUp) || 0;
            p = parseFloat(data.latoDx) || 0;
        }
        
        // Convert to meters
        w = w > 0 ? (w / 100).toFixed(2) : '';
        p = p > 0 ? (p / 100).toFixed(2) : '';
        
        let exactTori = data.unitMlTori || 0;
        let exactBatti = data.unitMlBatti || 0;
        let toriArrStr = data.toriArr && data.toriArr.length > 0 ? data.toriArr.join(',') : '';
        
        let userAlzata = data.alzataH || '';
        let qta = data.qta || 1;
        
        addStairRow(name, qta, w, p, userAlzata, data.alzMq, data.numLatiBatti || 0, data.numLatiAlzataBatti, data.numLatiToro || 0, '', '', '', '', exactBatti, exactTori, toriArrStr, data.shapeEdgesJson || '');
        
        const trs = document.querySelectorAll('#stairsTableBody tr');
        if (trs.length > 0) {
            let lastRow = trs[trs.length - 1];
            
            let dirSelect = lastRow.querySelector('.tbl-str-dir');
            if (dirSelect) dirSelect.value = dirOverride;
            
            let alignSelect = lastRow.querySelector('.tbl-str-align');
            if (alignSelect) alignSelect.value = alignOverride;

            lastRow.dataset.shapeData = JSON.stringify(data);
            // Per gradino libero: salva l'area Shoelace precalcolata
            if (data.liberoMqM2) {
                lastRow.dataset.liberoMqM2 = data.liberoMqM2;
            }
            
            calcStairRow(lastRow.querySelector('.tbl-str-qta'));
        }
        
        const btn = document.querySelector('#step-dimensions-container .btn-success');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-check"></i> Aggiunto!`;
        btn.style.background = "#059669";
        setTimeout(() => {
            btn.innerHTML = oldHtml;
            btn.style.background = ""; 
        }, 1500);
    }

    // --- Tabella Scale ---
    function addStairRow(tipo = '', qta = '1', larg = '', pedata = '', alzata = '', alzMq = true, lati = '0', latiAlzDef = null, tori = '0', mqCad = '', mqTot = '', mlBatti = '', mlTori = '', exactUnitBatti = '', exactUnitTori = '', toriArrStr = '', shapeEdgesJson = '') {
        const qtaNum = parseInt(qta) || 1;
        if (qtaNum > 1) {
            for (let i = 0; i < qtaNum; i++) {
                addStairRow(tipo, '1', larg, pedata, alzata, alzMq, lati, latiAlzDef, tori, mqCad, mqTot, mlBatti, mlTori, exactUnitBatti, exactUnitTori, toriArrStr, shapeEdgesJson);
            }
            if (typeof SopralluogoApp !== 'undefined' && typeof SopralluogoApp.calcStairsTot === 'function') {
                SopralluogoApp.calcStairsTot();
            } else if (typeof calcStairsTotals === 'function') {
                calcStairsTotals();
            }
            return;
        }

        const tbody = document.getElementById('stairsTableBody');
        
        if (alzata === '') {
            const firstRowAlz = tbody.querySelector('tr:first-child .tbl-str-alzata');
            if (firstRowAlz && firstRowAlz.value) {
                alzata = firstRowAlz.value;
            }
        }
        
        // Auto-determine default alzata battiscopa count
        let latiP = parseInt(lati) || 0;
        let latiA = latiP;
        if (latiP === 3) latiA = 2; // Usually back wall doesn't have an alzata
        
        // Business rule: if alzata is covered in wood (alzMq true), no skirting board on it by default
        if (alzMq) {
            latiA = 0; 
        }
        
        // If passed explicitly from signature (like Supabase reload or future use)
        if (latiAlzDef !== null) {
            latiA = parseInt(latiAlzDef) || 0;
        }
        
        const tr = document.createElement('tr');
        
        tr.dataset.originalLatiP = latiP;
        tr.dataset.originalLatiA = latiA;
        
        if (exactUnitBatti !== '' && exactUnitBatti > 0) tr.dataset.exactBatti = exactUnitBatti;
        if (exactUnitTori !== '' && exactUnitTori > 0) tr.dataset.exactTori = exactUnitTori;
        if (toriArrStr !== '') tr.dataset.toriArr = toriArrStr;
        
        let safeTipo = tipo ? tipo.toString().trim() : '';
        let matchedTipo = ["Piè d'oca sx (chiusura)", "Piè d'oca dx (chiusura)", 'Gradino standard', 'Pianerottolo', 'Rampa dritta', "Piè d'oca sx", "Piè d'oca dx", "Gradino d'avvio", 'Scala a Chiocciola (Radiale)', 'Giro a Sx', 'Giro a Dx'].find(t => safeTipo.toLowerCase().includes(t.toLowerCase())) || safeTipo;

        let stepDir = 'straight';
        let stepAlign = 'center';
        let initialBlueline = 'auto';
        
        let shapeEdges = {};
        if (shapeEdgesJson) {
            try { shapeEdges = JSON.parse(shapeEdgesJson); } catch(e) {}
        }
        
        if (shapeEdges.attacco && shapeEdges.attacco.length > 0) {
            initialBlueline = shapeEdges.attacco[0];
        }

        tr.innerHTML = `
            <td style="padding: 4px; border: 1px solid #e2e8f0; text-align:center; color:#a78bfa; cursor:grab;" title="Trascina per riordinare"><i class="fa-solid fa-grip-vertical"></i></td>
            <td style="padding: 4px; border: 1px solid #e2e8f0; position:relative;">
                <select style="width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:3px; padding:4px;" class="tbl-str-tipo" onchange="SopralluogoApp.calcStairsTotals()">
                    <option value="" ${!matchedTipo ? 'selected' : ''}>- Seleziona -</option>
                    <option value="Gradino standard" ${matchedTipo === 'Gradino standard' ? 'selected' : ''}>Gradino standard</option>
                    <option value="Pianerottolo" ${matchedTipo === 'Pianerottolo' ? 'selected' : ''}>Pianerottolo</option>
                    <option value="Rampa dritta" ${matchedTipo === 'Rampa dritta' ? 'selected' : ''}>Rampa dritta</option>
                    <option value="Giro a Sx" ${matchedTipo === 'Giro a Sx' ? 'selected' : ''}>Giro a Sx</option>
                    <option value="Giro a Dx" ${matchedTipo === 'Giro a Dx' ? 'selected' : ''}>Giro a Dx</option>
                    <option value="Piè d'oca sx" ${matchedTipo === "Piè d'oca sx" ? 'selected' : ''}>Piè d'oca sx</option>
                    <option value="Piè d'oca dx" ${matchedTipo === "Piè d'oca dx" ? 'selected' : ''}>Piè d'oca dx</option>
                    <option value="Piè d'oca sx (chiusura)" ${matchedTipo === "Piè d'oca sx (chiusura)" ? 'selected' : ''}>Piè d'oca sx (chiusura)</option>
                    <option value="Piè d'oca dx (chiusura)" ${matchedTipo === "Piè d'oca dx (chiusura)" ? 'selected' : ''}>Piè d'oca dx (chiusura)</option>
                    <option value="Gradino d'avvio" ${matchedTipo === "Gradino d'avvio" ? 'selected' : ''}>Gradino d'avvio</option>
                    <option value="Scala a Chiocciola (Radiale)" ${matchedTipo === 'Scala a Chiocciola (Radiale)' ? 'selected' : ''}>Scala a Chiocciola</option>
                    ${matchedTipo && !["Piè d'oca sx (chiusura)", "Piè d'oca dx (chiusura)", 'Gradino standard', 'Pianerottolo', 'Rampa dritta', "Piè d'oca sx", "Piè d'oca dx", "Gradino d'avvio", 'Scala a Chiocciola (Radiale)', 'Giro a Sx', 'Giro a Dx'].includes(matchedTipo) ? `<option value="${matchedTipo.replace(/"/g, '&quot;')}" selected>${matchedTipo}</option>` : ''}
                </select>
                <div style="margin-top:2px; display:none; background:#f8fafc; border:1px solid #e2e8f0; border-radius:3px; padding:2px; text-align:center;" class="tbl-str-diag-info-container">
                    <span style="font-size:0.75rem; color:#475569; font-weight:bold;"><i class="fa-solid fa-ruler-combined"></i> Ipotenusa (Diagonale): <span class="tbl-str-diag-val" style="color:#d946ef;">0.00</span> m</span>
                </div>
                <div style="margin-top:2px;">
                    <select style="width:48%; background:#f8fafc; border:1px solid #cbd5e1; border-radius:3px; padding:2px; font-size:0.8rem;" class="tbl-str-dir no-print" onchange="SopralluogoApp.calcStairsTotals()">
                        <option value="straight" ${stepDir==='straight'?'selected':''}>Dritta</option>
                        <option value="left" ${stepDir==='left'?'selected':''}>Svolta a Sx (90°)</option>
                        <option value="right" ${stepDir==='right'?'selected':''}>Svolta a Dx (90°)</option>
                        <option value="left45" ${stepDir==='left45'?'selected':''}>Svolta a Sx (45°)</option>
                        <option value="right45" ${stepDir==='right45'?'selected':''}>Svolta a Dx (45°)</option>
                        <option value="left30" ${stepDir==='left30'?'selected':''}>Svolta a Sx (30°)</option>
                        <option value="right30" ${stepDir==='right30'?'selected':''}>Svolta a Dx (30°)</option>
                        <option value="uturn" ${stepDir==='uturn'?'selected':''}>Inversione a U (180°)</option>
                    </select>
                    <select style="width:48%; background:#f8fafc; border:1px solid #cbd5e1; border-radius:3px; padding:2px; font-size:0.8rem;" class="tbl-str-align no-print" onchange="SopralluogoApp.calcStairsTotals()">
                        <option value="center" ${stepAlign==='center'?'selected':''}>Centrato</option>
                        <option value="left" ${stepAlign==='left'?'selected':''}>Allineato a Sx (Filo Sx)</option>
                        <option value="right" ${stepAlign==='right'?'selected':''}>Allineato a Dx (Filo Dx)</option>
                    </select>
                </div>
                <input type="hidden" class="tbl-str-blueline" value="${initialBlueline}">
                <div style="margin-top:2px; display:flex; gap:4px; font-size:0.8rem; align-items:center;" class="no-print">
                    <label title="Offset orizzontale: sposta a destra/sinistra (cm)" style="display:flex; align-items:center; gap:2px;"><i class="fa-solid fa-arrows-left-right"></i> <input type="number" step="0.01" style="width:50px; border:1px solid #ccc;" class="tbl-str-offx" value="0.00" onchange="SopralluogoApp.calcStairsTotals()"></label>
                    <label title="Offset verticale: sposta avanti/indietro (cm)" style="display:flex; align-items:center; gap:2px;"><i class="fa-solid fa-arrows-up-down"></i> <input type="number" step="0.01" style="width:50px; border:1px solid #ccc;" class="tbl-str-offz" value="0.00" onchange="SopralluogoApp.calcStairsTotals()"></label>
                </div>
            </td>
            <td style="padding: 4px; border: 1px solid #e2e8f0;"><input type="number" step="1" min="1" style="width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:3px; padding:4px;" class="tbl-str-qta" value="${parseInt(qta) || 1}" oninput="this.value = parseInt(this.value)||1; SopralluogoApp.calcStairRow(this)"></td>
            <td style="padding: 4px; border: 1px solid #e2e8f0;"><input type="number" step="0.01" style="width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:3px; padding:4px;" class="tbl-str-larg" value="${larg}" oninput="SopralluogoApp.calcStairRow(this)"></td>
            <td style="padding: 4px; border: 1px solid #e2e8f0;"><input type="number" step="0.01" style="width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:3px; padding:4px;" class="tbl-str-pedata" value="${pedata}" oninput="SopralluogoApp.calcStairRow(this)"></td>
            <td style="padding: 4px; border: 1px solid #e2e8f0;"><div style="display:flex; align-items:center; gap:2px;"><input type="number" step="0.01" style="width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:3px; padding:4px;" class="tbl-str-alzata" value="${alzata}" oninput="SopralluogoApp.calcStairRow(this)"><input type="checkbox" title="Rivesti Alzata in Legno (Includi nei Mq)" class="tbl-str-alz-mq" ${alzMq ? 'checked' : ''} onchange="SopralluogoApp.syncLatiAlz(this); SopralluogoApp.calcStairRow(this)" style="width:16px; height:16px; cursor:pointer;"></div></td>
            <td style="padding: 4px; border: 1px solid #e2e8f0;">
                <input type="number" step="1" style="width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:3px; padding:4px;" class="tbl-str-lati" value="${lati}" oninput="SopralluogoApp.calcStairRow(this)" title="Battiscopa su Pedata">
                <input type="number" step="1" style="width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:3px; padding:4px; margin-top:2px; font-size:10px;" class="tbl-str-lati-alz" value="${latiA}" oninput="SopralluogoApp.calcStairRow(this)" title="Battiscopa su Alzata (Muro Orizzontale)">
                <input type="hidden" class="tbl-str-edges" value="${shapeEdgesJson ? shapeEdgesJson.replace(/"/g, '&quot;') : ''}">
            </td>
            <td style="padding: 4px; border: 1px solid #e2e8f0;"><input type="number" step="1" min="0" max="4" style="width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:3px; padding:4px;" class="tbl-str-tori" value="${tori}" oninput="SopralluogoApp.calcStairRow(this)"></td>
            <td style="padding: 4px; border: 1px solid #e2e8f0;"><input type="number" step="0.01" style="width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:3px; padding:4px; background:#f1f5f9;" class="tbl-str-mqcad" value="${mqCad}" disabled></td>
            <td style="padding: 4px; border: 1px solid #e2e8f0;"><input type="number" step="0.01" style="width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:3px; padding:4px; font-weight:bold; background:#e0f2fe; color:#0369a1;" class="tbl-str-mqtot" value="${mqTot}" oninput="SopralluogoApp.calcStairsTotals()"></td>
            <td style="padding: 4px; border: 1px solid #e2e8f0;"><input type="number" step="0.01" style="width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:3px; padding:4px; font-weight:bold; background:#fce7f3; color:#be185d;" class="tbl-str-mlbatti" value="${mlBatti}" oninput="SopralluogoApp.calcStairsTotals()"></td>
            <td style="padding: 4px; border: 1px solid #e2e8f0;"><input type="number" step="0.01" style="width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:3px; padding:4px; font-weight:bold; background:#ede9fe; color:#6d28d9;" class="tbl-str-mltori" value="${mlTori}" oninput="SopralluogoApp.calcStairsTotals()"></td>
            <td style="padding: 4px; border: 1px solid #e2e8f0; text-align:center; min-width:85px;">
                <button type="button" style="color:#059669; background:none; border:none; cursor:pointer; margin-right:8px; font-size:14px;" onclick="SopralluogoApp.editStairRow(this)" title="Modifica Sagoma"><i class="fa-solid fa-pen"></i></button>
                <button type="button" style="color:#2563eb; background:none; border:none; cursor:pointer; margin-right:8px; font-size:14px;" onclick="SopralluogoApp.duplicateStairRow(this)" title="Duplica Riga"><i class="fa-solid fa-copy"></i></button>
                <button type="button" style="color:#ef4444; background:none; border:none; cursor:pointer; font-size:14px;" onclick="this.closest('tr').remove(); SopralluogoApp.calcStairsTotals();" title="Elimina Riga"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    }

    function duplicateStairRow(btn) {
        const tr = btn.closest('tr');
        
        // Estrai tutti i valori attuali della riga
        const tipo = tr.querySelector('.tbl-str-tipo').value;
        const qta = tr.querySelector('.tbl-str-qta').value;
        const larg = tr.querySelector('.tbl-str-larg').value;
        const pedata = tr.querySelector('.tbl-str-pedata').value;
        const alzata = tr.querySelector('.tbl-str-alzata').value;
        const alzMq = tr.querySelector('.tbl-str-alz-mq').checked;
        const lati = tr.querySelector('.tbl-str-lati').value;
        const latiAlz = tr.querySelector('.tbl-str-lati-alz') ? tr.querySelector('.tbl-str-lati-alz').value : '0';
        const tori = tr.querySelector('.tbl-str-tori').value;
        const exactBatti = tr.dataset.exactBatti || '';
        const exactTori = tr.dataset.exactTori || '';
        const toriArr = tr.dataset.toriArr || '';
        
        let shapeEdgesJson = '';
        const edgesInput = tr.querySelector('.tbl-str-edges');
        if (edgesInput) {
            shapeEdgesJson = edgesInput.value;
        }

        const dirVal = tr.querySelector('.tbl-str-dir') ? tr.querySelector('.tbl-str-dir').value : 'straight';
        const alignVal = tr.querySelector('.tbl-str-align') ? tr.querySelector('.tbl-str-align').value : 'center';

        // Ripeti inserimento (addStairRow ignorerà latoAlzDef siccome usiamo exact params, lo forziamo riapplicandolo se serve)
        addStairRow(tipo, qta, larg, pedata, alzata, alzMq, lati, latiAlz, tori, '', '', '', '', exactBatti, exactTori, toriArr, shapeEdgesJson, dirVal, alignVal);
        
        // La nuova riga è sempre l'ultima del tbody
        const newTr = document.querySelector('#stairsTableBody tr:last-child');
        if (newTr) {
            if (newTr.querySelector('.tbl-str-dir')) newTr.querySelector('.tbl-str-dir').value = dirVal;
            if (newTr.querySelector('.tbl-str-align')) newTr.querySelector('.tbl-str-align').value = alignVal;
            if (shapeEdgesJson) {
                newTr.querySelector('.tbl-str-edges').value = shapeEdgesJson;
            }
            // Clona anche i dati forma
            if (tr.dataset.shapeData) {
                newTr.dataset.shapeData = tr.dataset.shapeData;
            }
            
            calcStairRow(newTr.querySelector('.tbl-str-qta'));
        }
    }
    
    function editStairRow(btn) {
        const tr = btn.closest('tr');
        const shapeDataStr = tr.dataset.shapeData;
        if (!shapeDataStr) {
            alert("Questa riga è inserita a mano e non ha una sagoma grafica generata dal disegnatore 2D.");
            return;
        }
        
        if(!confirm("Vuoi caricare questa riga nel disegnatore? L'originale verrà rimossa dalla tabella per permetterti di aggiornarla.")) {
            return;
        }
        
        let data = {};
        try {
            data = JSON.parse(shapeDataStr);
        } catch(e) {
            alert("Formato dati sagoma corrotto.");
            return;
        }
        
        // Estraiamo le misure attuali dalla tabella per sincronia (se modificate in tabella)
        const currentW = (parseFloat(tr.querySelector('.tbl-str-larg').value) * 100).toFixed(0);
        const currentP = (parseFloat(tr.querySelector('.tbl-str-pedata').value) * 100).toFixed(0);
        const currentA = (parseFloat(tr.querySelector('.tbl-str-alzata').value) * 100).toFixed(0);
        
        // Impostiamo la forma base e mostriamo gli editor
        selectStepShape(data.tipo);
        
        // Ripristino delle dimensioni (usando currentW / currentP / data.lato...)
        if (data.tipo === 'pianerottolo') {
            document.getElementById('dimPianLung').value = currentW > 0 ? currentW : (data.latoUp || '');
            document.getElementById('dimPianProf').value = currentP > 0 ? currentP : (data.latoDx || '');
            document.getElementById('dimPianGiu').value = data.latoDown || '';
            document.getElementById('dimPianSx').value = data.latoSx || '';
        } else if (data.tipo === 'rettangolare') {
            document.getElementById('dimRetLung').value = currentW > 0 ? currentW : (data.latoUp || '');
            document.getElementById('dimRetProf').value = currentP > 0 ? currentP : (data.latoDx || '');
        } else if (data.tipo === 'pie_sx') {
            document.getElementById('dimPieSxTop').value = currentW > 0 ? currentW : (data.latoUp || '');
            document.getElementById('dimPieSxLeft').value = currentP > 0 ? currentP : (data.latoSx || '');
        } else if (data.tipo === 'pie_dx') {
            document.getElementById('dimPieDxTop').value = currentW > 0 ? currentW : (data.latoUp || '');
            document.getElementById('dimPieDxRight').value = currentP > 0 ? currentP : (data.latoDx || '');
        }
        
        // Alzata
        if (document.getElementById('dimAlzataSagoma')) {
            document.getElementById('dimAlzataSagoma').value = currentA > 0 ? currentA : ((parseFloat(data.alzataH)*100).toFixed(0) || '17');
        }
        if (document.getElementById('radRivConAlz') && document.getElementById('radRivSenzaAlz')) {
            let alzMqChecked = tr.querySelector('.tbl-str-alz-mq').checked;
            document.getElementById('radRivConAlz').checked = alzMqChecked;
            document.getElementById('radRivSenzaAlz').checked = !alzMqChecked;
        }
        if (document.getElementById('chkAlzBattiSx')) document.getElementById('chkAlzBattiSx').checked = data.alzBattiSx || false;
        if (document.getElementById('chkAlzBattiDx')) document.getElementById('chkAlzBattiDx').checked = data.alzBattiDx || false;
        
        // Profilo Frontale Selezionato
        if (document.getElementById('techProfiloFrontale') && data.profiloBordo) {
            document.getElementById('techProfiloFrontale').value = data.profiloBordo;
        }
        
        // Tipo Gradino
        if (document.getElementById('techTipoGradino') && data.label) {
            let opts = document.getElementById('techTipoGradino').options;
            for(let i=0; i<opts.length; i++) {
                if(opts[i].text === data.label) { opts[i].selected = true; break; }
            }
        }
        
        // Ripristina l'aspetto SVG per il posizionamento di tori e battiscopa
        try {
            let shapeEdges = JSON.parse(data.shapeEdgesJson);
            for (const lineId in shapeEdges) {
                const state = shapeEdges[lineId];
                const lineObj = document.getElementById(lineId);
                if (lineObj) {
                    lineObj.classList.remove('edge-toro', 'edge-batti');
                    if (state.class) lineObj.classList.add(state.class);
                }
            }
        } catch(e) {}
        
        drawStepShape();
        
        // Rimuoviamo la riga originale così l'utente può aggiornarla liberamente
        tr.remove();
        calcStairsTotals();
        
        // Torna su al form grafico
        document.getElementById('stairs-manual-mode').scrollIntoView({behavior: "smooth", block: "start"});
    }

    function calcStairRow(el) {
        const tr = el.closest('tr');
        const qta = parseInt(tr.querySelector('.tbl-str-qta').value) || 0;
        const larg = parseFloat(tr.querySelector('.tbl-str-larg').value) || 0;
        const pedata = parseFloat(tr.querySelector('.tbl-str-pedata').value) || 0;
        const alzata = parseFloat(tr.querySelector('.tbl-str-alzata').value) || 0;
        const alzMq = tr.querySelector('.tbl-str-alz-mq').checked;
        const lati = parseInt(tr.querySelector('.tbl-str-lati').value) || 0;
        const tori = parseInt(tr.querySelector('.tbl-str-tori').value) || 0;
        
        let areaSingola = 0;
        // Se gradino libero con area Shoelace precalcolata, usala
        const liberoMqM2 = parseFloat(tr.dataset.liberoMqM2);
        if (!isNaN(liberoMqM2) && liberoMqM2 > 0) {
            let a_alz = alzMq ? (larg * alzata) : 0;
            areaSingola = liberoMqM2 + a_alz;
            tr.querySelector('.tbl-str-mqcad').value = areaSingola.toFixed(3);
            tr.querySelector('.tbl-str-mqtot').value = (areaSingola * qta).toFixed(2);
        } else if (larg > 0 && (pedata > 0 || alzata > 0)) {
            let a_sq = alzMq ? alzata : 0;
            areaSingola = larg * (pedata + a_sq);
            tr.querySelector('.tbl-str-mqcad').value = areaSingola.toFixed(3);
            tr.querySelector('.tbl-str-mqtot').value = (areaSingola * qta).toFixed(2);
        } else {
            tr.querySelector('.tbl-str-mqcad').value = '';
        }
        
        if (lati > 0 || (tr.querySelector('.tbl-str-lati-alz') && parseInt(tr.querySelector('.tbl-str-lati-alz').value) > 0)) {
            let unitBatti = parseFloat(tr.dataset.exactBatti);
            let origLati = parseInt(tr.dataset.originalLatiP) || 0;
            
            // Se l'utente modifica esplicitamente a mano i Lati Pedata in tabella ignoriamo l'exactBatti vettoriale per evitare bug
            if (unitBatti > 0 && origLati > 0 && lati !== origLati) {
                unitBatti = 0; 
            }
            
            const latiAlz = parseInt(tr.querySelector('.tbl-str-lati-alz').value) || 0;
            let extraAlzata = alzata * latiAlz;
            
            if (isNaN(unitBatti) || unitBatti === 0) {
                // Heuristic calculation if no exact measure is available
                if (lati === 1) unitBatti = pedata;
                else if (lati === 2) unitBatti = pedata * 2;
                else if (lati === 3) unitBatti = (pedata * 2) + larg;
                else unitBatti = pedata * lati;
            }
            
            // Add risers length if requested
            let s_mlBatti = (unitBatti + extraAlzata) * qta;
            tr.querySelector('.tbl-str-mlbatti').value = s_mlBatti.toFixed(2);
        } else {
            tr.querySelector('.tbl-str-mlbatti').value = '';
        }

        if (tori > 0) {
            let unitTori = parseFloat(tr.dataset.exactTori);
            if (isNaN(unitTori) || unitTori === 0) {
                // Heuristic calculation if no exact measure is available
                if (tori === 1) unitTori = larg > 0 ? larg : (pedata + alzata);
                else if (tori === 2) unitTori = larg + pedata;
                else if (tori === 3) unitTori = larg + (pedata * 2);
                else unitTori = larg * tori;
            }
            let s_mlTori = unitTori * qta;
            tr.querySelector('.tbl-str-mltori').value = s_mlTori.toFixed(2);
        } else {
            tr.querySelector('.tbl-str-mltori').value = '';
        }
        
        calcStairsTotals();
    }

    function syncLatiAlz(el) {
        const tr = el.closest('tr');
        const alzMq = tr.querySelector('.tbl-str-alz-mq').checked;
        const latiP = parseInt(tr.querySelector('.tbl-str-lati').value) || 0;
        const latiAlzInput = tr.querySelector('.tbl-str-lati-alz');
        
        if (alzMq) {
            latiAlzInput.value = 0;
        } else {
            let origA = tr.dataset.originalLatiA;
            if (origA !== undefined) {
                latiAlzInput.value = origA;
            } else {
                let latiA = latiP;
                if (latiP === 3) latiA = 2;
                latiAlzInput.value = latiA;
            }
        }
    }

    function calcStairsTotals() {
        let totMq = 0;
        let totMl = 0;
        let totTori = 0;
        let toriGroups = {}; // raggruppamento per distinta
        
        document.querySelectorAll('#stairsTableBody tr').forEach(tr => {
            totMq += parseFloat(tr.querySelector('.tbl-str-mqtot').value) || 0;
            totMl += parseFloat(tr.querySelector('.tbl-str-mlbatti').value) || 0;
            totTori += parseFloat(tr.querySelector('.tbl-str-mltori').value) || 0;
            
            let qta = parseFloat(tr.querySelector('.tbl-str-qta').value) || 0;
            let larg = parseFloat(tr.querySelector('.tbl-str-larg').value) || 0;
            let ped = parseFloat(tr.querySelector('.tbl-str-pedata').value) || 0;
            let alz = parseFloat(tr.querySelector('.tbl-str-alzata').value) || 0;
            let tori = parseInt(tr.querySelector('.tbl-str-tori').value) || 0;
            
            const tipoSelect = tr.querySelector('.tbl-str-tipo');
            const tipo = tipoSelect ? tipoSelect.value : '';
            const diagContainer = tr.querySelector('.tbl-str-diag-info-container');
            if (diagContainer) {
                if (tipo.toLowerCase().includes('oca')) {
                    let diag = Math.sqrt(larg*larg + ped*ped);
                    tr.querySelector('.tbl-str-diag-val').innerText = diag.toFixed(2);
                    diagContainer.style.display = 'block';
                } else {
                    diagContainer.style.display = 'none';
                }
            }
            
            if (tori > 0) {
                let toriArrStr = tr.dataset.toriArr;
                let mlToriTotalRow = parseFloat(tr.querySelector('.tbl-str-mltori').value) || 0;
                
                let processedArr = false;
                if (toriArrStr) {
                    let arr = toriArrStr.split(',').map(Number);
                    
                    // Controlliamo se la somma dell'array corrisponde ancora a quella nella cella (al netto degli arrotondamenti)
                    // Se l'utente ha modificato "Ml Tori" a mano nella tabella, non dobbiamo forzare le lunghezze vecchie
                    let sumArr = arr.reduce((a, b) => a + b, 0);
                    let expectedTotalRow = sumArr * qta;
                    let isManuallyOverridden = Math.abs(expectedTotalRow - mlToriTotalRow) > 0.03;
                    
                    if (arr.length === tori && !isManuallyOverridden) { // If count matches and no manual override, use exact array
                         arr.forEach(len => {
                             let key = len.toFixed(2);
                             if (!toriGroups[key]) toriGroups[key] = { count: 0, ml: 0 };
                             toriGroups[key].count += qta;
                             toriGroups[key].ml += (len * qta);
                         });
                         processedArr = true;
                    }
                }
                
                if (!processedArr && mlToriTotalRow > 0) {
                    // Fallback using average
                    let avgLen = mlToriTotalRow / (qta * tori);
                    let key = avgLen.toFixed(2);
                    if(!toriGroups[key]) toriGroups[key] = { count: 0, ml: 0 };
                    let pieces = qta * tori;
                    toriGroups[key].count += pieces;
                    toriGroups[key].ml += mlToriTotalRow;
                }
            }
        });
        
        document.getElementById('tblTotStairsMq').innerText = totMq.toFixed(2);
        document.getElementById('tblTotStairsMl').innerText = totMl.toFixed(2);
        const tblTotStairsTori = document.getElementById('tblTotStairsTori');
        if(tblTotStairsTori) tblTotStairsTori.innerText = totTori.toFixed(2);
        
        // Render Distinta Tori in HTML
        const summaryDiv = document.getElementById('stairsToriSummary');
        if (summaryDiv) {
            if (Object.keys(toriGroups).length > 0) {
                let html = '<div style="font-weight: 700; color: #5b21b6; margin-bottom: 8px;"><i class="fa-solid fa-list-ul"></i> Distinta Lavorazioni (Spigoli/Toro):</div><ul style="list-style: none; padding-left: 0; margin-bottom: 0;">';
                for (let k in toriGroups) {
                    html += `<li style="margin-bottom:4px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">- Lunghezza <strong>${k} m</strong>: N° <strong>${toriGroups[k].count}</strong> pezzi (Parziale: <strong>${toriGroups[k].ml.toFixed(2)} ml</strong>)</li>`;
                }
                html += `</ul>`;
                summaryDiv.innerHTML = html;
                summaryDiv.style.display = 'block';
            } else {
                summaryDiv.style.display = 'none';
            }
        }
        
        update3DStairs();
    }

    function applyAlzataToAll() {
        const trs = document.querySelectorAll('#stairsTableBody tr');
        if (trs.length === 0) return;
        
        const firstAlzata = trs[0].querySelector('.tbl-str-alzata').value;
        if (firstAlzata === '') return; // Skip if empty
        
        for (let i = 1; i < trs.length; i++) {
            trs[i].querySelector('.tbl-str-alzata').value = firstAlzata;
        }
        recalcAllStairs();
    }
    
    function recalcAllStairs() {
        document.querySelectorAll('#stairsTableBody tr').forEach(tr => {
            calcStairRow(tr.querySelector('.tbl-str-qta'));
        });
    }

    function getStairsData() {
        const rows = [];
        document.querySelectorAll('#stairsTableBody tr').forEach(tr => {
            rows.push({
                tipo: tr.querySelector('.tbl-str-tipo').value,
                qta: tr.querySelector('.tbl-str-qta').value,
                larg: tr.querySelector('.tbl-str-larg').value,
                pedata: tr.querySelector('.tbl-str-pedata').value,
                alzata: tr.querySelector('.tbl-str-alzata').value,
                alzMq: tr.querySelector('.tbl-str-alz-mq').checked,
                lati: tr.querySelector('.tbl-str-lati').value || '0',
                latiAlz: tr.querySelector('.tbl-str-lati-alz') ? tr.querySelector('.tbl-str-lati-alz').value : '0',
                tori: tr.querySelector('.tbl-str-tori').value || '0',
                mqcad: tr.querySelector('.tbl-str-mqcad').value,
                mqtot: tr.querySelector('.tbl-str-mqtot').value,
                mlbatti: tr.querySelector('.tbl-str-mlbatti').value,
                mltori: tr.querySelector('.tbl-str-mltori').value,
                toriArrStr: tr.dataset.toriArr || '',
                exactUnitTori: tr.dataset.exactUnitTori || '',
                exactUnitBatti: tr.dataset.exactUnitBatti || '',
                manualOffsets: tr.dataset.manualOffsets || '{}',
                stepDir: tr.querySelector('.tbl-str-dir') ? tr.querySelector('.tbl-str-dir').value : 'straight',
                stepAlign: tr.querySelector('.tbl-str-align') ? tr.querySelector('.tbl-str-align').value : 'center'
            });
        });
        return rows;
    }

    function getFormData() {
        return {
            clientName: document.getElementById('clientName').value.trim(),
            clientCantiere: document.getElementById('clientCantiere').value.trim(),
            clientUnita: document.getElementById('clientUnita').value.trim(),
            clientImpresa: document.getElementById('clientImpresa').value.trim(),
            clientAddress: document.getElementById('clientAddress').value.trim(),
            clientTelefono: document.getElementById('clientTelefono').value.trim(),
            clientEmail: document.getElementById('clientEmail').value.trim(),
            clientPosatore: document.getElementById('clientPosatore').value.trim(),
            clientTempi: document.getElementById('clientTempi').value.trim(),
            
            techMateriale: document.getElementById('techMateriale').value.trim(),
            techPosa: document.getElementById('techPosa').value.trim(),
            techPosaData: getPosaData(), // struttura JSON per ripristino widget
            techAccessori: document.getElementById('techAccessori').value.trim(),
            techSottofondo: document.getElementById('techSottofondo').value.trim(),
            techPreesistente: document.getElementById('techPreesistente').value.trim(),
            techUmidita: document.getElementById('techUmidita').value.trim(),
            techTaglioPorte: document.getElementById('techTaglioPorte').value.trim(),
            techStanzeTable: getTableData(), // Salvataggio
            techScaleTable: getStairsData(), // Salvataggio
            techStepShape: getStepShapeData(), // Salvataggio Nuova Sagoma
            techDaOrdinare: document.getElementById('techDaOrdinare').value.trim(),
            
            techLavoriCliente: document.getElementById('techLavoriCliente').value.trim(),
            techNotePubbliche: document.getElementById('techNotePubbliche').value.trim(),
            techNoteInterne: document.getElementById('techNoteInterne').value.trim()
        };
    }

    function generateReview() {
        const data = getFormData();
        if(!data.clientName || !data.clientAddress) {
            alert("Nome Cliente e Indirizzo Cantiere sono obbligatori.");
            return;
        }

        const dateStr = new Date().toLocaleDateString('it-IT');
        
        // La mail per il cliente contiene SOLO info pubbliche
        let bodyTexts = [];
        bodyTexts.push(`Spett.le ${data.clientName || 'Cliente'},`);
        bodyTexts.push(`Facendo seguito alla scheda di cantiere compilata in data ${dateStr} presso il cantiere sito in: ${data.clientAddress}, vi riepiloghiamo di seguito le note operative e le lavorazioni richieste a vostro carico prima di procedere con la posa.\n`);
        
        let hasLavori = false;

        if(data.techLavoriCliente) {
            hasLavori = true;
            bodyTexts.push(`--- LAVORI A VOSTRO CARICO PRIMA DELLA POSA ---`);
            bodyTexts.push(data.techLavoriCliente);
            bodyTexts.push(``); // spacing
        }

        if(data.techNotePubbliche) {
            hasLavori = true;
            bodyTexts.push(`--- NOTE AGGIUNTIVE ---`);
            bodyTexts.push(data.techNotePubbliche);
            bodyTexts.push(``); // spacing
        }
        
        if(data.techStepShape) {
            hasLavori = true;
            bodyTexts.push(`--- DETTAGLIO SUPERFICIE GRADINO PRINCIPALE ---`);
            let sInfo = `${data.techStepShape.label} (Bordo Scelto: ${data.techStepShape.profiloBordo}, Lati Lavorati: ${data.techStepShape.numLatiToro})`;
            let dims = [];
            
            if (data.techStepShape.tipo === 'pianerottolo') {
                if(data.techStepShape.latoUp) dims.push(`Lato Alto ${data.techStepShape.latoUp}cm`);
                if(data.techStepShape.latoDx) dims.push(`Lato Destro ${data.techStepShape.latoDx}cm`);
                if(data.techStepShape.latoDown) dims.push(`Lato Basso ${data.techStepShape.latoDown}cm`);
                if(data.techStepShape.latoSx) dims.push(`Lato Sinistro ${data.techStepShape.latoSx}cm`);
            }
            
            bodyTexts.push(sInfo);
            if(dims.length > 0) bodyTexts.push(`Misure in cm: ` + dims.join(', '));
            else bodyTexts.push(`Forma scelta ma senza misure specificate.`);
            
            bodyTexts.push(``); // spacing
        }
        
        if(data.techScaleTable && data.techScaleTable.length > 0) {
            let toriGroups = {};
            data.techScaleTable.forEach(s => {
                let qta = parseFloat(s.qta) || 0;
                let larg = parseFloat(s.larg) || 0;
                let ped = parseFloat(s.pedata) || 0;
                let alz = parseFloat(s.alzata) || 0;
                let tori = parseInt(s.tori) || 0;
                if (tori > 0) {
                    let lenTori = larg > 0 ? larg : (ped + alz);
                    if(lenTori > 0) {
                        let key = lenTori.toFixed(2);
                        if(!toriGroups[key]) toriGroups[key] = { count: 0, ml: 0 };
                        let pieces = qta * tori;
                        toriGroups[key].count += pieces;
                        toriGroups[key].ml += (pieces * lenTori);
                    }
                }
            });
            
            if (Object.keys(toriGroups).length > 0) {
                hasLavori = true;
                bodyTexts.push(`--- DISTINTA LAVORAZIONI TORO / BATTISCOPA ---`);
                for (let k in toriGroups) {
                    bodyTexts.push(`Lunghezza ${k} m: N° ${toriGroups[k].count} pezzi (Parziale: ${toriGroups[k].ml.toFixed(2)} ml)`);
                }
                bodyTexts.push(``); // spacing
            }
        }

        if (!hasLavori) {
            bodyTexts.push(`--- NESSUNA OPERAZIONE EXTRA RILEVATA ---`);
            bodyTexts.push(`Il cantiere risulta idoneo per procedere con le operazioni assegnate. Nessun lavoro preliminare richiesto da parte vostra.\n`);
        }

        bodyTexts.push(`Si prega di confermare l'avvenuta messa a punto conformemente a quanto indicato sopra.`);
        bodyTexts.push(`Rimaniamo a completa disposizione per qualsiasi necessità di chiarimento.\n`);
        bodyTexts.push(`Cordiali Saluti`);

        document.getElementById('finalEmailText').value = bodyTexts.join('\n');
        goToStep('step-review');
    }

    // --- Salvataggio ed Email ---
    async function saveToSupabase(data) {
        if(!window.supabase) return false;

        // Ottieni user ID dalla sessione (funziona anche senza window.crmData)
        let userId = window.crmData?.user?.id || null;
        if (!userId) {
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                userId = sessionData?.session?.user?.id || null;
            } catch(e) { /* silenzio */ }
        }
        let clientId = document.getElementById('clientSelect').value || null;

        // Inseriamo tutto il mega-data in full_data_json
        const payload = {
            client_id: clientId || null,
            client_name: data.clientName,
            client_address: data.clientAddress,
            client_email: data.clientEmail,
            tech_sottofondo: data.techSottofondo,
            tech_materiale: data.techMateriale,
            tech_umidita: data.techUmidita,
            tech_lavori: data.techLavoriCliente,
            tech_note: data.techNotePubbliche,
            full_data_json: data,
            created_by: userId
        };

        // Se stiamo modificando una scheda esistente, aggiorna invece di inserire
        if (state.editingId) {
            const { error } = await supabase
                .from('sopralluoghi')
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq('id', state.editingId);
            if (error) {
                console.error("Supabase update error", error);
                const { error: insertErr } = await supabase.from('sopralluoghi').insert(payload);
                if (insertErr) return false;
            }
            state.editingId = null;
            const banner = document.getElementById('editModeBanner');
            if (banner) banner.remove();
            return true;
        }

        // Genera numero scheda progressivo: SOP-AAAA-NNN
        try {
            const year = new Date().getFullYear();
            const yearStart = `${year}-01-01T00:00:00.000Z`;
            const { count } = await supabase
                .from('sopralluoghi')
                .select('id', { count: 'exact', head: true })
                .eq('created_by', userId)
                .gte('created_at', yearStart);
            const nextNum = (count || 0) + 1;
            const schedaNumber = `SOP-${year}-${String(nextNum).padStart(3, '0')}`;
            payload.full_data_json = { ...data, schedaNumber };
        } catch(e) {
            console.warn('Numerazione scheda non disponibile:', e);
        }

        const {error} = await supabase.from('sopralluoghi').insert(payload);
        if(error) {
            console.error("Supabase insert error", error);
            return false;
        }
        return true;
    }

    async function saveAndExit() {
        const data = getFormData();
        if(!data.clientName || !data.clientAddress) {
            alert("Nome Cliente e Indirizzo Cantiere sono obbligatori per il salvataggio.");
            return;
        }

        // OPEN WINDOW SYNCHRONOUSLY TO BYPASS POPUP BLOCKER
        const reportWin = window.open('', '_blank');
        if (reportWin) {
            reportWin.document.write("<html><head><title>Generazione in corso...</title></head><body style='font-family:sans-serif; padding:40px;'><h3>Generazione e salvataggio in corso. Attendere prego...</h3></body></html>");
        } else {
            alert("Il tuo browser ha bloccato il popup del report. Per favore, consenti i popup per questo sito.");
        }

        const btn = document.querySelector('.btn-success');
        let oldHtml = "";
        if (btn) {
            oldHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvataggio...';
            btn.disabled = true;
        }

        try {
            const saved = await saveToSupabase(data);
            if(saved) clearDraft(); // Bozza eliminata solo se salvataggio riuscito
            loadRecent();
        } catch (e) {
            console.warn("Errore salvataggio DB, proseguo per il PDF", e);
        }

        if (btn) {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }

        if (reportWin) {
            buildPdfPreview(data, reportWin);
        }
        
        // Torna pulito alla pagina iniziale in background 
        // mentre il popup stampa il PDF
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    }

    function resetAndExit() {
        if(confirm("Vuoi chiudere e Iniziare una Nuova Scheda? Eventuali dati non salvati andranno persi.")) {
            clearDraft();
            window.location.reload();
        }
    }

    function buildPdfPreview(data, targetWin) {
        const dateStr = new Date().toLocaleDateString('it-IT', {day:'2-digit', month:'long', year:'numeric'});
        const timeStr = new Date().toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});

        // Calcola totali stanze
        let totMq = 0, totMl = 0;
        const roomsRows = (data.techStanzeTable || []).map(r => {
            const mq = parseFloat(r.mq||0);
            const ml = parseFloat(r.ml||0);
            totMq += mq;
            totMl += ml;
            return `<tr>
                <td>${r.stanza||'â€”'}</td>
                <td style="text-align:center;">${r.lung||'â€”'}</td>
                <td style="text-align:center;">${r.larg||'â€”'}</td>
                <td style="text-align:center; font-weight:700; color:#1d4ed8;">${mq > 0 ? mq.toFixed(2) : 'â€”'}</td>
                <td style="text-align:center; color:#065f46;">${ml > 0 ? ml.toFixed(2) : 'â€”'}</td>
            </tr>`;
        }).join('');

        // Calcola totali scale
        let totScaleMq = 0, totScaleBatti = 0, totScaleTori = 0;
        const stairsRows = (data.techScaleTable || []).map(r => {
            const mq  = parseFloat(r.mqtot||0);
            const bat = parseFloat(r.mlbatti||0);
            const tor = parseFloat(r.mltori||0);
            totScaleMq += mq;
            totScaleBatti += bat;
            totScaleTori += tor;
            const hasAlz = r.alzMq !== false;
            return `<tr>
                <td>${r.tipo||'â€”'}</td>
                <td style="text-align:center;">${r.qta||'â€”'}</td>
                <td style="text-align:center;">${r.larg||'â€”'} m</td>
                <td style="text-align:center;">${r.pedata||'â€”'} m</td>
                <td style="text-align:center;">${r.alzata||'â€”'} m</td>
                <td style="text-align:center;">${hasAlz ? 'Alzata + Pedata' : 'Solo pedata'}</td>
                <td style="text-align:center; font-weight:700; color:#1d4ed8;">${mq > 0 ? mq.toFixed(2) : 'â€”'}</td>
                <td style="text-align:center; color:#065f46;">${bat > 0 ? bat.toFixed(2) : 'â€”'}</td>
                <td style="text-align:center; color:#7c3aed;">${tor > 0 ? tor.toFixed(2) : 'â€”'}</td>
            </tr>`;
        }).join('');

        // Distinta Tori per lunghezza (ricostruzione da toriArrStr)
        const toriGroups = {};
        const addToGroup = (key, count, ml, label) => {
            if (!toriGroups[key]) toriGroups[key] = { count: 0, ml: 0, sources: [] };
            toriGroups[key].count += count;
            toriGroups[key].ml += ml;
            if (label && !toriGroups[key].sources.includes(label)) toriGroups[key].sources.push(label);
        };
        (data.techScaleTable || []).forEach(r => {
            const qta = parseInt(r.qta) || 1;
            const tori = parseInt(r.tori) || 0;
            const mlToriTot = parseFloat(r.mltori || 0);
            const label = r.tipo || 'Rampa';
            if (tori <= 0) return;
            let processed = false;
            if (r.toriArrStr) {
                const arr = r.toriArrStr.split(',').map(Number).filter(n => n > 0);
                const sumArr = arr.reduce((a, b) => a + b, 0);
                const expectedTot = sumArr * qta;
                if (arr.length === tori && Math.abs(expectedTot - mlToriTot) < 0.05) {
                    arr.forEach(len => {
                        addToGroup(len.toFixed(2), qta, len * qta, label);
                    });
                    processed = true;
                }
            }
            if (!processed && mlToriTot > 0) {
                const avgLen = mlToriTot / (qta * tori);
                addToGroup(avgLen.toFixed(2), qta * tori, mlToriTot, label + ' (media)');
            }
        });
        // Ordina per lunghezza crescente
        const toriKeys = Object.keys(toriGroups).sort((a, b) => parseFloat(a) - parseFloat(b));

        const row = (label, val) => val && val.trim() ? `<tr><th>${label}</th><td>${val}</td></tr>` : '';
        const rowAlways = (label, val) => `<tr><th>${label}</th><td>${val || '<span style="color:#94a3b8;">â€”</span>'}</td></tr>`;
        const nl = s => s ? s.replace(/\n/g, '<br>') : '';

        const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Scheda Sopralluogo â€” ${data.clientName || 'Cantiere'}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; font-size: 11px; color: #1e293b; background: #fff; line-height: 1.5; }
  .page { padding: 20px 26px; max-width: 860px; margin: 0 auto; }

  /* HEADER â€” bordo invece di gradiente scuro */
  .doc-header { border-bottom: 3px solid #334155; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .doc-header .brand { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 3px; }
  .doc-header h1 { font-size: 16px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px; }
  .date-block { text-align: right; font-size: 9.5px; color: #64748b; line-height: 1.7; }

  /* ANAGRAFICA */
  .anag-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .anag-card { border: 1px solid #e2e8f0; border-left: 3px solid #94a3b8; border-radius: 4px; padding: 8px 10px; }
  .anag-card .card-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 5px; }
  .anag-row { display: flex; gap: 6px; margin-bottom: 2px; font-size: 10.5px; }
  .anag-row .lbl { font-weight: 600; color: #64748b; min-width: 88px; flex-shrink: 0; }
  .anag-row .val { color: #0f172a; }

  /* SECTION TITLE */
  .sec-title { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: #475569; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin: 16px 0 8px; }

  /* TECH TABLE â€” griglia compatta */
  .tech-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10.5px; }
  .tech-table th { background: #f8fafc; font-weight: 600; color: #64748b; padding: 5px 8px; text-align: left; border: 1px solid #e2e8f0; width: 18%; font-size: 9.5px; }
  .tech-table td { padding: 5px 8px; border: 1px solid #e2e8f0; color: #1e293b; vertical-align: top; }
  .tech-table tr:nth-child(even) td { background: #fafafa; }

  /* DATA TABLE â€” header grigio, non colorato */
  .data-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
  .data-table thead tr { background: #334155; color: #fff; }
  .data-table thead th { padding: 6px 8px; font-weight: 600; text-align: center; border: 1px solid #475569; font-size: 9.5px; }
  .data-table thead th:first-child { text-align: left; }
  .data-table tbody tr:nth-child(even) { background: #fafafa; }
  .data-table tbody td { padding: 5px 8px; border: 1px solid #e2e8f0; color: #1e293b; }
  .data-table tfoot tr { background: #f1f5f9; color: #374151; font-weight: 700; font-size: 10.5px; border-top: 2px solid #94a3b8; }
  .data-table tfoot td { padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; }
  .data-table tfoot td:first-child { text-align: right; }

  /* TOTALS BAR */
  .totals-bar { display: flex; gap: 0; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; margin-bottom: 14px; }
  .tot-item { flex: 1; text-align: center; padding: 8px 6px; border-right: 1px solid #e2e8f0; }
  .tot-item:last-child { border-right: none; }
  .tot-item .tot-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; margin-bottom: 2px; }
  .tot-item .tot-val { font-size: 15px; font-weight: 700; color: #1e293b; }
  .tot-item .tot-unit { font-size: 9px; color: #94a3b8; font-weight: 400; margin-left: 2px; }

  /* NOTE BOXES */
  .note-box { border-left: 3px solid #cbd5e1; padding: 8px 10px; margin-bottom: 8px; background: #fafafa; border-radius: 0 4px 4px 0; }
  .note-box.cliente { border-left-color: #f97316; }
  .note-box.public { border-left-color: #3b82f6; }
  .note-box.interna { border-left-color: #64748b; background: #f1f5f9; }
  .note-box .note-title { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #64748b; margin-bottom: 4px; }
  .note-box.cliente .note-title { color: #ea580c; }
  .note-box.public .note-title { color: #2563eb; }
  .note-content { font-size: 10.5px; line-height: 1.65; color: #1e293b; white-space: pre-wrap; }

  @page { margin: 12mm 10mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 8px 12px; }
    .page-footer { display: block !important; }
  }
  .page-footer {
    display: none;
    position: fixed; bottom: 0; left: 0; right: 0;
    font-size: 8.5px; color: #94a3b8; border-top: 1px solid #e2e8f0;
    padding: 3px 12px; text-align: right;
  }
  .page-footer::after { content: 'Pag. ' counter(page); }
  body { counter-reset: page; }
  @page { @bottom-right { content: 'Pag. ' counter(page) ' / ' counter(pages); font-size: 8pt; color: #94a3b8; } }
</style>
</head>
<body>
<div class="no-print" style="text-align:center; padding:10px; background:#f1f5f9; border-bottom:1px solid #cbd5e1; position:sticky; top:0; z-index:9999; display:flex; justify-content:center; gap:12px;">
  <button onclick="window.print()" style="background:#8b5cf6; color:#fff; padding:8px 16px; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Stampa PDF (o Salva)</button>
  <button onclick="window.close()" style="background:#ef4444; color:#fff; padding:8px 16px; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Chiudi Anteprima</button>
</div>
<div class="page">

  <!-- HEADER -->
  <div class="doc-header">
    <div>
      <div class="brand">Parquet Romagna â€” Scheda Tecnica</div>
      <div style="display:flex; align-items:center; gap:10px;">
        <h1>Scheda di Cantiere</h1>
        ${data.schedaNumber ? `<span style="background:#0f172a; color:#fff; font-size:10px; font-weight:700; padding:3px 9px; border-radius:20px; letter-spacing:0.05em;">${data.schedaNumber}</span>` : ''}
      </div>
    </div>
    <div class="date-block">
      <div>${dateStr} â€” ore ${timeStr}</div>
      <div>Posatore: ${data.clientPosatore || 'â€”'}</div>
    </div>
  </div>

  <!-- ANAGRAFICA -->
  <div class="anag-grid">
    <div class="anag-card">
      <div class="card-label">ðŸ‘¤ Dati Cliente</div>
      <div class="anag-row"><span class="lbl">Cliente:</span><span class="val"><strong>${data.clientName || 'â€”'}</strong></span></div>
      <div class="anag-row"><span class="lbl">Email:</span><span class="val">${data.clientEmail || 'â€”'}</span></div>
      <div class="anag-row"><span class="lbl">Telefono:</span><span class="val">${data.clientTelefono || 'â€”'}</span></div>
      <div class="anag-row"><span class="lbl">Impresa:</span><span class="val">${data.clientImpresa || 'â€”'}</span></div>
    </div>
    <div class="anag-card">
      <div class="card-label">ðŸ“  Cantiere</div>
      <div class="anag-row"><span class="lbl">Indirizzo:</span><span class="val"><strong>${data.clientAddress || 'â€”'}</strong></span></div>
      <div class="anag-row"><span class="lbl">Denominazione:</span><span class="val">${data.clientCantiere || 'â€”'}</span></div>
      <div class="anag-row"><span class="lbl">Unità / Interno:</span><span class="val">${data.clientUnita || 'â€”'}</span></div>
      <div class="anag-row"><span class="lbl">Tempi previsti:</span><span class="val">${data.clientTempi || 'â€”'}</span></div>
    </div>
  </div>

  <!-- CARATTERISTICHE TECNICHE -->
  <div class="sec-title">Caratteristiche Tecniche del Materiale e della Posa</div>
  <table class="tech-table">
    <tr>
      <th>Materiale Previsto</th>
      <td colspan="3">${data.techMateriale || '<span style="color:#94a3b8;">Non specificato</span>'}</td>
    </tr>
    <tr>
      <th>Metodo e Verso di Posa</th>
      <td colspan="3">${data.techPosa || '<span style="color:#94a3b8;">Non specificato</span>'}</td>
    </tr>
    <tr>
      <th>Sottofondo</th>
      <td>${data.techSottofondo || 'â€”'}</td>
      <th>Pavimento Preesistente</th>
      <td>${data.techPreesistente || 'â€”'}</td>
    </tr>
    <tr>
      <th>Rilevazioni Umidità</th>
      <td>${data.techUmidita || 'â€”'}</td>
      <th>Taglio Porte / Infissi</th>
      <td>${data.techTaglioPorte || 'â€”'}</td>
    </tr>
    <tr>
      <th>Accessori / Giunti</th>
      <td>${data.techAccessori || 'â€”'}</td>
      <th>Da Ordinare</th>
      <td>${data.techDaOrdinare || 'â€”'}</td>
    </tr>
  </table>

  <!-- MISURE STANZE -->
  ${roomsRows ? `
  <div class="sec-title">Elenco Misure Ambienti e Stanze</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="text-align:left; width:28%;">Stanza / Ambiente</th>
        <th>Lung. (m)</th>
        <th>Larg. (m)</th>
        <th>Mq</th>
        <th>Ml Battiscopa</th>
      </tr>
    </thead>
    <tbody>${roomsRows}</tbody>
    <tfoot>
      <tr>
        <td style="text-align:right;" colspan="3">TOTALE SUPERFICI:</td>
        <td class="tot-mq">${totMq.toFixed(2)} mÂ²</td>
        <td class="tot-ml">${totMl.toFixed(2)} ml</td>
      </tr>
    </tfoot>
  </table>
  ` : ''}

  <!-- MISURE SCALE -->
  ${stairsRows ? `
  <div class="sec-title">Elenco Misure Scale e Strutture</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="text-align:left; width:20%;">Tipo / Rampa</th>
        <th>Q.tà</th>
        <th>Larg.</th>
        <th>Pedata</th>
        <th>Alzata</th>
        <th>Rivestimento</th>
        <th>Mq Tot.</th>
        <th>Ml Batti</th>
        <th>Ml Tori</th>
      </tr>
    </thead>
    <tbody>${stairsRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="6" style="text-align:right;">TOTALE SCALE:</td>
        <td style="color:#93c5fd;">${totScaleMq.toFixed(2)} mÂ²</td>
        <td style="color:#6ee7b7;">${totScaleBatti.toFixed(2)} ml</td>
        <td style="color:#c4b5fd;">${totScaleTori.toFixed(2)} ml</td>
      </tr>
    </tfoot>
  </table>
  ` : ''}

  <!-- DISTINTA LAVORAZIONI -->
  ${toriKeys.length > 0 ? `
  <div class="sec-title">Distinta Lavorazioni â€” Spigoli / Toro</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="text-align:left; width:28%;">Lunghezza Pezzo</th>
        <th>N° Pezzi</th>
        <th>Ml Parziali</th>
        <th style="text-align:left;">Rampa / Provenienza</th>
      </tr>
    </thead>
    <tbody>
      ${toriKeys.map(k => `<tr>
        <td><strong>${k} m</strong></td>
        <td style="text-align:center; font-weight:700;">${toriGroups[k].count}</td>
        <td style="text-align:center;">${toriGroups[k].ml.toFixed(2)} ml</td>
        <td style="font-size:9.5px; color:#64748b;">${(toriGroups[k].sources || []).join(', ') || 'â€”'}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td>Totale Lavorazioni:</td>
        <td style="text-align:center;">${toriKeys.reduce((s,k) => s + toriGroups[k].count, 0)} pz</td>
        <td style="text-align:center;">${toriKeys.reduce((s,k) => s + toriGroups[k].ml, 0).toFixed(2)} ml</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
  ` : ''}

  <!-- TOTALI RIEPILOGO -->
  ${(roomsRows || stairsRows) ? `
  <div class="sec-title">Riepilogo Totali Complessivi</div>
  <div class="totals-bar">
    <div class="tot-item">
      <div class="tot-label">Superficie Totale</div>
      <div class="tot-val tot-mq">${(totMq + totScaleMq).toFixed(2)} <span class="tot-unit">mÂ²</span></div>
    </div>
    <div class="tot-div"></div>
    <div class="tot-item">
      <div class="tot-label">Ml Battiscopa Tot.</div>
      <div class="tot-val tot-ml">${(totMl + totScaleBatti).toFixed(2)} <span class="tot-unit">ml</span></div>
    </div>
    <div class="tot-div"></div>
    <div class="tot-item">
      <div class="tot-label">Ml Tori Scale</div>
      <div class="tot-val tot-tori">${totScaleTori.toFixed(2)} <span class="tot-unit">ml</span></div>
    </div>
    <div class="tot-div"></div>
    <div class="tot-item">
      <div class="tot-label">Stanze Rilevate</div>
      <div class="tot-val" style="color:#475569;">${(data.techStanzeTable||[]).length} <span class="tot-unit">amb.</span></div>
    </div>
  </div>
  ` : ''}

  <!-- NOTE CLIENTE -->
  ${data.techLavoriCliente ? `
  <div class="sec-title">Lavori a Carico del Cliente</div>
  <div class="note-box cliente">
    <div class="note-title">âš ï¸  Operazioni Richieste Prima della Posa</div>
    <div class="note-content">${nl(data.techLavoriCliente)}</div>
  </div>
  ` : ''}

  <!-- NOTE PUBBLICHE -->
  ${data.techNotePubbliche ? `
  <div class="note-box public">
    <div class="note-title">ðŸ“„ Note Pubbliche Aggiuntive</div>
    <div class="note-content">${nl(data.techNotePubbliche)}</div>
  </div>
  ` : ''}

  <!-- NOTE INTERNE -->
  <div class="note-box interna">
    <div class="note-title">ðŸ”’ Note Interne â€” Solo Team Parquet Romagna</div>
    <div class="note-content">${nl(data.techNoteInterne) || 'Nessuna nota interna.'}</div>
  </div>


</div>
</body>
</html>`;

        if (!targetWin) targetWin = window.open('', '_blank');
        if (targetWin) {
            targetWin.document.open();
            targetWin.document.write(html);
            targetWin.document.close();
        } else {
            alert("Impossibile aprire il report PDF: controlla il blocco popup del browser.");
        }
    }



    async function saveAndSend() {
        const data = getFormData();
        
        const btn = document.querySelector('.btn-success');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvataggio...';
        btn.disabled = true;

        try {
            await saveToSupabase(data);
            loadRecent(); // Aggiorna elenco recenti in background
        } catch (e) {
            console.warn("Errore salvataggio DB, prosieguo con l'email", e);
        }

        btn.innerHTML = oldHtml;
        btn.disabled = false;

        // Genera Email (Mailto) leggendo la textarea
        const dateStr = new Date().toLocaleDateString('it-IT');
        const subject = encodeURIComponent(`Relazione Scheda di cantiere Parquet - ${data.clientName} [${dateStr}]`);
        
        const bodyText = document.getElementById('finalEmailText').value;
        const body = encodeURIComponent(bodyText);
        const emailTo = data.clientEmail ? encodeURIComponent(data.clientEmail) : '';

        const mailtoLink = `mailto:${emailTo}?subject=${subject}&body=${body}`;
        
        // Apre il client email nativo
        window.location.href = mailtoLink;
        
        // Dopo un secondo, avvisa l'utente se non si è accorto
        setTimeout(() => {
            if(confirm("Scheda di cantiere salvata! Si è aperta l'app di posta per inviare l'email? Clicca OK per tornare alla home.")) {
                goToStep('step-start');
                // reset form
                document.getElementById('clientSelect').value = '';
                document.querySelectorAll('input:not([type="button"]), textarea').forEach(i => i.value = '');
            }
        }, 800);
    }

    async function saveAndNextUnit() {
        const data = getFormData();
        if(!data.clientName || !data.clientAddress) {
            alert("Nome Cliente e Indirizzo Cantiere sono obbligatori.");
            return;
        }

        showLoading(true);

        try {
            await saveToSupabase(data);
            showLoading(false);
            alert(`Scheda di cantiere salvata per l'unità: ${data.clientUnita || 'Principale'}. L'app è ora pronta per la prossima unità del condominio.`);

            // Svuota unità e campi tecnici
            document.getElementById('clientUnita').value = '';
            document.getElementById('techSottofondo').value = '';
            document.getElementById('techPreesistente').value = '';
            document.getElementById('techUmidita').value = '';
            document.getElementById('techTaglioPorte').value = '';
            document.getElementById('techDaOrdinare').value = '';
            document.getElementById('techLavoriCliente').value = '';
            document.getElementById('techNotePubbliche').value = '';
            document.getElementById('techNoteInterne').value = '';
            document.getElementById('roomsTableBody').innerHTML = ''; // resetta tabella
            calcTableTotals();
            document.getElementById('stairsTableBody').innerHTML = ''; // resetta scale
            calcStairsTotals();

            // Torna allo step client così l'utente può inserire il nuovo numero di interno
            goToStep('step-client');
            setTimeout(() => { document.getElementById('clientUnita').focus(); }, 200);

        } catch (error) {
            console.error(error);
            showLoading(false);
            alert("Errore durante il salvataggio su Supabase.");
        }
    }

    function showLoading(show) {
        document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
    }

    // --- Text to Speech ---
    let cachedVoices = [];
    let selectedVoiceUri = localStorage.getItem('sopralluoghi_voice_uri') || '';

    function populateVoicesDropdown() {
        const select = document.getElementById('voiceSelect');
        if (!select) return;
        
        const itVoices = cachedVoices.filter(v => {
            const lang = (v.lang || '').toLowerCase();
            const name = (v.name || '').toLowerCase();
            return lang.startsWith('it') || name.includes('ital');
        });
        if (itVoices.length === 0) {
            select.innerHTML = '<option value="">Voce Predefinita del Dispositivo</option>';
            return;
        }

        select.innerHTML = '<option value="">-- Seleziona Voce Ottimale Automatica --</option>';
        itVoices.forEach(v => {
            const isOnline = !v.localService ? ' (Online)' : '';
            const opt = document.createElement('option');
            opt.value = v.voiceURI;
            opt.textContent = v.name + isOnline;
            if (v.voiceURI === selectedVoiceUri) opt.selected = true;
            select.appendChild(opt);
        });
    }

    if (window.speechSynthesis) {
        // Forza il caricamento
        cachedVoices = window.speechSynthesis.getVoices();
        if(cachedVoices.length > 0) populateVoicesDropdown();
        
        window.speechSynthesis.onvoiceschanged = () => {
            cachedVoices = window.speechSynthesis.getVoices();
            populateVoicesDropdown();
        };
    }

    function onChangeVoice(uri) {
        selectedVoiceUri = uri;
        if(uri) {
            localStorage.setItem('sopralluoghi_voice_uri', uri);
        } else {
            localStorage.removeItem('sopralluoghi_voice_uri');
        }
    }

    function speakText(text, onEndCallback = null) {
        if (!window.speechSynthesis) {
            console.warn("Sintesi vocale non supportata.");
            if(onEndCallback) setTimeout(onEndCallback, 1000);
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        if (onEndCallback) utterance.onend = onEndCallback;
        utterance.lang = 'it-IT';
        
        // Usa le voci salvate in cache (che dovrebbero essere caricate al 100%)
        if (cachedVoices.length === 0) {
            cachedVoices = window.speechSynthesis.getVoices();
        }
        
        const itVoices = cachedVoices.filter(v => {
            const lang = (v.lang || '').toLowerCase();
            const name = (v.name || '').toLowerCase();
            return lang.startsWith('it') || name.includes('ital');
        });
        
        if (itVoices.length > 0) {
            let bestVoice = null;
            
            // 1. Usa la voce scelta dall'utente (se esiste)
            if (selectedVoiceUri) {
                bestVoice = itVoices.find(v => v.voiceURI === selectedVoiceUri);
            }
            
            // 2. Fallback alla selezione intelligente
            if (!bestVoice) {
                bestVoice = 
                    itVoices.find(v => v.name.toLowerCase().includes('elsa')) ||
                    itVoices.find(v => v.name.toLowerCase().includes('google')) ||
                    itVoices.find(v => v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('online')) ||
                    itVoices.find(v => !v.localService) ||
                    itVoices[0];
            }
                
            utterance.voice = bestVoice;
        }
        
        window.speechSynthesis.speak(utterance);
    }

    const Stairs2DViewer = (function() {
        let isInitialized = false;
        let stepsData = [];
        let drawScale = 1;
        let drawCx = 0;
        let drawCz = 0;
        
        let draggedStep = null;
        let isDragging = false;
        let dragStartMouse = {x: 0, y: 0};
        let selectedStepIds = new Set(); // selezione multipla
        let clickStartMouse = {x: 0, y: 0};

        function getHitStep(clientX, clientY) {
            const canvas = document.getElementById('stairs-2d-canvas');
            if(!canvas) return null;
            const rect = canvas.getBoundingClientRect();
            const mouseX = clientX - rect.left;
            const mouseY = clientY - rect.top;
            
            const logicX = (mouseX - canvas.width/2)/drawScale + drawCx;
            const logicZ = (mouseY - canvas.height/2)/drawScale + drawCz;
            
            // Itera dal fondo (ultimo disegnato = in cima visivamente)
            for(let i = stepsData.length - 1; i >= 0; i--) {
                const step = stepsData[i];
                let dx = logicX - step.x;
                let dz = logicZ - step.z;
                // Usa angolo totale (strutturale + manuale)
                const totalAngle = step.angle + (step.angleOffset || 0);
                let localX = dx * Math.cos(totalAngle) + dz * Math.sin(totalAngle);
                let localZ = -dx * Math.sin(totalAngle) + dz * Math.cos(totalAngle);
                // Applica specchiatura inversa se presente
                if (step.mirrorX) localX = -localX;
                if (step.mirrorZ) localZ = -localZ;
                
                const normTipo = step.tipo.toLowerCase();
                if (normTipo.includes('chiusura')) {
                    if (localX >= -step.w/2 && localX <= step.w/2 && localZ >= 0 && localZ <= step.d) return step;
                } else {
                    if (localX >= -step.w/2 && localX <= step.w/2 && localZ >= -step.d && localZ <= 0) return step;
                }
            }
            return null;
        }

        function init() {
            if (isInitialized) return;
            const container = document.getElementById('stairs-2d-wrapper');
            const canvas = document.getElementById('stairs-2d-canvas');
            if (container && window.ResizeObserver) {
                new ResizeObserver(() => {
                    renderStairs();
                }).observe(container);
            } else {
                window.addEventListener('resize', renderStairs, false);
            }
            
            if (canvas) {
                canvas.addEventListener('mousedown', (e) => {
                    const hit = getHitStep(e.clientX, e.clientY);
                    clickStartMouse = {x: e.clientX, y: e.clientY};
                    if (hit) {
                        draggedStep = hit;
                        dragStartMouse = {x: e.clientX, y: e.clientY};
                        isDragging = true;
                        let raw = hit.trElement.dataset.manualOffsets ? JSON.parse(hit.trElement.dataset.manualOffsets) : {};
                        let startOff = raw[hit.qtaIndex] || {x:0, z:0, angleOffset:0, mirrorX:false, mirrorZ:false};
                        hit.dragStartData = { x: startOff.x||0, z: startOff.z||0 };
                    }
                });

                canvas.addEventListener('mousemove', (e) => {
                    const hit = getHitStep(e.clientX, e.clientY);
                    canvas.style.cursor = hit || isDragging ? (isDragging ? 'grabbing' : 'grab') : 'default';

                    if (isDragging && draggedStep) {
                        let dx_pixels = e.clientX - dragStartMouse.x;
                        let dz_pixels = e.clientY - dragStartMouse.y;
                        let dx_logic = dx_pixels / drawScale;
                        let dz_logic = dz_pixels / drawScale;

                        let raw = draggedStep.trElement.dataset.manualOffsets ? JSON.parse(draggedStep.trElement.dataset.manualOffsets) : {};
                        let prev = raw[draggedStep.qtaIndex] || {angleOffset:0, mirrorX:false, mirrorZ:false};
                        raw[draggedStep.qtaIndex] = {
                            x: draggedStep.dragStartData.x + dx_logic,
                            z: draggedStep.dragStartData.z + dz_logic,
                            angleOffset: prev.angleOffset || 0,
                            mirrorX: prev.mirrorX || false,
                            mirrorZ: prev.mirrorZ || false
                        };
                        draggedStep.trElement.dataset.manualOffsets = JSON.stringify(raw);
                        renderStairs();
                    }
                });

                canvas.addEventListener('mouseup', (e) => {
                    const moveDist = Math.sqrt((e.clientX-clickStartMouse.x)**2 + (e.clientY-clickStartMouse.y)**2);
                    if (moveDist < 5) {
                        const hit = getHitStep(e.clientX, e.clientY);
                        if (hit) {
                            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                                // Shift/Ctrl: aggiungi/rimuovi dalla selezione multipla
                                if (selectedStepIds.has(hit.id)) selectedStepIds.delete(hit.id);
                                else selectedStepIds.add(hit.id);
                            } else {
                                // Click semplice: selezione singola
                                if (selectedStepIds.size === 1 && selectedStepIds.has(hit.id)) {
                                    selectedStepIds.clear(); // toggle off
                                } else {
                                    selectedStepIds.clear();
                                    selectedStepIds.add(hit.id);
                                }
                            }
                        } else {
                            // click su area vuota: deseleziona tutto
                            selectedStepIds.clear();
                        }
                        renderStairs();
                        _updateStepToolbar();
                    }
                    isDragging = false;
                    draggedStep = null;
                });
                canvas.addEventListener('mouseleave', () => { isDragging = false; draggedStep = null; });

                // Touch support
                canvas.addEventListener('touchstart', (e) => {
                    if (e.touches.length === 1) {
                        const t = e.touches[0];
                        const hit = getHitStep(t.clientX, t.clientY);
                        clickStartMouse = {x: t.clientX, y: t.clientY};
                        if (hit) {
                            draggedStep = hit;
                            dragStartMouse = {x: t.clientX, y: t.clientY};
                            isDragging = true;
                            let raw = hit.trElement.dataset.manualOffsets ? JSON.parse(hit.trElement.dataset.manualOffsets) : {};
                            let startOff = raw[hit.qtaIndex] || {x:0, z:0, angleOffset:0, mirrorX:false, mirrorZ:false};
                            hit.dragStartData = { x: startOff.x||0, z: startOff.z||0 };
                        }
                        e.preventDefault();
                    }
                }, {passive: false});
                canvas.addEventListener('touchmove', (e) => {
                    if (e.touches.length === 1 && isDragging && draggedStep) {
                        const t = e.touches[0];
                        let dx = (t.clientX - dragStartMouse.x) / drawScale;
                        let dz = (t.clientY - dragStartMouse.y) / drawScale;
                        let raw = draggedStep.trElement.dataset.manualOffsets ? JSON.parse(draggedStep.trElement.dataset.manualOffsets) : {};
                        let prev = raw[draggedStep.qtaIndex] || {angleOffset:0, mirrorX:false, mirrorZ:false};
                        raw[draggedStep.qtaIndex] = {
                            x: draggedStep.dragStartData.x + dx,
                            z: draggedStep.dragStartData.z + dz,
                            angleOffset: prev.angleOffset || 0,
                            mirrorX: prev.mirrorX || false,
                            mirrorZ: prev.mirrorZ || false
                        };
                        draggedStep.trElement.dataset.manualOffsets = JSON.stringify(raw);
                        renderStairs();
                        e.preventDefault();
                    }
                }, {passive: false});
                canvas.addEventListener('touchend', (e) => {
                    if (e.changedTouches.length === 1) {
                        const t = e.changedTouches[0];
                        const moveDist = Math.sqrt((t.clientX-clickStartMouse.x)**2 + (t.clientY-clickStartMouse.y)**2);
                        if (moveDist < 8 && !isDragging) {
                            const hit = getHitStep(t.clientX, t.clientY);
                            if (hit) {
                                // Su touch: tap aggiunge/rimuove sempre (come shift)
                                if (selectedStepIds.has(hit.id)) selectedStepIds.delete(hit.id);
                                else selectedStepIds.add(hit.id);
                            } else {
                                selectedStepIds.clear();
                            }
                            renderStairs();
                            _updateStepToolbar();
                        }
                    }
                    isDragging = false; draggedStep = null;
                });
            }

            isInitialized = true;
        }

        function renderStairs() {
            if (!isInitialized) init();
            const canvas = document.getElementById('stairs-2d-canvas');
            if (!canvas) return;
            
            const rect = canvas.parentElement.getBoundingClientRect();
            if(rect.width > 0 && rect.height > 0) {
                canvas.width = rect.width;
                canvas.height = rect.height;
            }
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Resetta array dei dati per il frame corrente (isDragging manterrà memoria grazie al proxy locale)
            stepsData = [];
            let minX = 0, maxX = 0, minZ = 0, maxZ = 0;
            
            let currentX = 0;
            let currentZ = 0;
            let currentAngle = 0;
            let prevLarg = 1.0; 
            let prevPedata = 0.3;
            let prevDir = 'straight';
            let globalStepIdx = 1;

            let tableRows = document.querySelectorAll('#stairsTableBody tr');
            tableRows.forEach(tr => {
                let larg = parseFloat(tr.querySelector('.tbl-str-larg').value) || 1.0;
                let pedata = parseFloat(tr.querySelector('.tbl-str-pedata').value) || 0.3;
                let qta = parseInt(tr.querySelector('.tbl-str-qta').value) || 1;
                let tipo = tr.querySelector('.tbl-str-tipo').value || 'Gradino standard';
                
                let dirSelect = tr.querySelector('.tbl-str-dir');
                let alignSelect = tr.querySelector('.tbl-str-align');
                let bluelineSelect = tr.querySelector('.tbl-str-blueline');
                let stepDir = dirSelect ? dirSelect.value : 'straight';
                let stepAlign = alignSelect ? alignSelect.value : 'center';
                let stepBlueline = bluelineSelect ? bluelineSelect.value : 'auto';
                
                for(let i=0; i<qta; i++) {
                    let drawAngle = currentAngle;

                    let effectivePrevLarg = prevLarg;
                    if (prevDir === 'left' || prevDir === 'right') effectivePrevLarg = prevPedata;

                    let offsetX = 0;
                    if (stepAlign === 'left') offsetX = -(effectivePrevLarg/2) + (larg/2);
                    else if (stepAlign === 'right') offsetX = (effectivePrevLarg/2) - (larg/2);
                    
                    currentX += offsetX * Math.cos(drawAngle);
                    currentZ -= offsetX * Math.sin(drawAngle);

                    let rawOffsets = tr.dataset.manualOffsets ? JSON.parse(tr.dataset.manualOffsets) : {};
                    let customOffset = rawOffsets[i] || {x: 0, z: 0, angleOffset: 0, mirrorX: false, mirrorZ: false};
                    let drawX = currentX + (customOffset.x || 0);
                    let drawZ = currentZ + (customOffset.z || 0);

                    if (tipo.toLowerCase().includes('pianerottolo')) {
                        console.log(`[2D] Pianerottolo Idx: ${globalStepIdx} | Align: ${stepAlign} | offsetLocalX: ${offsetX} | drawX: ${drawX.toFixed(2)}, drawZ: ${drawZ.toFixed(2)} | angle: ${drawAngle}`);
                        console.log(`[2D DOM] Type parsed: ${tipo}, Larg: ${larg}, Pedata: ${pedata}`);
                    }

                    let shapeD = null;
                    if (tr.dataset.shapeData) {
                        try { shapeD = JSON.parse(tr.dataset.shapeData); } catch(e) {}
                    }

                    stepsData.push({
                        trElement: tr,
                        qtaIndex: i,
                        id: globalStepIdx,
                        x: drawX,
                        z: drawZ,
                        angle: drawAngle,
                        angleOffset: customOffset.angleOffset || 0,
                        mirrorX: customOffset.mirrorX || false,
                        mirrorZ: customOffset.mirrorZ || false,
                        w: larg,
                        d: pedata,
                        tipo: tipo,
                        dir: stepDir,
                        blueline: stepBlueline,
                        customVertices: shapeD ? shapeD.customVertices : null
                    });

                    let r = Math.max(larg, pedata) * 1.5;
                    if(drawX - r < minX) minX = drawX - r;
                    if(drawX + r > maxX) maxX = drawX + r;
                    if(drawZ - r < minZ) minZ = drawZ - r;
                    if(drawZ + r > maxZ) maxZ = drawZ + r;

                    let nextLocalZ = -pedata;
                    let nextLocalX = 0;

                    let didTurn = false;
                    
                    if (tipo.toLowerCase().includes('chiusura')) {
                        nextLocalZ = 0;
                        nextLocalX = 0;
                    } else {
                        if (stepDir === 'left') { currentAngle += Math.PI / 2; didTurn = true; }
                        else if (stepDir === 'right') { currentAngle -= Math.PI / 2; didTurn = true; }
                        else if (stepDir === 'left45') { currentAngle += Math.PI / 4; didTurn = true; }
                        else if (stepDir === 'right45') { currentAngle -= Math.PI / 4; didTurn = true; }
                        else if (stepDir === 'left30') { currentAngle += Math.PI / 6; didTurn = true; }
                        else if (stepDir === 'right30') { currentAngle -= Math.PI / 6; didTurn = true; }
                        else if (stepDir === 'uturn') { currentAngle += Math.PI; didTurn = true; }

                        if (stepDir === 'left') { nextLocalX = -(larg/2); nextLocalZ = -pedata/2; }
                        else if (stepDir === 'right') { nextLocalX = larg/2; nextLocalZ = -pedata/2; }
                        else if (stepDir === 'left45' || stepDir === 'right45' || stepDir === 'left30' || stepDir === 'right30') { nextLocalZ = -pedata; nextLocalX = 0; }
                        else if (stepDir === 'uturn') {
                            // nextLocalZ = 0: parte dal fronte del pianerottolo
                            // nextLocalX = ±(larg/2 - prevLarg/2):
                            //   bordo DESTRO rampa ritorno = bordo DESTRO pianerottolo
                            nextLocalZ = 0;
                            let effectivePrevLarg2 = prevDir === 'left' || prevDir === 'right' ? prevPedata : prevLarg;
                            if (stepAlign === 'right') nextLocalX = larg/2 - effectivePrevLarg2/2;
                            else if (stepAlign === 'left') nextLocalX = -(larg/2 - effectivePrevLarg2/2);
                            else nextLocalX = 0;
                        }
                    }

                    let dX = nextLocalX * Math.cos(drawAngle) + nextLocalZ * Math.sin(drawAngle);
                    let dZ = -nextLocalX * Math.sin(drawAngle) + nextLocalZ * Math.cos(drawAngle);

                    currentX += dX;
                    currentZ += dZ;

                    globalStepIdx++;
                    prevLarg = larg;
                    prevPedata = pedata;
                    prevDir = stepDir;
                }
            });

            if(stepsData.length === 0) {
                ctx.fillStyle = '#64748b';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Nessun gradino inserito nella composizione base.', canvas.width/2, canvas.height/2);
                return;
            }

            let modelWidth = Math.max(0.1, maxX - minX) + 1.2;
            let modelHeight = Math.max(0.1, maxZ - minZ) + 1.2;
            drawScale = Math.min(canvas.width / modelWidth, canvas.height / modelHeight) * 0.85;
            
            drawCx = (minX + maxX) / 2;
            drawCz = (minZ + maxZ) / 2;

            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            
            stepsData.forEach(step => {
                ctx.save();
                ctx.translate((step.x - drawCx) * drawScale, (step.z - drawCz) * drawScale);
                ctx.rotate(-(step.angle + step.angleOffset));
                // Specchiatura
                if (step.mirrorX) ctx.scale(-1, 1);
                if (step.mirrorZ) ctx.scale(1, -1);

                let pw = step.w * drawScale;
                let ph = step.d * drawScale;
                
                let isSpecial = step.tipo.toLowerCase().includes('oca') || step.tipo.toLowerCase().includes('pianerottolo') || step.tipo.toLowerCase().includes('curva') || step.tipo.toLowerCase().includes('giro');
                ctx.fillStyle = isSpecial ? '#fef08a' : '#f8dec3';
                ctx.strokeStyle = '#a16207';
                ctx.lineWidth = 1;

                let normTipo = step.tipo.toLowerCase().replace(/è/g, "e'");
                
                if (normTipo.includes("oca sx") && normTipo.includes("chiusura")) {
                    ctx.beginPath();
                    ctx.moveTo(-pw/2, 0);
                    ctx.lineTo(pw/2, 0);
                    ctx.lineTo(pw/2, ph);
                    ctx.closePath();
                    ctx.fill(); ctx.stroke();
                } else if (normTipo.includes("oca dx") && normTipo.includes("chiusura")) {
                    ctx.beginPath();
                    ctx.moveTo(-pw/2, 0);
                    ctx.lineTo(pw/2, 0);
                    ctx.lineTo(-pw/2, ph);
                    ctx.closePath();
                    ctx.fill(); ctx.stroke();
                } else if (normTipo.includes('oca sx')) {
                    // Triangolo rettangolo con angolo retto in basso a SINISTRA
                    // (-pw/2, 0) = angolo sinistro basso (il "muro")
                    // (pw/2,  0) = angolo destro basso  (il fronte pedata)
                    // (-pw/2,-ph) = angolo sinistro alto  (il raccordo con il muro)
                    ctx.beginPath();
                    ctx.moveTo(-pw/2, 0);
                    ctx.lineTo(pw/2, 0);
                    ctx.lineTo(-pw/2, -ph);
                    ctx.closePath();
                    ctx.fill(); ctx.stroke();
                } else if (step.tipo.toLowerCase().includes('oca dx')) {
                    // Triangolo rettangolo con angolo retto in basso a DESTRA
                    // (-pw/2, 0) = angolo sinistro basso (il fronte pedata)
                    // (pw/2,  0) = angolo destro basso  (il "muro")
                    // (pw/2, -ph) = angolo destro alto   (il raccordo con il muro)
                    ctx.beginPath();
                    ctx.moveTo(-pw/2, 0);
                    ctx.lineTo(pw/2, 0);
                    ctx.lineTo(pw/2, -ph);
                    ctx.closePath();
                    ctx.fill(); ctx.stroke();
                } else {
                    let customVerts = null;
                    if (step.customVertices) {
                        try {
                            customVerts = typeof step.customVertices === 'string' ? JSON.parse(step.customVertices) : step.customVertices;
                        } catch(e) {
                            console.error("[2D Viewer] Failed to parse customVertices", e);
                        }
                    }
                    
                    if (customVerts && customVerts.length >= 3) {
                        console.log(`[2D Viewer] Drawing libero shape with ${customVerts.length} vertices. pw=${pw}, ph=${ph}`);
                        ctx.beginPath();
                        ctx.moveTo((customVerts[0].x - 0.5) * pw, (customVerts[0].y - 1.0) * ph);
                        for(let i=1; i<customVerts.length; i++) {
                            ctx.lineTo((customVerts[i].x - 0.5) * pw, (customVerts[i].y - 1.0) * ph);
                            console.log(`  -> Vertex ${i}: x=${(customVerts[i].x - 0.5) * pw}, y=${(customVerts[i].y - 1.0) * ph}`);
                        }
                        ctx.closePath();
                        ctx.fill(); ctx.stroke();
                    } else {
                        console.log(`[2D Viewer] Falling back to rect. customVerts empty or <3. step.customVertices=`, step.customVertices);
                        ctx.beginPath();
                        ctx.rect(-pw/2, -ph, pw, ph);
                        ctx.fill(); ctx.stroke();
                    }
                }

                ctx.beginPath();
                let bl = step.blueline || 'auto';
                let sideToDraw = '';
                
                if (bl === 'auto') {
                    if (step.dir === 'left') sideToDraw = 'left';
                    else if (step.dir === 'right') sideToDraw = 'right';
                    else if (step.dir === 'uturn') sideToDraw = 'bottom';
                    else sideToDraw = 'top';
                } else {
                    sideToDraw = bl;
                }
                
                if (sideToDraw === 'left') {
                    ctx.moveTo(-pw/2, 0);
                    ctx.lineTo(-pw/2, -ph);
                } else if (sideToDraw === 'right') {
                    ctx.moveTo(pw/2, 0);
                    ctx.lineTo(pw/2, -ph);
                } else if (sideToDraw === 'top') {
                    ctx.moveTo(-pw/2, -ph);
                    ctx.lineTo(pw/2, -ph);
                } else if (sideToDraw === 'bottom') {
                    ctx.moveTo(-pw/2, 0);
                    ctx.lineTo(pw/2, 0);
                } else if (sideToDraw === 'diag') {
                    if (step.tipo.toLowerCase().includes('oca sx')) {
                        ctx.moveTo(pw/2, 0);
                        ctx.lineTo(-pw/2, -ph);
                    } else if (step.tipo.toLowerCase().includes('oca dx')) {
                        ctx.moveTo(-pw/2, 0);
                        ctx.lineTo(pw/2, -ph);
                    }
                }
                
                if (sideToDraw !== 'none') {
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                }

                // Highlight selezione (viola per selezionati)
                if (selectedStepIds.has(step.id)) {
                    let pw2 = step.w * drawScale;
                    let ph2 = step.d * drawScale;
                    ctx.strokeStyle = '#7c3aed';
                    ctx.lineWidth = 2.5;
                    ctx.setLineDash([6, 3]);
                    ctx.strokeRect(-pw2/2 - 4, -ph2 - 4, pw2 + 8, ph2 + 8);
                    ctx.setLineDash([]);
                }

                // Corregge il testo capovolto per gradini con rotazione ~180° (es. dopo uturn)
                let normAngle = ((step.angle % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
                let isUpsideDown = normAngle > Math.PI * 0.6 && normAngle < Math.PI * 1.4;
                if (isUpsideDown) ctx.scale(-1, -1);
                ctx.fillText(step.id.toString(), 0, isUpsideDown ? ph/2 : -ph/2);

                ctx.restore();
            });

            if(stepsData.length > 0) {
                let first = stepsData[0];
                ctx.save();
                ctx.translate((first.x - drawCx) * drawScale, (first.z - drawCz) * drawScale);
                ctx.rotate(-first.angle);
                
                let pw = first.w * drawScale;
                ctx.fillStyle = '#10b981';
                ctx.font = "bold 11px Arial";
                ctx.textAlign = 'center';
                ctx.fillText("PARTENZA", 0, 15);
                
                ctx.beginPath();
                ctx.moveTo(-pw/2, 0);
                ctx.lineTo(pw/2, 0);
                ctx.strokeStyle = '#10b981';
                ctx.lineWidth = 4;
                ctx.stroke();
                ctx.restore();
            }

            ctx.restore();
        }

        function _updateStepToolbar() {
            const toolbar = document.getElementById('step-2d-toolbar');
            if (!toolbar) return;
            if (selectedStepIds.size === 0) {
                toolbar.style.display = 'none';
                return;
            }
            toolbar.style.display = 'flex';
            const lbl = document.getElementById('step-2d-toolbar-label');
            if (lbl) {
                if (selectedStepIds.size === 1) {
                    const id = [...selectedStepIds][0];
                    const step = stepsData.find(s => s.id === id);
                    // Etichetta tipo leggibile
                    let tipoLabel = 'Gradino';
                    if (step) {
                        const t = step.tipo.toLowerCase();
                        if (t.includes('pianerottolo')) tipoLabel = 'Pianerottolo';
                        else if (t.includes('oca'))     tipoLabel = "Piè d'oca";
                        else if (t.includes('curva'))   tipoLabel = 'Curva';
                        else if (t.includes('libero'))  tipoLabel = 'Libero';
                    }
                    lbl.textContent = `${tipoLabel} #${id}`;
                } else {
                    lbl.textContent = `${selectedStepIds.size} elementi selezionati`;
                }
            }
        }

        function _applyToSelected(fn) {
            stepsData.filter(s => selectedStepIds.has(s.id)).forEach(selStep => {
                let raw = selStep.trElement.dataset.manualOffsets ? JSON.parse(selStep.trElement.dataset.manualOffsets) : {};
                let cur = raw[selStep.qtaIndex] || {x:0, z:0, angleOffset:0, mirrorX:false, mirrorZ:false};
                fn(cur);
                raw[selStep.qtaIndex] = cur;
                selStep.trElement.dataset.manualOffsets = JSON.stringify(raw);
            });
            renderStairs();
        }

        function rotateSelected(deg) {
            _applyToSelected(cur => { cur.angleOffset = (cur.angleOffset || 0) - (deg * Math.PI / 180); });
        }
        function mirrorSelectedX() {
            _applyToSelected(cur => { cur.mirrorX = !cur.mirrorX; });
        }
        function mirrorSelectedZ() {
            _applyToSelected(cur => { cur.mirrorZ = !cur.mirrorZ; });
        }
        function resetSelected() {
            stepsData.filter(s => selectedStepIds.has(s.id)).forEach(selStep => {
                let raw = selStep.trElement.dataset.manualOffsets ? JSON.parse(selStep.trElement.dataset.manualOffsets) : {};
                raw[selStep.qtaIndex] = {x:0, z:0, angleOffset:0, mirrorX:false, mirrorZ:false};
                selStep.trElement.dataset.manualOffsets = JSON.stringify(raw);
            });
            renderStairs();
        }
        function resetAllOffsets() {
            document.querySelectorAll('#stairsTableBody tr').forEach(tr => {
                tr.dataset.manualOffsets = '{}';
            });
            selectedStepIds.clear();
            renderStairs();
            _updateStepToolbar();
        }

        return { init, renderStairs, rotateSelected, mirrorSelectedX, mirrorSelectedZ, resetSelected, resetAllOffsets };
    })();
    window.Stairs2DViewer = Stairs2DViewer; // esposto globalmente per i pulsanti HTML

    function toggle3DExplode(btn) {
        Stairs3DViewer.isExploded3D = !Stairs3DViewer.isExploded3D;
        if (Stairs3DViewer.isExploded3D) {
            btn.innerHTML = `<i class="fa-solid fa-compress"></i> Ricompatta 3D`;
            btn.style.background = "#fae8ff";
        } else {
            btn.innerHTML = `<i class="fa-solid fa-arrows-up-down"></i> Esplodi 3D`;
            btn.style.background = "";
        }
        update3DStairs();
    }

    function toggle3DNumbers(btn) {
        Stairs3DViewer.showNumbers3D = !Stairs3DViewer.showNumbers3D;
        if (Stairs3DViewer.showNumbers3D) {
            btn.innerHTML = `<i class="fa-solid fa-eye-slash"></i> Nascondi Numeri`;
            btn.style.background = "#dbeafe";
        } else {
            btn.innerHTML = `<i class="fa-solid fa-list-ol"></i> Numera Gradini`;
            btn.style.background = "";
        }
        update3DStairs();
    }

    function exportStairsBOM() {
        let bom = {}; 

        document.querySelectorAll('#stairsTableBody tr').forEach(tr => {
            let qta = parseInt(tr.querySelector('.tbl-str-qta').value) || 1;
            let larg = parseFloat(tr.querySelector('.tbl-str-larg').value) || 0;
            let pedata = parseFloat(tr.querySelector('.tbl-str-pedata').value) || 0;
            let alzata = parseFloat(tr.querySelector('.tbl-str-alzata').value) || 0;
            let alzMq = tr.querySelector('.tbl-str-alz-mq').checked;
            let tipo = tr.querySelector('.tbl-str-tipo').value || 'Gradino standard';
            let isPianerottolo = tipo.toLowerCase().includes('pianerottolo') || tipo.toLowerCase().includes('oca');

            let dimStr = `${(larg*100).toFixed(0)}x${(pedata*100).toFixed(0)} cm`;
            
            let toriCount = parseInt(tr.querySelector('.tbl-str-tori').value) || 0;
            let latiP = parseInt(tr.querySelector('.tbl-str-lati').value) || 0; 
            let lavorazioniPedata = [];
            if(toriCount > 0) lavorazioniPedata.push(`${toriCount} Lati Toro`);
            if(latiP > 0) lavorazioniPedata.push(`Battiscopa su ${latiP} lati`);
            let lavStrPed = lavorazioniPedata.length > 0 ? ` (${lavorazioniPedata.join(', ')})` : '';

            let nomePezzo = isPianerottolo ? "Pianerottolo/Speciale" : "Pedata";
            let keyPed = `${nomePezzo}_${dimStr}_${lavStrPed}`;
            if(!bom[keyPed]) bom[keyPed] = 0;
            bom[keyPed] += qta;

            if(alzMq && alzata > 0 && !isPianerottolo) {
                let dimAlz = `${(larg*100).toFixed(0)}x${(alzata*100).toFixed(0)} cm`;
                let latiAInput = tr.querySelector('.tbl-str-lati-alz');
                let latiA = parseInt(latiAInput ? latiAInput.value : '0');
                let lavStrAlz = latiA > 0 ? ` (Battiscopa su ${latiA} lati)` : '';
                let keyAlz = `Alzata_${dimAlz}_${lavStrAlz}`;
                if(!bom[keyAlz]) bom[keyAlz] = 0;
                bom[keyAlz] += qta;
            }
        });

        if(Object.keys(bom).length === 0) {
            alert("Nessun gradino inserito nella tabella.");
            return;
        }

        let text = "DISTINTA DI TAGLIO SCALE\n========================\n\n";
        for(let k in bom) {
            text += `- N. ${bom[k]} pz: ${k.replace(/_/g, ' ')}\n`;
        }
        
        let overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';

        let modal = document.createElement('div');
        modal.style.background = '#fff';
        modal.style.padding = '20px';
        modal.style.borderRadius = '8px';
        modal.style.maxWidth = '500px';
        modal.style.width = '90%';
        modal.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';

        let title = document.createElement('h3');
        title.innerText = 'Distinta di Taglio';
        title.style.marginTop = '0';
        
        let txtarea = document.createElement('textarea');
        txtarea.value = text;
        txtarea.style.width = '100%';
        txtarea.style.height = '200px';
        txtarea.style.boxSizing = 'border-box';
        txtarea.style.marginBottom = '15px';
        txtarea.style.fontFamily = 'monospace';
        
        let closeBtn = document.createElement('button');
        closeBtn.innerText = 'Chiudi';
        closeBtn.className = 'btn-secondary';
        closeBtn.onclick = () => document.body.removeChild(overlay);

        let copyBtn = document.createElement('button');
        copyBtn.innerText = 'Copia Testo';
        copyBtn.className = 'btn-primary';
        copyBtn.style.marginRight = '10px';
        copyBtn.style.background = '#0ea5e9';
        copyBtn.style.color = '#fff';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(text);
            copyBtn.innerText = 'Copiato!';
            setTimeout(() => copyBtn.innerText='Copia Testo', 2000);
        };

        modal.appendChild(title);
        modal.appendChild(txtarea);
        modal.appendChild(copyBtn);
        modal.appendChild(closeBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    function update3DStairs() {
        if (typeof Stairs2DViewer !== 'undefined') Stairs2DViewer.renderStairs();
        updateStairsSummaryTable();
    }

    function updateStairsSummaryTable() {
        const tbody = document.getElementById('stairsSummaryBody');
        if(!tbody) return;
        
        let tableRows = document.querySelectorAll('#stairsTableBody tr');
        let groups = {};
        
        tableRows.forEach(tr => {
            let tipo = tr.querySelector('.tbl-str-tipo')?.value || 'Gradino standard';
            let larg = parseFloat(tr.querySelector('.tbl-str-larg')?.value) || 0;
            let pedata = parseFloat(tr.querySelector('.tbl-str-pedata')?.value) || 0;
            let qta = parseInt(tr.querySelector('.tbl-str-qta')?.value) || 1;
            let tori = parseInt(tr.querySelector('.tbl-str-tori')?.value) || 0;
            let mlTori = parseFloat(tr.querySelector('.tbl-str-mltori')?.value) || 0;
            
            let mlBatti = parseFloat(tr.querySelector('.tbl-str-mlbatti')?.value) || 0;
            let latiPed = parseInt(tr.querySelector('.tbl-str-lati')?.value) || 0;
            let latiAlz = parseInt(tr.querySelector('.tbl-str-lati-alz')?.value) || 0;
            let strParts = [];
            if(latiPed > 0) strParts.push(`${latiPed} ${latiPed === 1 ? 'Lato' : 'Lati'} Pedata`);
            if(latiAlz > 0) strParts.push(`${latiAlz} ${latiAlz === 1 ? 'Lato' : 'Lati'} Alzata`);
            let latiBattiStr = strParts.length > 0 ? strParts.join(" + ") : 'Nessuno';
            
            // Fix eventuale encoding errato
            if(tipo.includes("Piè")) tipo = tipo.replace("Piè", "Pie'");
            if(tipo.includes("Piè")) tipo = tipo.replace("Piè", "Pie'");
            
            let shapeD = null;
            if (tr.dataset.shapeData) {
                try { shapeD = JSON.parse(tr.dataset.shapeData); } catch(e) {}
            }
            
            // Per i gradini liberi, vogliamo che la miniatura rifletta la forma reale e non li raggruppi in modo errato se hanno forme diverse
            let shapeHash = "";
            if (shapeD && shapeD.customVertices && shapeD.customVertices.length >= 3) {
                // Hashing the first vertex minimally as uniqueness indicator so totally different libero steps don't merge thumbnail
                let p1 = shapeD.customVertices[0];
                let p2 = shapeD.customVertices[1];
                shapeHash = `_SHP${Math.round(p1.x*10)}${Math.round(p2.x*10)}`;
            }

            let key = `${tipo}_${larg}x${pedata}_T${tori}_B${latiBattiStr}${shapeHash}`;
            if (!groups[key]) {
                groups[key] = { 
                    tipo, larg, pedata, tori, latiBattiStr, qta: 0, toriTotCms: 0, battiTotCms: 0,
                    customVertices: shapeD && shapeD.customVertices ? shapeD.customVertices : null
                };
            }
            groups[key].qta += qta;
            groups[key].toriTotCms += (mlTori * 100);
            groups[key].battiTotCms += (mlBatti * 100);
        });

        tbody.innerHTML = '';
        let keys = Object.keys(groups);
        if(keys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; color:#94a3b8;">Aggiungi gradini alla tabella per vederne il riepilogo</td></tr>';
            return;
        }
        
        keys.forEach((key, index) => {
            let g = groups[key];
            let tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e2e8f0';
            
            let canvasId = 'summary-canvas-' + index;
            let toriDisplay = g.toriTotCms > 0 ? (g.toriTotCms / g.qta).toFixed(0) : '—';
            let toriPz = g.tori > 0 ? (g.tori * g.qta) : '—';
            
            let battiDisplay = g.battiTotCms > 0 ? (g.battiTotCms / g.qta).toFixed(0) : '—';
            let latiBattiDisplay = g.latiBattiStr !== 'Nessuno' ? g.latiBattiStr : '—';
            
            let L_cm = (g.larg * 100).toFixed(0);
            let P_cm = (g.pedata * 100).toFixed(0);
            
            tr.innerHTML = `
                <td style="padding:10px;"><canvas id="${canvasId}" width="80" height="60" style="background:#fff; border:1px solid #cbd5e1; border-radius:4px; margin:0 auto; display:block;"></canvas><div style="font-size:9px; color:#64748b; margin-top:3px;">${g.tipo}</div></td>
                <td style="padding:10px; font-weight:600; color:#1e293b;">${L_cm} &times; ${P_cm}</td>
                <td style="padding:10px; font-weight:700; color:#3b82f6; font-size:14px;">${g.qta}</td>
                <td style="padding:10px; color:#065f46;">${toriDisplay}</td>
                <td style="padding:10px; font-weight:700; color:#065f46;">${toriPz}</td>
                <td style="padding:10px; color:#be185d;">${battiDisplay}</td>
                <td style="padding:10px; font-weight:700; color:#be185d; font-size:11px;">${latiBattiDisplay}</td>
            `;
            tbody.appendChild(tr);
            
            setTimeout(() => drawStairShapeMini(canvasId, g), 10);
        });
    }

    function drawStairShapeMini(canvasId, group) {
        let canvas = document.getElementById(canvasId);
        if(!canvas) return;
        let ctx = canvas.getContext('2d');
        ctx.clearRect(0,0, canvas.width, canvas.height);
        
        let W = group.larg;
        let H = group.pedata;
        let maxDim = Math.max(W, H);
        if(maxDim === 0) maxDim = 1;
        
        let scale = 40 / maxDim;
        let drawW = W * scale;
        let drawH = H * scale;
        
        if(drawW < 10) drawW = 10;
        if(drawH < 10) drawH = 10;
        
        let cx = canvas.width/2;
        let cy = canvas.height/2;
        
        let tipoNorm = group.tipo.toLowerCase();
        let isL = tipoNorm.includes('l-shape');
        let isPieSx = tipoNorm.includes("oca") && tipoNorm.includes("sx");
        let isPieDx = tipoNorm.includes("oca") && tipoNorm.includes("dx");
        
        // Fallback for doca without sx/dx
        if (tipoNorm.includes("oca") && !isPieSx && !isPieDx) isPieSx = true; 
        
        let mw = drawW/2;
        let mh = drawH/2;
        
        ctx.save();
        ctx.translate(cx, cy);
        
        ctx.fillStyle = '#f1f5f9';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        
        if(isL) {
            ctx.beginPath();
            ctx.moveTo(-mw, -mh);
            ctx.lineTo(mw, -mh);
            ctx.lineTo(mw, mh);
            ctx.lineTo(-mw/2, mh);
            ctx.lineTo(-mw/2, -mh/2);
            ctx.lineTo(-mw, -mh/2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            if(group.tori > 0) {
               ctx.strokeStyle = '#ef4444';
               ctx.lineWidth = 2.5;
               ctx.beginPath();
               ctx.moveTo(-mw, -mh);
               ctx.lineTo(mw, -mh);
               ctx.stroke();
            }
        }
        else if (isPieSx || isPieDx) {
            // Lavorazione Piè d'oca: Triangolo rettangolo con ipotenusa come lato frontale
            // Teorema di Euclide per l'altezza relativa all'ipotenusa.
            let discriminant = (drawW * drawW / 4) - (drawH * drawH);
            let cxOffset = 0;
            if (discriminant > 0) {
                cxOffset = Math.sqrt(discriminant); // Distanza dal centro
            }
            
            // Per SX l'angolo acuto (perno) è a SINISTRA, quindi spostiamo il vertice a 90° (muro) a DESTRA
            let peakX = isPieSx ? cxOffset : -cxOffset;

            ctx.beginPath();
            ctx.moveTo(-mw, mh);      // Lato Frontale (Ipotenusa) - Inizio
            ctx.lineTo(mw, mh);       // Lato Frontale (Ipotenusa) - Fine
            ctx.lineTo(peakX, -mh);   // Vertice a 90°
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Toro applicato all'ipotenusa (fronte)
            if(group.tori > 0) {
               ctx.strokeStyle = '#ef4444';
               ctx.lineWidth = 3;
               ctx.beginPath();
               ctx.moveTo(-mw, mh);
               ctx.lineTo(mw, mh);
               ctx.stroke();
            }
        }
        else if (group.customVertices && group.customVertices.length >= 3) {
            // Disegna il poligono personalizzato (Gradino Libero)
            let cv = group.customVertices;
            ctx.beginPath();
            ctx.moveTo((cv[0].x - 0.5) * drawW, (cv[0].y - 0.5) * drawH);
            for(let i=1; i<cv.length; i++) {
                ctx.lineTo((cv[i].x - 0.5) * drawW, (cv[i].y - 0.5) * drawH);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            if(group.tori > 0) {
                // Applica un toro visivo sul lato inferiore (idealmente il lato pedata d'ingresso)
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                // Questo è approssimativo, disegna una linea orizzontale in basso
                let bMaxY = -9999;
                let bottomSeg = null;
                for(let i=0; i<cv.length; i++) {
                    let p1 = cv[i], p2 = cv[(i+1)%cv.length];
                    let amy = (p1.y + p2.y)/2;
                    if (amy > bMaxY) {
                        bMaxY = amy;
                        bottomSeg = [p1, p2];
                    }
                }
                if (bottomSeg) {
                    ctx.moveTo((bottomSeg[0].x - 0.5) * drawW, (bottomSeg[0].y - 0.5) * drawH);
                    ctx.lineTo((bottomSeg[1].x - 0.5) * drawW, (bottomSeg[1].y - 0.5) * drawH);
                    ctx.stroke();
                }
            }
        }
        else {
            // Fallback (Gradino standard)
            ctx.fillRect(-mw, -mh, drawW, drawH);
            ctx.strokeRect(-mw, -mh, drawW, drawH);
            
            if(group.tori > 0) {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.moveTo(-mw, mh);
                ctx.lineTo(mw, mh);
                ctx.stroke();
            }
        }
        
        ctx.restore();
    }

    function printStairsSummary() {
        const table = document.getElementById('stairsSummaryTable');
        if(!table) return;
        const tableHTML = table.outerHTML;
        
        let canvases = table.querySelectorAll('canvas');
        let canvasData = [];
        canvases.forEach(c => canvasData.push(c.toDataURL('image/png')));

        const printWin = window.open('', '_blank');
        let html = `<!DOCTYPE html>
        <html>
        <head><title>Stampa Riepilogo Tagli Gradini</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #1e293b; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align:center; font-size: 13px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; }
          th { background-color: #f1f5f9; font-weight: bold; padding: 12px; }
          .canvas-img { width: 80px; height: 60px; object-fit: contain; }
          @media print {
            body { margin: 0; padding: 10px; }
          }
        </style>
        </head>
        <body onload="setTimeout(() => { window.print(); window.onafterprint = function(){ window.close(); }; }, 500);">
          <h2 style="margin-bottom:5px;">Riepilogo Tagli e Sagome Gradini</h2>
          <p style="color:#64748b; font-size:14px; margin-top:0;">Da consegnare in magazzino o cliente</p>
          ${tableHTML}
        </body>
        </html>`;
        
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
        
        setTimeout(() => {
            let printCanvases = printWin.document.querySelectorAll('canvas');
            printCanvases.forEach((c, idx) => {
                let img = printWin.document.createElement('img');
                img.src = canvasData[idx];
                img.className = 'canvas-img';
                c.parentNode.replaceChild(img, c);
            });
        }, 100);
    }
    
    function startNewSheet() {
        const hasDraft = localStorage.getItem(DRAFT_KEY) !== null;
        if(hasDraft && document.getElementById('step-start') && document.getElementById('step-start').style.display !== 'none') {
             if(!confirm("Hai una bozza in memoria. Avviando una nuova scheda la cancellerai. Vuoi continuare?")) return;
        }
        clearDraft();
        if (typeof state !== 'undefined') state.editingId = null;

        // Reset forms
        const formPanel = document.getElementById('step-form');
        if(formPanel) {
            formPanel.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea').forEach(el => el.value = '');
            formPanel.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(el => el.checked = false);
            formPanel.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
            
            let fileInput = document.getElementById('client-upload-input');
            if(fileInput) fileInput.value = '';
        }

        // Reset tables
        const tb1 = document.getElementById('stairsTableBody'); if(tb1) tb1.innerHTML = '';
        const tb2 = document.getElementById('roomsTableBody'); if(tb2) tb2.innerHTML = '';
        const tb3 = document.getElementById('techAccessori'); if(tb3) tb3.innerHTML = '';
        const ssb = document.getElementById('stairsSummaryBody'); if(ssb) ssb.innerHTML = '<tr><td colspan="5" style="padding:20px; color:#94a3b8;">Aggiungi gradini alla tabella per vederne il riepilogo</td></tr>';

        // Recalculate
        if(typeof calcStairsTotals === 'function') calcStairsTotals();
        if(typeof calcTableTotals === 'function') calcTableTotals();
        if(typeof updateStairsSummaryTable === 'function') updateStairsSummaryTable();

        goToStep('step-form');
        setTimeout(() => window.scrollTo(0, 0), 50);
    }

    // --- On Load ---
    document.addEventListener('DOMContentLoaded', init);

    // Export public methods
    return {
        startNewSheet,
        printStairsSummary,
        goToStep,
        generateReview,
        resetAndExit,
        saveAndExit,
        saveAndSend,
        saveAndNextUnit,
        onClientSelect,
        speakText,
        onChangeVoice,
        startGuidedVoice,
        startTableDictation,
        addRoomRow,
        calcRoomRow,
        calcTableTotals,
        exportRoomsExcel,
        addStairRow,
        calcStairRow,
        calcStairsTotals,
        selectStepShape,
        resetStepShape,
        addShapeToStairsTable,
        drawStepShape,
        toggleEdgeState,
        applyAlzataToAll,
        recalcAllStairs,
        syncLatiAlz,
        update3DStairs,
        duplicateStairRow,

        addShapeToStairsTableWrapper,
        exportStairsBOM,
        clearLiberoShape,
        openLiberoMisureModal,
        closeLiberoMisureModal,
        addLiberoVertexRow,
        updateLiberoModalPreview,
        applyLiberoMisureModal,
        _renumberLiberoRows,
        confirmLiberoSegment,
        skipLiberoSegment,
        Stairs2DViewer,
        reopenRecentPdf,
        loadSchedaInForm,
        cancelEditMode,
        deleteScheda,
        filterRecenti,
        renderRecentList,
        syncPosaField,
        confirmMeasureEntry,
        toggleAccessorio: function(chk) {
            const val = chk.value;
            const textarea = document.getElementById('techAccessori');
            let currentText = textarea.value;
            if(chk.checked) {
                if(!currentText.includes(val)) {
                    textarea.value = currentText ? currentText + '\n' + val : val;
                }
            } else {
                textarea.value = currentText.replace(val, '').split('\n').filter(l => l.trim()).join('\n');
            }
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

})();
// Esportazione globale per l'utilizzo da parte di altri moduli/HTML
window.SopralluogoApp = SopralluogoApp;




