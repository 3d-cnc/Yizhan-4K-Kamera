// Fotos, Videos und Intervallfotos; alles landet sofort als Datei im Speicherordner
const aufnahme = {
    rec: null,          // MediaRecorder
    datei: null,        // { id, name } beim Hauptprogramm
    start: 0,
    bytes: 0,
    kette: Promise.resolve(),   // Videostücke in der richtigen Reihenfolge schreiben
    leinwand: null,     // für gespiegelte Aufnahmen
    leser: null,
    intervall: null,

    init() {
        $('#foto').addEventListener('click', () => this.foto());
        $('#aufnahme').addEventListener('click', () => (this.laeuft() ? this.stoppen() : this.starten()));
        $('#intervall-start').addEventListener('click', () => (this.intervall ? this.intervallStoppen() : this.intervallStarten()));
        for (const id of ['foto-format', 'video-format', 'video-rate', 'intervall-sek', 'intervall-anzahl']) {
            const el = $('#' + id);
            el.value = speicher.lesen(id, el.value);
            el.addEventListener('change', () => speicher.schreiben(id, el.value));
        }
        // MP4 kann nicht jede Chromium-Fassung aufnehmen
        if (!MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.640033')) {
            $('#video-format option[value=mp4]').disabled = true;
            $('#video-format').value = 'webm';
        }
        kam.beiBeendenUndSchliessen(async () => {
            this.intervallStoppen();
            await this.stoppen();
            if (wache.ereignis) await wache.ereignisBeenden();
            kam.fertigZumSchliessen();
        });
        setInterval(() => this.anzeigen(), 500);
        this.platzZeigen();
        setInterval(() => this.platzZeigen(), 15000);
    },

    laeuft() {
        return !!this.rec && this.rec.state !== 'inactive';
    },

    blitz() {
        const b = $('#blitz');
        b.classList.remove('an');
        void b.offsetWidth;
        b.classList.add('an');
    },

    async foto({ still = false } = {}) {
        const v = ansicht.video;
        if (!v.videoWidth) {
            if (!still) toast('Kein Kamerabild.', true);
            return null;
        }
        const w = v.videoWidth, h = v.videoHeight;
        const c = new OffscreenCanvas(w, h);
        ansicht.bildZeichnen(c.getContext('2d'), w, h);
        const png = $('#foto-format').value === 'png';
        if (!still) this.blitz();
        try {
            const blob = await c.convertToBlob(png ? { type: 'image/png' } : { type: 'image/jpeg', quality: 0.95 });
            const name = await kam.fotoSpeichern(`Foto_${zeitstempel()}.${png ? 'png' : 'jpg'}`, await blob.arrayBuffer());
            if (!still) toast(`Foto gespeichert: ${name}`);
            galerie.neu();
            return name;
        } catch (e) {
            toast(`Foto konnte nicht gespeichert werden: ${e.message}`, true);
            return null;
        }
    },

    /* -------------------------------------------- Video */

    async starten() {
        if (this.laeuft() || !kamera.strom) return;
        const mp4 = $('#video-format').value === 'mp4';
        const typ = mp4 ? 'video/mp4;codecs=avc1.640033' : 'video/webm;codecs=vp9';
        const rate = Number($('#video-rate').value) * 1e6;

        let strom = kamera.strom;
        // Gespiegelt: jedes Kamerabild gespiegelt auf eine Leinwand, aufgenommen wird die Leinwand
        if (ansicht.gespiegelt()) strom = this.spiegelStrom();

        try {
            this.datei = await kam.videoBeginnen(`Video_${zeitstempel()}.${mp4 ? 'mp4' : 'webm'}`);
        } catch (e) {
            toast(`Video kann nicht angelegt werden: ${e.message}`, true);
            this.spiegelEnde();
            return;
        }
        const datei = this.datei;
        this.bytes = 0;
        this.kette = Promise.resolve();
        this.rec = new MediaRecorder(strom, { mimeType: typ, videoBitsPerSecond: rate });
        this.rec.ondataavailable = (e) => {
            if (!e.data.size) return;
            this.kette = this.kette.then(async () => {
                const n = await kam.videoAnhaengen(datei.id, await e.data.arrayBuffer());
                if (n) this.bytes = n;
            }).catch((err) => toast(`Schreiben fehlgeschlagen: ${err.message}`, true));
        };
        this.rec.onerror = (e) => {
            toast(`Aufnahme abgebrochen: ${e.error?.message ?? 'Fehler'}`, true);
            this.stoppen();
        };
        this.rec.start(1000);
        this.start = performance.now();
        this.anzeigen();
    },

    async stoppen() {
        if (!this.rec) return;
        const rec = this.rec;
        const datei = this.datei;
        if (rec.state !== 'inactive') {
            await new Promise((ok) => { rec.onstop = ok; rec.stop(); });
        }
        this.rec = null;
        this.spiegelEnde();
        await this.kette;
        const name = await kam.videoSchliessen(datei.id);
        this.datei = null;
        this.anzeigen();
        if (name) {
            toast(`Video gespeichert: ${name} (${bytesText(this.bytes)})`);
            galerie.neu();
        }
    },

    kameraWeg() {
        this.intervallStoppen();
        puffer.stoppen(true);
        if (this.laeuft()) this.stoppen();
    },

    spiegelStrom() {
        const spur = kamera.spur;
        const s = spur.getSettings();
        const c = document.createElement('canvas');
        c.width = s.width;
        c.height = s.height;
        const x = c.getContext('2d', { alpha: false, desynchronized: true });
        const ausgabe = c.captureStream(0);
        const ziel = ausgabe.getVideoTracks()[0];
        const leser = new MediaStreamTrackProcessor({ track: spur.clone() });
        this.leser = leser.readable.getReader();
        this.leinwand = { c, ziel };
        const r = this.leser;
        (async () => {
            for (;;) {
                const { value: bild, done } = await r.read().catch(() => ({ done: true }));
                if (done) break;
                ansicht.bildZeichnen(x, c.width, c.height, bild);
                bild.close();
                ziel.requestFrame();
            }
        })();
        return ausgabe;
    },

    spiegelEnde() {
        if (!this.leser) return;
        this.leser.cancel().catch(() => {});
        this.leser = null;
        this.leinwand?.ziel.stop();
        this.leinwand = null;
    },

    anzeigen() {
        const an = this.laeuft();
        const k = $('#aufnahme');
        k.classList.toggle('laeuft', an);
        const zeit = an ? dauerText((performance.now() - this.start) / 1000) : '';
        $('#aufnahme-text').textContent = an ? `Stopp ${zeit}` : 'Video';
        $('#rec-marke').classList.toggle('sichtbar', an);
        $('#rec-zeit').textContent = an ? `${zeit} · ${bytesText(this.bytes)}` : '';
        $('#video-format').disabled = an;
        $('#video-rate').disabled = an;
        $('#aufloesung').disabled = an;
        $('#kamera-wahl').disabled = an;
    },

    async platzZeigen() {
        const frei = await kam.platz();
        const p = $('#platz');
        p.textContent = frei == null ? '' : `${bytesText(frei)} frei`;
        p.classList.toggle('knapp', frei != null && frei < 5e9);
        // Platte fast voll: Aufnahme beenden, bevor die Datei kaputt geht
        if (frei != null && frei < 5e8 && this.laeuft()) {
            toast('Fast kein Speicherplatz mehr – Aufnahme beendet.', true);
            this.stoppen();
        }
        const ordner = await kam.ordner();
        $('#ordner-name').textContent = ordner;
        $('#ordner-name').title = ordner;
    },

    /* -------------------------------------------- Intervallfotos */

    intervallStarten() {
        const sek = Math.max(1, Number($('#intervall-sek').value) || 1);
        const anzahl = Math.max(1, Math.floor(Number($('#intervall-anzahl').value) || 1));
        const iv = { sek, anzahl, fertig: 0, naechstes: performance.now() };
        this.intervall = iv;
        const schritt = async () => {
            if (this.intervall !== iv) return;
            await this.foto({ still: true });
            iv.fertig++;
            this.intervallZeigen();
            if (iv.fertig >= iv.anzahl) {
                this.intervallStoppen();
                toast(`Intervall fertig: ${iv.anzahl} Fotos`);
                kam.aufmerksamkeit();
                return;
            }
            // Am Startzeitpunkt ausrichten, damit sich die Abstände nicht aufsummieren
            iv.naechstes += sek * 1000;
            iv.timer = setTimeout(schritt, Math.max(0, iv.naechstes - performance.now()));
        };
        schritt();
        this.intervallZeigen();
    },

    intervallStoppen() {
        if (!this.intervall) return;
        clearTimeout(this.intervall.timer);
        this.intervall = null;
        this.intervallZeigen();
    },

    intervallZeigen() {
        const iv = this.intervall;
        $('#intervall-start').textContent = iv ? 'Stoppen' : 'Starten';
        $('#intervall-start').classList.toggle('an', !!iv);
        $('#intervall-sek').disabled = !!iv;
        $('#intervall-anzahl').disabled = !!iv;
        $('#intervall-balken').style.width = iv ? `${iv.fertig / iv.anzahl * 100}%` : '0';
        $('#intervall-marke').classList.toggle('sichtbar', !!iv);
        $('#intervall-marke').textContent = iv ? `Intervall ${iv.fertig} / ${iv.anzahl}` : '';
    },
};
