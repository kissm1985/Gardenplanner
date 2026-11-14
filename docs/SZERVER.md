# Planterra szerver (Profi csomag)

A szerver a kertészetek katalógusát kezeli: fajok, cserépméretek, árak, készlet, közzétett változatok, munkatársak. A tervezők alkalmazása innen tölti le a közzétett katalógust. **A tervek továbbra is a tervezők készülékén maradnak; a szerver tervet nem kap és nem tárol.**

Egyetlen Node.js-folyamat szolgálja ki az API-t (`/api/v1/…`), és kérésre a buildelt alkalmazást (`dist/`), benne a kertészeti felületet (`/admin.html`), ugyanazon a címen.

## Indítás

Node.js 22.5 vagy újabb kell (beépített `node:sqlite`).

```bash
npm ci
npm run build                                   # dist/ – az alkalmazás és az admin oldal
npm run server:cli -- create-tenant zoldkert "Zöld Kert Kertészet" tulaj@zoldkert.hu
NODE_ENV=production SERVER_SECRET=… PUBLIC_URL=https://katalogus.zoldkert.hu \
  STATIC_DIR=dist DB_PATH=/var/lib/planterra/planterra.db npm run server
```

Fejlesztéshez (Windows, macOS, Linux) elég `npm run build`, majd `npm run server`: beállítás nélkül a `dist/` mappát szolgálja ki a http://localhost:8787 címen, fejlesztői titokkal, és a belépési kódokat a konzolra írja, és `npm run server:cli -- outbox` mutatja az utolsó kiküldött kódokat.

## Beállítások (környezeti változók)

| Változó | Jelentés |
|---|---|
| `PORT` | Port (alapból 8787). |
| `DB_PATH` | Az SQLite-adatbázis fájlja (alapból `planterra.db`). Mentsd rendszeresen (pl. `sqlite3 planterra.db ".backup mentes.db"`). |
| `SERVER_SECRET` | Legalább 32 karakteres titok a belépési kódok kivonatához. Éles üzemben kötelező; ne kerüljön a tárolóba. |
| `PUBLIC_URL` | A szerver nyilvános címe; az admin API csak erről (és az `ALLOWED_ORIGINS`-ból) fogad böngészős kérést. |
| `ALLOWED_ORIGINS` | További engedélyezett origin-ek vesszővel (pl. ha az admin oldal máshol fut). |
| `STATIC_DIR` | A buildelt alkalmazás mappája (`dist`); a fájlokat a build `_headers` biztonsági fejléceivel küldi. |
| `TRUST_PROXY=1` | Az ügyfél IP-címét az `X-Forwarded-For` fejlécből veszi – csak megbízható fordított proxy (nginx, Caddy) mögött kapcsold be. |
| `REQUIRE_OWNER_TOTP=1` | A tulajdonosoknak a hitelesítő alkalmazást (2FA) be kell állítaniuk, mielőtt az admin API-t használhatják. Ajánlott. |
| `MAIL_WEBHOOK_URL`, `MAIL_WEBHOOK_TOKEN` | A belépési kódok kézbesítése: a szerver `POST {to, subject, text}` JSON-t küld ide (Bearer tokennel), pl. egy e-mail-szolgáltató HTTP API-jához illesztett kis függvénynek. Enélkül a kódok csak az `outbox` táblába kerülnek. |

Éles üzemben a szervert HTTPS mögött futtasd (pl. Caddy vagy nginx TLS-sel), és állítsd be `TRUST_PROXY=1`-et. Az alkalmazás CSP-je (`connect-src`) a saját originjét engedi; ha a tervezőt máshonnan szolgálod ki, a build előtt add meg a szervert: `VITE_API_ORIGIN=https://katalogus.zoldkert.hu npm run build`.

## Biztonság

- **Belépés**: e-mail-cím + 6 jegyű egyszer használatos kód (10 percig érvényes, 5 próbálkozás után elhasználódik, HMAC-kivonatként tárolva). Opcionális második lépés: TOTP (RFC 6238) hitelesítő alkalmazással. A munkamenet-token 12 óráig él, a szerver csak a SHA-256 kivonatát tárolja; a kilépés és a fiók letiltása azonnal érvényteleníti.
- **Visszaélés elleni védelem**: IP-nként és címenként korlátozott kódkérés és ellenőrzés, egy cím óránként 10 sikertelen belépés után zárolódik; a válasz nem árulja el, hogy egy cím létezik-e.
- **Bérlők elkülönítése**: minden kertészet adata saját `tenant_id`-vel tárolódik, és a bérlőt mindig a munkamenet adja, sosem a kérés. Más kertészet adatát sem olvasni, sem módosítani nem lehet (tesztek: `tests/server/api.test.ts`).
- **Szerepek**: *tulajdonos* (minden, felhasználók, napló), *szerkesztő* (fajok, import, közzététel), *megtekintő* (csak olvasás). Legalább egy tulajdonos mindig marad.
- **Bemenet**: csak JSON, méretkorláttal (64 KB, import 4 MB); minden mezőt a közös séma (`src/engine/catalog.ts`) ellenőriz, ugyanaz, amelyet az admin oldal és az alkalmazás is használ.
- **Válaszfejlécek**: `Cache-Control: no-store`, `nosniff`, `default-src 'none'` CSP az API-n; CORS csak az engedélyezett originekre (a nyilvános katalógus bárhonnan olvasható).
- **Napló**: belépések, sikertelen próbálkozások, jogosultság-megtagadások, változások, importok, közzétételek (a tulajdonos látja). Megőrzés: egy év, a visszajelzések szintén; a kiküldött levelek másolata egy nap.
- **Ami még hátravan az éles indulás előtt**: független behatolásteszt, az e-mail-kézbesítés éles beállítása, adatbázis-mentés és -visszaállítás próbája, adatfeldolgozási szerződés a kertészetekkel. Nagyobb terheléshez a tárolórétegek (`server/accounts.ts`, `server/catalogRepo.ts`) PostgreSQL-re cserélhetők; az útvonalak nem változnak.

## API (v1)

Nyilvános:

| Metódus, út | Leírás |
|---|---|
| `GET /api/v1/health` | Állapot. |
| `GET /api/v1/t/{kertészet}/catalog/version` | A kertészet neve, a közzétett változat száma és ideje. |
| `GET /api/v1/t/{kertészet}/catalog/changes?since=N` | Az N. változat óta változott fajok (`species`) és a törölt fajok (`deleted: true`); `since=0` a teljes katalógus. |
| `POST /api/v1/feedback` | Visszajelzés (`kind`, `text`, `tech`), IP-nként korlátozva. |
| `POST /api/v1/auth/request` | Belépési kód kérése (`tenant`, `email`). |
| `POST /api/v1/auth/verify` | Belépés (`tenant`, `email`, `code`, ha kell `totp`) → `token`. |

Bejelentkezve (`Authorization: Bearer <token>`), a legkisebb szereppel:

| Metódus, út | Szerep | Leírás |
|---|---|---|
| `GET /api/v1/me` | megtekintő | A saját fiók és a kertészet. |
| `POST /api/v1/me/totp/setup`, `/enable` | megtekintő | Hitelesítő alkalmazás beállítása. |
| `POST /api/v1/auth/logout` | megtekintő | Kilépés. |
| `GET /api/v1/admin/species[/{kód}]` | megtekintő | A piszkozat fajai, a közzétételre váró változások. |
| `PUT /api/v1/admin/species/{kód}` | szerkesztő | Faj létrehozása vagy módosítása (ajánlatok cserépméretenként). |
| `DELETE /api/v1/admin/species/{kód}` | szerkesztő | Faj törlése a piszkozatból. |
| `POST /api/v1/admin/import/preview` | szerkesztő | Árlista előnézete (`rows`: a táblázat sorai, `mapping`: oszlopok) soronkénti eredménnyel. |
| `POST /api/v1/admin/import/commit` | szerkesztő | Az árlista hibátlan sorainak alkalmazása egy tranzakcióban. |
| `GET /api/v1/admin/publish` | megtekintő | Mi változna közzétételkor. |
| `POST /api/v1/admin/publish` | szerkesztő | Közzététel új változatként. |
| `GET/POST /api/v1/admin/users`, `PATCH/DELETE /api/v1/admin/users/{id}` | tulajdonos | Munkatársak. |
| `GET /api/v1/admin/audit` | tulajdonos | Biztonsági napló (utolsó 200 bejegyzés). |

Hibák: `{ "error": "…" }` a megfelelő HTTP-kóddal (400, 401, 403, 404, 409, 413, 415, 429 `Retry-After`-rel).
