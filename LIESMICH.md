# MyTankBox – Test-App 0.4.0.1

Tankungen des Dienstwagens mit Quittungsfoto erfassen, Verbrauch und Kosten auswerten. Alle Daten bleiben auf dem Handy. Es gibt keinen Server. Einzige mögliche Verbindungen: die optionale automatische Sicherung in dein eigenes privates GitHub-Repo, das App-Update in das App-Repo und das einmalige Laden der Texterkennung (nur Programmdateien, keine Daten von dir).

## Neu in 0.4 – Quittung automatisch auslesen

- Nach dem Foto liest die App die Quittung aus: Datum, Uhrzeit, Kilometerstand, Liter, Preis pro Liter, Kraftstoff-Betrag, Autowäsche, Kraftstoffart und Ort. Ausgefüllte Felder sind orange umrandet, darüber steht, was erkannt wurde und ob die Rechnung aufgeht (Liter × €/l = Betrag, Betrag + Wäsche = Gesamt).
- Gegenproben korrigieren typische Lesefehler, z. B. eine falsch gelesene Wäsche über Gesamt − Kraftstoff, oder fehlende Liter über Betrag ÷ €/l.
- Felder, die du schon selbst geändert hast, werden nicht überschrieben.
- Technik: Tesseract.js (kostenlos) läuft komplett auf dem Handy. Foto und Text verlassen das Gerät nicht. Beim ersten Auslesen lädt die App einmalig die Erkennungsdateien (ca. 10 MB) von cdn.jsdelivr.net, danach funktioniert es auch offline.
- Tipp für gute Ergebnisse: Quittung flach und gerade von oben fotografieren, möglichst ohne Schatten.

## Neu in 0.3 – Autowäsche und Service

- **Autowäsche** bei der Tankung: eigenes Feld, die App zeigt „Quittung gesamt“. Beim späteren automatischen Auslesen wird die Wäsche mit erkannt.
- **Service eintragen** (im Tanken-Fächer): AdBlue (Liter, Kosten), Reifenwechsel (Winter/Sommer/Ganzjahr/neu), Inspektion (nächste fällig am Datum oder bei km), TÜV/HU (nächster Termin, Vorschlag in 2 Jahren), Panne (was war los) und Sonstiges. Kosten sind optional, Foto vom Beleg ebenso.
- **Fahrzeug** auf der Übersicht: wann TÜV und Inspektion fällig sind (orange ab 45 bzw. 30 Tagen oder 1.500 km, rot wenn überschritten) und welche Reifen drauf sind, mit Hinweis zur Wechselzeit.
- Zweiter Tab heißt jetzt **Verlauf** und zeigt Tankungen und Service-Einträge gemeinsam, mit Monatssummen.
- **Auswertung**: Monatskosten inkl. Wäsche und Service, neue Karte „Kosten nach Art“.
- CSV-Export, Sicherungsdatei und GitHub-Sicherung enthalten auch Wäsche und Service.

## Neu in 0.2 – Gesten & Bewegung wie in der MyBelegBox

- Links/rechts wischen wechselt zwischen Übersicht, Tankungen und Auswertung.
- Oben auf der Seite nach unten ziehen: Werte neu berechnen, nach Updates suchen und eine fällige GitHub-Sicherung anstoßen.
- „Tanken“ öffnet einen Fächer: „Quittung fotografieren“ oder „Ohne Foto eintragen“. Beim Scrollen schrumpft der Knopf zum Kreis.
- Verbrauch, Kosten und km-Stand zählen in der Übersicht hoch.
- Leichtes Kippen mit Glanz über den Lagesensor (Übersicht, Verbrauch und Quittungsfoto in der Detailansicht), kurzes Vibrieren bei Aktionen.
- Detail- und Formularfenster lassen sich am Griff oder von oben nach unten wegziehen, die Zurück-Taste schließt Fächer und Fenster.
- Wer in Android „Animationen entfernen“ eingeschaltet hat, bekommt die ruhige Version ohne Effekte.

## Neu in 0.1

- **Tankung erfassen**: „Tanken“ öffnet direkt die Kamera für die Quittung. Datum, Uhrzeit, Kilometerstand, Liter, Betrag, Kraftstoff, Tankstelle, Volltank (Standard an) und Notiz. Der Preis pro Liter wird berechnet, wenn er leer bleibt.
- **Plausibilitätsprüfung**: Hinweise, wenn Liter × Preis nicht zum Betrag passt, der km-Stand nicht höher ist als beim letzten Tanken oder der Verbrauch unrealistisch wirkt. Speichern geht trotzdem (zweimal tippen).
- **Übersicht**: Durchschnittsverbrauch (Volltank-Methode), Kosten im laufenden Jahr, Kosten pro 100 km, aktueller km-Stand, letzte Tankungen.
- **Tankungen**: nach Monaten mit Summen, Detail mit Foto, Bearbeiten und Löschen.
- **Auswertung**: Kosten der letzten 12 Monate, Verbrauch je Tankung (auffällige orange), bezahlter Preis pro Liter.
- **Automatische Sicherung (GitHub)** und **App-Update aus der App** wie in den anderen Boxen.
- **Sicherungsdatei** (`.tankbox`, mit Fotos) und **CSV-Export** für Excel bzw. die Abrechnung.
- Darstellung hell/dunkel/automatisch, Punkt am Menü-Knopf für den Sicherungsstand, „Meine Boxen“ mit allen vier Boxen.

Noch nicht enthalten: automatisches Auslesen der Quittung (folgt als nächstes, kostenlos offline) und der Import der alten Excel-Daten.

## Erstmals online stellen

1. Auf GitHub eine Organisation **jazm-tankbox** anlegen (wie bei der Belegbox) und darin das Repo **jazm-tankbox.github.io** (öffentlich, damit GitHub Pages kostenlos läuft).
2. Den gesamten Inhalt dieser Zip **einmal entpackt** hochladen („Add file → Upload files“), inklusive des Ordners `.github` (enthält `workflows/paket.yml`). Tipp: Der Ordner `.github` ist am Handy oft versteckt – notfalls die Datei `paket.yml` über „Add file → Create new file“ mit dem Namen `.github/workflows/paket.yml` anlegen und den Inhalt hineinkopieren.
3. Settings → Pages → Branch `main`, Ordner `/` → Save. Nach 1–2 Minuten läuft die App unter https://jazm-tankbox.github.io
4. Settings → Actions → General → „Workflow permissions“ auf **Read and write** stellen.
5. Am Handy in Chrome öffnen → Menü → „App installieren“.

Test-App: denselben Inhalt in einen Unterordner `test/` legen. Sie hat einen eigenen Speicher und zeigt „TEST“.

## App-Update aus der App

Daten → **App-Update**: einmal das App-Repo (`jazm-tankbox/jazm-tankbox.github.io`) und einen eigenen Fine-grained-Zugangsschlüssel eintragen – nur für dieses Repo, Rechte **Contents: Read and write** und **Actions: Read**. Danach „Update-Zip hochladen“ und das Paket wählen. Der Ablauf `.github/workflows/paket.yml` entpackt die Zip, prüft, dass `APP_VERSION` (app.js) und Cache-Nummer (sw.js) übereinstimmen und die Version nicht älter ist, übernimmt die Dateien, löscht die Zip und veröffentlicht. Die App meldet, sobald die neue Version online ist.

## Automatische Sicherung (GitHub)

Daten → Datensicherung → „GitHub einrichten“: Konto, **privates** Repo (Vorschlag `jazm-tankbox/tankbox-daten`), optional ein Ordner und ein Fine-grained-Zugangsschlüssel (nur dieses Repo, „Contents: Read and write“). Nach jeder Änderung landen `daten.json` (alle Tankungen) und `fotos/<id>.jpg` im Repo. Jede Sicherung ist ein Commit. Öffentliche Repos werden abgelehnt, ein fremder Datenstand wird nie automatisch überschrieben, im Repo wird nichts gelöscht. Du kannst auch das Sicherungs-Repo der anderen Boxen nehmen und als Ordner `tankbox` eintragen.

Neues Handy: GitHub einrichten → liegt im Repo schon eine Sicherung und ist die App noch leer, holt sie alles automatisch zurück.

Anders als in der Belegbox gibt es hier kein Passwort und keine Verschlüsselung, damit das Erfassen an der Säule schnell geht. Die Zugangsschlüssel liegen nur auf dem Handy und kommen in keine Sicherung.

## Neue Version veröffentlichen

1. In `sw.js` die Nummer in `CACHE = 'tankbox-…'` erhöhen.
2. In `app.js` `APP_VERSION` auf dieselbe Nummer setzen.
3. Zip über „App-Update“ hochladen.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Seite und Gestaltung |
| `app.js` | gesamte App-Logik |
| `ocr.js` | Quittung auslesen (Bildaufbereitung, Werte erkennen) |
| `ds.js` | gemeinsamer Baustein aller Boxen (jetzt mit MyTankBox in „Meine Boxen“) |
| `sw.js` | Service Worker (offline nutzbar, Update-Hinweis) |
| `manifest.webmanifest` | Name, Farben, Icons |
| `.github/workflows/paket.yml` | übernimmt Update-Zips automatisch |
