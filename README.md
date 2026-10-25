# Fundort – Ordnung im Keller

**Kisten und große Teile nummerieren, Inhalt erfassen, alles sofort wiederfinden.**
Eine schlichte Web-App im Apple-Stil, die sich wie eine native iPhone-App installieren lässt – plus ein einfaches System, mit dem aus unbeschrifteten Kisten ein Keller wird, in dem man alles findet.

![Fundort auf dem iPhone](docs/preview.png)

---

## Die Idee

Im Keller stehen viele unbeschriftete Kisten mit Deko, Kleidung, Werkzeug & Co., dazwischen große Teile ohne Kiste. Mit Filzstift zu beschriften hält nicht lange: Der Inhalt ändert sich, die Schrift passt nicht mehr, und gesucht wird trotzdem Kiste für Kiste.

Fundort macht es wie ein Versandlager („chaotische Lagerhaltung“):

| | Was | Warum |
|---|---|---|
| 🗄️ | **Jeder Regalboden hat eine Adresse** (A1, A2 … B3 …) – jedes Regal mit so vielen Böden, wie es hat | Man weiß sofort, wo etwas steht |
| 📍 | **Plätze außerhalb der Regale heißen S1, S2 …** – z. B. „Unter der Treppe“, „Wandhaken“, „Garage“ | Auch Großes und Abseitiges hat einen festen Ort |
| 🏷️ | **Alles bekommt eine feste Nummer** (001, 002 …) mit QR-Code – Kisten genauso wie Einzelstücke (Weihnachtsbaum, Koffer, Kinderwagen) | Die Nummer bleibt für immer, egal was drin ist oder wo es steht |
| 📱 | **Die App merkt sich den Rest**: Foto, Inhalt bzw. Titel, Platz | Gesucht wird am Handy, nicht im Regal |

„Wo ist die Lichterkette?“ → in der App „licht“ eintippen → **Kiste 002, Regal A, Boden 1**.

## Das System in vier Regeln

1. **Jeder Boden hat eine Adresse.** Regale bekommen Buchstaben (A, B, C … links neben der Tür beginnend, einmal rundherum), ihre Böden werden **von oben nach unten** gezählt – jedes Regal so weit, wie es Böden hat. „B3“ = Regal B, dritter Boden von oben.
2. **Was nicht ins Regal passt, bekommt einen Stellplatz.** S1, S2 … mit einem Namen wie „Unter der Treppe“. Das gilt auch für Orte außerhalb des Kellers (Garage, Dachboden).
3. **Alles bekommt eine Nummer.** Kisten und große Einzelstücke teilen sich eine fortlaufende Nummer. Aufs Etikett kommen nur Nummer, Kategorie-Farbe und QR-Code – kein Inhalt. Deshalb muss nie neu beschriftet werden.
4. **Die App merkt sich den Rest.** Etwas raus oder rein? Nummer scannen, Platz scannen – fertig.

Die ausführliche Anleitung mit Checkliste für den Einräum-Tag, Material-Liste und Gewohnheiten steht im **[Keller-Handbuch](docs/SYSTEM.md)** (zum Ausdrucken und an die Kellertür hängen) und direkt in der App unter *Mehr → Das Fundort-System*.

## Was die App kann

- **Lager (Startseite)** – alle Regale mit ihren Böden (unterschiedlich hohe Regale genau so) und alle Stellplätze als kompakte Zeilen mit farbigen Nummern-Chips; Antippen öffnet die Kiste bzw. den Boden. Gibt es mehrere Räume, steht jeder unter seinem Namen. Darüber Filter-Chips für Kisten, Einzelstücke, „Ohne Platz“, „Entnommen“ und Kategorien. Bei Entnommenem steht, seit wann es fehlt (z. B. „Entnommen seit 3 Wochen“).
- **Reihenfolge per Drag & Drop** – stehen mehrere Kisten auf einem Boden oder Stellplatz, eine Nummer gedrückt halten, bis ein kurzes haptisches Feedback kommt (iPhone ab iOS 18, Android), und an die gewünschte Stelle ziehen (mit der Maus: einfach ziehen). Die Reihenfolge gilt auch auf der Seite des Bodens; was neu dazukommt, stellt sich hinten an.
- **Suche oben auf der Startseite** – Volltextsuche über Inhalt, Titel, Notizen, Kategorie, Nummer und Platz (auch Stellplatz-Namen wie „Treppe“). Findet Wortteile („licht“ → „Lichterkette“, „Kürbis-Lichter“) und markiert die Treffer. Verzeiht Tippfehler: Gibt es keinen genauen Treffer, zeigt sie „Ähnliche Treffer“ („Lichterkete“ → „Lichterkette“). Wie unter iOS: Antippen zeigt die zuletzt geänderten Einträge, „Abbrechen“ führt zurück zum Lager.
- **Kisten und Einzelstücke** – bewusst schlank: eine Kiste hat eine Nummer und ihren Inhalt (in Listen steht der Inhalt als Zeile), ein Einzelstück eine Nummer und einen Titel. Der Inhalt ist eine Liste mit einem Feld pro Gegenstand; am Ende steht immer eine hervorgehobene leere Zeile – hineintippen, Enter springt weiter. Leeren oder ✕ entfernt einen Gegenstand, eingefügter mehrzeiliger Text wird zu einzelnen Gegenständen. Auf der Seite einer Kiste lässt sich der Inhalt direkt antippen und ändern – gespeichert wird beim Tippen. Gelöschte Kisten lassen sich mit „Widerrufen“ samt Fotos zurückholen. Dazu jeweils Kategorie, Platz, Fotos und optionale Notizen. Einzelstücke sind runde, Kisten eckige Nummern-Symbole.
- **Scannen** – Kamera-Scanner in der App:
  - Nummern-Etikett scannen → Kiste bzw. Einzelstück wird angezeigt
  - danach Boden- oder Stellplatz-Etikett scannen → dort eingelagert (mit „Widerrufen“)
  - mehrere Nummern hintereinander scannen, dann einmal den Boden → alle zusammen eingelagert
  - unbekannte Nummer scannen → direkt als Kiste oder Einzelstück erfassen
- **Etiketten** – druckfertige A4-Bögen mit QR-Codes:
  - Nummern-Etiketten vorab (passen für Kisten und Einzelstücke) oder für Erfasstes
  - Boden-Etiketten (A1, A2 …), große Regal-Schilder und Stellplatz-Etiketten (S1, S2 …)
  - Formate **105 × 74 mm (8 pro Bogen)** und **70 × 37 mm (24 pro Bogen, auch als Anhänger)**, mit Schnittlinien für normales Papier; angebrochene Etikettenbögen lassen sich weiterverwenden
  - **Inhaltslisten** (*Etiketten → Listen* oder auf der Seite eines Regals): eine A4-Seite pro Regal mit allen Böden und Inhalten, dazu die Stellplätze – zum Aufhängen an der Tür
- **Lagerorte** – Räume wie Keller, Dachboden und Garage anlegen, jeder mit eigenen Regalen und Stellplätzen; Regale hinzufügen und entfernen, Böden pro Regal einzeln einstellen, Regale und Stellplätze zwischen Räumen verschieben. Buchstaben und Nummern zählen über alle Räume weiter, damit jede Adresse eindeutig bleibt.
- **Umlagern** – per Raster (Regal × Boden, kürzere Regale mit Lücken) plus Stellplätze, per Scan oder vom Platz aus („Hierher stellen“). Zusätzlich „Ohne festen Platz“ und „Entnommen“.
- **Kategorien mit Farben** – z. B. Weihnachten = rot, Kleidung = blau. Die Farbe erscheint auf dem Etikett und in der App.
- **Gemeinsam nutzen** – optionaler Online-Abgleich über Firebase: Ein Handy legt einen „Haushalt“ an, weitere treten per Code oder QR-Code bei. Änderungen erscheinen in Sekunden auf allen Geräten, ohne Netz im Keller wird alles gemerkt und später abgeglichen. Einrichtung: **[docs/ONLINE.md](docs/ONLINE.md)**.
- **Backup** – Export/Import als Datei (inkl. Fotos), z. B. in iCloud Drive.
- **Darstellung** – unter *Mehr → Darstellung*: Automatisch (wie das iPhone), Hell oder Dunkel.
- **Offline-fähig**, Hell-/Dunkelmodus, keine Anmeldung. Ohne Online-Abgleich bleiben alle Daten auf dem Gerät.

## Auf dem iPhone installieren

Fundort ist eine Progressive Web App (PWA): Sie läuft im Browser, lässt sich aber wie eine echte App auf den Home-Bildschirm legen – ohne App Store und ohne Xcode. Für iOS ist alles vorbereitet: App-Symbol, Vollbild ohne Safari-Leisten, Startbildschirme für alle aktuellen iPhones, Offline-Betrieb und eine Installationsanleitung direkt in der App.

**1. Online stellen** – GitHub Pages ist für dieses Repository bereits aktiv. Unter *Settings → Pages* muss als Quelle „Deploy from a branch“ mit diesem Branch und dem Ordner `/ (root)` eingestellt sein. Dann ist die App erreichbar unter:

> **https://95nnk99r9h-rgb.github.io/Orga/**

(Nach jedem Push dauert es ein bis zwei Minuten, bis die neue Version online ist. Wichtig ist **HTTPS**, sonst funktioniert die Kamera nicht – GitHub Pages erfüllt das.)

**2. Auf dem iPhone:** Adresse in **Safari** öffnen. Die App zeigt oben einen Hinweis „Fundort als App“ – „Laden“ erklärt die Schritte:
1. Auf **Teilen** tippen (bei neueren iOS-Versionen zuerst auf „•••“).
2. **„Zum Home-Bildschirm“** wählen.
3. **„Hinzufügen“** tippen.

Die Anleitung findest du auch jederzeit unter *Mehr → Als App installieren*. Auf Android/Chrome erscheint stattdessen der eingebaute Installationsdialog.

**3. Loslegen:** Fundort vom Home-Bildschirm starten (nicht aus Safari – siehe „Gut zu wissen“). Beim ersten Start legst du fest, wie viele Regale es gibt, wie viele Böden jedes einzelne hat und welche Stellplätze es außerhalb der Regale gibt. Mit „Erst mit Beispieldaten ausprobieren“ kannst du alles gefahrlos testen und danach unter *Mehr → Alle Daten löschen* neu beginnen.

## Gut zu wissen

- **Erst installieren, dann erfassen.** Safari und die installierte App speichern ihre Daten auf dem iPhone getrennt. Wer schon in Safari erfasst hat, nimmt die Daten per Backup mit (*Mehr → Backup erstellen*, in der App *Backup wiederherstellen*).
- **Wo die Daten liegen:** auf jedem Gerät in der Browser-Datenbank (IndexedDB). Mit eingerichtetem Online-Abgleich zusätzlich im gemeinsamen Haushalt in Firebase (Standort wählbar, z. B. Frankfurt) – Anleitung in [docs/ONLINE.md](docs/ONLINE.md). Regelmäßig *Mehr → Backup erstellen* – die App erinnert daran, wenn das letzte Backup älter als 30 Tage ist (im gemeinsamen Haushalt nach 90 Tagen).
- **Mit der App scannen, nicht mit der Kamera-App.** Auf dem iPhone haben die installierte App und Safari getrennte Speicher. Scannt man ein Etikett mit der normalen Kamera, öffnet sich Safari ohne deine Daten. Die QR-Codes funktionieren trotzdem dauerhaft, auch wenn die App einmal umzieht – der Scanner liest nur Nummer, Boden bzw. Stellplatz aus.
- **Drucken:** Im Druckdialog „Tatsächliche Größe“ / 100 % wählen und Seitenränder/Skalierung ausschalten. Am bequemsten druckt man vom Computer oder aus Safari.
- **Etiketten haltbar machen:** auf normales Papier drucken und mit breitem Klebeband oder Klebefolie überkleben, in selbstklebende Etikettentaschen stecken oder direkt auf Etikettenbögen drucken. Für Einzelstücke eignen sich kleine Etiketten als Anhänger (lochen, mit Kabelbinder befestigen).
- **Ältere Daten** werden automatisch übernommen: Alles aus der ersten Version gilt als Kiste; ein früherer Kisten-Titel wird zur ersten Inhaltszeile, früheres Zubehör von Einzelstücken landet in den Notizen.

## Entwicklung

Kein Build-Schritt, keine Abhängigkeiten zur Laufzeit außer zwei mitgelieferten Bibliotheken.

```bash
python3 -m http.server 8000
# → http://localhost:8000  (Kamera funktioniert auf localhost auch ohne HTTPS)
```

```
index.html            App-Hülle
manifest.webmanifest  PWA-Manifest (Name, Icons, Standalone-Modus)
sw.js                 Service Worker (offline, Cache)
css/app.css           Gesamtes Design inkl. Dark Mode und Etiketten-Druck
js/main.js            Router, Tab-Bar, Navigation
js/store.js           Datenmodell, IndexedDB, Suche, Backup, Beispieldaten
js/format.js          Formatierung: Nummern, Plätze, Kisten/Einzelstücke
js/ui.js              HTML-Templates, Icons, Sheets, Dialoge, Toasts
js/components.js      Wiederverwendbare Bausteine (Badges, Zeilen, Platz-Raster …)
js/qr.js              QR-Codes erzeugen und Etiketten-Inhalte lesen
js/scan-worker.js     QR-Erkennung im Hintergrund-Thread
js/install.js         „Zum Home-Bildschirm“: Anleitung für iOS, Installationsdialog für Android
js/reorder.js         Nummern-Chips durch Halten und Ziehen umsortieren
js/haptics.js         kurzes haptisches Feedback (Android: Vibration, iOS 18+: System-Haptik)
js/sync.js            Online-Abgleich mit einem Haushalt in Firebase Firestore (lokal zuerst, offline-fest)
js/firebase-config.js Zugangsdaten des Firebase-Projekts (leer = Abgleich aus)
firestore.rules       Sicherheitsregeln: nur Mitglieder eines Haushalts lesen und schreiben
js/theme.js           Darstellung: automatisch, hell oder dunkel
js/views/*.js         Seiten: Lager (Start), Regal/Boden/Stellplatz, Kiste, Scannen, Etiketten, Mehr, System, Willkommen;
                      browse.js ist der Seitenrahmen mit Suche, Verlauf und Filtern
icons/                App-Symbole und iOS-Startbildschirme (icons/splash)
vendor/               qrcode-generator (MIT), jsQR (Apache 2.0), Firebase JS SDK (Apache 2.0, gebündelt)
docs/                 Keller-Handbuch, Anleitung Online-Abgleich, Vorschaubild
```

**Datenmodell kurz:** Räume `{ id: 'R1', name }`, Regale `{ id: 'A', room, note, levels }`, Stellplätze `{ id: 'S1', room, name }`, Einträge `{ kind: 'box' | 'item', number, title, category, location, order, awaySince, items, notes, photos }` – Kisten nutzen `items`, Einzelstücke `title`; `order` ist die von Hand gesetzte Reihenfolge auf einem Platz, `awaySince` der Zeitpunkt der Entnahme. Daten ohne Räume landen automatisch im Raum „Keller“. Ein Platz ist `{ shelf, level }`, `{ zone }`, `{ away: true }` oder `null` (ohne festen Platz).

Nach Änderungen an Dateien die Konstante `VERSION` in `sw.js` erhöhen, damit installierte Apps sicher die neue Version laden. `?nosw` an die URL anhängen schaltet den Service Worker beim Entwickeln ab.

## Ideen für später

- „Ausgeliehen an …“ und Erinnerungen („Weihnachtskisten nach vorne holen“ im November)
- Inhalt per Foto erkennen lassen (KI, mit eigenem API-Schlüssel)
- NFC-Sticker als Alternative zum QR-Code
- Native SwiftUI-Version mit gleichem Datenmodell
