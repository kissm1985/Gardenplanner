<p align="center"><img src="docs/brand/planterra-mark.svg" width="88" alt=""></p>

# Planterra

**Kerttervező szoftver** – *Formáld az élő tereket.*

Készítette: **Kiss-Mihály István** · © 2026 Kiss-Mihály István. Minden jog fenntartva (lásd [LICENSE](LICENSE)).

Mobilbarát, offline is működő ültetéstervező (PWA), magyarul és angolul. **Használati útmutató: [docs/UTMUTATO.md](docs/UTMUTATO.md)** · English guide: [docs/GUIDE.md](docs/GUIDE.md). A specifikáció: [SPEC.md](SPEC.md). Arculat: [docs/brand/ARCULAT.md](docs/brand/ARCULAT.md). Zárt tesztelés (Cloudflare Workers + Access): [docs/TESZTELES.md](docs/TESZTELES.md). Jogi információk, adatvédelem: [docs/legal/JOGI.md](docs/legal/JOGI.md) · névkutatás: [docs/legal/NEVKUTATAS.md](docs/legal/NEVKUTATAS.md) · nyílt forrású licencek: `public/third-party-licenses.txt` (buildkor és a fejlesztői szerver indításakor generálva, nincs a tárolóban). Mintája a K-07 „Oldalkert és előkert” lap; a növényadatok a K-07, az árak a K-08 lapból jönnek.

```bash
npm install
npm run dev        # fejlesztői szerver
npm test           # egységtesztek (Vitest)
npm run test:e2e   # Playwright tesztek mobil nézetben (buildet is készít)
npm run build      # statikus build a dist/ mappába
npm run lint       # ESLint; npm run format: Prettier
npm run server     # Profi csomag: katalógus-szerver (lásd docs/SZERVER.md)
npm run verify:render  # 3D látványterv ellenőrzése minden mintaprojekten (out/)
npm run guide:shots    # az útmutató képernyőképei (docs/img, docs/img/en); előtte: npm run build && npx vite preview --port 4173
```

**Telefonról (iPhone, Android):** a gép és a telefon legyen ugyanazon a wifin. `npm run dev` után a terminál kiír egy `Network: http://192.168.x.x:5173/` címet – ezt nyisd meg a telefon böngészőjében. Windowson az első indításkor a tűzfal rákérdez: engedélyezd a *magánhálózat* elérését. Telepíthető, offline is működő változathoz HTTPS kell: töltsd fel a `dist/` mappát pl. a Netlify Drop-ra (app.netlify.com/drop), és a kapott https-címet nyisd meg Safariban → Megosztás → *Főképernyőhöz adás*.

**Telepítés:** a `dist/` mappa bármilyen statikus tárhelyre feltölthető (Netlify, Vercel, GitHub Pages – relatív útvonalakkal, almappában is működik). Első megnyitás után telepíthető a kezdőképernyőre, és internet nélkül is fut. A biztonsági fejléceket (CSP `frame-ancestors`-szal, HSTS, nosniff, Referrer-Policy, Permissions-Policy) a build `dist/_headers` fájlja (Netlify, Cloudflare Pages) és a `vercel.json` (Vercel) adja; GitHub Pages fejlécet nem tud küldeni, ott csak a beágyazott CSP él.

**CI:** `.github/workflows/ci.yml` minden push-ra és PR-re: függőség-audit, típusellenőrzés, ESLint, Prettier, fájlméret-figyelés, unit- és szervertesztek, build, indulási JavaScript-keret (150 KB gzip), Playwright (Pixel 7, a szerverrel együtt). A Dependabot hetente frissíti a függőségeket.

**Profi csomag, szerver:** a kertészetek katalógusát (fajok, cserépméretek, árak, készlet, változatok) egy Node.js-szerver kezeli SQLite-tal; több kertészet (bérlő) egy szerveren, e-mail-kódos belépés, kétlépcsős azonosítás, szerepek, biztonsági napló. Az admin felület: `/admin.html`. Telepítés, beállítások, API: [docs/SZERVER.md](docs/SZERVER.md).

## Mit tud

| | |
|---|---|
| Területek | Tizenegy beültetett példaterv a kezdőoldalon (mediterrán, kastélykert, vidéki udvar, alpesi, angol, japán, préri, árnyék, modern, kerek pillangókert, szabad alakú kanyargó előkerti ágyás), két sablon (Házoldali sáv, Gyepsávos kert), saját terület (téglalap vagy rajzolt alak), rajzolható gyepsáv (m²-ben kiírja; az ágyás területébe nem számít bele) méretekkel, égtájjal, napsütéssel, korlátokkal; háttérkép két pontos méretaránnyal |
| Rajz | Elemek eszköztár (gyepsáv, burkolat, fal, kerítés, ablak, csap, akna, fa, diófa) közvetlenül a rajzon; SVG cm-ben, rácsháló, vonalzó, két ujjas nagyítás/mozgatás, dupla koppintás = illesztés, rétegek, mágnes 10 cm-es rácsra |
| Ültetés | Növény cseréje: egy faj összes töve másikra vagy több faj véletlen keverékére, arányokkal, tövenként vagy elemenként (a változatban, a terület minden változatában vagy a projektben), hasonló típusú javaslatokkal; kijelölt rész véletlenszerű kitöltése saját növénylistából (vegyesen vagy csoportokban); egyedi tő (koppintás vagy ráhúzás), folt (eltolt/négyzetes rács), egyenes sor, ív; automatikus darabszám; kijelölés, lasszó, másolás, törlés, 100 lépés visszavonás |
| Növények | 171 faj kezdőlista (köztük 25 gyümölcs, zöldség, fűszer és rózsa, ehető-, őshonos- és méhbarát-jelöléssel, vetési, kiültetési és szüreti naptárral), mindegyikhez oldal- és felülnézeti piktogram (`src/assets/pictograms`), koncepcióterv-mód a rajzon; (köztük 45 fa, 26 sövénynek is való, 31 talajtakaró és terülő faj, 35 cserje), talajigénnyel; infókártya fotóval (Wikipédia/Commons, szerzővel és licenccel, a készüléken tárolva; vagy saját fotó), „ellenőrizendő” jelölésekkel; kereső, szűrők, saját növény; JSON/CSV import-export |
| Szabályok | Magasság, tüske, mérgező, juglone-zóna (állítható sugár), tőtáv, határon kívül, fajkorlát, fák száma, vízigény, napigény, csap/akna, ablak; ugrás és elnémítás |
| Lista | Ültetett és rendelendő darab (+tartalék), árak, státuszok; másolás szövegként és táblázatként, CSV, XLSX, megosztás |
| Évszakok | Négy évszak és havi csúszka, négy évszak egymás mellett |
| Változatok | Fába rendezve: a másolat az eredeti alá kerül, mappák, áthelyezés, összecsukás; választott változat, összehasonlítás |
| Ötletgenerátor | Véletlenszerű, a terület feltételeihez illő összeállítás külön változatba; választható növénytípusok (évelők, díszfüvek, talajtakarók, cserjék, sövény a hátsó szélen, kis fák szabad hellyel); színvilág, hátul magas – elöl alacsony, diófa-zóna; „Újra” gomb |
| Menetrend | Napokra bontott, pipálható ültetési lista; gondozási naptár Győrre; mulcsajánlás |
| Nyelv, megjelenés | Magyar és angol felület egy koppintással a felső sávban (EN / HU), alapból a böngésző nyelve; sötét és világos mód (☾ / ☀, vagy Nézet → Megjelenés: automatikus); angol növénynevek, figyelmeztetések, listák, exportok, útmutató |
| Súgó | ? gomb: a felhasználói útmutató az alkalmazáson belül, offline is; minden ablakból a saját fejezeténél |
| Export | A4 nyomtatás/PDF (álló, fekvő), PNG, SVG jelmagyarázattal, teljes JSON-mentés, csak olvasható link |
| Projektek, csomagok | Több projekt a készüléken (Folytatás, másolás, átnevezés, törlés); Alap, Haladó, Profi csomag egy alkalmazásban (zárolt funkció lakattal); egyszerű mód, nagyobb betűk; példatervek a saját méretre; saját fejlécű PDF (Profi); visszajelzés; névtelen statisztika csak hozzájárulással |
| Kertészeti katalógus | Profi: kapcsolódás egy kertészet katalógusához, változásalapú frissítés, offline másolat, a kertészet ára és készlete a listában, figyelmeztetés a már nem kínált fajokra; admin felület: fajok, árlista-import (CSV, XLSX) előnézettel, közzététel, felhasználók, napló |
| 3D látványterv | A rajzon lévő változat légi nézetben, a terv adataiból számolva (three.js, böngészőben): fajonként forma és szín, kerítés a körvonalon, méretvonalak, címblokk, szabad alakú területen is. Letöltés PNG (2400 px), PDF (A4 fekvő, növénylistával) és manifest.json (növényenként azonosító, faj, előírt és ténylegesen létrehozott pozíció). |
| Látványterv | Külön ablak (Változatok → 🖼 Látványterv): kamera és látómező a rajzon, stílus (fotó, akvarell, vázlat), napszak, időjárás; „Küldés a ChatGPT-nek” egy lépésben (telefonon megosztó menü, gépen vágólap + letöltés + chatgpt.com); a kész képek a változat mellett, az összehasonlításban is |

## 3D látványterv: ellenőrzés (spec v0.2)

`npm run verify:render` buildel, majd headless Chromiumban (WebGL) lerendereli **az összes mintaprojektet**, és projektenként az `out/<projekt>/` mappába írja: `render.png`, `render.pdf`, `idbuffer.png`, `manifest.json`, `test-report.csv` és `.md`, `logs/run-<időbélyeg>.log`; összesítő: `out/summary.md`.

- A darabszám-elvárás a terv növényszáma (N), semmi nincs beégetve.
- Minden növényre: a faj egyezik, a jelenetgráfból mért középpont legfeljebb 20 cm-re van az előírttól (`--tol=20`). Tesztazonosító: `PL-3D-<projekt>-<plant_id>`.
- Láthatóság ID-bufferrel: a növény látható, ha a kép legalább 0,005%-át adja (`--threshold=0.005`, kb. 200 px 2400×1700-on); különben „NEM IGAZOLHATÓ – takarás” vagy, ha takarás nélkül is kisebb, „NEM IGAZOLHATÓ – perspektíva (kis méret)”.
- A PDF-et pdf.js nyitja meg; benne kell lennie minden növényazonosítónak.
- Negatív futások (+30 cm, hiányzó növény, rossz faj): FAIL-t kell adniuk.
- A kilépési kód csak akkor 0, ha minden mintaprojekt PASS és minden negatív futás FAIL. Ha nincs WebGL vagy nem fut a render, az eredmény NEM IGAZOLT (nem nulla kilépési kód).

A növényazonosító egyedi tőnél az elem azonosítója, foltnál és sornál `<elem>#<n>` a kitöltési sorrendben. A ChatGPT-prompt (Látványterv ablak) ugyanezeket az azonosítókat sorolja fel a növénytáblában, és a jóváhagyott ellenőrző blokkal zárul.

**Árak**: alapból rejtve; a *Menü → Nézet és rétegek → Árak megjelenítése* kapcsolja be (a böngésző megjegyzi). Kikapcsolva a lista, az összesítés, az exportok, a nyomtatás és a prompt sem tartalmaz árat; az adat megmarad.

## Elfogadási feltételek (SPEC §8)

- [x] 120 × 1200 cm-es terület, folt kitöltése 20 mp alatt, darabszám látszik – `tests/e2e/drift.spec.ts`
- [x] 200+ növény folyékony – 221 tővel húzás közben 16,7 ms/képkocka (headless Chromium, asztali gép)
- [x] 50 cm feletti növény az 50 cm-es sávban azonnal figyelmeztet – `tests/e2e/rules.spec.ts`
- [x] Excelbe beillesztve helyes oszlopok – `tests/e2e/list.spec.ts`
- [x] Internet nélkül megnyílik és ment – `tests/e2e/offline.spec.ts`
- [x] JSON-ból visszatöltve pontosan ugyanaz – `tests/unit/io.test.ts`, `tests/e2e/export.spec.ts`
- [x] A4 PDF-ben nincs szétcsúszás, levágás – álló és fekvő PDF ellenőrizve
- [ ] Valódi iPhone Safari és Android Chrome – még nem próbáltuk ki valódi eszközön

## Még nincs meg

- Mágnesezés más elemek széléhez (csak rácsra van)
- Oldalszám a PDF-ben Safariban (a Chrome-alapú böngészők kiírják)
