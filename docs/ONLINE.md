# Online-Abgleich einrichten (Firebase)

Damit das Team der Apotheke Fundort gemeinsam nutzen kann, braucht die App einen Ort im Internet, an dem die Daten liegen. Dafür nutzt Fundort **Firebase** von Google – im kostenlosen Tarif, ohne Kreditkarte.

Einmalig dauert das etwa **10 Minuten**. Du brauchst nur ein Google-Konto.

> **Wem gehört das Projekt?** Am besten legt die Apotheke das Firebase-Projekt mit einem eigenen Google-Konto der Apotheke an (nicht mit einem privaten Konto). Dann liegen die Daten bei der Apotheke, und sie entscheidet, wer Zugriff hat. Wer das Projekt für die Apotheke betreut, sollte das vertraglich regeln (Auftragsverarbeitung nach Art. 28 DSGVO). Patientendaten gehören grundsätzlich nicht in Fundort.

---

## Schritt 1 – Projekt anlegen

1. Öffne **https://console.firebase.google.com** und melde dich mit deinem Google-Konto an.
2. Klicke auf **„Projekt erstellen“** (bzw. „Neues Firebase-Projekt erstellen“).
3. Name: z. B. **`fundort-apotheke`** → **Weiter**.
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

Die Regeln legen fest, dass nur die Geräte des Teams dessen Daten sehen.

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

**Auf dem ersten Gerät** (dort, wo die Daten schon drin sind; der Demo-Modus muss aus sein):

1. Fundort ganz schließen (in der App-Übersicht nach oben wischen) und neu öffnen – ggf. zweimal, bis die neue Version da ist.
2. **Mehr → Gemeinsam nutzen → Team anlegen**. Die Kisten werden hochgeladen.
3. Es erscheinen ein **Code** (z. B. `KXR4-9TQM-2HWP`) und ein **QR-Code**.

**Auf jedem weiteren Gerät:**

1. Fundort in Safari öffnen und **zum Home-Bildschirm hinzufügen** (Teilen → „Zum Home-Bildschirm“), dann vom Home-Bildschirm starten.
2. Auf dem Willkommens-Bildschirm **„Einem Team beitreten“** tippen.
3. Den Code eingeben – oder unten auf **„Scannen“** tippen und den QR-Code auf dem ersten Gerät scannen.

Fertig: Ab jetzt sieht das ganze Team Änderungen nach wenigen Sekunden. Im Lager oder Keller ohne Netz wird alles gemerkt und abgeglichen, sobald wieder Empfang da ist.

---

## Gut zu wissen

- **Kosten:** Der kostenlose Firebase-Tarif („Spark“) reicht für eine Apotheke bei Weitem (1 GB Speicher, 50 000 Lesezugriffe pro Tag). Es wird nichts berechnet, solange du keine Zahlungsmethode hinterlegst.
- **Fotos** werden für den Abgleich verkleinert (max. 1280 Pixel) in der Datenbank gespeichert.
- **Der Code ist der Schlüssel.** Wer ihn kennt, kann beitreten. Teile ihn nur im Team. Teams lassen sich nicht auflisten oder erraten (12 Zeichen).
- **Team verlassen** (Mehr → Gemeinsam nutzen) stoppt den Abgleich auf einem Gerät; die Daten bleiben dort erhalten.
- **Ein Backup** (Mehr → Backup erstellen) ist trotzdem sinnvoll – etwa einmal im Monat.
- **GitHub-Warnung:** GitHub meldet eventuell, dass ein „Google API Key“ öffentlich im Repository steht. Bei Firebase-Web-Apps ist das normal und so vorgesehen. Wer mag, schränkt den Schlüssel zusätzlich ein: Google Cloud Console → „APIs & Dienste“ → „Anmeldedaten“ → den „Browser key“ öffnen → Websites: die Adresse, unter der die App läuft (z. B. `https://apotheke.example.de/*`).

## Wenn etwas nicht klappt

| Meldung in der App | Lösung |
|---|---|
| „Kein Zugriff auf das Team“ | Schritt 4 prüfen: Wurden die Regeln vollständig ersetzt und veröffentlicht? |
| „Keine Verbindung zum Server“ | Internetverbindung prüfen; Schritt 2 (anonyme Anmeldung) und Schritt 3 (Datenbank) erledigt? |
| „Dieses Team gibt es nicht“ | Code vertippt? Er hat zwölf Zeichen; Groß-/Kleinschreibung und Bindestriche sind egal. |
| „Gemeinsam nutzen“ zeigt „Aus (Demo)“ | Demo-Modus unter „Mehr → Ausprobieren“ ausschalten. |
| „Gemeinsam nutzen“ zeigt „Einrichten“ | Die neue Version mit den Zugangsdaten ist noch nicht geladen – App schließen und neu öffnen. |
