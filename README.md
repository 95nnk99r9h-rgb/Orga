# Fundort – Ordnung im Keller

**Kisten nummerieren, Inhalt erfassen, alles sofort wiederfinden.**
Eine schlichte Web-App im Apple-Stil, die sich wie eine native iPhone-App installieren lässt – plus ein einfaches System, mit dem aus unbeschrifteten Kisten ein Keller wird, in dem man alles findet.

![Fundort auf dem iPhone](docs/preview.png)

---

## Die Idee

Im Keller stehen viele unbeschriftete Kisten mit Deko, Kleidung, Werkzeug & Co. Kisten mit Filzstift zu beschriften funktioniert nicht lange: Der Inhalt ändert sich, die Schrift passt nicht mehr, und gesucht wird trotzdem Kiste für Kiste.

Fundort macht es wie ein Versandlager („chaotische Lagerhaltung“):

| | Was | Warum |
|---|---|---|
| 🏷️ | **Jede Kiste bekommt eine feste Nummer** (001, 002 …) mit QR-Code | Die Nummer bleibt für immer – egal was drin ist oder wo die Kiste steht |
| 🗄️ | **Jeder Regalboden bekommt eine Adresse** (A1, A2 … B3 …) | Man weiß sofort, wo etwas steht |
| 📱 | **Die App merkt sich den Rest**: Foto, Stichworte, Platz | Gesucht wird am Handy, nicht im Regal |

„Wo ist die Lichterkette?“ → in der App „licht“ eintippen → **Kiste 002, Regal A, Boden 1**.

## Das System in drei Regeln

1. **Jeder Boden hat eine Adresse.** Regale bekommen Buchstaben (A, B, C … links neben der Tür beginnend, einmal rundherum), Böden werden **von oben nach unten** gezählt. „B3“ = Regal B, dritter Boden von oben.
2. **Jede Kiste hat eine Nummer.** Aufs Etikett kommen nur Nummer, Kategorie-Farbe und QR-Code – kein Inhalt. Deshalb muss nie neu beschriftet werden.
3. **Die App merkt sich den Rest.** Kiste rein oder raus? Kiste scannen, Boden scannen – fertig.

Die ausführliche Anleitung mit Checkliste für den Einräum-Tag, Material-Liste und Gewohnheiten steht im **[Keller-Handbuch](docs/SYSTEM.md)** (zum Ausdrucken und an die Kellertür hängen) und direkt in der App unter *Mehr → Das Fundort-System*.

## Was die App kann

- **Suchen** – Volltextsuche über Titel, Inhalt, Notizen, Kategorie, Nummer und Platz. Findet auch Wortteile („licht“ → „Lichterkette“, „Kürbis-Lichter“) und markiert die Treffer.
- **Regale** – Übersicht aller Regale und Böden mit farbigen Kisten-Chips; pro Boden eine eigene Seite („Was steht auf A3?“).
- **Kisten** – Nummer, Titel, Kategorie, Platz, Fotos, Inhaltsliste und Notizen. Gegenstände lassen sich direkt in der Liste ergänzen.
- **Scannen** – Kamera-Scanner in der App:
  - Kisten-Etikett scannen → Kiste wird angezeigt
  - danach Boden-Etikett scannen → Kiste ist dort eingelagert (mit „Widerrufen“)
  - unbekannte Nummer scannen → Kiste direkt erfassen
- **Etiketten** – druckfertige A4-Bögen mit QR-Codes:
  - Kisten-Etiketten für neue Nummern (vorab drucken) oder für erfasste Kisten
  - Boden-Etiketten (A1, A2 …) und große Regal-Schilder
  - Formate **105 × 74 mm (8 pro Bogen)** und **70 × 37 mm (24 pro Bogen)**, mit Schnittlinien für normales Papier, angebrochene Etikettenbögen weiterverwenden
- **Umlagern** – per Raster-Auswahl (Regal × Boden), per Scan oder vom Boden aus („Kiste hierher stellen“). Zusätzlich „Ohne festen Platz“ und „Nicht im Keller“ (entnommen).
- **Kategorien mit Farben** – z. B. Weihnachten = rot, Kleidung = blau. Die Farbe erscheint auf dem Etikett und in der App.
- **Backup** – Export/Import als Datei (inkl. Fotos), z. B. in iCloud Drive.
- **Offline-fähig**, Hell-/Dunkelmodus, keine Anmeldung, keine Cloud – alle Daten bleiben auf dem Gerät.

## Auf dem iPhone installieren

Die App ist eine Progressive Web App (PWA): Sie läuft im Browser, lässt sich aber wie eine echte App auf den Home-Bildschirm legen – ohne App Store und ohne Xcode.

**1. Online stellen (einmalig)** – z. B. kostenlos mit GitHub Pages:
1. Im Repository *Settings → Pages* öffnen.
2. Bei *Source* „Deploy from a branch“ wählen, den Branch mit der App und den Ordner `/ (root)` auswählen, speichern.
3. Nach ein bis zwei Minuten ist die App unter `https://<benutzername>.github.io/Orga/` erreichbar.

> GitHub Pages für private Repositories braucht einen kostenpflichtigen GitHub-Plan. Alternativ funktioniert jeder statische Hoster (z. B. Netlify, Cloudflare Pages) – einfach den Ordner hochladen. Wichtig ist **HTTPS**, sonst funktioniert die Kamera nicht.

**2. Auf dem iPhone:** Adresse in **Safari** öffnen → Teilen-Symbol → **„Zum Home-Bildschirm“**. Beim ersten Scannen den Kamerazugriff erlauben.

**3. Loslegen:** Beim ersten Start fragt die App, wie viele Regale und Böden dein Keller hat. Mit „Erst mit Beispieldaten ausprobieren“ kannst du alles gefahrlos testen und danach unter *Mehr → Alle Daten löschen* neu beginnen.

## Gut zu wissen

- **Daten liegen nur auf dem Gerät.** Es gibt (noch) keine Synchronisierung. Für mehrere Personen: auf einem Gerät pflegen und das Backup teilen, oder ein „Keller-Handy“ bestimmen. Regelmäßig *Mehr → Backup erstellen* – die App erinnert daran, wenn das letzte Backup älter als 30 Tage ist.
- **Mit der App scannen, nicht mit der Kamera-App.** Auf dem iPhone haben die installierte App und Safari getrennte Speicher. Scannt man ein Etikett mit der normalen Kamera, öffnet sich Safari ohne deine Daten. Die QR-Codes funktionieren trotzdem dauerhaft, auch wenn die App einmal umzieht – der Scanner liest nur Nummer bzw. Boden aus.
- **Drucken:** Im Druckdialog „Tatsächliche Größe“ / 100 % wählen und Seitenränder/Skalierung ausschalten. Am bequemsten druckt man vom Computer oder aus Safari.
- **Etiketten haltbar machen:** auf normales Papier drucken und mit breitem Klebeband oder Klebefolie überkleben, in selbstklebende Etikettentaschen stecken oder direkt auf Etikettenbögen drucken.

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
js/ui.js              HTML-Templates, Icons, Sheets, Dialoge, Toasts
js/components.js      Wiederverwendbare Bausteine (Badges, Zeilen, Platz-Raster …)
js/qr.js              QR-Codes erzeugen und Etiketten-Inhalte lesen
js/scan-worker.js     QR-Erkennung im Hintergrund-Thread
js/views/*.js         Seiten: Suchen, Regale, Kiste, Scannen, Etiketten, Mehr, System, Willkommen
vendor/               qrcode-generator (MIT), jsQR (Apache 2.0)
docs/                 Keller-Handbuch und Vorschaubild
```

Nach Änderungen an Dateien die Konstante `VERSION` in `sw.js` erhöhen, damit installierte Apps sicher die neue Version laden. `?nosw` an die URL anhängen schaltet den Service Worker beim Entwickeln ab.

## Ideen für später

- Synchronisierung zwischen mehreren Geräten (z. B. über einen kleinen Server oder als native App mit iCloud/CloudKit)
- Weitere Orte neben dem Keller: Dachboden, Garage, Gartenhaus
- „Ausgeliehen an …“ und Erinnerungen („Weihnachtskisten nach vorne holen“ im November)
- NFC-Sticker als Alternative zum QR-Code
- Native SwiftUI-Version mit gleichem Datenmodell
