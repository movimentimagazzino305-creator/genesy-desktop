/**
 * MIGRATION IMPORT TOOL
 * Reads the JSON file and uploads to Supabase Tables
 */

window.importToSupabase = async function (inputElement) {
    if (!inputElement.files || inputElement.files.length === 0) return;

    const file = inputElement.files[0];
    const reader = new FileReader();

    console.log("Reading file...");

    reader.onload = async function (e) {
        try {
            const data = JSON.parse(e.target.result);
            console.log("Data loaded:", data);

            if (!supabase) {
                alert("Errore: Supabase non inizializzato. Controlla console.");
                return;
            }

            // 1. IMPORT CLIENTS
            if (data.clients && data.clients.length > 0) {
                const { error } = await supabase.from('clients').upsert(data.clients, { onConflict: 'id' });
                if (error) throw new Error("Errore Clienti: " + error.message);
                console.log(`Importati ${data.clients.length} Clienti.`);
            }

            // 2. IMPORT PRODUCTS
            if (data.products && data.products.length > 0) {
                const { error } = await supabase.from('products').upsert(data.products, { onConflict: 'id' });
                if (error) throw new Error("Errore Prodotti: " + error.message);
                console.log(`Importati ${data.products.length} Prodotti.`);
            }

            // 3. IMPORT QUOTES
            if (data.quotes && data.quotes.length > 0) {
                const { error } = await supabase.from('quotes').upsert(data.quotes, { onConflict: 'id' });
                if (error) throw new Error("Errore Preventivi: " + error.message);
                console.log(`Importati ${data.quotes.length} Preventivi.`);
            }

            // 4. IMPORT CONFIG
            if (data.config && data.config.length > 0) {
                const { error } = await supabase.from('app_config').upsert(data.config, { onConflict: 'key' });
                if (error) throw new Error("Errore Config: " + error.message);
            }

            alert("MIGRAZIONE COMPLETATA CON SUCCESSO! \nOra puoi passare alla versione Supabase.");

        } catch (err) {
            console.error(err);
            alert("Errore Importazione: " + err.message);
        }
    };

    reader.readAsText(file);
};
