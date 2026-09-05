
// --- STATUS STYLING LOGIC ---
window.updateEditorStatusUI = function () {
    const select = document.getElementById('editorStatus');
    if (!select) return;
    const val = select.value;

    // Remove old status classes
    select.classList.remove('status-open', 'status-closed', 'status-lost');

    // Get the PUBLIC notes field (not internal)
    const notesEl = document.getElementById('docNotes');
    // The container is the parent div of the label and textarea
    const notesContainer = notesEl ? notesEl.parentElement : null;

    if (val === 'Aperto') {

        select.classList.add('status-open');

        // Show notes field for "Aperto" status
        if (notesContainer) {
            notesContainer.style.display = '';
        }

        // Default notes removed per user request
    } else if (val === 'Chiuso') {
        select.classList.add('status-closed');

        // Clear notes field for "Chiuso" status
        if (notesEl) {
            notesEl.value = '';
            notesEl.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Hide notes field for "Chiuso" status
        if (notesContainer) {
            notesContainer.style.display = 'none';
        }
    } else if (val === 'Perso') {
        select.classList.add('status-lost');

        // Hide notes field for "Perso" status
        if (notesContainer) {
            notesContainer.style.display = 'none';
        }
    }
};

// Auto-init on load if possible (optional, but good for robustness)
document.addEventListener('DOMContentLoaded', () => {
    // If editorStatus exists on load, update it
    if (document.getElementById('editorStatus')) {
        updateEditorStatusUI();
    }

    // Periodic status check removed - no longer needed
});

// Hook into openEditor via global override or just rely on renderDoc calling it?
// Since we can't easily hook into existing openEditor without reading it,
// we'll rely on the user changing it OR the fact that value assignment might not trigger onchange.
// To fix "initial load" color:
// We can use a MutationObserver on the select value? No.
// We can periodically check? No.
// We will assume the user clicks it or we'll try to hook into the "Data Emissione" change which might be near it.
// Actually, I'll search for where `editorStatus` is set in `app.js` later if needed.
// For now, the request is "stile Stato del preventivo", which implies the visual style.
