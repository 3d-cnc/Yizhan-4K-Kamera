// Kleine Helfer für alle Teile der Oberfläche
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// localStorage kann fehlen oder werfen – dann eben ohne Merken
const speicher = {
    lesen(name, vorgabe) {
        try {
            const w = localStorage.getItem('yizhan.' + name);
            return w === null ? vorgabe : JSON.parse(w);
        } catch {
            return vorgabe;
        }
    },
    schreiben(name, wert) {
        try { localStorage.setItem('yizhan.' + name, JSON.stringify(wert)); } catch { /* egal */ }
    },
};

const zwei = (n) => String(n).padStart(2, '0');

// 2026-10-07_18-40-12 – sortiert richtig und ist ein gültiger Dateiname
function zeitstempel(d = new Date()) {
    return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}_${zwei(d.getHours())}-${zwei(d.getMinutes())}-${zwei(d.getSeconds())}`;
}

function dauerText(sek) {
    sek = Math.floor(sek);
    const h = Math.floor(sek / 3600), m = Math.floor(sek / 60) % 60, s = sek % 60;
    return h ? `${h}:${zwei(m)}:${zwei(s)}` : `${zwei(m)}:${zwei(s)}`;
}

function bytesText(b) {
    if (b == null) return '–';
    const e = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (b >= 1000 && i < e.length - 1) { b /= 1000; i++; }
    return `${b.toLocaleString('de-DE', { maximumFractionDigits: b < 10 && i ? 1 : 0 })} ${e[i]}`;
}

function toast(text, fehler = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (fehler ? ' fehler' : '');
    t.textContent = text;
    $('#toasts').append(t);
    setTimeout(() => t.remove(), fehler ? 6000 : 2500);
    while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}

function meldung(text) {
    const m = $('#meldung');
    m.textContent = text ?? '';
    m.classList.toggle('sichtbar', !!text);
}

function hinweis(titel, html) {
    $('#hinweis-titel').textContent = titel;
    $('#hinweis-text').innerHTML = html;
    $('#hinweis-dialog').classList.add('offen');
}

// medien://datei/<name> zeigt eine Datei aus dem Speicherordner, medien://vorschau/<name> ein kleines Bild davon
const medienUrl = (name, art = 'datei') => `medien://${art}/${encodeURIComponent(name)}`;

// Selbsttest: einen Knopf so drücken, wie es die Maus täte
function pruefKlick(sel) {
    const el = $(sel);
    if (!el) throw new Error('nicht gefunden: ' + sel);
    el.click();
}
