// Menü, Hell/Dunkel, Version und Updates, Fenstergröße beim Start – gebaut wie im OWON-Programm
const version = { installiert: null, ergebnis: null, laeuft: false };
const datumZeit = (t) => new Date(t).toLocaleDateString('de-DE') + ' ' + new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/* ------------------------------------------------------------ Menü */

function menueZeigen(an) {
    const m = $('#menue'), k = $('#menue-knopf');
    if (an) {
        const r = k.getBoundingClientRect();
        m.style.left = r.left + 'px';
        m.style.top = (r.bottom + 6) + 'px';
    }
    m.classList.toggle('offen', an);
    k.setAttribute('aria-expanded', an);
    if (an) m.querySelector('button').focus();
}

async function menueAktion(aktion) {
    menueZeigen(false);
    if (aktion === 'updates') versionsDialog(true);
    else if (aktion === 'groesse') groessenDialog();
    else if (aktion === 'thema') themaWechseln();
    else if (aktion === 'ordner-oeffnen') kam.ordnerOeffnen();
    else if (aktion === 'ordner-waehlen') {
        const neu = await kam.ordnerWaehlen();
        if (neu) { aufnahme.platzZeigen(); galerie.laden(); toast(`Speicherordner: ${neu}`); }
    } else if (aktion === 'kuerzel') {
        hinweis('Tastenkürzel', `<table>${KUERZEL.map(([k, t]) => `<tr><td>${k}</td><td>${t}</td></tr>`).join('')}</table>`);
    } else if (aktion === 'ueber') {
        const s = kamera.spur?.getSettings();
        hinweis('Yizhan 4K Kamera', `<p>Version ${version.installiert ?? '–'}</p><p>Kamera: ${kamera.name()}${s ? ` · ${s.width}×${s.height}` : ''}</p><p>cnc3d.tech</p>`);
    } else if (aktion === 'beenden') kam.beenden();
}

/* ------------------------------------------------------------ Hell / Dunkel */

// Vorgabe dunkel; die Wahl bleibt gespeichert. Das Programm stellt auch Dialoge und Fensterhintergrund um.
function themaSetzen(thema) {
    thema = thema === 'hell' ? 'hell' : 'dunkel';
    document.documentElement.dataset.thema = thema;
    try { localStorage.setItem('yizhan.thema', thema); } catch { /* egal */ }
    const anders = thema === 'hell' ? 'Dunkles Design' : 'Helles Design';
    $('#thema-knopf').title = anders;
    $('#menue-thema').textContent = anders;
    kam.thema(thema);
    // Overlay und Bereich holen ihre Farben beim Zeichnen
    ansicht.overlayZeichnen();
}
const themaWechseln = () => themaSetzen(document.documentElement.dataset.thema === 'hell' ? 'dunkel' : 'hell');

/* ------------------------------------------------------------ Version und Updates */

function versionAnzeigen() {
    const e = version.ergebnis;
    const status = version.laeuft ? 'pruefe' : e?.status ?? 'unbekannt';
    const symbol = { pruefe: '…', aktuell: '✓', neu: '↑', unbekannt: '?' }[status];
    const titel = {
        pruefe: 'Prüfe auf Updates …',
        aktuell: 'Auf dem neuesten Stand',
        neu: `Update verfügbar: Version ${e?.neueste}`,
        unbekannt: e ? 'Prüfung nicht möglich' : 'Noch nicht geprüft',
    }[status];
    const text = {
        pruefe: 'Fragt bei GitHub nach der neuesten Version.',
        aktuell: `Version ${version.installiert} ist die neueste.`,
        neu: `Installiert ist ${version.installiert}. Die neue Version liegt auf GitHub zum Herunterladen bereit.`,
        unbekannt: e?.grund ?? 'Mit „Jetzt prüfen“ fragt das Programm bei GitHub nach.',
    }[status];

    const k = $('#version-knopf');
    k.className = status;
    k.querySelector('.v-symbol').textContent = symbol;
    $('#version-text').textContent = 'v' + (version.installiert ?? '–');
    k.title = `${titel} – Klick: Version und Updates`;
    $('#menue').classList.toggle('update', status === 'neu');

    $('#v-status').className = 'v-status ' + status;
    $('#v-symbol').textContent = symbol;
    $('#v-titel').textContent = titel;
    $('#v-text').textContent = text;
    $('#v-installiert').textContent = version.installiert ?? '–';
    $('#v-neueste').textContent = e?.neueste ? e.neueste + (e.datum ? ` (vom ${new Date(e.datum).toLocaleDateString('de-DE')})` : '') : '–';
    $('#v-geprueft').textContent = e?.geprueft ? datumZeit(e.geprueft) : '–';
    const notizen = status === 'neu' && e?.notizen ? e.notizen.replace(/\r/g, '').replace(/\*\*/g, '').trim() : '';
    $('#v-notizen-box').hidden = !notizen;
    $('#v-notizen').textContent = notizen;
    $('#v-seite').textContent = status === 'neu' ? 'Update herunterladen' : 'Versionen auf GitHub';
    $('#v-seite').classList.toggle('haupt', status === 'neu');
    $('#v-schliessen').classList.toggle('haupt', status !== 'neu');
    $('#v-pruefen').disabled = version.laeuft;
}

async function versionPruefen() {
    if (version.laeuft) return;
    version.laeuft = true;
    versionAnzeigen();
    try {
        version.ergebnis = await kam.versionPruefen();
    } catch (e) {
        version.ergebnis = { status: 'unbekannt', grund: 'Die Prüfung ist fehlgeschlagen: ' + e.message, geprueft: Date.now() };
    }
    version.laeuft = false;
    versionAnzeigen();
    if (version.ergebnis.status === 'neu') toast(`Update verfügbar: Version ${version.ergebnis.neueste}`);
}

// Öffnet den Dialog; ohne frisches Ergebnis (älter als 10 min) wird gleich geprüft
function versionsDialog(pruefen) {
    if (!$('#versionsdialog').open) $('#versionsdialog').showModal();
    const alt = !version.ergebnis || Date.now() - version.ergebnis.geprueft > 10 * 60 * 1000;
    if (pruefen && alt) versionPruefen(); else versionAnzeigen();
}

/* ------------------------------------------------------------ Fenstergröße beim Start */

const GROESSEN = [[1280, 720], [1600, 900], [1920, 1080], [2560, 1440], [3840, 2160]];

async function groessenDialog() {
    const e = await kam.einstellungen();
    const liste = $('#groessen');
    liste.replaceChildren();
    const eigeneWahl = !GROESSEN.some(([w, h]) => w === e.breite && h === e.hoehe);
    for (const [w, h] of GROESSEN) {
        const zuGross = w > e.bildschirm.breite || h > e.bildschirm.hoehe;
        const zeile = document.createElement('label');
        zeile.className = zuGross ? 'gesperrt' : '';
        zeile.innerHTML = '<input type="radio" name="groesse"><span class="masse"></span><small></small>';
        const radio = zeile.querySelector('input');
        radio.value = `${w}x${h}`;
        radio.disabled = zuGross;
        radio.checked = w === e.breite && h === e.hoehe;
        zeile.querySelector('.masse').textContent = `${w} × ${h}`;
        zeile.querySelector('small').textContent = [w === e.vorgabe.breite && h === e.vorgabe.hoehe ? 'Vorgabe' : '', zuGross ? 'größer als dieser Bildschirm' : ''].filter(Boolean).join(' · ');
        liste.append(zeile);
    }
    const eigene = document.createElement('label');
    eigene.innerHTML = '<input type="radio" name="groesse" value="eigene"><span class="masse">Eigene:</span><input type="text" id="g-breite" inputmode="numeric"> × <input type="text" id="g-hoehe" inputmode="numeric">';
    liste.append(eigene);
    eigene.querySelector('input[type=radio]').checked = eigeneWahl;
    $('#g-breite').value = e.breite;
    $('#g-hoehe').value = e.hoehe;
    for (const id of ['#g-breite', '#g-hoehe']) {
        $(id).addEventListener('focus', () => { eigene.querySelector('input[type=radio]').checked = true; });
        $(id).addEventListener('keydown', (ev) => { if (ev.key === 'Enter') $('#g-ok').click(); });
    }
    $('#g-info').className = 'hinweis';
    $('#g-info').textContent = `Dieser Bildschirm bietet bis ${e.bildschirm.breite} × ${e.bildschirm.hoehe}. Das Fenster ist gerade ${e.jetzt.breite} × ${e.jetzt.hoehe} groß.`;
    $('#groessendialog').showModal();
}

function groesseAnzeigen(w, h) {
    $('#menue-groesse').textContent = `${w} × ${h}`;
}

async function groesseUebernehmen() {
    const wahl = document.querySelector('#groessen input[name=groesse]:checked');
    if (!wahl) return;
    const [w, h] = wahl.value === 'eigene'
        ? [Number($('#g-breite').value.trim()), Number($('#g-hoehe').value.trim())]
        : wahl.value.split('x').map(Number);
    const r = await kam.fenstergroesse(w, h);
    if (!r.ok) {
        $('#g-info').className = 'hinweis fehler';
        $('#g-info').textContent = r.grund;
        return;
    }
    $('#groessendialog').close();
    groesseAnzeigen(w, h);
    toast(`Fenstergröße beim Start: ${w} × ${h}` + (r.verkleinert ? ` – auf diesem Bildschirm vorerst ${r.angewendet.breite} × ${r.angewendet.hoehe}` : ''));
}

/* ------------------------------------------------------------ Verbinden */

async function menueInit() {
    $('#menue-knopf').addEventListener('click', (e) => { e.stopPropagation(); menueZeigen(!$('#menue').classList.contains('offen')); });
    document.addEventListener('click', (e) => { if (!$('#menue').contains(e.target)) menueZeigen(false); });
    $('#menue').addEventListener('keydown', (e) => {
        const knoepfe = $$('#menue button');
        const i = knoepfe.indexOf(document.activeElement);
        if (e.key === 'Escape') { menueZeigen(false); $('#menue-knopf').focus(); }
        else if (e.key === 'ArrowDown') { knoepfe[(i + 1) % knoepfe.length].focus(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { knoepfe[(i - 1 + knoepfe.length) % knoepfe.length].focus(); e.preventDefault(); }
    });
    $$('#menue button').forEach((b) => b.addEventListener('click', () => menueAktion(b.dataset.aktion)));

    $('#thema-knopf').addEventListener('click', themaWechseln);
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l') { themaWechseln(); e.preventDefault(); }
    });
    themaSetzen(document.documentElement.dataset.thema);

    $('#version-knopf').addEventListener('click', () => versionsDialog(true));
    $('#v-pruefen').addEventListener('click', versionPruefen);
    $('#v-schliessen').addEventListener('click', () => $('#versionsdialog').close());
    $('#v-seite').addEventListener('click', () => kam.linkOeffnen(version.ergebnis?.seite ?? ''));
    $('#v-beim-start').addEventListener('change', (e) => kam.updatesBeimStart(e.target.checked));
    $('#g-abbrechen').addEventListener('click', () => $('#groessendialog').close());
    $('#g-ok').addEventListener('click', groesseUebernehmen);

    // Beim Start: Version anzeigen und, wenn eingestellt, gleich nachsehen
    version.installiert = await kam.version();
    const e = await kam.einstellungen();
    $('#v-beim-start').checked = e.updatesBeimStart;
    groesseAnzeigen(e.breite, e.hoehe);
    versionAnzeigen();
    if (e.updatesBeimStart) setTimeout(versionPruefen, 1500);
}
