/**
 * Logica Importazione Excel / CSV
 * Richiede SheetJS (XLSX)
 */

window.handleExcelImport = async function (input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    showLoadingSpinner("Lettura file in corso...");

    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Assume first sheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert to JSON with raw values
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (!jsonData || jsonData.length === 0) {
                alert("Il file sembra vuoto.");
                hideLoadingSpinner();
                return;
            }

            const importedCount = await processExcelData(jsonData);

            if (importedCount > 0) {
                alert(`Importazione completata: ${importedCount} preventivi creati/aggiornati.`);
                if (window.renderQuotesTable) renderQuotesTable();
            } else {
                alert("Nessun preventivo valido trovato nel file.");
            }

        } catch (error) {
            console.error("Excel Import Error:", error);
            alert("Errore durante l'importazione: " + error.message);
        } finally {
            hideLoadingSpinner();
            input.value = ""; // Reset input
        }
    };

    reader.readAsArrayBuffer(file);
};

async function processExcelData(rows) {
    // 1. Group rows by Document Number
    const quotesMap = {};

    // 2. Fetch all existing clients for deduplication
    showLoadingSpinner("Lettura anagrafica clienti...");
    const existingClients = db.getClients("") || [];

    // Helper to normalize strings for comparison
    const normalize = (str) => (str || "").toLowerCase().trim();

    const totalRows = rows.length;
    let processedRows = 0;

    for (const row of rows) {
        // UI Update (throttled)
        processedRows++;
        if (processedRows % 20 === 0) {
            showLoadingSpinner(`Elaborazione riga ${processedRows} di ${totalRows}...`);
            // Yield to UI to allow render
            await new Promise(r => setTimeout(r, 0));
        }

        // Flexible key matching
        const getVal = (keys) => {
            for (const k of keys) {
                if (row[k] !== undefined) return row[k];
                const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
                if (foundKey) return row[foundKey];
            }
            return "";
        };

        const docNum = getVal(["Documento", "Rif", "Numero", "Num"]);
        if (!docNum) continue;

        // Init Quote if new
        if (!quotesMap[docNum]) {
            const dateRaw = getVal(["Data documento", "Data"]);
            let dateStr = new Date().toISOString().split('T')[0];

            // Date Parsing Logic
            if (typeof dateRaw === 'number') {
                try {
                    const jsDate = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
                    dateStr = jsDate.toISOString().split('T')[0];
                } catch (e) { }
            } else if (typeof dateRaw === 'string') {
                if (dateRaw.includes('/')) {
                    const parts = dateRaw.split('/');
                    if (parts.length === 3) dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
            }

            // --- CLIENT LOGIC ---
            const customerName = getVal(["Ragione Sociale", "Cliente"]) || "Cliente Importato";
            const vat = getVal(["P.IVA", "Partita IVA", "Codice Fiscale", "CF"]);

            // Legal Address & Province
            const address = getVal(["Indirizzo", "Indirizzo Legale", "Via", "Città", "Cap"]);
            const addressProvince = getVal(["Provincia", "Prov", "Prov."]);

            // Site Address & Province
            const siteAddress = getVal(["Indirizzo Cantiere", "Cantiere", "Destinazione Merce", "Indirizzo Consegna", "Destinazione"]);
            const siteAddressProvince = getVal(["Provincia Cantiere", "Prov Cantiere", "Prov. Cantiere"]);

            const email = getVal(["Email", "E-mail"]);
            const phone = getVal(["Telefono", "Tel", "Cellulare"]);
            const agent = getVal(["Agente 1", "Agente"]);

            // Deduplication: Check by VAT (strongest) or Name
            let clientObj = existingClients.find(c =>
                (vat && normalize(c.vat) === normalize(vat)) ||
                (normalize(c.name) === normalize(customerName))
            );

            // Prepared extended data
            let clientData = {
                name: customerName,
                vat: vat,
                address: address,
                addressProvince: addressProvince ? addressProvince.toUpperCase() : "",
                siteAddress: siteAddress,
                siteAddressProvince: siteAddressProvince ? siteAddressProvince.toUpperCase() : "",
                email: email,
                phone: phone,
                agent: agent,
                ... (clientObj || {}) // Keep existing ID if found
            };

            // Update pure properties from Excel if missing in DB
            if (clientObj) {
                if (!clientObj.vat && vat) clientObj.vat = vat;
                if (!clientObj.address && address) clientObj.address = address;
                if (!clientObj.addressProvince && addressProvince) clientObj.addressProvince = addressProvince.toUpperCase();

                if (!clientObj.siteAddress && siteAddress) clientObj.siteAddress = siteAddress;
                // If site address matches legal, maybe we default? No, explicit only.
                if (!clientObj.siteAddressProvince && siteAddressProvince) clientObj.siteAddressProvince = siteAddressProvince.toUpperCase();

                if (!clientObj.email && email) clientObj.email = email;
                if (!clientObj.phone && phone) clientObj.phone = phone;
                if (!clientObj.agent && agent) clientObj.agent = agent;

            } else {
                // Prepare NEW client
                clientObj = {
                    id: crypto.randomUUID(),
                    name: customerName,
                    vat: vat,
                    address: address, // Legal
                    addressProvince: addressProvince ? addressProvince.toUpperCase() : "",
                    siteAddress: siteAddress, // Site
                    siteAddressProvince: siteAddressProvince ? siteAddressProvince.toUpperCase() : "",
                    email: email,
                    phone: phone,
                    agent: agent
                };
                // Optimistic push to local list to find it for next rows
                existingClients.push(clientObj);

                // Persist New Client IMMEDIATELY
                try {
                    const savedC = await db.saveClient(clientObj);
                    if (savedC) clientObj = savedC; // Update with real ID/Data
                } catch (e) { console.error("Error saving client", e); }
            }

            quotesMap[docNum] = {
                id: String(docNum),
                date: dateStr,
                status: getVal(["Stato"]) || "Aperto",
                customer: clientObj, // Linked Full Object
                deliveryAddress: clientObj.siteAddress || clientObj.address, // Prefer Site, fallback Legal
                agent: agent || clientObj.agent,
                warehouse: getVal(["Magazzino"]),
                items: [],
                total: 0,
                notesInternal: "Importato da Excel",
                notesExternal: ""
            };
        }

        // Parse Item
        const itemCode = getVal(["Codice prodotto", "Codice"]);
        const itemDesc = getVal(["Descrizione"]);
        const qty = parseFloat(getVal(["Quantità ordinata", "Qta", "Quantita"])) || 0;
        const price = parseFloat(getVal(["Prezzo", "Prezzo Unitario"])) || 0;
        const packages = parseFloat(getVal(["Colli"])) || 0;
        const warehouse = getVal(["Magazzino"]);
        const um = getVal(["Um", "U.M."]);

        if (itemCode || itemDesc) {
            quotesMap[docNum].items.push({
                code: itemCode,
                description: itemDesc,
                quantity: qty,
                price: price,
                unit: um || "pz",
                vat: 22,
                total: qty * price,
                packages: packages,
                warehouse: warehouse
            });
        }
    }

    // Process Final Quotes
    const finalQuotes = Object.values(quotesMap);
    let count = 0;

    for (const q of finalQuotes) {
        // Recalc total
        q.total = q.items.reduce((sum, i) => sum + i.total, 0);

        count++;
        // Update Spinner for Saving Phase
        if (count % 5 === 0) {
            showLoadingSpinner(`Salvataggio preventivo ${count} di ${finalQuotes.length}...`);
            await new Promise(r => setTimeout(r, 0));
        }

        await db.saveQuote(q);
    }

    // Refresh Client UI if needed
    if (window.renderGenericClientsTable) renderGenericClientsTable();

    return count;
}
