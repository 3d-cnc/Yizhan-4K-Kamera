// Rückblick (YZ-14): Die Kamerabilder laufen ständig durch einen H.264-Encoder; die kodierten Stücke der
// letzten Sekunden bleiben im Speicher. „Speichern“ setzt sie ohne neues Kodieren zu einer MP4 zusammen.
// Die Überwachung (YZ-15) hält über festhalten() den Anfang eines Ereignisses fest, damit nichts verloren geht.
const puffer = {
    an: false,
    laeuft: false,
    stuecke: [],        // { chunk, zeit (performance.now), key, cfg }
    cfg: null,          // letzte Decoder-Beschreibung des Encoders
    festAb: null,       // Stücke ab dieser Zeit (ms) nicht wegwerfen
    enc: null,
    kopie: null,        // eigene Kopie der Kameraspur; stoppen beendet sie, die Schleife gibt den Rest frei
    bytes: 0,
    speichertGerade: false,

    laenge() {
        return Number($('#puffer-laenge').value) || 60;
    },

    init() {
        $('#puffer-an').checked = speicher.lesen('puffer', false);
        $('#puffer-laenge').value = String(speicher.lesen('pufferLaenge', 60));
        $('#puffer-an').addEventListener('change', () => {
            speicher.schreiben('puffer', $('#puffer-an').checked);
            $('#puffer-an').checked ? this.starten() : this.stoppen();
        });
        $('#puffer-laenge').addEventListener('change', () => {
            speicher.schreiben('pufferLaenge', this.laenge());
            this.kuerzen();
            this.anzeigen();
        });
        $('#puffer-speichern').addEventListener('click', () => this.speichern());
        // Neue Kamera oder Auflösung: Encoder neu einrichten
        kamera.zuhoerer.push(() => { if (this.gebraucht()) this.starten(); });
        setInterval(() => this.anzeigen(), 500);
        this.anzeigen();
    },

    // gebraucht: von Hand eingeschaltet oder von der Überwachung (Video)
    gebraucht() {
        return $('#puffer-an').checked || wache.brauchtPuffer();
    },

    async starten() {
        this.stoppen(true);
        const spur = kamera.spur;
        if (!spur || spur.readyState !== 'live') return;
        if (!this.gebraucht()) return;
        const s = spur.getSettings();
        const breite = s.width, hoehe = s.height;
        const konfig = {
            codec: 'avc1.640033',
            width: breite,
            height: hoehe,
            bitrate: Number($('#video-rate').value) * 1e6,
            framerate: 30,
            hardwareAcceleration: 'prefer-hardware',
            avc: { format: 'avc' },
            latencyMode: 'realtime',
        };
        try {
            if (!(await VideoEncoder.isConfigSupported(konfig)).supported) throw new Error('H.264 in dieser Auflösung nicht möglich');
        } catch (e) {
            toast(`Rückblick nicht möglich: ${e.message}`, true);
            return;
        }
        this.an = true;
        this.laeuft = true;
        this.stuecke = [];
        this.bytes = 0;
        this.cfg = null;
        const enc = new VideoEncoder({
            output: (chunk, meta) => this.ablegen(chunk, meta),
            error: (e) => {
                console.warn('Rückblick', e);
                toast(`Rückblick angehalten: ${e.message}`, true);
                this.stoppen();
            },
        });
        enc.configure(konfig);
        this.enc = enc;

        const kopie = spur.clone();
        this.kopie = kopie;
        const leser = new MediaStreamTrackProcessor({ track: kopie }).readable.getReader();
        let leinwand = null, letzterKey = -Infinity;
        (async () => {
            for (;;) {
                const { value: bild, done } = await leser.read().catch(() => ({ done: true }));
                if (done) break;
                // Encoder kommt nicht nach: Bild auslassen statt Speicher volllaufen lassen
                if (enc.state !== 'configured' || enc.encodeQueueSize > 6) {
                    bild.close();
                    continue;
                }
                let quelle = bild;
                if (ansicht.gespiegelt()) {
                    leinwand ??= new OffscreenCanvas(breite, hoehe);
                    ansicht.bildZeichnen(leinwand.getContext('2d'), breite, hoehe, bild);
                    quelle = new VideoFrame(leinwand, { timestamp: bild.timestamp });
                    bild.close();
                }
                // Jede Sekunde ein Schlüsselbild: so weit genau lässt sich der Anfang wählen
                const key = quelle.timestamp - letzterKey >= 1e6;
                if (key) letzterKey = quelle.timestamp;
                enc.encode(quelle, { keyFrame: key });
                quelle.close();
            }
        })();
        this.anzeigen();
    },

    stoppen(neustart = false) {
        // Nicht den Leser abbrechen: Bilder in seiner Warteschlange blieben sonst ungeschlossen liegen
        this.kopie?.stop();
        this.kopie = null;
        if (this.enc && this.enc.state !== 'closed') this.enc.close();
        this.enc = null;
        this.laeuft = false;
        if (!neustart) {
            this.an = false;
            this.stuecke = [];
            this.bytes = 0;
        }
        this.anzeigen();
    },

    // Ein- oder ausschalten, je nachdem ob jemand den Puffer braucht
    abgleichen() {
        if (this.gebraucht() && !this.laeuft) this.starten();
        if (!this.gebraucht() && this.laeuft && !this.speichertGerade) this.stoppen();
    },

    ablegen(chunk, meta) {
        if (meta?.decoderConfig) this.cfg = meta.decoderConfig;
        this.stuecke.push({ chunk, zeit: performance.now(), key: chunk.type === 'key', cfg: meta?.decoderConfig ?? null });
        this.bytes += chunk.byteLength;
        this.kuerzen();
    },

    // Alles vor dem letzten Schlüsselbild, das älter als die Länge ist, wegwerfen
    kuerzen() {
        const grenze = Math.min(performance.now() - this.laenge() * 1000, this.festAb ?? Infinity);
        let schnitt = 0;
        for (let i = 0; i < this.stuecke.length; i++) {
            const s = this.stuecke[i];
            if (s.zeit > grenze) break;
            if (s.key) schnitt = i;
        }
        if (schnitt > 0) {
            for (const s of this.stuecke.splice(0, schnitt)) this.bytes -= s.chunk.byteLength;
        }
    },

    festhalten(ab) {
        this.festAb = ab;
    },
    loslassen() {
        this.festAb = null;
        this.kuerzen();
    },

    sekunden() {
        if (this.stuecke.length < 2) return 0;
        return (this.stuecke.at(-1).zeit - this.stuecke[0].zeit) / 1000;
    },

    anzeigen() {
        const an = this.laeuft;
        const lang = this.laenge();
        $('#puffer-speichern-text').textContent = `Letzte ${lang} s speichern`;
        $('#puffer-speichern').disabled = !an || this.speichertGerade;
        $('#puffer-status').textContent = an ? `${Math.min(lang, Math.round(this.sekunden()))} von ${lang} s im Speicher · ${bytesText(this.bytes)}` : '';
        $('#puffer-marke').classList.toggle('sichtbar', an);
        $('#puffer-marke').textContent = an ? `Rückblick ${lang} s` : '';
    },

    // Stücke von ab bis bis (performance.now-Zeiten) als MP4 speichern; ohne Angaben: die letzten Sekunden
    async speichern({ ab, bis, name, still = false } = {}) {
        if (!this.laeuft || !this.stuecke.length || this.speichertGerade) return null;
        bis ??= performance.now();
        ab ??= bis - this.laenge() * 1000;
        // Beim letzten Schlüsselbild vor „ab“ anfangen – ein Video kann nur dort beginnen
        let start = 0;
        for (let i = 0; i < this.stuecke.length; i++) {
            if (this.stuecke[i].zeit > ab) break;
            if (this.stuecke[i].key) start = i;
        }
        while (start < this.stuecke.length && !this.stuecke[start].key) start++;
        const auswahl = this.stuecke.slice(start).filter((s) => s.zeit <= bis);
        if (auswahl.length < 2) return null;

        this.speichertGerade = true;
        this.anzeigen();
        const { Output, Mp4OutputFormat, EncodedVideoPacketSource, EncodedPacket } = Mediabunny;
        let datei = null;
        try {
            datei = await kam.videoBeginnen(name ?? `Rueckblick_${zeitstempel()}.mp4`);
            const ausgabe = new Output({ format: new Mp4OutputFormat({ fastStart: false }), target: dateiZiel(datei.id) });
            const quelle = new EncodedVideoPacketSource('avc');
            ausgabe.addVideoTrack(quelle, { frameRate: 30 });
            await ausgabe.start();
            const t0 = auswahl[0].chunk.timestamp;
            let erstes = true;
            for (const s of auswahl) {
                const paket = EncodedPacket.fromEncodedChunk(s.chunk).clone({ timestamp: (s.chunk.timestamp - t0) / 1e6 });
                await quelle.add(paket, erstes ? { decoderConfig: s.cfg ?? this.cfg } : undefined);
                erstes = false;
            }
            await ausgabe.finalize();
            const fertig = await kam.videoSchliessen(datei.id);
            datei = null;
            if (!still) toast(`Rückblick gespeichert: ${fertig}`);
            galerie.neu();
            return fertig;
        } catch (e) {
            if (datei) await kam.videoSchliessen(datei.id);
            toast(`Rückblick nicht gespeichert: ${e.message}`, true);
            return null;
        } finally {
            this.speichertGerade = false;
            this.anzeigen();
        }
    },
};
