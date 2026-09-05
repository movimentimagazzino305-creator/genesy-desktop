/**
 * Sistema di Guide Interattive (Demo Mode)
 */

const GUIDES = {
    // Configurazione Tour Editor
    'editor': [
        {
            target: '#docDate',
            title: '1. Data e Intestazione',
            text: 'Qui puoi impostare la data del documento. Viene aggiornata automaticamente anche nel PDF. Verifica anche l\'Agente assegnato nel menu a tendina qui sotto.'
        },
        {
            target: '#clientDisplay',
            title: '2. Selezione Cliente',
            text: 'Clicca qui per selezionare un cliente esistente o crearne uno nuovo. Se il cliente è "Privato", verrà mostrato il Codice Fiscale, altrimenti la Partita IVA.'
        },
        {
            target: '#docItems',
            title: '3. Righe Prodotto',
            text: 'Questa è la parte centrale. Puoi aggiungere prodotti digitando nella descrizione (ricerca automatica).<br><br><strong>Tip:</strong> Usa le "Ghost Rows" (righe vuote) in fondo per inserimenti rapidi.'
        },
        {
            // Focus sul primo bottone spostamento della prima riga (se esiste)
            target: '#docItemsBody tr:first-child button[title="Sposta Su"]',
            fallbackTarget: '#docItems',
            title: '4. Ordina Righe',
            text: 'Usa le frecce <i class="fa-solid fa-arrow-up"></i> e <i class="fa-solid fa-arrow-down"></i> per cambiare l\'ordine dei prodotti nel preventivo.'
        },
        {
            // Focus sul bottone Extra
            target: '#docItemsBody tr:first-child button[title="Voci Extra"]',
            fallbackTarget: '#docItems',
            title: '5. Voci Extra (Novità!)',
            text: 'Clicca sull\'icona <strong>Lista</strong> <i class="fa-solid fa-list-check"></i> per aprire il menu "Accessori e Voci Extra".<br>Puoi usare anche il tasto <strong>F4</strong> mentre scrivi.'
        },
        {
            // Focus sul bottone Elimina
            target: '#docItemsBody tr:first-child button[title="Elimina Riga"]',
            fallbackTarget: '#docItems',
            title: '6. Elimina Riga',
            text: 'Clicca sulla <i class="fa-solid fa-times"></i> per rimuovere la riga dal preventivo.'
        },
        {
            target: '#docNotes',
            title: '7. Note e Scadenze',
            text: 'Aggiungi note visibili al cliente e note interne (solo per te). Imposta anche la data di consegna prevista.'
        },
        {
            target: '#togglePrintTotals',
            title: '8. Opzioni Stampa',
            text: 'Puoi decidere se mostrare o nascondere il riepilogo totali nel PDF finale usando questo switch.'
        },
        {
            target: '#btnSaveQuote',
            title: '9. Salva e Genera',
            text: 'Quando hai finito, salva il preventivo. Potrai poi generare il PDF o inviarlo via email.'
        }
    ],
    // Dashboard
    'dashboard': [
        {
            target: '.btn-create-quote',
            title: 'Crea Nuovo',
            text: 'Usa questo pulsante per creare subito un nuovo preventivo vuoto.'
        },
        {
            target: '#dashboardTrendTable',
            title: 'Andamento Mensile',
            text: 'Qui vedi a colpo d\'occhio quanti preventivi sono stati aperti, chiusi o persi nel periodo selezionato.'
        }
    ],
    // Quotes List
    'quotes': [
        {
            target: '#searchInput',
            title: 'Ricerca',
            text: 'Cerca preventivi per nome cliente, oggetto o numero.'
        },
        {
            target: '#statusFilter',
            title: 'Filtro Stato',
            text: 'Filtra la lista per vedere solo i preventivi aperti, chiusi, ecc.'
        }
    ],
    // Clients
    'clients': [
        {
            target: 'button[onclick="openClientModal()"]',
            title: 'Nuovo Cliente',
            text: 'Aggiungi un nuovo cliente all\'anagrafica.'
        },
        {
            target: '#clientSearchInput',
            title: 'Cerca Cliente',
            text: 'Trova rapidamente un cliente per visualizzarne lo storico.'
        }
    ],
    // Products
    'products': [
        {
            target: 'button[onclick="openProductModal()"]',
            title: 'Nuovo Prodotto',
            text: 'Inserisci un nuovo articolo nel catalogo.'
        },
        {
            target: '#productSearchInput',
            title: 'Catalogo',
            text: 'Cerca tra i prodotti esistenti per modificarne prezzi o descrizioni.'
        }
    ],
    // Stats
    'stats': [
        {
            target: '.tab-controls',
            title: 'Viste Analisi',
            text: 'Passa dalla panoramica generale alla matrice pivot per analisi più approfondite.'
        },
        {
            target: '#btnStatsCharts',
            title: 'Grafici',
            text: 'Visualizza i dati sotto forma di grafici per una comprensione più immediata.'
        }
    ]
};

let currentGuide = null;
let currentStepIndex = 0;
let overlayElement = null;
let tooltipElement = null;

/**
 * Attiva la guida per una specifica vista
 * @param {string} viewId - ID della vista (es. 'dashboard', 'editor', 'quotes')
 */
function toggleGuideMode(viewId) {
    // Se non specificato, prova a indovinare (fallback legacy)
    if (!viewId) {
        if (!document.getElementById('quoteEditor').classList.contains('hidden')) {
            viewId = 'editor';
        } else {
            viewId = 'dashboard';
        }
    }

    startGuide(viewId);
}

function startGuide(tourId) {
    if (!GUIDES[tourId]) {
        alert("Nessuna guida disponibile per questa schermata.");
        return;
    }

    currentGuide = GUIDES[tourId];
    currentStepIndex = 0;

    createGuideUI();
    showStep(currentStepIndex);
}

function createGuideUI() {
    // Rimuovi se esistenti
    removeGuideUI();

    // Overlay
    overlayElement = document.createElement('div');
    overlayElement.className = 'guide-overlay active';
    overlayElement.onclick = endGuide; // Clicca fuori per uscire
    document.body.appendChild(overlayElement);

    // Tooltip
    tooltipElement = document.createElement('div');
    tooltipElement.className = 'guide-tooltip';
    document.body.appendChild(tooltipElement);
}

function removeGuideUI() {
    const oldOverlay = document.querySelector('.guide-overlay');
    if (oldOverlay) oldOverlay.remove();
    const oldTooltip = document.querySelector('.guide-tooltip');
    if (oldTooltip) oldTooltip.remove();

    // Rimuovi highlight
    document.querySelectorAll('.guide-highlight').forEach(el => {
        el.classList.remove('guide-highlight');
        el.style.boxShadow = ''; // Reset inline
    });
}

function showStep(index) {
    if (!currentGuide || index < 0 || index >= currentGuide.length) {
        endGuide();
        return;
    }

    const step = currentGuide[index];
    let targetEl = document.querySelector(step.target);

    // Fallback logic
    if (!targetEl && step.fallbackTarget) {
        targetEl = document.querySelector(step.fallbackTarget);
    }

    // Scroll to element
    if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Highlight logic
        document.querySelectorAll('.guide-highlight').forEach(el => el.classList.remove('guide-highlight'));
        targetEl.classList.add('guide-highlight');
    }

    // Update Tooltip
    tooltipElement.innerHTML = `
        <h3>
            ${step.title}
            <span class="guide-step-indicator">${index + 1}/${currentGuide.length}</span>
        </h3>
        <p>${step.text}</p>
        <div class="guide-controls">
            ${index > 0 ? '<button class="guide-btn guide-btn-secondary" onclick="prevStep()">Indietro</button>' : '<div></div>'}
            <button class="guide-btn guide-btn-primary" onclick="nextStep()">
                ${index === currentGuide.length - 1 ? 'Chiudi' : 'Avanti'}
            </button>
        </div>
    `;

    // Posiziona Tooltip
    updateTooltipPosition(targetEl);
    tooltipElement.classList.add('active');
}

function updateTooltipPosition(targetEl) {
    if (!targetEl) {
        // Center screen fallback
        tooltipElement.style.top = '50%';
        tooltipElement.style.left = '50%';
        tooltipElement.style.transform = 'translate(-50%, -50%)';
        return;
    }

    const rect = targetEl.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();

    // Default: Sotto l'elemento
    let top = rect.bottom + 10;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

    // Check overflow schermo
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width - 10;
    if (top + tooltipRect.height > window.innerHeight) {
        // Sposta sopra se non c'è spazio sotto
        top = rect.top - tooltipRect.height - 10;
    }

    tooltipElement.style.top = `${top}px`;
    tooltipElement.style.left = `${left}px`;
    tooltipElement.style.transform = 'none'; // Reset transform center fallback
}

window.nextStep = function () {
    currentStepIndex++;
    showStep(currentStepIndex);
}

window.prevStep = function () {
    currentStepIndex--;
    showStep(currentStepIndex);
}

window.endGuide = function () {
    removeGuideUI();
    currentGuide = null;
    currentStepIndex = 0;
}

// Global expose
window.toggleGuideMode = toggleGuideMode;
