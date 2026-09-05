/**
 * desktop-updater.js
 * Sistema di auto-aggiornamento per Genesy Desktop (Electron).
 * 
 * Funziona SOLO quando window.electronAPI è presente (app Desktop).
 * - Recupera latest_release.json da GitHub
 * - Confronta con la versione Electron corrente (package.json via IPC)
 * - Mostra la modale #updateModal se esiste una versione più recente
 * - Gestisce snooze "Ricordamelo più tardi" (24 ore)
 * - Avvia download + installazione tramite Electron IPC
 */

(function () {
    'use strict';

    // Esegui solo nell'app Desktop
    if (!window.electronAPI) return;

    const LATEST_RELEASE_URL = 'https://genesy.netlify.app/latest_release.json';

    const SNOOZE_KEY   = 'genesy_update_snoozed_until';
    const SNOOZE_HOURS = 24;

    // ── Utility: confronto semantico versioni ────────────────────────────────────
    /**
     * Ritorna true se remoteVersion è più recente di localVersion.
     * Gestisce schemi "1.2.3" e "1.2.3-LABEL" (il suffisso viene ignorato).
     */
    function isNewer(remoteVersion, localVersion) {
        const parse = (v) => String(v || '0').split('-')[0].split('.').map(Number);
        const r = parse(remoteVersion);
        const l = parse(localVersion);
        for (let i = 0; i < Math.max(r.length, l.length); i++) {
            const rv = r[i] || 0;
            const lv = l[i] || 0;
            if (rv > lv) return true;
            if (rv < lv) return false;
        }
        return false;
    }

    // ── Snooze helpers ────────────────────────────────────────────────────────────
    function isSnoozed() {
        const until = localStorage.getItem(SNOOZE_KEY);
        if (!until) return false;
        return Date.now() < Number(until);
    }

    function setSnooze() {
        const until = Date.now() + SNOOZE_HOURS * 60 * 60 * 1000;
        localStorage.setItem(SNOOZE_KEY, String(until));
    }

    function clearSnooze() {
        localStorage.removeItem(SNOOZE_KEY);
    }

    // ── Popola e mostra la modale ─────────────────────────────────────────────────
    function showUpdateModal(release) {
        const modal = document.getElementById('updateModal');
        if (!modal) {
            console.warn('[Updater] Modale #updateModal non trovata nel DOM.');
            return;
        }

        // Badge versione
        const badge = document.getElementById('updateModalBadge');
        if (badge) badge.textContent = 'v' + release.version;

        // Titolo
        const titleEl = document.getElementById('updateModalTitle');
        if (titleEl) titleEl.textContent = release.title || 'Nuovo Aggiornamento Disponibile!';

        // Changelog
        const list = document.getElementById('updateModalChangelog');
        if (list) {
            list.innerHTML = '';
            const items = Array.isArray(release.changelog) ? release.changelog : [];
            if (items.length === 0) {
                list.innerHTML = '<li style="color:#64748b; font-style:italic;">Miglioramenti generali e correzioni di bug.</li>';
            } else {
                items.forEach(item => {
                    const li = document.createElement('li');
                    li.style.cssText = 'margin-bottom:6px; color:#334155;';
                    li.textContent = item;
                    list.appendChild(li);
                });
            }
        }

        // Nascondi progress bar
        const progressBox = document.getElementById('updateProgressBox');
        if (progressBox) progressBox.style.display = 'none';

        // Ripristina pulsanti
        const btnStart = document.getElementById('btnStartAutoUpdate');
        if (btnStart) {
            btnStart.disabled = false;
            btnStart.innerHTML = '<i class="fa-solid fa-download"></i> Aggiorna Ora';
        }

        // Salva URL download nell'elemento per usarlo dopo
        modal.dataset.downloadUrl = release.downloadUrl || '';
        modal.dataset.newVersion  = release.version || '';

        // Mostra modale
        modal.style.display = 'flex';
        modal.classList.remove('hidden');

        console.log(`[Updater] Modale mostrata per la versione ${release.version}`);
    }

    // ── Chiudi modale (con snooze opzionale) ─────────────────────────────────────
    window.closeUpdateModal = function (snooze = false) {
        const modal = document.getElementById('updateModal');
        if (!modal) return;
        modal.style.display = 'none';
        modal.classList.add('hidden');
        if (snooze) {
            setSnooze();
            console.log(`[Updater] Aggiornamento rimandato di ${SNOOZE_HOURS} ore.`);
        }
    };

    // ── Avvia download + installazione ───────────────────────────────────────────
    window.triggerAutoUpdateDownload = function () {
        const modal = document.getElementById('updateModal');
        if (!modal) return;

        const downloadUrl = modal.dataset.downloadUrl;
        const newVersion  = modal.dataset.newVersion;

        if (!downloadUrl) {
            alert('URL di download non disponibile. Riprova più tardi.');
            return;
        }

        if (!window.electronAPI || typeof window.electronAPI.downloadAndInstallUpdate !== 'function') {
            alert('Funzione di aggiornamento non disponibile in questa versione dell\'app.\nAggiorna manualmente.');
            return;
        }

        // UI: mostra progress bar, disabilita pulsante
        const progressBox  = document.getElementById('updateProgressBox');
        const progressBar  = document.getElementById('updateProgressBar');
        const progressPct  = document.getElementById('updateProgressPct');
        const progressText = document.getElementById('updateProgressText');
        const btnStart     = document.getElementById('btnStartAutoUpdate');
        const btnPostpone  = document.getElementById('btnPostponeUpdate');

        if (progressBox)  progressBox.style.display = 'block';
        if (btnStart)     { btnStart.disabled = true; btnStart.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Download...'; }
        if (btnPostpone)  btnPostpone.style.display = 'none';

        // Listener progress
        window.electronAPI.onUpdateProgress((data) => {
            const pct = data && data.pct ? data.pct : 0;
            if (progressBar)  progressBar.style.width = pct + '%';
            if (progressPct)  progressPct.textContent = pct + '%';
            if (progressText) progressText.textContent = 'Download in corso...';
        });

        // Listener completamento
        window.electronAPI.onUpdateComplete((data) => {
            if (progressBar)  progressBar.style.width = '100%';
            if (progressPct)  progressPct.textContent = '100%';
            if (progressText) progressText.textContent = 'Download completato! Avvio installazione...';
            if (btnStart)     btnStart.innerHTML = '<i class="fa-solid fa-check"></i> Installazione avviata';
            clearSnooze();
        });

        // Listener errore
        window.electronAPI.onUpdateError((data) => {
            const errMsg = (data && data.error) ? data.error : 'Errore sconosciuto';
            if (progressText) progressText.textContent = '❌ Errore: ' + errMsg;
            if (progressBar)  progressBar.style.background = '#ef4444';
            if (btnStart)     { btnStart.disabled = false; btnStart.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Riprova'; }
            if (btnPostpone)  btnPostpone.style.display = '';
            console.error('[Updater] Errore download:', errMsg);
        });

        // Avvia download tramite Electron IPC
        clearSnooze();
        window.electronAPI.downloadAndInstallUpdate({
            url:     downloadUrl,
            version: newVersion
        });

        console.log(`[Updater] Download avviato: ${downloadUrl}`);
    };

    // ── Check principale aggiornamenti ───────────────────────────────────────────
    async function checkDesktopUpdate() {
        // Versione corrente dell'installer (da Electron package.json via IPC)
        const currentVersion = window.electronAPI.version;
        if (!currentVersion) {
            console.warn('[Updater] Versione Desktop non disponibile, salto il check.');
            return;
        }

        console.log(`[Updater] Versione installata: v${currentVersion}`);

        // Controlla snooze
        if (isSnoozed()) {
            console.log('[Updater] Aggiornamento in snooze, salto il check.');
            return;
        }

        try {
            const response = await fetch(LATEST_RELEASE_URL + '?t=' + Date.now(), {
                cache: 'no-store'
            });

            if (!response.ok) {
                console.warn(`[Updater] Impossibile recuperare latest_release.json (HTTP ${response.status})`);
                return;
            }

            const release = await response.json();
            console.log(`[Updater] Versione remota: v${release.version}`);

            if (!release.version) {
                console.warn('[Updater] latest_release.json non contiene il campo "version".');
                return;
            }

            if (isNewer(release.version, currentVersion)) {
                console.log(`[Updater] ✅ Nuova versione disponibile: v${release.version}`);
                showUpdateModal(release);
            } else {
                console.log('[Updater] App già aggiornata all\'ultima versione.');
            }
        } catch (err) {
            // Nessun alert: fallimento silenzioso (potrebbe essere offline)
            console.warn('[Updater] Errore durante il check aggiornamenti:', err.message);
        }
    }

    // ── Avvio: aspetta che il DOM sia pronto ─────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Ritardo breve per lasciare caricare l'UI principale
            setTimeout(checkDesktopUpdate, 3000);
        });
    } else {
        setTimeout(checkDesktopUpdate, 3000);
    }

})();
