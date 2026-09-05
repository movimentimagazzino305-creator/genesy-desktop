/**
 * Data Service - SUPABASE VERSION
 * Replicates the interface of data.js but talks to Postgres.
 */

const STATIC_DATA = {
    dailyQuotes: [
        { text: "L'unico modo per fare un ottimo lavoro è amare quello che fai.", author: "Steve Jobs" },
        { text: "Non aspettare. Il momento non sarà mai quello giusto.", author: "Napoleon Hill" },
        { text: "Il successo è la somma di piccoli sforzi, ripetuti giorno dopo giorno.", author: "Robert Collier" },
        { text: "Non ho fallito. Ho solo trovato 10.000 modi che non funzionano.", author: "Thomas Edison" },
        { text: "La logica ti porterà da A a B. L'immaginazione ti porterà ovunque.", author: "Albert Einstein" },
        { text: "Il modo migliore per predire il futuro è crearlo.", author: "Peter Drucker" },
        { text: "Se puoi sognarlo, puoi farlo.", author: "Walt Disney" },
        { text: "La qualità è molto più importante della quantità. Un home run è molto meglio di due doppi.", author: "Steve Jobs" },
        { text: "Il business che non produce nient'altro che soldi è un business povero.", author: "Henry Ford" },
        { text: "L'insuccesso è solo l'opportunità di ricominciare in modo più intelligente.", author: "Henry Ford" },
        { text: "Non importa quanto vai piano, l'importante è non fermarsi.", author: "Confucio" },
        { text: "Le opportunità non accadono. Le crei tu.", author: "Chris Grosser" }
    ]
};

const TEST_DATA = {
    agents: [
        { name: 'Luca', zone: 'Bologna' },
        { name: 'Filippo', zone: 'Bologna' },
        { name: 'Giacomo', zone: 'Riccione' },
        { name: 'Beatrice', zone: 'Cesena' },
        { name: 'Francesco', zone: 'Forlì' },
        { name: 'Daniel', zone: 'Forlì' }
    ],
    firstNames: ['Marco', 'Giulia', 'Alessandro', 'Francesca', 'Matteo', 'Chiara', 'Davide', 'Sara', 'Luca', 'Valentina', 'Andrea', 'Elisa'],
    lastNames: ['Rossi', 'Bianchi', 'Ferrari', 'Esposito', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'Barbieri', 'Moretti'],
    cities: ['Rimini', 'Riccione', 'Cesena', 'Forlì', 'Bologna', 'Ravenna', 'Faenza', 'Imola'],
    statuses: ['Aperto', 'Chiuso', 'Perso']
};

class DataService {
    constructor() {
        this.data = {
            quotes: [],
            clients: [],
            products: [],
            settings: {}, // Global app settings
            vars: {
                categories: [], agents: [], zones: [], statuses: [], cities: []
            },
            zoneAgentMap: {},
            agentDefaultZones: {},
            clientExtras: {} // Sidecar storage for missing columns
        };
        this.user = null;
        this.cacheLoaded = false;
        this.isAdmin = false;
        this.extraWorksCache = {}; // Independent cache for user extended works

        // Static data kept for compatibility
        this.static = STATIC_DATA;
    }

    // --- DATABASE MIGRATION ---
    async ensureSoftDeleteColumns() {
        try {

            // Try to query deleted column - if it fails, column doesn't exist
            const { data, error } = await supabase
                .from('quotes')
                .select('deleted, deleted_at')
                .limit(1);

            if (error && error.message.includes('column')) {
                // Columns don't exist - show migration helper
                console.error('⚠️ Soft delete columns missing!');
                this.showMigrationHelper();
                return false;
            } else {
                return true;
            }
        } catch (e) {
            return true;
        }
    }

    showMigrationHelper() {
        const sqlScript = `ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_quotes_deleted ON quotes(deleted);`;

        const modal = document.createElement('div');
        modal.id = 'migrationModal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <h2>🔧 Migrazione Database Richiesta</h2>
                <p>Per abilitare il recupero preventivi, esegui questo SQL su Supabase:</p>
                
                <textarea id="migrationSQL" readonly style="width: 100%; height: 120px; background: #1e293b; color: #e2e8f0; padding: 15px; border-radius: 8px; margin: 15px 0; font-family: monospace; font-size: 0.85rem; border: none;">${sqlScript}</textarea>
                
                <p style="font-size: 0.9rem; color: #64748b;">
                    <strong>Istruzioni:</strong><br>
                    1. Clicca "Copia SQL"<br>
                    2. Apri <a href="https://supabase.com/dashboard/project/joqzlsmrznitrgooirgo/sql/new" target="_blank" style="color: #3b82f6;">Supabase SQL Editor</a><br>
                    3. Incolla e clicca "Run"<br>
                    4. Ricarica questa pagina
                </p>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                    <button class="btn-primary" onclick="document.getElementById('migrationSQL').select(); navigator.clipboard.writeText(document.getElementById('migrationSQL').value); alert('✅ SQL copiato!');">
                        📋 Copia SQL
                    </button>
                    <button class="btn-secondary" onclick="document.getElementById('migrationModal').remove()">
                        Chiudi
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // ─── LOCAL CACHE (stale-while-revalidate) ──────────────────────────────────
    // Saves ONLY the fields needed to render the list (not full quote objects).
    // Full quote data (~4MB) exceeds localStorage limits for large datasets.
    // Slim cache (~150KB) loads instantly and is always within limits.
    static CACHE_KEY = 'genesy_list_cache_v2';
    static CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

    // ─── IndexedDB helpers ────────────────────────────────────────────────────
    // IndexedDB: no quota issues (limited only by disk), persists through
    // Chrome Memory Saver tab discards, works on both file:// and HTTPS.
    static IDB_NAME    = 'GenesyCache';
    static IDB_STORE   = 'quotes_cache';
    static IDB_KEY     = 'quotes_v2';
    static CACHE_TTL   = 30 * 60 * 1000; // 30 minutes

    _openIDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('GenesyCache', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('quotes_cache')) {
                    db.createObjectStore('quotes_cache', { keyPath: 'key' });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror   = ()  => reject(req.error);
        });
    }

    async _saveLocalCache() {
        try {
            // Slim quotes: only fields needed for the list view
            const slimQuotes = (this.data.quotes || []).map(q => ({
                id: q.id,
                number: q.number,
                friendlyId: q.friendlyId,
                date: q.date,
                status: q.status,
                total: q.total,
                agent: q.agent,
                zone: q.zone,
                deleted: q.deleted,
                deleted_at: q.deleted_at,
                giobbyDocumentId: q.giobbyDocumentId,
                giobbySyncDate: q.giobbySyncDate,
                driveSyncDate: q.driveSyncDate,
                quoteCode: q.quoteCode,
                vatRate: q.vatRate,
                jobType: q.jobType,
                material: q.material,
                excludeFromStats: q.excludeFromStats || false,
                executionYear: q.executionYear || '',
                reference: q.reference || '',
                customer: q.customer ? {
                    name: q.customer.name,
                    city: q.customer.city,
                    id: q.customer.id
                } : {}
            }));

            const idb = await this._openIDB();
            await new Promise((resolve, reject) => {
                const tx = idb.transaction('quotes_cache', 'readwrite');
                tx.objectStore('quotes_cache').put({
                    key: 'quotes_v2',
                    ts: Date.now(),
                    quotes: slimQuotes,
                    isAdmin: this.isAdmin,
                    role: this.role
                });
                tx.oncomplete = () => resolve();
                tx.onerror   = () => reject(tx.error);
            });
            idb.close();
            console.log(`[Cache] ✅ Saved to IndexedDB: ${slimQuotes.length} quotes (isAdmin=${this.isAdmin})`);
            this._lastSyncTime = Date.now(); // Timestamp ultimo sync


            // Clean up old localStorage entries to free space
            try { localStorage.removeItem('genesy_data_cache_v1'); } catch(_) {}
            try { localStorage.removeItem('genesy_list_cache_v2'); } catch(_) {}
        } catch (e) {
            console.warn('[Cache] Could not save to IndexedDB:', e);
        }
    }

    async _loadLocalCache() {
        try {
            const idb = await this._openIDB();
            const result = await new Promise((resolve) => {
                const tx  = idb.transaction('quotes_cache', 'readonly');
                const req = tx.objectStore('quotes_cache').get('quotes_v2');
                req.onsuccess = () => resolve(req.result);
                req.onerror   = () => resolve(null);
            });
            idb.close();

            if (!result) {
                console.log('[Cache] No IndexedDB cache found. Loading from Supabase...');
                return null;
            }
            const age = Date.now() - (result.ts || 0);
            console.log(`[Cache] ✅ Cache hit! ${result.quotes?.length} quotes, ${Math.round(age/1000)}s old. App renders instantly.`);
            return result; // { quotes: [...], ts: ... }
        } catch (e) {
            console.warn('[Cache] Could not read IndexedDB cache:', e);
            return null;
        }
    }

    // ────────────────────────────────────────────────────────────────────────────

    // --- INIT ---
    async init(user) {
        this.user = user;
        // NOTE: The cache fast path is handled in initApp() (auth.js) BEFORE this
        // method is called. When init() is called in the background (from initApp's
        // fast path), we always want fresh data from Supabase.
        return this._loadFromSupabase(user);
    }

    async _backgroundRefresh(user) {
        try {
            await this._loadFromSupabase(user);
            this._saveLocalCache();
            // Fire an event so the UI can refresh the list silently
            window.dispatchEvent(new CustomEvent('genesyCacheRefreshed'));
            console.log('[Cache] Background refresh complete.');
        } catch (e) {
            console.warn('[Cache] Background refresh failed:', e);
        }
    }

    async _loadFromSupabase(user) {
        this.user = user;


        try {
            // 1. CONFIG & VARS
            const { data: configData, error: configError } = await supabase.from('app_config').select('*');
            if (configError) throw new Error("App Config Error (" + configError.code + "): " + configError.message);

            if (configData) {
                this.extraWorksCache = {}; // Init cache (moved out of vars)
                configData.forEach(row => {
                    if (row.key === 'vars') {
                        const cleanVars = { ...row.value };
                        delete cleanVars.extraWorksCache; // Prevent old accidental saves from clobbering
                        this.data.vars = { ...this.data.vars, ...cleanVars };
                    }
                    if (row.key === 'zoneAgentMap') this.data.zoneAgentMap = row.value;
                    if (row.key === 'agentDefaultZones') this.data.agentDefaultZones = row.value;
                    if (row.key === 'client_extras') this.data.clientExtras = row.value || {};

                    // Capture Extra Works (now using email as key)
                    if (row.key.startsWith('extra_works_')) {
                        const identifier = row.key.replace('extra_works_', '');
                        this.extraWorksCache[identifier] = row.value;
                    }
                });
            }

            // --- AUTO-MIGRATION: Add Soft Delete Columns ---
            await this.ensureSoftDeleteColumns();

            // 2. LOAD TABLES (Parallel)


            // --- INJECT DEFAULT AGENT METADATA (AUTO-IMPLEMENTATION) ---
            const defaultAgentMeta = {
                'Fagioli Daniel': { phone: '3463079406', email: 'd.fagioli@parquetromagna.it' },
                'Lolla Beatrice': { phone: '3517401660', email: 'commerciale@parqueromagna.it' },
                'Mondello Filippo': { phone: '3313634839', email: 'f.mondello@parquetbologna.net' },
                'Monti Giacomo': { phone: '3296472805', email: 'g.monti@parquetromagna.it', giobbyAgentId: '12' }
            };

            let metaChanged = false;
            if (!this.data.vars.agentsMetadata) {
                this.data.vars.agentsMetadata = {};
                metaChanged = true;
            }

            Object.entries(defaultAgentMeta).forEach(([name, info]) => {
                if (!this.data.vars.agentsMetadata[name]) {
                    this.data.vars.agentsMetadata[name] = info;
                    metaChanged = true;
                } else {
                    // Update if missing specific fields
                    if (!this.data.vars.agentsMetadata[name].phone && info.phone) {
                        this.data.vars.agentsMetadata[name].phone = info.phone;
                        metaChanged = true;
                    }
                    if (!this.data.vars.agentsMetadata[name].email && info.email) {
                        this.data.vars.agentsMetadata[name].email = info.email;
                        metaChanged = true;
                    }
                    // Also propagate giobbyAgentId from defaults if present and missing
                    if (!this.data.vars.agentsMetadata[name].giobbyAgentId && info.giobbyAgentId) {
                        this.data.vars.agentsMetadata[name].giobbyAgentId = info.giobbyAgentId;
                        metaChanged = true;
                    }
                }
            });

            // Ensure these agents are also in the main 'agents' list if not present
            if (!this.data.vars.agents) {
                this.data.vars.agents = [];
                metaChanged = true;
            }
            Object.keys(defaultAgentMeta).forEach(name => {
                if (!this.data.vars.agents.includes(name)) {
                    this.data.vars.agents.push(name);
                    metaChanged = true;
                }
            });

            if (metaChanged) {

                await this.updateVarList('agentsMetadata', this.data.vars.agentsMetadata);
                await this.updateVarList('agents', this.data.vars.agents); // Also update list
            }
            // 2. LOAD TABLES (Parallel)
            const [clientsRes, productsRes, quotesRes] = await Promise.all([
                supabase.from('clients').select('*').order('name'),
                supabase.from('products').select('*').order('code'),
                supabase.from('quotes').select('*').order('date', { ascending: false }).limit(10000)
            ]);

            // Settings table may not exist yet — query separately to avoid 404 noise
            let settingsData = {};
            try {
                const settingsRes = await supabase.from('settings').select('*').limit(1);
                if (settingsRes.data && settingsRes.data.length > 0) {
                    settingsData = settingsRes.data[0];
                }
            } catch (e) { /* settings table not yet created — silently ignore */ }
            this.data.settings = settingsData;

            // PRE-FETCH GIOBBY CONFIGS FROM APP_CONFIG
            try {
                const giobbyConfigRes = await supabase.from('app_config').select('key, value').in('key', ['giobby_config', 'giobby_config_bo']);
                if (giobbyConfigRes.data) {
                    giobbyConfigRes.data.forEach(row => {
                        this.data[row.key] = row.value || null;
                    });
                }
            } catch (e) { 
                console.warn("Could not pre-fetch giobby_config from app_config :", e);
            }

            if (clientsRes.error) throw new Error("Clients Error: " + clientsRes.error.message);
            if (productsRes.error) throw new Error("Products Error: " + productsRes.error.message);
            if (quotesRes.error) throw new Error("Quotes Error: " + quotesRes.error.message);

            // 3. MAP TO INTERNAL FORMAT 
            // We keep the JSON fields for now to match old structure

            this.data.clients = clientsRes.data.map(c => ({
                ...c,
                idCustomer: c.id_customer || c.idCustomer,
                // Merge Sidecar Data
                ... (this.data.clientExtras[c.id] || {}),

                // Fallback to DB columns if they ever exist
                siteAddress: (this.data.clientExtras[c.id]?.siteAddress) || c.site_address || c.siteAddress,
                siteAddressProvince: (this.data.clientExtras[c.id]?.siteAddressProvince) || c.site_address_province || c.siteAddressProvince,
                contactPerson: (this.data.clientExtras[c.id]?.contactPerson) || c.contact_person || c.contactPerson,

                // MAPPING FIXES (Snake -> Camel)
                addressProvince: c.address_province || c.province || c.addressProvince,
                agent: c.agent || c.salesman || c.id_agent || c.agent
            }));

            // Map Products: snake_case (DB) -> camelCase (App)
            this.data.products = productsRes.data.map(p => {
                // Check if variants are in JSON column 'variants'
                let variants = p.variants || {};
                if (typeof variants === 'string') {
                    try { variants = JSON.parse(variants); } catch (e) { variants = {}; }
                }

                return {
                    ...p,
                    priceMin: p.price_min,
                    priceMax: p.price_max,
                    classe: p.classe || null,
                    ...variants // Spread variants (var1, var2, var3...) to top level
                };
            });

            // Quotes need some mapping to restore the "customer" object structure expected by UI
            this.data.quotes = quotesRes.data.map(q => {
                // Restore complex objects from JSON columns if they exist
                const items = q.items_json || [];
                const customer = q.customer_snapshot_json || {};

                // Polyfill for friendly ID display
                const friendlyId = q.number ? q.number.toString() : q.id.substr(0, 8);

                const extra = q.extra_fields || {};

                return {
                    ...q,
                    items: items,
                    customer: customer,
                    // Use text ID for internal logic, keep friendly for display if needed
                    friendlyId: friendlyId,
                    internalNotes: q.internal_notes,
                    deliveryDate: q.delivery_date,
                    deliveryCompleted: q.delivery_completed,

                    // UNPACK EXTRA FIELDS
                    bank: extra.bank,
                    warehouse: extra.warehouse,
                    deliveryAddress: extra.deliveryAddress,
                    siteAddress: extra.siteAddress,
                    siteCity: extra.siteCity,
                    siteZip: extra.siteZip,
                    siteProvince: extra.siteProvince,
                    siteContactName: extra.siteContactName,
                    siteContactReference: extra.siteContactReference,
                    siteContactRole: extra.siteContactRole,
                    siteContactPhone: extra.siteContactPhone,
                    siteSignboard: extra.siteSignboard,
                    legalNotes: extra.legalNotes,
                    legalGlossary: extra.legalGlossary,
                    closingText: extra.closingText,
                    inclusions: extra.inclusions, // Load inclusions
                    paymentMethod: extra.paymentMethod,
                    vatRate: (() => {
                        let r = (extra.vatRate !== undefined && extra.vatRate !== null) ? extra.vatRate : 0.22;
                        if (r > 1) r = r / 100; // Normalize 22 -> 0.22
                        return r;
                    })(),
                    printTotals: extra.printTotals, // Restore preference

                    // SYNC STATUS RESTORE
                    driveSyncDate: extra.driveSyncDate,
                    giobbySyncDate: extra.giobbySyncDate,
                    giobbyDocumentId: extra.giobbyDocumentId,
                    prospectSyncDate: extra.prospectSyncDate,

                    reference: extra.reference,
                    excludeFromStats: extra.excludeFromStats,
                    quoteCode: extra.quoteCode, // 4-char alphanumeric identifier
                    pdfSavedDate: extra.pdfSavedDate,

                    // REQUIRED FIELDS (Tipo Lavoro, Materiale, Origine Contatto, Anno Esecuzione)
                    jobType: extra.jobType,
                    material: extra.material,
                    contact: extra.contact,
                    executionYear: q.execution_year || extra.executionYear || (q.date ? q.date.split('-')[0] : '2026')
                };
            });

            // === DIAGNOSTIC LOG: Status Breakdown ===
            const _statusCounts = {};
            let _deletedCount = 0;
            this.data.quotes.forEach(q => {
                if (q.deleted) { _deletedCount++; }
                _statusCounts[q.status || 'NULL'] = (_statusCounts[q.status || 'NULL'] || 0) + 1;
            });
            console.log('[DB DIAGNOSTIC] Quotes loaded from Supabase:', this.data.quotes.length, '| Status breakdown:', _statusCounts, '| Soft-deleted (in trash):', _deletedCount);
            // Extra: also query for deleted quotes separately to detect hard-deleted rows
            supabase.from('quotes').select('id, status, deleted', { count: 'exact' })
                .eq('deleted', true)
                .then(res => {
                    console.log('[DB DIAGNOSTIC] Soft-deleted quotes in DB:', res.count, '| error:', res.error?.message || 'none');
                    if (res.data && res.data.length > 0) {
                        const trashedStatuses = {};
                        res.data.forEach(q => { trashedStatuses[q.status || 'NULL'] = (trashedStatuses[q.status || 'NULL'] || 0) + 1; });
                        console.log('[DB DIAGNOSTIC] Trashed status breakdown:', trashedStatuses);
                    }
                });
            // ========================================

            // 3. FETCH ROLE
            const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single();
            this.role = roleData ? roleData.role : 'agent'; // Default to agent if not found

            this.isAdmin = (this.role === 'admin');

            this.cacheLoaded = true;

            // Save to localStorage cache so next load is instant
            this._saveLocalCache();

            // Migrazione in background: assegna quoteCode ai preventivi che non ce l'hanno
            setTimeout(() => this._migrateQuoteCodes(), 500);

            return true;

        } catch (e) {
            console.error("Supabase Init Error:", e);

            // Fix: Handle JWT Expiration gracefully
            if ((e.message && e.message.includes("JWT expired")) || (e.code === 'PGRST303')) {
                alert("Sessione scaduta. Verrai reindirizzato al login.");
                await supabase.auth.signOut();
                location.reload();
                return false;
            }

            alert("Errore caricamento dati: " + window.localizeError(e));
            return false;
        }
    }

    async checkForUpdates() {
        try {
            const currentVersion = (window.electronAPI && window.electronAPI.version && window.electronAPI.version !== '0.0.0') 
                ? window.electronAPI.version 
                : null;
            const isDesktop = !!(window.electronAPI && window.electronAPI.isDesktop);

            if (isDesktop) {
                if (!currentVersion) {
                    console.warn('[AutoUpdater] Desktop version string is missing or invalid, skipping update check.');
                    return null;
                }
                // ── DESKTOP: controlla GitHub Releases API (sempre aggiornato, indipendente dal file locale) ──
                try {
                    const apiRes = await fetch(
                        'https://api.github.com/repos/movimentimagazzino305-creator/genesy-desktop/releases/latest',
                        { headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'genesy-desktop' } }
                    );
                    if (apiRes.ok) {
                        const release = await apiRes.json();
                        const latestVersion = (release.tag_name || '').replace('v', '');
                        if (latestVersion && this._compareVersions(latestVersion, currentVersion) > 0) {
                            // Trova il file .exe tra gli asset della release
                            const asset = (release.assets || []).find(a => a.name && a.name.endsWith('.exe'));
                            const changelog = (release.body || '')
                                .split('\n')
                                .map(l => l.replace(/^[•\-\*]\s*/, '').trim())
                                .filter(Boolean);
                            return {
                                updateAvailable: true,
                                version: latestVersion,
                                title: release.name || `Genesy Desktop v${latestVersion}`,
                                changelog: changelog.length > 0 ? changelog : [`Versione ${latestVersion} disponibile`],
                                downloadUrl: asset ? asset.browser_download_url : '',
                                isMandatory: false
                            };
                        }
                    }
                } catch (e) {
                    console.warn('[AutoUpdater] GitHub API check failed:', e);
                }
                return null; // Nessun aggiornamento trovato su GitHub
            }

            // ── WEB: controlla tabella Supabase app_updates, poi latest_release.json come fallback ──
            try {
                const { data, error } = await supabase
                    .from('app_updates')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (!error && data && data.length > 0) {
                    const latest = data[0];
                    if (latest && latest.version && this._compareVersions(latest.version, currentVersion) > 0) {
                        return {
                            updateAvailable: true,
                            version: latest.version,
                            title: latest.title || 'Nuovo Aggiornamento Disponibile!',
                            changelog: Array.isArray(latest.changelog) ? latest.changelog : (latest.changelog || '').split('\n').filter(Boolean),
                            downloadUrl: latest.download_url || '',
                            isMandatory: !!latest.is_mandatory
                        };
                    }
                }
            } catch (e) {}

            // Fallback web: latest_release.json locale
            try {
                const res = await fetch('latest_release.json?t=' + Date.now());
                if (res.ok) {
                    const latest = await res.json();
                    if (latest && latest.version && this._compareVersions(latest.version, currentVersion) > 0) {
                        return {
                            updateAvailable: true,
                            version: latest.version,
                            title: latest.title || 'Nuovo Aggiornamento Disponibile!',
                            changelog: Array.isArray(latest.changelog) ? latest.changelog : (latest.changelog || '').split('\n').filter(Boolean),
                            downloadUrl: latest.downloadUrl || '',
                            isMandatory: false
                        };
                    }
                }
            } catch (e) {}

        } catch (e) {
            console.warn('[AutoUpdater] Error checking updates:', e);
        }
        return null;
    }

    _compareVersions(v1, v2) {
        const p1 = String(v1).split('.').map(Number);
        const p2 = String(v2).split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2) return 1;
            if (n1 < n2) return -1;
        }
        return 0;
    }

    // --- ACCESSORS (Compat Helpers) ---
    getAgents() { return this.data.vars.agents || []; }
    getZones() { return this.data.vars.zones || []; }
    getStatuses() { return (this.data.vars.statuses && this.data.vars.statuses.length > 0) ? this.data.vars.statuses : ['Aperto', 'Chiuso', 'Perso']; }
    getCities() { return this.data.vars.cities || []; }
    getZoneAgentMap() { return this.data.zoneAgentMap || {}; }

    getAgentZones(agent) {
        if (!this.data.agentDefaultZones) return [];
        return this.data.agentDefaultZones[agent] || [];
    }

    getAgentByEmail(email) {
        if (!email) return null;

        const normEmail = email.toLowerCase().trim();

        // 1. Search in DB Metadata
        if (this.data.vars.agentsMetadata) {
            const entry = Object.entries(this.data.vars.agentsMetadata).find(([name, meta]) =>
                meta && meta.email && meta.email.toLowerCase().trim() === normEmail
            );
            if (entry) return entry[0];
        }

        // 2. Fallback: Window Master List
        if (window.AGENT_MASTER_LIST) {
            const entry = Object.entries(window.AGENT_MASTER_LIST).find(([name, agent]) =>
                agent && agent.email && agent.email.toLowerCase().trim() === normEmail
            );
            if (entry) return entry[0];
        }

        return null;
    }

    // Helper to get stable user key (email instead of UID)
    _getUserKey() {
        if (!this.user) return 'anon';

        // Use email as key since it's stable across sessions
        // UID can change, but email remains constant
        const email = this.user.email || this.user.user_metadata?.email;
        if (email) {
            // Normalize email to lowercase for consistency
            return email.toLowerCase().trim();
        }

        // Fallback to UID if no email available (shouldn't happen)
        return this.user.id || 'anon';
    }

    // --- CLIENTS ---
    getClients(search = '') {
        let clients = this.data.clients;

        // Se non admin, mostra solo i clienti che hanno preventivi assegnati a questo agente
        if (!this.isAdmin) {
            const agentEmail = this.user ? (this.user.email || this.user.user_metadata?.email || '') : '';
            const agentName = this.getAgentByEmail(agentEmail);
            if (agentName) {
                // Raccoglie gli ID cliente dai preventivi dell'agente
                const agentClientIds = new Set();
                this.data.quotes.forEach(q => {
                    if (q.agent && q.agent === agentName) {
                        const cid = (q.customer && q.customer.id) ? String(q.customer.id) : (q.client_id ? String(q.client_id) : null);
                        if (cid) agentClientIds.add(cid);
                    }
                });
                // Includi ANCHE i clienti il cui campo agent corrisponde all'agente corrente
                // (es. clienti creati di recente senza ancora preventivi associati)
                clients = clients.filter(c =>
                    agentClientIds.has(String(c.id)) || (c.agent && c.agent === agentName)
                );
            } else {
                clients = [];
            }
        }

        if (!search) return clients;
        const s = search.toLowerCase();
        return clients.filter(c => {
            const fullName = `${c.name || ''} ${c.surname || ''}`.toLowerCase();
            return fullName.includes(s) || (c.vat && c.vat.toLowerCase().includes(s));
        });
    }

    async saveClient(client) {
        // Optimistic UI Update
        const isNew = !client.id;
        if (isNew) client.id = 'C-' + Date.now();

        // Save to DB
        // Map camelCase -> snake_case
        const dbClient = {
            ...client,
            id_customer: client.idCustomer,

            // MAPPING FIXES (Camel -> Snake)
            address_province: client.addressProvince,
            agent: client.agent,
            agent: client.agent,
            surname: client.surname, // Explicitly map surname
            created_at: client.createdAt // Map createdAt to created_at

            // site_address: client.siteAddress, // Missing in DB
            // site_address_province: client.siteAddressProvince, // Missing in DB
            // contact_person: client.contactPerson // Column missing in DB schema
        };

        // --- SIDECAR SAVE (Extended for ALL fields) ---
        // Fetch latest config to reduce overwrite risks (Concurrency Best Effort)
        const { data: latestConfig } = await supabase.from('app_config').select('value').eq('key', 'client_extras').single();
        const currentExtras = latestConfig?.value || {};

        const extraData = {
            // Previously missing columns
            siteAddress: client.siteAddress,
            siteAddressProvince: client.siteAddressProvince,
            contactPerson: client.contactPerson,

            // Extended fields to guarantee persistence for all users
            pec: client.pec,
            mobile: client.mobile,
            fax: client.fax,
            phone_office: client.phone_office,
            phone_home: client.phone_home,
            sdi: client.sdi,
            language: client.language,
            sector: client.sector,
            origin: client.origin,
            printPrefs: client.printPrefs,
            idCustomer: client.idCustomer,
            giobbyContactId: client.giobbyContactId,
            giobbyCustomerId: client.giobbyCustomerId,
            agentGiobbyId: client.agentGiobbyId,
            createdAt: client.createdAt, // Also save in extras for completeness
            type: client.type
        };

        // Update local and remote
        currentExtras[client.id] = extraData;
        this.data.clientExtras = currentExtras;

        await supabase.from('app_config').upsert({
            key: 'client_extras',
            value: currentExtras
        });
        // --------------------

        // REMOVE fields that don't exist in DB schema to avoid "column not found" error
        delete dbClient.idCustomer;
        delete dbClient.contactPerson;
        delete dbClient.siteAddress;
        delete dbClient.siteAddressProvince;
        delete dbClient.createdAt; // Already mapped to created_at
        delete dbClient.printPrefs; // Not in DB schema, stored in extras
        delete dbClient.type; // Not in DB schema
        delete dbClient.phone; // Backward compatibility field, not in DB
        delete dbClient.province;
        delete dbClient.agentGiobbyId;    // Stored in client_extras, not in clients table
        delete dbClient.giobbyContactId;  // Stored in client_extras, not in clients table
        delete dbClient.giobbyCustomerId; // Stored in client_extras, not in clients table
        delete dbClient.fts;              // Generated column (full-text search) — Supabase populates automatically

        const { error } = await supabase.from('clients').upsert(dbClient);
        if (error) { console.error(error); throw error; }

        // Update Cache
        const idx = this.data.clients.findIndex(c => c.id == client.id);
        if (idx !== -1) this.data.clients[idx] = client;
        else this.data.clients.push(client);
    }

    async deleteClient(id) {
        await supabase.from('clients').delete().eq('id', id);
        this.data.clients = this.data.clients.filter(c => c.id != id);
    }

    // --- PRODUCTS ---
    getProducts(search = '') {
        let activeProducts = this.data.products.filter(p => !p.deleted);
        if (!search) return activeProducts;
        const s = search.toLowerCase();
        return activeProducts.filter(p =>
            p.code.toLowerCase().includes(s) || p.description.toLowerCase().includes(s)
        );
    }

    async saveProduct(product) {
        if (!product.id) product.id = 'P-' + Date.now();

        // Handle variants if using specific columns? No, we used generic `variants` jsonb col in schema
        // Ensure we map back and forth if needed. For now schema has `variants` column.
        // product object here is flat: var1, var2... 

        // Transform for DB if we want clean separation, OR just dump everything.
        // Schema has explicit columns for basic info + variants jsonb.
        // Let's just save the object as is, Supabase ignores extra fields if not in table, 
        // BUT we need to make sure variants go into the JSON col.

        const dbProduct = {
            id: product.id,
            code: product.code,
            category: product.category,
            description: product.description,
            uom: product.uom,
            price_min: product.priceMin,
            price_max: product.priceMax,
            classe: product.classe || null,
            variants: {
                var1: product.var1 || '',
                var2: product.var2 || '',
                var3: product.var3 || '',
                essenza: product.essenza || '',
                tipo: product.tipo || '',
                giobby_code: product.giobby_code || '',
                giobby_description: product.giobby_description || ''  // Descrizione dal catalogo Giobby
            }
        };

        const { error } = await supabase.from('products').upsert(dbProduct);
        if (error) { console.error(error); throw error; }

        // Cache: Keep the flat version used by App
        const idx = this.data.products.findIndex(p => p.id == product.id);
        if (idx !== -1) this.data.products[idx] = product;
        else this.data.products.push(product);

        this.syncCategories();
    }

    async deleteProduct(id) {
        await supabase.from('products').delete().eq('id', id);
        this.data.products = this.data.products.filter(p => p.id != id);
    }

    // --- QUOTES ---
    _getAgentNameForCurrentUser() {
        if (!this.user) return null;
        const agentEmail = this.user.email || this.user.user_metadata?.email || '';
        return this.getAgentByEmail(agentEmail) || null;
    }

    getAllQuotes() {
        // Filter out deleted quotes (soft delete)
        let quotes = this.data.quotes.filter(q => !q.deleted && q.status !== 'Deleted');
        // If not admin, show only this agent's quotes
        if (!this.isAdmin) {
            const agentName = this._getAgentNameForCurrentUser();
            if (agentName) {
                quotes = quotes.filter(q => q.agent && q.agent === agentName);
            } else {
                quotes = [];
            }
        }
        return quotes;
    }

    getQuote(id) {
        return this.data.quotes.find(q => q.id == id);
    }

    async saveQuote(quote) {
        const isNew = !quote.id;
        if (isNew) {
            quote.id = 'Q-' + Date.now(); // Temp ID, DB creates real one? No, we use text ID in schema
            quote.createdAt = new Date().toISOString();
        }


        const activeUser = this.user;

        // DEBUG: Log date before saving

        // Prepare for DB
        const dbQuote = {
            id: quote.id,
            date: quote.date,
            status: quote.status,
            total: quote.total,

            client_id: quote.customer ? quote.customer.id : null,

            owner_id: isNew ? (activeUser ? activeUser.id : 'anon') : (quote.owner_id !== undefined ? quote.owner_id : (activeUser ? activeUser.id : 'anon')),
            agent: quote.agent,

            zone: quote.zone,

            items_json: quote.items,
            customer_snapshot_json: quote.customer,

            notes: quote.notes,
            internal_notes: quote.internalNotes // camelCase to snake_case mapping happens here if manual
            // Actually my schema has `internal_notes`. Supabase JS client maps? No.
            // I must map explicitly.
        };
        // Explicit Map for SQL columns
        const payload = {
            id: dbQuote.id,
            date: dbQuote.date,
            status: dbQuote.status,
            total: dbQuote.total,
            client_id: dbQuote.client_id,
            owner_id: dbQuote.owner_id,
            agent: dbQuote.agent,
            zone: dbQuote.zone,
            items_json: dbQuote.items_json,
            customer_snapshot_json: dbQuote.customer_snapshot_json,
            notes: dbQuote.notes,
            internal_notes: quote.internalNotes,

            // New Fields
            delivery_date: quote.deliveryDate || null,
            delivery_completed: quote.deliveryCompleted || false,

            // EXTRA FIELDS (Sidebar, Bank, Legal, etc.)
            extra_fields: {
                bank: quote.bank,
                warehouse: quote.warehouse,
                deliveryAddress: quote.deliveryAddress,
                siteAddress: quote.siteAddress,
                siteCity: quote.siteCity,
                siteZip: quote.siteZip,
                siteProvince: quote.siteProvince,
                siteContactName: quote.siteContactName,
                siteContactReference: quote.siteContactReference,
                siteContactRole: quote.siteContactRole,
                siteContactPhone: quote.siteContactPhone,
                siteSignboard: quote.siteSignboard,
                legalNotes: quote.legalNotes,
                legalGlossary: quote.legalGlossary,
                closingText: quote.closingText,
                inclusions: quote.inclusions, // Restore inclusions
                paymentMethod: quote.paymentMethod,
                vatRate: quote.vatRate,
                printTotals: quote.printTotals,

                // SYNC STATUS FIELDS
                driveSyncDate: quote.driveSyncDate,
                giobbySyncDate: quote.giobbySyncDate,
                giobbyDocumentId: quote.giobbyDocumentId,
                prospectSyncDate: quote.prospectSyncDate,

                // MISC
                reference: quote.reference,
                excludeFromStats: quote.excludeFromStats,
                quoteCode: quote.quoteCode, // 4-char alphanumeric identifier
                pdfSavedDate: quote.pdfSavedDate,

                // REQUIRED FIELDS (Tipo Lavoro, Materiale, Origine Contatto, Anno Esecuzione)
                jobType: quote.jobType,
                material: quote.material,
                contact: quote.contact,
                executionYear: quote.executionYear
            }
            // number is auto-generated
        };

        if (isNew) payload.created_at = quote.createdAt;

        const { data, error } = await supabase.from('quotes').upsert(payload).select();

        if (error) { console.error(error); throw error; }

        // Update Cache 
        // If it was new, we might want the generated 'number' back from DB
        const saved = data[0];
        if (saved && saved.number) {
            quote.number = saved.number; // Fix for UI display
            quote.friendlyId = saved.number.toString();
        }

        const idx = this.data.quotes.findIndex(q => q.id == quote.id);
        if (idx !== -1) this.data.quotes[idx] = quote;
        else this.data.quotes.unshift(quote);

        // Keep localStorage cache in sync so next page load has up-to-date data
        this._saveLocalCache();

        return quote.id;

    }

    async deleteQuote(id) {
        // SOFT DELETE: Mark as deleted instead of removing from database
        const now = new Date().toISOString();

        const { error } = await supabase
            .from('quotes')
            .update({
                deleted: true,
                deleted_at: now
            })
            .eq('id', id);

        if (error) {
            console.error('Delete quote error:', error);
            throw error;
        }

        // Update local cache
        const quote = this.data.quotes.find(q => q.id == id);
        if (quote) {
            quote.deleted = true;
            quote.deleted_at = now;
        }
    }

    async refreshQuotes() {
        try {
            // Fetch ALL Quotes (Parallel to init logic)
            const { data, error } = await supabase.from('quotes').select('*').order('date', { ascending: false }).limit(10000);
            if (error) throw error;

            // MAP (Logic duplicated from init to ensure consistency)
            this.data.quotes = data.map(q => {
                const items = q.items_json || [];
                const customer = q.customer_snapshot_json || {};
                const friendlyId = q.number ? q.number.toString() : q.id.substr(0, 8);
                const extra = q.extra_fields || {};

                return {
                    ...q,
                    items: items,
                    customer: customer,
                    friendlyId: friendlyId,
                    internalNotes: q.internal_notes,
                    deliveryDate: q.delivery_date,
                    deliveryCompleted: q.delivery_completed,

                    // Unpack Extra Fields
                    bank: extra.bank,
                    warehouse: extra.warehouse,
                    deliveryAddress: extra.deliveryAddress,
                    siteAddress: extra.siteAddress,
                    siteCity: extra.siteCity,
                    siteZip: extra.siteZip,
                    siteProvince: extra.siteProvince,
                    siteContactName: extra.siteContactName,
                    siteContactReference: extra.siteContactReference,
                    siteContactRole: extra.siteContactRole,
                    siteContactPhone: extra.siteContactPhone,
                    siteSignboard: extra.siteSignboard,
                    legalNotes: extra.legalNotes,
                    legalGlossary: extra.legalGlossary,
                    closingText: extra.closingText,
                    inclusions: extra.inclusions,
                    paymentMethod: extra.paymentMethod,
                    vatRate: (() => {
                        let r = (extra.vatRate !== undefined && extra.vatRate !== null) ? extra.vatRate : 0.22;
                        if (r > 1) r = r / 100;
                        return r;
                    })(),
                    printTotals: extra.printTotals,

                    // SYNC STATUS
                    driveSyncDate: extra.driveSyncDate,
                    giobbySyncDate: extra.giobbySyncDate,
                    giobbyDocumentId: extra.giobbyDocumentId,
                    prospectSyncDate: extra.prospectSyncDate,
                    reference: extra.reference,
                    excludeFromStats: extra.excludeFromStats,
                    quoteCode: extra.quoteCode, // 4-char alphanumeric identifier
                    pdfSavedDate: extra.pdfSavedDate,

                    // REQUIRED FIELDS (Tipo Lavoro, Materiale, Origine Contatto)
                    jobType: extra.jobType,
                    material: extra.material,
                    contact: extra.contact
                };
            });
            return true;
        } catch (e) {
            console.error("Refresh Quotes Error:", e);
            throw e;
        }
    }

    // Get deleted quotes (trash bin)
    getDeletedQuotes() {
        let quotes = this.data.quotes.filter(q => q.deleted === true);
        // If not admin, show only this agent's deleted quotes
        if (!this.isAdmin) {
            const agentName = this._getAgentNameForCurrentUser();
            if (agentName) {
                quotes = quotes.filter(q => q.agent && q.agent === agentName);
            } else {
                quotes = [];
            }
        }
        return quotes;
    }

    // Restore a deleted quote
    async restoreQuote(id) {
        const { error } = await supabase
            .from('quotes')
            .update({
                deleted: false,
                deleted_at: null
            })
            .eq('id', id);

        if (error) {
            console.error('Restore quote error:', error);
            throw error;
        }

        // Update local cache
        const quote = this.data.quotes.find(q => q.id == id);
        if (quote) {
            quote.deleted = false;
            quote.deleted_at = null;
        }
    }

    // Permanently delete a quote (cannot be recovered)
    async permanentDeleteQuote(id) {
        const { error } = await supabase.from('quotes').delete().eq('id', id);
        if (error) {
            console.error('Permanent delete error:', error);
            throw error;
        }

        // Remove from cache
        this.data.quotes = this.data.quotes.filter(q => q.id != id);
    }

    // --- MIGRAZIONE QUOTE CODES ---
    async _migrateQuoteCodes() {
        try {
            const missing = this.data.quotes.filter(q => !q.deleted && !q.quoteCode);
            if (missing.length === 0) return;
            console.log(`[QuoteCode Migration] ${missing.length} preventivi senza codice — assegno ora...`);

            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            const nums = '0123456789';
            const usedCodes = new Set(this.data.quotes.map(q => q.quoteCode).filter(Boolean));

            const genCode = () => {
                let code, attempts = 0;
                do {
                    code = chars[Math.floor(Math.random() * chars.length)]
                        + nums[Math.floor(Math.random() * nums.length)]
                        + chars[Math.floor(Math.random() * chars.length)]
                        + chars[Math.floor(Math.random() * chars.length)];
                    attempts++;
                } while (usedCodes.has(code) && attempts < 1000);
                usedCodes.add(code);
                return code;
            };

            // Aggiorna in batch da 10
            const BATCH = 10;
            for (let i = 0; i < missing.length; i += BATCH) {
                const batch = missing.slice(i, i + BATCH);
                await Promise.all(batch.map(async q => {
                    const code = genCode();
                    q.quoteCode = code; // Aggiorna cache locale immediatamente

                    // Leggi i extra_fields esistenti per non sovrascriverli
                    const { data: row } = await supabase.from('quotes').select('extra_fields').eq('id', q.id).single();
                    const extra = (row && row.extra_fields) ? row.extra_fields : {};
                    extra.quoteCode = code;

                    const { error } = await supabase.from('quotes').update({ extra_fields: extra }).eq('id', q.id);
                    if (error) console.error('[QuoteCode Migration] Errore su', q.id, error);
                    else console.log('[QuoteCode Migration] Assegnato', code, 'a', q.id);
                }));
            }

            console.log('[QuoteCode Migration] Completata.');
            // Aggiorna la tabella preventivi se visibile
            if (typeof renderQuotesTable === 'function') renderQuotesTable();
        } catch (e) {
            console.error('[QuoteCode Migration] Errore generale:', e);
        }
    }

    // --- STATS & VARS ---
    async updateVarList(key, list) {
        this.data.vars[key] = list;
        // Upsert vars config
        const { error } = await supabase.from('app_config').upsert({
            key: 'vars',
            value: this.data.vars
        });
    }

    async setZoneAgent(zone, agent) {
        this.data.zoneAgentMap[zone] = agent;
        await supabase.from('app_config').upsert({ key: 'zoneAgentMap', value: this.data.zoneAgentMap });
    }

    async setAgentZones(agent, zones) {
        if (!this.data.agentDefaultZones) this.data.agentDefaultZones = {};
        this.data.agentDefaultZones[agent] = zones;
        await supabase.from('app_config').upsert({ key: 'agentDefaultZones', value: this.data.agentDefaultZones });
    }

    async syncCategories() {
        const products = this.getProducts();
        if (!products.length) return;
        const currentCats = this.data.vars.categories || [];
        const productCats = new Set(products.map(p => p.category).filter(c => c));
        let hasNew = false;
        productCats.forEach(cat => {
            if (!currentCats.includes(cat)) {
                currentCats.push(cat);
                hasNew = true;
            }
        });
        if (hasNew) {
            currentCats.sort();
            await this.updateVarList('categories', currentCats);
        }
    }

    // --- COMPATIBILITY MISSING METHODS ---
    getProductVars() { return this.data.vars; }

    async saveProductVars(vars) {
        // Persiste l'intero oggetto vars (incluso agentsMetadata) su Supabase
        this.data.vars = vars;
        const { error } = await supabase.from('app_config').upsert({
            key: 'vars',
            value: vars
        });
        if (error) { console.error('saveProductVars error:', error); throw error; }
    }

    getAdditionalWorks() {
        // Initialize cache if missing
        if (!this.extraWorksCache) this.extraWorksCache = {};

        // Use email as stable identifier instead of UID
        const userKey = this._getUserKey();

        // ADMIN VIEW: See ALL lists merged
        if (this.isAdmin) {
            const allLists = Object.values(this.extraWorksCache);
            // Deduplicate correctly based on description + price
            const uniqueMap = new Map();
            allLists.flat().forEach(w => {
                if (w && w.description) {
                    const key = w.description.toLowerCase().trim() + '_' + w.price;
                    if (!uniqueMap.has(key)) uniqueMap.set(key, w);
                }
            });
            // Sort alphabetically by description
            return Array.from(uniqueMap.values()).sort((a, b) => a.description.localeCompare(b.description));
        }

        // USER VIEW: See only OWN list
        return this.extraWorksCache[userKey] || [];
    }

    async _saveUserExtraWorks(userKey, list) {
        this.extraWorksCache[userKey] = list;
        const key = `extra_works_${userKey}`;

        // Persist to separate config row
        const { error } = await supabase.from('app_config').upsert({
            key: key,
            value: list
        });

        if (error) {
            console.error('Error saving extra works:', error);
            throw error;
        }
    }

    async saveAdditionalWork(work) {
        const userKey = this._getUserKey();

        if (!this.extraWorksCache) this.extraWorksCache = {};

        let list = this.extraWorksCache[userKey] || [];
        list.push(work);

        await this._saveUserExtraWorks(userKey, list);
    }

    async updateAdditionalWork(index, work) {
        const currentList = this.getAdditionalWorks(); // Get the view user is seeing
        const oldWork = currentList[index];
        if (!oldWork) return;

        // Strategy: Find where 'oldWork' came from and update it
        // If Admin, it could be in any list.
        for (const [uid, list] of Object.entries(this.extraWorksCache)) {
            const idx = list.findIndex(w => w.description === oldWork.description && w.price === oldWork.price);
            if (idx !== -1) {
                list[idx] = work; // Update in place
                await this._saveUserExtraWorks(uid, list);
                return; // Stop after first match (assume uniqueness or first win)
            }
        }
    }

    async deleteAdditionalWork(index) {
        const currentList = this.getAdditionalWorks();
        const workToDelete = currentList[index];

        if (!workToDelete) return;

        for (const [uid, list] of Object.entries(this.extraWorksCache)) {
            const idx = list.findIndex(w => w.description === workToDelete.description && w.price === workToDelete.price);
            if (idx !== -1) {
                list.splice(idx, 1); // Remove
                await this._saveUserExtraWorks(uid, list);
            }
        }
    }

    async saveProductsBulk(products) {
        const { error } = await supabase.from('products').upsert(products);
        if (error) console.error("Bulk Save Error", error);
        // Refresh cache
        products.forEach(p => {
            const idx = this.data.products.findIndex(existing => existing.id == p.id);
            if (idx !== -1) this.data.products[idx] = p;
            else this.data.products.push(p);
        });
    }

    async deleteProduct(id) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        // Update local cache
        this.data.products = this.data.products.filter(p => p.id != id);
    }

    // --- BULK OPERATIONS ---

    /**
     * Elimina tutti i prodotti di una o più categorie da Supabase e dalla cache.
     * @param {string[]} categories - Array di nomi categoria da eliminare
     */
    async deleteProductsByCategory(categories) {
        if (!categories || categories.length === 0) return;
        const { error } = await supabase.from('products').delete().in('category', categories);
        if (error) { console.error('deleteProductsByCategory error:', error); throw error; }
        this.data.products = this.data.products.filter(p => !categories.includes(p.category));
        console.log(`[BulkOps] Eliminati prodotti delle categorie: ${categories.join(', ')}`);
    }

    /**
     * Elimina TUTTI i prodotti da Supabase e dalla cache.
     */
    async deleteAllProducts() {
        const { error } = await supabase.from('products').delete().neq('id', '___NEVER___');
        if (error) { console.error('deleteAllProducts error:', error); throw error; }
        this.data.products = [];
        console.log('[BulkOps] Eliminati tutti i prodotti.');
    }

    /**
     * Applica una variazione percentuale ai prezzi di un sottoinsieme di prodotti.
     * @param {string|null} categoryFilter - Categoria da filtrare (null = tutti)
     * @param {'priceMin'|'priceMax'|'both'} fieldTarget - Campo prezzo da modificare
     * @param {number} percentage - Variazione % (es. +10 = +10%, -5 = -5%)
     * @returns {Promise<number>} Numero di prodotti aggiornati
     */
    async bulkUpdatePrices(categoryFilter, fieldTarget, percentage) {
        const factor = 1 + (percentage / 100);
        const round2 = v => Math.round((v || 0) * factor * 100) / 100;

        let products = this.data.products.filter(p => !p.deleted);
        if (categoryFilter) products = products.filter(p => p.category === categoryFilter);
        if (products.length === 0) return 0;

        const updatedProducts = products.map(p => {
            const updated = { ...p };
            if (fieldTarget === 'priceMin' || fieldTarget === 'both') {
                if (p.priceMin != null && p.priceMin !== '') updated.priceMin = round2(p.priceMin);
            }
            if (fieldTarget === 'priceMax' || fieldTarget === 'both') {
                if (p.priceMax != null && p.priceMax !== '') updated.priceMax = round2(p.priceMax);
            }
            return updated;
        });

        // Salva su Supabase in batch (usa saveProduct per gestire correttamente la mappatura DB)
        const BATCH_SIZE = 50;
        for (let i = 0; i < updatedProducts.length; i += BATCH_SIZE) {
            const batch = updatedProducts.slice(i, i + BATCH_SIZE);
            const dbBatch = batch.map(p => ({
                id: p.id,
                code: p.code,
                category: p.category,
                description: p.description,
                uom: p.uom,
                price_min: p.priceMin,
                price_max: p.priceMax,
                classe: p.classe || null,
                variants: {
                    var1: p.var1 || '',
                    var2: p.var2 || '',
                    var3: p.var3 || '',
                    essenza: p.essenza || '',
                    tipo: p.tipo || '',
                    giobby_code: p.giobby_code || '',
                    giobby_description: p.giobby_description || ''
                }
            }));
            const { error } = await supabase.from('products').upsert(dbBatch);
            if (error) { console.error('bulkUpdatePrices batch error:', error); throw error; }
        }

        // Aggiorna cache locale
        updatedProducts.forEach(up => {
            const idx = this.data.products.findIndex(p => p.id === up.id);
            if (idx !== -1) this.data.products[idx] = up;
        });

        console.log(`[BulkOps] Aggiornati ${updatedProducts.length} prodotti (${percentage > 0 ? '+' : ''}${percentage}% su ${fieldTarget}).`);
        return updatedProducts.length;
    }

    // --- COPIED HELPERS FROM OLD DATA.JS (Logic Unchanged, just runs on local cache) ---
    // These rely on access to this.data.quotes, which we populated in init().

    getKPIs(start, end) { return this._calcStats(start, end).kpis; }

    _calcStats(start = null, end = null) {
        let quotes = this._getFilteredQuotes(start, end);
        let total = 0, count = quotes.length, closed = 0, open = 0;
        quotes.forEach(q => {
            let val = parseFloat(q.total) || 0;
            total += val;
            if (['Chiuso', 'Ordine Confermato'].includes(q.status)) closed++;
            else open++;
        });
        return { kpis: { total, count, open, conversion: count > 0 ? Math.round((closed / count) * 100) : 0 } };
    }

    _getFilteredQuotes(start = null, end = null) {
        let quotes = this.getAllQuotes().filter(q => !q.excludeFromStats);
        const getYMD = (d) => {
            if (!d) return '';
            if (typeof d === 'string') return d.substring(0, 10);
            try { return new Date(d).toISOString().substring(0, 10); } catch (e) { return ''; }
        };
        if (start) quotes = quotes.filter(q => getYMD(q.date || q.createdAt) >= start);
        if (end) quotes = quotes.filter(q => getYMD(q.date || q.createdAt) <= end);
        return quotes;
    }

    getMonthlyTrend(start, end) {
        const map = {};
        this._getFilteredQuotes(start, end).forEach(q => {
            const date = new Date(q.date || q.createdAt);
            const key = `${date.getMonth() + 1}/${date.getFullYear()}`;
            map[key] = (map[key] || 0) + (parseFloat(q.total) || 0);
        });
        return Object.entries(map).sort((a, b) => {
            const [m1, y1] = a[0].split('/').map(Number);
            const [m2, y2] = b[0].split('/').map(Number);
            return y1 - y2 || m1 - m2;
        }).map(([name, value]) => ({ name, value }));
    }

    getMonthlyStatusTrend(start, end, agent = null) {
        const map = {};
        let quotes = this._getFilteredQuotes(start, end);
        if (agent) quotes = quotes.filter(q => q.agent === agent);
        quotes.forEach(q => {
            const date = new Date(q.date || q.createdAt);
            const key = `${date.getMonth() + 1}/${date.getFullYear()}`; // M/YYYY

            if (!map[key]) map[key] = { Aperto: 0, Chiuso: 0, Perso: 0, total: 0 };

            const val = parseFloat(q.total) || 0;
            const status = q.status;

            if (['Ordine Confermato', 'Chiuso'].includes(status)) {
                map[key].Chiuso += val;
            } else if (['Perso', 'Rifiutato'].includes(status)) {
                map[key].Perso += val;
            } else {
                map[key].Aperto += val;
            }
            map[key].total += val;
        });

        // Sort chrono
        return Object.entries(map).sort((a, b) => {
            const [m1, y1] = a[0].split('/').map(Number);
            const [m2, y2] = b[0].split('/').map(Number);
            return y1 - y2 || m1 - m2;
        }).map(([name, data]) => ({ name, ...data }));
    }

    getMonthlyStatusCountTrend(start, end, agent = null) {
        const map = {};
        let quotes = this._getFilteredQuotes(start, end);
        if (agent) quotes = quotes.filter(q => q.agent === agent);
        quotes.forEach(q => {
            const date = new Date(q.date || q.createdAt);
            const key = `${date.getMonth() + 1}/${date.getFullYear()}`; // M/YYYY

            if (!map[key]) map[key] = { Aperto: 0, Chiuso: 0, Perso: 0, total: 0 };

            const status = q.status;

            if (['Ordine Confermato', 'Chiuso'].includes(status)) {
                map[key].Chiuso++;
            } else if (['Perso', 'Rifiutato'].includes(status)) {
                map[key].Perso++;
            } else {
                map[key].Aperto++;
            }
            map[key].total++;
        });

        // Sort chrono
        return Object.entries(map).sort((a, b) => {
            const [m1, y1] = a[0].split('/').map(Number);
            const [m2, y2] = b[0].split('/').map(Number);
            return y1 - y2 || m1 - m2;
        }).map(([name, data]) => ({ name, ...data }));
    }

    getQuotesByStatus(start, end) {
        const map = {};
        this._getFilteredQuotes(start, end).forEach(q => {
            const s = q.status || 'Aperto';
            if (!map[s]) map[s] = { count: 0, value: 0 };
            map[s].count++;
            map[s].value += (parseFloat(q.total) || 0);
        });
        return Object.entries(map).map(([name, data]) => ({ name, value: data.count, total: data.value }));
    }

    getTopProductsQuoted(start, end) {
        const map = {};
        this._getFilteredQuotes(start, end).forEach(q => {
            if (q.items) q.items.forEach(i => {
                if (i.includeInStats === false) return;
                const name = i.description || 'N/D';
                const val = parseFloat(i.total) || 0;
                const qty = parseFloat(i.quantity) || 1;
                if (!map[name]) map[name] = { value: 0, qty: 0 };
                map[name].value += val;
                map[name].qty += qty;
            });
        });
        return Object.keys(map).map(k => ({ name: k, value: map[k].value, qty: map[k].qty })).sort((a, b) => b.value - a.value).slice(0, 10);
    }

    getTopProductsSold(start, end) {
        const map = {};
        this._getFilteredQuotes(start, end).forEach(q => {
            if (!['Chiuso', 'Ordine Confermato'].includes(q.status)) return;
            if (q.items) q.items.forEach(i => {
                if (i.includeInStats === false) return;
                const name = i.description || 'N/D';
                const val = parseFloat(i.total) || 0;
                const qty = parseFloat(i.quantity) || 1;
                if (!map[name]) map[name] = { value: 0, qty: 0 };
                map[name].value += val;
                map[name].qty += qty;
            });
        });
        return Object.keys(map).map(k => ({ name: k, value: map[k].value, qty: map[k].qty })).sort((a, b) => b.value - a.value).slice(0, 10);
    }

    getTopProductsLost(start, end) {
        const map = {};
        this._getFilteredQuotes(start, end).forEach(q => {
            if (!['Perso', 'Rifiutato'].includes(q.status)) return;
            if (q.items) q.items.forEach(i => {
                if (i.includeInStats === false) return;
                const name = i.description || 'N/D';
                const val = parseFloat(i.total) || 0;
                const qty = parseFloat(i.quantity) || 1;
                if (!map[name]) map[name] = { value: 0, qty: 0 };
                map[name].value += val;
                map[name].qty += qty;
            });
        });
        return Object.keys(map).map(k => ({ name: k, value: map[k].value, qty: map[k].qty })).sort((a, b) => b.value - a.value).slice(0, 10);
    }

    getTopClients(start, end) {
        const map = {};
        this._getFilteredQuotes(start, end).forEach(q => {
            // if (!['Chiuso', 'Ordine Confermato'].includes(q.status)) return; // Removed to show Preventivato (All)
            const client = q.customer ? q.customer.name : 'Sconosciuto';
            const val = q.items.reduce((acc, i) => acc + (i.total || 0), 0);
            map[client] = (map[client] || 0) + val;
        });
        return Object.keys(map).map(client => ({ name: client, value: map[client] })).sort((a, b) => b.value - a.value).slice(0, 5);
    }

    getConversionByAgent(start, end) {
        const stats = {};
        const allowedAgents = this.getAgents();
        this._getFilteredQuotes(start, end).forEach(q => {
            if (!q.agent) return;
            if (!allowedAgents.includes(q.agent)) return;
            if (!stats[q.agent]) stats[q.agent] = { closed: 0, total: 0 };
            stats[q.agent].total++;
            if (['Chiuso', 'Ordine Confermato'].includes(q.status)) stats[q.agent].closed++;
        });
        return Object.entries(stats).map(([k, v]) => ({ name: k, value: v.total > 0 ? Math.round((v.closed / v.total) * 100) : 0 })).sort((a, b) => b.value - a.value);
    }

    getTurnoverByZone(start, end) {
        const map = {};
        this._getFilteredQuotes(start, end).forEach(q => {
            // if (!['Chiuso', 'Ordine Confermato'].includes(q.status)) return; // Removed to show Preventivato (All)
            if (q.zone) {
                let z = q.zone.trim().toUpperCase();
                z = z.replace(/Ì/g, 'I')
                     .replace(/[ÈÉ]/g, 'E')
                     .replace(/Ò/g, 'O')
                     .replace(/À/g, 'A')
                     .replace(/Ù/g, 'U');
                map[z] = (map[z] || 0) + (parseFloat(q.total) || 0);
            }
        });
        return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }

    // --- ADMIN USER MANAGEMENT ---
    async getAllUsers() {
        // Query public user_roles view
        const { data, error } = await supabase.from('user_roles').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        // Map to expected format
        return data.map(u => ({
            id: u.user_id,
            email: u.email || 'N/D',
            role: u.role,
            disabled: u.disabled,
            lastLogin: u.last_login // May be null if not tracked yet
        }));
    }

    async toggleUserRole(uid, currentRole) {
        const newRole = currentRole === 'admin' ? 'agent' : 'admin';
        const { error } = await supabase.from('user_roles').update({ role: newRole }).eq('user_id', uid);
        if (error) throw error;
    }

    async toggleUserStatus(uid, currentDisabled) {
        const newStatus = !currentDisabled;
        const { error } = await supabase.from('user_roles').update({ disabled: newStatus }).eq('user_id', uid);
        if (error) throw error;
    }

    async deleteUser(uid) {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', uid);
        if (error) throw error;
    }

    getSettings() {
        return this.data.settings || {};
    }

    // --- GIOBBY CREDENTIALS MANAGEMENT ---
    getGiobbyConfigDB(isBO = false) {
        const key = isBO ? 'giobby_config_bo' : 'giobby_config';
        const cfg = this.data[key] || null;
        if (cfg) {
            if (cfg.instanceId === '00553') cfg.instanceId = '00554';
            if (cfg.giobbyInstanceId === '00553' || cfg.giobbyInstanceId === 'Giobby00553') cfg.giobbyInstanceId = 'Giobby00554';
            if (typeof cfg.apiUrl === 'string' && cfg.apiUrl.includes('00553')) {
                cfg.apiUrl = cfg.apiUrl.replace(/00553/g, '00554');
            }
        }
        return cfg;
    }

    async saveGiobbyConfigDB(config, isBO = false) {
        const key = isBO ? 'giobby_config_bo' : 'giobby_config';
        this.data[key] = config; // Update local memory

        try {
            const { error } = await supabase.from('app_config').upsert({
                key: key,
                value: config
            });
            if (error) throw error;
            console.log(`[Supabase] Saved Giobby credentials to app_config (${key})`);
            return true;
        } catch (e) {
            console.error(`[Supabase] Failed to save Giobby credentials (${key}):`, e);
            return false;
        }
    }
}

// Global Instance
const db = new DataService();
window.db = db; // Expose globally so external modules (products-excel.js, giobby-product-sync.js, etc.) can access it reliably
