const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { exec } = require('child_process');

// ── Ottimizzazioni performance per PC lenti ──────────────────────────────────
// Disabilita accelerazione GPU: risolve lentezza su PC con driver grafici datati
app.disableHardwareAcceleration();

// Flag Chromium per ridurre uso memoria e CPU
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors,SameSiteByDefaultCookies');
// ─────────────────────────────────────────────────────────────────────────────

let mainWindow;
let splashWindow;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 880,
    height: 560,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    title: 'Genesy Desktop - Parquet Romagna',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  splashWindow.on('closed', () => {
    splashWindow = null;
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'Genesy Desktop - Parquet Romagna',
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  // Standard Application Menu required for OS Keyboard Inputs & Shortcuts in Electron Windows Executable
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit', label: 'Esci' }
      ]
    },
    {
      label: 'Modifica',
      submenu: [
        { role: 'undo', label: 'Annulla' },
        { role: 'redo', label: 'Ripristina' },
        { type: 'separator' },
        { role: 'cut', label: 'Taglia' },
        { role: 'copy', label: 'Copia' },
        { role: 'paste', label: 'Incolla' },
        { role: 'delete', label: 'Elimina' },
        { role: 'selectall', label: 'Seleziona tutto' }
      ]
    },
    {
      label: 'Visualizza',
      submenu: [
        { role: 'reload', label: 'Ricarica' },
        { role: 'forceReload', label: 'Ricarica forzata' },
        { role: 'toggleDevTools', label: 'Strumenti sviluppatore' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Reimposta Zoom' },
        { role: 'zoomIn', label: 'Ingrandisci' },
        { role: 'zoomOut', label: 'Rimpicciolisci' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Schermo intero' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Handle external links in default OS browser — block ALL new Electron windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' }; // Blocca qualsiasi window.open() locale (evita finestra login fantasma)
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Safety fallback: guarantee mainWindow becomes visible after load
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
      if (splashWindow) splashWindow.close();
    }
  }, 8000);
}

// IPC listener from splash window
ipcMain.on('splash-complete', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
  if (splashWindow) {
    splashWindow.close();
  }
});

// IPC listener to return the application version to the sandboxed preload script
ipcMain.on('get-app-version', (event) => {
  try {
    event.returnValue = app.getVersion() || '';
  } catch (e) {
    event.returnValue = '';
  }
});

function downloadFileWithRedirects(targetUrl, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const requestUrl = (currentUrl) => {
      const client = currentUrl.startsWith('https') ? https : http;
      const req = client.get(currentUrl, {
        headers: {
          'User-Agent': 'GenesyDesktopAutoUpdater/1.0',
          'Accept': '*/*'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return requestUrl(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP Download error: status ${res.statusCode}`));
        }
        const totalSize = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const fileStream = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          fileStream.write(chunk);
          if (totalSize > 0 && onProgress) {
            onProgress(Math.round((downloaded / totalSize) * 100));
          }
        });

        res.on('end', () => {
          fileStream.end();
          resolve(destPath);
        });

        res.on('error', (err) => {
          fileStream.close();
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });
      req.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };
    requestUrl(targetUrl);
  });
}

// IPC listener for auto-download and automatic installation execution
ipcMain.on('download-and-install-update', async (event, payload) => {
  const { url, version } = payload || {};
  try {
    if (!url) {
      event.sender.send('update-download-error', { error: 'URL download non valido' });
      return;
    }

    const destPath = path.join(app.getPath('temp'), `Genesy_Desktop_Setup_${version || 'latest'}.exe`);

    await downloadFileWithRedirects(url, destPath, (pct) => {
      event.sender.send('update-download-progress', { pct });
    });

    event.sender.send('update-download-complete', { destPath });

    // Avvia l'installer tramite shell del sistema operativo (gestisce elevazione UAC).
    // L'installer NSIS (runAfterFinish: true) riaprirà l'app automaticamente dopo l'installazione.
    // app.relaunch() viene registrato come fallback nel caso l'installer non avvii l'app da solo.
    setTimeout(async () => {
      try {
        // Registra il relaunch PRIMA di avviare l'installer, così se l'installer
        // non avvia l'app da solo, Electron lo farà come fallback.
        app.relaunch();

        await shell.openPath(destPath);

        // Attendi abbastanza a lungo da permettere all'installer one-click di completarsi
        // e riaprire l'app. Se l'installer lo fa da solo (runAfterFinish: true),
        // il relaunch() sopra verrà ignorato poiché l'app viene già avviata dall'installer.
        setTimeout(() => {
          app.exit(0); // exit(0) rispetta il relaunch registrato sopra
        }, 8000);
      } catch (launchErr) {
        console.error('[AutoUpdate] Errore avvio installer:', launchErr);
      }
    }, 1000);
  } catch (err) {
    console.error('[AutoUpdate] Errore download:', err);
    event.sender.send('update-download-error', { error: err.message });
  }
});

app.whenReady().then(() => {
  createSplashWindow();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
