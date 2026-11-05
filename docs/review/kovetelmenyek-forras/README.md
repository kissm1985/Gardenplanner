# Követelménylista – forrás

A `docs/review/Planterra-kovetelmenyek.xlsx` ebből készül.

- `data.py` – a követelmények (azonosító, kategória, prioritás, komplexitás, funkció, leírások, ábra típusa)
- `specs.py` – az ábrák tartalma, `render.py` – az ábrák HTML-sablonjai
- `gen.py` – HTML-ek előállítása, `shot.mjs` – PNG-k (Playwright), `make.py` – Excel (openpyxl, Pillow)

```
D=/tmp/req; mkdir -p $D/html $D/png && cp docs/review/kovetelmenyek-forras/* $D/
python3 $D/gen.py $D && node $D/shot.mjs $D
python3 $D/make.py $D/data.py docs/review/Planterra-kovetelmenyek.xlsx $D/png
```
