// Videos genauer ansehen (YZ-18): Bild für Bild, Zeitlupe, ein Bild als Foto speichern, Anfang und Ende
// setzen und den Schnitt als neue Datei speichern (mediabunny kopiert, wo es geht, ohne neu zu kodieren).
const abspieler = {
    video: null,
    datei: null,
    dauer: 0,
    fps: 30,
    bildZeit: 0,      // Zeit des gerade gezeigten Bildes (aus requestVideoFrameCallback)
    zeiten: null,     // Zeitstempel aller Bilder der Datei, aufsteigend – für genaue Bildschritte
    rein: null,
    raus: null,
    schneidet: false,

    init() {
        $('#ab-anfang').addEventListener('click', () => this.springen(0));
        $('#ab-zurueck').addEventListener('click', () => this.schritt(-1));
        $('#ab-vor').addEventListener('click', () => this.schritt(1));
        $('#ab-spielen').addEventListener('click', () => this.spielen());
        $('#ab-tempo').addEventListener('change', (e) => { if (this.video) this.video.playbackRate = Number(e.target.value); });
        $('#ab-zeit').addEventListener('input', (e) => {
            if (!this.video || !this.dauer) return;
            this.video.pause();
            this.video.currentTime = Number(e.target.value) / 1000 * this.dauer;
        });
        $('#ab-in').addEventListener('click', () => this.marke('rein'));
        $('#ab-out').addEventListener('click', () => this.marke('raus'));
        $('#ab-bild-speichern').addEventListener('click', () => this.bildSpeichern());
        $('#ab-schneiden').addEventListener('click', () => this.schneiden());
    },

    // Von der Galerie gerufen, sobald ein Video in der Vorschau steht (oder null, wenn nicht)
    async binden(video, datei) {
        this.video = video;
        this.datei = datei;
        this.rein = this.raus = null;
        $('#abspiel-leiste').hidden = !video;
        if (!video) return;
        video.controls = false;
        video.playbackRate = Number($('#ab-tempo').value);
        this.dauer = 0;
        this.bildZeit = 0;
        this.fps = 30;
        this.zeiten = null;
        const bild = (_jetzt, info) => {
            if (this.video !== video) return;
            this.bildZeit = info.mediaTime;
            this.anzeigen();
            video.requestVideoFrameCallback(bild);
        };
        video.requestVideoFrameCallback(bild);
        for (const ev of ['play', 'pause', 'timeupdate', 'durationchange', 'ratechange']) video.addEventListener(ev, () => this.anzeigen());
        video.addEventListener('click', () => this.spielen());
        this.anzeigen();
        // Genaue Dauer und Bildrate aus der Datei – MediaRecorder-WebM kennt seine Dauer selbst nicht
        try {
            const eingang = new Mediabunny.Input({ source: new Mediabunny.UrlSource(medienUrl(datei.name)), formats: Mediabunny.ALL_FORMATS });
            const spur = await eingang.getPrimaryVideoTrack();
            const [dauer, statistik] = await Promise.all([eingang.computeDuration(), spur?.computePacketStats(90)]);
            if (this.video !== video) return;
            this.dauer = dauer;
            if (statistik?.averagePacketRate > 1) this.fps = statistik.averagePacketRate;
            this.anzeigen();
            // Kamerabilder kommen nicht gleichmäßig: echte Zeitstempel lesen (nur Kopfdaten, geht schnell)
            if (spur) {
                const zeiten = [];
                for await (const paket of new Mediabunny.EncodedPacketSink(spur).packets(undefined, undefined, { metadataOnly: true })) {
                    if (this.video !== video || zeiten.length > 500000) return;
                    zeiten.push(paket.timestamp);
                }
                zeiten.sort((a, b) => a - b);
                if (this.video === video && zeiten.length > 1) this.zeiten = zeiten;
            }
        } catch (e) {
            console.warn('Videodatei', e);
            if (Number.isFinite(video.duration)) this.dauer = video.duration;
        }
        this.anzeigen();
    },

    spielen() {
        const v = this.video;
        if (!v) return;
        if (v.paused) {
            if (this.dauer && v.currentTime >= this.dauer - 0.05) v.currentTime = 0;
            v.play().catch(() => {});
        } else {
            v.pause();
        }
    },

    springen(t) {
        if (!this.video) return;
        this.video.pause();
        this.video.currentTime = Math.max(0, Math.min(this.dauer || t, t));
    },

    // Index des Bildes, das zur Zeit t gezeigt wird (letzter Zeitstempel <= t)
    index(t) {
        const z = this.zeiten;
        let lo = 0, hi = z.length - 1;
        while (lo < hi) {
            const mitte = (lo + hi + 1) >> 1;
            if (z[mitte] <= t + 1e-4) lo = mitte; else hi = mitte - 1;
        }
        return lo;
    },

    bildNummer(t = this.bildZeit) {
        return this.zeiten ? this.index(t) + 1 : Math.floor(t * this.fps + 0.5) + 1;
    },

    // Ein Bild weiter oder zurück. Mit den Zeitstempeln der Datei genau auf das Nachbarbild; sonst kurz hinter
    // den geschätzten Anfang springen und, wenn es noch dasselbe Bild ist, ein Stück weiter versuchen.
    async schritt(richtung) {
        const v = this.video;
        if (!v || this.springt) return;
        this.springt = true;
        v.pause();
        try {
            if (this.zeiten) {
                const i = Math.max(0, Math.min(this.zeiten.length - 1, this.index(this.bildZeit || v.currentTime) + richtung));
                const naechstes = this.zeiten[i + 1] ?? this.zeiten[i] + 1 / this.fps;
                // Mitte zwischen diesem und dem folgenden Zeitstempel: sicher in diesem Bild
                await this.suchen(v, (this.zeiten[i] + naechstes) / 2);
                return;
            }
            const basis = this.bildZeit || v.currentTime;
            const ende = this.dauer ? this.dauer - 0.25 / this.fps : Infinity;
            let ziel = basis + (richtung + 0.25) / this.fps;
            for (let versuch = 0; versuch < 6; versuch++) {
                ziel = Math.max(0, Math.min(ende, ziel));
                await this.suchen(v, ziel);
                if (Math.abs(this.bildZeit - basis) > 1e-4 || ziel <= 0 || ziel >= ende) break;
                ziel += richtung * 0.5 / this.fps;
            }
        } finally {
            this.springt = false;
        }
    },

    // Springen und warten, bis das Bild da ist (oder 400 ms vergangen sind)
    suchen(v, t) {
        return new Promise((ok) => {
            let fertig = false;
            const weiter = () => { if (!fertig) { fertig = true; ok(); } };
            v.requestVideoFrameCallback((_j, info) => { this.bildZeit = info.mediaTime; this.anzeigen(); weiter(); });
            v.addEventListener('seeked', () => setTimeout(weiter, 60), { once: true });
            setTimeout(weiter, 400);
            v.currentTime = t;
        });
    },

    marke(welche) {
        const t = this.bildZeit || this.video?.currentTime || 0;
        this[welche] = t;
        if (this.rein != null && this.raus != null && this.raus <= this.rein) {
            if (welche === 'rein') this.raus = null; else this.rein = null;
        }
        this.anzeigen();
    },

    anzeigen() {
        const v = this.video;
        if (!v) return;
        const t = v.paused ? (this.bildZeit || v.currentTime) : v.currentTime;
        const dauer = this.dauer || (Number.isFinite(v.duration) ? v.duration : 0);
        $('#ab-spielen-symbol').setAttribute('href', v.paused ? '#i-play' : '#i-pause');
        if (document.activeElement !== $('#ab-zeit')) $('#ab-zeit').value = dauer ? String(Math.round(t / dauer * 1000)) : '0';
        const gesamt = this.zeiten ? ` von ${this.zeiten.length}` : '';
        $('#ab-zeitanzeige').textContent = `${zeitGenau(t)} / ${zeitGenau(dauer)} · Bild ${this.bildNummer(t)}${gesamt}`;
        // Schnittbereich auf der Zeitleiste
        const s = $('#ab-schnitt');
        const a = this.rein ?? 0, b = this.raus ?? dauer;
        const sichtbar = dauer > 0 && (this.rein != null || this.raus != null);
        s.classList.toggle('sichtbar', sichtbar);
        if (sichtbar) {
            s.style.left = `${a / dauer * 100}%`;
            s.style.width = `${Math.max(0, b - a) / dauer * 100}%`;
        }
        $('#ab-in').classList.toggle('an', this.rein != null);
        $('#ab-out').classList.toggle('an', this.raus != null);
        $('#ab-schneiden').disabled = this.schneidet || !sichtbar || b - a < 0.1;
        if (!this.schneidet) $('#ab-schneiden').textContent = sichtbar ? `Schnitt speichern (${zeitGenau(Math.max(0, b - a))})` : 'Schnitt speichern';
    },

    stamm() {
        return this.datei.name.replace(/\.[^.]+$/, '');
    },

    async bildSpeichern() {
        const v = this.video;
        if (!v || !v.videoWidth) return;
        v.pause();
        const t = this.bildZeit || v.currentTime;
        const c = new OffscreenCanvas(v.videoWidth, v.videoHeight);
        c.getContext('2d').drawImage(v, 0, 0);
        const png = $('#foto-format').value === 'png';
        const blob = await c.convertToBlob(png ? { type: 'image/png' } : { type: 'image/jpeg', quality: 0.95 });
        try {
            const name = await kam.fotoSpeichern(`${this.stamm()}_Bild_${zeitImNamen(t)}.${png ? 'png' : 'jpg'}`, await blob.arrayBuffer());
            toast(`Bild gespeichert: ${name}`);
            galerie.neu();
        } catch (e) {
            toast(`Bild nicht gespeichert: ${e.message}`, true);
        }
    },

    async schneiden() {
        if (this.schneidet || !this.datei) return;
        const a = this.rein ?? 0, b = this.raus ?? this.dauer;
        if (!(b - a >= 0.1)) return;
        this.schneidet = true;
        const knopf = $('#ab-schneiden');
        knopf.disabled = true;
        knopf.textContent = 'Schneidet … 0 %';
        const webm = /\.webm$/i.test(this.datei.name);
        const { Input, Output, UrlSource, ALL_FORMATS, Mp4OutputFormat, WebMOutputFormat, Conversion } = Mediabunny;
        let ziel = null;
        try {
            ziel = await kam.videoBeginnen(`${this.stamm()}_Schnitt.${webm ? 'webm' : 'mp4'}`);
            const eingang = new Input({ source: new UrlSource(medienUrl(this.datei.name)), formats: ALL_FORMATS });
            const ausgabe = new Output({ format: webm ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: false }), target: dateiZiel(ziel.id) });
            const umwandlung = await Conversion.init({ input: eingang, output: ausgabe, trim: { start: a, end: b }, showWarnings: false });
            if (!umwandlung.isValid) throw new Error('Video lässt sich nicht schneiden');
            umwandlung.onProgress = (p) => { knopf.textContent = `Schneidet … ${Math.round(p * 100)} %`; };
            await umwandlung.execute();
            const name = await kam.videoSchliessen(ziel.id);
            ziel = null;
            toast(`Schnitt gespeichert: ${name}`);
            galerie.neu();
        } catch (e) {
            if (ziel) await kam.videoSchliessen(ziel.id);
            toast(`Schneiden fehlgeschlagen: ${e.message}`, true);
        } finally {
            this.schneidet = false;
            this.anzeigen();
        }
    },
};
