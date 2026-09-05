/**
 * Genesy - Utility Functions
 * Contains formatting and helper functions.
 */

// --- FORMATTING HELPERS ---

const formatCurrency = (num) => {
    const n = Number(num || 0);
    let [int, dec] = n.toFixed(2).split('.');
    int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${int},${dec}`;
};

const formatDate = (isoStr) => { if (!isoStr) return ''; return new Date(isoStr).toLocaleDateString('it-IT'); };

// Helper Formattazione Numeri per Input
// Formattazione Numerica Base
const formatInput = (num) => {
    let n = Number(num || 0);
    // Modificato: Forzo sempre 2 decimali
    let formatted = n.toFixed(2);
    // formatted = parseFloat(formatted).toString(); // RIMOSSO: Rimuoveva gli zeri finali
    let [i, d] = formatted.split('.');
    i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${i},${d}`;
};

const formatQuantity = (num) => {
    let n = Number(num || 0);
    // If integer, show no decimals. If float, show 2 decimals (standardize).
    if (Number.isInteger(n)) return n.toString();
    return formatInput(n);
};

const parseInput = (str) => {
    if (str === null || str === undefined || str === '') return 0;
    if (typeof str === 'number') return isNaN(str) ? 0 : str;
    let trimmed = String(str).trim();
    if (!trimmed) return 0;
    if (/[a-zA-Z]/.test(trimmed)) return 0;
    if (/[^0-9.,]$/.test(trimmed)) return 0;

    let clean = trimmed;
    if (clean.includes(',') && clean.includes('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
    }
    const val = parseFloat(clean);
    if (isNaN(val)) return 0;
    if (val > 10000000) return 0;
    return val || 0;
};

// --- ERROR HANDLING ---

window.localizeError = function (error) {
    console.error("Raw Error:", error);
    // Handle both Error objects and strings
    const code = (error && (error.code || error.message || error.toString())) || '';
    const lowerCode = code.toLowerCase();

    // Firebase Auth Errors (Legacy / Fallback)
    if (lowerCode.includes('auth/invalid-email')) return 'Indirizzo email non valido.';
    if (lowerCode.includes('auth/user-disabled')) return 'Utente disabilitato.';
    if (lowerCode.includes('auth/user-not-found')) return 'Utente non trovato. Registrati prima di accedere.';
    if (lowerCode.includes('auth/wrong-password')) return 'Password errata.';
    if (lowerCode.includes('auth/email-already-in-use')) return 'Email già registrata.';
    if (lowerCode.includes('auth/weak-password')) return 'Password troppo debole (min. 6 caratteri).';
    if (lowerCode.includes('network-request-failed')) return 'Errore di connessione. Controlla internet.';
    if (lowerCode.includes('permission-denied')) return 'Permesso negato.';

    // Supabase Auth Errors
    if (lowerCode.includes('invalid login credentials')) return 'Email o password errati.';
    if (lowerCode.includes('invalid credentials') || lowerCode.includes('non corretti')) return 'Email o password errati.';
    if (lowerCode.includes('email not confirmed')) return 'Indirizzo email non confermato. Controlla la tua casella di posta.';
    if (lowerCode.includes('user already registered')) return 'Email già registrata.';
    
    // Supabase / Database Errors
    if (lowerCode.includes('duplicate key value')) return 'Dato duplicato (es. codice o nome già esistente).';
    if (lowerCode.includes('violates foreign key constraint')) return 'Impossibile eliminare: elemento collegato ad altri dati.';
    if (lowerCode.includes('violates not-null constraint')) return 'Dati mancanti: compila tutti i campi obbligatori.';
    if (lowerCode.includes('23505')) return 'Elemento già esistente (Duplicato).';

    // Generic Network
    if (lowerCode.includes('fetch') || lowerCode.includes('network')) return 'Errore di rete. Controlla la connessione.';

    // Default
    return "Si è verificato un errore: " + code;
};

// Alias for backward compatibility if needed (though we will update calls)
// 2026-01-29: Added Clipboard Helper
window.copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error("Errore copia appunti:", err);
        // Fallback for older browsers
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch (e) {
            console.error("Fallback copia fallito:", e);
            return false;
        }
    }
};

window.getUserFriendlyError = window.localizeError;

// --- GEOGRAPHIC HELPERS ---

/**
 * Inferisce la regione italiana dalla sigla della provincia
 * @param {string} province - Sigla provincia (es. "FI", "RM", "MI")
 * @returns {string} - Nome regione (es. "Toscana") o stringa vuota se non trovata
 */
window.inferRegionFromProvince = function (province) {
    if (!province) return '';

    const provinceToRegion = {
        // Abruzzo
        'AQ': 'Abruzzo', 'CH': 'Abruzzo', 'PE': 'Abruzzo', 'TE': 'Abruzzo',
        // Basilicata
        'MT': 'Basilicata', 'PZ': 'Basilicata',
        // Calabria
        'CZ': 'Calabria', 'CS': 'Calabria', 'KR': 'Calabria', 'RC': 'Calabria', 'VV': 'Calabria',
        // Campania
        'AV': 'Campania', 'BN': 'Campania', 'CE': 'Campania', 'NA': 'Campania', 'SA': 'Campania',
        // Emilia-Romagna
        'BO': 'Emilia-Romagna', 'FC': 'Emilia-Romagna', 'FE': 'Emilia-Romagna', 'MO': 'Emilia-Romagna',
        'PR': 'Emilia-Romagna', 'PC': 'Emilia-Romagna', 'RA': 'Emilia-Romagna', 'RE': 'Emilia-Romagna',
        'RN': 'Emilia-Romagna',
        // Friuli-Venezia Giulia
        'GO': 'Friuli-Venezia Giulia', 'PN': 'Friuli-Venezia Giulia', 'TS': 'Friuli-Venezia Giulia',
        'UD': 'Friuli-Venezia Giulia',
        // Lazio
        'FR': 'Lazio', 'LT': 'Lazio', 'RI': 'Lazio', 'RM': 'Lazio', 'VT': 'Lazio',
        // Liguria
        'GE': 'Liguria', 'IM': 'Liguria', 'SP': 'Liguria', 'SV': 'Liguria',
        // Lombardia
        'BG': 'Lombardia', 'BS': 'Lombardia', 'CO': 'Lombardia', 'CR': 'Lombardia', 'LC': 'Lombardia',
        'LO': 'Lombardia', 'MN': 'Lombardia', 'MI': 'Lombardia', 'MB': 'Lombardia', 'PV': 'Lombardia',
        'SO': 'Lombardia', 'VA': 'Lombardia',
        // Marche
        'AN': 'Marche', 'AP': 'Marche', 'FM': 'Marche', 'MC': 'Marche', 'PU': 'Marche',
        // Molise
        'CB': 'Molise', 'IS': 'Molise',
        // Piemonte
        'AL': 'Piemonte', 'AT': 'Piemonte', 'BI': 'Piemonte', 'CN': 'Piemonte', 'NO': 'Piemonte',
        'TO': 'Piemonte', 'VB': 'Piemonte', 'VC': 'Piemonte',
        // Puglia
        'BA': 'Puglia', 'BT': 'Puglia', 'BR': 'Puglia', 'FG': 'Puglia', 'LE': 'Puglia', 'TA': 'Puglia',
        // Sardegna
        'CA': 'Sardegna', 'CI': 'Sardegna', 'NU': 'Sardegna', 'OR': 'Sardegna', 'OT': 'Sardegna',
        'SS': 'Sardegna', 'SU': 'Sardegna', 'VS': 'Sardegna',
        // Sicilia
        'AG': 'Sicilia', 'CL': 'Sicilia', 'CT': 'Sicilia', 'EN': 'Sicilia', 'ME': 'Sicilia',
        'PA': 'Sicilia', 'RG': 'Sicilia', 'SR': 'Sicilia', 'TP': 'Sicilia',
        // Toscana
        'AR': 'Toscana', 'FI': 'Toscana', 'GR': 'Toscana', 'LI': 'Toscana', 'LU': 'Toscana',
        'MS': 'Toscana', 'PI': 'Toscana', 'PT': 'Toscana', 'PO': 'Toscana', 'SI': 'Toscana',
        // Trentino-Alto Adige
        'BZ': 'Trentino-Alto Adige', 'TN': 'Trentino-Alto Adige',
        // Umbria
        'PG': 'Umbria', 'TR': 'Umbria',
        // Valle d'Aosta
        'AO': 'Valle d\'Aosta',
        // Veneto
        'BL': 'Veneto', 'PD': 'Veneto', 'RO': 'Veneto', 'TV': 'Veneto', 'VE': 'Veneto',
        'VR': 'Veneto', 'VI': 'Veneto'
    };

    return provinceToRegion[province.toUpperCase()] || '';
};

