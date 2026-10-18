# Verkäuferfilter für Wallapop

[English](README.md) · [Español](README.es.md) · [Français](README.fr.md) · Deutsch · [Italiano](README.it.md) · [Português](README.pt.md)

Lokale Open-Source-Erweiterung für **Chrome und Edge**. Filtert geladene Suchergebnisse nach der Anzahl der Verkäuferbewertungen und einem ausdrücklichen Nachweis der Identitätsprüfung. Manifest V3, JavaScript, MIT-Lizenz. Kein Backend, keine Telemetrie, Abonnements oder KI-Aufrufe.

**Aktueller Umfang:** ausschließlich `https://es.wallapop.com/`. Die Oberfläche ist spanisch. Die übersetzten README-Dateien erweitern weder die unterstützten Domains noch die Sprache der Oberfläche. Unabhängiges Projekt ohne Verbindung zu Wallapop.

## Installation

1. Im Repository **Code → Download ZIP** wählen und das Archiv in einen dauerhaften Ordner entpacken.
2. In der Adressleiste von **Google Chrome** `chrome://extensions` eingeben. In **Microsoft Edge** `edge://extensions` verwenden. Gemeint ist der Browser, nicht der Windows-Datei-Explorer.
3. **Entwicklermodus** aktivieren und **Entpackte Erweiterung laden** wählen.
4. Den Ordner **`extension`** auswählen, beispielsweise `wallapop-seller-filter-main/extension`. Direkt darin muss `manifest.json` liegen. Nicht den Dokumente-Ordner oder das Stammverzeichnis des Repositorys auswählen.
5. Eine Suche auf [Wallapop Spanien](https://es.wallapop.com/) öffnen. Bereits geöffnete Tabs einmal neu laden. Über den Ergebnissen erscheint **Reputación del vendedor**.

Zur Nutzung sind weder Node.js noch Entwicklungsassistenten erforderlich. Nach dem Build kann stattdessen der erzeugte Ordner `dist` geladen werden.

## Bedienung

- **Filtrado activo:** startet mit strengem Filter; Ausschalten stellt die Anzeigen ohne Neuladen wieder her.
- **Mínimo de reseñas:** mindestens 5 Bewertungen als Vorgabe. Es gilt **Anzahl ≥ Mindestwert**; genau 5 erfüllen einen Mindestwert von 5. Gezählt werden die allgemeinen Profilbewertungen, nicht Sterne oder ausschließlich Verkaufsbewertungen.
- **Solo identidad verificada:** verlangt einen ausdrücklichen Nachweis persönlicher Identitätsprüfung. Geschäftliche Prüfung und fehlendes Abzeichen bleiben unbekannt.
- **Mostrar sin comprobar:** zeigt zusätzlich ausstehende, unbekannte und fehlgeschlagene Einträge mit Kennzeichnung.
- **Comprobar 10 más:** bearbeitet bis zu zehn noch nicht versuchte URLs. Nach dem ersten Stapel geht es manuell weiter.
- **Reintentar errores:** wiederholt bis zu zehn fehlgeschlagene URLs, ohne den Cache zu leeren oder bekannte beziehungsweise unbekannte Ergebnisse erneut abzurufen.
- **Actualizar datos:** leert den gemeinsamen Cache und bearbeitet erneut bis zu zehn Anzeigen.
- **Reanudar consultas:** setzt nach einer Zugriffssperre oder Begrenzung manuell fort.

Die Zähler trennen Treffer, Ausschlüsse, laufende Anfragen, noch nicht versuchte Anzeigen, unbekannte Daten und Fehler. **Bearbeitet bedeutet nicht verifiziert.** Sind alle geladenen Anzeigen bearbeitet, wird die Fortsetzung deaktiviert, auch wenn Daten unbekannt bleiben.

Ausgeblendete Anzeigen behalten ihren Platz und ihre Reihenfolge, damit Auslöser zum Nachladen nicht verschoben werden. Es werden nur **geladene und bearbeitete Ergebnisse** gefiltert, nicht der gesamte Katalog. Keine bestätigten Treffer bei unvollständigen Daten bedeuten nicht, dass passende Verkäufer fehlen.

## Anfragen und Datenschutz

Eine Anfrage gleichzeitig über alle Tabs, mindestens drei Sekunden zwischen Starts, zehn verschiedene URLs je Stapel. Gelesen wird das HTML verlinkter Anzeigen; keine erfundenen API-Endpunkte oder heruntergeladener ausführbarer Code.

Der lokale Cache ist 24 Stunden gültig: Verkäufer-ID, Bewertungszahl, Identitätsnachweis, Prüfdatum, Quell-URL und Zuordnung von Anzeigen zu Verkäufern. Abgelaufene Einträge werden beim Zugriff bereinigt, nicht durch eine zeitgesteuerte Löschung. Einstellungen und Pausenstatus werden ebenfalls lokal gespeichert. Cookie-Werte und Zugangsdaten werden nicht gezielt ausgelesen oder gespeichert; Namen, Telefonnummern und Bewertungstexte werden nicht aufbewahrt. Normale Wallapop-Anfragen können die vom Browser verwalteten Sitzungscookies enthalten.

Berechtigungen: `storage` und `https://es.wallapop.com/*`. HTTP 429 pausiert und beachtet `Retry-After`; 401/403 und CAPTCHA stoppen Anfragen bis zu einer manuellen Aktion. Fehler werden nie als null Bewertungen gespeichert. Für zwei neue Anzeigen derselben Person können zwei Abrufe nötig sein, um die Zuordnung zu erkennen; bekannte Zuordnungen nutzen den Verkäufercache.

## Aktualisierung, Entwicklung und Grenzen

Den dauerhaften Ordner ersetzen, die Erweiterung auf der Erweiterungsseite neu laden und anschließend Wallapop neu laden. Einstellungen bleiben bei normalem Neuladen erhalten. Zur Deinstallation **Entfernen** wählen und offene Tabs neu laden.

Node.js-Versionen stehen in `package.json`. Der Kern benötigt keine zusätzlichen Pakete:

```sh
npm run check
npm test
npm run build
```

Ausgabe: `dist/` und `wallapop-seller-filters.zip`, mit Manifest und MIT-Lizenz im Stammverzeichnis. Optionale Browsertests:

```sh
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

Mit `BROWSER_EXECUTABLE` und `PLAYWRIGHT_MODULE` lassen sich vorhandene Installationen auswählen. Die Tests verwenden ein separates Profil, ausschließlich lokale Debug-Verbindungen und abgefangene Antworten; Wallapop wird nicht abgefragt. CI prüft Syntax, Kerntests und Build. Browsertests laufen separat.

Drei reale Anzeigen und Profile wurden untersucht; ein Nutzer zeigte den Filter in Chrome. Der vollständige Profilabgleich dort sowie ein Edge-Test stehen noch aus. Fixtures belegen keine Live-Integration. Siehe [Tests](docs/TESTING.md), [Recherche](docs/RESEARCH.md) und [Wartung](docs/MAINTENANCE.md).

Beiträge und Übersetzungen: [CONTRIBUTING.md](CONTRIBUTING.md). Keine Sitzungsdaten oder unbereinigten Aufnahmen veröffentlichen.

[MIT-Lizenz](LICENSE) · Copyright © 2026 wasonidas.
