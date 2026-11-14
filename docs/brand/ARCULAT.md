# Planterra – arculat

<img src="planterra-mark.svg" width="96" alt="Planterra jel"> <img src="planterra-icon.svg" width="96" alt="Planterra alkalmazásikon">

**Név:** Planterra · **Alcím:** Kerttervező szoftver (*Garden design software*) · **Szlogen:** Formáld az élő tereket. (*Shape living spaces.*)

## Jel

Egy „P” betű, amelynek öble levél: a sötétzöld szárat a levéltől egy világos ív választja el. A forrás `src/ui/Logo.tsx` (a téma színeit követi), önálló fájlok:

- `planterra-mark.svg` – a jel világos háttérre;
- `planterra-icon.svg` – alkalmazásikon (erdőzöld alapon elefántcsont szár, olívzöld levél);
- `public/icon-*.png`, `public/apple-touch-icon.png`, `public/icon-maskable-512.png` – telepítési ikonok.

## Színek

| Név | Szín | Token | Használat |
|---|---|---|---|
| Forest | `#244B3C` | `--forest`, `--accent`, `--brand-stem` | logó, fő gombok, kiemelés |
| Olive | `#8A9462` | `--olive`, `--brand-leaf` | logó levele, másodlagos kiemelés |
| Sandstone | `#D5C5A7` | `--sandstone`, `--soil` | ágyásfelület, csempék |
| Ivory | `#F7F4EC` | `--ivory`, `--bg` | háttér |
| Dark Earth | `#343A32` | `--earth` | sötét felületek; a szöveg ennek mélyebb árnyalata (`#2B322B`) |

Sötét módban elefántcsont szár, olívzöld levél és olívzöld kiemelés a `#1D231E` alapon. Minden szín a `src/styles/tokens.css`-ben van.

## Betűk

- **Fraunces** – szövegek és címek.
- **JetBrains Mono** – gombok, címkék, feliratok (nagybetűs, ritkított) és a rajz műszaki feliratai.
- **Outfit** (500, szűk betűköz) – a „Planterra” logófelirat. A mintaképen szereplő Söhne fizetős betűtípus; az Outfit hozzá hasonló, szabad (SIL OFL) humanista-geometrikus sans.

Mindhárom a buildbe csomagolva, offline is működik.

## Forma

Lekerekített sarkok (gombok 12 px, mezők 8 px), vékony, meleg keretvonalak, tervrajzszerű felülnézet.
