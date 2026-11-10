# MyTankBox – Test-App 0.13.1.1

## Neu in 0.13.1

- „Alte Daten importieren“ ergänzt bei schon importierten Einträgen auch geänderte Felder wie die Kraftstoffart zuverlässig.

## Neu in 0.13 – TÜV und Inspektion auf einen Blick

- Zwei Kacheln oben in der Übersicht: TÜV / HU und Inspektion, jeweils mit Fälligkeit, Restzeit bzw. Rest-km, Fortschrittsbalken und Status mit Symbol und Text (in Ordnung · bald fällig · überfällig). Bald fällig: TÜV ab 60 Tagen, Inspektion ab 45 Tagen oder 2.000 km.
- Intervalle je Fahrzeug selbst festlegen („Intervalle … ändern“ unter den Kacheln): TÜV alle … Monate (Standard 24), Inspektion alle … Monate und/oder alle … km – es zählt, was zuerst erreicht ist.
- Die Fälligkeit wird aus dem letzten Eintrag plus Intervall berechnet. Ein beim Eintrag von Hand gesetzter abweichender Termin hat Vorrang.
- Antippen einer Kachel: Details, „Neuen TÜV / Neue Inspektion eintragen“, Intervall ändern. Ohne Eintrag führt die Kachel direkt zum Eintragen.
- Abgegebene Wagen zeigen keine Kacheln.

## Neu in 0.12 – Ausführliche Auswertung

- Zeitraum wählbar: „12 Monate“, jedes einzelne Jahr oder „Alle Jahre“. Mit „alle Fahrzeuge“ werden beide Wagen zusammen ausgewertet.
- Kennzahlen: Kosten gesamt, gefahrene km, Ø Verbrauch, Ø Literpreis, Liter und Anzahl Tankungen, Kosten je 100 km.
- Grafiken: Kosten je Monat (bei sehr langen Zeiträumen je Jahr) aufgeteilt in Kraftstoff, Wäsche und Service · Verbrauch je Tankung mit Durchschnittslinie und markierten Ausreißern · Preis pro Liter · getankte Liter je Monat. Antippen zeigt den genauen Wert.
- Kosten nach Art mit Prozentanteil, Jahresvergleich als Tabelle (Antippen eines Jahres wählt es aus), häufigste Tankstellen, Rekorde.
- Gefahrene km zählen nur in deiner Nutzungszeit (ab Übernahme, bis Abgabe).

## Neu in 0.11.1

- „Alte Daten importieren“ korrigiert schon importierte Einträge, wenn die Importdatei geänderte Werte enthält (z. B. AdBlue-Menge), statt sie doppelt anzulegen.

## Neu in 0.11 – Fahrzeuge und Altdaten

- Fahrzeuge: Jeder Eintrag gehört zu einem Wagen. Oben in Übersicht, Verlauf und Auswertung schaltest du per Knopf (z. B. „HER-HK 107 ▾“) um. Verbrauch, Kosten, Verlauf und Fälligkeiten gelten für den gewählten Wagen, neue Einträge landen dort. Fahrzeuge bearbeiten oder hinzufügen im selben Fenster.
- Abgegebene Wagen: keine Fälligkeiten mehr, Kosten und Auswertung beziehen sich auf das letzte Nutzungsjahr bzw. die 12 Monate vor der Abgabe.
- Daten → Einträge → „Alte Daten importieren“: fügt eine umgewandelte Importdatei hinzu (z. B. `tankbox-altdaten.json` aus der Excel-Tabelle). Vorhandene Einträge bleiben, Doppelte werden übersprungen, ein zweiter Import ändert nichts.
- Neue Eintragsarten: „Autowäsche“ (ohne Tankung) und „km-Meldung“ (z. B. monatliche Meldung KB-001).
- CSV-Export mit Spalte „Fahrzeug“, alle Wagen in einer Datei.

## Neu in 0.10 – Eigener Quittungs-Scanner

- „Quittung scannen“ öffnet direkt in der App ein Live-Kamerabild mit Rahmen (statt der Kamera-App): großer Auslöser, Taschenlampe (wenn das Handy es kann), Dauerfokus. Das Foto wird auf den Rahmen zugeschnitten und sofort ausgelesen.
- Beim ersten Mal fragt Android nach dem Kamerazugriff. Ohne Zugriff öffnet sich wie bisher die Kamera-App. „Aus Galerie“ bleibt.
- Zurück-Taste oder ✕ schließt den Scanner.

## Neu in 0.9.1

- Karte: Dein Standort ist jetzt ein größerer dunkler Punkt mit weißem Rand und pulsierendem Ring, immer über den Tankstellen, dazu ein heller Kreis für die Ortungsgenauigkeit. Neuer Knopf unten rechts holt die Karte zurück zu deinem Standort.

## Neu in 0.9 – Karte und Bilder je Marke

- „Tankstellen in der Nähe“ hat oben „Liste | Karte“. Die Karte zeigt alle Stationen der Shell-Liste als farbige Punkte (Shell gelb, Esso blau, Eni/Agip grün, Westfalen rot, Markant violett, andere grau) und deinen Standort. Punkt antippen öffnet Details mit Route. Kartenbibliothek Leaflet 1.9.4 (cdnjs), Kacheln von OpenStreetMap.
- Daten → Tankstellen → „Bilder je Marke“: pro Marke ein eigenes Bild hinterlegen. Es erscheint automatisch bei allen Tankstellen dieser Marke – in Suche, Verlauf und bei gemerkten Tankstellen (ein eigenes Bild einer gemerkten Tankstelle hat Vorrang). Die Bilder sind Teil der Sicherung.

## Neu in 0.8 – Shell-Liste importieren

- Daten → Tankstellen → „Shell-Liste importieren (CSV)“: die CSV aus der Shell-Card-Tankstellensuche auf shell.de einlesen (getestet mit 4.346 Stationen: Shell, Esso, Eni/Agip, Westfalen, Markant und weitere). Die Liste liegt nur auf dem Handy (ca. 330 KB). Für einen neuen Stand einfach erneut importieren.
- „Tankstellen in der Nähe“ zeigt mit Filter „nur mit Shell Card“ genau die Stationen aus der Shell-Liste – mit 24 h, AdBlue, Waschanlage und Telefon, soweit angegeben. Ohne Filter kommen ergänzend die übrigen Tankstellen aus OpenStreetMap dazu (falls tankstellen.json vorhanden), markiert mit „nicht in Shell-Liste“.
- Ohne importierte Liste gilt weiter die Akzeptanz nach Marke. Der GitHub-Ablauf „Tankstellen aktualisieren“ ist damit nur noch für die Ergänzung ohne Filter nötig.

## Neu in 0.7.1

- „Tankstellen in der Nähe“ ist jetzt ein Symbolknopf oben rechts neben dem Menü (Stecknadel mit Zapfsäule) und von jedem Tab aus erreichbar. Die große Schaltfläche auf der Übersicht entfällt.

## Neu in 0.7 – Tankstellenliste aus GitHub

- Die Overpass-Server lassen Anfragen direkt aus Web-Apps nicht zu („Failed to fetch“). Deshalb lädt jetzt der GitHub-Ablauf `.github/workflows/tankstellen.yml` am 1. jedes Monats alle Tankstellen Deutschlands aus OpenStreetMap und legt sie als `tankstellen.json` neben die App.
- „Tankstellen in der Nähe“ sucht in dieser Liste direkt auf dem Handy: schnell, auch offline, und der Standort wird nicht mehr gesendet. Angezeigt werden höchstens die 50 nächsten.
- **Einmalig einrichten:** `tankstellen.yml` auf GitHub unter `.github/workflows/` anlegen (Add file → Create new file, Inhalt hineinkopieren), dann Actions → „Tankstellen aktualisieren“ → „Run workflow“. Nach 2–3 Minuten ist die Liste da. Die Datei wird bei App-Updates nicht angetastet.

## Neu in 0.6.2

- Tankstellen in der Nähe: Der Hauptserver overpass-api.de sperrt seit April 2026 Anfragen direkt aus Browsern. Die App fragt jetzt zuerst den freien Server overpass.private.coffee, dann overpass.kumi.systems, zuletzt overpass-api.de.
- Standort: erst genau per GPS, bei Bedarf grob über Netz/WLAN (drinnen klappt GPS oft nicht). Klarer Hinweis, wenn der Standortzugriff gesperrt ist.
- Anzeige, in welchem Schritt die Suche ist, bei Fehlern die Rückmeldung jedes Servers und „Nochmal versuchen“.

## Neu in 0.6.1

- Tankstellen in der Nähe: Antippen einer Tankstelle öffnet eine Karte (OpenStreetMap) mit der Station, Adresse, Entfernung, Öffnungszeiten und Shell-Card-Status. Darunter „Route starten“ (Google Maps) und „In Karten-App öffnen“ (Auswahl der Karten-App auf dem Handy). „Zurück zur Liste“ ohne neue Suche.

## Neu in 0.6 – Tankstellen in der Nähe

- Neuer Knopf auf der Übersicht: „Tankstellen in der Nähe“. Sucht per Standort im Umkreis von 5, 10 oder 25 km, sortiert nach Entfernung, mit Adresse, Öffnungszeiten (falls bekannt) und „Route“-Link.
- Filter „nur mit Shell Card“ (Standard an): Shell, Esso, Agip/Eni, AVIA, OMV, Westfalen, star/ORLEN – laut Shell-Übersicht „Partnerakzeptanzen der Shell Card“, Stand August 2023. Die Liste ist unter Daten → Tankstellen änderbar.
- Gemerkte Tankstellen erscheinen mit deinem Namen und Abzeichen.
- Daten: OpenStreetMap über den Overpass-Server (kostenlos, ohne Zugang). Dafür wird der ungefähre Standort an den Server gesendet. Nicht jede Tankstelle ist in OpenStreetMap mit Marke eingetragen.

## Neu in 0.5.3

- Marke auch bei stark verlesenem Kopf erkannt („ESS Stat ton“ = Esso). „Stat“ wird nicht mehr als Star gewertet.
- Ist die Straße unlesbar, zeigt die App das unter „Nicht gefunden“ an. Trägst du sie einmal ein, erkennt die App die Tankstelle beim nächsten Mal über Postleitzahl und die verlesene Zeile und setzt Name und vollständige Adresse ein.

## Neu in 0.5.2

- Adresse der Tankstelle wird zuverlässiger gelesen: mehr Zeilen durchsucht, Straße auch ohne „Straße“ im Namen (z. B. „Am Kreuz 3“), Straße und PLZ in einer Zeile, „D-59192“, verlesene PLZ („59l92“), Hausnummern wie „4-6“, „Tel.“ hinter dem Ort wird abgeschnitten.
- Marken-Erkennung: „TotalEnergies“ wird erkannt, „Str.“ wird nicht mehr fälschlich als Star gewertet.
- Die gelesene Adresse steht in der „Erkannt“-Zeile, darunter der Link „Erkannten Text anzeigen“ zur Fehlersuche.

## Neu in 0.5.1

- Die Zahlen in den Kacheln der Übersicht passen sich der Kachelbreite an, der km-Stand ragt nicht mehr heraus.

Tankungen des Dienstwagens mit Quittungsfoto erfassen, Verbrauch und Kosten auswerten. Alle Daten bleiben auf dem Handy. Es gibt keinen Server. Einzige mögliche Verbindungen: die optionale automatische Sicherung in dein eigenes privates GitHub-Repo, das App-Update in das App-Repo und das einmalige Laden der Texterkennung (nur Programmdateien, keine Daten von dir).

## Neu in 0.5 – Abzeichen und Bilder für Tankstellen

- Jede Tankstelle bekommt ein rundes Abzeichen mit dem Anfangsbuchstaben in einer Farbe deiner Wahl (10 Farben). Zu sehen in der Liste, in der Detailansicht und unter Daten → Tankstellen.
- Optional ein eigenes Bild pro Tankstelle, z. B. ein Foto vom Schild: wird rund zugeschnitten und ersetzt das Abzeichen. Bilder sind Teil der GitHub-Sicherung und der Sicherungsdatei.
- Bearbeiten: in der Detailansicht einer Tankung auf die Tankstelle tippen, oder unter Daten → Tankstellen. Dort lassen sich auch Name und Adresse ändern (Tankungen mit dem alten Namen werden mit umbenannt) oder eine Tankstelle vergessen.
- Markenlogos sind bewusst nicht enthalten (geschützte Markenzeichen).

## Neu in 0.4.1 – Tankstelle anhand der Adresse

- Die Adresse der Tankstelle wird von der Quittung gelesen und am Eintrag gespeichert (neues Feld „Adresse der Tankstelle“, auch in Detail und CSV).
- Die Marke wird auch unscharf erkannt, wenn das Logo nicht lesbar ist: in den Kopfzeilen, bei „… Station“ und im Kleingedruckten („ESSO Deutschland GmbH“). Tankkarten wie Euroshell zählen nicht als Marke.
- Die App merkt sich Name und Adresse, die du speicherst. Beim nächsten Beleg derselben Tankstelle (gleiche PLZ, ähnliche Straße – kleine Lesefehler und falsch gelesene Hausnummern sind egal) werden beide automatisch eingetragen. Die gemerkten Tankstellen sind Teil der Sicherung.

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
| `stationen.js` | Shell-Liste (CSV) einlesen |
| `ds.js` | gemeinsamer Baustein aller Boxen (jetzt mit MyTankBox in „Meine Boxen“) |
| `sw.js` | Service Worker (offline nutzbar, Update-Hinweis) |
| `manifest.webmanifest` | Name, Farben, Icons |
| `.github/workflows/paket.yml` | übernimmt Update-Zips automatisch |
