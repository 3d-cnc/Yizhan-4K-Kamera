// Überwachung (YZ-15): Bewegung in einem Bereich erkennen und dann fotografieren, ein Video mit Vorlauf
// speichern oder nur melden; dazu ein Alarm, wenn sich lange nichts mehr bewegt (Drucker oder Fräse steht).
const wache = {
    aktiv: false,
    bereich: speicher.lesen('wacheBereich', null),   // { x, y, w, h } in Bildanteilen, ungespiegelt; null = ganzes Bild
    waehlt: false,
    video: null,          // eigenes Video: läuft auch bei Standbild weiter
    leinwand: null,
    vorher: null,
    anteil: 0,
    ueberZaehler: 0,
    seit: 0,
    anzahl: 0,
    letzteZeit: null,
    letzteBewegung: 0,
    letztesFoto: -Infinity,
    letzteMeldung: -Infinity,
    stillGemeldet: false,
    ereignis: null,       // { start, letzte } – offenes Video-Ereignis

    FELDER: ['wache-empfindlich', 'wache-aktion', 'wache-vorlauf', 'wache-ruhe', 'wache-still', 'wache-ton'],

    init() {
        for (const id of this.FELDER) {
            const el = $('#' + id);
            const wert = speicher.lesen(id, el.type === 'checkbox' ? el.checked : el.value);
            if (el.type === 'checkbox') el.checked = !!wert; else el.value = wert;
            el.addEventListener('change', () => {
                speicher.schreiben(id, el.type === 'checkbox' ? el.checked : el.value);
                if (id === 'wache-aktion') puffer.abgleichen();
                this.anzeigen();
            });
        }
        $('#wache-empfindlich').addEventListener('input', () => this.anzeigen());
        $('#wache-start').addEventListener('click', () => (this.aktiv ? this.stoppen() : this.starten()));
        $('#wache-bereich').addEventListener('click', () => this.auswaehlen(!this.waehlt));
        $('#wache-ganz').addEventListener('click', () => {
            this.bereich = null;
            speicher.schreiben('wacheBereich', null);
            this.auswaehlen(false);
            this.vorher = null;
        });
        kamera.zuhoerer.push(() => { if (this.video) this.videoSetzen(); });
        setInterval(() => this.pruefen(), 200);
        this.anzeigen();
    },

    zahl(id) {
        return Number($('#' + id).value) || 0;
    },

    // Anteil geänderter Bildpunkte, ab dem es als Bewegung zählt: 5 % (unempfindlich) … 0,05 % (sehr empfindlich)
    grenze() {
        const e = Math.min(100, Math.max(1, this.zahl('wache-empfindlich')));
        return 0.05 * 0.01 ** ((e - 1) / 99);
    },

    brauchtPuffer() {
        return this.aktiv && $('#wache-aktion').value === 'video';
    },

    videoSetzen() {
        if (!kamera.strom) return;
        this.video ??= Object.assign(document.createElement('video'), { muted: true, playsInline: true });
        this.video.srcObject = kamera.strom;
        this.video.play().catch(() => {});
        this.vorher = null;
    },

    starten() {
        if (!kamera.strom) {
            toast('Keine Kamera.', true);
            return;
        }
        this.videoSetzen();
        this.aktiv = true;
        this.seit = Date.now();
        this.anzahl = 0;
        this.letzteZeit = null;
        this.letzteBewegung = performance.now();
        this.stillGemeldet = false;
        this.letztesFoto = -Infinity;
        this.letzteMeldung = -Infinity;
        puffer.abgleichen();
        this.anzeigen();
    },

    async stoppen() {
        this.aktiv = false;
        this.anzeigen();
        if (this.ereignis) await this.ereignisBeenden();
        puffer.abgleichen();
        this.anzeigen();
    },

    /* -------------------------------------------- Bereich wählen */

    auswaehlen(an) {
        this.waehlt = an;
        $('#wache-bereich').classList.toggle('an', an);
        ansicht.buehne.classList.toggle('auswahl', an);
        ansicht.overlayZeichnen();
    },

    // Von ansicht gerufen, solange gewählt wird: Rechteck in Bühnenpixeln aufziehen
    zeiger(art, px, py) {
        if (art === 'down') this.zug = { x0: px, y0: py, x1: px, y1: py };
        if (!this.zug) return;
        this.zug.x1 = px;
        this.zug.y1 = py;
        if (art === 'up') {
            const a = ansicht.buehneZuBild(Math.min(this.zug.x0, this.zug.x1), Math.min(this.zug.y0, this.zug.y1));
            const b = ansicht.buehneZuBild(Math.max(this.zug.x0, this.zug.x1), Math.max(this.zug.y0, this.zug.y1));
            const x = Math.max(0, Math.min(a.x, b.x)), y = Math.max(0, Math.min(a.y, b.y));
            const w = Math.min(1, Math.max(a.x, b.x)) - x, h = Math.min(1, Math.max(a.y, b.y)) - y;
            this.zug = null;
            if (w > 0.01 && h > 0.01) {
                this.bereich = { x, y, w, h };
                speicher.schreiben('wacheBereich', this.bereich);
                this.vorher = null;
            }
            this.auswaehlen(false);
            return;
        }
        ansicht.overlayZeichnen();
    },

    // Bereich ins Overlay zeichnen (gestrichelt); beim Aufziehen das entstehende Rechteck
    zeichnen(x) {
        const sichtbar = this.aktiv || this.waehlt || $('.leiste-tab[data-leiste=wache]').classList.contains('aktiv');
        if (!sichtbar) return;
        x.save();
        x.setLineDash([6, 4]);
        x.lineWidth = 1.5;
        x.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--warn').trim();
        if (this.zug) {
            x.strokeRect(Math.min(this.zug.x0, this.zug.x1) + 0.5, Math.min(this.zug.y0, this.zug.y1) + 0.5, Math.abs(this.zug.x1 - this.zug.x0), Math.abs(this.zug.y1 - this.zug.y0));
        } else if (this.bereich) {
            const r = this.bereich;
            const a = ansicht.bildZuBuehne(r.x, r.y), b = ansicht.bildZuBuehne(r.x + r.w, r.y + r.h);
            x.strokeRect(Math.min(a.x, b.x) + 0.5, Math.min(a.y, b.y) + 0.5, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        }
        x.restore();
    },

    /* -------------------------------------------- Bewegung messen */

    messen() {
        const v = this.video;
        if (!v || !v.videoWidth || v.readyState < 2) return null;
        const r = this.bereich ?? { x: 0, y: 0, w: 1, h: 1 };
        const sx = r.x * v.videoWidth, sy = r.y * v.videoHeight, sw = r.w * v.videoWidth, sh = r.h * v.videoHeight;
        // Auf höchstens 160 Punkte Kantenlänge verkleinern: genug für Bewegung, unempfindlich gegen Rauschen
        const k = 160 / Math.max(sw, sh);
        const tw = Math.max(8, Math.round(sw * k)), th = Math.max(8, Math.round(sh * k));
        if (!this.leinwand || this.leinwand.canvas.width !== tw || this.leinwand.canvas.height !== th) {
            this.leinwand = new OffscreenCanvas(tw, th).getContext('2d', { willReadFrequently: true });
            this.vorher = null;
        }
        this.leinwand.drawImage(v, sx, sy, sw, sh, 0, 0, tw, th);
        const d = this.leinwand.getImageData(0, 0, tw, th).data;
        const grau = new Uint8Array(tw * th);
        for (let i = 0, j = 0; j < grau.length; i += 4, j++) grau[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
        const vorher = this.vorher;
        this.vorher = grau;
        if (!vorher || vorher.length !== grau.length) return null;
        let geaendert = 0;
        for (let i = 0; i < grau.length; i++) if (Math.abs(grau[i] - vorher[i]) > 18) geaendert++;
        return geaendert / grau.length;
    },

    pruefen() {
        // Auch ohne laufende Überwachung messen, solange der Reiter offen ist – zum Einstellen der Empfindlichkeit
        const reiterOffen = $('.leiste-tab[data-leiste=wache]').classList.contains('aktiv') && $('#seite-live').classList.contains('aktiv');
        if (!this.aktiv && !reiterOffen) return;
        if (!this.video || this.video.srcObject !== kamera.strom) this.videoSetzen();
        const anteil = this.messen();
        if (anteil == null) return;
        this.anteil = anteil;
        const bewegt = anteil > this.grenze();
        this.ueberZaehler = bewegt ? this.ueberZaehler + 1 : 0;
        this.balken();
        if (!this.aktiv) return;

        const jetzt = performance.now();
        // Zweimal hintereinander über der Grenze: ein einzelnes gestörtes Bild löst nichts aus
        if (this.ueberZaehler >= 2) this.bewegung(jetzt);
        if (this.ereignis && (jetzt - this.ereignis.letzte >= this.zahl('wache-ruhe') * 1000 || jetzt - this.ereignis.start > 10 * 60000)) {
            this.ereignisBeenden();
        }
        const still = this.zahl('wache-still');
        if (still > 0 && !this.stillGemeldet && jetzt - this.letzteBewegung > still * 60000) {
            this.stillGemeldet = true;
            ton(440, 0.35, 3);
            toast(`Seit ${still} min keine Bewegung mehr`, true);
            kam.aufmerksamkeit();
        }
        this.anzeigen();
    },

    bewegung(jetzt) {
        this.letzteBewegung = jetzt;
        this.stillGemeldet = false;
        const ruhe = this.zahl('wache-ruhe') * 1000;
        const aktion = $('#wache-aktion').value;
        if (aktion === 'video') {
            if (this.ereignis) {
                this.ereignis.letzte = jetzt;
                return;
            }
            const vorlauf = Math.min(this.zahl('wache-vorlauf'), puffer.laenge()) * 1000;
            this.ereignis = { start: jetzt - vorlauf, letzte: jetzt, datum: new Date() };
            puffer.festhalten(this.ereignis.start);
            this.gemeldet();
            return;
        }
        if (aktion === 'foto' && jetzt - this.letztesFoto >= ruhe) {
            this.letztesFoto = jetzt;
            this.gemeldet();
            aufnahme.foto({ still: true }).then((name) => name && toast(`Bewegung – ${name}`));
            return;
        }
        if (aktion === 'melden' && jetzt - this.letzteMeldung >= ruhe) {
            this.letzteMeldung = jetzt;
            this.gemeldet();
            toast('Bewegung erkannt');
            kam.aufmerksamkeit();
        }
    },

    gemeldet() {
        this.anzahl++;
        this.letzteZeit = new Date();
        if ($('#wache-ton').checked) ton(1046, 0.12, 2);
    },

    async ereignisBeenden() {
        const e = this.ereignis;
        if (!e) return;
        this.ereignis = null;
        const name = await puffer.speichern({ ab: e.start, bis: performance.now(), name: `Bewegung_${zeitstempel(e.datum)}.mp4`, still: true });
        puffer.loslassen();
        if (name) toast(`Bewegung – ${name}`);
        this.anzeigen();
    },

    balken() {
        // Logarithmisch von 0,01 % bis 20 %
        const pos = (a) => Math.min(1, Math.max(0, (Math.log10(Math.max(a, 1e-4)) + 4) / (Math.log10(0.2) + 4))) * 100;
        $('#bewegung-balken').style.width = `${pos(this.anteil)}%`;
        $('#bewegung-balken').classList.toggle('ueber', this.anteil > this.grenze());
        $('#bewegung-schwelle').style.left = `${pos(this.grenze())}%`;
    },

    anzeigen() {
        const an = this.aktiv;
        $('#wache-start').textContent = an ? 'Überwachung beenden' : 'Überwachung starten';
        $('#wache-start').classList.toggle('laeuft', an);
        $('#wache-punkt').classList.toggle('an', an);
        $('#wache-marke').classList.toggle('sichtbar', an);
        $('#wache-marke').textContent = an ? (this.ereignis ? `Bewegung · ${Math.round((performance.now() - this.ereignis.start) / 1000)} s` : `Überwachung · ${this.anzahl}`) : '';
        const video = $('#wache-aktion').value === 'video';
        $('#wache-vorlauf').disabled = !video;
        this.balken();
        const uhr = (d) => d.toLocaleTimeString('de-DE');
        $('#wache-status').textContent = an
            ? `seit ${uhr(new Date(this.seit))} · ${this.anzahl} ${this.anzahl === 1 ? 'Ereignis' : 'Ereignisse'}${this.letzteZeit ? ` · zuletzt ${uhr(this.letzteZeit)}` : ''}`
            : '';
    },
};
