const os = require('os');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('    RILASCIO NUOVA VERSIONE - GENESY DESKTOP        ');
console.log('====================================================');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
    try {
        const pkgPath = path.join(__dirname, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const currentVersion = pkg.version || '1.0.15';

        console.log('Versione corrente: v' + currentVersion);

        // Calcola versione suggerita (+1 patch)
        const parts = currentVersion.split('.');
        const lastNum = parseInt(parts[parts.length - 1] || '0', 10) + 1;
        const suggestedVer = parts.slice(0, -1).concat(lastNum).join('.');

        const verInput = await ask('Inserisci nuova versione [Default: ' + suggestedVer + ']: ');
        const newVersion = verInput.trim() || suggestedVer;

        const titleInput = await ask("Titolo dell'aggiornamento [Default: Aggiornamento Genesy Desktop]: ");
        const updateTitle = titleInput.trim() || 'Aggiornamento Genesy Desktop';

        const noteInput = await ask("Novita' (separate da virgola) [Default: Miglioramenti generali e ottimizzazioni]: ");
        let changelog = [];
        if (noteInput.trim()) {
            changelog = noteInput.split(',').map(s => s.trim()).filter(Boolean);
        } else {
            changelog = ['Miglioramenti generali e ottimizzazioni di sistema'];
        }

        const deployChoice = await ask("\nVuoi pubblicare adesso su Netlify per tutti i colleghi? (S/n) [Default: S]: ");
        const shouldDeployNetlify = (deployChoice.trim().toLowerCase() !== 'n' && deployChoice.trim().toLowerCase() !== 'no');

        rl.close();

        console.log('\n--- 1. Aggiornamento file di versione ---');
        pkg.version = newVersion;
        if (!pkg.build) pkg.build = {};
        if (!pkg.build.directories) pkg.build.directories = {};
        pkg.build.directories.output = path.join(os.tmpdir(), 'genesy_dist').replace(/\\/g, '/');
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');

        // latest_release.json
        const releaseData = {
            version: newVersion,
            title: updateTitle,
            changelog: changelog,
            createdAt: new Date().toISOString(),
            downloadUrl: 'https://genesy.netlify.app/Genesy_Desktop_Setup.exe'
        };

        const latestRelPath = path.join(__dirname, 'latest_release.json');
        fs.writeFileSync(latestRelPath, JSON.stringify(releaseData, null, 2), 'utf8');

        const rootLatestRel = path.join(__dirname, '..', 'latest_release.json');
        fs.writeFileSync(rootLatestRel, JSON.stringify(releaseData, null, 2), 'utf8');

        console.log('[OK] Versione impostata a: v' + newVersion);

        console.log('\n--- 2. Compilazione Installer Desktop (electron-builder) ---');
        const tempBuildDir = path.join(os.tmpdir(), 'genesy_dist');
        if (fs.existsSync(tempBuildDir)) {
            try { fs.rmSync(tempBuildDir, { recursive: true, force: true }); } catch (_) {}
        }

        try {
            execSync('npx.cmd -y electron-builder --win', {
                stdio: 'inherit',
                cwd: __dirname
            });
        } catch (bErr) {
            console.warn('[Desktop Build] ⚠️ Errore compilazione installer:', bErr.message);
            throw bErr;
        }

        // Trova l'installer generato nella cartella locale
        if (fs.existsSync(tempBuildDir)) {
            const exeFiles = fs.readdirSync(tempBuildDir).filter(f => f.endsWith('.exe') && !f.includes('elevate') && !f.includes('uninstall'));
            if (exeFiles.length > 0) {
                exeFiles.sort((a, b) => fs.statSync(path.join(tempBuildDir, b)).mtimeMs - fs.statSync(path.join(tempBuildDir, a)).mtimeMs);
                const newestExe = path.join(tempBuildDir, exeFiles[0]);
                
                const distDir = path.join(__dirname, 'dist');
                if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

                fs.copyFileSync(newestExe, path.join(distDir, 'Genesy_Desktop_Setup.exe'));
                fs.copyFileSync(newestExe, path.join(__dirname, '..', 'Genesy_Desktop_Setup.exe'));
                console.log('[OK] Installer standardizzato: Genesy_Desktop_Setup.exe');

                try { fs.rmSync(tempBuildDir, { recursive: true, force: true }); } catch (_) {}
            }
        }

        console.log('\n--- 3. Preparazione cartella Web (__DEPLOY_ME__) ---');
        execSync('powershell -ExecutionPolicy Bypass -File "prepare_deploy.ps1"', {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });

        if (shouldDeployNetlify) {
            console.log('\n--- 4. Pubblicazione Online su Netlify (genesy.netlify.app) ---');
            try {
                console.log('[Netlify] Esecuzione deploy automatico su Netlify (genesy)...');
                execSync('node deploy_netlify.js', {
                    stdio: 'inherit',
                    cwd: path.join(__dirname, '..')
                });
                console.log('[Netlify] ✅ Deploy online completato con successo su https://genesy.netlify.app!');
            } catch (netErr) {
                console.warn('[Netlify] ⚠️ Avviso: Deploy automatico Netlify non completato:', netErr.message);
                console.log('[Netlify] 💡 Puoi aggiornare il sito online quando vuoi con "PUBBLICA_SU_NETLIFY.bat"');
            }
        } else {
            console.log('\n--- 4. Pubblicazione Online (Netlify) ---');
            console.log('[INFO] Upload su Netlify saltato (risparmio crediti/traffico).');
            console.log('[INFO] Tutti i file sono pronti nella cartella "__DEPLOY_ME__".');
            console.log('[INFO] Quando avrai finito tutto il lavoro, ti bastera\' lanciare');
            console.log('       "PUBBLICA_SU_NETLIFY.bat" per fare un unico deploy finale!');
        }

        console.log('\n====================================================');
        console.log('  SUCCESSO! VERSIONE v' + newVersion + ' PRONTA');
        console.log('====================================================');
        if (shouldDeployNetlify) {
            console.log('1. Web Online: Pubblicato su Netlify (https://genesy.netlify.app).');
            console.log('2. Desktop: Genesy_Desktop_Setup.exe pronto e caricato online.');
            console.log('3. Tutti i client desktop riceveranno la notifica e scaricheranno da Netlify!');
        } else {
            console.log('1. Cartella __DEPLOY_ME__ sincronizzata e pronta con installer e release.');
            console.log('2. Per pubblicare tutto insieme online quando sei pronto:');
            console.log('   fai doppio clic su "PUBBLICA_SU_NETLIFY.bat"');
        }
    } catch (err) {
        console.error('\n[ERRORE DURANTE IL RILASCIO]:', err.message);
        process.exit(1);
    }
}

main();
