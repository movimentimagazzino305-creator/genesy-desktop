const SUPABASE_URL = 'https://joqzlsmrznitrgooirgo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jhfv3nnTpiKwvTE145hDqg_tpcBoomS';

function initSupabase() {
    // Il CDN di Supabase espone l'oggetto globale 'supabase' (la libreria)
    // Noi vogliamo creare un client autenticato.

    if (window.supabase && typeof window.supabase.createClient === 'function') {
        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // Sovrascriviamo l'oggetto globale 'supabase' con il client inizializzato
        // Così 'supabase.from(...)' funzionerà ovunque.
        window.supabase = client;

        console.log("Supabase Client Connect: SUCCESS");
    } else {
        console.error("Supabase SDK non caricato correttamente.");
    }
}
