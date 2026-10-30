# Gardenly – arculat

<img src="gardenly-mark.svg" width="96" alt="Gardenly jel"> <img src="gardenly-icon.svg" width="96" alt="Gardenly alkalmazásikon">

**Név:** Gardenly · **Szlogen:** Tervezz · Ültess · Élvezd (*Design · Plant · Enjoy*)
**Mottó:** Álmaid kertje egy tervnyire van. (*Your dream garden, one plan away.*) · Több mint egy kert. Szebb hétköznapok. (*More than a garden. A better everyday.*)

## Jel

Tetővonal kéménnyel, alatta két levél: a ház és a kert együtt. A forrás `src/ui/Logo.tsx` (a téma színeit követi), önálló fájlok:

- `gardenly-mark.svg` – a jel világos háttérre;
- `gardenly-icon.svg` – alkalmazásikon (sötétzöld alapon krém tető);
- `public/icon-*.png`, `public/apple-touch-icon.png`, `public/icon-maskable-512.png` – telepítési ikonok.

## Színek

| Név | Szín | Token | Használat |
|---|---|---|---|
| Erdő | `#173a28` | `--brand-roof`, `--fg` | logó, szöveg |
| Természet | `#31632e` | `--accent` | fő gombok, kiemelés |
| Levél | `#3a8f3c` | `--brand-leaf` | logó nagy levele |
| Növekedés | `#6c904a` | `--brand-leaf-2` | logó kis levele |
| Harmónia | `#adbca2` | `--sage` | csempék, háttérárnyalat |
| Tisztaság | `#f1e5d0` | `--cream` | világos felületek |
| Melegség | `#e1cba8` | `--sand` | csempék |
| Háttér | `#fbf8f2` | `--bg` | oldal háttere |

Sötét módban krém tető és világosabb zöldek (`--accent: #8cc47a`) a `#0f1c14` alapon. Minden szín a `src/styles/tokens.css`-ben van.

## Betűk

- **Fraunces** – szövegek és címek (a mottó dőlten).
- **JetBrains Mono** – gombok, címkék, feliratok (nagybetűs, ritkított), a szlogen és a rajz műszaki feliratai.
- **Outfit** (700, szűk betűköz) – csak a „Gardenly” logófelirat.

Mindhárom a buildbe csomagolva, offline is működik.

## Forma

Lekerekített sarkok (gombok 12 px, mezők 8 px), kártyák vékony meleg keretvonallal, ikonok vékony vonallal.
