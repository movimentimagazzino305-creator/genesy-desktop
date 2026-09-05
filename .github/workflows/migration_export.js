/**
 * MIGRATION TOOL: Firebase TO Supabase
 * Paste this into console or include in index.html to run.
 */

window.exportForSupabase = async function () {
    console.log("Starting Export...");

    // Ensure data is loaded
    if (!db.cacheLoaded) {
        alert("Attendi il caricamento completo dell'app...");
        return;
    }

    const data = {
        clients: [],
        products: [],
        quotes: [],
        config: []
    };

    // 1. CLIENTS
    data.clients = db.data.clients.map(c => ({
        id: c.id.toString(),
        name: c.name || 'Senza Nome',
        vat: c.vat || '',
        address: c.address || '',
        city: c.city || '',
        email: c.email || '',
        phone: c.phone || '',
        notes: c.notes || '',
        created_at: c.createdAt || new Date().toISOString()
    }));

    // 2. PRODUCTS
    data.products = db.data.products.map(p => ({
        id: p.id.toString(),
        code: p.code || '',
        category: p.category || '',
        description: p.description || '',
        uom: p.uom || 'pz',
        price_min: parseFloat(p.priceMin || 0),
        price_max: parseFloat(p.priceMax || 0),
        variants: {
            var1: p.var1 || '',
            var2: p.var2 || '',
            var3: p.var3 || '',
            essenza: p.essenza || '',
            tipo: p.tipo || ''
        },
        created_at: new Date().toISOString()
    }));

    // 3. QUOTES
    data.quotes = db.data.quotes.map(q => ({
        id: q.id.toString(),
        date: q.date ? new Date(q.date).toISOString() : new Date().toISOString(),
        status: q.status || 'Aperto',
        total: parseFloat(q.total || 0),
        client_id: q.customer && q.customer.id ? q.customer.id.toString() : null, // Link if possible

        owner_id: q.ownerId || '',
        owner_email: q.ownerEmail || '',
        agent: q.agent || '',
        zone: q.zone || '',

        items_json: q.items || [],
        customer_snapshot_json: q.customer || {},
        notes: q.notes || '',
        internal_notes: q.internalNotes || '', // Note check casing in data.js

        created_at: q.createdAt || new Date().toISOString()
    }));

    // 4. CONFIG
    if (db.data.vars) {
        Object.entries(db.data.vars).forEach(([k, v]) => {
            data.config.push({ key: k, value: v });
        });
    }

    // DOWNLOAD
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "supabase_migration_data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    console.log(`Export Ready: ${data.quotes.length} Quotes, ${data.clients.length} Clients.`);
    alert("Export Completato! Salva il file 'supabase_migration_data.json'.");
};
