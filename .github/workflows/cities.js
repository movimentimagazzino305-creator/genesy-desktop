
// cities.js - Gestione autocompletamento Comuni
// Carica i dati da comuni.json e gestisce la ricerca e il riempimento automatico

const CityManager = {
    cities: [],

    // Inizializza il gestore caricando i dati
    init: async function () {
        try {
            // Check if data is loaded via internal JS file (bypass CORS)
            if (typeof COMUNI_DATA !== 'undefined') {
                this.cities = COMUNI_DATA;
            } else {
                // Fallback for web server environment
                const response = await fetch('comuni.json');
                if (!response.ok) throw new Error("Errore caricamento comuni.json");
                this.cities = await response.json();
            }
        } catch (error) {
            console.error("Errore CityManager:", error);
        }
    },

    // Cerca comuni che iniziano con la stringa data (case-insensitive)
    search: function (query) {
        if (!query || query.length < 2) return [];
        const q = query.toLowerCase();
        // Filtra per nome che inizia con la query. Limitiamo a 10 risultati per performance UI
        return this.cities
            .filter(c => c.nome.toLowerCase().startsWith(q))
            .slice(0, 10);
    },

    // Trova i dettagli esatti di una città
    getDetails: function (name) {
        return this.cities.find(c => c.nome.toLowerCase() === name.toLowerCase());
    },

    // Attiva l'autocomplete su un gruppo di input (Città, CAP, Provincia)
    // cityInputId: ID dell'input città
    // zipInputId: ID dell'input CAP
    // provinceInputId: ID dell'input Provincia
    // Attiva l'autocomplete su un gruppo di input (Città, CAP, Provincia)
    enableAutocomplete: function (cityInputId, zipInputId, provinceInputId) {
        const cityInput = document.getElementById(cityInputId);
        const zipInput = document.getElementById(zipInputId);
        const provinceInput = document.getElementById(provinceInputId);

        if (!cityInput) return;

        // NUCLEAR OPTION: Readonly Hack + Random Attributes
        // Browsers generally won't autocomplete a readonly field.
        // We set it readonly initially, then remove it on focus.

        const applyAntiAutocomplete = (el) => {
            if (!el) return;
            // 1. Randomize name to break history linkage
            el.setAttribute('name', 'no_autofill_' + Math.random().toString(36).slice(2));
            // 2. Set autocomplete to garbage
            el.setAttribute('autocomplete', 'off');
            // 3. Set readonly initially
            el.setAttribute('readonly', 'true');
            // 4. Set style to look normal (in case readonly changes styling)
            el.style.backgroundColor = '#fff';

            // Remove readonly on focus to allow typing
            el.addEventListener('focus', function () {
                this.removeAttribute('readonly');
            });
            // Optional: Restore readonly on blur? No, can cause UX issues.
        };

        applyAntiAutocomplete(cityInput);
        applyAntiAutocomplete(zipInput);
        applyAntiAutocomplete(provinceInput);

        // Identificatore unico per la lista di questo input
        const listId = 'autocomplete-list-' + cityInputId;

        const closeList = () => {
            const existing = document.getElementById(listId);
            if (existing) existing.remove();
        };

        cityInput.addEventListener("input", (e) => {
            const val = e.target.value;
            closeList();
            if (!val) return;

            const matches = this.search(val);
            if (matches.length === 0) return;

            // Crea il container appeso al BODY per evitare problemi di overflow/z-index
            let listContainer = document.createElement("div");
            listContainer.id = listId;
            listContainer.className = "autocomplete-items";
            listContainer.style.position = "absolute";
            listContainer.style.zIndex = "99999"; // Molto alto per stare sopra le modali
            listContainer.style.backgroundColor = "#fff";
            listContainer.style.border = "1px solid #ddd";
            listContainer.style.maxHeight = "200px";
            listContainer.style.overflowY = "auto";
            listContainer.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
            listContainer.style.fontFamily = "inherit";
            listContainer.style.fontSize = "14px";

            // Calcola posizione
            const rect = cityInput.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            listContainer.style.top = (rect.bottom + scrollTop) + "px";
            listContainer.style.left = (rect.left + scrollLeft) + "px";
            listContainer.style.width = rect.width + "px";

            document.body.appendChild(listContainer);

            matches.forEach(match => {
                const item = document.createElement("div");
                item.style.padding = "8px 12px";
                item.style.cursor = "pointer";
                item.style.borderBottom = "1px solid #f0f0f0";
                item.style.color = "#333";

                const matchName = match.nome;
                item.innerHTML = `<strong>${matchName.substr(0, val.length)}</strong>${matchName.substr(val.length)} (${match.sigla})`;

                item.addEventListener("click", () => {
                    cityInput.value = match.nome;

                    let cap = "";
                    if (Array.isArray(match.cap)) {
                        cap = match.cap[0];
                    } else {
                        cap = match.cap;
                    }

                    if (zipInput) {
                        zipInput.value = cap;
                        zipInput.dispatchEvent(new Event('input'));
                    }

                    if (provinceInput) {
                        provinceInput.value = match.sigla;
                        provinceInput.dispatchEvent(new Event('input'));
                    }

                    cityInput.dispatchEvent(new Event('input', { bubbles: true }));
                    closeList();
                });

                item.addEventListener("mouseenter", () => item.style.backgroundColor = "#e9e9e9");
                item.addEventListener("mouseleave", () => item.style.backgroundColor = "#fff");

                listContainer.appendChild(item);
            });
        });

        // Event listeners globali per chiudere la lista
        document.addEventListener("click", (e) => {
            if (e.target !== cityInput) {
                closeList();
            }
        });

        // Chiudi se la finestra viene ridimensionata o scrollata (per evitare disallineamenti)
        window.addEventListener("resize", closeList);
        window.addEventListener("scroll", closeList, true); // true per catturare scroll di elementi interni
    }
};

// Avvio automatico al caricamento
document.addEventListener("DOMContentLoaded", () => {
    CityManager.init();
});
