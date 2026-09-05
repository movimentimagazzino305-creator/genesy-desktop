/**
 * Google Integrations Module (Drive & Sheets)
 */

window.saveGoogleSheetSettings = function () {
    const url = document.getElementById('googleWebAppUrl').value.trim();
    if (!url) return alert("Inserisci un URL valido.");

    // Save to LocalStorage
    localStorage.setItem('googleWebAppUrl', url);
    alert("URL salvato con successo!");
};

window.loadGoogleSheetSettings = function () {
    const url = localStorage.getItem('googleWebAppUrl');
    const input = document.getElementById('googleWebAppUrl');
    if (url && input) {
        input.value = url;
    }
};

// Hook into openSettings to load config
const originalOpenSettings = window.openSettings;
window.openSettings = function () {
    if (originalOpenSettings) originalOpenSettings();
    window.loadGoogleSheetSettings();
};

window.sendClientToGoogleSheet = async function () {
    const url = localStorage.getItem('googleWebAppUrl');
    if (!url) return alert("URL Google Sheet mancante! Vai in Impostazioni e configuralo.");

    // Gather Client Data form form
    const clientData = {
        date: new Date().toLocaleDateString('it-IT'), // Added Date
        name: document.getElementById('newClientName').value || "",
        address: document.getElementById('newClientAddress').value || "",
        city: document.getElementById('newClientCity').value || "",
        zip: document.getElementById('newClientZip').value || "",
        province: document.getElementById('newClientAddressProvince').value || "",
        state: document.getElementById('newClientState').value || "",
        country: document.getElementById('newClientCountry').value || "",
        email: document.getElementById('newClientEmail').value || "",
        pec: document.getElementById('newClientPec').value || "",
        phone: document.getElementById('newClientPhoneOffice').value || "",
        mobile: document.getElementById('newClientMobile').value || "",
        vat: document.getElementById('newClientVat').value || "",
        fiscalCode: document.getElementById('newClientFiscalCode').value || "",
        sdi: document.getElementById('newClientSdi').value || "",
        lang: document.getElementById('newClientLang').value || "",
        sector: document.getElementById('newClientSector').value || "",
        origin: document.getElementById('newClientOrigin').value || "",
        contactPerson: document.getElementById('newClientContact').value || document.getElementById('newClientContact_Input').value || "",
        notes: "Inviato da Genesy Cloud"
    };

    if (!clientData.name) return alert("Compila almeno il nome del cliente.");

    if (!confirm(`Inviare ${clientData.name} al Foglio Google?`)) return;

    try {
        const btn = document.getElementById('btnSendToSheet');
        const icon = btn.querySelector('i');
        icon.className = "fa-solid fa-spinner fa-spin";

        // GAS Web Apps with 'no-cors' receive content-type as text/plain usually. 
        // We stringify the body. The GAS script must use JSON.parse(e.postData.contents).
        console.log("Sending payload to Google Sheet:", clientData); // Debug log

        await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            // Note: 'Content-Type': 'application/json' is ignored in no-cors, but we keep it for clarity.
            // The body is sent as plain text. Correct GAS script handles this.
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(clientData)
        });

        alert("✅ Dati inviati correttamente al Foglio Google!");

    } catch (e) {
        console.error(e);
        alert("Errore invio: " + e.message);
    } finally {
        const btn = document.getElementById('btnSendToSheet');
        if (btn) {
            const icon = btn.querySelector('i');
            icon.className = "fa-solid fa-table";
        }
    }
};

window.copyClientToClipboard = async function (clientId) {
    const client = window.db.getClients().find(c => c.id === clientId);
    if (!client) return alert("Cliente non trovato.");

    let dateStr = new Date().toLocaleDateString('it-IT');
    if (client.createdAt) dateStr = new Date(client.createdAt).toLocaleDateString('it-IT');

    const enriched = { ...client, date: dateStr };
    const tsvRow = window.formatClientForSheet(enriched);

    try {
        await window.copyToClipboard(tsvRow);

        // Auto-open Sheet is now handled by the <a> tag href.
        // We only show success message if needed, or silent.
        // alert("📋 Dati copiati! Il foglio si aprirà in una nuova scheda."); (Optional)
        // No alert needed if the user expects the link to open. But maybe a toast?
        // Let's keep it simple.

        // If we want to confirm copy:
        // alert("Dati copiati!"); 
        // But invalidating the flow.
        // Let's just log.
    } catch (e) {
        alert("Errore copia: " + e.message);
    }
};

window.copySelectedClientsToClipboard = async function () {
    // Get Selected IDs from the checkboxes in the Client List
    const checkboxes = document.querySelectorAll('#clientsTableBody input[type="checkbox"]:checked');
    if (checkboxes.length === 0) return alert("Nessun cliente selezionato.");

    const allClients = window.db.getClients();
    let tsvData = "";

    checkboxes.forEach(cb => {
        const clientId = cb.value;
        const client = allClients.find(c => c.id === clientId);
        if (client) {
            let dateStr = new Date().toLocaleDateString('it-IT');
            if (client.createdAt) dateStr = new Date(client.createdAt).toLocaleDateString('it-IT');
            const enriched = { ...client, date: dateStr };
            tsvData += window.formatClientForSheet(enriched) + "\n";
        }
    });

    try {
        await window.copyToClipboard(tsvData);

        const sheetUrl = localStorage.getItem('googleWebAppUrl');
        if (sheetUrl) {
            const win = window.open(sheetUrl, '_blank');
            if (!win || win.closed || typeof win.closed == 'undefined') {
                alert("⚠️ Popup Bloccato!\n\nImpossibile aprire il Foglio Google.\nAbilita i popup per questo sito e riprova.");
            }
        } else {
            alert(`📋 ${checkboxes.length} Clienti copiati!\nVai sul Foglio Google e incolla.`);
        }
    } catch (e) {
        alert("Errore copia: " + e.message);
    }
};

window.sendClientToGoogleSheetFromList = async function (clientId) {
    const client = window.db.getClients().find(c => c.id === clientId);
    if (!client) return alert("Cliente non trovato.");

    const url = localStorage.getItem('googleWebAppUrl');
    if (!url) return alert("URL Google Sheet mancante! Vai in Impostazioni e configuralo.");

    const clientData = {
        date: new Date().toLocaleDateString('it-IT'), // Added Date
        name: client.name || "",
        address: client.address || "",
        city: client.city || "",
        zip: client.zip || "",
        province: client.addressProvince || "",
        state: client.state || "",
        country: client.country || "",
        email: client.email || "",
        pec: client.pec || "",
        phone: client.phone || "",
        mobile: client.mobile || "",
        fax: client.fax || "",
        vat: client.vat || "",
        fiscalCode: client.fiscalCode || "",
        sdi: client.sdi || "",
        lang: client.lang || "",
        sector: client.sector || "",
        origin: client.origin || "",
        contactPerson: client.contactPerson || "",
        notes: "Inviato da Genesy Cloud (Lista Clienti)"
    };

    if (!confirm(`Inviare ${clientData.name} al Foglio Google?`)) return;

    try {
        await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(clientData)
        });
        alert("✅ Dati inviati correttamente al Foglio Google!");
    } catch (e) {
        console.error(e);
        alert("Errore invio: " + e.message);
    }
};

// --- HELPER: Read Form Data (Same structure as DB Object for export) ---
function getClientFormPayload() {
    return {
        id: "NEW", // Placeholder
        name: document.getElementById('newClientName').value || "",
        address: document.getElementById('newClientAddress').value || "",
        city: document.getElementById('newClientCity').value || "",
        zip: document.getElementById('newClientZip').value || "",
        addressProvince: document.getElementById('newClientAddressProvince').value || "",
        state: document.getElementById('newClientState').value || "",
        country: document.getElementById('newClientCountry').value || "",
        email: document.getElementById('newClientEmail').value || "",
        pec: document.getElementById('newClientPec').value || "",
        phone: document.getElementById('newClientPhoneOffice').value || "",
        mobile: document.getElementById('newClientMobile').value || "",
        vat: document.getElementById('newClientVat').value || "",
        fiscalCode: document.getElementById('newClientFiscalCode').value || "",
        sdi: document.getElementById('newClientSdi').value || "",
        lang: document.getElementById('newClientLang').value || "",
        sector: document.getElementById('newClientSector').value || "",
        origin: document.getElementById('newClientOrigin').value || "",
        contactPerson: document.getElementById('newClientContact').value || document.getElementById('newClientContact_Input').value || "",
        notes: "Export Clipboard",
        date: new Date().toLocaleDateString('it-IT') // Current Date for Sheet
    };
}

// --- HELPER: Read DB Data ---
function getClientDbPayload(clientId) {
    const client = window.db.getClients().find(c => c.id === clientId);
    if (!client) return null;

    let dateStr = new Date().toLocaleDateString('it-IT');
    if (client.createdAt) dateStr = new Date(client.createdAt).toLocaleDateString('it-IT');

    return { ...client, date: dateStr };
}

// --- MAIN: Copy Logic (Sync + Confirm) ---
window.copyClientToGoogleSheetClipboard = function (clientId) {
    let payload = null;

    if (clientId) {
        // Case A: Passed ID (e.g. from List)
        payload = getClientDbPayload(clientId);
        if (!payload) return alert("Errore: Cliente non trovato nel DB.");
    } else {
        // Case B: No ID (e.g. from Modal Button) -> Read Form
        payload = getClientFormPayload();
        if (!payload.name) return alert("Attenzione: Nessun nome cliente inserito.");
    }

    // Format Data
    const tsvRow = window.formatClientForSheet(payload);

    // EXECUTE SYNC COPY
    // We utilize a hidden textarea to ensure 'execCommand' works synchronously 
    // and withstands any focus loss issues.
    copyTextToClipboardSync(tsvRow, payload.name);
};


// --- SYNC COPY IMPLEMENTATION ---
function copyTextToClipboardSync(text, clientName) {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Ensure hidden but interactive
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);

    textArea.focus();
    textArea.select();

    try {
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (success) {
            // Success Logic
            const url = localStorage.getItem('googleWebAppUrl');
            if (url) {
                // Confirm before Open
                setTimeout(() => {
                    const msg = `✅ Dati di "${clientName}" copiati!\n\nVuoi aprire il Foglio Google adesso?`;
                    if (confirm(msg)) {
                        window.open(url, '_blank');
                    }
                }, 50);
            } else {
                alert(`✅ Dati di "${clientName}" copiati negli appunti!`);
            }
        } else {
            alert("❌ Errore: Copia fallita (execCommand returned false).");
        }
    } catch (err) {
        if (document.body.contains(textArea)) document.body.removeChild(textArea);
        console.error("Copy Error:", err);
        alert("❌ Errore Eccezione Copia: " + err);
    }
}

// Re-expose internal helper strictly if needed, mainly for debugging or other modules
window.copyToClipboardSync = function (text) { copyTextToClipboardSync(text, "Dati"); };
