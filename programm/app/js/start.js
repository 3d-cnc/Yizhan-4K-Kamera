// Start: Teile verbinden, Tabs, Tastenkürzel (Menü, Hell/Dunkel, Version: menue.js)
function seiteZeigen(name) {
    if (galerie.istOffen()) galerie.schliessen();
    if (wache.waehlt) wache.auswaehlen(false);
    $$('.tab').forEach((t) => t.classList.toggle('aktiv', t.dataset.seite === name));
    $$('.seite').forEach((s) => s.classList.toggle('aktiv', s.id === 'seite-' + name));
    if (name === 'galerie') galerie.laden();
    else requestAnimationFrame(() => ansicht.einpassen(true));
}

let vollbild = false;
function vollbildUmschalten(an = !vollbild) {
    if (an === vollbild) return;
    vollbild = an;
    document.body.classList.toggle('vollbild', an);
    if (an) seiteZeigen('live');
    an ? kam.vollbild() : kam.vollbildAus();
}

const KUERZEL = [
    ['Leertaste', 'Foto'],
    ['R', 'Video starten / stoppen'],
    ['S', 'Standbild'],
    ['F', 'Vollbild (Esc beendet)'],
    ['H / V', 'Waagrecht / senkrecht spiegeln'],
    ['K / G', 'Fadenkreuz / Raster'],
    ['+ / − / Mausrad', 'Zoom'],
    ['0 / Doppelklick', 'Ganzes Bild'],
    ['1', 'Ein Kamerapixel je Bildschirmpixel'],
    ['B', 'Rückblick speichern'],
    ['P / Z', 'Fokus-Peaking / Zebra'],
    ['← / →', 'Vorschau: blättern; bei Videos ein Bild vor/zurück'],
    ['Bild ↑ / Bild ↓', 'Vorschau: blättern (auch bei Videos)'],
    ['Leertaste', 'Video in der Vorschau abspielen / anhalten'],
    ['I / O', 'Schnitt: Anfang / Ende setzen'],
    ['Strg+Umschalt+L', 'Helles / dunkles Design'],
    ['Strg+Q', 'Beenden'],
];

document.addEventListener('DOMContentLoaded', async () => {
    ansicht.init();
    bildrateZaehlen();
    aufnahme.init();
    galerie.init();
    puffer.init();
    wache.init();
    peaking.init();
    abspieler.init();

    // Reiter der Seitenleiste
    const leisteZeigen = (name) => {
        $$('.leiste-tab').forEach((t) => t.classList.toggle('aktiv', t.dataset.leiste === name));
        $$('.leiste').forEach((l) => { l.hidden = l.dataset.leiste !== name; });
        speicher.schreiben('leiste', name);
        ansicht.overlayZeichnen();
    };
    $$('.leiste-tab').forEach((t) => t.addEventListener('click', () => leisteZeigen(t.dataset.leiste)));
    leisteZeigen(speicher.lesen('leiste', 'aufnahme'));

    $$('.tab').forEach((t) => t.addEventListener('click', () => seiteZeigen(t.dataset.seite)));
    menueInit();
    $('#vollbild').addEventListener('click', () => vollbildUmschalten());
    $('#regler-standard').addEventListener('click', () => regler.standard());
    $('#schaerfe-reset').addEventListener('click', () => { ansicht.besteSchaerfe = 0; });
    $('#ordner-knopf').addEventListener('click', () => kam.ordnerOeffnen());
    $('#hinweis-ok').addEventListener('click', () => $('#hinweis-dialog').classList.remove('offen'));

    $('#aufloesung').addEventListener('change', (e) => {
        kamera.aufloesung = e.target.value;
        speicher.schreiben('aufloesung', kamera.aufloesung);
        ansicht.besteSchaerfe = 0;
        kamera.starten();
    });
    $('#kamera-wahl').addEventListener('change', (e) => {
        kamera.geraetId = e.target.value;
        speicher.schreiben('kamera', kamera.geraetId);
        ansicht.besteSchaerfe = 0;
        kamera.starten();
    });

    // Tastenkürzel – nicht, während in einem Eingabefeld getippt wird
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'q') { e.preventDefault(); kam.beenden(); return; }
        if (e.target.matches?.('input[type=number], input[type=text], select')) return;
        // Offene Dialoge (Version, Fenstergröße) und das Menü behalten ihre Tasten
        if (document.querySelector('dialog[open]') || $('#menue').classList.contains('offen')) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        if ($('#hinweis-dialog').classList.contains('offen')) {
            if (e.key === 'Escape' || e.key === 'Enter') $('#hinweis-dialog').classList.remove('offen');
            return;
        }
        if (galerie.istOffen()) {
            const video = !!abspieler.video;
            const taste = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            const vorschau = {
                Escape: () => galerie.schliessen(),
                Delete: () => galerie.loeschen(),
                PageUp: () => galerie.blaettern(-1),
                PageDown: () => galerie.blaettern(1),
                ArrowLeft: () => (video && !e.shiftKey ? abspieler.schritt(-1) : galerie.blaettern(-1)),
                ArrowRight: () => (video && !e.shiftKey ? abspieler.schritt(1) : galerie.blaettern(1)),
                ...(video ? {
                    ' ': () => abspieler.spielen(),
                    Home: () => abspieler.springen(0),
                    i: () => abspieler.marke('rein'),
                    o: () => abspieler.marke('raus'),
                } : {}),
            };
            if (vorschau[taste]) {
                e.preventDefault();
                document.activeElement?.blur();
                vorschau[taste]();
            }
            return;
        }
        const live = $('#seite-live').classList.contains('aktiv');
        const taste = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        const aktionen = {
            ' ': () => aufnahme.foto(),
            r: () => (aufnahme.laeuft() ? aufnahme.stoppen() : aufnahme.starten()),
            s: () => ansicht.standbildUmschalten(),
            f: () => vollbildUmschalten(),
            Escape: () => vollbildUmschalten(false),
            h: () => ansicht.umschalten('spiegelnH'),
            v: () => ansicht.umschalten('spiegelnV'),
            k: () => ansicht.umschalten('fadenkreuz'),
            g: () => ansicht.umschalten('raster'),
            '+': () => ansicht.zoomUm(ansicht.zoom * 1.25),
            '-': () => ansicht.zoomUm(ansicht.zoom / 1.25),
            0: () => ansicht.zuruecksetzen(),
            1: () => ansicht.einsZuEins(),
            b: () => puffer.speichern(),
            p: () => peaking.umschalten('peaking'),
            z: () => peaking.umschalten('zebra'),
        };
        if (!live || !aktionen[taste]) return;
        e.preventDefault();
        // Leertaste soll nicht zusätzlich den zuletzt geklickten Knopf drücken
        document.activeElement?.blur();
        aktionen[taste]();
    });

    await kamera.starten();
});

/* ------------------------------------------------------------ Selbsttest */

window.pruefZustand = () => {
    const s = kamera.spur?.getSettings() ?? {};
    return { bilder: kamera.bilder, kamera: kamera.name(), breite: s.width, hoehe: s.height, fps: Math.round(kamera.fps), regler: $$('#regler .regler').length };
};

// Ersten Regler ohne Automatik eine Stufe weiter stellen, prüfen, zurückstellen
window.pruefRegler = async () => {
    const z = $$('#regler .regler').find((x) => !x.classList.contains('auto') && !x.querySelector('.auto-schalter')) ?? $$('#regler .regler')[0];
    if (!z) return { ok: false, text: 'kein Regler' };
    const k = z.dataset.k;
    const schieber = z.querySelector('input');
    const vorher = kamera.spur.getSettings()[k];
    const ziel = Number(schieber.value) + Number(schieber.step) * (Number(schieber.value) + Number(schieber.step) <= Number(schieber.max) ? 1 : -1);
    schieber.value = String(ziel);
    schieber.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 500));
    const nachher = kamera.spur.getSettings()[k];
    await regler.anwenden({ [k]: vorher });
    return { ok: nachher !== vorher, text: `${k} ${vorher} → ${nachher}` };
};
