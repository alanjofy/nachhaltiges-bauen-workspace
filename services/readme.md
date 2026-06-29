# Lindner Leistungs-WebApp

## Bearbeiten
Alle Inhalte liegen in `src/`:
- `leistungen.json`  → Leistungen (Texte, Codes, Ergebnisse)
- `svg/<CODE>.svg`   → Icon pro Leistung
- `styles.css`       → Design/Farben
- `app.js`           → Logik (Warenkorb, PDF, Filter)
- `template.html`    → HTML-Gerüst

## Bauen
    python build.py

→ erzeugt `dist/index.html` (diese Datei wird ausgeliefert/geöffnet).

## Wichtig
- `dist/index.html` NICHT direkt bearbeiten – wird überschrieben!
- Immer in `src/` ändern, dann neu bauen.