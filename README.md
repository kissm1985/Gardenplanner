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
- [ ] 4. fázis – Szabálymotor, rögzített elemek
- [ ] 5. fázis – Növénylista
- [ ] 6. fázis – Évszaknézet
- [ ] 7. fázis – Változatok
- [ ] 8. fázis – Menetrend, gondozás
- [ ] 9. fázis – Export, megosztás, finomhangolás
