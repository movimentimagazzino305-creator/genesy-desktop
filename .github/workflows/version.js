// version.js
const APP_VERSION = "4.3.117-ROMAGNA";

function initVersionDisplay() {
    // Show version in UI
    const versionEl = document.getElementById('appVersionDisplay');
    if (versionEl) {
        versionEl.textContent = `v${APP_VERSION}`;
    }
    
    // Show desktop (Electron) version below the web version (solo nell'app Desktop)
    if (window.electronAPI) {
        const desktopVer = window.electronAPI.version || '1.0.24';
        let desktopVerEl = document.getElementById('desktopVersionDisplay');
        if (!desktopVerEl && versionEl && versionEl.parentNode) {
            desktopVerEl = document.createElement('div');
            desktopVerEl.id = 'desktopVersionDisplay';
            versionEl.parentNode.insertBefore(desktopVerEl, versionEl.nextSibling);
        }
        if (desktopVerEl) {
            desktopVerEl.innerHTML = `<span style="background:#2563eb; color:#ffffff; font-weight:700; font-size:0.78rem; padding:3px 10px; border-radius:10px; display:inline-block; margin-top:4px; box-shadow: 0 2px 8px rgba(37,99,235,0.4); letter-spacing:0.5px;">Desktop v${desktopVer}</span>`;
        }
    }

    // Also update settings page version display
    const settingsVersionEl = document.querySelector('#settingsInfoCard p.text-muted');
    if (settingsVersionEl) {
        settingsVersionEl.textContent = `v${APP_VERSION} (Supabase)`;
    }

    // Check for updates (only if not on desktop app)
    if (!window.electronAPI) {
        checkAppUpdate();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVersionDisplay);
} else {
    initVersionDisplay();
}

async function checkAppUpdate() {
    try {
        const response = await fetch(`version.json?t=${Date.now()}`);
        if (!response.ok) return;
        const data = await response.json();
        const serverVersion = data.version;

        if (APP_VERSION === serverVersion) {
            localStorage.setItem('genesy_loaded_version', APP_VERSION);
            return;
        }

        const localVersion = localStorage.getItem('genesy_loaded_version');

        if (!localVersion) {
            localStorage.setItem('genesy_loaded_version', APP_VERSION);
            return;
        }

        if (serverVersion !== localVersion) {
            showUpdateAlert(serverVersion, localVersion, data.changelog);
        }
    } catch (e) {
        console.warn("Errore controllo versione:", e);
    }
}

function showUpdateAlert(newVer, oldVer, changelog) {
    if (document.getElementById('app-update-alert')) return;

    const overlay = document.createElement('div');
    overlay.id = 'app-update-alert';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(15, 23, 42, 0.7);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Outfit', sans-serif;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: linear-gradient(135deg, #1e293b, #0f172a);
        color: white;
        width: 90%;
        max-width: 500px;
        padding: 30px;
        border-radius: 20px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.15);
        border: 1px solid rgba(59, 130, 246, 0.3);
        transform: scale(0.9);
        opacity: 0;
        animation: modalZoomIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    `;

    let changelogHtml = '';
    if (changelog && changelog.length > 0) {
        changelogHtml = `
            <div style="margin: 20px 0; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.05); padding: 15px 20px; border-radius: 12px; max-height: 200px; overflow-y: auto;">
                <h5 style="margin: 0 0 10px 0; font-size: 0.85rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Novità di questa versione:</h5>
                <ul style="margin: 0; padding-left: 0; list-style: none;">
                    ${changelog.map(item => `
                        <li style="margin-bottom: 8px; font-size: 0.9rem; color: #cbd5e1; display: flex; gap: 10px; align-items: flex-start; line-height: 1.4;">
                            <span style="color: #2563eb; font-size: 0.8rem; margin-top: 4px;"><i class="fa-solid fa-circle-check"></i></span>
                            <span>${item}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    } else {
        changelogHtml = `
            <div style="margin: 20px 0; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.05); padding: 15px 20px; border-radius: 12px; text-align: center;">
                <p style="margin: 0; font-size: 0.9rem; color: #94a3b8; font-style: italic;">
                    Questa versione contiene ottimizzazioni delle prestazioni e correzioni di bug generali.
                </p>
            </div>
        `;
    }

    modal.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: #3b82f6; border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin: 0 auto 15px auto;">
                <i class="fa-solid fa-cloud-arrow-down"></i>
            </div>
            <h3 style="margin: 0 0 8px 0; font-size: 1.4rem; font-weight: 700; color: #f8fafc;">Nuovo Aggiornamento Disponibile</h3>
            <p style="margin: 0; font-size: 0.9rem; color: #94a3b8;">
                Versione attuale: <span style="text-decoration: line-through; color: #ef4444;">v${oldVer}</span> &rarr; Nuova versione: <span style="color: #4ade80; font-weight: 600;">v${newVer}</span>
            </p>
        </div>

        ${changelogHtml}

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 25px;">
            <button onclick="document.getElementById('app-update-alert').remove()" 
                    style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: all 0.2s;">
                Ignora
            </button>
            <button onclick="performAppUpdate('${newVer}')" 
                    style="background: linear-gradient(135deg, #2563eb, #1d4ed8); border: none; color: white; padding: 10px 24px; border-radius: 10px; cursor: pointer; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); transition: all 0.2s;">
                <i class="fa-solid fa-rotate"></i> Aggiorna Ora
            </button>
        </div>
    `;

    if (!document.getElementById('modal-anim-styles')) {
        const style = document.createElement('style');
        style.id = 'modal-anim-styles';
        style.innerHTML = `
            @keyframes modalZoomIn {
                from { transform: scale(0.9); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            #app-update-alert button:hover {
                filter: brightness(1.1);
                transform: translateY(-1px);
            }
            #app-update-alert button:active {
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

window.performAppUpdate = function(newVersion) {
    localStorage.setItem('genesy_loaded_version', newVersion);
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for(let registration of registrations) {
                registration.unregister();
            }
        });
    }
    
    window.location.reload(true);
}
