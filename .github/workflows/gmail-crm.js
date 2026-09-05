/**
 * gmail-crm.js
 * Integrazione Gmail API nel CRM Genesy.
 * Permette di leggere lo storico email agente <-> cliente direttamente nel CRM.
 *
 * SETUP RICHIESTO (una volta sola):
 * 1. Vai su https://console.cloud.google.com/ → Crea un progetto
 * 2. Abilita la Gmail API
 * 3. Crea credenziali OAuth 2.0 → Client ID (Web Application)
 * 4. Aggiungi l'URL del sito Netlify agli "Authorized JavaScript origins"
 * 5. Incolla il Client ID nelle Impostazioni di Genesy (campo apposito)
 */

window.GmailCRM = (function () {

    // --- CONFIG ---
    const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
    const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';

    let _tokenClient = null;
    let _accessToken = null;
    let _tokenExpiry = 0;
    let _gapiReady = false;
    let _gsiReady = false;

    // --- INIT ---

    function getClientId() {
        return localStorage.getItem('gmail_oauth_client_id') || '';
    }

    function isTokenValid() {
        return _accessToken && Date.now() < _tokenExpiry;
    }

    async function loadGapi() {
        if (_gapiReady) return;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = async () => {
                await new Promise(r => gapi.load('client', r));
                await gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
                _gapiReady = true;
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function loadGsi() {
        if (_gsiReady || document.querySelector('script[src*="accounts.google.com/gsi"]')) {
            _gsiReady = true;
            return;
        }
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = () => { _gsiReady = true; resolve(); };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function ensureInitialized() {
        const clientId = getClientId();
        if (!clientId) throw new Error('NO_CLIENT_ID');
        await Promise.all([loadGapi(), loadGsi()]);
        if (!_tokenClient) {
            _tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: SCOPES,
                callback: (resp) => {
                    if (resp.error) return;
                    _accessToken = resp.access_token;
                    _tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
                    gapi.client.setToken({ access_token: _accessToken });
                },
            });
        }
    }

    function requestToken() {
        return new Promise((resolve, reject) => {
            const original = _tokenClient.callback;
            _tokenClient.callback = (resp) => {
                original(resp);
                if (resp.error) reject(new Error(resp.error));
                else resolve();
            };
            _tokenClient.requestAccessToken({ prompt: isTokenValid() ? '' : 'none' });
        });
    }

    // --- FETCH EMAILS ---

    async function fetchEmails(clientEmail, maxResults = 20) {
        if (!isTokenValid()) await requestToken();

        // Cerca email da O verso l'email del cliente
        const query = `from:${clientEmail} OR to:${clientEmail}`;

        const listResp = await gapi.client.gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: maxResults,
        });

        const messages = listResp.result.messages || [];
        if (messages.length === 0) return [];

        // Recupera i dettagli di ogni messaggio (in batch simulato)
        const details = await Promise.all(
            messages.slice(0, maxResults).map(m =>
                gapi.client.gmail.users.messages.get({
                    userId: 'me',
                    id: m.id,
                    format: 'metadata',
                    metadataHeaders: ['Subject', 'From', 'To', 'Date'],
                }).then(r => r.result)
            )
        );

        return details.map(msg => {
            const headers = {};
            (msg.payload?.headers || []).forEach(h => { headers[h.name] = h.value; });
            return {
                id: msg.id,
                subject: headers['Subject'] || '(nessun oggetto)',
                from: headers['From'] || '',
                to: headers['To'] || '',
                date: headers['Date'] ? new Date(headers['Date']) : new Date(parseInt(msg.internalDate)),
                snippet: msg.snippet || '',
                gmailUrl: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
            };
        }).sort((a, b) => b.date - a.date);
    }

    // --- RENDER ---

    async function renderEmailHistory(client) {
        const container = document.getElementById('crmEmailBody');
        if (!container) return;

        const clientEmail = client.email;
        const clientId = getClientId();

        if (!clientId) {
            container.innerHTML = `
                <div style="color:#94a3b8; font-size:0.82rem; padding:10px 0;">
                    <i class="fa-solid fa-circle-info" style="color:#3b82f6;"></i>
                    Per vedere lo storico email, configura il <strong>Google OAuth Client ID</strong>
                    nelle <a href="#" onclick="openSettings(); return false;" style="color:#3b82f6;">Impostazioni</a>.
                </div>`;
            return;
        }

        if (!clientEmail) {
            container.innerHTML = `<div style="color:#94a3b8; font-size:0.82rem; padding:10px 0;">Nessuna email associata al cliente.</div>`;
            return;
        }

        container.innerHTML = `<div style="color:#94a3b8;font-size:0.82rem;padding:6px 0;"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento email...</div>`;

        try {
            await ensureInitialized();
            const emails = await fetchEmails(clientEmail);
            _renderList(container, emails, clientEmail);
        } catch (err) {
            if (err.message === 'NO_CLIENT_ID') return; // già gestito sopra
            if (err.message === 'popup_closed_by_user' || err.error === 'access_denied') {
                container.innerHTML = `
                    <div style="font-size:0.82rem; color:#64748b; padding:6px 0;">
                        <button onclick="GmailCRM.authorize()" style="padding:5px 12px; background:#4285f4; color:white; border:none;
                            border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:600;">
                            <i class="fa-brands fa-google"></i> Collega Gmail
                        </button>
                        <span style="margin-left:8px; color:#94a3b8;">per vedere lo storico email</span>
                    </div>`;
            } else {
                // Token scaduto o silent failed → mostra pulsante login
                container.innerHTML = `
                    <div style="font-size:0.82rem; color:#64748b; padding:6px 0;">
                        <button onclick="GmailCRM.authorize()" style="padding:5px 12px; background:#4285f4; color:white; border:none;
                            border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:600;">
                            <i class="fa-brands fa-google"></i> Collega Gmail
                        </button>
                        <span style="margin-left:8px; color:#94a3b8;">per vedere lo storico email</span>
                    </div>`;
                console.warn('GmailCRM error:', err);
            }
        }
    }

    function _renderList(container, emails, clientEmail) {
        if (emails.length === 0) {
            container.innerHTML = `<div style="color:#94a3b8; font-size:0.85rem; padding:8px 0;">Nessuna email trovata con <strong>${clientEmail}</strong>.</div>`;
            return;
        }

        let html = `<div style="max-height:320px; overflow-y:auto; display:flex; flex-direction:column; gap:5px;">`;
        emails.forEach(em => {
            const dateStr = em.date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const isOutgoing = !em.from.toLowerCase().includes(clientEmail.toLowerCase());
            const dirColor = isOutgoing ? '#3b82f6' : '#22c55e';
            const dirIcon = isOutgoing ? 'fa-paper-plane' : 'fa-inbox';
            const dirLabel = isOutgoing ? 'Inviata' : 'Ricevuta';
            const snippet = em.snippet.length > 90 ? em.snippet.substring(0, 90) + '…' : em.snippet;

            html += `
                <a href="${em.gmailUrl}" target="_blank" style="display:flex; align-items:flex-start; gap:10px; padding:8px 10px;
                    background:#f8fafc; border-left:3px solid ${dirColor}; border-radius:5px; text-decoration:none; color:inherit;
                    transition:background 0.15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">
                    <i class="fa-solid ${dirIcon}" style="color:${dirColor}; font-size:0.85rem; margin-top:2px; flex-shrink:0;"></i>
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                            <span style="font-size:0.7rem; font-weight:700; color:${dirColor};">${dirLabel}</span>
                            <span style="font-size:0.7rem; color:#94a3b8;">${dateStr}</span>
                            <i class="fa-solid fa-arrow-up-right-from-square" style="color:#cbd5e1; font-size:0.65rem; margin-left:auto;"></i>
                        </div>
                        <div style="font-size:0.82rem; font-weight:600; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${em.subject}</div>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${snippet}</div>
                    </div>
                </a>`;
        });
        html += `</div>
            <div style="text-align:right; margin-top:6px;">
                <a href="https://mail.google.com/mail/u/0/#search/${encodeURIComponent('from:' + clientEmail + ' OR to:' + clientEmail)}"
                    target="_blank" style="font-size:0.75rem; color:#3b82f6; text-decoration:none;">
                    <i class="fa-solid fa-external-link-alt"></i> Vedi tutte su Gmail
                </a>
            </div>`;

        container.innerHTML = html;
    }

    // Funzione pubblica per autorizzare manualmente (dal bottone "Collega Gmail")
    async function authorize() {
        try {
            await ensureInitialized();
            _tokenClient.callback = async (resp) => {
                if (resp.error) { console.error('OAuth error:', resp); return; }
                _accessToken = resp.access_token;
                _tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
                gapi.client.setToken({ access_token: _accessToken });
                // Ricarica la sezione email
                if (window.CRM && window.CRM.currentClient) {
                    await renderEmailHistory(window.CRM.currentClient);
                }
            };
            _tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (err) {
            console.error('GmailCRM authorize error:', err);
        }
    }

    return {
        renderEmailHistory,
        authorize,
    };

})();
