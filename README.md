# Kerttervező

Mobilbarát, offline is működő ültetéstervező (PWA). A specifikáció: [SPEC.md](SPEC.md).

```bash
npm install
npm run dev        # fejlesztői szerver
npm test           # egységtesztek (Vitest)
npm run test:e2e   # Playwright smoke teszt mobil nézetben
npm run build      # statikus build a dist/ mappába (Netlify / Vercel / GitHub Pages)
```

## Állapot

- [x] 1. fázis – Alap: projekt, területek, SVG vászon cm-ben, nagyítás/mozgatás, IndexedDB mentés, PWA
- [x] 2. fázis – Növények: adatbázis (30 faj), paletta, elhelyezés, mozgatás, lasszó, visszavonás
- [x] 3. fázis – Gyors ültetés: folt (eltolt/négyzetes rács), egyenes sor, ív, automatikus darabszám
- [x] 4. fázis – Szabálymotor (12 szabály, elnémítás, ugrás), rögzített elemek húzása és szerkesztése
- [x] 5. fázis – Növénylista: összesítő és területenkénti tábla, tartalék, árak, státuszok, másolás (szöveg/Excel), CSV, XLSX, megosztás
- [x] 6. fázis – Évszaknézet: négy évszak + havi csúszka, virágzó fajok, négy évszak egymás mellett
- [x] 7. fázis – Változatok: másolás, átnevezés, választott, összehasonlítás (darab, költség, figyelmeztetés, évszak)
- [x] 8. fázis – Ültetési menetrend (pipálható, napokra bontva), gondozási naptár Győrre, mulcsajánlás
- [ ] 9. fázis – Export, megosztás, finomhangolás
