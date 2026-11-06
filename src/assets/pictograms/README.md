# Planterra – növénypiktogramok v1.0

146 adatbázistétel × 2 nézet = 292 külön SVG. Átlátszó háttér, 128×128 viewBox, külső font és raszteres tartalom nélkül.

- svg/oldalnezet: növényválasztó és növény-adatlap
- svg/felulnezet: ültetési alaprajz
- png/: 256×256 átlátszó exportok
- katalogus.html: önálló, internet nélkül használható katalógus, kereséssel, háttér- és méretpróbával; egyedi SVG-letöltés
- manifest.json: kód, név, latin név, eredeti típus, méretek, paletta, fájlutak
- sprite.svg: SVG symbol gyűjtemény

## Beépítés

```html
<img src="svg/oldalnezet/LA.svg" alt="Levendula" width="48" height="48">
<svg width="64" height="64" aria-label="Levendula, felülnézet">
  <use href="sprite.svg#plant-LA-felulnezet" />
</svg>
```

A sprite külső hivatkozása HTTP-kiszolgálón használható; file:// alatt böngészőkorlátozások lehetnek. Az önálló SVG és a katalógus helyben is működik.

## Grafikai elvek

A készlet stilizált botanikai piktogramrendszer. Sziluett, levéltípus, lombszín, virágzat és ágrendszer alapján különböztet. A rokon növények szándékosan rokon grafikai nyelvet kapnak. Az ikon önmagában nem fajtaazonosító: a név/kód maradjon elérhető feliratban vagy tooltipben. A fehér virágok meleg törtfehérek, vékony kontúrral. Nincs beégetett felirat, háttérlap vagy árnyék.

24–32 px: sziluett és domináns szín; 48–128 px: részletek. Az SVG nagyításkor nem pixelesedik, de kicsinyítéskor a finom részletek természetesen összeolvadnak. 24 px alatt jelölőpont + kód ajánlott.

A piktogramok optikai méretezésűek. A kertterven a kifejlett szélesség alapján méretezd: átmérő_px = szélesség_cm / 100 × px_per_m. Az ikonrajz körül körülbelül 8–12% optikai tér van; pontos tőtávhoz külön ültetésikör-réteget használj, ne a lombrajz peremét.

Az ábrázolás jellemző díszállapotot jelöl, nem szezonális szimuláció. A nyári lombszín az alap; az őszi színváltást nem égetjük bele az egész éves alapikonba. A generikus sp. és több színt felsoroló tételek reprezentatív színváltozatot mutatnak.

Forrás: a mellékelt planterra-novenyadatbazis_md.md, 2026. október 31. A növényadatokat nem minősíti vagy javítja a grafikai készlet. A páfrány és nőszirom eredeti típusmezője változatlan, grafikájuk a saját növényi alakjukat követi.
