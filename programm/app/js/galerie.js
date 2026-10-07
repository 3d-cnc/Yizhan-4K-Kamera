// Galerie: alle Fotos und Videos im Speicherordner, Filmstreifen unter dem Live-Bild, Vorschau
const galerie = {
    dateien: [],
    filter: 'alle',
    offen: -1,          // Index in sichtbar() der geöffneten Vorschau
    zeitgeber: null,

    init() {
        for (const f of $$('.filter')) {
            f.addEventListener('click', () => {
                this.filter = f.dataset.filter;
                $$('.filter').forEach((x) => x.classList.toggle('aktiv', x === f));
                this.zeichnen();
            });
        }
        $('#galerie-ordner').addEventListener('click', () => kam.ordnerOeffnen());
        $('#vorschau-zu').addEventListener('click', () => this.schliessen());
        $('#vorschau').addEventListener('click', (e) => { if (e.target.id === 'vorschau') this.schliessen(); });
        $('#vorschau-zurueck').addEventListener('click', () => this.blaettern(-1));
        $('#vorschau-weiter').addEventListener('click', () => this.blaettern(1));
        $('#vorschau-oeffnen').addEventListener('click', () => kam.dateiOeffnen(this.aktuell().name));
        $('#vorschau-zeigen').addEventListener('click', () => kam.dateiZeigen(this.aktuell().name));
        $('#vorschau-kopieren').addEventListener('click', async () => {
            if (await kam.dateiKopieren(this.aktuell().name)) toast('Foto in die Zwischenablage kopiert');
        });
        $('#vorschau-loeschen').addEventListener('click', () => this.loeschen());
        this.laden();
    },

    // Nach einem Foto/Video: kurz sammeln, dann neu lesen (Intervall und Serien nicht bei jedem Bild)
    neu() {
        clearTimeout(this.zeitgeber);
        this.zeitgeber = setTimeout(() => this.laden(), 150);
    },

    async laden() {
        this.dateien = await kam.dateien();
        $('#galerie-zahl').textContent = this.dateien.length ? String(this.dateien.length) : '';
        this.zeichnen();
        this.filmstreifen();
    },

    sichtbar() {
        return this.filter === 'alle' ? this.dateien : this.dateien.filter((d) => d.art === this.filter);
    },

    aktuell() {
        return this.sichtbar()[this.offen];
    },

    zeitText(ms) {
        return new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    },

    bildchen(d) {
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = '';
        img.src = medienUrl(d.name, 'vorschau') + `?t=${Math.round(d.zeit)}`;
        return img;
    },

    zeichnen() {
        const liste = this.sichtbar();
        const raster = $('#galerie-raster');
        raster.replaceChildren(...liste.map((d, i) => {
            const k = document.createElement('button');
            k.className = `kachel ${d.art}`;
            const bild = document.createElement('div');
            bild.className = 'bild';
            bild.append(this.bildchen(d));
            const unten = document.createElement('div');
            unten.className = 'unten';
            const name = document.createElement('span');
            name.className = 'name';
            name.textContent = d.name;
            const groesse = document.createElement('span');
            groesse.className = 'groesse';
            groesse.textContent = bytesText(d.groesse);
            unten.append(name, groesse);
            k.append(bild, unten);
            k.addEventListener('click', () => this.oeffnen(i));
            return k;
        }));
        $('#galerie-leer').classList.toggle('sichtbar', !liste.length);
        const summe = liste.reduce((s, d) => s + d.groesse, 0);
        const fotos = liste.filter((d) => d.art === 'foto').length;
        const videos = liste.length - fotos;
        $('#galerie-summe').textContent = liste.length ? `${fotos} ${fotos === 1 ? 'Foto' : 'Fotos'} · ${videos} ${videos === 1 ? 'Video' : 'Videos'} · ${bytesText(summe)}` : '';
    },

    filmstreifen() {
        const streifen = $('#filmstreifen');
        streifen.replaceChildren(...this.dateien.slice(0, 8).map((d) => {
            const b = document.createElement('button');
            b.className = `bildchen ${d.art}`;
            b.title = d.name;
            b.append(this.bildchen(d));
            b.addEventListener('click', () => {
                this.filter = 'alle';
                $$('.filter').forEach((x) => x.classList.toggle('aktiv', x.dataset.filter === 'alle'));
                this.zeichnen();
                this.oeffnen(this.dateien.indexOf(d));
            });
            return b;
        }));
    },

    oeffnen(i) {
        const liste = this.sichtbar();
        if (i < 0 || i >= liste.length) return;
        this.offen = i;
        const d = liste[i];
        $('#vorschau-name').textContent = d.name;
        $('#vorschau-info').textContent = `${this.zeitText(d.zeit)} · ${bytesText(d.groesse)}`;
        $('#vorschau-kopieren').style.display = d.art === 'foto' ? '' : 'none';
        $('#vorschau-zurueck').disabled = i === 0;
        $('#vorschau-weiter').disabled = i === liste.length - 1;
        const inhalt = $('#vorschau-inhalt');
        inhalt.querySelector('video')?.pause();
        let el;
        if (d.art === 'video') {
            el = document.createElement('video');
            el.controls = true;
            el.autoplay = true;
            el.muted = true;
        } else {
            el = document.createElement('img');
            el.onload = () => { $('#vorschau-info').textContent = `${el.naturalWidth}×${el.naturalHeight} · ${this.zeitText(d.zeit)} · ${bytesText(d.groesse)}`; };
        }
        el.src = medienUrl(d.name) + `?t=${Math.round(d.zeit)}`;
        inhalt.replaceChildren(el);
        $('#vorschau').classList.add('offen');
    },

    istOffen() {
        return $('#vorschau').classList.contains('offen');
    },

    schliessen() {
        $('#vorschau-inhalt').querySelector('video')?.pause();
        $('#vorschau-inhalt').replaceChildren();
        $('#vorschau').classList.remove('offen');
        this.offen = -1;
    },

    blaettern(r) {
        this.oeffnen(Math.min(this.sichtbar().length - 1, Math.max(0, this.offen + r)));
    },

    async loeschen() {
        const d = this.aktuell();
        if (!d) return;
        // Video vorher loslassen, sonst hält Windows die Datei fest
        $('#vorschau-inhalt').querySelector('video')?.removeAttribute('src');
        $('#vorschau-inhalt').replaceChildren();
        try {
            await kam.dateiLoeschen(d.name);
            toast(`${d.name} in den Papierkorb gelegt`);
        } catch (e) {
            toast(`Löschen fehlgeschlagen: ${e.message}`, true);
        }
        const i = this.offen;
        await this.laden();
        const liste = this.sichtbar();
        if (liste.length) this.oeffnen(Math.min(i, liste.length - 1));
        else this.schliessen();
    },
};
