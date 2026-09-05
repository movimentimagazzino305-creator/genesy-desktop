/**
 * Sistema di Guide Pagina A4
 * Mostra visivamente i limiti di una pagina A4 nell'editor
 */

// Dimensioni foglio A4 (in mm e px)
const A4_DIMENSIONS = {
    width: {
        mm: 210,
        px: 2480  // a 300 DPI (stampa professionale)
    },
    height: {
        mm: 297,
        px: 3508  // a 300 DPI (stampa professionale)
    },
    dpi: 300,
    margins: {
        top: 20,    // mm
        right: 15,  // mm
        bottom: 20, // mm
        left: 15    // mm
    }
};

// Stato della vista
let pageGuidesEnabled = false;

/**
 * Attiva/Disattiva le guide pagina
 */
window.togglePageGuides = function () {
    pageGuidesEnabled = !pageGuidesEnabled;

    const button = document.getElementById('btnPageGuides');
    if (button) {
        if (pageGuidesEnabled) {
            button.classList.add('active');
            button.innerHTML = '<i class="fa-solid fa-file-lines"></i> Vista Stampa ON';
            button.style.background = '#10b981';
            button.style.borderColor = '#10b981';
        } else {
            button.classList.remove('active');
            button.innerHTML = '<i class="fa-solid fa-file-lines"></i> Vista Stampa';
            button.style.background = '';
            button.style.borderColor = '';
        }
    }

    if (pageGuidesEnabled) {
        showPageGuides();
    } else {
        hidePageGuides();
    }
};

/**
 * Mostra le guide pagina
 */
function showPageGuides() {
    const printArea = document.getElementById('printArea');
    if (!printArea) return;

    // Rimuovi guide esistenti
    hidePageGuides();

    // Crea container per le guide
    const guidesContainer = document.createElement('div');
    guidesContainer.id = 'pageGuidesContainer';
    guidesContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 9999;
    `;

    // Calcola altezza del contenuto
    const contentHeight = printArea.scrollHeight;
    const pageHeight = A4_DIMENSIONS.height.px;
    const numPages = Math.ceil(contentHeight / pageHeight);

    // Crea guide per ogni pagina
    for (let i = 1; i <= numPages; i++) {
        const pageTop = (i - 1) * pageHeight;
        const pageBottom = i * pageHeight;

        // Linea superiore della pagina
        if (i > 1) {
            const topLine = createGuideLine(pageTop, 'top', i);
            guidesContainer.appendChild(topLine);
        }

        // Area stampabile (con margini)
        const printableArea = createPrintableArea(pageTop, i);
        guidesContainer.appendChild(printableArea);

        // Indicatore numero pagina
        const pageNumber = createPageNumber(pageTop, i, numPages);
        guidesContainer.appendChild(pageNumber);
    }

    // Aggiungi al printArea
    printArea.style.position = 'relative';
    printArea.appendChild(guidesContainer);

    // Mostra info header
    showPageInfo(numPages);
}

/**
 * Crea una linea guida
 */
function createGuideLine(top, position, pageNum) {
    const line = document.createElement('div');
    line.className = 'page-guide-line';
    line.style.cssText = `
        position: absolute;
        left: 0;
        right: 0;
        top: ${top}px;
        height: 2px;
        background: repeating-linear-gradient(
            to right,
            #ef4444 0px,
            #ef4444 10px,
            transparent 10px,
            transparent 20px
        );
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
    `;

    // Label
    const label = document.createElement('div');
    label.style.cssText = `
        position: absolute;
        right: 10px;
        top: -12px;
        background: #ef4444;
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 600;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    label.textContent = `Fine Pagina ${pageNum - 1}`;
    line.appendChild(label);

    return line;
}

/**
 * Crea area stampabile (con margini)
 */
function createPrintableArea(pageTop, pageNum) {
    const area = document.createElement('div');
    area.className = 'page-printable-area';

    // Conversione mm to px a 300 DPI: 1mm = 11.811 px
    const mmToPx = 11.811;
    const marginTop = A4_DIMENSIONS.margins.top * mmToPx;
    const marginBottom = A4_DIMENSIONS.margins.bottom * mmToPx;
    const marginLeft = A4_DIMENSIONS.margins.left * mmToPx;
    const marginRight = A4_DIMENSIONS.margins.right * mmToPx;
    const pageHeight = A4_DIMENSIONS.height.px;

    area.style.cssText = `
        position: absolute;
        left: ${marginLeft}px;
        right: ${marginRight}px;
        top: ${pageTop + marginTop}px;
        height: ${pageHeight - marginTop - marginBottom}px;
        border: 1px dashed #3b82f6;
        background: rgba(59, 130, 246, 0.02);
        border-radius: 4px;
    `;

    return area;
}

/**
 * Crea indicatore numero pagina
 */
function createPageNumber(pageTop, pageNum, totalPages) {
    const indicator = document.createElement('div');
    indicator.className = 'page-number-indicator';
    indicator.style.cssText = `
        position: absolute;
        left: 10px;
        top: ${pageTop + 10}px;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        padding: 8px 15px;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    indicator.innerHTML = `
        <i class="fa-solid fa-file-lines"></i>
        <span>Pagina ${pageNum} di ${totalPages}</span>
    `;

    return indicator;
}

/**
 * Mostra info header
 */
function showPageInfo(numPages) {
    // Rimuovi info esistenti
    const existing = document.getElementById('pageInfoHeader');
    if (existing) existing.remove();

    const printArea = document.getElementById('printArea');
    if (!printArea) return;

    const info = document.createElement('div');
    info.id = 'pageInfoHeader';
    info.style.cssText = `
        position: sticky;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        color: white;
        padding: 12px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        border-radius: 8px 8px 0 0;
        margin: -20px -20px 20px -20px;
    `;

    const pageHeight = A4_DIMENSIONS.height.px;
    const contentHeight = printArea.scrollHeight;

    info.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-file-pdf" style="font-size: 1.2rem; color: #ef4444;"></i>
                <span style="font-weight: 600; font-size: 0.95rem;">Vista Stampa A4 (300 DPI)</span>
            </div>
            <div style="height: 20px; width: 1px; background: rgba(255,255,255,0.2);"></div>
            <div style="font-size: 0.85rem; color: #cbd5e1;">
                <strong style="color: white;">${numPages}</strong> ${numPages === 1 ? 'pagina' : 'pagine'}
            </div>
            <div style="height: 20px; width: 1px; background: rgba(255,255,255,0.2);"></div>
            <div style="font-size: 0.85rem; color: #cbd5e1;">
                2480 × 3508 px
            </div>
            <div style="height: 20px; width: 1px; background: rgba(255,255,255,0.2);"></div>
            <div style="font-size: 0.85rem; color: #cbd5e1;">
                Altezza: <strong style="color: white;">${contentHeight}px</strong>
            </div>
        </div>
        <div style="display: flex; gap: 10px;">
            <button onclick="scrollToPage(1)" class="btn-sm" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                <i class="fa-solid fa-arrow-up"></i> Inizio
            </button>
            ${numPages > 1 ? `
                <button onclick="scrollToPage(${numPages})" class="btn-sm" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                    <i class="fa-solid fa-arrow-down"></i> Fine
                </button>
            ` : ''}
        </div>
    `;

    printArea.insertBefore(info, printArea.firstChild);
}

/**
 * Scroll a una specifica pagina
 */
window.scrollToPage = function (pageNum) {
    const printArea = document.getElementById('printArea');
    if (!printArea) return;

    const pageHeight = A4_DIMENSIONS.height.px;
    const targetTop = (pageNum - 1) * pageHeight;

    // Smooth scroll
    printArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
        window.scrollBy({
            top: targetTop,
            behavior: 'smooth'
        });
    }, 100);
};

/**
 * Nascondi le guide pagina
 */
function hidePageGuides() {
    const container = document.getElementById('pageGuidesContainer');
    if (container) container.remove();

    const info = document.getElementById('pageInfoHeader');
    if (info) info.remove();
}

/**
 * Calcola e mostra statistiche pagina
 */
window.getPageStatistics = function () {
    const printArea = document.getElementById('printArea');
    if (!printArea) return null;

    const contentHeight = printArea.scrollHeight;
    const pageHeight = A4_DIMENSIONS.height.px;
    const numPages = Math.ceil(contentHeight / pageHeight);

    return {
        numPages,
        contentHeight,
        pageHeight,
        dimensions: A4_DIMENSIONS
    };
};

/**
 * Esporta dimensioni per uso in altri script
 */
window.A4_PAGE_HEIGHT = A4_DIMENSIONS.height.px;
window.A4_PAGE_WIDTH = A4_DIMENSIONS.width.px;

// Auto-inizializzazione
document.addEventListener('DOMContentLoaded', function () {
});
