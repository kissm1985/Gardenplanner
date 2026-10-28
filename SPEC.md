# Kerttervező – mobilbarát ültetéstervező webalkalmazás

> Ezt a leírást add oda a Claude Code-nak (pl. mentsd `SPEC.md` néven az üres projektmappába, és kezdd így: „Olvasd el a SPEC.md-t, először csak tervet készíts, aztán haladjunk a 4. fejezet fázisai szerint.").

## 1. Cél

Egy önállóan használható, telefonon is kényelmes webalkalmazás, amelyben **én magam állítom össze a kert ültetési tervét**: megrajzolom a területet, növényeket húzok rá, és az app automatikusan adja a növénylistát, a rendelési mennyiséget, az évszakos nézetet és a figyelmeztetéseket.

Mintája a K-07 „Oldalkert és előkert" artifact. Annak a vizuális nyelvét, rajzolási logikáját és a növénylista-táblázatát viszem tovább, de a tervek itt **szerkeszthetők**, nem előre legyártottak.

Fő elv: ujjal, telefonon, a kertben állva is használható legyen.

## 2. Felhasználó és környezet

- Egy felhasználó (én), nincs bejelentkezés, nincs szerver. Minden adat a készüléken marad (IndexedDB/localStorage), JSON-ba exportálható/importálható.
- A felület **magyar nyelvű**. A növények neve kétnyelvű: magyar + latin.
- Mobile-first (360–430 px szélesség), de tableten és számítógépen is jól működik.
- PWA: telepíthető a kezdőképernyőre, offline is működik.
- Statikus hosting (Netlify / Vercel / GitHub Pages) elég.

## 3. Technikai javaslat

- Vite + React + TypeScript, állapotkezelés Zustand-dal (vagy hasonló egyszerű megoldás).
- A rajzfelület **SVG** (nem canvas), hogy a növények egyenként kijelölhetők, mozgathatók és élesen nyomtathatók legyenek.
- Tárolás: IndexedDB (idb-keyval), automatikus mentés minden változtatás után.
- PWA: vite-plugin-pwa.
- Betűk: Fraunces (címek) és JetBrains Mono (kódok, méretek, számok), csomagként beágyazva, ne CDN-ről.
- PDF-export: böngésző nyomtatás + dedikált `@media print` stílus (A4), külön függőleges és vízszintes elrendezéssel.
- Tesztek: a szabálymotorra és a darabszámolásra egységteszt (Vitest), a fő folyamatra egy Playwright smoke teszt mobil viewporton.

## 4. Funkciók

### 4.1 Projekt és területek
- Egy projekt több **területet** tartalmaz (pl. „Házoldali sáv", „Gyepsávos kert").
- Terület létrehozása: név, méret cm-ben (szélesség × hossz), égtáj, napsütés (pl. „délig", „13:00-ig"), megjegyzés.
- Terület alakja kezdetben téglalap; **második lépésben** szabad sokszög/ív (pontok húzásával).
- Kiinduló sablonok, amelyeket az első indításkor felkínál az app:
  - **Házoldali sáv**: 120 × 1200 cm, déli fekvés, 13:00-ig kap napot, magassági limit 50 cm.
  - **Gyepsávos kert**: 500 × 1200 cm, keleti fekvés, 12:00-ig kap napot, középen ívelt gyepsáv, két oldalán ágyás, legfeljebb 2 fa (150–200 cm).
- Kényszerek (korlátok) területenként: max. magasság, kell-e tüskementes, kell-e nem mérgező, csepegtetőöntözés van-e, ágyásfedés (agrotextil + mulcs).
- Opcionális háttérkép: feltölthetek egy fotót vagy tervrajzot a területről, és átlátszóan az SVG alá teheti (méretarány beállítása két pont megjelölésével).
- Rögzített elemek (nem növény): fa (pl. diófa a juglone-zónával), ablak, csap/vízvételi hely, akna, burkolat, kerítés. Ezek húzhatók, és a szabálymotor figyelembe veszi őket.

### 4.2 Növényadatbázis
- Előre betöltött kezdő lista (kb. 25–40 faj), a projektben már használt növényekkel: levendula (*Lavandula angustifolia*), zsálya (*Salvia nemorosa*), menyecskeszem (*Coreopsis*), csenkesz (*Festuca glauca*), pázsitszegfű (*Armeria maritima*), kövirózsa (*Sempervivum*), kakukkfű (*Thymus*), gyapjas tisztesfű (*Stachys byzantina*), bergénia, árnyékliliom (*Hosta*) stb. A pontos adatokat a K-04…K-08 artifactokból és az ottani növényszószedetből vedd át, ha elérhetők; ha nem, hozz létre ésszerű kezdőértékeket, és jelöld őket „ellenőrizendő"-nek.
- Növény mezői:
  - kód (2 betű, pl. LA), magyar név, latin név
  - max. magasság (cm), kifejlett szélesség / ajánlott tőtáv (cm)
  - napigény (nap / félárnyék / árnyék), vízigény (alacsony / közepes / magas)
  - mérgező-e (nem / ember / háziállat), tüskés-e
  - **juglone-tűrés** (tűri / érzékeny / nem dokumentált)
  - virágzási hónapok, virágszín, lombszín, télen is díszít-e (négy évszak megjelenéshez)
  - kiszerelés (P9, 1–2 l cserép stb.), becsült egységár (Ft), megjegyzés
  - szín és szimbólum a rajzhoz
- Saját növény hozzáadása/szerkesztése/törlése, kereső, szűrők (magasság, nap, tüske, juglone, szín).
- Import/export JSON-ban és CSV-ben.

### 4.3 Tervezés a rajzfelületen (a fő képernyő)
- Felülnézeti SVG, méretarányos, rácsháló és vonalzó cm-ben, nagyítás/mozgatás két ujjal (pinch/pan), dupla koppintás = illesztés a képernyőhöz.
- Növény elhelyezése: alul kihúzható **növénypaletta** (bottom sheet), koppintás a növényre, majd koppintás a rajzon. Húzással is működik.
- Hogyan helyezek el sok növényt gyorsan:
  - **Egyedi tő**: egy koppintás = egy növény.
  - **Folt (drift)**: szabad alakú terület rajzolása, az app a tőtáv szerint automatikusan kitölti ültetési hálóval (négyzetes vagy eltolt/háromszög rács), a darabszámot kiírja.
  - **Sor**: két pont közé egyenletesen elosztott tövek.
  - **Ív követése**: görbe mentén sor/szegély (az ívelt gyepsávhoz).
- Kijelölés, mozgatás, másolás, törlés, több elem lasszóval, visszavonás/újra (legalább 50 lépés).
- Rétegek ki/be: növények, rögzített elemek, tőtáv-körök, árnyék/juglone-zóna, háttérkép, méretvonalak.
- Mágnesezés rácsra és elemek széléhez, kapcsolható.
- Növény tulajdonságpanelje: faj cseréje, darabszám a foltban, jegyzet, „már megvettem / beültetve" státusz.
- Minden növény a rajzon a saját színével és kódjával jelenik meg, mérete a kifejlett szélesség arányában (választható: ültetéskori méret / kifejlett méret).

### 4.4 Évszaknézet
- Négy gomb: tavasz, nyár, ősz, tél. A növények színe a virágzási hónapok és lombszín alapján változik, a télen nem díszítők halványak.
- „Négy évszak egymás mellett" nézet a nyomtatáshoz és az összehasonlításhoz.
- Havi csúszka is lehet (január–december).

### 4.5 Szabálymotor és figyelmeztetések
Minden változtatás után azonnal fut, és a rajzon színes jelzést + listát ad:
- A növény magasabb a terület korlátjánál.
- Tüskés vagy mérgező növény olyan területen, ahol tiltott.
- Juglone-érzékeny növény a diófa zónájában (a dió körüli sugár állítható, alapérték 15 m, felhasználó által módosítható); „nem dokumentált" növénynél sárga jelzés és szöveges javaslat.
- Tőtáv-sértés: a növények kifejlett körei túl sokat fednek át.
- Növény a terület határán kívül.
- Egy faj túl sok az egyik zónában (pl. levendulánál korlát), ha beállítom.
- Vízigény-keveredés egy foltban (száraz és nedves igényű növények együtt).
- Napigény eltérés a terület napsütéséhez képest.
Minden figyelmeztetés koppintásra odaugrik a hibás elemhez, és elnémítható (tudatos kivétel).

### 4.6 Növénylista és beszerzés
- Automatikus összesítő táblázat: kód, magyar és latin név, ültetett darabszám, **rendelendő darabszám** (beállítható tartalék, alapérték 10%), kiszerelés, max. magasság, tőtáv, vízigény, juglone, egységár, részösszeg, összesen.
- Területenként és összesítve is.
- Gombok: **másolás szövegként**, **másolás CSV-ként** (Excel/Sheets), **letöltés CSV/XLSX**, megosztás a telefon megosztó menüjével (Web Share API).
- Ha a vágólapra másolás nem megy a készüléken, látható, kijelölhető szövegmező marad tartaléknak.
- Státuszok: kell / megrendelve / megvan / beültetve, szűrhető.

### 4.7 Ültetési menetrend és gondozás
- A felhasználó megad egy időablakot (pl. „október 20 – november 3"), az app napokra osztott ültetési checklistát generál (előkészítés, agrotextil, csepegtető, ültetés, mulcsozás), amelyet pipálni lehet.
- Havi gondozási naptár a területen lévő fajok alapján (metszés, öntözés, lombgyűjtés dió alatt, trágyázás tiltása a szárazságtűrőknél). A kezdőtartalom Győr éghajlatára készüljön (utolsó fagy április közepe, első fagy október vége).
- Mulcsajánlás fajok szerint: pl. levendula, kakukkfű, kövirózsa mellé világos apró kavics a kéreg helyett.

### 4.8 Változatok (verziók)
- Egy területnek több **változata** lehet („A terv", „B terv"), egy koppintással másolható, átnevezhető, és két változat egymás mellett összehasonlítható (darabszám, költség, figyelmeztetések, évszaknézet).
- Egy változat „választott"-ra jelölhető, ebből készül a végső lista és a nyomtatás.

### 4.9 Export
- **PDF/nyomtatás**: A4, területenként egy oldal felülnézettel + évszaknézetek + növénylista + figyelmeztetések, lábléc oldalszámmal.
- **PNG** és **SVG** export a rajzról.
- **JSON** teljes projekt-mentés és visszatöltés.
- Egyszerű „megosztható nézet": csak olvasható oldal URL-ből (a terv a hash-ben/kódolva, szerver nélkül), hogy a párom is megnézhesse telefonon.

## 5. Kinézet és élmény

- A K-07 vizuális nyelve: Fraunces + JetBrains Mono, visszafogott természetes színek (zöldek, földszínek, meleg krém háttér), tiszta kártyás elrendezés.
- Világos és sötét téma a rendszerbeállítás szerint.
- Telefonon: alul fix eszköztár (Kijelölés, Növény, Folt, Sor, Évszak, Lista), felül a terület neve és a figyelmeztetések száma. Minden érintési cél legalább 44 px.
- Első indításkor 3 lépéses bevezető: terület kiválasztása → növény elhelyezése → lista megtekintése.
- Üres állapotok és hibaüzenetek barátságos magyar szöveggel.
- Akadálymentesség: kontrasztos színek, a színvak-barát jelölés (szín + kód + forma), billentyűzetes használat asztali gépen.

## 6. Adatmodell (vázlat)

```ts
type Project  = { id, name, areas: Area[], plantDb: Plant[], settings }
type Area     = { id, name, widthCm, lengthCm, orientation, sunUntil, constraints, fixtures: Fixture[], variants: Variant[], chosenVariantId, background? }
type Variant  = { id, name, items: PlacedItem[], notes }
type PlacedItem =
  | { kind:'plant', id, plantId, x, y, status }
  | { kind:'drift', id, plantId, polygon:[x,y][], pattern:'grid'|'staggered', spacingCm, count }
  | { kind:'row',   id, plantId, path:[x,y][], spacingCm, count }
type Fixture  = { id, type:'walnut'|'window'|'tap'|'manhole'|'paving'|'fence'|'tree'|'other', x, y, w?, h?, radius? }
type Plant    = { code, nameHu, nameLat, maxHeightCm, spreadCm, spacingCm, sun, water, toxic, thorny, juglone, bloomMonths, bloomColor, foliageColor, winterInterest, pot, unitPriceHuf, color, notes }
```

Koordináták cm-ben, origó a terület bal felső sarka. Minden származtatott érték (darabszám, költség, figyelmeztetés) számított, ne tárolt.

## 7. Fejlesztési fázisok (ebben a sorrendben haladjunk, mindegyik végén futó, kipróbálható állapottal)

1. **Alap**: projekt, területek, SVG vászon cm-ben, nagyítás/mozgatás, mentés IndexedDB-be, PWA keret.
2. **Növények**: adatbázis + paletta, egyedi tő elhelyezése, mozgatás/törlés/visszavonás.
3. **Gyors ültetés**: folt kitöltés, sor, ív mentén; automatikus darabszám.
4. **Szabálymotor** és figyelmeztetések, rögzített elemek (dió, ablak, csap).
5. **Növénylista** másolással, CSV/XLSX, rendelési tartalék, árak.
6. **Évszaknézet** és a négy évszak egymás mellett.
7. **Változatok**, összehasonlítás.
8. **Menetrend és gondozási naptár**.
9. **Export** (PDF, PNG, JSON), megosztható csak olvasható nézet, finomhangolás, tesztek.

## 8. Elfogadási kritériumok

- Telefonon (iPhone Safari és Android Chrome) végig használható: létre tudok hozni egy 120 × 1200 cm-es területet, 20 másodperc alatt kitöltök egy foltot, és látom a darabszámot.
- Egy 500 × 1200 cm-es terület 200+ növénnyel is folyékony marad (60 fps körüli húzás).
- Ha egy 50 cm-nél magasabb növényt rakok a 50 cm-es korlátú sávba, azonnal figyelmeztet.
- A növénylista másolása Excelbe beillesztve helyes oszlopokat ad.
- Internet nélkül is megnyílik és menthető a terv telepítés után.
- JSON-exportból visszatöltve a projekt pontosan ugyanaz.
- Az A4 PDF-ben a rajz, a lista és az évszaknézet nem csúszik szét, nincs levágott tartalom.

## 9. Amit most nem kell megépíteni

Felhasználói fiókok, felhőszinkron, 3D nézet, AI-képgenerálás, webshop-integráció. Ezek később jöhetnek, ezért az adatmodell legyen tiszta és exportálható.

## 10. Hogyan dolgozz velem

- Először 10–15 soros tervet adj (mappaszerkezet, főbb komponensek), és várd meg a jóváhagyásomat.
- Fázisonként dolgozz, minden fázis végén futtasd a teszteket és a buildet, és röviden írd le, mit tudok kipróbálni.
- Ha egy növényadatban bizonytalan vagy (különösen juglone-tűrés, háziállatra való toxicitás), ne találj ki biztos értéket: jelöld „ellenőrizendő"-nek.
- A felület minden szövege magyarul legyen, a kódkommentek angolul is lehetnek.
