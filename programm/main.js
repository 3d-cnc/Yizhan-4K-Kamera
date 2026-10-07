/*
 * Yizhan 4K Kamera - Live-Bild, Fotos und Videos als Windows-Programm.
 *
 * Die Oberflaeche (app/index.html) holt das Bild ueber getUserMedia von der Kamera
 * und stellt deren Regler (Helligkeit, Belichtung, Weissabgleich ...) ueber
 * applyConstraints. Dieses Hauptprogramm kuemmert sich um alles mit Dateien:
 *
 *  - Fotos speichern, Videos stueckweise auf die Platte schreiben (kein Puffern im Speicher)
 *  - Galerie: Dateien im Speicherordner auflisten, ueber medien:// zeigen (mit Range fuer Videos)
 *  - Oeffnen, im Ordner zeigen, in die Zwischenablage, in den Papierkorb
 *  - Schliessen waehrend einer Aufnahme: nachfragen, Aufnahme sauber beenden
 *  - Der Fensterinhalt startet 1920 x 1080; gemerkt wird die Position (fenster.json).
 *
 * `electron . --pruefen[=bild.png]` startet unsichtbar, nimmt Foto und Video auf,
 * prueft die Dateien, fotografiert jede Seite und beendet sich - mit Fehlercode,
 * wenn etwas nicht stimmt. `--demo` nimmt statt der echten Kamera Chromiums Testbild.
 */

const { app, BrowserWindow, ClipboardItem, clipboard, dialog, ipcMain, nativeImage, nativeTheme, protocol, screen, shell } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pruefen = process.argv.find((a) => a.startsWith('--pruefen'));
const demo = process.argv.includes('--demo');

if (demo) {
    app.commandLine.appendSwitch('use-fake-device-for-media-stream');
}
if (pruefen) {
    app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'yizhan-4k-pruefen-')));
}

// Galerie-Dateien als medien://datei/<name>; standard + stream, damit Videos spulen koennen
protocol.registerSchemesAsPrivileged([
    { scheme: 'medien', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

let fenster = null;

/* ------------------------------------------------------------ Einstellungen und Fensterlage */

const BREITE = 1920;
const HOEHE = 1080;
const TITELLEISTE = 40;
const HINTERGRUND = { dunkel: '#0e1115', hell: '#eef1f5' };
const datei = (name) => path.join(app.getPath('userData'), name);

function jsonLesen(name) {
    try {
        return JSON.parse(fs.readFileSync(datei(name), 'utf8'));
    } catch {
        return {};
    }
}

function jsonSchreiben(name, wert) {
    try {
        fs.mkdirSync(app.getPath('userData'), { recursive: true });
        fs.writeFileSync(datei(name), JSON.stringify(wert, null, 2));
    } catch {
        /* nicht schlimm */
    }
}

let einstellungen = { thema: 'dunkel', ordner: '' };

function einstellungenLesen() {
    const e = jsonLesen('einstellungen.json');
    einstellungen = {
        thema: e.thema === 'hell' ? 'hell' : 'dunkel',
        ordner: typeof e.ordner === 'string' ? e.ordner : '',
    };
    nativeTheme.themeSource = einstellungen.thema === 'hell' ? 'light' : 'dark';
}

const vorgabeOrdner = () => pruefen ? datei('bilder') : path.join(app.getPath('pictures'), 'Yizhan 4K');
const speicherOrdner = () => einstellungen.ordner || vorgabeOrdner();

function lageLesen() {
    const lage = jsonLesen('fenster.json');
    const punkt = Number.isFinite(lage.x) ? { x: lage.x + 100, y: lage.y + 50 } : screen.getCursorScreenPoint();
    const b = screen.getDisplayNearestPoint(punkt).workArea;
    const passt = BREITE <= b.width && HOEHE + TITELLEISTE <= b.height;
    const x = Number.isFinite(lage.x) ? Math.min(Math.max(lage.x, b.x), b.x + b.width - BREITE) : b.x + Math.round((b.width - BREITE) / 2);
    const y = Number.isFinite(lage.y) ? Math.min(Math.max(lage.y, b.y), b.y + b.height - HOEHE - TITELLEISTE) : b.y + Math.max(0, Math.round((b.height - HOEHE - TITELLEISTE) / 2));
    return passt ? { x, y, maximiert: !!lage.maximiert } : { maximiert: true };
}

function lageSpeichern() {
    if (!fenster || pruefen) return;
    const maximiert = fenster.isMaximized();
    const { x, y } = maximiert ? fenster.getNormalBounds() : fenster.getBounds();
    jsonSchreiben('fenster.json', { x, y, maximiert });
}

/* ------------------------------------------------------------ Fenster */

let aufnahmeLaeuft = false;
let darfSchliessen = false;

function fensterOeffnen() {
    const lage = lageLesen();
    fenster = new BrowserWindow({
        x: lage.x,
        y: lage.y,
        width: BREITE,
        height: HOEHE,
        useContentSize: true,
        minWidth: 960,
        minHeight: 600,
        show: false,
        title: 'Yizhan 4K Kamera',
        icon: path.join(__dirname, 'build', 'icon.png'),
        backgroundColor: HINTERGRUND[einstellungen.thema],
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            sandbox: true,
            // Intervallfotos und Aufnahme laufen auch minimiert im vollen Takt weiter
            backgroundThrottling: false,
            autoplayPolicy: 'no-user-gesture-required',
        },
    });
    fenster.setMenuBarVisibility(false);

    // Nur die Kamera (kein Mikrofon, kein Bildschirm) und ohne Rückfrage
    const sitzung = fenster.webContents.session;
    sitzung.setPermissionRequestHandler((_wc, recht, antwort, details) => {
        antwort(recht === 'media' && !(details.mediaTypes ?? []).includes('audio'));
    });
    sitzung.setPermissionCheckHandler((_wc, recht) => recht === 'media');

    fenster.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    fenster.webContents.on('will-navigate', (e) => e.preventDefault());

    // Läuft eine Aufnahme, erst fragen, dann die Seite die Datei sauber abschließen lassen
    fenster.on('close', (ereignis) => {
        lageSpeichern();
        if (!aufnahmeLaeuft || darfSchliessen || pruefen) return;
        ereignis.preventDefault();
        const wahl = dialog.showMessageBoxSync(fenster, {
            type: 'question',
            buttons: ['Aufnahme beenden und schließen', 'Weiter aufnehmen'],
            defaultId: 1,
            cancelId: 1,
            title: 'Yizhan 4K Kamera',
            message: 'Es läuft noch eine Videoaufnahme.',
        });
        if (wahl !== 0) return;
        darfSchliessen = true;
        fenster.webContents.send('aufnahme-beenden-und-schliessen');
        // Falls die Seite nicht antwortet: nach 8 s trotzdem schließen
        setTimeout(() => fenster?.destroy(), 8000);
    });
    fenster.on('closed', () => { fenster = null; });

    fenster.once('ready-to-show', () => {
        if (pruefen) {
            // Selbsttest: durchsichtig, aber wirklich gezeigt - versteckt liefert Chromium kaum Videobilder
            fenster.setOpacity(0);
            fenster.setSkipTaskbar(true);
            fenster.showInactive();
            return;
        }
        if (lage.maximiert) fenster.maximize();
        fenster.show();
    });

    fenster.loadFile(path.join(__dirname, 'app', 'index.html'));
}

/* ------------------------------------------------------------ Dateien */

const FOTO = /\.(jpe?g|png|webp)$/i;
const VIDEO = /\.(mp4|webm|mkv)$/i;

// Nur einfache Dateinamen direkt im Speicherordner - nie Pfade von der Seite übernehmen
function imOrdner(name) {
    const n = path.basename(String(name));
    if (!n || n !== String(name) || !(FOTO.test(n) || VIDEO.test(n))) throw new Error('ungültiger Dateiname');
    return path.join(speicherOrdner(), n);
}

// Gibt es den Namen schon (zwei Fotos in derselben Sekunde), hinten -2, -3 … anhängen
function freierName(name) {
    const ordner = speicherOrdner();
    fs.mkdirSync(ordner, { recursive: true });
    const { name: stamm, ext } = path.parse(path.basename(name));
    let n = `${stamm}${ext}`;
    for (let i = 2; fs.existsSync(path.join(ordner, n)); i++) n = `${stamm}-${i}${ext}`;
    return n;
}

ipcMain.handle('ordner', () => speicherOrdner());
ipcMain.handle('ordner-waehlen', async () => {
    const r = await dialog.showOpenDialog(fenster, {
        title: 'Ordner für Fotos und Videos',
        defaultPath: speicherOrdner(),
        properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    einstellungen.ordner = r.filePaths[0] === vorgabeOrdner() ? '' : r.filePaths[0];
    jsonSchreiben('einstellungen.json', einstellungen);
    return speicherOrdner();
});
ipcMain.handle('ordner-oeffnen', () => {
    fs.mkdirSync(speicherOrdner(), { recursive: true });
    return shell.openPath(speicherOrdner());
});

// Freier Platz auf dem Laufwerk des Speicherordners (in Bytes)
ipcMain.handle('platz', () => {
    try {
        fs.mkdirSync(speicherOrdner(), { recursive: true });
        const s = fs.statfsSync(speicherOrdner());
        return s.bavail * s.bsize;
    } catch {
        return null;
    }
});

ipcMain.handle('foto-speichern', (_e, name, daten) => {
    const n = freierName(name);
    if (!FOTO.test(n)) throw new Error('kein Fotoformat');
    fs.writeFileSync(path.join(speicherOrdner(), n), Buffer.from(daten));
    return n;
});

// Video: Datei anlegen, Stücke anhängen, schließen. Die Seite kennt nur die Nummer.
const videos = new Map();
let naechstesVideo = 1;
ipcMain.handle('video-beginnen', (_e, name) => {
    const n = freierName(name);
    if (!VIDEO.test(n)) throw new Error('kein Videoformat');
    const id = naechstesVideo++;
    videos.set(id, { fd: fs.openSync(path.join(speicherOrdner(), n), 'w'), name: n, bytes: 0 });
    aufnahmeLaeuft = true;
    return { id, name: n };
});
ipcMain.handle('video-anhaengen', (_e, id, daten) => {
    const v = videos.get(id);
    if (!v) return false;
    const puffer = Buffer.from(daten);
    fs.writeSync(v.fd, puffer);
    v.bytes += puffer.length;
    return v.bytes;
});
ipcMain.handle('video-schliessen', (_e, id) => {
    const v = videos.get(id);
    if (!v) return null;
    fs.closeSync(v.fd);
    videos.delete(id);
    aufnahmeLaeuft = videos.size > 0;
    // Leere Aufnahme (Kamera weg, sofort gestoppt): nicht als kaputte Datei liegen lassen
    if (v.bytes === 0) fs.rmSync(path.join(speicherOrdner(), v.name), { force: true });
    return v.bytes ? v.name : null;
});
ipcMain.on('fertig-zum-schliessen', () => fenster?.close());

// Galerie: Fotos und Videos im Speicherordner, neueste zuerst
ipcMain.handle('dateien', () => {
    const ordner = speicherOrdner();
    let namen = [];
    try {
        namen = fs.readdirSync(ordner).filter((n) => FOTO.test(n) || VIDEO.test(n));
    } catch {
        return [];
    }
    return namen.map((n) => {
        try {
            const s = fs.statSync(path.join(ordner, n));
            return s.isFile() ? { name: n, art: VIDEO.test(n) ? 'video' : 'foto', groesse: s.size, zeit: s.mtimeMs } : null;
        } catch {
            return null;
        }
    }).filter(Boolean).sort((a, b) => b.zeit - a.zeit);
});

ipcMain.handle('datei-oeffnen', (_e, name) => shell.openPath(imOrdner(name)));
ipcMain.handle('datei-zeigen', (_e, name) => { shell.showItemInFolder(imOrdner(name)); return true; });
ipcMain.handle('datei-loeschen', async (_e, name) => {
    if (pruefen) {
        fs.rmSync(imOrdner(name));
        return true;
    }
    await shell.trashItem(imOrdner(name));
    return true;
});
ipcMain.handle('datei-kopieren', async (_e, name) => {
    const pfad = imOrdner(name);
    if (!FOTO.test(pfad)) return false;
    // Electron 44: Zwischenablage nach dem W3C-Muster; PNG verstehen alle Programme
    const png = nativeImage.createFromPath(pfad).toPNG();
    await clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })]);
    return true;
});

// medien://datei/<name> - nur Dateien aus dem Speicherordner, mit Range-Anfragen für Videos
const TYPEN = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska' };

// Kleine Vorschaubilder macht Windows selbst (auch für MP4); gemerkt nach Name und Änderungszeit
const vorschauen = new Map();

async function vorschauAntwort(pfad) {
    let s;
    try {
        s = fs.statSync(pfad);
    } catch {
        return new Response('nicht gefunden', { status: 404 });
    }
    const schluessel = `${pfad}|${s.mtimeMs}`;
    let jpg = vorschauen.get(schluessel);
    if (!jpg) {
        try {
            const bild = await nativeImage.createThumbnailFromPath(pfad, { width: 384, height: 216 });
            if (bild.isEmpty()) throw new Error('leer');
            jpg = bild.toJPEG(82);
        } catch {
            // Kein Vorschaubild von Windows: bei Fotos selbst verkleinern, bei Videos aufgeben
            if (!FOTO.test(pfad)) return new Response('keine Vorschau', { status: 404 });
            jpg = nativeImage.createFromPath(pfad).resize({ width: 384 }).toJPEG(82);
        }
        if (vorschauen.size > 2000) vorschauen.clear();
        vorschauen.set(schluessel, jpg);
    }
    return new Response(jpg, { status: 200, headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' } });
}

function medienAntwort(anfrage) {
    let pfad, url;
    try {
        url = new URL(anfrage.url);
        pfad = imOrdner(decodeURIComponent(url.pathname.replace(/^\//, '')));
    } catch {
        return new Response('nicht erlaubt', { status: 403 });
    }
    if (url.hostname === 'vorschau') return vorschauAntwort(pfad);
    let groesse;
    try {
        groesse = fs.statSync(pfad).size;
    } catch {
        return new Response('nicht gefunden', { status: 404 });
    }
    const typ = TYPEN[path.extname(pfad).toLowerCase()] ?? 'application/octet-stream';
    const kopf = { 'Content-Type': typ, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
    const bereich = /^bytes=(\d*)-(\d*)$/.exec(anfrage.headers.get('range') ?? '');
    if (bereich && groesse > 0) {
        let start = bereich[1] === '' ? groesse - Number(bereich[2]) : Number(bereich[1]);
        let ende = bereich[1] !== '' && bereich[2] !== '' ? Number(bereich[2]) : groesse - 1;
        start = Math.max(0, start);
        ende = Math.min(ende, groesse - 1);
        if (start > ende) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${groesse}` } });
        const strom = fs.createReadStream(pfad, { start, end: ende });
        return new Response(require('node:stream').Readable.toWeb(strom), {
            status: 206,
            headers: { ...kopf, 'Content-Length': String(ende - start + 1), 'Content-Range': `bytes ${start}-${ende}/${groesse}` },
        });
    }
    return new Response(require('node:stream').Readable.toWeb(fs.createReadStream(pfad)), { status: 200, headers: { ...kopf, 'Content-Length': String(groesse) } });
}

/* ------------------------------------------------------------ Sonstiges */

ipcMain.handle('version', () => app.getVersion());
ipcMain.on('thema', (_e, thema) => {
    thema = thema === 'hell' ? 'hell' : 'dunkel';
    nativeTheme.themeSource = thema === 'hell' ? 'light' : 'dark';
    fenster?.setBackgroundColor(HINTERGRUND[thema]);
    if (einstellungen.thema !== thema) {
        einstellungen.thema = thema;
        jsonSchreiben('einstellungen.json', einstellungen);
    }
});
ipcMain.on('vollbild', () => fenster?.setFullScreen(!fenster.isFullScreen()));
ipcMain.on('vollbild-aus', () => { if (fenster?.isFullScreen()) fenster.setFullScreen(false); });
ipcMain.on('beenden', () => fenster?.close());
ipcMain.on('aufmerksamkeit', () => { if (fenster && !fenster.isFocused()) fenster.flashFrame(true); });

/* ------------------------------------------------------------ Selbsttest */

// Fehler der Seite sammeln; am Ende Exit-Code 1, wenn es welche gab
const seitenFehler = [];

async function selbsttest() {
    const wc = fenster.webContents;
    wc.on('console-message', (e) => {
        if (e.level === 'error') seitenFehler.push(e.message);
    });
    const warte = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (code) => wc.executeJavaScript(code, true);
    const ziel = typeof pruefen === 'string' && pruefen.includes('=') ? pruefen.split('=')[1] : path.join(process.cwd(), 'pruefen.png');
    const bildPfad = (zusatz) => ziel.replace(/\.png$/i, '') + (zusatz ? `-${zusatz}` : '') + '.png';
    const fehler = [];
    // Ausgabe auch in eine Datei neben den Bildern – die fertige .exe hat keine Konsole
    const logDatei = bildPfad('log').replace(/\.png$/, '.txt');
    fs.writeFileSync(logDatei, '');
    const log = (text) => { console.log(text); fs.appendFileSync(logDatei, text + '\n'); };
    const pruefe = (bedingung, text) => { if (!bedingung) fehler.push(text); log(`${bedingung ? 'ok  ' : 'FEHL'} ${text}`); };
    const foto = async (zusatz) => {
        await warte(400);
        const bild = await wc.capturePage();
        fs.writeFileSync(bildPfad(zusatz), bild.toPNG());
    };

    try {
        // Warten, bis Bilder kommen
        let lauf = null;
        for (let i = 0; i < 40; i++) {
            lauf = await js('window.pruefZustand?.()');
            if (lauf?.bilder > 10) break;
            await warte(250);
        }
        pruefe(lauf?.bilder > 10, `Live-Bild läuft (${lauf?.kamera}, ${lauf?.breite}×${lauf?.hoehe}, ${lauf?.fps} B/s)`);
        pruefe(lauf?.regler > 0, `Regler aus der Kamera gebaut (${lauf?.regler})`);

        const groesse = await js('[innerWidth, innerHeight, document.documentElement.scrollHeight, document.querySelector("#seitenleiste").scrollHeight - document.querySelector("#seitenleiste").clientHeight]');
        pruefe(groesse[0] === BREITE && groesse[1] === HOEHE, `Fensterinhalt ${groesse[0]}×${groesse[1]}`);
        pruefe(groesse[2] <= HOEHE && groesse[3] <= 0, `Live-Seite passt ohne Scrollen (Seite ${groesse[2]}, Seitenleiste ${groesse[3]} zu viel)`);

        // Ansicht: Spiegeln, Raster, Zoom
        await js('pruefKlick("#spiegeln-h"); pruefKlick("#raster"); pruefKlick("#fadenkreuz"); ansicht.zoomen(2, 0.3, 0.3);');
        await foto('live');
        await js('ansicht.zuruecksetzen(); pruefKlick("#raster");');

        // Regler: ersten Regler verschieben und zurück
        const regler = await js('window.pruefRegler?.()');
        pruefe(regler?.ok, `Regler stellt die Kamera (${regler?.text})`);

        // Foto
        const vorher = (await js('kam.dateien()')).length;
        await js('pruefKlick("#foto")');
        let nachher = vorher;
        for (let i = 0; i < 20 && nachher === vorher; i++) { await warte(200); nachher = (await js('kam.dateien()')).length; }
        pruefe(nachher === vorher + 1, 'Foto gespeichert');
        const dateien = await js('kam.dateien()');
        const fotoDatei = dateien.find((d) => d.art === 'foto');
        if (fotoDatei) {
            const masse = await js(`new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.onerror = () => ok(null); i.src = 'medien://datei/' + encodeURIComponent(${JSON.stringify(fotoDatei.name)}); })`);
            pruefe(masse && masse[0] === lauf.breite && masse[1] === lauf.hoehe, `Foto in voller Auflösung (${masse?.join('×')})`);
        }

        // Video, 3 s, gespiegelt (läuft dann über die Leinwand)
        await js('pruefKlick("#aufnahme")');
        await warte(3500);
        const laeuft = await js('aufnahme.laeuft()');
        pruefe(laeuft, 'Aufnahme läuft');
        await foto('aufnahme');
        await js('pruefKlick("#aufnahme")');
        let video = null;
        for (let i = 0; i < 30 && !video; i++) { await warte(200); video = (await js('kam.dateien()')).find((d) => d.art === 'video'); }
        pruefe(video && video.groesse > 1000, `Video gespeichert (${video?.name}, ${video?.groesse} Bytes)`);
        if (video) {
            const dauer = await js(`new Promise((ok) => { const v = document.createElement('video'); v.muted = true; v.preload = 'metadata';
                v.onloadedmetadata = () => { if (v.duration === Infinity) { v.currentTime = 1e9; v.ontimeupdate = () => { v.ontimeupdate = null; ok([v.duration, v.videoWidth, v.videoHeight]); }; } else ok([v.duration, v.videoWidth, v.videoHeight]); };
                v.onerror = () => ok(null); v.src = 'medien://datei/' + encodeURIComponent(${JSON.stringify(video.name)}); setTimeout(() => ok(null), 8000); })`);
            pruefe(dauer && dauer[0] > 2 && dauer[0] < 6, `Video abspielbar (${dauer?.map((x) => Math.round(x * 10) / 10).join(', ')})`);
        }
        await js('pruefKlick("#spiegeln-h"); pruefKlick("#fadenkreuz");');

        // Intervallfotos: 3 Bilder im Abstand von 1 s
        const vorInterval = (await js('kam.dateien()')).length;
        await js('document.querySelector("#intervall-sek").value = "1"; document.querySelector("#intervall-anzahl").value = "3"; pruefKlick("#intervall-start");');
        await warte(3800);
        const nachInterval = (await js('kam.dateien()')).length;
        pruefe(nachInterval === vorInterval + 3, `Intervallfotos (${nachInterval - vorInterval} von 3)`);

        // Standbild
        await js('pruefKlick("#standbild")');
        await warte(300);
        pruefe(await js('ansicht.standbild'), 'Standbild an');
        await js('pruefKlick("#standbild")');

        // Galerie
        await js('pruefKlick(".tab[data-seite=galerie]")');
        await warte(800);
        const kacheln = await js('document.querySelectorAll("#galerie-raster .kachel").length');
        pruefe(kacheln === nachInterval, `Galerie zeigt alle Dateien (${kacheln})`);
        await foto('galerie');
        await js('pruefKlick("#galerie-raster .kachel.video")');
        await warte(1000);
        await foto('vorschau');
        await js('pruefKlick("#vorschau-loeschen")');
        await warte(600);
        pruefe((await js('kam.dateien()')).length === nachInterval - 1, 'Löschen aus der Vorschau');
        await js('pruefKlick(".tab[data-seite=live]")');

        // Hell
        await js('pruefKlick("#thema-knopf")');
        await foto('hell');
        await js('pruefKlick("#thema-knopf")');
        await foto();

        pruefe(seitenFehler.length === 0, `keine Fehler in der Seite${seitenFehler.length ? ': ' + seitenFehler.join(' | ') : ''}`);
    } catch (e) {
        fehler.push(String(e?.stack ?? e));
        log(`FEHL ${e?.stack ?? e}`);
    }
    log(fehler.length ? `\n${fehler.length} Fehler` : '\nalles in Ordnung');
    app.exit(fehler.length ? 1 : 0);
}

/* ------------------------------------------------------------ Start */

app.whenReady().then(() => {
    einstellungenLesen();
    protocol.handle('medien', medienAntwort);
    fensterOeffnen();
    if (pruefen) fenster.webContents.once('did-finish-load', () => selbsttest());
});

app.on('window-all-closed', () => app.quit());
