/**
 * Agent Widget Sync (Redesigned)
 * Single source of truth for Header Agent Widget.
 * Contains hardcoded contact list as backup.
 */

// 1. MASTER CONTACT LIST (Populated from User Image)
const AGENT_MASTER_LIST = {
    'Fagioli Daniel': { phone: '3463079406', email: 'd.fagioli@parquetromagna.it' },
    'Lolla Beatrice': { phone: '3517401660', email: 'commerciale@parquetromagna.it' },
    'Mondello Filippo': { phone: '3313634839', email: 'f.mondello@parquetbologna.net' },
    'Monti Giacomo': { phone: '3296472805', email: 'g.monti@parquetromagna.it' },
    'Russo Edoardo': { phone: '3520263108', email: 'e.russo@parquetromagna.it' },
    'Russo Francesco': { phone: '3396787579', email: 'f.russo@parquetromagna.it' },
    'Luca': { phone: '333 1234567', email: 'luca@parquetromagna.it' },
    'Filippo': { phone: '333 7654321', email: 'filippo@parquetromagna.it' },
    'Gallon Marco': { phone: '334 2913907', email: 'm.gallon@parquetveneto.it' }
};
window.AGENT_MASTER_LIST = AGENT_MASTER_LIST;

// 2. MAIN UPDATE FUNCTION
function forceUpdateAgentWidget() {
    // CORRECTED IDs to match index.html
    const selector = document.getElementById('docAgent');
    const wName = document.getElementById('docAgentName');
    const wPhone = document.getElementById('docAgentPhone');
    const wEmail = document.getElementById('docAgentEmail');
    const syncIndicator = document.getElementById('syncIndicator');

    if (!selector || !wName) {
        // Elements not ready yet
        return;
    }

    const selectedName = selector.value;

    if (!selectedName) {
        wName.textContent = '--';
        if (wPhone) wPhone.textContent = '';
        if (wEmail) wEmail.textContent = '';
        return;
    }

    // A. Visual Name Update
    wName.textContent = selectedName;
    if (syncIndicator) syncIndicator.classList.add('hidden');

    // B. Data Lookup (Priority: Master List > Global Vars > Empty)
    let phone = '';
    let email = '';

    const masterData = AGENT_MASTER_LIST[selectedName];

    if (masterData) {
        phone = masterData.phone || '';
        email = masterData.email || '';
    } else {
        // Try global vars as backup
        if (window.db && window.db.getProductVars) {
            const vars = window.db.getProductVars();
            if (vars && vars.agentsMetadata && vars.agentsMetadata[selectedName]) {
                const userMeta = vars.agentsMetadata[selectedName];
                phone = userMeta.phone || '';
                email = userMeta.email || '';
            }
        }
    }

    // C. DOM Update with Icons (Widget Style)
    if (wPhone) {
        wPhone.innerHTML = phone ? `<i class="fa-solid fa-phone" style="margin-right:3px;"></i> ${phone}` : '';
    }
    if (wEmail) {
        wEmail.innerHTML = email ? `<i class="fa-solid fa-envelope" style="margin-right:3px;"></i> ${email}` : '';
    }

    // D. CONDITIONAL FONT RESIZE (For Long Emails/Names)
    const longAgents = ['Lolla Beatrice', 'Mondello Filippo'];
    if (wName && wName.parentElement) {
        if (longAgents.some(agent => selectedName.includes(agent))) {
            wName.parentElement.style.fontSize = '0.65rem'; // Reduced size
        } else {
            wName.parentElement.style.fontSize = '0.8rem'; // Default size
        }
    }
}

// 3. EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {

    const selector = document.getElementById('docAgent');
    if (selector) {
        // Native Change Event
        selector.addEventListener('change', forceUpdateAgentWidget);

        // Input Event (just in case)
        selector.addEventListener('input', forceUpdateAgentWidget);
    }

    // 4. OBSERVER (For when data is loaded via JS dynamically)
    // We poll briefly to catch the initial population of the dropdown
    let checks = 0;
    const interval = setInterval(() => {
        const val = document.getElementById('docAgent')?.value;
        if (val) {
            forceUpdateAgentWidget();
            // Don't clear interval immediately, data might settle
        }
        checks++;
        if (checks > 10) clearInterval(interval); // Stop after 5 seconds roughly
    }, 500);

    // Initial run
    forceUpdateAgentWidget();
});

// 5. GLOBAL EXPORT (To be called from app.js or other scripts if needed)
window.refreshAgentWidget = forceUpdateAgentWidget;
