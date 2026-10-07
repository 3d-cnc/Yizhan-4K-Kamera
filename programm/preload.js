// Brücke zwischen Oberfläche und Programm: Dateien, Galerie, Fenster
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kam', {
    version: () => ipcRenderer.invoke('version'),
    // Menü: Versionsprüfung, Fenstergröße beim Start, Links ins GitHub-Projekt
    versionPruefen: () => ipcRenderer.invoke('version-pruefen'),
    einstellungen: () => ipcRenderer.invoke('einstellungen'),
    updatesBeimStart: (an) => ipcRenderer.invoke('updates-beim-start', an),
    fenstergroesse: (breite, hoehe) => ipcRenderer.invoke('fenstergroesse', breite, hoehe),
    linkOeffnen: (url) => ipcRenderer.send('link-oeffnen', url),
    // Speicherordner
    ordner: () => ipcRenderer.invoke('ordner'),
    ordnerWaehlen: () => ipcRenderer.invoke('ordner-waehlen'),
    ordnerOeffnen: () => ipcRenderer.invoke('ordner-oeffnen'),
    platz: () => ipcRenderer.invoke('platz'),
    // Fotos und Videos
    fotoSpeichern: (name, daten) => ipcRenderer.invoke('foto-speichern', name, daten),
    videoBeginnen: (name) => ipcRenderer.invoke('video-beginnen', name),
    videoAnhaengen: (id, daten) => ipcRenderer.invoke('video-anhaengen', id, daten),
    videoSchreibenAn: (id, daten, stelle) => ipcRenderer.invoke('video-schreiben-an', id, daten, stelle),
    videoSchliessen: (id) => ipcRenderer.invoke('video-schliessen', id),
    beiBeendenUndSchliessen: (rueckruf) => ipcRenderer.on('aufnahme-beenden-und-schliessen', () => rueckruf()),
    fertigZumSchliessen: () => ipcRenderer.send('fertig-zum-schliessen'),
    // Galerie
    dateien: () => ipcRenderer.invoke('dateien'),
    dateiOeffnen: (name) => ipcRenderer.invoke('datei-oeffnen', name),
    dateiZeigen: (name) => ipcRenderer.invoke('datei-zeigen', name),
    dateiLoeschen: (name) => ipcRenderer.invoke('datei-loeschen', name),
    dateiKopieren: (name) => ipcRenderer.invoke('datei-kopieren', name),
    // Fenster
    thema: (thema) => ipcRenderer.send('thema', thema),
    vollbild: () => ipcRenderer.send('vollbild'),
    vollbildAus: () => ipcRenderer.send('vollbild-aus'),
    beenden: () => ipcRenderer.send('beenden'),
    aufmerksamkeit: () => ipcRenderer.send('aufmerksamkeit'),
});
