# Fundort für Apotheken – Ordnung im Lager

**Kisten und Einzelstücke nummerieren, Inhalt und Verfall erfassen, alles sofort wiederfinden.**
Die Apotheken-Ausgabe von Fundort: eine schlichte Web-App im Apple-Stil, die sich wie eine native iPhone-App installieren lässt – plus ein einfaches System für Überbestand, Aktionsware, Hilfsmittel, Leihgeräte, Rezepturbedarf und alles, was sonst im Lager, im Keller oder im Kühlschrank steht.

> Dieser Branch (`claude/apotheke-lager`) ist aus der Keller-Version entstanden. Daten, Speicher und Online-Abgleich sind von ihr getrennt.

---

## Die Idee

In vielen Apotheken stehen neben Automat und Schubladen noch Kisten im Lager, im Keller oder im Büro: Überbestände, Saisonware, Deko fürs Schaufenster, Rezepturzubehör, Leihgeräte. Die Warenwirtschaft weiß, *wie viel* da ist – aber nicht, *in welcher Kiste auf welchem Boden*. Und wann die Ware in der dritten Kiste von unten abläuft.

Fundort macht es wie ein Versandlager („chaotische Lagerhaltung“):

| | Was | Warum |
|---|---|---|
| 🗄️ | **Jeder Regalboden hat eine Adresse** (A1, A2 … B3 …) | Man weiß sofort, wo etwas steht |
| 📍 | **Plätze außerhalb der Regale heißen S1, S2 …** – z. B. „Kühlschrank (2–8 °C)“, „Sperrlager“, „Keller“ | Auch Kühlware, Sperrware und Großes haben einen festen Ort |
| 🏷️ | **Alles bekommt eine feste Nummer** (001, 002 …) mit QR-Code – Kisten genauso wie Einzelstücke (Rollator, Aufsteller, Milchpumpe) | Die Nummer bleibt für immer, egal was drin ist oder wo es steht |
| 📅 | **Der früheste Verfall steht in der App** | „Verfall prüfen“ zeigt, was abgelaufen ist oder bald abläuft |
| 📱 | **Die App merkt sich den Rest**: Artikel, Foto, Platz | Gesucht wird am Handy, nicht im Regal |

„Wo ist der Ibuprofen-Nachschub?“ → in der App „ibu“ eintippen → **Kiste 001, Regal A, Boden 1 · Verfall 12/2027**.

**Was Fundort nicht ist:** keine Warenwirtschaft, kein BtM-Buch, kein Temperaturprotokoll. Und: **keine Patientendaten** in Fundort eintragen – Leihgeräte nur mit der Leihschein-Nummer aus der Warenwirtschaft.

Die ausführliche Anleitung mit Checkliste für den Einrichtungstag, Verfallskontrolle und Gewohnheiten steht im **[Lager-Handbuch](docs/SYSTEM.md)** und direkt in der App unter *Mehr → Das Fundort-System*.

## Was die App kann

- **Lager (Startseite)** – alle Regale mit ihren Böden und alle Stellplätze als kompakte Zeilen mit farbigen Nummern-Chips. Darüber Filter-Chips für Verfall, Kisten, Einzelstücke, „Ohne Platz“, „Entnommen“ und Kategorien.
- **Verfall** – pro Kiste der früheste Verfall als Monat (`03/2027`, auf dem Ziffernblock getippt). Abgelaufenes erscheint rot, Kurzläufer orange; oben im Lager „Verfall prüfen“ mit allen betroffenen Kisten, das Früheste zuerst. Die Vorwarnzeit (1, 3, 6 Monate oder 1 Jahr) gilt für das ganze Team.
- **Suche** – über Artikel, PZN, Titel, Notizen, Kategorie, Nummer, Platz („Kühlschrank“) und Verfall („03/2027“). Findet Wortteile und markiert die Treffer.
- **Kisten und Einzelstücke** – eine Kiste hat eine Nummer, ihre Artikel und den Verfall, ein Einzelstück eine Nummer und einen Titel. Dazu Kategorie, Platz, Fotos und Notizen (z. B. Charge, „kühl lagern“).
- **Scannen** – Nummer scannen, dann Boden oder Stellplatz scannen → eingelagert. Unbekannte Nummer → direkt erfassen.
- **Etiketten** – druckfertige A4-Bögen mit QR-Codes für Nummern, Böden, Regale und Stellplätze (105 × 74 mm oder 70 × 37 mm).
- **Reihenfolge per Drag & Drop** – Nummer gedrückt halten (mit haptischem Feedback) und auf dem Boden verschieben, z. B. Kurzläufer nach vorn.
- **Demo-Modus** – unter *Mehr → Ausprobieren* oder auf dem Willkommens-Bildschirm: eine Beispielapotheke mit 26 Einträgen, Verfallsdaten, Kühlschrank, Sperrlager und Leihgeräten. Die Demo hat einen eigenen Speicher; die echten Daten bleiben unberührt und sind nach dem Ausschalten wieder da. „Beispieldaten zurücksetzen“ stellt den Ausgangszustand wieder her – praktisch zum Vorführen.
- **Gemeinsam nutzen** – optionaler Online-Abgleich über Firebase: Ein Gerät legt ein **Team** an, weitere treten per Code oder QR-Code bei. Die Apotheke braucht dafür ein eigenes Firebase-Projekt (**[docs/ONLINE.md](docs/ONLINE.md)**); in diesem Branch ist noch keins eingetragen.
- **Backup**, **Hell/Dunkel**, **offline-fähig**, keine Anmeldung.

## Ausprobieren

GitHub Pages veröffentlicht nur den Standard-Branch des Repositorys (die Keller-Version). Diese Ausgabe lässt sich so testen:

- **Lokal:** `python3 -m http.server 8000` im Repository starten und `http://localhost:8000` öffnen.
- **Eigene Adresse:** den Branch als eigenes Repository mit GitHub Pages veröffentlichen oder – für den echten Einsatz besser – über Firebase Hosting bzw. einen Hoster mit eigener Domain (siehe Hinweise unten).

Auf dem iPhone: Adresse in **Safari** öffnen, *Teilen → Zum Home-Bildschirm*, dann vom Home-Bildschirm starten. Beim ersten Start Regale, Böden und Stellplätze festlegen – oder „Erst im Demo-Modus ausprobieren“.

## Gut zu wissen

- **Getrennt von der Keller-Version:** eigene Datenbank (`fundort-apotheke`), eigene Einstellungen und eigener Offline-Cache. Beide Apps können auf derselben Web-Adresse nebeneinander laufen.
- **Erst installieren, dann erfassen.** Safari und die installierte App speichern ihre Daten auf dem iPhone getrennt.
- **Mit der App scannen, nicht mit der Kamera-App** – sonst öffnet sich Safari ohne die Daten.
- **Drucken:** Im Druckdialog „Tatsächliche Größe“ / 100 % wählen und Seitenränder/Skalierung ausschalten.
- **Datenschutz:** Ohne Online-Abgleich bleiben alle Daten auf dem Gerät. Mit Online-Abgleich liegen sie im Firebase-Projekt der Apotheke (Standort z. B. Frankfurt). Patientendaten gehören nicht in die App.

## Entwicklung

Kein Build-Schritt, keine Abhängigkeiten zur Laufzeit außer drei mitgelieferten Bibliotheken.

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
js/store.js           Datenmodell, IndexedDB, Suche, Verfall, Backup, Demo-Modus mit Beispielapotheke
js/format.js          Formatierung: Nummern, Plätze, Kisten/Einzelstücke, Verfall
js/ui.js              HTML-Templates, Icons, Sheets, Dialoge, Toasts
js/components.js      Wiederverwendbare Bausteine (Badges, Zeilen, Platz-Raster …)
js/qr.js              QR-Codes erzeugen und Etiketten-Inhalte lesen
js/scan-worker.js     QR-Erkennung im Hintergrund-Thread
js/install.js         „Zum Home-Bildschirm“: Anleitung für iOS, Installationsdialog für Android
js/reorder.js         Nummern-Chips durch Halten und Ziehen umsortieren
js/haptics.js         kurzes haptisches Feedback (Android: Vibration, iOS 18+: System-Haptik)
js/sync.js            Online-Abgleich mit einem Team („household“) in Firebase Firestore (lokal zuerst, offline-fest)
js/firebase-config.js Zugangsdaten des Firebase-Projekts (leer = Abgleich aus)
firestore.rules       Sicherheitsregeln: nur Mitglieder eines Teams lesen und schreiben
js/theme.js           Darstellung: automatisch, hell oder dunkel
js/views/*.js         Seiten: Lager (Start), Regal/Boden/Stellplatz, Kiste, Scannen, Etiketten, Mehr, System, Willkommen;
                      browse.js ist der Seitenrahmen mit Suche, Verlauf und Filtern
icons/                App-Symbole und iOS-Startbildschirme (icons/splash)
vendor/               qrcode-generator (MIT), jsQR (Apache 2.0), Firebase JS SDK (Apache 2.0, gebündelt)
docs/                 Lager-Handbuch, Anleitung Online-Abgleich, Vorschaubild (Keller-Version)
```

**Datenmodell kurz:** Regale `{ id: 'A', note, levels }`, Stellplätze `{ id: 'S1', name }`, Einträge `{ kind: 'box' | 'item', number, title, category, location, order, items, expiry, notes, photos }` – Kisten nutzen `items`, Einzelstücke `title`; `expiry` ist der früheste Verfall als Monat (`'2027-03'`) oder `null`; `order` ist die von Hand gesetzte Reihenfolge auf einem Platz. Ein Platz ist `{ shelf, level }`, `{ zone }`, `{ away: true }` oder `null`. Die Vorwarnzeit `expiryWarn` (Monate) wird wie die zuletzt gedruckte Nummer mit dem Team geteilt.

Der Demo-Modus nutzt die Datenbank `fundort-apotheke-demo`; umgeschaltet wird über `localStorage` (`fundort-apotheke.demo`) mit anschließendem Neustart der App, damit nichts vom anderen Modus – etwa der Online-Abgleich – weiterläuft.

Nach Änderungen an Dateien die Konstante `VERSION` in `sw.js` erhöhen, damit installierte Apps sicher die neue Version laden. `?nosw` an die URL anhängen schaltet den Service Worker beim Entwickeln ab.

## Ideen für später

- PZN bzw. Data-Matrix-Code einer Packung scannen und die passende Kiste finden
- Mitglieder im Team verwalten und den Code erneuern; Rollen (z. B. nur lesen)
- Änderungsverlauf: wer hat wann was umgelagert
- Erinnerung an die monatliche Verfallskontrolle (Push-Mitteilung)
- Mehrere Standorte (Haupt- und Filialapotheken) in einem Team
- Etikettendrucker (z. B. Brother, Dymo) direkt ansteuern
