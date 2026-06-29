#!/usr/bin/env python3
"""Wandelt die Logo-PNG in eine einbettbare JS-Datei."""
import base64
from pathlib import Path

png = Path("src/lindner_logo_white.png")
b64 = base64.b64encode(png.read_bytes()).decode("ascii")

js = f'window.LINDNER_LOGO = "data:image/png;base64,{b64}";\n'
out = Path("src") / "logo.js"
out.write_text(js, encoding="ascii")
print(f"✓ {out} ({out.stat().st_size/1024:.0f} KB)")