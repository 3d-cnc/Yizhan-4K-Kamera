// Ansicht: Bild einpassen, zoomen, verschieben, spiegeln, Fadenkreuz und Raster, Standbild,
// dazu Histogramm und Schärfewert der Bildmitte
const ansicht = {
    video: null,
    buehne: null,
    rahmen: null,
    overlay: null,
    zoom: 1,          // 1 = ganzes Bild eingepasst
    ox: 0, oy: 0,     // Lage des Bildes in der Bühne (Pixel, links oben)
    fit: { w: 0, h: 0, x: 0, y: 0 },
    spiegelnH: speicher.lesen('spiegelnH', false),
    spiegelnV: speicher.lesen('spiegelnV', false),
    fadenkreuz: speicher.lesen('fadenkreuz', false),
    raster: speicher.lesen('raster', false),
    rasterTeilung: speicher.lesen('rasterTeilung', 3),
    farbe: speicher.lesen('overlayFarbe', '#4fc3f7'),
    standbild: false,

    init() {
        this.video = $('#live');
        this.buehne = $('#buehne');
        this.rahmen = $('#bildrahmen');
        this.overlay = $('#overlay');
        new ResizeObserver(() => this.einpassen(true)).observe(this.buehne);
        this.video.addEventListener('loadedmetadata', () => this.einpassen(false));
        this.video.addEventListener('resize', () => this.einpassen(false));

        // Mausrad: um den Mauszeiger zoomen; Ziehen: verschieben; Doppelklick: ganzes Bild
        this.buehne.addEventListener('wheel', (e) => {
            e.preventDefault();
            const r = this.buehne.getBoundingClientRect();
            this.zoomUm(this.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX - r.left, e.clientY - r.top);
        }, { passive: false });
        let zug = null;
        this.buehne.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            zug = { x: e.clientX, y: e.clientY, ox: this.ox, oy: this.oy };
            this.buehne.setPointerCapture(e.pointerId);
            this.buehne.classList.add('ziehen');
        });
        this.buehne.addEventListener('pointermove', (e) => {
            if (!zug) return;
            this.ox = zug.ox + e.clientX - zug.x;
            this.oy = zug.oy + e.clientY - zug.y;
            this.anwenden();
        });
        const loslassen = () => { zug = null; this.buehne.classList.remove('ziehen'); };
        this.buehne.addEventListener('pointerup', loslassen);
        this.buehne.addEventListener('pointercancel', loslassen);
        this.buehne.addEventListener('dblclick', () => this.zuruecksetzen());

        $('#zoom-weg').addEventListener('click', () => this.zuruecksetzen());
        $('#zoom-1zu1').addEventListener('click', () => this.einsZuEins());
        $('#zoom-plus').addEventListener('click', () => this.zoomUm(this.zoom * 1.5));
        $('#zoom-minus').addEventListener('click', () => this.zoomUm(this.zoom / 1.5));
        $('#spiegeln-h').addEventListener('click', () => this.umschalten('spiegelnH'));
        $('#spiegeln-v').addEventListener('click', () => this.umschalten('spiegelnV'));
        $('#fadenkreuz').addEventListener('click', () => this.umschalten('fadenkreuz'));
        $('#raster').addEventListener('click', () => this.umschalten('raster'));
        $('#raster-teilung').value = String(this.rasterTeilung);
        $('#raster-teilung').addEventListener('change', (e) => {
            this.rasterTeilung = Number(e.target.value);
            speicher.schreiben('rasterTeilung', this.rasterTeilung);
            if (!this.raster) this.umschalten('raster');
            else this.overlayZeichnen();
        });
        $('#overlay-farbe').value = this.farbe;
        $('#overlay-farbe').addEventListener('input', (e) => {
            this.farbe = e.target.value;
            speicher.schreiben('overlayFarbe', this.farbe);
            this.overlayZeichnen();
        });
        $('#standbild').addEventListener('click', () => this.standbildUmschalten());
        this.knoepfeZeigen();
        setInterval(() => this.messen(), 250);
    },

    async stromSetzen(strom) {
        this.video.srcObject = strom;
        this.standbild = false;
        this.knoepfeZeigen();
        try { await this.video.play(); } catch { /* startet mit dem nächsten Bild */ }
    },

    keinBild(text) {
        $('#kein-bild').textContent = text ?? '';
        $('#kein-bild').classList.toggle('sichtbar', !!text);
        if (text) this.video.srcObject = null;
    },

    // Bild in die Bühne einpassen; beim Größenändern der Bühne den Ausschnitt behalten
    einpassen(behalten) {
        const W = this.buehne.clientWidth, H = this.buehne.clientHeight;
        const vw = this.video.videoWidth || 16, vh = this.video.videoHeight || 9;
        const s = Math.min(W / vw, H / vh);
        const alt = this.fit;
        this.fit = { w: vw * s, h: vh * s, x: (W - vw * s) / 2, y: (H - vh * s) / 2 };
        this.rahmen.style.width = `${this.fit.w}px`;
        this.rahmen.style.height = `${this.fit.h}px`;
        const dpr = devicePixelRatio || 1;
        this.overlay.width = Math.round(W * dpr);
        this.overlay.height = Math.round(H * dpr);
        if (behalten && alt.w && this.zoom !== 1) {
            // Mittelpunkt des Ausschnitts bleibt derselbe Bildpunkt
            const k = this.fit.w / alt.w;
            this.ox *= k; this.oy *= k;
            this.anwenden();
        } else {
            this.zuruecksetzen();
        }
    },

    zuruecksetzen() {
        this.zoom = 1;
        this.ox = this.fit.x;
        this.oy = this.fit.y;
        this.anwenden();
    },

    // Zoom auf z, Bühnenpunkt (px, py) bleibt stehen (Vorgabe: Mitte)
    zoomUm(z, px = this.buehne.clientWidth / 2, py = this.buehne.clientHeight / 2) {
        const max = Math.max(4, this.einsZuEinsFaktor() * 4);
        z = Math.min(max, Math.max(1, z));
        const u = (px - this.ox) / this.zoom, v = (py - this.oy) / this.zoom;
        this.ox = px - u * z;
        this.oy = py - v * z;
        this.zoom = z;
        this.anwenden();
    },

    // Selbsttest und Tastatur: Zoomfaktor um einen Punkt in Bruchteilen der Bühne
    zoomen(z, fx = 0.5, fy = 0.5) {
        this.zoomUm(z, this.buehne.clientWidth * fx, this.buehne.clientHeight * fy);
    },

    einsZuEinsFaktor() {
        return (this.video.videoWidth || this.fit.w) / (this.fit.w * (devicePixelRatio || 1)) || 1;
    },
    einsZuEins() {
        this.zoomUm(this.einsZuEinsFaktor());
    },

    // Nie über den Rand hinaus schieben; kleiner als die Bühne: mittig
    anwenden() {
        const W = this.buehne.clientWidth, H = this.buehne.clientHeight;
        const bw = this.fit.w * this.zoom, bh = this.fit.h * this.zoom;
        this.ox = bw <= W ? (W - bw) / 2 : Math.min(0, Math.max(W - bw, this.ox));
        this.oy = bh <= H ? (H - bh) / 2 : Math.min(0, Math.max(H - bh, this.oy));
        this.rahmen.style.transform = `translate(${this.ox}px, ${this.oy}px) scale(${this.zoom})`;
        this.video.style.transform = `scale(${this.spiegelnH ? -1 : 1}, ${this.spiegelnV ? -1 : 1})`;
        $('#zoom-anzeige').textContent = `${Math.round(this.zoom * 100)} %`;
        this.overlayZeichnen();
    },

    umschalten(was) {
        this[was] = !this[was];
        speicher.schreiben(was, this[was]);
        this.knoepfeZeigen();
        this.anwenden();
    },

    knoepfeZeigen() {
        $('#spiegeln-h').classList.toggle('an', this.spiegelnH);
        $('#spiegeln-v').classList.toggle('an', this.spiegelnV);
        $('#fadenkreuz').classList.toggle('an', this.fadenkreuz);
        $('#raster').classList.toggle('an', this.raster);
        $('#standbild').classList.toggle('an', this.standbild);
        $('#standbild-marke').classList.toggle('sichtbar', this.standbild);
    },

    standbildUmschalten() {
        if (!this.video.srcObject) return;
        this.standbild = !this.standbild;
        if (this.standbild) this.video.pause();
        else this.video.play().catch(() => {});
        this.knoepfeZeigen();
    },

    overlayZeichnen() {
        const c = this.overlay, x = c.getContext('2d');
        const dpr = devicePixelRatio || 1;
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.clearRect(0, 0, c.width, c.height);
        if (!this.fadenkreuz && !this.raster) return;
        x.setTransform(dpr, 0, 0, dpr, 0, 0);
        const W = c.width / dpr, H = c.height / dpr;
        // Sichtbarer Teil des Bildes
        const l = Math.max(0, this.ox), o = Math.max(0, this.oy);
        const r = Math.min(W, this.ox + this.fit.w * this.zoom), u = Math.min(H, this.oy + this.fit.h * this.zoom);
        x.strokeStyle = this.farbe;
        x.lineWidth = 1;
        if (this.raster) {
            x.globalAlpha = 0.55;
            x.beginPath();
            const n = this.rasterTeilung;
            for (let i = 1; i < n; i++) {
                const gx = Math.round(this.ox + this.fit.w * this.zoom * i / n) + 0.5;
                const gy = Math.round(this.oy + this.fit.h * this.zoom * i / n) + 0.5;
                if (gx > l && gx < r) { x.moveTo(gx, o); x.lineTo(gx, u); }
                if (gy > o && gy < u) { x.moveTo(l, gy); x.lineTo(r, gy); }
            }
            x.stroke();
        }
        if (this.fadenkreuz) {
            x.globalAlpha = 0.9;
            const mx = Math.round(this.ox + this.fit.w * this.zoom / 2) + 0.5;
            const my = Math.round(this.oy + this.fit.h * this.zoom / 2) + 0.5;
            const luecke = 12;
            x.beginPath();
            x.moveTo(l, my); x.lineTo(mx - luecke, my);
            x.moveTo(mx + luecke, my); x.lineTo(r, my);
            x.moveTo(mx, o); x.lineTo(mx, my - luecke);
            x.moveTo(mx, my + luecke); x.lineTo(mx, u);
            x.stroke();
            x.beginPath();
            x.arc(mx, my, 40, 0, Math.PI * 2);
            x.stroke();
        }
        x.globalAlpha = 1;
    },

    // Ein Kamerabild in w × h zeichnen, so gespiegelt wie die Ansicht (Foto, Aufnahme)
    bildZeichnen(ctx, w, h, quelle = this.video) {
        ctx.save();
        ctx.setTransform(this.spiegelnH ? -1 : 1, 0, 0, this.spiegelnV ? -1 : 1, this.spiegelnH ? w : 0, this.spiegelnV ? h : 0);
        ctx.drawImage(quelle, 0, 0, w, h);
        ctx.restore();
    },

    gespiegelt() {
        return this.spiegelnH || this.spiegelnV;
    },

    /* -------------------------------------------- Histogramm und Schärfe */

    klein: null,
    mitte: null,
    besteSchaerfe: 0,

    messen() {
        const v = this.video;
        if (!v.videoWidth || $('#seite-live').offsetParent === null) return;
        if (!this.klein) {
            this.klein = new OffscreenCanvas(256, 144).getContext('2d', { willReadFrequently: true });
            this.mitte = new OffscreenCanvas(480, 270).getContext('2d', { willReadFrequently: true });
        }
        // Histogramm aus dem verkleinerten Bild
        this.klein.drawImage(v, 0, 0, 256, 144);
        const d = this.klein.getImageData(0, 0, 256, 144).data;
        const hist = new Uint32Array(256);
        let schwarz = 0, weiss = 0;
        for (let i = 0; i < d.length; i += 4) {
            const y = (d[i] * 54 + d[i + 1] * 183 + d[i + 2] * 19) >> 8;
            hist[y]++;
            if (Math.max(d[i], d[i + 1], d[i + 2]) >= 254) weiss++;
            if (y <= 2) schwarz++;
        }
        const n = d.length / 4;
        this.histogrammZeichnen(hist);
        const pz = (k) => (k / n * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 });
        $('#clip-anzeige').innerHTML = `<span class="${schwarz / n > 0.01 ? 'warn' : ''}">Schwarz ${pz(schwarz)} %</span> · <span class="${weiss / n > 0.01 ? 'warn' : ''}">Weiß ${pz(weiss)} %</span>`;

        // Schärfe: Laplace-Varianz in der Bildmitte, in echten Kamerapixeln (480 × 270)
        const mw = Math.min(480, v.videoWidth), mh = Math.min(270, v.videoHeight);
        this.mitte.drawImage(v, (v.videoWidth - mw) / 2, (v.videoHeight - mh) / 2, mw, mh, 0, 0, mw, mh);
        const m = this.mitte.getImageData(0, 0, mw, mh).data;
        const lum = new Float32Array(mw * mh);
        for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = m[i] * 0.21 + m[i + 1] * 0.72 + m[i + 2] * 0.07;
        let summe = 0, anzahl = 0;
        for (let y = 1; y < mh - 1; y++) {
            for (let x = 1; x < mw - 1; x++) {
                const k = y * mw + x;
                const l = 4 * lum[k] - lum[k - 1] - lum[k + 1] - lum[k - mw] - lum[k + mw];
                summe += l * l;
                anzahl++;
            }
        }
        const wert = Math.sqrt(summe / anzahl);
        this.schaerfe = wert;
        if (wert > this.besteSchaerfe) this.besteSchaerfe = wert;
        const skala = Math.max(this.besteSchaerfe * 1.15, 1);
        $('#schaerfe-balken').style.width = `${wert / skala * 100}%`;
        $('#schaerfe-best').style.left = `${this.besteSchaerfe / skala * 100}%`;
        $('#schaerfe-wert').textContent = wert.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
    },

    histogrammZeichnen(hist) {
        const c = $('#histogramm');
        const dpr = devicePixelRatio || 1;
        const W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
        if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
        const x = c.getContext('2d');
        x.clearRect(0, 0, W, H);
        // Wurzel-Skala: kleine Häufigkeiten bleiben sichtbar, ein riesiger Balken drückt nicht alles platt
        let max = 1;
        for (let i = 1; i < 255; i++) max = Math.max(max, hist[i]);
        const stil = getComputedStyle(document.documentElement);
        x.fillStyle = stil.getPropertyValue('--akzent').trim();
        x.globalAlpha = 0.75;
        x.beginPath();
        x.moveTo(0, H);
        for (let i = 0; i < 256; i++) {
            const h = Math.min(1, Math.sqrt(hist[i] / max)) * (H - 4);
            x.lineTo(i / 255 * W, H - h);
        }
        x.lineTo(W, H);
        x.closePath();
        x.fill();
        x.globalAlpha = 1;
        // Viertelmarken
        x.strokeStyle = stil.getPropertyValue('--line').trim();
        x.beginPath();
        for (const q of [0.25, 0.5, 0.75]) { x.moveTo(Math.round(q * W) + 0.5, 0); x.lineTo(Math.round(q * W) + 0.5, H); }
        x.stroke();
    },
};
