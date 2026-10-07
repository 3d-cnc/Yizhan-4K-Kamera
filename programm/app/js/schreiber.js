// Ziel für mediabunny: schreibt die Ausgabe über das Hauptprogramm direkt in eine Datei im Speicherordner.
// MP4 springt beim Abschließen zurück an den Anfang, deshalb mit Stelle statt nur Anhängen.
function dateiZiel(id) {
    const ziel = new WritableStream({
        // Kopie: die Daten können eine Sicht auf einen größeren Puffer sein
        write: (stueck) => kam.videoSchreibenAn(id, stueck.data.slice(), stueck.position),
    });
    return new Mediabunny.StreamTarget(ziel, { chunked: true, chunkSize: 8 * 2 ** 20 });
}

// Zeit im Dateinamen: 75,4 s -> 01-15-400
function zeitImNamen(sek) {
    const ms = Math.round(sek * 1000);
    return `${zwei(Math.floor(ms / 60000))}-${zwei(Math.floor(ms / 1000) % 60)}-${String(ms % 1000).padStart(3, '0')}`;
}

// 75,4 -> 01:15,400
function zeitGenau(sek) {
    if (!Number.isFinite(sek)) return '--:--,---';
    const ms = Math.max(0, Math.round(sek * 1000));
    const h = Math.floor(ms / 3600000);
    const rest = `${zwei(Math.floor(ms / 60000) % 60)}:${zwei(Math.floor(ms / 1000) % 60)},${String(ms % 1000).padStart(3, '0')}`;
    return h ? `${h}:${rest}` : rest;
}

// Kurzer Ton (Überwachung, Alarme) – ohne Datei, direkt erzeugt
let tonKontext = null;
function ton(hoehe = 880, dauer = 0.15, wiederholen = 1) {
    try {
        tonKontext ??= new AudioContext();
        for (let i = 0; i < wiederholen; i++) {
            const o = tonKontext.createOscillator();
            const g = tonKontext.createGain();
            const t = tonKontext.currentTime + i * dauer * 1.6;
            o.frequency.value = hoehe;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
            o.connect(g).connect(tonKontext.destination);
            o.start(t);
            o.stop(t + dauer + 0.02);
        }
    } catch {
        /* ohne Ton */
    }
}
