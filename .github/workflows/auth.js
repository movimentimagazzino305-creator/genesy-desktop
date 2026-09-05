/**
 * Genesy - Authentication Logic
 * Handles Login, Register, Logout and Session Management.
 * Includes: Credential Manager with XOR encryption (device-local key).
 */

let currentUser = null;

// Proactive localStorage cleanup to prevent QuotaExceededError (Whitelist-based)
try {
    const whitelist = [
        'genesy_credentials',
        'genesy_enc_k',
        'giobbyConfig',
        'giobbyAgentMappings',
        'googleWebAppUrl',
        'crm_drive_folder_url',
        'crm_email_provider',
        'keliweb_webmail_url',
        'agentManualOverride_v1',
        'preventivi_components_config',
        'sopralluoghi_voice_uri',
        'weatherLocationName',
        'weatherLat',
        'weatherLon',
        'gmail_oauth_client_id',
        'sopralluoghi_bozza_v1',
        'genesy_loaded_version',
        'debugMode',
        'header_text'
    ];

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        // Keep Supabase auth keys
        if (key.startsWith('sb-')) continue;
        
        // Keep CRM notes
        if (key.startsWith('crm_notes_')) continue;

        // Keep Giobby email aliases and exclusions
        if (key.startsWith('giobby_em_alias_') || key.startsWith('giobby_em_exclude_')) continue;

        // If not in whitelist, mark for removal
        if (!whitelist.includes(key)) {
            keysToRemove.push(key);
        }
    }
    if (keysToRemove.length > 0) {
        console.log("[Cache Cleanup] Removing non-whitelisted keys to free space:", keysToRemove);
        keysToRemove.forEach(k => localStorage.removeItem(k));
    }
} catch (e) {
    console.warn("[Cache Cleanup] Failed to run proactive cleanup:", e);
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
//  CREDENTIAL MANAGER Ã¢â‚¬â€ Gestione Credenziali Locali
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

const CRED_KEY       = 'genesy_credentials';  // Array di {email, enc}
const CRED_ENC_KEY   = 'genesy_enc_k';        // Chiave XOR (random, device-specific)

/** Genera o recupera la chiave XOR device-specific */
function getEncKey() {
    let stored = localStorage.getItem(CRED_ENC_KEY);
    if (!stored) {
        // Genera 64 byte casuali Ã¢â€ â€™ salva come base64
        const raw = Array.from(crypto.getRandomValues(new Uint8Array(64)));
        stored = btoa(raw.map(b => String.fromCharCode(b)).join(''));
        localStorage.setItem(CRED_ENC_KEY, stored);
    }
    return atob(stored);
}

/** XOR encrypt/decrypt symmetric */
function xorCrypt(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
}

function encryptPassword(pwd) {
    try { return btoa(xorCrypt(pwd, getEncKey())); }
    catch { return ''; }
}

function decryptPassword(enc) {
    try { return xorCrypt(atob(enc), getEncKey()); }
    catch { return ''; }
}

/** Carica tutte le credenziali salvate */
function getCredentials() {
    try { return JSON.parse(localStorage.getItem(CRED_KEY) || '[]'); }
    catch { return []; }
}

/** Salva/aggiorna una coppia email+password (porta in cima) */
function saveCredential(email, password) {
    let creds = getCredentials().filter(c => c.email !== email);
    creds.unshift({ email, enc: encryptPassword(password) });
    if (creds.length > 10) creds = creds.slice(0, 10);
    localStorage.setItem(CRED_KEY, JSON.stringify(creds));
}

/** Rimuove una singola credenziale */
window.removeCredential = function (email) {
    event && event.stopPropagation();
    let creds = getCredentials().filter(c => c.email !== email);
    localStorage.setItem(CRED_KEY, JSON.stringify(creds));
    renderCredentialsDropdown('');
    // Se rimangono account, tieni aperto; altrimenti chiudi
    if (creds.length === 0) hideCredentialsDropdown();
};

/** Genera colore HSL deterministico dall'email */
function emailToColor(email) {
    let hash = 0;
    for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 58%, 42%)`;
}

/** Estrae nome breve (es. "g.monti@..." Ã¢â€ â€™ "G. Monti") */
function emailToName(email) {
    const local = email.split('@')[0];
    const parts = local.split('.');
    if (parts.length >= 2) {
        return parts[0].charAt(0).toUpperCase() + '. ' +
               parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    }
    return local.charAt(0).toUpperCase() + local.slice(1);
}

/** Seleziona un account: compila email + password e chiude dropdown */
window.selectCredential = function (email, enc) {
    const emailEl = document.getElementById('loginEmail');
    const passEl  = document.getElementById('loginPassword');
    if (emailEl) emailEl.value = email;
    if (passEl)  passEl.value  = decryptPassword(enc);
    hideCredentialsDropdown();
    // Piccola animazione sul form
    const form = document.getElementById('loginForm');
    if (form) { form.style.transition = 'opacity .15s'; form.style.opacity = '0.7'; setTimeout(() => form.style.opacity = '1', 200); }
};

/** Render del contenuto del dropdown (filtro opzionale) */
function renderCredentialsDropdown(filter) {
    const list = document.getElementById('credentialsDropdownList');
    if (!list) return;

    let creds = getCredentials();
    if (filter) creds = creds.filter(c => c.email.toLowerCase().includes(filter.toLowerCase()));

    if (creds.length === 0) {
        list.innerHTML = `<div style="padding:14px 16px; color:#94a3b8; font-size:0.85rem; text-align:center;">
            <i class="fa-solid fa-user-slash" style="margin-right:6px;"></i>Nessun account salvato
        </div>`;
        return;
    }

    list.innerHTML = creds.map((c, i) => {
        const color   = emailToColor(c.email);
        const name    = emailToName(c.email);
        const initial = c.email.charAt(0).toUpperCase();
        const isLast  = i === creds.length - 1;

        return `<div
            onclick="selectCredential('${c.email}', '${c.enc}')"
            style="display:flex; align-items:center; gap:12px; padding:11px 16px;
                   cursor:pointer; transition:background .12s; user-select:none;
                   ${!isLast ? 'border-bottom:1px solid #f1f5f9;' : ''}"
            onmouseover="this.style.background='#f8fafc'"
            onmouseout="this.style.background='transparent'">

            <!-- Avatar -->
            <span style="width:34px; height:34px; border-radius:50%; background:${color};
                         color:#fff; display:flex; align-items:center; justify-content:center;
                         font-size:0.85rem; font-weight:700; flex-shrink:0;">${initial}</span>

            <!-- Info -->
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600; font-size:0.88rem; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</div>
                <div style="font-size:0.77rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.email}</div>
            </div>

            <!-- Password mascherata -->
            <span style="font-size:1.1rem; color:#94a3b8; letter-spacing:2px; flex-shrink:0;">&bull;&bull;&bull;&bull;&bull;&bull;</span>

            <!-- Rimuovi -->
            <span
                onclick="event.stopPropagation(); removeCredential('${c.email}')"
                title="Rimuovi account salvato"
                style="color:#cbd5e1; font-size:1.1rem; padding:2px 5px; border-radius:4px; flex-shrink:0; cursor:pointer; line-height:1;"
                onmouseover="this.style.color='#ef4444'; this.style.background='#fee2e2'"
                onmouseout="this.style.color='#cbd5e1'; this.style.background='transparent'">&times;</span>
        </div>`;
    }).join('');
}

/** Mostra il dropdown */
window.showCredentialsDropdown = function () {
    const creds = getCredentials();
    if (creds.length === 0) return; // niente da mostrare
    renderCredentialsDropdown('');
    const dd = document.getElementById('credentialsDropdown');
    if (dd) dd.style.display = 'block';
};

/** Filtra il dropdown mentre si digita */
window.filterCredentialsDropdown = function (value) {
    const creds = getCredentials();
    if (creds.length === 0) return;
    renderCredentialsDropdown(value);
    const dd = document.getElementById('credentialsDropdown');
    if (dd) dd.style.display = 'block';
};

/** Nasconde il dropdown */
function hideCredentialsDropdown() {
    const dd = document.getElementById('credentialsDropdown');
    if (dd) dd.style.display = 'none';
}

/** Click fuori dal dropdown Ã¢â€ â€™ chiudi */
function initCredentialDropdownDismiss() {
    document.addEventListener('mousedown', function (e) {
        const dd      = document.getElementById('credentialsDropdown');
        const emailEl = document.getElementById('loginEmail');
        if (!dd) return;
        if (!dd.contains(e.target) && e.target !== emailEl) {
            hideCredentialsDropdown();
        }
    });
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
//  AUTH LOGIC
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

window.prefillLogin = function () {
    // Migrazione legacy: lastLoginEmail Ã¢â€ â€™ salvo come credenziale senza password
    const legacy = localStorage.getItem('lastLoginEmail');
    if (legacy) {
        const exists = getCredentials().some(c => c.email === legacy);
        if (!exists) {
            let creds = getCredentials();
            creds.unshift({ email: legacy, enc: '' });
            localStorage.setItem(CRED_KEY, JSON.stringify(creds));
        }
        localStorage.removeItem('lastLoginEmail');
    }

    // Se c'è esattamente 1 account salvato: pre-compila
    const creds = getCredentials();
    if (creds.length === 1) {
        selectCredential(creds[0].email, creds[0].enc);
    }

    initCredentialDropdownDismiss();
}

/**
 * Tentativo di Auto-Login Silenzioso (Stile Cruscotto)
 * Se la sessione Supabase è scaduta ma abbiamo credenziali memorizzate sul dispositivo,
 * esegue il login in background in modo trasparente senza fermare l'utente sulla schermata di login.
 */
window.silentAutoLogin = async function () {
    try {
        const creds = getCredentials();
        if (!creds || creds.length === 0) return false;

        const firstCred = creds[0];
        if (!firstCred.email || !firstCred.enc) return false;

        const email = firstCred.email;
        const pass = decryptPassword(firstCred.enc);
        if (!email || !pass) return false;

        if (!window.supabase || !window.supabase.auth) return false;

        console.log('[Auto-Login] Tentativo di login automatico in background per:', email);
        const { data, error } = await window.supabase.auth.signInWithPassword({ email, password: pass });
        if (error) {
            console.warn('[Auto-Login] Login automatico non riuscito:', error.message);
            return false;
        }

        if (data && data.user) {
            console.log('[Auto-Login] Accesso automatico riuscito per:', data.user.email);
            currentUser = data.user;
            await initApp();
            return true;
        }
        return false;
    } catch (err) {
        console.warn('[Auto-Login] Eccezione durante login automatico:', err);
        return false;
    }
};

window.handleLogin = async function (e) {
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    try {
        const emailEl = document.getElementById('loginEmail');
        const passEl  = document.getElementById('loginPassword');
        if (!emailEl || !passEl) {
            alert("Errore di sistema: Campi di input email/password non trovati.");
            return;
        }

        const email = emailEl.value.trim();
        const pass  = passEl.value;

        if (!email || !pass) {
            alert("Inserisci Email e Password");
            return;
        }

        if (!window.supabase || !window.supabase.auth) {
            alert("Errore di connessione: Il client di autenticazione (Supabase SDK) non è stato caricato o inizializzato correttamente. Verifica la tua connessione internet o prova a ricaricare la pagina.");
            return;
        }

        const { data, error } = await window.supabase.auth.signInWithPassword({ email, password: pass });

        if (error) {
            alert("Errore Accesso: " + getUserFriendlyError(error));
        } else {
            // Salva credenziali (email + password cifrata) per accesso rapido futuro
            saveCredential(email, pass);
            // onAuthStateChange gestisce il redirect
        }
    } catch (err) {
        console.error("Login Exception caught:", err);
        alert("Errore imprevisto durante l'accesso: " + (err.message || err.toString()));
    }
}

window.handleRegister = async function () {
    try {
        const emailEl = document.getElementById('loginEmail');
        const passEl  = document.getElementById('loginPassword');
        if (!emailEl || !passEl) {
            alert("Errore di sistema: Campi di input non trovati.");
            return;
        }

        const email = emailEl.value.trim();
        const pass  = passEl.value;

        if (!email || !pass) {
            alert("Inserisci Email e Password per registrarti.");
            return;
        }

        if (!window.supabase || !window.supabase.auth) {
            alert("Errore di connessione: Il client di autenticazione (Supabase SDK) non è stato caricato correttamente.");
            return;
        }

        const { data, error } = await window.supabase.auth.signUp({ email, password: pass });

        if (error) {
            alert("Errore Registrazione: " + getUserFriendlyError(error));
        } else {
            alert("Registrazione completata! Controlla la tua email per confermare.");
        }
    } catch (err) {
        console.error("Register Exception caught:", err);
        alert("Errore imprevisto durante la registrazione: " + (err.message || err.toString()));
    }
}

window.logout = async function () {
    const isDesktop = !!(window.electronAPI || window.process?.type);
    const msg = isDesktop
        ? "Sei sicuro di voler disconnettere il tuo account da Genesy?\n(Per rientrare dovrai rifare l'accesso)"
        : "Sei sicuro di voler effettuare il logout da Genesy?";
    if (!confirm(msg)) {
        return;
    }
    try {
        if (!window.supabase || !window.supabase.auth) {
            location.reload();
            return;
        }
        await window.supabase.auth.signOut();
        location.reload();
    } catch (err) {
        console.error("Logout Exception caught:", err);
        location.reload();
    }
}

// Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â 
//  INIT APP & PERMISSIONS
// Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â Ã¢â€¢Â 

let _appInitDone = false; // Guard against double initApp() (getSession + onAuthStateChange)

async function initApp() {
    if (_appInitDone) {
        console.log('[initApp] Already initialized, skipping duplicate call.');
        return;
    }
    _appInitDone = true;

    document.getElementById('authView').classList.add('hidden');

    // ── FAST PATH: cache hit → show app immediately, 0 loading screen ──────────
    const cached = db._loadLocalCache ? await db._loadLocalCache() : null;
    if (cached) {
        // Populate in-memory data from cache (instant, IndexedDB ~10ms)
        db.data.quotes   = cached.quotes   || [];
        db.isAdmin       = cached.isAdmin  || false;
        db.role          = cached.role     || 'agent';
        db.user          = currentUser;   // needed by _getAgentNameForCurrentUser
        // clients/products not cached → loaded fresh by background refresh
        db.cacheLoaded   = true;


        // Show app immediately — no loading screen
        document.getElementById('loadingView').classList.add('hidden');
        document.getElementById('appView').classList.remove('hidden');

        // Set user display
        const userDisplay = document.getElementById('currentUserDisplay');
        if (userDisplay && currentUser) {
            userDisplay.innerHTML = `<i class="fa-regular fa-user" style="margin-right:5px;"></i> ${currentUser.email}`;
        }
        const userEmailLink = document.getElementById('currentUserEmailLink');
        if (userEmailLink && currentUser) userEmailLink.textContent = `Account: ${currentUser.email}`;

        setupNavigation();
        updateDashboard();
        renderRemindersWidget();
        renderCalendar();
        populateFilterOptions();
        renderQuotesTable();
        renderGenericClientsTable();
        renderProductsTable();
        populateSharedLists();
        setupDashboardWidgets();
        applyRolePermissions();
        if (window.loadGiobbySettings) window.loadGiobbySettings();
        if (typeof updateTrashBadge === 'function') updateTrashBadge();

        // Logo dinamico per Veneto
        const sidebarLogoF = document.getElementById('sidebarLogoImg');
        if (sidebarLogoF && currentUser && currentUser.email.toLowerCase() === 'm.gallon@parquetveneto.it') {
            sidebarLogoF.src = 'logo_parquet_veneto.png';
            sidebarLogoF.alt = 'Parquet Veneto Logo';
        }

        // Background: full Supabase refresh (non-blocking)
        db.init(currentUser).then(() => {
            window.dispatchEvent(new CustomEvent('genesyCacheRefreshed'));
        }).catch(e => console.warn('[Cache] Background Supabase refresh failed:', e));

        // Background: sync categories (non-blocking)
        db.syncCategories && db.syncCategories();

        // Attach search/filter listeners
        const qs = document.getElementById('quoteSearch');
        const qf = document.getElementById('quoteFilterStatus');
        if (qs && !qs.dataset.listenerAttached) { qs.addEventListener('input', () => renderQuotesTable()); qs.dataset.listenerAttached = '1'; }
        if (qf && !qf.dataset.listenerAttached) { qf.addEventListener('change', () => renderQuotesTable()); qf.dataset.listenerAttached = '1'; }

        return; // Done — app is already showing
    }

    // ── SLOW PATH: no cache yet → show loading screen, wait for Supabase ───────
    document.getElementById('appView').classList.add('hidden');
    document.getElementById('loadingView').classList.remove('hidden');

    const success = await db.init(currentUser);

    document.getElementById('loadingView').classList.add('hidden');

    if (!success) {
        alert("Errore critico: Impossibile caricare i dati dal Cloud.");
        document.getElementById('authView').classList.remove('hidden');
        return;
    }

    document.getElementById('appView').classList.remove('hidden');

    const userDisplay = document.getElementById('currentUserDisplay');
    if (userDisplay && currentUser) {
        const roleLabel = db.isAdmin ? ' (Admin)' : '';
        userDisplay.innerHTML = `<i class="fa-regular fa-user" style="margin-right:5px;"></i> ${currentUser.email}${roleLabel}`;
    }

    const userEmailLink = document.getElementById('currentUserEmailLink');
    if (userEmailLink && currentUser) {
        userEmailLink.textContent = `Account: ${currentUser.email}`;
    }

    db.syncCategories && db.syncCategories(); // non-blocking

    setupNavigation();
    updateDashboard();
    renderRemindersWidget();
    renderCalendar();
    populateFilterOptions();
    renderQuotesTable();
    renderGenericClientsTable();
    renderProductsTable();
    populateSharedLists();
    setupDashboardWidgets();
    applyRolePermissions();

    document.getElementById('quoteSearch').addEventListener('input', () => renderQuotesTable());
    document.getElementById('quoteFilterStatus').addEventListener('change', () => renderQuotesTable());

    if (window.loadGiobbySettings) window.loadGiobbySettings();
    if (typeof updateTrashBadge === 'function') updateTrashBadge();

    // Logo dinamico per Veneto
    const sidebarLogo = document.getElementById('sidebarLogoImg');
    if (sidebarLogo && currentUser && currentUser.email.toLowerCase() === 'm.gallon@parquetveneto.it') {
        sidebarLogo.src = 'logo_parquet_veneto.png';
        sidebarLogo.alt = 'Parquet Veneto Logo';
    }

    // When background Supabase refresh completes, silently update UI
    window.addEventListener('genesyCacheRefreshed', () => {
        if (typeof populateFilterOptions === 'function') populateFilterOptions();
        if (typeof populateSharedLists === 'function') populateSharedLists();
        if (typeof renderQuotesTable === 'function') renderQuotesTable();
        if (typeof renderGenericClientsTable === 'function') renderGenericClientsTable();
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof updateTrashBadge === 'function') updateTrashBadge();
    }, { once: true });
}

function applyRolePermissions() {
    const role    = db.role || 'agent';
    const isAdmin = (role === 'admin');

    if (!isAdmin) {
        const settingsBtn = document.querySelector('button[onclick="openSettings()"]');
        if (settingsBtn) settingsBtn.style.display = 'none';

        const layoutTools = document.getElementById('layoutToolsPanel');
        if (layoutTools) layoutTools.style.display = 'none';
    }
}

window.clearAllLocalStorage = function() {
    if (confirm("Sei sicuro di voler cancellare la memoria locale del browser? Questo risolverà l'errore di spazio insufficiente (QuotaExceededError). Dovrai reinserire le credenziali di accesso.")) {
        localStorage.clear();
        alert("Memoria locale cancellata con successo. La pagina verrà ricaricata.");
        location.reload();
    }
};
