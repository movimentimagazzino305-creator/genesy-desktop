// RECOVERY TOOL v2 - DEEP LINK FIX
// Run this in the browser console context
window.runRecoveryScan = async function () {

    const registry = db.getClients();
    const quotes = db.getAllQuotes();
    const repairs = [];

    for (const q of quotes) {
        if (!q.customer || !q.customer.id) continue;

        const qName = (q.customer.name || '').trim();
        const qId = q.customer.id;

        // Find the client currently linked
        const linkedClient = registry.find(c => c.id == qId);

        if (!linkedClient) {
            // Case 1: Dead Link (Client deleted)
            console.warn(`[DEAD LINK] Quote ${q.friendlyId} (${qName}) points to missing ID ${qId}`);
            repairs.push({
                type: 'RESTORE_AND_LINK',
                quote: q,
                correctName: qName,
                reason: 'Cliente non trovato in anagrafica'
            });
        } else {
            const lName = (linkedClient.name || '').trim();

            // Case 2: Mismatch (ID Collision / Overwrite)
            // e.g. Quote says "Falcini", ID points to "Accetta"
            if (qName && lName && qName.toLowerCase() !== lName.toLowerCase()) {
                // Fuzzy check just in case "Falcini" vs "Falcini Srl"
                if (!lName.toLowerCase().includes(qName.toLowerCase()) && !qName.toLowerCase().includes(lName.toLowerCase())) {
                    console.warn(`[MISMATCH] Quote ${q.friendlyId} says '${qName}' but links to '${lName}' (ID: ${qId})`);

                    repairs.push({
                        type: 'RELINK',
                        quote: q,
                        correctName: qName,
                        badId: qId,
                        reason: `Link errato a ${lName}`
                    });
                }
            }
        }
    }
    return repairs;
};

window.executeRecovery = async function (repairs) {
    if (!repairs || repairs.length === 0) {
        alert("Nessun problema rilevato! I dati sembrano coerenti.");
        return;
    }

    if (!confirm(`Trovate ${repairs.length} incongruenze (Clienti errati nei preventivi).\nProcedere alla riparazione automatica?`)) return;

    const registry = db.getClients();
    let fixedCount = 0;

    for (const task of repairs) {
        try {

            // 1. Find a valid candidate in registry for 'correctName'
            // (Maybe we already recovered it previously, or it exists under a diff ID)
            let match = registry.find(c => c.name.toLowerCase() === task.correctName.toLowerCase());

            // If not/exact match, try fuzzy
            if (!match) {
                match = registry.find(c => c.name.toLowerCase().includes(task.correctName.toLowerCase()));
            }

            let finalId = null;

            if (match) {
                // We found the REAL client in registry!
                finalId = match.id;
            } else {
                // Not found, we must CREATE it (Restore from Quote Snapshot)
                const newClient = { ...task.quote.customer };
                newClient.id = 'REC-' + Date.now() + '-' + Math.floor(Math.random() * 10000); // New Unique ID
                newClient.name = task.correctName; // Ensure name is clean
                if (!newClient.notes) newClient.notes = "";
                newClient.notes += `\n[Auto-Recupero da Preventivo ${task.quote.friendlyId}]`;

                await db.saveClient(newClient);
                finalId = newClient.id;

                // Update local registry copy for next iterations
                registry.push(newClient);
            }

            // 2. Update the Quote to point to 'finalId'
            task.quote.customer.id = finalId;
            task.quote.customer = db.getClients().find(c => c.id == finalId) || task.quote.customer; // Refresh ref

            // Save Quote
            await db.saveQuote(task.quote);
            fixedCount++;

        } catch (e) {
            console.error("Fix failed for", task.quote.friendlyId, e);
        }
    }

    alert(`Riparazione Completata!\nCorretti ${fixedCount} preventivi.`);
    location.reload();
};
