// Kamera: Gerät wählen, Bild holen, Bildrate zählen, Regler aus den Fähigkeiten der Kamera bauen
const kamera = {
    strom: null,
    spur: null,
    geraete: [],
    geraetId: speicher.lesen('kamera', ''),
    aufloesung: speicher.lesen('aufloesung', '3840x2160'),
    bilder: 0,        // seit dem Start gezählte Bilder (Selbsttest)
    fps: 0,
    zuhoerer: [],     // werden nach jedem (Neu-)Start gerufen

    name() {
        // „4K Camera (0ac8:3420)“ -> „4K Camera“
        return (this.spur?.label ?? '').replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '') || 'Kamera';
    },

    async geraeteLesen() {
        const alle = await navigator.mediaDevices.enumerateDevices();
        this.geraete = alle.filter((g) => g.kind === 'videoinput' && g.deviceId);
        const wahl = $('#kamera-wahl');
        wahl.replaceChildren(...this.geraete.map((g) => new Option(g.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '') || 'Kamera', g.deviceId)));
        wahl.value = this.spur?.getSettings().deviceId ?? this.geraetId;
        wahl.closest('label').style.display = this.geraete.length > 1 ? '' : 'none';
    },

    // Die Yizhan meldet sich als „4K Camera“; die nehmen, wenn nichts anderes gewählt ist
    bevorzugt() {
        return this.geraete.find((g) => g.deviceId === this.geraetId)
            ?? this.geraete.find((g) => /4k|0ac8:3420/i.test(g.label))
            ?? this.geraete[0];
    },

    stoppen() {
        this.strom?.getTracks().forEach((t) => t.stop());
        this.strom = null;
        this.spur = null;
    },

    async starten() {
        this.stoppen();
        statusSetzen('', 'Kamera wird gestartet …');
        try {
            // Erst ohne Vorgabe fragen, damit enumerateDevices die Namen liefert
            if (!this.geraete.some((g) => g.label)) {
                const probe = await navigator.mediaDevices.getUserMedia({ video: true });
                probe.getTracks().forEach((t) => t.stop());
            }
            await this.geraeteLesen();
            const geraet = this.bevorzugt();
            if (!geraet) throw Object.assign(new Error('keine Kamera'), { name: 'NotFoundError' });
            const [w, h] = this.aufloesung.split('x').map(Number);
            this.strom = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: geraet.deviceId }, width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: 30 } },
                audio: false,
            });
        } catch (e) {
            this.stoppen();
            const text = e.name === 'NotFoundError' ? 'Keine Kamera gefunden. Bitte die Kamera per USB anschließen.'
                : e.name === 'NotReadableError' ? 'Die Kamera wird gerade von einem anderen Programm benutzt.'
                    : `Kamera lässt sich nicht starten (${e.name}: ${e.message}).`;
            statusSetzen('fehler', 'keine Kamera');
            ansicht.keinBild(text);
            return false;
        }
        this.spur = this.strom.getVideoTracks()[0];
        this.geraetId = this.spur.getSettings().deviceId;
        speicher.schreiben('kamera', this.geraetId);
        $('#kamera-wahl').value = this.geraetId;
        this.spur.addEventListener('ended', () => this.verloren());
        ansicht.keinBild(null);
        meldung(null);
        await ansicht.stromSetzen(this.strom);
        regler.bauen(this.spur, this.name());
        this.aufloesungenZeigen();
        this.zuhoerer.forEach((f) => f());
        this.statusZeigen();
        return true;
    },

    // Kamera abgezogen: Aufnahme sichern, dann warten, bis sie wieder da ist (devicechange)
    verloren() {
        if (!this.spur) return;
        aufnahme.kameraWeg();
        this.stoppen();
        statusSetzen('fehler', 'Kamera getrennt');
        ansicht.keinBild('Die Verbindung zur Kamera ist weg. Sobald sie wieder steckt, geht es von selbst weiter.');
    },

    aufloesungenZeigen() {
        const s = this.spur.getSettings();
        const f = this.spur.getCapabilities?.() ?? {};
        const maxB = f.width?.max ?? s.width, maxH = f.height?.max ?? s.height;
        // Übliche 16:9-Stufen bis zur größten, die die Kamera kann
        const stufen = [[3840, 2160, '4K'], [2560, 1440, '1440p'], [1920, 1080, '1080p'], [1280, 720, '720p'], [640, 360, '360p']]
            .filter(([w, h]) => w <= maxB && h <= maxH);
        const wahl = $('#aufloesung');
        wahl.replaceChildren(...stufen.map(([w, h, n]) => new Option(`${n} · ${w}×${h}`, `${w}x${h}`)));
        wahl.value = `${s.width}x${s.height}`;
        if (!wahl.value) wahl.add(new Option(`${s.width}×${s.height}`, `${s.width}x${s.height}`), 0), wahl.value = `${s.width}x${s.height}`;
    },

    statusZeigen() {
        if (!this.spur) return;
        const s = this.spur.getSettings();
        statusSetzen('verbunden', `${this.name()} · ${s.width}×${s.height} · ${this.fps.toFixed(0)} B/s`);
    },

    breite() { return ansicht.video.videoWidth || this.spur?.getSettings().width || 0; },
    hoehe() { return ansicht.video.videoHeight || this.spur?.getSettings().height || 0; },
};

function statusSetzen(art, text) {
    $('#status').className = art;
    $('#status-text').textContent = text;
}

// Bildrate: echte Videobilder zählen, nicht die Vorgabe der Kamera (gestartet nach ansicht.init)
function bildrateZaehlen() {
    let anzahl = 0, seit = performance.now();
    const v = ansicht.video;
    function bild() {
        anzahl++;
        kamera.bilder++;
        v.requestVideoFrameCallback(bild);
    }
    v.requestVideoFrameCallback(bild);
    setInterval(() => {
        const jetzt = performance.now();
        kamera.fps = ansicht.standbild ? kamera.fps : anzahl * 1000 / (jetzt - seit);
        anzahl = 0;
        seit = jetzt;
        kamera.statusZeigen();
    }, 1000);
}

navigator.mediaDevices.addEventListener('devicechange', async () => {
    if (kamera.spur && kamera.spur.readyState === 'live') {
        kamera.geraeteLesen();
        return;
    }
    // Kurz warten, Windows braucht nach dem Einstecken einen Moment
    setTimeout(() => { if (!kamera.spur) kamera.starten(); }, 1200);
});

/* ------------------------------------------------------------ Regler */

// Reihenfolge und deutsche Namen; „modus“ = zugehöriger Auto-Schalter
const REGLER = [
    { k: 'brightness', name: 'Helligkeit' },
    { k: 'contrast', name: 'Kontrast' },
    { k: 'saturation', name: 'Sättigung' },
    { k: 'sharpness', name: 'Schärfe' },
    { k: 'exposureTime', name: 'Belichtung', modus: 'exposureMode', text: belichtungText, log2: true },
    { k: 'exposureCompensation', name: 'Belicht.-Korr.' },
    { k: 'colorTemperature', name: 'Weißabgleich', modus: 'whiteBalanceMode' },
    { k: 'focusDistance', name: 'Fokus', modus: 'focusMode' },
    { k: 'zoom', name: 'Zoom' },
    { k: 'pan', name: 'Schwenken' },
    { k: 'tilt', name: 'Neigen' },
];

// Chromium rechnet die Belichtungsstufe von Windows (Zweierpotenz in Sekunden) in 100-µs-Schritte um.
// Die Yizhan hält sich nicht an Sekunden (Stufe 0 = „1 s“ bei 30 B/s), deshalb zeigt der Regler
// die Stufe selbst (−6 … +2), wie die Windows-Kamera-App.
function belichtungText(wert) {
    const k = Math.round(Math.log2(wert / 10000));
    return k > 0 ? `+${k}` : k < 0 ? `−${-k}` : '0';
}

const regler = {
    spur: null,
    schluessel: '',
    werte: {},

    bauen(spur, name) {
        this.spur = spur;
        this.schluessel = 'regler.' + name;
        const f = spur.getCapabilities?.() ?? {};
        const s = spur.getSettings();
        // Werkswerte beim ersten Mal merken – „Standard“ stellt sie wieder her
        const werk = speicher.lesen(this.schluessel + '.werk', null) ?? {};
        let neu = false;
        for (const r of REGLER) {
            if (!(r.k in s)) continue;
            if (!(r.k in werk)) { werk[r.k] = s[r.k]; neu = true; }
            if (r.modus && r.modus in s && !(r.modus in werk)) { werk[r.modus] = s[r.modus]; neu = true; }
        }
        if (neu) speicher.schreiben(this.schluessel + '.werk', werk);
        this.werk = werk;

        const box = $('#regler');
        box.replaceChildren();
        for (const r of REGLER) {
            const fk = f[r.k];
            if (!fk || typeof fk.min !== 'number' || fk.max <= fk.min) continue;
            box.append(this.zeile(r, fk, f[r.modus]));
        }
        if (!box.children.length) {
            const leer = document.createElement('div');
            leer.className = 'regler-leer';
            leer.textContent = 'Diese Kamera bietet keine Regler an.';
            box.append(leer);
        }
        // Zuletzt eingestellte Werte wieder anwenden
        const gemerkt = speicher.lesen(this.schluessel, null);
        if (gemerkt) this.anwenden(gemerkt, false);
        else this.anzeigen();
    },

    zeile(r, fk, modi) {
        const z = document.createElement('div');
        z.className = 'regler';
        z.dataset.k = r.k;
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = r.name;
        const schieber = document.createElement('input');
        schieber.type = 'range';
        // Zweierpotenzen nur, wenn das genug Stufen ergibt (Chromiums Testkamera hat z. B. 10 … 100)
        const log = r.log2 && Math.floor(Math.log2(fk.max / 10000)) - Math.ceil(Math.log2(fk.min / 10000)) >= 2;
        if (log) {
            z.dataset.log = '1';
            schieber.min = Math.ceil(Math.log2(fk.min / 10000));
            schieber.max = Math.floor(Math.log2(fk.max / 10000));
            schieber.step = 1;
        } else {
            schieber.min = fk.min;
            schieber.max = fk.max;
            schieber.step = fk.step || 1;
        }
        const wert = document.createElement('span');
        wert.className = 'wert';
        z.append(name, schieber, wert);

        // Auto-Schalter, wenn die Kamera beides kann
        if (r.modus && Array.isArray(modi) && modi.includes('continuous') && modi.includes('manual')) {
            const auto = document.createElement('button');
            auto.className = 'auto-schalter';
            auto.textContent = 'Auto';
            auto.title = 'Automatik an/aus';
            auto.addEventListener('click', () => {
                const an = this.spur.getSettings()[r.modus] !== 'continuous';
                this.anwenden({ [r.modus]: an ? 'continuous' : 'manual' });
            });
            name.append(auto);
        }

        let wartend = null;
        schieber.addEventListener('input', () => {
            const roh = Number(schieber.value);
            const v = log ? 10000 * 2 ** roh : roh;
            wert.textContent = log ? r.text(v) : String(Math.round(v));
            // Regler ziehen schaltet die Automatik ab; höchstens ein Auftrag zur Zeit
            const auftrag = r.modus && this.spur.getSettings()[r.modus] === 'continuous' ? { [r.modus]: 'manual', [r.k]: v } : { [r.k]: v };
            wartend = auftrag;
            if (this.laeuft) return;
            const los = async () => {
                while (wartend) {
                    const a = wartend;
                    wartend = null;
                    this.laeuft = true;
                    await this.anwenden(a);
                    this.laeuft = false;
                }
            };
            los();
        });
        schieber.addEventListener('dblclick', () => {
            if (r.k in this.werk) this.anwenden({ [r.k]: this.werk[r.k], ...(r.modus && r.modus in this.werk ? { [r.modus]: this.werk[r.modus] } : {}) });
        });
        return z;
    },

    async anwenden(werte, merken = true) {
        if (!this.spur || this.spur.readyState !== 'live') return;
        const f = this.spur.getCapabilities?.() ?? {};
        // Nur, was die Kamera kennt; Modus vor Wert, sonst greift der Wert bei Automatik nicht
        const auftrag = {};
        for (const r of REGLER) {
            if (r.modus && r.modus in werte && Array.isArray(f[r.modus])) auftrag[r.modus] = werte[r.modus];
            if (r.k in werte && f[r.k]) auftrag[r.k] = Math.min(f[r.k].max, Math.max(f[r.k].min, Number(werte[r.k])));
        }
        try {
            await this.spur.applyConstraints({ advanced: [auftrag] });
        } catch (e) {
            console.warn('Regler', e);
        }
        if (merken) {
            const s = this.spur.getSettings();
            const alles = {};
            for (const r of REGLER) {
                if (r.k in s && f[r.k]) alles[r.k] = s[r.k];
                if (r.modus && r.modus in s) alles[r.modus] = s[r.modus];
            }
            speicher.schreiben(this.schluessel, alles);
        }
        this.anzeigen();
    },

    anzeigen() {
        if (!this.spur) return;
        const s = this.spur.getSettings();
        for (const z of $$('#regler .regler')) {
            const r = REGLER.find((x) => x.k === z.dataset.k);
            const v = s[r.k];
            const schieber = z.querySelector('input');
            const log = z.dataset.log === '1';
            if (document.activeElement !== schieber) schieber.value = log ? Math.round(Math.log2(v / 10000)) : v;
            z.querySelector('.wert').textContent = log ? r.text(v) : String(Math.round(v));
            const auto = r.modus && s[r.modus] === 'continuous';
            z.classList.toggle('auto', !!auto);
            z.querySelector('.auto-schalter')?.classList.toggle('an', !!auto);
        }
    },

    standard() {
        if (this.werk) this.anwenden(this.werk);
    },
};

// Bei Automatik ändern sich Belichtung und Weißabgleich laufend – Anzeige nachziehen
setInterval(() => { if (regler.spur && !regler.laeuft) regler.anzeigen(); }, 1000);
