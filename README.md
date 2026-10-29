# Kerttervező

Mobilbarát, offline is működő ültetéstervező (PWA). **Használati útmutató: [docs/UTMUTATO.md](docs/UTMUTATO.md).** A specifikáció: [SPEC.md](SPEC.md). Mintája a K-07 „Oldalkert és előkert” lap; a növényadatok a K-07, az árak a K-08 lapból jönnek.

```bash
npm install
npm run dev        # fejlesztői szerver
npm test           # egységtesztek (Vitest)
npm run test:e2e   # Playwright tesztek mobil nézetben (buildet is készít)
npm run build      # statikus build a dist/ mappába
```

**Telefonról (iPhone, Android):** a gép és a telefon legyen ugyanazon a wifin. `npm run dev` után a terminál kiír egy `Network: http://192.168.x.x:5173/` címet – ezt nyisd meg a telefon böngészőjében. Windowson az első indításkor a tűzfal rákérdez: engedélyezd a *magánhálózat* elérését. Telepíthető, offline is működő változathoz HTTPS kell: töltsd fel a `dist/` mappát pl. a Netlify Drop-ra (app.netlify.com/drop), és a kapott https-címet nyisd meg Safariban → Megosztás → *Főképernyőhöz adás*.

**Telepítés:** a `dist/` mappa bármilyen statikus tárhelyre feltölthető (Netlify, Vercel, GitHub Pages – relatív útvonalakkal, almappában is működik). Első megnyitás után telepíthető a kezdőképernyőre, és internet nélkül is fut.

## Mit tud

| | |
|---|---|
| Területek | Két sablon (Házoldali sáv, Gyepsávos kert), saját terület (téglalap vagy rajzolt alak), rajzolható gyepsáv (ide nem kerül növény, figyelmeztet; m²-ben kiírja) méretekkel, égtájjal, napsütéssel, korlátokkal; háttérkép két pontos méretaránnyal |
| Rajz | Elemek eszköztár (gyepsáv, burkolat, fal, kerítés, ablak, csap, akna, fa, diófa) közvetlenül a rajzon; SVG cm-ben, rácsháló, vonalzó, két ujjas nagyítás/mozgatás, dupla koppintás = illesztés, rétegek, mágnes 10 cm-es rácsra |
| Ültetés | Növény cseréje: egy faj összes töve másikra vagy több faj véletlen keverékére, arányokkal, tövenként vagy elemenként (a változatban, a terület minden változatában vagy a projektben), hasonló típusú javaslatokkal; kijelölt rész véletlenszerű kitöltése saját növénylistából (vegyesen vagy csoportokban); egyedi tő (koppintás vagy ráhúzás), folt (eltolt/négyzetes rács), egyenes sor, ív; automatikus darabszám; kijelölés, lasszó, másolás, törlés, 100 lépés visszavonás |
| Növények | 146 faj kezdőlista (köztük 45 fa, 26 sövénynek is való, 31 talajtakaró és terülő faj, 35 cserje), talajigénnyel; infókártya fotóval (Wikipédia/Commons, szerzővel és licenccel, a készüléken tárolva; vagy saját fotó), „ellenőrizendő” jelölésekkel; kereső, szűrők, saját növény; JSON/CSV import-export |
| Szabályok | Magasság, tüske, mérgező, juglone-zóna (állítható sugár), tőtáv, határon kívül, fajkorlát, fák száma, vízigény, napigény, csap/akna, ablak; ugrás és elnémítás |
| Lista | Ültetett és rendelendő darab (+tartalék), árak, státuszok; másolás szövegként és táblázatként, CSV, XLSX, megosztás |
| Évszakok | Négy évszak és havi csúszka, négy évszak egymás mellett |
| Változatok | Fába rendezve: a másolat az eredeti alá kerül, mappák, áthelyezés, összecsukás; választott változat, összehasonlítás |
| Ötletgenerátor | Véletlenszerű, a terület feltételeihez illő összeállítás külön változatba; választható növénytípusok (évelők, díszfüvek, talajtakarók, cserjék, sövény a hátsó szélen, kis fák szabad hellyel); színvilág, hátul magas – elöl alacsony, diófa-zóna; „Újra” gomb |
| Menetrend | Napokra bontott, pipálható ültetési lista; gondozási naptár Győrre; mulcsajánlás |
| Export | A4 nyomtatás/PDF (álló, fekvő), PNG, SVG jelmagyarázattal, teljes JSON-mentés, csak olvasható link |
| Látványterv | Bemásolható leírás a ChatGPT-nek (méretek, égtáj, tereptárgyak, foltok helye méterben, fajok kinézete évszak szerint, nézőpont) + rajz PNG-ben |

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
