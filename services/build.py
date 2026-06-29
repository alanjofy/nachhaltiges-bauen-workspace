#!/usr/bin/env python3
"""
Build-Script für die Lindner Leistungs-WebApp.
Nur Python-Standardbibliothek.

Aufruf:   python build.py
Ergebnis: dist/index.html

Quelldateien (in src/):
    template.html      HTML-Gerüst mit Platzhaltern
    styles.css         gesamtes CSS
    app.js             gesamtes JavaScript (ohne data!)
    leistungen.json    die Leistungsdaten (ohne SVG)
    svg/<CODE>.svg     ein SVG pro Leistung, mit <!--GRADIENT-->
    font.js            eingebettete Nunito-Schrift (Base64) – für PDF
    logo.js            eingebettetes Lindner-Logo (Base64) – für PDF
"""

import json
from pathlib import Path

# --- Pfade -----------------------------------------------------------
ROOT = Path(__file__).parent
SRC = ROOT / "src"
SVG_DIR = SRC / "svg"
DIST = ROOT / "dist"

# --- Gradient-Logik (Variante b: zentral hier) -----------------------
# Farbverläufe pro Gruppe (erster Buchstabe des Codes),
# von hell (graugrün) nach dunkel (dunkelblau).
PALETTES = {
    "A": ("#657F89", "#356271"),   # hell      -> Hauptfarbe
    "B": ("#356271", "#244C5A"),   # Haupt     -> dunkler
    "C": ("#356271", "#044459"),   # Haupt     -> dunkelblau
    "D": ("#244C5A", "#044459"),   # dunkler   -> dunkelblau
    "E": ("#044459", "#022E3D"),   # dunkelblau-> tiefdunkel
}


def safe_id(code: str) -> str:
    """
    Wandelt einen Leistungs-Code in eine gültige HTML/CSS-ID um.
    Punkte sind in IDs/Selektoren problematisch:  C1.1 -> C1_1
    """
    return code.replace(".", "_")


def gradient_def(code: str) -> str:
    """Erzeugt das <linearGradient>-Element für einen Leistungs-Code."""
    c1, c2 = PALETTES.get(code[0], PALETTES["A"])
    sid = safe_id(code)
    return (
        f'<linearGradient id="g{sid}" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0%" stop-color="{c1}"/>'
        f'<stop offset="100%" stop-color="{c2}"/>'
        f"</linearGradient>"
    )


def load_svg(code: str) -> str:
    """
    Lädt die SVG-Datei und injiziert den passenden Gradient.
    Platzhalter in der .svg-Datei:  <!--GRADIENT-->
    """
    path = SVG_DIR / f"{code}.svg"
    if not path.exists():
        raise FileNotFoundError(f"SVG fehlt: {path}")
    svg = path.read_text(encoding="utf-8").strip()
    if "<!--GRADIENT-->" not in svg:
        print(f"  ⚠ Hinweis: {path.name} enthält keinen <!--GRADIENT-->-Platzhalter")
    return svg.replace("<!--GRADIENT-->", gradient_def(code))


def load_leistungen() -> list[dict]:
    """Lädt die Leistungen aus JSON und ergänzt die SVGs."""
    data = json.loads((SRC / "leistungen.json").read_text(encoding="utf-8"))
    seen = set()
    for item in data:
        code = item["code"]
        if code in seen:
            raise ValueError(f"Doppelter Code in leistungen.json: {code}")
        seen.add(code)
        item["svg"] = load_svg(code)
    return data


def read_optional(path: Path, label: str, encoding: str = "ascii") -> str:
    """Liest eine optionale Datei; gibt '' zurück + Hinweis, falls sie fehlt."""
    if path.exists():
        return path.read_text(encoding=encoding)
    print(f"  ⚠ Hinweis: {path.name} fehlt – {label}")
    return ""


def build():
    DIST.mkdir(exist_ok=True)

    template = (SRC / "template.html").read_text(encoding="utf-8")
    css = (SRC / "styles.css").read_text(encoding="utf-8")
    app_js = (SRC / "app.js").read_text(encoding="utf-8")
    leistungen = load_leistungen()

    # Eingebettete Schrift + Logo (Base64) – optional
    font_js = read_optional(SRC / "font.js", "PDF nutzt Standard-Helvetica")
    logo_js = read_optional(SRC / "logo.js", "PDF nutzt Text-Fallback fürs Logo")

    # Daten als JSON-Literal ins JS einsetzen.
    # ensure_ascii=False -> Umlaute/CO₂ bleiben lesbar.
    data_json = json.dumps(leistungen, ensure_ascii=False, indent=2)

    # Script-sicher machen: "</script>" oder "</..." darf den
    # <script>-Block nicht vorzeitig schließen.
    data_json = data_json.replace("</", "<\\/")

    data_js = "const data = " + data_json + ";"

    # Platzhalter im Template ersetzen
    html = template
    html = html.replace("/* {{STYLES}} */", css)
    html = html.replace("/* {{FONT}} */", font_js)
    html = html.replace("/* {{LOGO}} */", logo_js)
    html = html.replace("/* {{DATA}} */", data_js)
    html = html.replace("/* {{APP}} */", app_js)

    out = DIST / "index.html"
    out.write_text(html, encoding="utf-8")

    # Kleine Statistik zur Kontrolle
    groups = sorted({d["group"] for d in leistungen})
    print(f"✓ {out}")
    print(f"  {len(html):,} Zeichen")
    print(f"  {len(leistungen)} Leistungen in {len(groups)} Gruppen:")
    for g in groups:
        n = sum(1 for d in leistungen if d["group"] == g)
        print(f"    · {g} ({n})")


if __name__ == "__main__":
    try:
        build()
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as e:
        raise SystemExit(f"✗ Build fehlgeschlagen: {e}")