# Követelménylista – forrás

A `docs/review/Planterra-kovetelmenyek.xlsx` ebből készül.

- `data.py` – a követelmények és az állapotuk (`STATUS`, 0.7.0) (azonosító, kategória, prioritás, komplexitás, funkció, leírások, ábra típusa)
- `specs.py` – az ábrák tartalma, `render.py` – az ábrák HTML-sablonjai
- `gen.py` – HTML-ek előállítása, `shot.mjs` – PNG-k (Playwright), `make.py` – Excel (openpyxl, Pillow)

```
D=/tmp/req; mkdir -p $D/html $D/png && cp docs/review/kovetelmenyek-forras/* $D/
python3 $D/gen.py $D && node $D/shot.mjs $D   # a tárolóból: node --input-type=module -e "$(sed "s#from 'playwright'#from '@playwright/test'#; s#process.argv\[2\]#'$D'#" $D/shot.mjs)"
python3 $D/make.py $D/data.py docs/review/Planterra-kovetelmenyek.xlsx $D/png
```
