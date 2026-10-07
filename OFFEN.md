# Offen

Vorschläge heißen YZ-1, YZ-2 … und werden nie neu vergeben. Nächste freie Nummer: **YZ-24**.

## Zu klären

- **Bild schwarz (07.10.2026):** Die Kamera liefert 28–30 Bilder/s in 4K, aber jedes Bild ist komplett schwarz (alle Werte 0), auch bei Helligkeit 100 und längster Belichtung. Die Übertragung funktioniert (Gegenprobe mit künstlichem Bild). Vermutung: Objektivdeckel, Kamera zeigt ins Dunkle oder HDMI-Ausgang hat Vorrang. Erst wenn ein Bild kommt, lässt sich prüfen, ob die Regler wirklich wirken.
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

## Umgesetzt

- 1.1.0 (07.10.2026): YZ-14 Rückblick (30–300 s, Taste B), YZ-15 Überwachung (Bereich, Empfindlichkeit mit Anzeige, Foto/Video mit Vorlauf/Meldung, Ruhezeit, Stillstand-Alarm, Ton), YZ-16 Fokus-Peaking und Zebra (Tasten P/Z, Empfindlichkeit, Farbe, Schwelle), YZ-18 Abspieler (Bild für Bild, Zeitlupe, Einzelbild speichern, Schnitt speichern). Seitenleiste in Reitern Aufnahme/Bild/Überwachung, Histogramm bleibt unten. Mit der echten Kamera geprüft, soweit ein schwarzes Bild das zulässt (Bewegung und Peaking nur mit dem Testbild).
- 1.0.0 (07.10.2026): Live-Bild bis 4K/30, Auflösung wählbar, Zoom (Mausrad, Ziehen, 1:1), Spiegeln, Fadenkreuz, Raster (3–16, Farbe wählbar), Standbild, Vollbild; Foto (JPG/PNG, volle Auflösung), Video (MP4/H.264 oder WebM/VP9, 10–50 Mbit/s, stückweise auf die Platte, Platzanzeige, stoppt bei fast voller Platte), Intervallfotos; Regler aus der Kamera mit Auto-Schaltern, gemerkt je Kamera, „Standard“; Histogramm mit Anteil Schwarz/Weiß, Schärfewert der Bildmitte mit Bestwert; Galerie mit Vorschau, Öffnen, im Ordner zeigen, Kopieren, Papierkorb; Hell/Dunkel.
