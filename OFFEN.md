# Offen

Vorschläge heißen YZ-1, YZ-2 … und werden nie neu vergeben. Nächste freie Nummer: **YZ-34**.

## Zu klären

- **Bildrate bei Automatik (07.10.2026):** Mit automatischer Belichtung belichtet die Kamera bei wenig Licht länger und liefert dann nur 7–9 Bilder/s (gemessen vor einem Bildschirm). Von Hand auf Stufe −3 bis 0 gestellt: 27–30 Bilder/s, Stufe +2: 25. Wer flüssige Videos braucht, mehr Licht oder Belichtung von Hand. Ob sich die Kamera zwingen lässt, die Bildrate zu halten („Auto Exposure Priority“), gehört zu YZ-1.
- **Am Gerät geprüft (07.10.2026, Deckel ab, Blende offen):** Alle Regler wirken: Helligkeit (0 → 100: mittlere Helligkeit 70 → 195), Kontrast, Sättigung (0 = grau), Schärfe, Belichtungskorrektur, Belichtung von Hand (Stufe −6 schwarz, +2 hell), Weißabgleich. Die Kamera startet mit festem Weißabgleich auf 2144, das färbt lila (zu wenig Grün); „Farbtemperatur“ ist keine Kelvin-Angabe – höhere Werte machen das Bild röter. Seit 1.1.1 startet das Programm deshalb mit Automatik für Weißabgleich und Belichtung, „Standard“ heißt ebenfalls Automatik.
- **Noch nicht ausprobiert:** Kamera während des Betriebs abziehen und wieder anstecken (eingebaut: laufende Aufnahme wird gesichert, das Bild kommt von selbst zurück) und Schließen während einer Videoaufnahme (eingebaut: Nachfrage, dann wird die Datei sauber abgeschlossen).
- Die Kamera hat neben der Bildschnittstelle eine zweite USB-Schnittstelle „RNDIS“ (Netzwerk über USB, MI_00), für die Windows keinen Treiber hat (Status: Fehler). Für das Programm nicht nötig.

## Vorschläge

- **YZ-1 Treiber-Regler:** 50-Hz-Flimmerschutz (wichtig unter LED- und Leuchtstofflicht), Verstärkung, Gamma, Gegenlicht. Chromium bietet diese UVC-Regler nicht an; über den Eigenschaftsdialog des Windows-Treibers (DirectShow) ließen sie sich trotzdem einstellen, per Knopf im Programm.
- **YZ-2 Messen:** Maßstab einmal kalibrieren (Lineal oder Objektmikrometer ins Bild, zwei Punkte, Länge eingeben; je Auflösung und Zoomstufe gemerkt), dann Strecken, Kreise/Durchmesser und Winkel im Live-Bild und in Fotos messen; Maße ins Foto einbrennen.
- **YZ-3 Profile:** Regler-Einstellungen unter Namen speichern und laden (z. B. „Platine“, „Fräser“, „Werkstück“).
- **YZ-4 Zeitraffer-Video:** Intervallfotos direkt zu einem Video zusammensetzen (Bildrate wählbar).
- **YZ-5 Überblenden:** Ein gespeichertes Foto halbdurchsichtig über das Live-Bild legen – zum Ausrichten von Werkstücken oder für Vorher/Nachher.
- **YZ-6 Fokus-Stapeln:** Serie mit verschiedenen Schärfeebenen zu einem durchgehend scharfen Bild verrechnen (für Makro- und Mikroskopaufnahmen mit wenig Schärfentiefe).
- **YZ-7 Fadenkreuz verschiebbar:** Fadenkreuz per Klick setzen und gemerkt lassen, z. B. als Antastmarke, wenn die Kamera an der Fräse sitzt (Versatz Kamera–Spindel).
- **YZ-8 Beschriftung:** Datum/Uhrzeit, freier Text und Maßstabsbalken wahlweise ins Foto einbrennen.
- **YZ-9 Ausschnitt-Foto:** Nur den gezoomten Ausschnitt als Foto speichern.
- **YZ-10 Fernansicht:** Live-Bild im WLAN aufs Handy (wie die Fernanzeige im OWON-Programm), mit Code.
- **YZ-11 Versionsprüfung:** Menü prüft auf eine neue Fassung wie beim OWON-Programm. Das Repo gibt es seit 07.10. (privat), solange es privat ist, meldet GitHub dafür aber 404.
- **YZ-12 Ton:** Videos mit Ton von einem wählbaren Mikrofon (die Kamera hat keins).
- **YZ-13 Bildvergleich vorher/nachher:** Zwei Fotos aus der Galerie nebeneinander oder mit Schieber vergleichen.
- **YZ-17 Lupe:** Kleines Fenster im Live-Bild zeigt die Stelle unter der Maus in 1:1 oder 2:1, während das ganze Bild eingepasst bleibt. Aufwand klein.
- **YZ-19 Mosaik:** Mehrere überlappende Fotos zu einem großen Bild zusammensetzen (große Platine oder Werkstück unter starker Vergrößerung). Aufwand groß.
- **YZ-20 CAD-Schablone:** DXF- oder SVG-Kontur maßstäblich ins Live-Bild legen, verschieben und drehen – Teil gegen die Zeichnung prüfen. Setzt YZ-2 (Maßstab) voraus. Aufwand mittel.
- **YZ-21 Kanten- und Mittenfinder:** Die App findet Kante, Ecke oder Bohrungsmitte nahe am Fadenkreuz und zeigt den Versatz in mm – optisches Antasten. Setzt YZ-2 voraus. Aufwand mittel bis groß.
- **YZ-22 LinuxCNC-Kopplung:** Maschinenposition ins Foto schreiben, gefundenen Versatz aus YZ-21 als Nullpunkt übergeben, für YZ-19 ein Raster abfahren und an jeder Stelle ein Foto machen. Verbindung übers Netz zur Maschine. Aufwand groß.
- **YZ-23 Projekte und Bericht:** Aufnahmen einem Projekt zuordnen (eigener Unterordner, Name im Dateinamen), Notizen je Foto, ausgewählte Fotos als PDF-Bericht (wie der Messbericht im OWON-Programm). Aufwand mittel.
- **YZ-24 Zeitplan:** Überwachung, Intervallfotos oder Rückblick zu festen Zeiten von selbst starten und beenden (z. B. nachts, wenn der Drucker allein läuft). Aufwand klein.
- **YZ-25 Nachricht aufs Handy:** Bei Bewegung oder Stillstand eine Nachricht mit Foto schicken, z. B. über ntfy oder Telegram. Braucht einen Dienst außerhalb des Programms. Aufwand mittel.
- **YZ-26 Referenzbild-Wächter:** Ein Sollbild festhalten; weicht das Live-Bild zu stark ab (Werkstück verrutscht, Teil fehlt, Spannmittel offen), Alarm. Anders als YZ-15 vergleicht er mit einem festen Bild statt mit dem vorigen. Aufwand mittel.
- **YZ-27 Pipette und Weißabgleich per Klick:** Farbe und Helligkeit an einer Stelle anzeigen; Klick auf eine graue Fläche stellt den Weißabgleich so, dass sie wirklich grau wird. Aufwand klein.
- **YZ-28 Rauscharmes Foto:** 8 bis 32 Bilder hintereinander aufnehmen und mitteln – deutlich weniger Rauschen bei wenig Licht, gut für stehende Motive unter dem Mikroskop. Aufwand klein.
- **YZ-29 HDR-Foto:** Belichtungsreihe (z. B. drei Stufen) zu einem Bild verrechnen, in dem helle und dunkle Stellen zugleich Zeichnung haben – für glänzende Metallteile und Lötstellen. Aufwand mittel.
- **YZ-30 Verzeichnung korrigieren:** Einmal ein Schachbrett aufnehmen, daraus Linsenverzeichnung und Schräglage berechnen und Bild und Messungen gerade rechnen. Macht YZ-2, YZ-20 und YZ-21 am Bildrand genauer. Aufwand groß.
- **YZ-31 Code-Leser:** QR-, DataMatrix- und Strichcodes im Bild erkennen und anzeigen bzw. kopieren (Teilenummern, Codes auf Platinen und Bauteilen). Aufwand mittel.
- **YZ-32 Anmerkungen im Foto:** Pfeile, Kreise, Rahmen und Text in ein gespeichertes Foto zeichnen, als neue Datei speichern – für Dokumentation und Rückfragen. Aufwand mittel.
- **YZ-33 Für Webseite und Forum:** Foto oder Videoausschnitt mit einem Klick verkleinern und passend ausgeben (Foto als WebP/JPG in fester Breite, kurzer Ausschnitt als WebP-Animation oder kleines MP4) – z. B. für Mod-Seiten auf cnc3d.tech. Aufwand mittel.

## Umgesetzt

- 1.1.1 (07.10.2026): Start und „Standard“ mit Automatik für Weißabgleich und Belichtung; beim Abschalten von Rückblick und gespiegelter Aufnahme werden alle Kamerabilder sauber freigegeben (vorher Warnung im Selbsttest).
- 1.1.0 (07.10.2026): YZ-14 Rückblick (30–300 s, Taste B), YZ-15 Überwachung (Bereich, Empfindlichkeit mit Anzeige, Foto/Video mit Vorlauf/Meldung, Ruhezeit, Stillstand-Alarm, Ton), YZ-16 Fokus-Peaking und Zebra (Tasten P/Z, Empfindlichkeit, Farbe, Schwelle), YZ-18 Abspieler (Bild für Bild, Zeitlupe, Einzelbild speichern, Schnitt speichern). Seitenleiste in Reitern Aufnahme/Bild/Überwachung, Histogramm bleibt unten. Mit der echten Kamera geprüft, soweit ein schwarzes Bild das zulässt (Bewegung und Peaking nur mit dem Testbild).
- 1.0.0 (07.10.2026): Live-Bild bis 4K/30, Auflösung wählbar, Zoom (Mausrad, Ziehen, 1:1), Spiegeln, Fadenkreuz, Raster (3–16, Farbe wählbar), Standbild, Vollbild; Foto (JPG/PNG, volle Auflösung), Video (MP4/H.264 oder WebM/VP9, 10–50 Mbit/s, stückweise auf die Platte, Platzanzeige, stoppt bei fast voller Platte), Intervallfotos; Regler aus der Kamera mit Auto-Schaltern, gemerkt je Kamera, „Standard“; Histogramm mit Anteil Schwarz/Weiß, Schärfewert der Bildmitte mit Bestwert; Galerie mit Vorschau, Öffnen, im Ordner zeigen, Kopieren, Papierkorb; Hell/Dunkel.
