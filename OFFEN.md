# Offen

Vorschläge heißen YZ-1, YZ-2 … und werden nie neu vergeben. Nächste freie Nummer: **YZ-14**.

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

## Umgesetzt

- 1.0.0 (07.10.2026): Live-Bild bis 4K/30, Auflösung wählbar, Zoom (Mausrad, Ziehen, 1:1), Spiegeln, Fadenkreuz, Raster (3–16, Farbe wählbar), Standbild, Vollbild; Foto (JPG/PNG, volle Auflösung), Video (MP4/H.264 oder WebM/VP9, 10–50 Mbit/s, stückweise auf die Platte, Platzanzeige, stoppt bei fast voller Platte), Intervallfotos; Regler aus der Kamera mit Auto-Schaltern, gemerkt je Kamera, „Standard“; Histogramm mit Anteil Schwarz/Weiß, Schärfewert der Bildmitte mit Bestwert; Galerie mit Vorschau, Öffnen, im Ordner zeigen, Kopieren, Papierkorb; Hell/Dunkel.
