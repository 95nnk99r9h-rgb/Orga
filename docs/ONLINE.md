# Online-Abgleich einrichten (Firebase)

Damit du und deine Familie Fundort gemeinsam nutzen könnt, braucht die App einen Ort im Internet, an dem die Daten liegen. Dafür nutzt Fundort **Firebase** von Google – im kostenlosen Tarif, ohne Kreditkarte.

Einmalig dauert das etwa **10 Minuten**. Du brauchst nur ein Google-Konto.

---

## Schritt 1 – Projekt anlegen

1. Öffne **https://console.firebase.google.com** und melde dich mit deinem Google-Konto an.
2. Klicke auf **„Projekt erstellen“** (bzw. „Neues Firebase-Projekt erstellen“).
3. Name: z. B. **`fundort`** → **Weiter**.
4. Google Analytics und Gemini brauchst du nicht – ausschalten → **Projekt erstellen**.
5. Kurz warten, dann **Weiter**.

## Schritt 2 – Anonyme Anmeldung einschalten

Jedes Handy meldet sich unsichtbar mit einem eigenen, anonymen Zugang an – ohne Passwort.

1. Links im Menü unter **„Build“** (bzw. „Entwickeln“) auf **„Authentication“** → **„Jetzt starten“**.
2. Reiter **„Sign-in method“** (Anmeldemethode) → **„Anonym“** wählen.
3. Schalter auf **aktiviert** → **Speichern**.

## Schritt 3 – Datenbank anlegen

1. Links unter **„Build“** auf **„Firestore Database“** → **„Datenbank erstellen“**.
2. Falls gefragt: Edition **„Standard“**.
3. Standort: **`europe-west3 (Frankfurt)`** – dann liegen eure Daten in Deutschland.
4. **„Im Produktionsmodus starten“** → **Erstellen**.

## Schritt 4 – Sicherheitsregeln eintragen

Die Regeln legen fest, dass nur eure Geräte euren Haushalt sehen.

1. In „Firestore Database“ den Reiter **„Regeln“** öffnen.
2. Den kompletten Inhalt löschen und durch den Inhalt der Datei **[`firestore.rules`](../firestore.rules)** aus diesem Repository ersetzen.
3. **„Veröffentlichen“** klicken.

## Schritt 5 – Web-App registrieren und Zugangsdaten holen

1. Oben links auf das **Zahnrad** → **„Projekteinstellungen“**.
2. Ganz unten bei **„Meine Apps“** auf das Web-Symbol **`</>`** klicken.
3. Spitzname: **`Fundort`**. „Firebase Hosting“ **nicht** anhaken → **„App registrieren“**.
4. Es erscheint ein Codeblock, der so aussieht:

   ```js
   const firebaseConfig = {
     apiKey: "AIza…",
     authDomain: "fundort-xxxxx.firebaseapp.com",
     projectId: "fundort-xxxxx",
     storageBucket: "fundort-xxxxx.firebasestorage.app",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

   Diese Werte sind **keine Geheimnisse** – sie sagen der App nur, welches Projekt sie nutzen soll. Wer was darf, regeln die Sicherheitsregeln aus Schritt 4.

## Schritt 6 – Zugangsdaten in die App eintragen

**Variante A (am einfachsten):** Schick den Codeblock an Claude – die Werte werden eingetragen und hochgeladen.

**Variante B (selbst):**

1. Auf GitHub die Datei **[`js/firebase-config.js`](../js/firebase-config.js)** öffnen und auf den **Stift** (Bearbeiten) klicken.
2. Die Zeile `export default null;` ersetzen durch deine Werte, z. B.:

   ```js
   export default {
     apiKey: 'AIza…',
     authDomain: 'fundort-xxxxx.firebaseapp.com',
     projectId: 'fundort-xxxxx',
     appId: '1:123456789:web:abc123',
   };
   ```

3. **„Commit changes“** klicken. Nach ein bis zwei Minuten ist die neue Version online.

## Schritt 7 – Loslegen

**Auf deinem iPhone** (dort, wo die Daten schon drin sind):

1. Fundort ganz schließen (in der App-Übersicht nach oben wischen) und neu öffnen – ggf. zweimal, bis die neue Version da ist.
2. **Mehr → Gemeinsam nutzen → Haushalt anlegen**. Deine Kisten werden hochgeladen.
3. Es erscheinen ein **Code** (z. B. `KXR4-9TQM-2HWP`) und ein **QR-Code**.

**Auf dem iPhone deiner Frau:**

1. Fundort in Safari öffnen und **zum Home-Bildschirm hinzufügen** (Teilen → „Zum Home-Bildschirm“), dann vom Home-Bildschirm starten.
2. Auf dem Willkommens-Bildschirm **„Einem Haushalt beitreten“** tippen.
3. Den Code eingeben – oder unten auf **„Scannen“** tippen und den QR-Code auf deinem Handy scannen.

Fertig: Ab jetzt sieht jede von euch Änderungen der anderen nach wenigen Sekunden. Im Keller ohne Netz wird alles gemerkt und abgeglichen, sobald wieder Empfang da ist.

---

## Gut zu wissen

- **Kosten:** Der kostenlose Firebase-Tarif („Spark“) reicht für einen Haushalt bei Weitem (1 GB Speicher, 50 000 Lesezugriffe pro Tag). Es wird nichts berechnet, solange du keine Zahlungsmethode hinterlegst.
- **Fotos** werden für den Abgleich verkleinert (max. 1280 Pixel) in der Datenbank gespeichert.
- **Der Code ist der Schlüssel.** Wer ihn kennt, kann beitreten. Teile ihn nur in der Familie. Haushalte lassen sich nicht auflisten oder erraten (12 Zeichen).
- **Haushalt verlassen** (Mehr → Gemeinsam nutzen) stoppt den Abgleich auf einem Gerät; die Daten bleiben dort erhalten.
- **Ein Backup** (Mehr → Backup erstellen) ist trotzdem sinnvoll – etwa einmal im Monat.
- **GitHub-Warnung:** GitHub meldet eventuell, dass ein „Google API Key“ öffentlich im Repository steht. Bei Firebase-Web-Apps ist das normal und so vorgesehen. Wer mag, schränkt den Schlüssel zusätzlich ein: Google Cloud Console → „APIs & Dienste“ → „Anmeldedaten“ → den „Browser key“ öffnen → Websites: `https://95nnk99r9h-rgb.github.io/*`.

## Wenn etwas nicht klappt

| Meldung in der App | Lösung |
|---|---|
| „Kein Zugriff auf den Haushalt“ | Schritt 4 prüfen: Wurden die Regeln vollständig ersetzt und veröffentlicht? |
| „Keine Verbindung zum Server“ | Internetverbindung prüfen; Schritt 2 (anonyme Anmeldung) und Schritt 3 (Datenbank) erledigt? |
| „Diesen Haushalt gibt es nicht“ | Code vertippt? Er hat zwölf Zeichen; Groß-/Kleinschreibung und Bindestriche sind egal. |
| „Gemeinsam nutzen“ zeigt „Einrichten“ | Die neue Version mit den Zugangsdaten ist noch nicht geladen – App schließen und neu öffnen. |
