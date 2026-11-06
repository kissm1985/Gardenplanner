from render import *

def lum(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def cr(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True); return (la + 0.05) / (lb + 0.05)
def sw(h): return f'<span class="sw" style="background:{h}"></span>{h}'

Y, N, P = '✓', '✗', '◐'
S = {}

# ---------------- Compliance ----------------
S['PL-CMP-01'] = ('A név csak tiszta kutatás után kerül domainre és arculatra', 'Döntési folyamatábra: védjegykutatás → bejelentés vagy névváltás', [
 flow([('Védjegy- és névkutatás', 'EUIPO TMview, SZTNH E-kutatás, cégnevek, domainek, áruházi appnevek (9. és 42. osztály)', 'start'),
       ('Van azonos vagy összetéveszthető korábbi jog a 9. vagy 42. osztályban?', 'szabadalmi ügyvivő véleménye alapján', 'dec'),
       ('branch', [('Nincs ütközés', [('Bejelentés', 'magyar (SZTNH) vagy uniós (EUIPO) védjegy, 9. és 42. osztály'), ('Domain és áruházi név lefoglalása', 'planterra.hu / .app, Google Play név', 'acc'), ('Arculat véglegesítése', 'logó, landing oldal, áruházi anyagok')]),
                   ('Kockázatos vagy ütközik', [('Névváltozatok listája', '3–5 jelölt, mindegyikre gyors előszűrés'), ('Új név kutatása', 'ugyanez a folyamat elölről', 'warn'), ('Átnevezés az appban', 'név, manifest, jogi szövegek, arculat', 'warn')])])])],
 'A kutatás eredménye a domain és az arculat előtt kell, mert névváltás után ezeket újra kellene csinálni.')

S['PL-CMP-02'] = ('Az impresszum három helyről, két kattintáson belül elérhető', 'UI-vázlat: az impresszum helye a Névjegyben, a kezdőoldalon és a landing oldal láblécében', [
 screens([{'t': 'App – Névjegy', 'els': [('top', 'Projekt', '✕'), ('h', 'Planterra'), ('txt', 'Verzió 0.7.0 · Készítette: Kiss-Mihály István'), ('btn', 'Impresszum', True), ('btn', 'Felhasználási feltételek'), ('btn', 'Adatvédelmi tájékoztató'), ('note', 'Új gomb: „Impresszum” a jogi gombok élén')]},
          {'t': 'App – Impresszum', 'els': [('top', 'Impresszum', '←'), ('card', 'Szolgáltató', '[név / cégnév], [székhely]'), ('card', 'Elérhetőség', 'istvan.kissm@gmail.com'), ('card', 'Nyilvántartás, adószám', '[nyilvántartási szám], [adószám]'), ('card', 'Tárhelyszolgáltató', '[név, cím, elérhetőség]'), ('note', 'Szögletes zárójelben: a vállalkozás adatai, induláskor kitöltendők')]},
          {'t': 'Landing oldal – lábléc', 'els': [('ph', 'oldal tartalma', 120), ('row', [('txt', 'Impresszum'), ('txt', 'ÁSZF'), ('txt', 'Adatvédelem'), ('txt', 'Kapcsolat')]), ('txt', '© 2026 Kiss-Mihály István'), ('note', 'Minden oldal láblécében, HU és EN')]}])])

S['PL-CMP-03'] = ('Fizetés csak elfogadott ÁSZF és a digitális tartalomra vonatkozó nyilatkozat után indul', 'Folyamatábra: csomagválasztás → ÁSZF elfogadás → fizetés → számla', [
 flow([('Csomag kiválasztása', 'Haladó: havi, éves vagy szezonbérlet · Profi: B2B ajánlat', 'start'),
       ('Számlázási adatok', 'név, cím; cégnél adószám (B2B ÁSZF érvényes)'),
       ('ÁSZF és adatvédelmi tájékoztató elfogadása', 'jelölőnégyzet, verziószám és időpont naplózva', 'acc'),
       ('Nyilatkozat: azonnali teljesítés kérése', 'tudomásul veszi, hogy a digitális tartalom teljesítésével az elállási jog megszűnik', 'acc'),
       ('Fizetés a szolgáltató oldalán', 'kártya, Apple / Google Pay; kártyaadat nem jut a Planterrához'),
       ('Sikeres?', '', 'dec'),
       ('branch', [('Igen', [('Jogosultság aktiválása', 'csomag feloldása az appban'), ('Számla e-mailben', 'NAV online számla bejelentéssel', 'acc')]),
                   ('Nem', [('Hibaüzenet, újrapróbálás', 'a felhasználó az ingyenes csomagban marad', 'warn')])])])])

S['PL-CMP-04'] = ('Az Alap és a Haladó csomag adatai a készüléken maradnak, a Profi és a fizetés hoz szerveroldali adatkezelést', 'Adatfolyam-ábra: milyen adat hova kerül, csomagonként', [
 table(['Adat', 'Hol tárolódik', 'Alap', 'Haladó', 'Profi', 'Jogalap', 'Megőrzés'], [
  ['Tervek, növénylista, fotók', 'Készülék (IndexedDB)', Y, Y, P, '— (nem kezeljük)', 'amíg a felhasználó törli'],
  ['Tervek a szerveren', 'Planterra backend (EU)', N, N, Y, 'szerződés teljesítése', 'előfizetés + 30 nap'],
  ['Felhőszinkron fájl', 'Felhasználó saját felhője', N, P, N, '— (a felhasználó tárhelye)', 'a felhasználó dönti el'],
  ['Fiók (e-mail, szerepkör)', 'Planterra backend', N, P, Y, 'szerződés teljesítése', 'fiók törléséig'],
  ['Fizetési adatok', 'Fizetési szolgáltató', N, Y, Y, 'szerződés; önálló adatkezelő', 'a szolgáltató szerint'],
  ['Számla', 'Számlázó szolgáltatás', N, Y, Y, 'jogi kötelezettség', '8 év'],
  ['Szervernaplók (IP)', 'Tárhelyszolgáltató', Y, Y, Y, 'jogos érdek', '[tárhely szerint]'],
  ['Analitika (események)', 'Saját üzemeltetésű analitika', P, P, P, 'hozzájárulás', '13 hónap'],
  ['Ügyfelek adatai', 'Planterra backend', N, N, Y, 'a kertészet adatkezelő, mi feldolgozó', 'szerződés szerint'],
  ['Ajánlatkérés tartalma', 'Backend + e-mail a kertészetnek', N, N, Y, 'hozzájárulás / szerződés előkészítése', '2 év']],
  note='✓ igen · ◐ opcionális vagy hozzájárulással · ✗ nem. A megőrzési idők javaslatok, jogászi jóváhagyásra.')])

S['PL-CMP-05'] = ('A Profi csomagban a kertészet az adatkezelő, a Planterra adatfeldolgozó', 'Szerepkör-ábra: adatkezelő, adatfeldolgozó, alfeldolgozók', [
 layers([('Érintett', [('A kertészet ügyfele', 'név, cím, telefon, kerterv, ajánlatkérés')]),
         ('Adatkezelő', [('Kertészet (Profi előfizető)', 'meghatározza a célt; adatvédelmi tájékoztatót ad az ügyfélnek', 'acc')], 'adatot ad át, DPA alapján'),
         ('Adatfeldolgozó', [('Planterra', 'csak a kertészet utasítására kezel; DPA (GDPR 28. cikk), nyilvántartás (30. cikk)', 'acc')], 'alfeldolgozókat vesz igénybe, előzetes tájékoztatással'),
         ('Alfeldolgozók', [('Tárhely és adatbázis', 'EU-s adatközpont'), ('E-mail-küldés', 'értesítések, ajánlatkérés'), ('Mentés', 'titkosított, más régió'), ('Hibakövetés', 'opt-in, személyes adat nélkül')])]),
 table(['Kötelezettség', 'Ki', 'Mikor'], [['Adatvédelmi incidens bejelentése a kertészetnek', 'Planterra', 'késedelem nélkül, a NAIH-határidő (72 óra) betartásához'], ['Adatok törlése vagy átadása', 'Planterra', 'szerződés megszűnésekor, 30 napon belül'], ['Alfeldolgozó változásának jelzése', 'Planterra', 'előzetesen, kifogásolási joggal']])])

# ---------------- Akadálymentesség ----------------
S['PL-ACC-01'] = ('Az akadálymentességi felmérés képernyőnként, ugyanazon a listán megy végig', 'Ellenőrzőlista és hibatérkép képernyőnként (WCAG 2.1 AA)', [
 table(['Ellenőrzés', 'Kezdőoldal', 'Ablakok (sheet)', 'Lista', 'Menetrend', 'Növényadatlap', 'Vászon'], [
  ['Fókuszsorrend logikus (2.4.3)', '?', '?', '?', '?', '?', 'PL-ACC-02'],
  ['Fókusz látható (2.4.7)', '?', '?', '?', '?', '?', 'PL-ACC-02'],
  ['Minden mezőnek címkéje van (1.3.1, 3.3.2)', '?', '?', '?', '?', '?', '—'],
  ['Kontraszt ≥ 4,5:1 (1.4.3)', '?', '?', '?', '?', '?', '?'],
  ['Nagyítás 200%-ig törés nélkül (1.4.4)', '?', '?', '?', '?', '?', '?'],
  ['Képernyőolvasó felolvassa a gombokat (4.1.2)', '?', '?', '?', '?', '?', 'PL-ACC-02'],
  ['Hibaüzenet szövegesen (3.3.1)', '?', '?', '—', '—', '?', '—'],
  ['Nem csak színnel közöl információt (1.4.1)', '?', '?', '?', '?', '?', '?']],
  title='Felmérési mátrix (kitöltendő: ✓ megfelel · ◐ részben · ✗ nem)', note='A „?” mezőket a felmérés tölti ki axe/Lighthouse futtatással és kézi teszttel (VoiceOver, TalkBack). A vászon billentyűzetes kezelése külön követelmény (PL-ACC-02).'),
 hflow([('Automatikus vizsgálat', 'axe, Lighthouse'), ('Kézi teszt', 'billentyűzet, képernyőolvasó'), ('Hibatérkép', 'a fenti mátrix'), ('Javítás és újramérés', ''), ('Akadálymentességi nyilatkozat', '', 'acc')], title='Menete')])

S['PL-ACC-02'] = ('A rajz minden eleme billentyűzettel is elérhető és szerkeszthető', 'UI-vázlat: fókuszállapotok és billentyűparancsok', [
 screens([{'t': 'Vászon – fókusz egy folton', 'w': 'mid', 'els': [('top', 'Előkert', 'A terv ▾'), ('ph', '[ Levendula folt ]  ← kijelölt elem vastag fókuszkerettel (3 px, kontrasztos)', 150), ('card', 'Képernyőolvasónak:', '„Levendula folt, 24 tő, 120 × 80 cm, x 340, y 120. Enter: tulajdonságok.”'), ('note', 'Tab: következő elem · Shift+Tab: előző')]},
          {'t': 'Tulajdonságok (Enter)', 'els': [('top', 'Levendula folt', '✕'), ('row', [('inp', 'X (cm)', '340'), ('inp', 'Y (cm)', '120')]), ('row', [('inp', 'Szélesség', '120'), ('inp', 'Hosszúság', '80')]), ('inp', 'Tőtáv (cm)', '40'), ('txt', 'Tőszám: 24 (számolt)'), ('btn', 'Kész', True)]}]),
 table(['Billentyű', 'Művelet'], [['Tab / Shift+Tab', 'Következő / előző elem a rajzon (fentről lefelé, balról jobbra)'], ['Nyilak', 'Kijelölt elem mozgatása 1 cm-rel'], ['Shift + nyilak', 'Mozgatás 10 cm-rel'], ['Enter', 'Tulajdonságok megnyitása (pozíció, méret, tőtáv beírása)'], ['Delete', 'Elem törlése (visszavonható)'], ['Esc', 'Kijelölés megszüntetése'], ['Ctrl+Z / Ctrl+Y', 'Visszavonás / újra'], ['L', 'Elemlista nézet (a teljes terv szövegesen, vászon nélkül)']], title='Billentyűparancsok')])

# ---------------- Biztonság ----------------
S['PL-SEC-01'] = ('Minden kérés átmegy a hitelesítésen, a bérlő- és a szerepkör-ellenőrzésen', 'Architektúra- és jogosultsági ábra: bérlők, szerepkörök, végpontok', [
 layers([('Kliensek', [('Planterra app (PWA)', 'Profi felhasználók és ügyfelek'), ('Admin felület', 'kertészet munkatársai')]),
         ('Peremvédelem', [('HTTPS, HSTS, WAF', ''), ('Rate limit és zárolás', 'pl. 5 hibás belépés → 15 perc')], 'HTTPS'),
         ('API', [('Hitelesítés', 'passkey / e-mail kód, adminnak kötelező 2FA', 'acc'), ('Bérlő-ellenőrzés', 'tenant_id a tokenből, minden lekérdezésben', 'acc'), ('Szerepkör-ellenőrzés', 'tulajdonos / munkatárs / ügyfél', 'acc'), ('Bemenetvalidálás', 'közös séma az appal')]),
         ('Adat', [('Adatbázis', 'sorszintű bérlőszűrés, titkosítás tároláskor'), ('Objektumtár', 'fotók, aláírt URL-ek'), ('Biztonsági napló', 'belépés, jogosultság-változás, export')])]),
 table(['Végpont (példa)', 'Tulajdonos', 'Munkatárs', 'Ügyfél', 'Más bérlő'], [['GET /catalog', Y, Y, Y, N], ['PUT /catalog/{faj}', Y, Y, N, N], ['PUT /prices', Y, P, N, N], ['GET /customers', Y, Y, N, N], ['POST /quotes', Y, Y, Y, N], ['DELETE /tenant', Y, N, N, N]], title='Jogosultsági példák', note='◐: a tulajdonos engedélyezheti. Más bérlő adataihoz semmilyen szerepkör nem fér hozzá; ezt automata teszt ellenőrzi.')])

# ---------------- Backend ----------------
S['PL-BE-01'] = ('A Profi backend külön réteg: az Alap és a Haladó csomag továbbra is szerver nélkül fut', 'Architektúra-ábra és adatmodell (ER-diagram)', [
 layers([('Kliensek', [('Planterra app – Alap / Haladó', 'csak statikus fájlokat tölt, szerver nélkül'), ('Planterra app – Profi', 'katalógus, projektek, ajánlatkérés', 'acc'), ('Admin felület (web)', 'kertészet munkatársai', 'acc')]),
         ('Backend (EU)', [('API (OpenAPI, verziózott)', 'REST, közös séma-ellenőrzés', 'acc'), ('Háttérfeladatok', 'import, e-mail, mentés'), ('Hitelesítés', 'passkey, e-mail kód, SSO')], 'HTTPS / JSON'),
         ('Adat', [('PostgreSQL', 'bérlő-azonosító minden táblán'), ('Objektumtár', 'fotók, piktogramok, PDF'), ('E-mail szolgáltatás', 'értesítések')])], title='Architektúra'),
 er([('Bérlő (kertészet)', ['id, név, logó, beállítások', 'előfizetés, állapot']), ('Felhasználó', ['id, e-mail, név', 'bérlő_id, szerepkör']), ('Faj', ['kód, nevek, méretek, igények', 'bérlő_id (üres = beépített)', 'fotó, piktogram']),
     ('Kiszerelés és ár', ['faj_id, cserépméret', 'bruttó ár, készlet', 'érvényes -tól/-ig']), ('Ügyfél', ['bérlő_id, név, elérhetőség', 'hozzájárulások']), ('Projekt', ['ügyfél_id, név, JSON-terv', 'verzió, zárolás']),
     ('Ajánlatkérés', ['projekt_id, tételek', 'állapot, üzenetek']), ('Katalógus-verzió', ['bérlő_id, verziószám', 'közzétéve, változások']), ('Napló', ['ki, mikor, mit', 'régi és új érték'])],
    ['Bérlő 1 — n Felhasználó', 'Bérlő 1 — n Faj (saját)', 'Faj 1 — n Kiszerelés és ár', 'Bérlő 1 — n Ügyfél', 'Ügyfél 1 — n Projekt', 'Projekt 1 — n Ajánlatkérés', 'Bérlő 1 — n Katalógus-verzió'], title='Adatmodell (fő entitások)')])

S['PL-BE-02'] = ('A kertészet a saját kínálatát böngészőből kezeli, és egy „Közzététel” gombbal juttatja el az appokhoz', 'UI-vázlat: admin – fajlista, fajszerkesztő, közzététel', [
 screens([{'t': 'Admin – fajlista', 'w': 'mid', 'els': [('top', 'Zöld Kert Kertészet · Katalógus', '3 nem közzétett változás'), ('row', [('inp', 'Keresés', 'levendula'), ('chips', ['*Forgalmazott', 'Beépített', 'Saját'])]), ('card', 'Levendula ‘Hidcote’ · LA', 'Forgalmazott · P9, 2 l · utoljára módosítva: ma'), ('card', 'Ligeti zsálya · SA', 'Forgalmazott · P9'), ('card', 'Kék csenkesz · FE', 'Nem forgalmazott'), ('row', [('btn', '+ Saját faj'), ('btn', 'Importálás'), ('btn', 'Közzététel (3)', True)])]},
          {'t': 'Admin – fajszerkesztő', 'w': 'mid', 'els': [('top', 'Levendula ‘Hidcote’', 'Mentés'), ('row', [('inp', 'Magyar név', 'Levendula'), ('inp', 'Latin név', 'Lavandula angustifolia')]), ('row', [('inp', 'Magasság (cm)', '45'), ('inp', 'Kiterjedés (cm)', '40'), ('inp', 'Tőtáv (cm)', '40')]), ('chips', ['*nap', 'félárnyék', 'árnyék']), ('row', [('ph', 'fotó', 60), ('ph', 'piktogram', 60)]), ('note', 'Minden mező ugyanazzal a szabállyal validálva, mint az appban; a változás naplózva')]}]),
 hflow([('Szerkesztés', 'piszkozat'), ('Ellenőrzés', 'hibák listája'), ('Közzététel', 'új katalógus-verzió', 'acc'), ('Appok frissítése', 'következő szinkronnál')], title='Közzététel menete')])

S['PL-BE-03'] = ('Az árlista-import minden sort ellenőriz, és csak jóváhagyott előnézet után kerül élesbe', 'Folyamatábra: feltöltés → oszlop-hozzárendelés → előnézet → közzététel', [
 flow([('CSV vagy XLSX feltöltése', 'a kertészet meglévő árlistája', 'start'),
       ('Oszlop-hozzárendelés', 'melyik oszlop a fajnév, kiszerelés, ár, készlet; a hozzárendelés megjegyezve a következő importhoz'),
       ('Sorok ellenőrzése', 'fajnév illesztése (latin / magyar név, kód), számformátum, kötelező mezők'),
       ('Előnézet', 'új, módosult, változatlan és hibás sorok; árváltozás %-ban', 'dec'),
       ('branch', [('Van hibás sor', [('Hibalista letöltése vagy javítás a felületen', 'pl. „ismeretlen faj: Lavendula” → javaslat: Lavandula', 'warn'), ('Újraellenőrzés', '')]),
                   ('Minden sor rendben', [('Jóváhagyás', 'akciós ár és érvényesség megadható'), ('Közzététel', 'új árlista-verzió, naplózva', 'acc')])])]),
 table(['Fajnév (fájlból)', 'Kiszerelés', 'Ár (Ft)', 'Készlet', 'Eredmény'], [['Lavandula angustifolia Hidcote', 'P9', '1 290', '120', 'módosult (+8%)'], ['Salvia nemorosa Caradonna', 'P9', '1 190', '80', 'változatlan'], ['Lavendula stoechas', '2 l', '2 990', '15', 'hibás: ismeretlen faj'], ['Festuca glauca', 'P9', 'n/a', '40', 'hibás: ár nem szám']], title='Előnézet (példa)')])

S['PL-BE-04'] = ('Az app csak a változást tölti le, és internet nélkül a legutóbbi katalógussal dolgozik', 'Szekvenciadiagram: app ↔ API – verzió, különbség, gyorsítótár', [
 seq(['App', 'Helyi tár (IndexedDB)', 'API', 'Adatbázis'], [
  (0, 1, 'katalógus-verzió? (induláskor)'), (1, 0, 'v41', 'reply'),
  (0, 2, 'GET /catalog/version'), (2, 3, 'utolsó közzétett verzió'), (3, 2, 'v43', 'reply'), (2, 0, 'v43', 'reply'),
  ('note', 'v41 ≠ v43 → csak a különbség kell'),
  (0, 2, 'GET /catalog/changes?since=41'), (2, 0, '5 módosult, 1 új, 1 törölt faj + árak', 'reply'),
  (0, 0, 'séma-ellenőrzés (mint a JSON-importnál)'),
  (0, 1, 'mentés: katalógus v43'),
  ('note', 'Törölt faj a meglévő tervben: figyelmeztetés + csereajánlat, a terv nem változik magától'),
  ('sep', 'internet nélkül'),
  (0, 1, 'katalógus kérése'), (1, 0, 'v43 (legutóbb letöltött)', 'reply')])])

S['PL-BE-05'] = ('A szerepkör dönti el, ki mit lát és szerkeszt; más bérlő adataihoz senki nem fér hozzá', 'Szerepkör-mátrix: ki mit láthat és szerkeszthet', [
 table(['Funkció', 'Tulajdonos', 'Munkatárs', 'Ügyfél', 'Haladó / Alap felhasználó'], [
  ['Katalógus megtekintése', Y, Y, Y, N], ['Fajok szerkesztése, közzététel', Y, Y, N, N], ['Árak és készlet', Y, P, N, N], ['Ügyfelek listája', Y, Y, N, N],
  ['Ügyfélprojekt szerkesztése', Y, Y, P, N], ['Ajánlatkérés küldése', Y, Y, Y, N], ['Ajánlat jóváhagyása', Y, P, N, N],
  ['Munkatárs meghívása, szerepkör', Y, N, N, N], ['Előfizetés, számlák', Y, N, N, N], ['Bérlő törlése, teljes export', Y, N, N, N], ['Saját fiók törlése', Y, Y, Y, '—']],
  note='✓ teljes · ◐ ha a tulajdonos engedélyezi (ügyfélnél: csak a saját projektjét, megjegyzéssel) · ✗ nem. Az Alap és a Haladó csomaghoz fiók nem kell.'),
 hflow([('Tulajdonos meghív', 'e-mail cím + szerepkör'), ('Meghívó e-mail', 'egyszer használatos link, 7 napig'), ('Belépés', 'passkey vagy e-mail kód'), ('Hozzáférés a szerepkör szerint', '', 'acc')], title='Meghívás')])

S['PL-BE-06'] = ('Az ajánlatkérés a listából egy lépésben jut el a kertészethez, és a felhasználó látja az állapotát', 'Folyamatábra: lista → ajánlatkérés → kertészet → visszaigazolás', [
 flow([('Növénylista (app)', 'tőszám kiszerelés szerint, kertészeti árakkal', 'start'),
       ('„Ajánlatot kérek”', 'kertészet kiválasztása; név, e-mail, telefon; hozzájárulás az adatok átadásához', 'acc'),
       ('Elküldve', 'tételek + terv PDF-ben; a felhasználó e-mailben visszaigazolást kap'),
       ('Kertészet: admin felület és e-mail értesítés', 'új ajánlatkérés', 'dec'),
       ('branch', [('Elfogad', [('Ajánlat a listára', 'ár, átvétel / szállítás, érvényesség', 'acc')]),
                   ('Módosít', [('Helyettesítő faj vagy ár', 'pl. készlethiány miatt', 'warn')]),
                   ('Elutasít', [('Indoklás', 'a felhasználó másik kertészetet választhat', 'bad')])]),
       ('Felhasználó: értesítés és állapot az appban', 'elküldve → feldolgozás alatt → ajánlat megérkezett'),
       ('Rendelés vagy lezárás', 'mérés: ajánlatkérések száma, elfogadási arány', 'start')])])

S['PL-BE-07'] = ('Offline szerkesztés után a szinkron nem írja felül a másik munkatárs változásait', 'Szekvenciadiagram: offline szerkesztés, szinkron, ütközés', [
 seq(['Anna (telefon)', 'Béla (laptop)', 'API', 'Adatbázis'], [
  (0, 2, 'projekt letöltése (v7)'), (1, 2, 'projekt letöltése (v7)'),
  ('sep', 'Anna offline szerkeszt, Béla online'),
  (1, 2, 'mentés: B terv módosult (alap: v7)'), (2, 3, 'v8 mentése'), (2, 1, 'OK, v8', 'reply'),
  ('sep', 'Anna újra online'),
  (0, 2, 'mentés: B terv módosult (alap: v7)'), (2, 2, 'ütközés: a B terv v8-ban is változott'),
  (2, 0, 'ütközés: B terv', 'reply'),
  ('note', 'Megoldás: Anna változata új változatként kerül a változatfába („B terv – Anna, ütközés”); semmi nem vész el'),
  (0, 2, 'mentés: új változat (alap: v8)'), (2, 3, 'v9 mentése'), (2, 1, 'értesítés: új változat Annától', 'reply')])])

# ---------------- Funkcióbővítés ----------------
S['PL-FUN-01'] = ('A csomagok ugyanazt a kódot futtatják; a funkciókapcsolók döntik el, mi érhető el', 'Funkciómátrix és UI-vázlat: zárolt funkció jelzése', [
 table(['Funkció', 'Alap', 'Haladó', 'Profi'], [
  ['Növények', 'kb. 40 faj', '146 → 300+ faj', 'kertészeti katalógus'], ['Projekt / terület', '1 / 2', 'korlátlan', 'korlátlan, ügyfelenként'], ['Alak', 'téglalap, kör', '+ szabad alak, háttérkép', 'mint a Haladó'],
  ['Egyedi tő, folt', Y, Y, Y], ['Sor, ív, kitöltés, csere, keverék', N, Y, Y], ['Példatervek, ötletgenerátor', 'alap beállítás', 'teljes', 'teljes + saját sablon'],
  ['Szabályellenőrzés', 'magasság, nap, tőtáv', 'teljes', 'teljes'], ['Változatfa, összehasonlítás', N, Y, Y], ['Koncepcióterv, látványterv', N, Y, Y],
  ['Lista', 'képernyő, szöveg', '+ CSV, XLSX, menetrend', '+ ajánlatkérés'], ['Export', 'PNG, link', '+ PDF, SVG, JSON', '+ saját fejlécű PDF'], ['Felhőszinkron', N, P, Y]], title='Funkciómátrix'),
 screens([{'t': 'Alap csomag – zárolt funkció', 'els': [('top', 'Előkert', 'A terv'), ('row', [('btn', 'Növény'), ('btn', 'Folt'), ('lock', 'Sor')]), ('note', 'Koppintásra rövid magyarázat:'), ('card', 'A „Sor” a Haladó csomagban érhető el', 'Egyenes vagy íves sorban ültet, automatikus tőszámmal.'), ('row', [('btn', 'Csomagok'), ('btn', 'Később', False)]), ('txt', 'A meglévő tervek csomagváltáskor sem vesznek el.')]}], title='Zárolt funkció jelzése')])

S['PL-FUN-02'] = ('A kezdőoldalon a legutóbb használt projekt áll elöl, a többi egy listában', 'UI-vázlat: projektlista a kezdőoldalon', [
 screens([{'t': 'Kezdőoldal – projektek', 'els': [('top', 'Planterra', '? ☾ EN'), ('h', 'Projektjeid'), ('card', 'Kertem ★ legutóbbi', '3 terület · 214 tő · ma'), ('card', 'Szülők kertje', '1 terület · 46 tő · 2 hete'), ('card', 'Kovács család (ügyfél)', '2 terület · 130 tő · tegnap'), ('btn', '+ Új projekt', True), ('note', 'Hosszú nyomás vagy ⋯: átnevezés, másolás, mentés (JSON), törlés')]},
          {'t': 'Projekt megnyitva', 'els': [('top', 'Kertem', '⋯'), ('h', 'Területeid'), ('card', 'Előkert', '500 × 1200 cm · A terv'), ('card', 'Házoldali sáv', '120 × 1200 cm'), ('btn', '+ Új terület'), ('txt', 'A Planterra logó visszavisz a projektlistához.')]}])])

S['PL-FUN-03'] = ('A két eszköz a felhasználó saját felhőfájlján keresztül szinkronizál; ütközéskor mindkét állapot megmarad', 'Szekvenciadiagram: két eszköz, felhőfájl, ütközés', [
 seq(['Telefon', 'Felhő (Drive / OneDrive / iCloud)', 'Laptop'], [
  (0, 1, 'Kertem.planterra mentése (rev 12)'), (2, 1, 'megnyitás'), (1, 2, 'rev 12', 'reply'),
  ('sep', 'mindkét eszközön módosítás, a laptop offline'),
  (0, 1, 'mentés (alap: rev 12) → rev 13'),
  (2, 1, 'mentés (alap: rev 12)'), (1, 2, 'a fájl közben rev 13 lett', 'reply'),
  (2, 2, 'összefésülés: eltérő változatok külön maradnak'),
  ('note', 'Ütközés: a laptop változata új változatként kerül a változatfába („A terv – laptop”); a Planterra szervere az adatot nem látja'),
  (2, 1, 'mentés → rev 14'), (0, 1, 'frissítés'), (1, 0, 'rev 14', 'reply')])])

S['PL-FUN-04'] = ('A példaterv a saját méretre nyúlik; a tőtáv marad, a tőszám újraszámolódik', 'UI-vázlat: méretmegadás és előnézet', [
 screens([{'t': 'Példaterv hozzáadása', 'els': [('top', 'Mediterrán kert', '✕'), ('txt', 'Eredeti méret: 800 × 1000 cm'), ('row', [('inp', 'Szélesség (cm)', '600'), ('inp', 'Hosszúság (cm)', '900')]), ('chips', ['*Téglalap', 'Kör']), ('txt', 'Tőszám: 333 → kb. 225 (becsült)'), ('btn', 'Hozzáadás a saját méretben', True), ('btn', 'Eredeti méretben')]},
          {'t': 'Előnézet', 'els': [('row', [('ph', 'eredeti\n800 × 1000', 150), ('ph', 'saját\n600 × 900', 130)]), ('note', 'Foltok és sorok arányosan változnak, a fák és nagy cserjék mérete nem, csak a helyük'), ('txt', 'Utána a szabályellenőrzés lefut, a figyelmeztetések a szokott helyen.')]}])])

S['PL-FUN-05'] = ('A Profi PDF első oldala a kertészet fejlécével és az ajánlat adataival indul', 'UI-vázlat: PDF első oldala fejléccel', [
 screens([{'t': 'PDF – 1. oldal (A4)', 'w': 'mid', 'els': [('row', [('ph', 'kertészet logója', 50), ('txt', 'Zöld Kert Kertészet · 9021 Győr, … · +36 … · info@…')]), ('h', 'Kertterv és árajánlat – Kovács család, előkert'), ('row', [('txt', 'Készült: 2027. 04. 12.'), ('txt', 'Ajánlat érvényes: 2027. 05. 12.')]), ('ph', 'terv (rajz) jelmagyarázattal', 170), ('card', 'Növénylista és ár', '24 tétel · 312 tő · bruttó 412 800 Ft (a kertészet aktuális árai)'), ('txt', 'Lábléc: kertész neve, oldalszám, „Készült a Planterrával”')]},
          {'t': 'Beállítás (admin)', 'els': [('top', 'PDF-fejléc', 'Mentés'), ('ph', 'logó feltöltése', 50), ('inp', 'Cég adatai', 'név, cím, telefon, e-mail'), ('inp', 'Ajánlat érvényessége', '30 nap'), ('inp', 'Kiemelő szín', '#2E6B4F'), ('note', 'A Haladó csomagban a PDF a Planterra fejlécével készül')]}])])

S['PL-FUN-06'] = ('A visszajelzés két koppintással elküldhető, és tervet csak külön hozzájárulással visz', 'UI-vázlat: visszajelzés űrlap', [
 screens([{'t': 'Visszajelzés', 'els': [('top', 'Visszajelzés', '✕'), ('chips', ['*Hiba', 'Ötlet', 'Kérdés']), ('inp', 'Mit tapasztaltál?', 'A lista nem frissült, miután…'), ('row', [('btn', '+ Képernyőkép'), ('btn', '+ Technikai adatok')]), ('txt', '☐ A jelenlegi terv csatolása (hozzájárulok)'), ('inp', 'E-mail (nem kötelező, válaszhoz)', ''), ('btn', 'Küldés', True), ('txt', 'Adatkezelés: lásd Adatvédelmi tájékoztató.')]},
          {'t': 'Elküldve', 'els': [('top', 'Visszajelzés', '✕'), ('h', 'Köszönjük!'), ('txt', 'A visszajelzésed megérkezett (azonosító: FB-0142).'), ('note', 'Technikai adatok: verzió, böngésző, nyelv, képernyőméret; személyes adat csak akkor, ha megadod')]}])])

# ---------------- Adattartalom ----------------
S['PL-DAT-01'] = ('A lektorált adat új seed-verzióként jut el mindenkihez, a felhasználói módosítások megmaradnak', 'Folyamatábra: export → lektorálás → visszatöltés → seed-verzió', [
 hflow([('Ellenőrzendők listája (CSV)', '135 jelölt mező, 146 faj', 'start'), ('Lektorálás', 'kertész / faiskolai szakember; forrás és dátum mezőnként'), ('Visszatöltés és ellenőrzés', 'séma-ellenőrzés, eltérések listája'), ('Új seed-verzió', 'pl. 5 → 6', 'acc'), ('Frissítés a felhasználóknál', 'migrate: új fajok és javított mezők')]),
 table(['Eset a felhasználónál', 'Mi történik a frissítéskor'], [['Beépített fajt nem módosított', 'a javított értékek felülírják a régieket'], ['Beépített fajt módosított', 'a saját értékek maradnak, a javasolt eltérés megjelenik („Frissítés elérhető”)'], ['Beépített fajt törölt', 'törölve marad'], ['Saját faj', 'nem érinti']], title='Szabályok')])

S['PL-DAT-02'] = ('Az ehető és őshonos fajokhoz néhány új mező és három új szűrő kell', 'Adatmodell-bővítés (új mezők) és UI-vázlat (új szűrők)', [
 er([('Növény (meglévő)', ['kód, nevek, méretek', 'nap, víz, talaj, mérgezőség', 'virágzás, színek, piktogram']), ('*Új mezők', ['életciklus: egyéves / kétéves / évelő', 'ehető rész, termés hónapjai', 'vetés és palántázás hónapjai', 'porzópartner (gyümölcsnél)', 'őshonos (HU), méhbarát']), ('*Menetrend-bővítés', ['vetés, palántázás', 'betakarítás', 'metszés gyümölcsfán'])],
    ['Növény 1 — 0..1 Ehető adatok', 'Gyümölcsfa n — n Porzópartner', 'Új mezők → menetrend feladatai'], title='Adatmodell'),
 screens([{'t': 'Szűrők', 'els': [('top', 'Növényszűrők', 'Kész'), ('txt', 'Csoport'), ('chips', ['Évelő', 'Díszfű', 'Cserje', 'Fa', '*Rózsa', '*Gyümölcs', '*Zöldség', '*Fűszer']), ('txt', 'Új szűrők'), ('chips', ['*Ehető', '*Őshonos', '*Méhbarát']), ('note', 'Kiemelve: új elemek')]}], title='Új szűrők')])

S['PL-DAT-04'] = ('Minden új faj ugyanabban a stílusban kap felül- és oldalnézeti piktogramot', 'Stílusminta: piktogram-sablon', [
 raw('<div class="pic">' + ''.join(f'<div class="panel" style="width:220px;text-align:center"><div class="pt">{t}</div><svg width="180" height="140" viewBox="0 0 180 140">{g}</svg><div style="font-size:12.5px;color:#686e64">{d}</div></div>' for t, g, d in [
  ('Felülnézet', '<circle cx="90" cy="70" r="56" fill="#8b6bb5" fill-opacity=".25" stroke="#5f4a86" stroke-width="2"/><circle cx="90" cy="70" r="30" fill="#8b6bb5" fill-opacity=".5"/><circle cx="90" cy="70" r="4" fill="#2b322b"/>', 'kör alaprajz, a kiterjedés aránya, középen tő'),
  ('Oldalnézet', '<rect x="20" y="118" width="140" height="3" fill="#8a7a5a"/><path d="M90 118 C 60 100 50 60 70 40 C 80 55 85 50 90 30 C 95 50 100 55 110 40 C 130 60 120 100 90 118Z" fill="#8b6bb5" fill-opacity=".45" stroke="#5f4a86" stroke-width="2"/>', 'talajvonal, magasság : szélesség arány'),
  ('Rács és méret', '<rect x="10" y="10" width="160" height="120" fill="none" stroke="#d9d2c0" stroke-dasharray="4 4"/><rect x="30" y="20" width="120" height="100" fill="none" stroke="#244b3c"/><text x="90" y="74" font-size="12" text-anchor="middle" fill="#244b3c">256 × 256 px</text>', 'SVG, 256 px vászon, 2 px kontúr, 2 szín + átlátszóság')]) + '</div>'),
 table(['Szabály', 'Érték'], [['Formátum', 'SVG, felül- és oldalnézet külön fájlban (top/KÓD.svg, side/KÓD.svg)'], ['Színek', 'a faj virág- vagy lombszíne (seasonColors), sötétebb kontúr'], ['Vonal', '2 px kontúr, lekerekített végek'], ['Méretarány', 'az adatbázis kiterjedése és magassága szerint'], ['Fájlméret', 'legfeljebb 6 KB fajonként']], title='Sablon')])

# ---------------- UI design / UX ----------------
S['PL-UX-01'] = ('Az egyszerű mód öt eszközt mutat, a többi egy „Több eszköz” menü mögé kerül', 'UI-vázlat: egyszerű és teljes eszköztár összevetése', [
 screens([{'t': 'Egyszerű mód (Alap alapértelmezés)', 'els': [('top', 'Előkert', '? ⋯'), ('ph', 'rajz', 150), ('row', [('btn', 'Növény'), ('btn', 'Folt'), ('btn', 'Ötlet'), ('btn', 'Lista'), ('btn', 'Több ▾')]), ('note', 'Öt eszköz; a „Több” menüben a többi, egy kapcsolóval állandóan kirakható')]},
          {'t': 'Teljes mód (Haladó)', 'els': [('top', 'Előkert', '↶ ↷ ⧉ ? ⋯'), ('ph', 'rajz', 150), ('row', [('btn', 'Kijelölés'), ('btn', 'Növény'), ('btn', 'Folt'), ('btn', 'Sor')]), ('row', [('btn', 'Elemek'), ('btn', 'Évszak'), ('btn', 'Lista'), ('btn', 'Ötlet')]), ('note', 'Váltás: Nézet → „Egyszerű mód”; adat nem vész el')]}])])

S['PL-UX-02'] = ('A felső sávban öt elem marad, így a terület neve olvasható', 'UI-vázlat: felső sáv előtte és utána (360 px széles telefon)', [
 two(el(('top', 'Kas…', '↶ ↷ ⧉ EN ☾ ? ⋯ 0')) + el(('note', '8 ikon, a név csonkul')), el(('top', 'Kastélykert', '↶ ? ⋯ 0')) + el(('card', '⋯ menü', 'Újra · Összehasonlítás · Nyelv: English · Sötét mód · Projekt')) + el(('note', 'Koppintás a névre: teljes név, méret, alak')), 'Ma', 'Javasolt')])

S['PL-UX-03'] = ('Visszatérő felhasználónál a „Folytatás” áll elöl, a példák lapozható sávban', 'UI-vázlat: kezdőoldal első és visszatérő felhasználónak', [
 screens([{'t': 'Első látogatás', 'els': [('top', 'Planterra', '? ☾ EN'), ('h', 'Tervezzük meg a kertet'), ('btn', '+ Új terület létrehozása', True), ('txt', 'Példatervek →'), ('row', [('ph', 'Mediterrán', 70), ('ph', 'Kastély', 70), ('ph', 'Vidéki', 70)]), ('txt', 'Kezdés mintából: Házoldali sáv · Gyepsávos kert')]},
          {'t': 'Visszatérő felhasználó', 'els': [('top', 'Planterra', '? ☾ EN'), ('card', 'Folytatás: Előkert ›', 'Kertem · A terv · 214 tő · tegnap'), ('row', [('btn', '+ Új terület'), ('btn', 'Projektek')]), ('h', 'Területeid'), ('card', 'Házoldali sáv', '120 × 1200 cm'), ('txt', 'Példatervek →'), ('row', [('ph', 'Angol', 60), ('ph', 'Japán', 60), ('ph', 'Préri', 60)]), ('txt', 'Összes példa ›')]}])])

S['PL-UX-04'] = ('A halvány szöveg mindkét módban eléri a 4,5:1 kontrasztot; a fő gond a betűméret', 'Színpaletta-táblázat kontrasztértékekkel (a 0.6.2 tokenjei alapján, számolva)', [
 table(['Elem', 'Előtér', 'Háttér', 'Kontraszt', 'WCAG AA (4,5:1)'], [
  [('Szöveg – világos',), (sw('#2b322b'),), (sw('#f7f4ec'),), f'{cr("#2b322b","#f7f4ec"):.1f}:1', Y],
  [('Halvány szöveg – világos',), (sw('#686e64'),), (sw('#f7f4ec'),), f'{cr("#686e64","#f7f4ec"):.1f}:1', Y if cr("#686e64","#f7f4ec") >= 4.5 else N],
  [('Halvány szöveg panelen – világos',), (sw('#686e64'),), (sw('#fcfaf5'),), f'{cr("#686e64","#fcfaf5"):.1f}:1', Y if cr("#686e64","#fcfaf5") >= 4.5 else N],
  [('Kiemelő gomb – világos',), (sw('#ffffff'),), (sw('#244b3c'),), f'{cr("#ffffff","#244b3c"):.1f}:1', Y],
  [('Szöveg – sötét',), (sw('#f1eee4'),), (sw('#1d231e'),), f'{cr("#f1eee4","#1d231e"):.1f}:1', Y],
  [('Halvány szöveg – sötét',), (sw('#a7ab9c'),), (sw('#1d231e'),), f'{cr("#a7ab9c","#1d231e"):.1f}:1', Y if cr("#a7ab9c","#1d231e") >= 4.5 else N],
  [('Halvány szöveg panelen – sötét',), (sw('#a7ab9c'),), (sw('#252d26'),), f'{cr("#a7ab9c","#252d26"):.1f}:1', Y if cr("#a7ab9c","#252d26") >= 4.5 else N],
  [('Figyelmeztetés – világos',), (sw('#9a5b12'),), (sw('#f7f4ec'),), f'{cr("#9a5b12","#f7f4ec"):.1f}:1', Y if cr("#9a5b12","#f7f4ec") >= 4.5 else N],
  [('Hiba – világos',), (sw('#a3362b'),), (sw('#f7f4ec'),), f'{cr("#a3362b","#f7f4ec"):.1f}:1', Y if cr("#a3362b","#f7f4ec") >= 4.5 else N]],
  note='Kontraszt a WCAG 2.1 relatív fénysűrűség-képletével számolva, a src/styles/tokens.css értékeiből.'),
 table(['Betűméret-szabály', 'Ma', 'Cél'], [['Legkisebb szöveg (méretek, tőszám, címkék)', '10,5–11 px', '12 px'], ['Monospace címkék', '11 px', '12 px'], ['„Nagyobb betűk” kapcsoló', 'nincs', '+15% minden szövegre']], title='Betűméret')],
 'Mivel a kontrasztértékek megfelelnek, a feladat elsősorban a betűméret növelése és a kapcsoló bevezetése.')

S['PL-UX-05'] = ('Az új bevezető három lépésben az első kész növénylistáig vezet', 'Folyamatábra (első használat lépései) és UI-vázlat', [
 hflow([('1. Terület', 'válassz példát vagy rajzold meg', 'start'), ('2. Növények', 'tegyél rá növényt vagy kérj ötletet'), ('3. Lista', 'nézd meg, mit kell venni', 'acc'), ('Kész', 'mérés: első kész lista', 'start')], title='Lépések'),
 screens([{'t': '1/3 – Terület', 'els': [('top', 'Bevezető', 'Kihagyás'), ('h', 'Mit tervezel?'), ('btn', 'Példatervből indulok', True), ('btn', 'Megrajzolom a területet'), ('txt', '● ○ ○')]},
          {'t': '2/3 – Növények', 'els': [('top', 'Bevezető', 'Kihagyás'), ('ph', 'rajz, kiemelt „Növény” és „Ötlet” gomb', 110), ('txt', 'Koppints a Növényre, majd a rajzra.'), ('txt', '● ● ○')]},
          {'t': '3/3 – Lista', 'els': [('top', 'Bevezető', 'Kész'), ('card', 'Növénylista', '12 faj · 148 tő · kb. 182 000 Ft'), ('txt', 'Ezt viheted a kertészetbe.'), ('txt', '● ● ●')]}], title='Képernyők')])

def _ux06(before):
    beds = ''.join(f'<circle cx="{x}" cy="{y}" r="9" fill="#8b6bb5" fill-opacity=".55"/>' for x in range(150, 330, 22) for y in range(70, 200, 22))
    box = ''.join(f'<rect x="{x}" y="58" width="14" height="14" fill="#3f6a3a"/>' for x in range(130, 340, 18))
    if before:
        tree = '<circle cx="250" cy="140" r="95" fill="#4f7a3f" fill-opacity=".92"/>'
        lab = '<text x="205" y="64" font-size="15" font-weight="700" fill="#2b322b">BX × 43</text><text x="215" y="70" font-size="15" font-weight="700" fill="#2b322b">LA × 22</text>'
    else:
        tree = '<circle cx="250" cy="140" r="95" fill="#4f7a3f" fill-opacity=".12" stroke="#3f6a3a" stroke-width="2.5" stroke-dasharray="6 5"/><circle cx="250" cy="140" r="5" fill="#3f6a3a"/>'
        lab = '<line x1="340" y1="64" x2="372" y2="40" stroke="#686e64"/><rect x="372" y="26" width="72" height="22" rx="4" fill="#fff" stroke="#9aa294"/><text x="378" y="42" font-size="14" font-weight="700" fill="#2b322b">BX × 43</text><rect x="268" y="120" width="70" height="22" rx="4" fill="#fff" stroke="#9aa294"/><text x="274" y="136" font-size="14" font-weight="700" fill="#2b322b">LA × 22</text>'
    return f'<svg width="100%" viewBox="0 0 460 250"><rect x="110" y="40" width="250" height="180" fill="#e9dfc6" stroke="#2b322b" stroke-width="2"/>{box}{beds}{tree}{lab}</svg>'

S['PL-UX-06'] = ('Ütköző címkék helyett eltolt címkék, és körvonalas lombkorona', 'UI-vázlat: címke- és lombmegjelenítés', [
 two(_ux06(True) + el(('note', 'A két csoportcímke egymásra csúszik, a fa lombja eltakarja a levendulát')), _ux06(False) + el(('chips', ['Lomb:', '*körvonal', 'áttetsző', 'teli'])) + el(('note', 'A címke ütközéskor vezetővonallal kitér, a fa körvonalként látszik, alatta az ágyás')), 'Ma', 'Javasolt'),
 table(['Nagyítás', 'Címkék'], [['kicsi (teljes terület)', 'csak a fajkód, ütközéskor elrejtve'], ['közepes', 'fajkód × tőszám, ütközéskor eltolva vezetővonallal'], ['nagy', 'minden címke']], title='Szabály')])

# ---------------- Fizetés ----------------
S['PL-BIZ-01'] = ('Az előfizetés egyértelmű állapotokon megy át; lemondáskor a tervek megmaradnak', 'Folyamatábra: előfizetés életciklusa', [
 hflow([('Ingyenes (Alap)', '', 'start'), ('Próbaidő', 'Haladó 14 nap, kártya nélkül'), ('Fizetős', 'havi / éves / szezon', 'acc'), ('Megújítás', 'értesítés 7 nappal előtte'), ('Lemondva', 'az időszak végéig aktív', 'warn'), ('Alap csomag', 'a tervek olvashatók, exportálhatók', 'start')]),
 table(['Esemény', 'Állapot után', 'Felhasználó értesítése', 'Számla'], [['Próbaidő vége fizetés nélkül', 'Alap', 'e-mail 3 nappal előtte és a végén', '—'], ['Sikeres fizetés', 'Fizetős', 'visszaigazolás', 'automatikus, NAV-bejelentéssel'], ['Sikertelen megújítás', 'Fizetős (7 nap türelmi idő)', 'e-mail + app-üzenet', '—'], ['Türelmi idő vége', 'Alap', 'e-mail', '—'], ['Lemondás', 'Fizetős az időszak végéig', 'visszaigazolás', '—'], ['Visszatérítés (jogos panasz)', 'Alap', 'e-mail', 'sztornó számla']], title='Állapotváltások')])

S['PL-BIZ-02'] = ('A jogosultság aláírt tokenben utazik, offline 30 napig érvényes', 'Szekvenciadiagram: vásárlás → token → ellenőrzés → megújítás', [
 seq(['App', 'Fizetési szolgáltató', 'Planterra licenc-API'], [
  (0, 1, 'fizetés (Haladó, éves)'), (1, 2, 'sikeres fizetés (webhook)'), (2, 2, 'jogosultság rögzítése'),
  (0, 2, 'token kérése'), (2, 0, 'aláírt token: csomag=Haladó, lejár=+30 nap', 'reply'),
  (0, 0, 'aláírás ellenőrzése, funkciók feloldása'),
  ('sep', 'naponta, ha van internet'),
  (0, 2, 'token megújítása'), (2, 0, 'új token (+30 nap)', 'reply'),
  ('sep', '30 napnál régebbi token, internet nélkül'),
  (0, 0, 'csak olvasható mód: tervek megnyithatók, exportálhatók'),
  ('note', 'A token csak a csomagot és a lejáratot tartalmazza, személyes adatot nem')])])

# ---------------- Analitika ----------------
S['PL-ANA-01'] = ('Csak eseményeket számolunk, tervtartalmat és személyes adatot nem', 'Eseménylista: mért események és jelentésük', [
 table(['Esemény', 'Mikor', 'Paraméterek', 'Mit mér'], [
  ['app_start', 'indításkor', 'nyelv, csomag, telepített-e', 'havi aktív felhasználó'], ['area_created', 'új terület', 'forrás: üres / példa / sablon', 'kezdés módja'], ['example_used', 'példaterv hozzáadva', 'példa kulcsa', 'népszerű példák'],
  ['plant_placed', 'első tő egy területen', '—', 'aktiváció 1. lépés'], ['idea_generated', 'ötlet generálva', 'mód: terület / kijelölt rész', 'ötletgenerátor használata'], ['list_opened', 'lista megnyitva', 'tőszám-sáv (pl. 50–100)', 'fő mutató: kész lista'],
  ['export', 'PDF / PNG / CSV / XLSX / link', 'formátum', 'mit visznek tovább'], ['visual_sent', 'látványterv küldése', '—', 'látványterv használata'], ['quote_requested', 'ajánlatkérés (Profi)', '—', 'üzleti konverzió'], ['error', 'kezeletlen hiba (opt-in)', 'verzió, hibaüzenet kivonat', 'stabilitás']],
  note='Hozzájárulás nélkül semmi nem kerül elküldésre. Nincs süti, nincs felhasználói azonosító; a tőszám csak sávként szerepel.')])

# ---------------- Infrastruktúra ----------------
S['PL-OPS-02'] = ('Minden változás előnézeten és stagingen át jut élesbe, és perceken belül visszaállítható', 'Folyamatábra: PR → előnézet → staging → éles', [
 hflow([('Pull request', 'CI: típus, unit, e2e, audit', 'start'), ('Előnézet', 'PR-enkénti URL'), ('main ág', 'beolvasztás után'), ('Staging', 'automatikus telepítés, kézi ellenőrzés'), ('Címkézett kiadás', 'pl. v0.7.0 + változásnapló', 'acc'), ('Éles', 'telepítés; „Újdonságok” ablak az appban', 'acc')]),
 table(['Ellenőrzés élesítés után', 'Hogyan'], [['A service worker frissít', 'régi verzióról nyitva → frissítési értesítés megjelenik'], ['Biztonsági fejlécek', 'securityheaders.com, Mozilla Observatory'], ['Fő folyamat működik', 'füstteszt: terület → növény → lista'], ['Visszaállítás', 'előző kiadás újratelepítése egy kattintással']], title='Kiadás utáni ellenőrzés')])

# ---------------- Minőségbiztosítás ----------------
S['PL-QA-01'] = ('A fő folyamatokat legalább öt valós eszközön kell végigvinni', 'Teszt-mátrix: eszköz × folyamat', [
 table(['Folyamat', 'iPhone (iOS 15)', 'iPhone (iOS 18)', 'Android középkat.', 'Android csúcs', 'Tablet', 'Laptop (Chrome / Safari)'], [
  ['Terület rajzolása (téglalap, kör, szabad)', '?', '?', '?', '?', '?', '?'], ['Növény, folt, sor elhelyezése', '?', '?', '?', '?', '?', '?'], ['Két ujjas nagyítás és mozgatás', '?', '?', '?', '?', '?', '—'],
  ['Lista, CSV, XLSX', '?', '?', '?', '?', '?', '?'], ['Mentés és betöltés (JSON)', '?', '?', '?', '?', '?', '?'], ['Megosztott link megnyitása', '?', '?', '?', '?', '?', '?'],
  ['Látványterv: megosztó menü → ChatGPT app', '?', '?', '?', '?', '?', '—'], ['Offline működés', '?', '?', '?', '?', '?', '?'], ['Telepítés a kezdőképernyőre', '?', '?', '?', '?', '?', '?'], ['Nyomtatás / PDF', '?', '?', '?', '?', '?', '?']],
  note='Kitöltés tesztkor: ✓ hibátlan · ◐ kisebb hiba · ✗ nem működik. A hibák jegyzőkönyvbe, ahol lehet, automata tesztbe.')])

S['PL-QA-02'] = ('Az induló JavaScript 268 KB-ról 197 KB-ra csökkent; a cél 150 KB', 'Mérési riport: előtte és utána (a többi érték mérése valós eszközön még hátravan)', [
 table(['Mérőszám', '0.6.0', '0.6.1–0.6.2', 'Cél', 'Állapot'], [
  ['Induló JS (gzip)', '268 KB', '197 KB', '< 150 KB', P], ['Első megjelenés, 4G, középkat. Android', 'nincs mérve', 'nincs mérve', '< 3 mp', '?'],
  ['Húzás és nagyítás 300 tővel', 'nincs mérve', 'nincs mérve', '> 50 fps', '?'], ['Lighthouse teljesítmény (mobil)', 'nincs mérve', 'nincs mérve', '> 90', '?']],
  note='A csomagméret a build kimenetéből mérve (gzip). ◐ részben teljesül · ? mérésre vár.'),
 table(['Következő lépés', 'Várható hatás'], [['Növényadatbázis és angol nevek késleltetett betöltése', 'a legnagyobb nem React-tétel az indulócsomagban'], ['Piktogramlista dinamikus importja', 'kisebb indulócsomag'], ['Vászon-rétegek memoizálása', 'folyamatosabb húzás sok tőnél'], ['Csomagméret-költségvetés a CI-ban', 'visszaesés azonnal látszik']], title='Teendők')])

S['PL-QA-04'] = ('A béta négy hétig tart, és a nyilvános indulás két feltételhez kötött', 'Ütemterv: béta hetei és kapufeltételek (2027 február)', [
 table(['Hét', 'Tesztelők feladata', 'Csapat feladata', 'Mérés'], [
  ['1. hét', 'telepítés, egy ágyás megtervezése példából', 'jelentkezők behívása, tesztelői útmutató', 'aktiválás, első tő'], ['2. hét', 'saját terület, lista elkészítése', 'heti összesítő, gyorsjavítások', 'kész lista aránya'],
  ['3. hét', 'változatok, látványterv, megosztás', 'pilot kertészetek: Profi első változat', 'visszatérők a 2. héten'], ['4. hét', 'szabad használat, kérdőív', 'hibák lezárása, döntés a kapuról', 'elégedettség, nyitott hibák']], title='Hetek'),
 hflow([('Kapu: nyilvános indulás', 'a tesztelők ≥ 40%-a eljut a kész listáig', 'acc'), ('és', 'nincs nyitott kritikus hiba', 'acc'), ('Ha nem teljesül', 'a béta áprilisig folytatódik', 'warn')], title='Kapufeltételek')])

# ---------------- Architektúra ----------------
S['PL-ARC-01'] = ('A három nagy fájl kisebb, egyfelelősségű modulokra bomlik', 'Modulábra: előtte és utána', [
 two(layers([('Ma', [('App.tsx', '716 sor: képernyők, ablakok, gyorsműveletek', 'warn'), ('PlanCanvas.tsx', '873 sor: rajz, húzás, kijelölés, alakszerkesztés', 'warn'), ('projectStore.ts', '754 sor: minden adatművelet', 'warn')])]),
     layers([('Store-szeletek', [('area', ''), ('plantDb', ''), ('variant', ''), ('items', ''), ('settings', '')]), ('Vászon', [('useDrag', ''), ('useSelect', ''), ('useShapeEdit', ''), ('rétegek', '')]), ('Képernyők', [('PlanScreen', ''), ('HomeScreen', ''), ('Sheets', '')])]), 'Előtte', 'Utána'),
 table(['Eszköz', 'Szabály'], [['ESLint (typescript-eslint, react-hooks)', 'hibára a CI megáll'], ['Prettier', 'egységes formázás, ellenőrzés a CI-ban'], ['Fájlméret', 'jelzés 400 sor felett']], title='Kódminőség')])

S['PL-ARC-02'] = ('A képek külön tárba kerülnek, a projekt csak hivatkozást tart', 'Adatmodell-ábra: projekt, képtár, hivatkozások', [
 two(er([('Projekt (JSON)', ['területek, változatok, elemek', 'háttérkép: data URL (~MB)', 'látványképek: data URL', 'saját fotók: data URL'])], ['minden visszavonási lépés a teljes projektet másolja'], cols=1),
     er([('Projekt (JSON)', ['területek, változatok, elemek', 'háttérkép: kép_id', 'látványképek: kép_id lista']), ('*Képtár (IndexedDB)', ['kép_id, Blob, típus, méret', 'létrehozva'])], ['Projekt n — n Kép (hivatkozás)', 'JSON-mentéskor a képek beágyazva', 'undo: csak a változott rész'], cols=2), 'Ma', 'Javasolt')])

# ---------------- Piacra lépés ----------------
S['PL-MKT-01'] = ('A landing oldal az értékajánlattól a példákon át a csomagokig vezet', 'UI-vázlat: landing oldal szerkezete', [
 screens([{'t': 'Landing oldal (asztali és mobil)', 'w': 'wide', 'els': [('top', 'Planterra', 'Példák · Csomagok · GYIK · EN'),
   ('h', 'Tervezd meg a kerted 10 perc alatt – magyar növényekkel, pontos bevásárlólistával, regisztráció nélkül.'), ('row', [('btn', 'Kipróbálom ingyen', True), ('btn', 'Példák megnézése')]), ('ph', 'rövid bemutató animáció: terület → növények → lista', 90),
   ('h', 'Példatervek'), ('row', [('ph', 'Mediterrán', 60), ('ph', 'Kastélykert', 60), ('ph', 'Vidéki udvar', 60), ('ph', 'Angolkert', 60), ('ph', '+6', 60)]), ('txt', 'Minden példa külön aloldalon, növénylistával (SEO: kerttervező, ágyástervező, évelőágyás)'),
   ('h', 'Csomagok'), ('row', [('card', 'Alap', 'ingyenes'), ('card', 'Haladó', 'teljes funkció'), ('card', 'Profi', 'kertészeteknek')]), ('h', 'GYIK'), ('txt', 'Kell regisztráció? · Hol vannak az adataim? · Működik offline?'), ('txt', 'Lábléc: Impresszum · ÁSZF · Adatvédelem · Kapcsolat')]}])])
