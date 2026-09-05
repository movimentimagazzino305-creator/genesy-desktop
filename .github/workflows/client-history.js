/**
 * client-history.js
 * Manages the "Storico Cliente" (Client 360) Modal
 * Aggregates Genesy Quotes, Giobby Documents, and External Links.
 */

window.ClientHistory = {
    currentClient: null,

    // Config
    tabs: ['genesy', 'giobby', 'sopralluoghi', 'actions', 'info'],

    open: async function (clientId) {
        console.log("ClientHistory.open called with", clientId);
        alert("DEBUG: ClientHistory.open called for " + clientId);
        const client = db.getClients().find(c => c.id === clientId);
        if (!client) return alert("Cliente non trovato.");

        this.currentClient = client;
        this.renderModal();
        this.switchTab('genesy');
    },

    close: function () {
        const modal = document.getElementById('clientHistoryModal');
        if (modal) modal.remove();
        this.currentClient = null;
    },

    renderModal: function () {
        // Remove existing if any
        this.close();

        const c = this.currentClient;
        const html = `
            <div id="clientHistoryModal">
                <div class="history-modal-content">
                    <div class="history-header">
                        <div>
                            <h2><i class="fa-solid fa-user-clock"></i> Storico: ${c.name} ${c.surname || ''}</h2>
                            <div class="history-client-meta">
                                ${c.city ? `<i class="fa-solid fa-location-dot"></i> ${c.city} ` : ''}
                                ${c.phone ? `&bull; <i class="fa-solid fa-phone"></i> ${c.phone}` : ''}
                            </div>
                        </div>
                        <button class="btn-icon" onclick="window.ClientHistory.close()" style="font-size: 1.5rem;">&times;</button>
                    </div>

                    <div class="history-tabs">
                        <button class="history-tab-btn active" onclick="window.ClientHistory.switchTab('genesy')" data-tab="genesy">
                            <i class="fa-solid fa-file-invoice"></i> Genesy
                        </button>
                        <button class="history-tab-btn" onclick="window.ClientHistory.switchTab('giobby')" data-tab="giobby">
                            <i class="fa-solid fa-cloud"></i> Giobby
                        </button>
                        <button class="history-tab-btn" onclick="window.ClientHistory.switchTab('sopralluoghi')" data-tab="sopralluoghi">
                            <i class="fa-solid fa-clipboard-check"></i> Schede di cantiere
                        </button>
                        <button class="history-tab-btn" onclick="window.ClientHistory.switchTab('actions')" data-tab="actions">
                            <i class="fa-solid fa-bolt"></i> Azioni Rapide
                        </button>
                    </div>

                    <div class="history-body">
                        <div id="tab-genesy" class="history-tab-pane active">Caricamento...</div>
                        <div id="tab-giobby" class="history-tab-pane">Caricamento...</div>
                        <div id="tab-sopralluoghi" class="history-tab-pane">Caricamento...</div>
                        <div id="tab-actions" class="history-tab-pane"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
    },

    switchTab: async function (tabName) {
        // Update UI
        document.querySelectorAll('.history-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.history-tab-btn[data-tab="${tabName}"]`).classList.add('active');

        document.querySelectorAll('.history-tab-pane').forEach(p => p.classList.remove('active'));
        const pane = document.getElementById(`tab-${tabName}`);
        pane.classList.add('active');

        // Load Content
        if (tabName === 'genesy') this.loadGenesyQuotes(pane);
        if (tabName === 'giobby') this.loadGiobbyDocs(pane);
        if (tabName === 'sopralluoghi') this.loadSopralluoghi(pane);
        if (tabName === 'actions') this.loadActions(pane);
    },

    // --- GENESY TAB (Local Quotes) ---
    loadGenesyQuotes: function (container) {
        const quotes = db.getQuotes().filter(q => {
            // Match by ID or Name (legacy)
            if (q.customer?.id === this.currentClient.id) return true;
            // Fallback: Name Match
            if (!q.customer && q.clientName === this.currentClient.name) return true;
            return false;
        }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        if (quotes.length === 0) {
            container.innerHTML = `<div class="text-center text-muted" style="padding: 40px;">Nessun preventivo Genesy trovato.</div>`;
            return;
        }

        let html = `<div class="history-card"><h3>Preventivi Locali (${quotes.length})</h3>`;

        quotes.forEach(q => {
            const statusClass = q.status ? q.status.toLowerCase() : 'aperto';
            html += `
                <div class="history-item" onclick="loadQuote(${q.id}); window.ClientHistory.close();" style="cursor:pointer;">
                    <div class="item-left">
                        <div class="item-icon"><i class="fa-solid fa-file-invoice"></i></div>
                        <div class="item-info">
                            <h4>Preventivo #${q.id}</h4>
                            <span>${q.date || 'N/D'} &bull; ${q.title || 'Nessun titolo'}</span>
                        </div>
                    </div>
                    <div class="item-right">
                        <div class="item-price">${window.formatCurrency(q.totals?.total || 0)} €</div>
                        <span class="item-status ${statusClass}">${q.status || 'Aperto'}</span>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML = html;
    },

    // --- GIOBBY TAB (Remote Docs via API) ---
    loadGiobbyDocs: async function (container) {
        container.innerHTML = `<div class="text-center" style="padding:40px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br>Ricerca su Giobby...</div>`;

        // Check if Giobby configured
        const configStr = localStorage.getItem('giobbyConfig');
        if (!configStr) {
            container.innerHTML = `<div class="alert alert-warning">Giobby non configurato. Vai in Impostazioni per collegare l'account.</div>`;
            return;
        }

        // We need contact ID (idContact or idCustomer)
        // If we have idContact locally, great. If not, we might need to search?
        // Let's assume we have it or search by name.
        let contactId = this.currentClient.giobbyContactId; // Assuming we save this? Often we don't.

        // 1. Try to find client on Giobby if we don't have ID
        // We reuse the existing window.findOr... logic but simpler just transparent search
        const config = JSON.parse(configStr);

        try {
            // Mocking a search if no ID saved
            // Real implementation: We search by VAT or Name
            let docs = [];

            // Just searching by FreeText Name
            const searchName = this.currentClient.name + " " + (this.currentClient.surname || "");

            // Call exposed Giobby function (we need to ensure it exists or create ad-hoc here)
            // Implementation Plan said: "[MODIFY] giobby.js - Add window.fetchGiobbyDocuments(contactId)"
            // Since we haven't modified giobby.js yet, I will simulate or implementation it here if it's small, 
            // OR I should halt and go modify giobby.js first? 
            // I'll proceed assuming I will add the helper in giobby.js in the next step. 
            // For now, I'll put a placeholder or try to call it.

            if (window.fetchGiobbyDocuments) {
                docs = await window.fetchGiobbyDocuments(this.currentClient);
            } else {
                throw new Error("Funzione Giobby non disponibile. (Ricarica la pagina?)");
            }

            if (!docs || docs.length === 0) {
                container.innerHTML = `<div class="text-center text-muted" style="padding: 40px;">Nessun documento trovato su Giobby per "${searchName}".</div>`;
                return;
            }

            let html = `<div class="history-card"><h3>Documenti Cloud (${docs.length})</h3>`;
            docs.forEach(d => {
                html += `
                    <div class="history-item">
                        <div class="item-left">
                            <div class="item-icon giobby"><i class="fa-solid fa-cloud"></i></div>
                            <div class="item-info">
                                <h4>${d.type} ${d.number}</h4>
                                <span>${d.date} &bull; ${d.reference || ''}</span>
                            </div>
                        </div>
                        <div class="item-right">
                            <div class="item-price">${window.formatCurrency(d.amount || 0)} €</div>
                            <span class="item-status ${d.status === 'Sent' ? 'approved' : ''}">${d.status}</span>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            container.innerHTML = html;

        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="alert alert-danger">Errore Giobby: ${e.message}</div>`;
        }
    },

    // --- ACTIONS TAB (Smart Links) ---
    loadActions: function (container) {
        const c = this.currentClient;
        const fullName = `${c.name} ${c.surname || ''}`.trim();

        // 1. WhatsApp Link
        let waLink = "#";
        let hasMobile = false;
        if (c.mobile || c.phone) {
            // Cleanup phone
            let num = (c.mobile || c.phone).replace(/[^0-9]/g, '');
            if (num.startsWith('3')) num = '39' + num; // Add IT prefix if missing
            waLink = `https://wa.me/${num}`;
            hasMobile = true;
        }

        // 2. Email Search Link (Gmail)
        const emailLink = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(c.email || fullName)}`;

        // 3. Drive Search Link
        const driveLink = `https://drive.google.com/drive/search?q=${encodeURIComponent(fullName)}`;

        // 4. Maps Link
        const address = `${c.address} ${c.city} ${c.zip}`;
        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

        const html = `
            <div class="history-card">
                <h3><i class="fa-solid fa-bolt"></i> Azioni Rapide</h3>
                <p>Collegamenti diretti agli strumenti esterni.</p>
                <br>
                <div class="action-grid">
                    
                    <a href="${waLink}" target="_blank" class="action-tile whatsapp" ${!hasMobile ? 'style="opacity:0.5;pointer-events:none;" title="Nessun cellulare"' : ''}>
                        <div class="tile-icon"><i class="fa-brands fa-whatsapp"></i></div>
                        <h3>WhatsApp</h3>
                        <p>${c.mobile || 'Non disponibile'}</p>
                    </a>

                    <a href="${emailLink}" target="_blank" class="action-tile email">
                        <div class="tile-icon"><i class="fa-solid fa-envelope"></i></div>
                        <h3>Cerca Email</h3>
                        <p>Su Gmail</p>
                    </a>

                    <a href="${driveLink}" target="_blank" class="action-tile drive">
                        <div class="tile-icon"><i class="fa-brands fa-google-drive"></i></div>
                        <h3>Cerca in Drive</h3>
                        <p>Cartelle Cliente</p>
                    </a>

                    <a href="${mapsLink}" target="_blank" class="action-tile maps">
                        <div class="tile-icon"><i class="fa-solid fa-map-location-dot"></i></div>
                        <h3>Mappe</h3>
                        <p>Vai all'indirizzo</p>
                    </a>

                </div>
            </div>
        `;
        container.innerHTML = html;
    },

    // --- SOPRALLUOGHI TAB ---
    loadSopralluoghi: async function (container) {
        container.innerHTML = `<div class="text-center" style="padding:40px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br>Caricamento Schede di cantiere...</div>`;
        try {
            if (!window.supabase) throw new Error("Supabase non inizializzato");
            const { data, error } = await supabase
                .from('sopralluoghi')
                .select('*')
                .eq('client_id', this.currentClient.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                container.innerHTML = `<div class="text-center text-muted" style="padding: 40px;">Nessuna scheda di cantiere trovata per questo cliente.</div>`;
                return;
            }

            let html = `<div class="history-card"><h3>Schede di cantiere Storiche (${data.length})</h3>`;
            data.forEach(s => {
                const dateStr = new Date(s.created_at).toLocaleDateString('it-IT', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
                const fd = s.full_data_json || {};
                const cantiereInfo = fd.clientCantiere ? ` | ${fd.clientCantiere}` : '';
                const unitaInfo = fd.clientUnita ? ` - ${fd.clientUnita}` : '';

                html += `
                    <div class="history-item" onclick="window.ClientHistory.viewSopralluogo('${s.id}')" style="cursor:pointer; border-left: 4px solid #3b82f6;">
                        <div class="item-left">
                            <div class="item-icon" style="background:#dbeafe;color:#2563eb;"><i class="fa-solid fa-clipboard-check"></i></div>
                            <div class="item-info">
                                <h4>Data: ${dateStr}${cantiereInfo}</h4>
                                <span><i class="fa-solid fa-map-pin"></i> ${s.client_address || ''} <strong>${unitaInfo}</strong></span>
                            </div>
                        </div>
                        <div class="item-right">
                            <span class="item-status" style="background:#bfdbfe; color:#1d4ed8;">Leggi Dettagli</span>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            
            html += `<div id="sopralluogo-detail-container"></div>`;
            container.innerHTML = html;
        } catch(err) {
            console.error(err);
            container.innerHTML = `<div class="alert alert-danger">Errore recupero sopralluoghi: ${err.message}</div>`;
        }
    },

    viewSopralluogo: async function(id) {
        try {
            const { data, error } = await supabase.from('sopralluoghi').select('*').eq('id', id).single();
            if(error || !data) return alert("Errore caricamento dettaglio.");
            
            const fd = data.full_data_json || {};
            
            let renderedRooms = '<em>Nessuna stanza specificata.</em>';
            if (fd.techStanzeTable && fd.techStanzeTable.length > 0) {
                renderedRooms = `<table style="width:100%; font-size:0.9em; border-collapse:collapse; margin-top:5px; background: #f8fafc; border: 1px solid #e2e8f0;">
                                    <tr>
                                        <th style="border-bottom:2px solid #cbd5e1; padding:4px 8px; text-align:left;">Stanza</th>
                                        <th style="border-bottom:2px solid #cbd5e1; padding:4px 8px; text-align:right;">LungxLarg (m)</th>
                                        <th style="border-bottom:2px solid #cbd5e1; padding:4px 8px; text-align:right;">Mq</th>
                                        <th style="border-bottom:2px solid #cbd5e1; padding:4px 8px; text-align:right;">Ml</th>
                                    </tr>`;
                let sumMq = 0, sumMl = 0;
                fd.techStanzeTable.forEach(r => {
                    const mathStr = (r.lung && r.larg) ? `${r.lung}x${r.larg}` : '-';
                    renderedRooms += `<tr>
                                        <td style="border-bottom:1px solid #f1f5f9; padding:4px 8px;"><strong>${r.stanza||'-'}</strong></td>
                                        <td style="border-bottom:1px solid #f1f5f9; padding:4px 8px; text-align:right; font-family:monospace; color:#64748b;">${mathStr}</td>
                                        <td style="border-bottom:1px solid #f1f5f9; padding:4px 8px; text-align:right;">${r.mq||'0.00'}</td>
                                        <td style="border-bottom:1px solid #f1f5f9; padding:4px 8px; text-align:right;">${r.ml||'0.00'}</td>
                                      </tr>`;
                    sumMq += parseFloat(r.mq || 0);
                    sumMl += parseFloat(r.ml || 0);
                });
                renderedRooms += `  <tr style="background:#e0f2fe; font-weight:bold;">
                                        <td colspan="2" style="padding:4px 8px; text-align:right;">Totali:</td>
                                        <td style="padding:4px 8px; text-align:right;">${sumMq.toFixed(2)}</td>
                                        <td style="padding:4px 8px; text-align:right;">${sumMl.toFixed(2)}</td>
                                    </tr>
                                  </table>`;
            }

            let renderedStairs = '';
            if (fd.techScaleTable && fd.techScaleTable.length > 0) {
                renderedStairs = `<table style="width:100%; font-size:0.9em; border-collapse:collapse; margin-top:15px; background: #faf5ff; border: 1px solid #d8b4fe;">
                                    <tr>
                                        <th style="border-bottom:2px solid #d8b4fe; padding:4px 8px; text-align:left; color:#6d28d9;">Rampa (Gradini)</th>
                                        <th style="border-bottom:2px solid #d8b4fe; padding:4px 8px; text-align:right; color:#6d28d9;">Misure P+A</th>
                                        <th style="border-bottom:2px solid #d8b4fe; padding:4px 8px; text-align:right; color:#6d28d9;">Mq Tot</th>
                                        <th style="border-bottom:2px solid #d8b4fe; padding:4px 8px; text-align:right; color:#6d28d9;">Lati / Batti. Ml</th>
                                    </tr>`;
                let sumStairsMq = 0;
                let sumStairsMl = 0;
                fd.techScaleTable.forEach(s => {
                    let alzInfo = (s.alzMq === false) ? '<br><small style="color:#ef4444;">No Alzata in Mq</small>' : '';
                    const mathStr = `${s.larg||'-'}L x (${s.pedata||'0'}p + ${s.alzata||'0'}a)${alzInfo}`;
                    let battiStr = '-';
                    if(s.lati > 0 || (s.latiAlz && s.latiAlz > 0)) {
                        let pedText = s.lati > 0 ? `${s.lati}P` : '0P';
                        let alzText = s.latiAlz > 0 ? `${s.latiAlz}A` : '0A';
                        battiStr = `${pedText} / ${alzText} Lati -> ${s.mlbatti||'0'} Ml`;
                    }

                    renderedStairs += `<tr>
                                        <td style="border-bottom:1px solid #f3e8ff; padding:4px 8px;"><strong>${s.tipo||'-'}</strong> <span style="color:#71717a">(${s.qta||'1'})</span></td>
                                        <td style="border-bottom:1px solid #f3e8ff; padding:4px 8px; text-align:right; font-family:monospace; color:#64748b;">${mathStr}</td>
                                        <td style="border-bottom:1px solid #f3e8ff; padding:4px 8px; text-align:right; font-weight:bold;">${s.mqtot||'0.00'}</td>
                                        <td style="border-bottom:1px solid #f3e8ff; padding:4px 8px; text-align:right; font-weight:bold; color:#be185d;">${battiStr}</td>
                                      </tr>`;
                    sumStairsMq += parseFloat(s.mqtot || 0);
                    sumStairsMl += parseFloat(s.mlbatti || 0);
                });
                renderedStairs += `   <tr style="background:#e9d5ff; font-weight:bold;">
                                        <td colspan="2" style="padding:4px 8px; text-align:right; color:#5b21b6;">Totale Scale:</td>
                                        <td style="padding:4px 8px; text-align:right; color:#5b21b6;">${sumStairsMq.toFixed(2)} Mq</td>
                                        <td style="padding:4px 8px; text-align:right; color:#9d174d;">${sumStairsMl.toFixed(2)} Ml</td>
                                    </tr>
                                  </table>`;
            }

            const detailHtml = `
                <div class="sopralluogo-modal" style="margin-top:20px; border:2px solid #3b82f6; border-radius:8px; padding:15px; background:#f8fafc; animation: fadeIn 0.3s ease;">
                    <h3 style="color:#1d4ed8; margin-top:0; margin-bottom: 15px;"><i class="fa-solid fa-search"></i> Dettaglio Ispezione</h3>
                    <p style="margin-bottom:5px;"><strong>Cantiere/Condominio:</strong> ${fd.clientCantiere || 'N/D'} | <strong>Unità:</strong> ${fd.clientUnita || 'N/D'}</p>
                    <p style="margin-bottom:15px;"><strong>Geometra/Posatore:</strong> ${fd.clientImpresa || '-'} / ${fd.clientPosatore || '-'}</p>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:0.9em;">
                        <div style="background:#fff; padding:10px; border-radius:4px; border:1px solid #e2e8f0;">
                            <strong>Massetto:</strong><br/>${(fd.techSottofondo || 'N/D').replace(/\n/g, '<br>')}
                        </div>
                        <div style="background:#fff; padding:10px; border-radius:4px; border:1px solid #e2e8f0;">
                            <strong>Materiale/Posa:</strong><br/>${(fd.techMateriale || 'N/D').replace(/\n/g, '<br>')}
                            <br/><br/><em>Verso:</em> ${(fd.techPosa || '-').replace(/\n/g, '<br>')}
                        </div>
                        <div style="background:#fff; padding:10px; border-radius:4px; border:1px solid #e2e8f0; grid-column: span 2;">
                            <strong style="color:#0f172a;"><i class="fa-solid fa-table"></i> Tabella Stanze e Misure Analitiche:</strong><br/>
                            ${renderedRooms}
                            ${renderedStairs}
                        </div>
                        <div style="background:#fef2f2; padding:10px; border-radius:4px; border:1px solid #fecaca; grid-column: span 2;">
                            <strong style="color:#b91c1c;">Lavori a Carico Cliente:</strong><br/>${(fd.techLavoriCliente || 'Nessun lavoro a carico').replace(/\n/g, '<br>')}
                        </div>
                        <div style="background:#f1f5f9; padding:10px; border-radius:4px; border:1px solid #cbd5e1; grid-column: span 2;">
                            <strong>Note Interne Private:</strong><br/>${(fd.techNoteInterne || 'N/D').replace(/\n/g, '<br>')}
                        </div>
                    </div>
                    <div style="margin-top:15px; text-align:right;">
                        <button class="btn-secondary" onclick="document.getElementById('sopralluogo-detail-container').innerHTML=''">Chiudi Dettaglio</button>
                    </div>
                </div>
            `;
            document.getElementById('sopralluogo-detail-container').innerHTML = detailHtml;
            document.getElementById('sopralluogo-detail-container').scrollIntoView({behavior: 'smooth', block: 'end'});
        } catch(err) {
            console.error(err);
        }
    }
};
