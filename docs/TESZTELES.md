# Zárt tesztelés: Cloudflare Pages + Cloudflare Access

A tervező alkalmazás egy https-címen fut, de csak azok nyithatják meg, akiknek az e-mail-címét felveszed a listára. Belépéskor a tesztelő az e-mail-címére kap egy egyszer használatos kódot, regisztráció és jelszó nélkül. 50 felhasználóig ingyenes.

A tervek továbbra is a tesztelők saját készülékén maradnak. A Cloudflare csak a fájlokat szolgálja ki, és beléptetéshez kezeli a tesztelők e-mail-címét.

## 1. Fiók

1. Regisztrálj a https://dash.cloudflare.com/sign-up oldalon (ingyenes).
2. A bal oldali menüben nyisd meg a **Zero Trust** részt. Első alkalommal válassz egy csapatnevet (pl. `planterra`), majd a **Free** csomagot. A Cloudflare ekkor bankkártyát kérhet, de az ingyenes csomag nem számol fel díjat.

## 2. Az alkalmazás feltöltése (Cloudflare Pages)

**A) Automatikusan, a GitHubról (ajánlott):** minden push után magától frissül.

1. Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**. Engedélyezd a `kissm1985/Gardenplanner` tárolót.
2. Beállítások:
   - **Project name:** pl. `planterra-teszt` → a cím `https://planterra-teszt.pages.dev` lesz.
   - **Production branch:** az az ág, amelyet tesztelni akarsz. Most `claude/k08-artifact-chapter-4-plan-k48w1z`, a beolvasztás után `main`.
   - **Framework preset:** *None*. **Build command:** `npm run build`. **Build output directory:** `dist`.
   - **Environment variables:** `NODE_VERSION` = `22`.
3. **Save and Deploy.** Néhány perc múlva kész.

**B) Kézzel, fájlfeltöltéssel:** a saját gépeden futtasd az `npm run build` parancsot. Ezután: **Workers & Pages** → **Create** → **Pages** → **Upload assets**, és húzd be a `dist` mappát. Új verziónál ugyanígy töltsd fel újra.

A biztonsági fejléceket a build `dist/_headers` fájlja adja, ezt a Cloudflare Pages automatikusan alkalmazza.

## 3. Hozzáférés korlátozása (Cloudflare Access)

**Ezt még az előtt állítsd be, hogy a címet bárkinek elküldenéd.**

1. **Zero Trust** → **Settings** → **Authentication** → **Login methods**: legyen bekapcsolva a **One-time PIN** (e-mailes kód).
2. **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**.
   - **Application name:** Planterra teszt.
   - **Session duration:** pl. *1 month*, hogy a tesztelőknek ne kelljen sűrűn belépniük.
   - **Application domain:** `planterra-teszt.pages.dev`. Vegyél fel egy második sort is: `*.planterra-teszt.pages.dev`. Ez védi az előnézeti (preview) címeket, mert minden feltöltésnek saját, külön címe is van.
3. **Policy**:
   - **Action:** *Allow*. **Include** → **Emails**: a tesztelők címei, egyenként.
   - Nagyobb körnél használhatsz **Emails ending in** szabályt is, pl. `@kerteszet.hu`.
4. Mentsd el. Ezután a cím megnyitásakor egy Cloudflare beléptető oldal jelenik meg, és csak a listán szereplő címekre megy ki kód.

**Ellenőrzés:** nyisd meg a címet privát böngészőablakban. Először a beléptető oldalnak kell megjelennie, az alkalmazás csak a kód beírása után töltődhet be. Próbáld ki egy előnézeti címmel is (a Pages projekt **Deployments** listájában találod).

## 4. Tesztelők kezelése

- **Új tesztelő:** Access → Applications → Planterra teszt → Policies → az e-mail-cím hozzáadása.
- **Hozzáférés visszavonása:** töröld a címet. Ha azonnal ki akarod léptetni: **Zero Trust** → **My Team** → **Users** → a felhasználó → **Revoke session**.
- **Ki lépett be:** **Zero Trust** → **Logs** → **Access**.

## 5. Mit küldj a tesztelőknek

> Szia! Meghívtalak a Planterra kerttervező zárt tesztjére: https://planterra-teszt.pages.dev
> A megnyitáskor add meg ezt az e-mail-címedet, és a kapott kóddal lépj be. Telefonon a böngésző menüjéből a kezdőképernyőre is teheted (Safari: Megosztás → Főképernyőhöz adás).
> A terveid csak a te készülékeden tárolódnak. Hibát, ötletet a ⋯ menü „Visszajelzés” pontjával küldhetsz.
> A beléptetéshez a Cloudflare kezeli az e-mail-címedet; a teszt végén törlöm a listáról.

## Tudnivalók

- **Telepített alkalmazás, offline mód:** első belépés után a tervező telepíthető, és offline is működik. Ha a belépés lejár (a *Session duration* után), a következő online megnyitáskor újra kódot kér.
- **Frissítés:** új verzió feltöltése után a megnyitott alkalmazás a következő indításkor magától frissül.
- **Profi katalógus:** ez a beállítás csak a tervezőt teszi elérhetővé. A kertészeti szerverhez (admin, katalógus) külön szerver kell, lásd [SZERVER.md](SZERVER.md).
