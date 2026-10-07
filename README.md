# Yizhan 4K Kamera

Windows-Programm (Electron, portable .exe) für die USB-Kamera „Yizhan 4K 60MP“: Live-Bild, Fotos, Videos, Intervallfotos, Kamera-Regler, Galerie.

## Aufbau

```
Yizhan-4K-Kamera-V<version>.exe   fertiges Programm (nicht im Git)
LIESMICH.txt                      Kurzanleitung
OFFEN.md                          Vorschläge (YZ-1, YZ-2 …) und offene Punkte
programm/
  main.js        Fenster, Dateien (Fotos, Videos stückweise), Galerie über medien://, Selbsttest
  preload.js     Brücke window.kam
  app/index.html Oberfläche, app/stil.css, app/js/*.js (je Teil eine Datei)
  build/icon.png Programmsymbol
```

- Bild über `getUserMedia`, Regler über `applyConstraints` – nur die Regler, die die Kamera meldet.
- Fotos: Kamerabild in voller Auflösung auf eine Leinwand (gespiegelt wie die Ansicht), JPG 95 % oder PNG.
- Videos: `MediaRecorder` (MP4/H.264 oder WebM/VP9), jede Sekunde ein Stück an die Datei anhängen. Gespiegelt läuft die Aufnahme über `MediaStreamTrackProcessor` und eine Leinwand.
- Galerie: `medien://datei/<name>` (mit Range für Videos) und `medien://vorschau/<name>` (Vorschaubild von Windows), nur Dateien direkt im Speicherordner.

## Entwickeln

```bash
cd programm
npm install --ignore-scripts
node node_modules/electron/install.js
npx electron .
```

## Prüfen

```bash
npx electron . --pruefen=C:/temp/bild.png
```

Startet unsichtbar mit eigenem, leerem Benutzerordner, prüft Live-Bild, Regler, 1920 × 1080 ohne Scrollen, Foto (volle Auflösung), Video (gespiegelt, abspielbar), Intervallfotos, Standbild, Galerie, Löschen; Bilder je Ansicht und `bild-log.txt` daneben, Exit-Code 1 bei Fehlern. `--demo` nimmt Chromiums Testbild statt der echten Kamera. Geht auch mit der fertigen .exe.

## Bauen

```bash
cd programm
npm run bauen
```

Legt `Yizhan-4K-Kamera-V<version>.exe` nach oben. Vorher das Programm schließen. Bricht das Bauen beim Symbol mit Exit-Code 3221225477 ab, einfach noch einmal starten.
