/**
 * CRM CORE - Genesy 360 Client Dashboard
 * Handles the "Single Source of Truth" view for clients.
 */

// Safe currency formatter (fallback if global formatCurrency not available)
function _crmFmt(val) {
    if (typeof window.formatCurrency === 'function') return window.formatCurrency(val);
    return (val || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

window.CRM = {
    currentClient: null,

    // Entry Point
    open: async function (clientId, quoteRef, fallbackClientData) {
        // 1. Resolve Client — prova dal db, poi usa fallback (es. account agente senza accesso anagrafica)
        let client = db.getClients().find(c => c.id === clientId);
        if (!client && fallbackClientData) {
            // Costruisce un oggetto cliente minimale dai dati del preventivo
            client = { id: clientId || ('tmp_' + Date.now()), ...fallbackClientData };
        }
        if (!client) return alert("Cliente non trovato nel database.");

        this.currentClient = client;

        // 2. Switch View
        document.querySelectorAll('.view').forEach(v => {
            v.classList.add('hidden');
            v.classList.remove('active');
        });
        const view = document.getElementById('viewClientCRM');
        if (view) {
            view.classList.remove('hidden');
            view.classList.add('active');
            view.scrollTop = 0;
        } else {
            console.error("View #viewClientCRM not found in DOM.");
            return;
        }

        // 3. Pre-calcola i preventivi del cliente UNA SOLA VOLTA
        const clientQuotes = db.getAllQuotes().filter(q =>
            (q.customer && q.customer.id && String(q.customer.id) === String(clientId)) ||
            (q.client_id && String(q.client_id) === String(clientId))
        );

        // 4. Render sincrono immediato (UI appare subito)
        try { this.renderHeader(); } catch (e) { console.error("renderHeader error:", e); }
        try { this.renderProfile(); } catch (e) { console.error("renderProfile error:", e); }
        try { this.renderStats(clientQuotes); } catch (e) { console.error("renderStats error:", e); }
        try { this.renderGenesyHistory(clientQuotes); } catch (e) { console.error("renderGenesyHistory error:", e); }

        // 5. Chiamate di rete in PARALLELO (non bloccano la UI già visibile)
        Promise.all([
            this.renderCommunications().catch(e => console.error("renderCommunications error:", e)),
            this.renderGiobbyData().catch(e => console.error("renderGiobbyData error:", e)),
            this.renderInvoicesSection().catch(e => console.error("renderInvoicesSection error:", e)),
            this.renderSopralluoghi().catch(e => console.error("renderSopralluoghi error:", e)),
            this.renderSolleciti().catch(e => console.error("renderSolleciti error:", e)),
            (window.GmailCRM ? window.GmailCRM.renderEmailHistory(this.currentClient).catch(e => console.error("renderEmailHistory error:", e)) : Promise.resolve())
        ]);
    },

    close: function () {
        // Use same pattern as app.js: show 'clients' view
        document.querySelectorAll('.view').forEach(v => {
            v.classList.add('hidden');
            v.classList.remove('active');
        });
        const clientsView = document.getElementById('clients');
        if (clientsView) {
            clientsView.classList.remove('hidden');
            clientsView.classList.add('active');
        }
        if (typeof renderGenericClientsTable === 'function') renderGenericClientsTable();
    },

    // --- RENDERERS ---

    renderHeader: function () {
        const c = this.currentClient;
        document.getElementById('crmClientName').textContent = ((c.name || '') + ' ' + (c.surname || '')).trim();

        const subtitle = [];
        if (c.company) subtitle.push(`<i class="fa-solid fa-building"></i> ${c.company}`);
        if (c.city) subtitle.push(`<i class="fa-solid fa-location-dot"></i> ${c.city}`);

        document.getElementById('crmClientSubtitle').innerHTML = subtitle.join(' &nbsp;|&nbsp; ');
    },

    renderProfile: function () {
        const c = this.currentClient;
        const container = document.getElementById('crmProfileBody');

        const address = [c.address, c.city, c.zip, c.province || c.addressProvince].filter(Boolean).join(', ');
        const fullName = ((c.name || '') + ' ' + (c.surname || '')).trim();
        const agentEmail = (typeof currentUser !== 'undefined' && currentUser?.email) ? currentUser.email : '';
        const safeEmail = (c.email || '').replace(/'/g, "&#39;");
        const safeName = fullName.replace(/'/g, "&#39;");

        let html = `
            <div class="crm-info-row">
                <i class="fa-solid fa-map-location-dot"></i>
                <div class="crm-info-value">${address || 'N/D'}</div>
            </div>
            <div class="crm-info-row">
                <i class="fa-solid fa-phone"></i>
                <div class="crm-info-value">
                    ${c.phone ? `<a href="tel:${c.phone}">${c.phone}</a>` : ''}
                    ${c.mobile ? ` / <a href="tel:${c.mobile}">${c.mobile}</a>` : ''}
                    ${(!c.phone && !c.mobile) ? 'N/D' : ''}
                </div>
            </div>
            <div class="crm-info-row">
                <i class="fa-solid fa-envelope"></i>
                <div class="crm-info-value">
                    ${c.email ? `<a href="#" onclick="CRM._openCompose('${safeEmail}', '${safeName}'); return false;">${c.email}</a>` : 'N/D'}
                </div>
            </div>
            <div class="crm-info-row">
                <i class="fa-solid fa-id-card"></i>
                <div class="crm-info-value">${c.vat || c.fiscal_code || '-'}</div>
            </div>
            ${agentEmail ? `
            <div class="crm-info-row" style="margin-top:8px; padding-top:8px; border-top:1px solid #f1f5f9;">
                <i class="fa-regular fa-user" style="color:#64748b;"></i>
                <div class="crm-info-value" style="font-size:0.8rem; color:#64748b;">Agente: <strong>${agentEmail}</strong></div>
            </div>` : ''
            }
        `;

        if (c.notes) {
            html += `
            < div style = "margin-top:20px;" >
                    <strong style="display:block; margin-bottom:5px; color:#b45309;">Note Interne:</strong>
                    <div class="crm-notes-box">${c.notes}</div>
                </div >
            `;
        }

        container.innerHTML = html;

        // WhatsApp button
        const btnWa = document.getElementById('btnCrmWhastapp');
        if (btnWa) {
            if (c.phone || c.mobile) {
                btnWa.onclick = () => window.open(`https://wa.me/${(c.mobile || c.phone).replace(/[^0-9]/g, '')}`, '_blank');
                btnWa.disabled = false;
            } else {
                btnWa.disabled = true;
            }
        }

        // Email button — apre compose precompilata
        const btnEmail = document.getElementById('btnCrmEmail');
        if (btnEmail) {
            if (c.email) {
                btnEmail.onclick = () => CRM._openCompose(c.email, fullName);
                btnEmail.disabled = false;
                btnEmail.title = `Invia email a ${c.email}`;
            } else {
                btnEmail.disabled = true;
                btnEmail.title = 'Email non disponibile';
            }
        }

        // Sopralluogo button
        const btnSopralluogo = document.getElementById('btnCrmSopralluogo');
        if (btnSopralluogo) {
            btnSopralluogo.onclick = () => window.open(`sopralluoghi.html?client_id=${c.id}`, '_blank');
        }

        // Drive button — apre la cartella Drive configurata o cerca per nome
        const btnDrive = document.getElementById('btnCrmDrive');
        const driveInput = document.getElementById('crmDriveFolderUrl');
        // Carica l'URL salvato
        const savedDriveUrl = localStorage.getItem('crm_drive_folder_url') || '';
        if (driveInput) driveInput.value = savedDriveUrl;

        if (btnDrive) {
            btnDrive.onclick = () => {
                const folderUrl = (document.getElementById('crmDriveFolderUrl')?.value || '').trim();
                if (!folderUrl) return; // non fare nulla se il campo è vuoto
                window.open(folderUrl, '_blank');
            };
        }

        // --- Giobby Push Button ---
        const btnPushGiobby = document.getElementById('btnCrmPushGiobby');
        if (btnPushGiobby) {
            // Label dinamica: "Invia" se non ancora sincronizzato, "Aggiorna" se già presente
            const hasGiobbyId = !!(c.giobbyContactId || c.giobbyCustomerId);
            btnPushGiobby.innerHTML = hasGiobbyId
                ? '<i class="fa-solid fa-cloud-arrow-up"></i> Aggiorna su Giobby'
                : '<i class="fa-solid fa-cloud-arrow-up"></i> Invia su Giobby';
            btnPushGiobby.disabled = false;
            btnPushGiobby.style.background = hasGiobbyId ? '#0284c7' : '#e11d48';
        }

        // Render initial Giobby sync badge
        this._renderGiobbyBadge(
            c.giobbyCustomerId || c.idCustomer || null,
            c.giobbyContactId || null
        );
    },

    renderStats: function (clientQuotes) {
        // Usa i preventivi pre-filtrati se disponibili, altrimenti recupera con criterio doppio
        const id = this.currentClient.id;
        const quotes = clientQuotes || db.getAllQuotes().filter(q =>
            (q.customer && q.customer.id && String(q.customer.id) === String(id)) ||
            (q.client_id && String(q.client_id) === String(id))
        );

        const totalQuotes = quotes.length;
        const wonQuotes = quotes.filter(q => q.status === 'Chiuso' || q.status === 'Ordine Confermato');
        const totalRevenue = wonQuotes.reduce((acc, q) => acc + (q.total || 0), 0);
        const conversionRate = totalQuotes > 0 ? ((wonQuotes.length / totalQuotes) * 100).toFixed(0) : 0;

        const elRev = document.getElementById('statTotalRev');
        const elCount = document.getElementById('statQuoteCount');
        const elConv = document.getElementById('statConversion');
        const elLast = document.getElementById('statLastActive');

        if (elRev) elRev.textContent = _crmFmt(totalRevenue) + ' €';
        if (elCount) elCount.textContent = totalQuotes;
        if (elConv) elConv.textContent = conversionRate + '%';

        const lastQuote = [...quotes].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        if (elLast) elLast.textContent = lastQuote ? new Date(lastQuote.date).toLocaleDateString('it-IT') : '-';
    },

    renderGenesyHistory: function (clientQuotes) {
        const container = document.getElementById('crmGenesyBody');
        if (!container) return;

        // Usa i preventivi pre-filtrati se disponibili, altrimenti recupera con criterio doppio
        const id = this.currentClient.id;
        const quotes = (clientQuotes || db.getAllQuotes().filter(q =>
            (q.customer && q.customer.id && String(q.customer.id) === String(id)) ||
            (q.client_id && String(q.client_id) === String(id))
        )).slice().sort((a, b) => new Date(b.date) - new Date(a.date));

        if (quotes.length === 0) {
            container.innerHTML = '<div style="padding:20px; color:#94a3b8; text-align:center;">Nessun preventivo registrato.</div>';
            return;
        }

        let html = `<table class="crm-table">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>N°</th>
                    <th style="max-width:260px; color:#2d6a4f;">Descrizione</th>
                    <th>Importo</th>
                    <th>Stato</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>`;

        quotes.forEach(q => {
            let badgeClass = 'badge-info';
            if (q.status === 'Chiuso' || q.status === 'Ordine Confermato') badgeClass = 'badge-success';
            if (q.status === 'Perso') badgeClass = 'badge-danger';
            if (q.status === 'Aperto') badgeClass = 'badge-warning';

            const desc = q.title || (q.items && q.items[0] ? q.items[0].description : 'Preventivo');

            html += `
                <tr onclick="window.openEditor('${q.id}')" style="cursor:pointer;">
                    <td>${new Date(q.date).toLocaleDateString('it-IT')}</td>
                    <td><strong>${q.friendlyId || q.number || '-'}</strong></td>
                    <td style="max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#2d6a4f; font-weight:600; cursor:default;"
                        onclick="event.stopPropagation(); window.openEditor('${q.id}')">${desc}</td>
                    <td>${_crmFmt(q.total)} €</td>
                    <td><span class="badge ${badgeClass}">${q.status}</span></td>
                    <td style="text-align:right;"><i class="fa-solid fa-chevron-right" style="color:#cbd5e1;"></i></td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    // --- STORICO COMUNICAZIONI (Supabase) ---

    _notesKey: function (clientId) { return 'crm_notes_' + clientId; }, // fallback localStorage

    getNotes: async function (clientId) {
        let rawNotes = [];
        try {
            if (!window.supabase || typeof window.supabase.from !== 'function') throw new Error('no supabase');
            const { data, error } = await window.supabase
                .from('crm_notes')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            rawNotes = (data || []).map(r => ({ id: r.id, type: r.type, text: r.text, date: r.created_at }));
        } catch (e) {
            // Fallback localStorage
            try { rawNotes = JSON.parse(localStorage.getItem(this._notesKey(clientId)) || '[]'); }
            catch (e2) { rawNotes = []; }
        }
        
        return rawNotes.map(n => {
            if (n.type === 'note' && n.text && n.text.startsWith('TARGET_COMMERCIALE: ')) {
                return { ...n, type: 'azione_vendita', text: n.text.substring(20) };
            }
            return n;
        });
    },

    addNote: async function (clientId, type, text) {
        if (type === 'azione_vendita') {
            type = 'note';
            text = 'TARGET_COMMERCIALE: ' + text;
        }
        try {
            if (!window.supabase || typeof window.supabase.from !== 'function') throw new Error('no supabase');
            const { error } = await window.supabase
                .from('crm_notes')
                .insert({ client_id: clientId, type, text });
            if (error) throw error;
        } catch (e) {
            // Fallback localStorage
            const notes = JSON.parse(localStorage.getItem(this._notesKey(clientId)) || '[]');
            notes.unshift({ id: Date.now().toString(), type, text, date: new Date().toISOString() });
            localStorage.setItem(this._notesKey(clientId), JSON.stringify(notes));
        }
    },

    deleteNote: async function (clientId, noteId) {
        try {
            if (!window.supabase || typeof window.supabase.from !== 'function') throw new Error('no supabase');
            const { error } = await window.supabase
                .from('crm_notes')
                .delete()
                .eq('id', noteId);
            if (error) throw error;
        } catch (e) {
            // Fallback localStorage
            const notes = JSON.parse(localStorage.getItem(this._notesKey(clientId)) || '[]').filter(n => n.id !== noteId);
            localStorage.setItem(this._notesKey(clientId), JSON.stringify(notes));
        }
    },

    _filterComm: function (btn, type) {
        document.querySelectorAll('#crmCommPills button').forEach(function (b) {
            b.style.background = 'transparent';
            b.style.color = '#94a3b8';
            b.style.borderColor = '#e2e8f0';
        });
        btn.style.background = btn.dataset.filterColor + '18';
        btn.style.color = btn.dataset.filterColor;
        btn.style.borderColor = btn.dataset.filterColor;
        document.querySelectorAll('#crmCommList [data-comm-type]').forEach(function (el) {
            el.style.display = (type === 'all' || el.dataset.commType === type) ? 'flex' : 'none';
        });
    },

    renderCommunications: async function () {
        const container = document.getElementById('crmCommunicationsBody');
        if (!container) return;
        const clientId = this.currentClient.id;
        const typeConfig = {
            call: { icon: '📞', label: 'Chiamata', color: '#3b82f6' },
            note: { icon: '📝', label: 'Nota cliente', color: '#8b5cf6' },
            note_cantiere: { icon: '🏗️', label: 'Nota cantiere', color: '#0369a1' },
            azione_vendita: { icon: '🎯', label: 'Azione Commerciale', color: '#10b981' },
        };

        container.innerHTML = '<div style="color:#94a3b8;font-size:0.82rem;padding:6px 0;"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento...</div>';
        const notes = await this.getNotes(clientId);

        let listHtml = '';
        if (notes.length === 0) {
            listHtml = '<div style="color:#94a3b8;font-size:0.85rem;padding:8px 0;">Nessuna comunicazione registrata.</div>';
        } else {
            notes.forEach(n => {
                const cfg = typeConfig[n.type] || typeConfig.note;
                const dateStr = new Date(n.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                listHtml += `
                    <div data-comm-type="${n.type}" style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;background:#f8fafc;border-left:3px solid ${cfg.color};border-radius:5px;margin-bottom:6px;">
                        <span style="font-size:1.1rem;line-height:1.4;">${cfg.icon}</span>
                        <div style="flex:1;min-width:0;">
                            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                                <span style="font-size:0.7rem;font-weight:700;color:${cfg.color};">${cfg.label}</span>
                                <span style="font-size:0.7rem;color:#94a3b8;">${dateStr}</span>
                            </div>
                            <div style="font-size:0.85rem;color:#334155;word-break:break-word;">${n.text.replace(/\n/g, '<br>')}</div>
                        </div>
                        <button onclick="CRM.deleteNote('${clientId}','${n.id}').then(()=>CRM.renderCommunications())" title="Elimina" style="background:none;border:none;cursor:pointer;color:#cbd5e1;font-size:0.9rem;padding:0;flex-shrink:0;"><i class='fa-solid fa-trash-can'></i></button>
                    </div>`;
            });
        }

        // Conta per tipo per le pill
        const typeCounts = {};
        notes.forEach(n => { typeCounts[n.type] = (typeCounts[n.type] || 0) + 1; });

        const pillStyle = (active, color) => `display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;cursor:pointer;border:1.5px solid ${active ? color : '#e2e8f0'};background:${active ? color + '18' : 'transparent'};color:${active ? color : '#94a3b8'};transition:all 0.15s;`;

        const pillsHtml = `<div id="crmCommPills" style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;">
            <button data-filter-type="all" data-filter-color="#334155" onclick="CRM._filterComm(this,'all')" style="${pillStyle(true, '#334155')}">Tutti <span style="opacity:.6;">(${notes.length})</span></button>
            ${Object.entries(typeConfig).map(([k, cfg]) => typeCounts[k] ? `<button data-filter-type="${k}" data-filter-color="${cfg.color}" onclick="CRM._filterComm(this,'${k}')" style="${pillStyle(false, cfg.color)}">${cfg.icon} ${cfg.label} <span style="opacity:.6;">(${typeCounts[k] || 0})</span></button>` : '').join('')}
        </div>`;

        container.innerHTML = `
            ${notes.length > 0 ? pillsHtml : ''}
            <div id="crmCommList" style="max-height:260px;overflow-y:auto;margin-bottom:10px;">${listHtml}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-end;">
                <select id="crmNoteType" style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:0.82rem;background:#fff;color:#334155;">
                    <option value="call">📞 Chiamata</option>
                    <option value="note">📝 Nota cliente</option>
                    <option value="note_cantiere">🏗️ Nota cantiere</option>
                    <option value="azione_vendita">🎯 Azione Commerciale</option>
                </select>
                <textarea id="crmNoteText" placeholder="Scrivi una nota..." rows="2" style="flex:1;min-width:160px;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:0.82rem;resize:vertical;font-family:inherit;"></textarea>
                <button onclick="(async()=>{const t=document.getElementById('crmNoteText').value.trim();const tp=document.getElementById('crmNoteType').value;if(!t)return;await CRM.addNote('${clientId}',tp,t);CRM.renderCommunications();})()"
                    style="padding:6px 14px;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:0.82rem;cursor:pointer;font-weight:600;white-space:nowrap;">
                    <i class='fa-solid fa-plus'></i> Aggiungi
                </button>
            </div>`;
    },

    renderGiobbyData: async function () {
        const container = document.getElementById('crmGiobbyBody');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; padding:10px;"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento Giobby...</div>';

        try {
            if (!window.fetchGiobbyDocuments) {
                container.innerHTML = '<div style="color:#94a3b8; padding:10px; text-align:center;">Connessione Giobby non configurata.</div>';
                return;
            }

            const result = await window.fetchGiobbyDocuments(this.currentClient);

            // Compatibilità: se ritorna array (vecchio formato) o {docs, possibleDocs}
            const docs = Array.isArray(result) ? result : (result.docs || []);
            const possibleDocs = Array.isArray(result) ? [] : (result.possibleDocs || []);
            const clientKey = Array.isArray(result) ? null : result.clientKey;

            if (!docs.length && !possibleDocs.length) {
                container.innerHTML = '<div style="padding:15px; color:#94a3b8; text-align:center;">Nessun documento trovato su Giobby.</div>';
                return;
            }

            // Colore per tipo documento
            const typeColors = {
                'Preventivo': { border: '#2d6a4f', text: '#1b4332' },
                'Ordine Cliente': { border: '#22c55e', text: '#15803d' },
                'DDT': { border: '#3b82f6', text: '#1d4ed8' },
                'Entrata Merci': { border: '#c8961e', text: '#92640a' },
                'Ordine Fornitore': { border: '#f97316', text: '#c2410c' },
            };

            const renderDocRow = (d, clickable = true) => {
                const c = typeColors[d.type] || { border: '#94a3b8', text: '#475569' };
                const dateStr = d.date ? new Date(d.date).toLocaleDateString('it-IT') : '-';
                const isLinked = clickable && d.giobbyUrl && d.type !== 'Ordine Fornitore';
                const link = isLinked
                    ? `onclick="window.open('${d.giobbyUrl}','_blank')" style="cursor:pointer;"`
                    : '';
                const linkIcon = isLinked
                    ? `<i class="fa-solid fa-arrow-up-right-from-square" style="color:#94a3b8; font-size:0.7rem; margin-left:4px;"></i>`
                    : '';
                const isEM = d.type === 'Entrata Merci';
                const parts = [];
                if (!isEM && d.clientName) parts.push(d.clientName);
                if (d.reference) parts.push(`rif: ${d.reference}`);
                const extraRow = parts.length
                    ? `<span style="font-size:0.72rem; color:#94a3b8; margin-top:1px;">${parts.join(' \u00b7 ')}</span>`
                    : '';
                // Per Ordine Fornitore: popup hover con dettaglio
                if (d.type === 'Ordine Fornitore') {
                    const safeNote = (d.note || '').replace(/"/g, '&quot;');
                    // Per OF il fornitore corretto viene da d.clientName (= companyName nell'API Giobby)
                    // d.reference negli OF è sempre vuoto, non va usato come fornitore
                    const safeSupplier = (d.clientName || d.reference || '').replace(/"/g, '&quot;');
                    return `
                    <div onmouseenter="CRM._showOFPopup(event,this)"
                         onmouseleave="CRM._hideOFPopup()"
                         data-of-id="${d.id || ''}"
                         data-of-num="${d.docNumber || ''}"
                         data-of-ref=""
                         data-of-date="${dateStr}"
                         data-of-note="${safeNote}"
                         data-of-supplier="${safeSupplier}"
                         style="display:flex; flex-direction:column; gap:2px; padding:7px 10px; background:#f8fafc; border-radius:5px; transition:background 0.15s; cursor:default;">
                        <span style="font-weight:600; color:#1e293b;">${d.docNumber} <span style="color:#64748b; font-size:0.82rem; font-weight:400;">${dateStr}</span></span>
                        ${extraRow}
                    </div>`;
                }
                // Tutti gli altri tipi
                const popupData = JSON.stringify({
                    id: d.id, type: d.type, rawType: d.type,
                    docNumber: d.docNumber, borderColor: c.border, textColor: c.text
                }).replace(/"/g, '&quot;');
                return `
                    <div ${link}
                         style="display:flex; flex-direction:column; gap:2px; padding:7px 10px; background:#f8fafc; border-left:3px solid ${c.border}; border-radius:5px; transition:background 0.15s;">
                        <span style="font-weight:600; color:#1e293b;">${d.docNumber}${linkIcon} <span style="color:#64748b; font-size:0.82rem; font-weight:400;">${dateStr}</span></span>
                        ${extraRow}
                    </div>`;
            };

            // Filtro data: 01/01/2025
            const cutoffDate = new Date('2025-01-01');

            // Raggruppa per tipo
            const docTypeOrder = ['Preventivo', 'Ordine Cliente', 'Ordine Fornitore', 'Entrata Merci', 'DDT'];
            const byType = {};
            docTypeOrder.forEach(t => { byType[t] = { recent: [], old: [] }; });
            docs.forEach(d => {
                const bucket = byType[d.type] || (byType[d.type] = { recent: [], old: [] });
                if (!d.date || new Date(d.date) >= cutoffDate) bucket.recent.push(d);
                else bucket.old.push(d);
            });

            const typeIcons = {
                'Preventivo': 'fa-file-contract',
                'Ordine Cliente': 'fa-handshake',
                'Ordine Fornitore': 'fa-truck',
                'DDT': 'fa-dolly',
                'Entrata Merci': 'fa-boxes-stacked',
            };

            const renderCol = (typeName) => {
                const c = typeColors[typeName] || { border: '#94a3b8', text: '#475569' };
                const icon = typeIcons[typeName] || 'fa-file';
                const bucket = byType[typeName] || { recent: [], old: [] };
                const total = bucket.recent.length + bucket.old.length;
                const histId2 = 'gh-' + typeName.replace(/\s/g, '') + '-' + Date.now();

                let colHtml = `<div style="flex:1; min-width:0; border-top: 3px solid ${c.border}; background:#fafbfc; border-radius:0 0 8px 8px; padding:10px 8px 8px; display:flex; flex-direction:column; gap:5px;">`;
                colHtml += `<div style="font-size:0.72rem; font-weight:700; color:${c.text}; text-transform:uppercase; letter-spacing:.04em; margin-bottom:6px; display:flex; align-items:center; gap:5px;">
                    <i class="fa-solid ${icon}" style="font-size:0.9em;"></i> ${typeName}
                    <span style="margin-left:auto; background:${c.border}22; color:${c.text}; border-radius:10px; padding:1px 7px; font-size:0.68rem;">${total}</span>
                </div>`;

                if (total === 0) {
                    colHtml += `<div style="color:#cbd5e1; font-size:0.78rem; text-align:center; padding:12px 0;">—</div>`;
                } else {
                    colHtml += `<div style="display:flex; flex-direction:column; gap:4px; max-height:320px; overflow-y:auto;">`;
                    bucket.recent.forEach(d => { colHtml += renderDocRow(d); });
                    if (bucket.old.length > 0) {
                        colHtml += `<div style="border-top:1px dashed #e2e8f0; margin-top:6px; padding-top:4px;">
                            <button onclick="(function(btn,div){div.style.display=div.style.display==='none'?'flex':'none';btn.innerHTML=div.style.display==='none'?'▸ Storico (${bucket.old.length})':'▾ Storico (${bucket.old.length})';})(this,document.getElementById('${histId2}'))"
                                style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:0.72rem;font-weight:600;padding:2px 0; width:100%; text-align:left;">
                                ▸ Storico (${bucket.old.length})
                            </button>
                            <div id="${histId2}" style="display:none; flex-direction:column; gap:4px; margin-top:4px;">`;
                        bucket.old.forEach(d => { colHtml += renderDocRow(d); });
                        colHtml += `</div></div>`;
                    }
                    colHtml += `</div>`;
                }
                colHtml += `</div>`;
                return colHtml;
            };

            let html = `<div style="display:flex; gap:12px; align-items:flex-start;">`;
            docTypeOrder.forEach(t => { html += renderCol(t); });
            html += `</div>`;


            // --- Possibili Entrate Merci (da confermare) ---
            if (possibleDocs.length > 0) {
                const cp = typeColors['Entrata Merci'];
                const sectionId = 'em-poss-' + Date.now();
                const bodyId = sectionId + '-body';
                html += `
                    <div id="${sectionId}" style="margin-top:10px; border-top:1px dashed #e2e8f0; padding-top:8px;">
                        <div onclick="(function(){var b=document.getElementById('${bodyId}');var chev=document.getElementById('${bodyId}-chev');var open=b.style.display!=='none';b.style.display=open?'none':'block';chev.style.transform=open?'rotate(0deg)':'rotate(180deg)';})()"
                            style="font-size:0.72rem; font-weight:700; color:#92640a; margin-bottom:4px; display:flex; align-items:center; gap:6px; cursor:pointer; user-select:none;">
                            <i class="fa-solid fa-circle-question" style="color:#c8961e;"></i>
                            Possibili Entrate Merci (${possibleDocs.length})
                            <i id="${bodyId}-chev" class="fa-solid fa-chevron-up" style="font-size:0.65rem; margin-left:2px; transition:transform 0.2s; transform:rotate(0deg);"></i>
                            <button onclick="event.stopPropagation();document.getElementById('${sectionId}').remove()" title="Chiudi"
                                style="margin-left:auto; background:none; border:none; cursor:pointer; color:#94a3b8; font-size:1rem; line-height:1; padding:0 2px;">×</button>
                        </div>
                        <div id="${bodyId}" style="display:none;">`;

                possibleDocs.forEach((d, idx) => {
                    const dateStr = d.date ? new Date(d.date).toLocaleDateString('it-IT') : '-';
                    const safeRef = (d.reference || '').replace(/'/g, "\\'");
                    const cbId = `em-cb-${sectionId}-${idx}`;
                    html += `
                        <div style="display:flex; align-items:center; gap:8px; padding:7px 10px; background:#fffbeb; border-left:3px solid ${cp.border}; border-radius:5px; margin-bottom:4px;">
                            <input type="checkbox" id="${cbId}" data-ref="${safeRef}" data-section="${sectionId}"
                                style="accent-color:#c8961e; width:15px; height:15px; flex-shrink:0; cursor:pointer;">
                            <label for="${cbId}" style="font-size:0.68rem; font-weight:700; color:${cp.text}; white-space:nowrap; min-width:80px; cursor:pointer;">EM?</label>
                            <span style="color:#64748b; font-size:0.8rem; flex:1;">${d.docNumber} — rif: <em>${d.reference || '-'}</em></span>
                            <span style="color:#64748b; font-size:0.79rem;">${dateStr}</span>
                            <button onclick="window.CRM._excludeEmAlias('${safeRef}', '${clientKey}')" title="Escludi — non è questo cliente"
                                style="padding:2px 7px; background:#ef4444; color:white; border:none; border-radius:4px; font-size:0.72rem; font-weight:700; cursor:pointer; white-space:nowrap; flex-shrink:0;">
                                ✗ Escludi
                            </button>
                        </div>`;
                });

                html += `
                        <div style="margin-top:8px; display:flex; gap:6px; justify-content:flex-end;">
                            <button onclick="window.CRM._confirmSelectedEmAliases('${sectionId}', '${clientKey}')"
                                style="padding:4px 14px; background:#c8961e; color:white; border:none; border-radius:5px; font-size:0.75rem; font-weight:700; cursor:pointer;">
                                ✓ Conferma selezionati
                            </button>
                        </div>
                        </div>
                    </div>`;
            }

            html += '</div>';
            container.innerHTML = html;

        } catch (e) {
            console.error("Giobby Error in CRM:", e);
            container.innerHTML = `<div style="color:#ef4444; padding:10px;">Errore Giobby: ${e.message}</div>`;
        }
    },

    // Salva alias singolo confermato
    _confirmEmAlias: function (reference, clientKey) {
        try {
            const key = 'giobby_em_alias_' + clientKey;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            const norm = reference.trim().toUpperCase();
            if (!existing.some(a => a.trim().toUpperCase() === norm)) {
                existing.push(reference.trim());
                localStorage.setItem(key, JSON.stringify(existing));
            }
        } catch (e) { console.warn('Alias save error:', e); }
        this.renderGiobbyData();
    },

    // Conferma tutti i checkbox selezionati nella sezione possibili
    _confirmSelectedEmAliases: function (sectionId, clientKey) {
        const checkboxes = document.querySelectorAll(`#${sectionId} input[type=checkbox]:checked`);
        if (!checkboxes.length) { alert('Seleziona almeno una Entrata Merci da confermare.'); return; }
        try {
            const key = 'giobby_em_alias_' + clientKey;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            checkboxes.forEach(cb => {
                const ref = cb.dataset.ref;
                const norm = ref.trim().toUpperCase();
                if (!existing.some(a => a.trim().toUpperCase() === norm)) existing.push(ref.trim());
            });
            localStorage.setItem(key, JSON.stringify(existing));
        } catch (e) { console.warn('Alias save error:', e); }
        this.renderGiobbyData();
    },

    // Aggiunge un reference alla blacklist e ricarica
    _excludeEmAlias: function (reference, clientKey) {
        try {
            const key = 'giobby_em_exclude_' + clientKey;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            const norm = reference.trim().toUpperCase();
            if (!existing.some(a => a.trim().toUpperCase() === norm)) {
                existing.push(reference.trim());
                localStorage.setItem(key, JSON.stringify(existing));
            }
        } catch (e) { console.warn('Exclude save error:', e); }
        this.renderGiobbyData();
    },

    // Apre compose email precompilata (Keliweb o Gmail)
    _openCompose: function (toEmail, clientName) {
        const emailProvider = localStorage.getItem('crm_email_provider') || 'keliweb';
        const agentEmail = (typeof currentUser !== 'undefined' && currentUser?.email) ? currentUser.email : '';
        const subject = encodeURIComponent(`Parquet Romagna - ${clientName}`);
        const body = encodeURIComponent(`Gentile ${clientName},\n\n\n\nCordiali saluti`);

        if (emailProvider === 'gmail') {
            // Gmail compose con parametri precompilati
            let gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(toEmail)}&su=${subject}&body=${body}`;
            window.open(gmailUrl, '_blank');
        } else {
            // Keliweb / Roundcube
            const webmailBase = localStorage.getItem('keliweb_webmail_url') || 'https://webmail.parquetromagna.it';
            const url = `${webmailBase}/?_task=mail&_action=compose&_to=${encodeURIComponent(toEmail)}&_subject=${subject}&_body=${body}`;
            window.open(url, '_blank');
        }
    },

    // Salva URL cartella Drive in localStorage
    _saveDriveFolder: function () {
        const input = document.getElementById('crmDriveFolderUrl');
        const url = (input?.value || '').trim();
        localStorage.setItem('crm_drive_folder_url', url);
        const icon = url ? '\u2705' : '\uD83D\uDDD1\uFE0F';
        // Feedback visivo breve
        const btn = input?.nextElementSibling;
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = icon;
            setTimeout(() => { btn.innerHTML = orig; }, 1200);
        }
    },

    // --- POPUP HOVER: Ordine Fornitore ---

    _ofPopupEl: null,
    _ofDetailCache: {}, // cache: docId -> righe
    _ofHideTimer: null,

    _ofPopup: function () {
        if (!this._ofPopupEl) {
            const el = document.createElement('div');
            el.id = 'crm-of-popup';
            el.style.cssText = [
                'position:fixed; z-index:99999; pointer-events:none;',
                'background:#fff; border:1.5px solid #f97316; border-radius:10px;',
                'box-shadow:0 8px 32px rgba(0,0,0,0.18); padding:12px 16px;',
                'min-width:220px; max-width:320px; font-size:0.82rem; color:#1e293b;',
                'display:none; transition:opacity 0.12s;'
            ].join('');
            document.body.appendChild(el);
            this._ofPopupEl = el;
        }
        return this._ofPopupEl;
    },

    _showOFPopup: function (event, el) {
        clearTimeout(this._ofHideTimer);
        const popup = this._ofPopup();
        const num = el.dataset.ofNum || '-';
        const ref = el.dataset.ofRef || '';
        const date = el.dataset.ofDate || '-';
        const note = el.dataset.ofNote || '';
        const docId = el.dataset.ofId || '';
        const supplier = el.dataset.ofSupplier || '';

        const deliveryFromNote = this._parseDeliveryFromNote(note);
        // Se la data consegna è stata estratta, mostriamo le note solo se contengono
        // testo significativo oltre al pattern della data (es. altre info utili)
        const noteResiduo = deliveryFromNote && note
            ? note.replace(/cons(?:egna)?[^\n]*/i, '').trim()
            : note;
        // Render base (subito con i dati già disponibili)
        popup.innerHTML = `
            <div style="font-weight:700; color:#c2410c; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-truck" style="font-size:0.85em;"></i> Ordine Fornitore #${num}
            </div>
            <div style="display:grid; grid-template-columns:auto 1fr; gap:3px 10px; margin-bottom:8px;">
                <span style="color:#94a3b8; white-space:nowrap;">Fornitore</span>
                <span id="crm-of-popup-supplier" style="font-weight:600;">${supplier || '\u2014'}</span>
                <span style="color:#94a3b8; white-space:nowrap;">Data ordine</span>
                <span>${date}</span>
                <span style="color:#94a3b8; white-space:nowrap;">Data consegna</span>
                <span id="crm-of-popup-delivery" style="color:${deliveryFromNote ? '#075985' : '#cbd5e1'}; font-weight:${deliveryFromNote ? '600' : '400'}">${deliveryFromNote || '\u2014'}</span>
                ${noteResiduo ? `<span style="color:#94a3b8; white-space:nowrap;">Note</span><span style="color:#475569;">${noteResiduo.substring(0, 80)}${noteResiduo.length > 80 ? '\u2026' : ''}</span>` : ''}
            </div>
            <div id="crm-of-popup-rows" style="border-top:1px solid #fed7aa; padding-top:7px; min-height:22px;">
                <span style="color:#94a3b8; font-size:0.78rem;"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento prodotti...</span>
            </div>`;

        this._posOFPopup(event);
        popup.style.display = 'block';
        popup.style.opacity = '1';

        if (docId) {
            this._fetchOFDetail(docId).then(detail => {
                if (popup.style.display === 'none') return;
                const rowsEl = document.getElementById('crm-of-popup-rows');
                if (!rowsEl) return;
                // Aggiorna il nome fornitore se l'API lo ha restituito
                if (detail && detail.supplier) {
                    const supplierEl = document.getElementById('crm-of-popup-supplier');
                    if (supplierEl) supplierEl.textContent = detail.supplier;
                }
                // Aggiorna la data di consegna se l'API la restituisce
                if (detail && detail.deliveryDate) {
                    const deliveryEl = document.getElementById('crm-of-popup-delivery');
                    if (deliveryEl) deliveryEl.textContent = detail.deliveryDate;
                }
                if (!detail || detail.unavailable || !detail.rows || detail.rows.length === 0) {
                    rowsEl.innerHTML = '<span style="color:#94a3b8; font-size:0.78rem;">Nessuna riga prodotto disponibile.</span>';
                    return;
                }
                rowsEl.innerHTML = detail.rows.map(r => `
                    <div style="display:flex; gap:8px; align-items:baseline; padding:2px 0;">
                        <span style="flex:1; color:#334155;">${r.description || '\u2014'}</span>
                        <span style="white-space:nowrap; color:#64748b; font-size:0.78rem;">${r.qty} ${r.uom}</span>
                    </div>`).join('');
            }).catch(() => {
                const rowsEl = document.getElementById('crm-of-popup-rows');
                if (rowsEl) rowsEl.innerHTML = '<span style="color:#94a3b8; font-size:0.78rem;">Righe prodotto non disponibili.</span>';
            });
        } else {
            const rowsEl = document.getElementById('crm-of-popup-rows');
            if (rowsEl) rowsEl.innerHTML = '';
        }
    },

    _posOFPopup: function (event) {
        const popup = this._ofPopupEl;
        if (!popup) return;
        const margin = 14;
        let x = event.clientX + margin;
        let y = event.clientY + margin;
        // Evita uscita a destra
        const pw = popup.offsetWidth || 280;
        if (x + pw > window.innerWidth - 10) x = event.clientX - pw - margin;
        popup.style.left = x + 'px';
        popup.style.top = y + 'px';
    },

    /**
     * Cerca una data di consegna nel testo libero delle note.
     * Riconosce pattern come:
     *   "Consegna: 15/03/2026"  "cons. 10-03"  "consegna 5 marzo 2026"
     *   "consegna entro il 20/04"  "consegna prevista il 1 aprile"
     * Restituisce stringa formattata it-IT oppure null.
     */
    _parseDeliveryFromNote: function (note) {
        if (!note || !note.trim()) return null;
        const MONTHS = {
            gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
            luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
            jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
            jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, 'dec': 12
        };

        // Pattern 1: keyword consegna/delivery vicino a data numerica
        // es. "consegna: 15/03/2026", "cons. 10-3", "consegna entro il 20/04"
        const numDateRe = /cons(?:egna)?[a-z\s\.:\-]*?(?:il\s+|del\s+|entro[\s\w]*?il\s+|prevista[\s\w]*?il\s+)?(\d{1,2})[\.\/\-](\d{1,2})(?:[\.\/\-](\d{2,4}))?/i;
        let m = note.match(numDateRe);
        if (m) {
            const d = parseInt(m[1]), mo = parseInt(m[2]);
            const yr = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3])) : new Date().getFullYear();
            if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12)
                return `${String(d).padStart(2, '0')}/${String(mo).padStart(2, '0')}/${yr}`;
        }

        // Pattern 2: keyword + giorno + mese in lettere
        // es. "consegna 5 marzo", "consegna prevista 1 aprile 2026"
        const wordMonthRe = /cons(?:egna)?[a-z\s\.:\-]*?(?:il\s+|del\s+|entro[\s\w]*?il\s+|prevista[\s\w]*?il\s+)?(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:[\s,]+(\d{4}))?/i;
        m = note.match(wordMonthRe);
        if (m) {
            const d = parseInt(m[1]), mo = MONTHS[m[2].toLowerCase()];
            const yr = m[3] ? parseInt(m[3]) : new Date().getFullYear();
            if (d >= 1 && d <= 31 && mo)
                return `${String(d).padStart(2, '0')}/${String(mo).padStart(2, '0')}/${yr}`;
        }

        return null;
    },

    _hideOFPopup: function () {
        this._ofHideTimer = setTimeout(() => {
            const popup = this._ofPopupEl;
            if (popup) { popup.style.display = 'none'; popup.style.opacity = '0'; }
        }, 120);
    },

    _fetchOFDetail: async function (docId) {
        if (this._ofDetailCache[docId]) return this._ofDetailCache[docId];
        try {
            const jsonConfig = localStorage.getItem('giobbyConfig');
            if (!jsonConfig) return { supplier: null, rows: [] };
            const cfg = JSON.parse(jsonConfig);
            const baseUrl = cfg.apiUrl.endsWith('/') ? cfg.apiUrl : cfg.apiUrl + '/';
            let url = baseUrl + 'purchases/orders/' + encodeURIComponent(docId);
            if (cfg.useProxy) url = 'https://corsproxy.io/?' + encodeURIComponent(url);
            const headers = window.getGiobbyHeaders ? window.getGiobbyHeaders(cfg.accessToken) : {};
            const res = await fetch(url, { headers });
            if (!res.ok) return { supplier: null, rows: [] };
            const data = await res.json();
            // DEBUG: logga la risposta raw per scoprire i campi disponibili
            console.log('[OF Detail] Risposta API raw:', JSON.stringify(data, null, 2));
            // Estrae nome fornitore (vari possibili nomi di campo Giobby)
            const rawSupplier = data.supplierName || data.vendorName || data.contactName
                || data.supplierBusinessName || data.supplier || data.vendorBusinessName
                || data.contact?.name || null;
            // Rimuove eventuale prefisso numerico tipo "157 | ITALPROFILI SRL" → "ITALPROFILI SRL"
            const supplier = rawSupplier
                ? rawSupplier.replace(/^\d+\s*\|\s*/, '').trim()
                : null;
            // Estrae data consegna (vari nomi possibili nei gestionali italiani)
            const rawDelivery = data.deliveryDate || data.expectedDeliveryDate || data.deliveryExpectedDate
                || data.dataConsegna || data.delivery_date || data.expectedDate
                || data.scheduledDeliveryDate || data.dueDate || data.promisedDate
                || data.deliveryDateExpected || null;
            const deliveryDate = rawDelivery
                ? new Date(rawDelivery).toLocaleDateString('it-IT')
                : null;
            // Estrae righe
            const rowList = data.rows || data.items || data.documentRows || data.documentsRows || data.lines || [];
            const rows = rowList.map(r => ({
                description: r.description || r.itemDescription || r.productDescription || r.desc || '',
                qty: parseFloat(r.quantity || r.qty || r.quantityOrdered || 0).toFixed(2),
                uom: (r.unitOfMeasure || r.uom || r.um || 'pz').toUpperCase(),
            })).filter(r => r.description);
            const result = { supplier, deliveryDate, rows };
            this._ofDetailCache[docId] = result;
            return result;
        } catch (e) {
            console.warn('[OF Popup] Fetch detail error:', e);
            return { supplier: null, rows: [], unavailable: true };
        }
    },

    // --- FATTURE GIOBBY ---

    renderInvoicesSection: async function () {
        const container = document.getElementById('crmInvoicesBody');
        if (!container) return;
        container.innerHTML = '<div style="color:#94a3b8;font-size:0.82rem;padding:8px 0;"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento fatture...</div>';

        if (!window.fetchGiobbyInvoices) {
            container.innerHTML = '<div style="color:#94a3b8;font-size:0.82rem;">Connessione Giobby non configurata.</div>';
            return;
        }

        try {
            const invoices = await window.fetchGiobbyInvoices(this.currentClient);
            if (!invoices || invoices.length === 0) {
                container.innerHTML = '<div style="color:#94a3b8;font-size:0.82rem;padding:8px 0;">Nessuna fattura trovata su Giobby.</div>';
                return;
            }

            const cutoff = new Date('2025-01-01');
            const recent = invoices.filter(inv => !inv.date || new Date(inv.date) >= cutoff);
            const old = invoices.filter(inv => inv.date && new Date(inv.date) < cutoff);

            const isAdminView = (typeof db !== 'undefined' && db.isAdmin);

            const rowHtml = (inv) => {
                const dateStr = inv.docDate || (inv.date ? new Date(inv.date).toLocaleDateString('it-IT') : '-');
                const link = isAdminView && inv.giobbyUrl ? `onclick="window.open('${inv.giobbyUrl}','_blank')" style="cursor:pointer;"` : '';
                const linkIcon = isAdminView && inv.giobbyUrl ? '<i class="fa-solid fa-arrow-up-right-from-square" style="color:#94a3b8;font-size:0.7rem;margin-left:4px;"></i>' : '';
                const safeDesc = (inv.docDescription || '').replace(/"/g, '&quot;');
                const safePay = inv.paymentDate || '';
                const safeTotal = inv.total || 0;
                const safeId = inv.id || '';
                return `<div ${link}
                     data-inv-id="${safeId}"
                     data-inv-desc="${safeDesc}"
                     data-inv-docdate="${dateStr}"
                     data-inv-paydate="${safePay}"
                     data-inv-total="${safeTotal}"
                     data-inv-color="${inv.paymentColor}"
                     onmouseenter="CRM._showInvPopup(event,this)"
                     onmouseleave="CRM._hideInvPopup()"
                     style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#f8fafc;border-left:3px solid #6366f1;border-radius:5px;transition:background 0.12s;">
                    <span style="flex:1;font-weight:600;color:#1e293b;font-size:0.82rem;">${inv.docNumber}${linkIcon}</span>
                    <span style="color:#64748b;font-size:0.78rem;white-space:nowrap;">${dateStr}</span>
                    <span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;background:${inv.paymentColor}22;color:${inv.paymentColor};white-space:nowrap;">${inv.paymentLabel}</span>
                </div>`;
            };

            const oldId = 'inv-hist-' + Date.now();
            let html = `<div style="display:flex;flex-direction:column;gap:4px;max-height:320px;overflow-y:auto;">`;
            recent.forEach(inv => { html += rowHtml(inv); });
            if (old.length > 0) {
                html += `<div style="border-top:1px dashed #e2e8f0;margin-top:4px;padding-top:4px;">
                    <button onclick="(function(btn,div){div.style.display=div.style.display==='none'?'flex':'none';btn.innerHTML=div.style.display==='none'?'&rsaquo; Storico (${old.length})':'&lsaquo; Storico (${old.length})';})(this,document.getElementById('${oldId}'))" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:0.72rem;font-weight:600;padding:2px 0;width:100%;text-align:left;">&#x25B8; Storico (${old.length})</button>
                    <div id="${oldId}" style="display:none;flex-direction:column;gap:4px;margin-top:4px;">`;
                old.forEach(inv => { html += rowHtml(inv); });
                html += `</div></div>`;
            }
            html += `</div>`;
            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = `<div style="color:#ef4444;font-size:0.82rem;">Errore Giobby: ${e.message}</div>`;
        }
    },

    // Popup singleton per le fatture
    _invPopupEl: null,
    _invHideTimer: null,

    _invPopup: function () {
        if (!this._invPopupEl) {
            const el = document.createElement('div');
            el.id = 'crm-inv-popup';
            el.style.cssText = [
                'position:fixed;z-index:99999;pointer-events:none;',
                'background:#fff;border:1.5px solid #6366f1;border-radius:10px;',
                'box-shadow:0 8px 32px rgba(0,0,0,0.15);padding:11px 15px;',
                'min-width:200px;max-width:300px;font-size:0.82rem;color:#1e293b;',
                'display:none;'
            ].join('');
            document.body.appendChild(el);
            this._invPopupEl = el;
        }
        return this._invPopupEl;
    },

    _showInvPopup: function (event, el) {
        clearTimeout(this._invHideTimer);
        const popup = this._invPopup();
        const desc = el.dataset.invDesc || '—';
        const docDate = el.dataset.invDocdate || '—';
        const payDate = el.dataset.invPaydate || null;
        const total = parseFloat(el.dataset.invTotal || 0);
        const docId = el.dataset.invId || '';

        const isAdmin = (typeof db !== 'undefined' && db.isAdmin);
        const fmtCurr = v => v > 0 ? v.toLocaleString('it-IT', { minimumFractionDigits: 2 }) + ' \u20AC' : '\u2014';

        popup.innerHTML = `
            <div style="font-weight:700;color:#6366f1;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
                <i class="fa-solid fa-receipt" style="font-size:0.85em;"></i> Dettaglio Fattura
            </div>
            <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;">
                <span style="color:#94a3b8;white-space:nowrap;">Descrizione</span>
                <span style="font-weight:600;word-break:break-word;">${desc}</span>
                <span style="color:#94a3b8;white-space:nowrap;">Data fattura</span>
                <span>${docDate}</span>
                ${isAdmin ? `
                <span style="color:#94a3b8;white-space:nowrap;">Totale</span>
                <span style="font-weight:600;">${fmtCurr(total)}</span>` : ''}
                <span style="color:#94a3b8;white-space:nowrap;">Data pagamento</span>
                <span style="color:${payDate ? '#22c55e' : '#94a3b8'};font-weight:${payDate ? '600' : '400'};">
                    ${payDate || 'Non ancora registrata'}
                </span>
            </div>`;

        const margin = 14;
        let x = event.clientX + margin;
        let y = event.clientY + margin;
        if (x + 300 > window.innerWidth - 10) x = event.clientX - 300 - margin;
        popup.style.left = x + 'px';
        popup.style.top = y + 'px';
        popup.style.display = 'block';
    },

    _hideInvPopup: function () {
        this._invHideTimer = setTimeout(() => {
            if (this._invPopupEl) this._invPopupEl.style.display = 'none';
        }, 100);
    },

    _invDetailCache: {},
    _fetchInvDetail: async function () { return []; }, // righe fattura non esposte dall'API Giobby


    // --- SOLLECITI DI PAGAMENTO ---

    renderSopralluoghi: async function () {
        const container = document.getElementById('crmSopralluoghiBody');
        if (!container) return;
        
        container.innerHTML = '<div style="padding:15px; color:#94a3b8; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento...</div>';
        
        try {
            if (!window.supabase || typeof window.supabase.from !== 'function') {
                container.innerHTML = '<div style="padding:15px; color:#94a3b8; text-align:center;">Database non disponibile.</div>';
                return;
            }
            
            const { data, error } = await window.supabase
                .from('sopralluoghi')
                .select('id, created_at, client_address, client_name, full_data_json')
                .eq('client_id', this.currentClient.id)
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            
            if (!data || data.length === 0) {
                container.innerHTML = '<div style="padding:20px; color:#94a3b8; text-align:center;">Nessuna scheda di cantiere registrata.</div>';
                return;
            }
            
            let html = `<table class="crm-table">
                <thead>
                    <tr>
                        <th style="width: 110px;">Data</th>
                        <th>Cantiere / Indirizzo</th>
                        <th style="width: 50px;"></th>
                    </tr>
                </thead>
                <tbody>`;
                
            data.forEach(s => {
                const dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString('it-IT') : '-';
                let address = s.client_address || s.client_name || '-';
                
                // try to extract cantiere name from full json
                if (s.full_data_json && typeof s.full_data_json === 'object') {
                    if (s.full_data_json.clientCantiere) address = s.full_data_json.clientCantiere + ' - ' + address;
                    else if (s.full_data_json.clientUnita) address = address + ' (' + s.full_data_json.clientUnita + ')';
                }
                
                html += `
                    <tr onclick="window.open('sopralluoghi.html?loaddoc=${s.id}', '_blank')" style="cursor:pointer;" title="Clicca per aprire la scheda di cantiere">
                        <td><strong>${dateStr}</strong></td>
                        <td style="color:#1e293b; font-weight:500;">${address}</td>
                        <td style="text-align:right;"><i class="fa-solid fa-arrow-up-right-from-square" style="color:#3b82f6;"></i></td>
                    </tr>
                `;
            });
            
            html += `</tbody></table>`;
            container.innerHTML = html;
            
        } catch(e) {
            console.error("renderSopralluoghi error:", e);
            container.innerHTML = `<div style="padding:15px; color:#ef4444; text-align:center;">Errore caricamento schede: ${e.message}</div>`;
        }
    },

    renderSolleciti: async function () {
        const container = document.getElementById('crmSollecitiBody');
        if (!container) return;
        const clientId = this.currentClient.id;
        const clientName = ((this.currentClient.name || '') + ' ' + (this.currentClient.surname || '')).trim();
        const clientEmail = this.currentClient.email || '';

        const typeConf = {
            sollecito_call: { icon: '📞', label: 'Chiamata', color: '#3b82f6' },
            sollecito_note: { icon: '📝', label: 'Nota', color: '#8b5cf6' },
            sollecito_email: { icon: '✉️', label: 'Email', color: '#6366f1' },
        };

        container.innerHTML = '<div style="color:#94a3b8;font-size:0.82rem;padding:6px 0;"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento...</div>';

        // Carica note con tipo sollecito_*
        let all = [];
        try {
            const { data, error } = await window.supabase
                .from('crm_notes')
                .select('*')
                .eq('client_id', clientId)
                .in('type', ['sollecito_call', 'sollecito_note', 'sollecito_email'])
                .order('created_at', { ascending: false });
            if (!error) all = data || [];
        } catch (e) { all = []; }

        // Lista
        let listHtml = '';
        if (all.length === 0) {
            listHtml = '<div style="color:#94a3b8;font-size:0.82rem;padding:6px 0;">Nessun sollecito registrato.</div>';
        } else {
            all.forEach(n => {
                const cfg = typeConf[n.type] || typeConf.sollecito_note;
                const dateStr = new Date(n.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const isEmail = n.type === 'sollecito_email';
                listHtml += `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 10px;background:#f8fafc;border-left:3px solid ${cfg.color};border-radius:5px;margin-bottom:5px;">
                    <span style="font-size:1rem;line-height:1.5;">${cfg.icon}</span>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                            <span style="font-size:0.7rem;font-weight:700;color:${cfg.color};">${cfg.label}</span>
                            <span style="font-size:0.7rem;color:#94a3b8;">${dateStr}</span>
                        </div>
                        <div style="font-size:0.82rem;color:#334155;">${isEmail ? '<em style="color:#6366f1;">Email inviata</em>' : (n.text || '').replace(/\n/g, '<br>')}</div>
                    </div>
                    <button onclick="CRM._deleteSollecito('${clientId}','${n.id}')" title="Elimina" style="background:none;border:none;cursor:pointer;color:#cbd5e1;font-size:0.85rem;padding:0;flex-shrink:0;"><i class='fa-solid fa-trash-can'></i></button>
                </div>`;
            });
        }

        // Composa email link (sanitizzato per evitare injection nel DOM)
        const safeEmail = clientEmail.replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/&/g, '&amp;');
        const safeName = clientName.replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/&/g, '&amp;');

        container.innerHTML = `
            <div id="crmSollecitiList" style="max-height:220px;overflow-y:auto;margin-bottom:10px;">${listHtml}</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button id="btnSollecitoCall" style="padding:5px 10px;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:0.78rem;cursor:pointer;font-weight:600;">Chiamata</button>
                    <button id="btnSollecitoNote" style="padding:5px 10px;background:#8b5cf6;color:#fff;border:none;border-radius:6px;font-size:0.78rem;cursor:pointer;font-weight:600;">Nota</button>
                    <button id="btnSollecitoEmail" data-email="${safeEmail}" data-name="${safeName}" style="padding:5px 10px;background:#6366f1;color:#fff;border:none;border-radius:6px;font-size:0.78rem;cursor:pointer;font-weight:600;">E-mail</button>
                </div>
                <textarea id="crmSollecitiText" placeholder="Note chiamata / sollecito..." rows="2" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:0.82rem;resize:vertical;font-family:inherit;box-sizing:border-box;"></textarea>
            </div>`;

        // Bind pulsanti via addEventListener (evita problemi emoji/encoding in onclick HTML)
        const getNote = () => (document.getElementById('crmSollecitiText') || {}).value || '';
        document.getElementById('btnSollecitoCall')?.addEventListener('click', () =>
            CRM._addSollecito(clientId, 'sollecito_call', getNote()));
        document.getElementById('btnSollecitoNote')?.addEventListener('click', () =>
            CRM._addSollecito(clientId, 'sollecito_note', getNote()));
        const btnEmail = document.getElementById('btnSollecitoEmail');
        if (btnEmail) {
            btnEmail.addEventListener('click', () =>
                CRM._sendSollecitoEmail(clientId, btnEmail.dataset.email, btnEmail.dataset.name));
        }
    },

    _addSollecito: async function (clientId, type, text) {
        if (!text || !text.trim()) { alert('Inserisci una nota prima di registrare il sollecito.'); return; }
        await this.addNote(clientId, type, text.trim());
        document.getElementById('crmSollecitiText').value = '';
        await this.renderSolleciti();
    },

    _sendSollecitoEmail: async function (clientId, toEmail, clientName) {
        if (!toEmail) { alert('Email cliente non disponibile.'); return; }
        const emailProvider = localStorage.getItem('crm_email_provider') || 'keliweb';
        const subject = encodeURIComponent(`Sollecito Pagamento - ${clientName}`);
        const body = encodeURIComponent(`Gentile ${clientName},\n\nCon la presente Le inviamo un cortese sollecito di pagamento.\n\nRimanendo a disposizione per qualsiasi chiarimento,\nCordiali saluti`);
        if (emailProvider === 'gmail') {
            window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(toEmail)}&su=${subject}&body=${body}`, '_blank');
        } else {
            const webmailBase = localStorage.getItem('keliweb_webmail_url') || 'https://webmail.parquetromagna.it';
            window.open(`${webmailBase}/?_task=mail&_action=compose&_to=${encodeURIComponent(toEmail)}&_subject=${subject}&_body=${body}`, '_blank');
        }
        // Registra il log
        await this.addNote(clientId, 'sollecito_email', 'Email sollecito inviata a ' + toEmail);
        await this.renderSolleciti();
    },

    _deleteSollecito: async function (clientId, noteId) {
        await this.deleteNote(clientId, noteId);
        await this.renderSolleciti();
    },

    // ================================================================
    // PUSH TO GIOBBY: Crea / Aggiorna il cliente nel registry Giobby
    // ================================================================

    /**
     * Renders a small badge below the push button showing the Giobby link status.
     * @param {string|null} idCustomer  Giobby customer code (e.g. "1234")
     * @param {string|null} idContact   Giobby contact GUID (for URL construction)
     */
    _renderGiobbyBadge: function (idCustomer, idContact) {
        let badge = document.getElementById('crmGiobbyBadge');
        if (!badge) return;

        if (idCustomer) {
            // Build a direct link to the Giobby contact page if we have the company ID
            let link = '';
            try {
                const cfg = JSON.parse(localStorage.getItem('giobbyConfig') || '{}');
                const m = (cfg.apiUrl || '').match(/\/(GiobbyApi\d+)\//i);
                if (m && idContact) {
                    const href = `https://app.giobby.com/${m[1]}/company/registry/contact/${idContact}`;
                    link = ` &nbsp;<a href="${href}" target="_blank" style="color:#22c55e;font-size:0.72rem;">↗ Apri</a>`;
                }
            } catch (_) {}
            badge.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#22c55e;"></i> Sincronizzato &mdash; codice <strong>#${idCustomer}</strong>${link}`;
            badge.style.color = '#15803d';
        } else {
            badge.innerHTML = `<i class="fa-regular fa-circle-xmark" style="color:#94a3b8;"></i> Non ancora inviato su Giobby`;
            badge.style.color = '#94a3b8';
        }
    },

    /**
     * Main entry point: push the current CRM client to Giobby.
     * - Finds or creates the contact in Giobby (/customers endpoint)
     * - Assigns the current agent as owner (visibility)
     * - Persists giobbyContactId + giobbyCustomerId in Supabase & localStorage cache
     */
    pushToGiobby: async function () {
        const btn = document.getElementById('btnCrmPushGiobby');
        const c = this.currentClient;
        if (!c) return;

        // --- 1. Validate Giobby config ---
        const jsonConfig = localStorage.getItem('giobbyConfig');
        if (!jsonConfig) {
            alert('Giobby non configurato. Vai in Impostazioni → Giobby e accedi prima.');
            return;
        }
        const config = JSON.parse(jsonConfig);
        if (!config.accessToken || !config.apiUrl) {
            alert('Sessione Giobby non valida. Esci e rientra nelle impostazioni Giobby.');
            return;
        }

        // --- 2. Spinner on button ---
        const origLabel = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Invio in corso...';
        }

        try {
            // --- 3. Resolve agent Giobby ID (for contact ownership / visibility) ---
            //        agentsMetadata[agentName].giobbyAgentId  (e.g. "12")
            let agentId = null;
            try {
                if (typeof db !== 'undefined' && db.data && db.data.vars && db.data.vars.agentsMetadata) {
                    // Determine agent name for this client from quotes
                    const clientQuotes = db.getAllQuotes().filter(q =>
                        (q.customer && q.customer.id && String(q.customer.id) === String(c.id)) ||
                        (q.client_id && String(q.client_id) === String(c.id))
                    );
                    // Use agent from most recent quote, or from client record itself
                    const agentName = c.agent ||
                        (clientQuotes.length > 0 ? clientQuotes.sort((a, b) => new Date(b.date) - new Date(a.date))[0].agent : null);

                    if (agentName && db.data.vars.agentsMetadata[agentName]) {
                        agentId = db.data.vars.agentsMetadata[agentName].giobbyAgentId || null;
                    }
                    // Fallback: also check config for the currently-logged-in user
                    if (!agentId && config.giobbyAgentId) agentId = config.giobbyAgentId;
                    if (agentId) console.log(`[CRM Push] Agente trovato: "${agentName}" → giobbyAgentId=${agentId}`);
                    else console.warn('[CRM Push] AgentId non trovato — il cliente sarà visibile a tutti (ALL).');
                }
            } catch (agentErr) {
                console.warn('[CRM Push] Errore risoluzione agentId:', agentErr);
            }

            // --- 4. Build clientData object for Giobby ---
            const clientData = {
                // Identity
                name: c.name || '',
                surname: c.surname || '',
                type: c.type || (c.vat && c.vat.length === 11 ? 'company' : 'private'),
                // Fiscal
                vat: c.vat || '',
                fiscal_code: c.fiscal_code || c.fiscalCode || '',
                // Address
                address: c.address || '',
                city: c.city || '',
                zip: c.zip || '',
                addressProvince: c.addressProvince || c.address_province || c.province || '',
                country: c.country || 'Italia',
                // Contacts
                email: c.email || '',
                mobile: c.mobile || '',
                phone: c.phone || '',
                phoneOffice: c.phone_office || c.phoneOffice || '',
                phoneHome: c.phone_home || c.phoneHome || '',
                pec: c.pec || '',
                fax: c.fax || '',
                sdi: c.sdi || '',
                // Existing Giobby IDs (for update path)
                giobbyContactId: c.giobbyContactId || c.giobby_contact_id || '',
                giobbyCustomerId: c.giobbyCustomerId || c.idCustomer || ''
            };

            console.log('[CRM Push] clientData →', clientData);

            // --- 5. Call findOrCreate (autoCreate=true → no user dialog) ---
            const result = await window.findOrCreateGiobbyClient(config, clientData, true, agentId);
            // result = { idContact: "<GUID>", idCustomer: "<numeric_code>" }

            if (!result || (!result.idContact && !result.idCustomer)) {
                throw new Error('Risposta vuota da Giobby — contatto non creato.');
            }

            const { idContact, idCustomer } = result;
            console.log('[CRM Push] ✅ Risultato:', { idContact, idCustomer });

            // --- 6. Persist: update local client object ---
            c.giobbyContactId = idContact || c.giobbyContactId;
            c.giobbyCustomerId = idCustomer || c.giobbyCustomerId;

            // --- 7. Persist: save to Supabase via db.saveClient ---
            try {
                if (typeof db !== 'undefined' && typeof db.saveClient === 'function') {
                    await db.saveClient(c);
                    console.log('[CRM Push] ✅ Cliente salvato in Supabase con giobbyContactId:', idContact);
                }
            } catch (saveErr) {
                // Non blocchiamo se il salvataggio su Supabase fallisce
                console.error('[CRM Push] ⚠️ Salvataggio Supabase fallito (i dati Giobby sono comunque stati aggiornati):', saveErr);
            }

            // --- 8. Update button: success state ---
            if (btn) {
                btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Inviato! Cod. #${idCustomer || '–'}`;
                btn.style.background = '#16a34a';
                setTimeout(() => {
                    btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Aggiorna su Giobby`;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 4000);
            }

            // --- 9. Update badge ---
            this._renderGiobbyBadge(idCustomer, idContact);

            // --- 10. Reload Giobby documents section ---
            setTimeout(() => { this.renderGiobbyData().catch(() => {}); }, 1500);

        } catch (err) {
            console.error('[CRM Push] ❌ Errore:', err);

            if (btn) {
                const isAuthErr = err.message && (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('token'));
                btn.innerHTML = isAuthErr
                    ? '<i class="fa-solid fa-lock"></i> Sessione scaduta — vai in Impostazioni'
                    : `<i class="fa-solid fa-triangle-exclamation"></i> Errore: ${(err.message || '').substring(0, 60)}`;
                btn.style.background = '#dc2626';
                setTimeout(() => {
                    btn.innerHTML = origLabel;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 5000);
            }
        }
    },

};

