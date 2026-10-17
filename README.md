# Receptko 🍲

Aplikacija za recepte v slogu [ReciMe](https://www.recime.app/): shrani recepte s spleta in družbenih omrežij,
načrtuj obroke za cel teden in iz načrta samodejno sestavi nakupovalni seznam.

## Funkcije

- **Uvoz receptov s povezave** – strežnik prebere stran in poišče podatke o receptu (schema.org `Recipe`, ki ga
  uporablja večina kulinaričnih blogov). Pri objavah z Instagrama/TikToka poskusi razčleniti opis objave.
- **Uvoz iz besedila** – prilepi opis objave ali besedilo recepta; sestavine, koraki, naslov in #oznake se
  prepoznajo samodejno (slovenski in angleški naslovi razdelkov, oštevilčeni koraki, alineje …).
- **Knjižnica receptov** – iskanje po imenu, sestavinah in oznakah, filtri po oznakah, priljubljeni recepti,
  lastne fotografije.
- **Prilagajanje porcij** – količine se preračunajo (ulomki, decimalke, razponi kot »2–3 jajca«).
- **Način kuhanja** – korak za korakom z velikimi črkami, zaslon ostane prižgan, samodejni časovniki iz besedila
  (»peci 45 minut« → gumb za časovnik).
- **Tedenski načrt obrokov** – zajtrk, kosilo, večerja, prigrizek; število porcij za vsak obrok.
- **Nakupovalni seznam** – sestavine iz receptov ali celotnega tedna se združijo (500 g + 1 kg moke = 1 ½ kg),
  razvrstijo po oddelkih trgovine, delijo ali kopirajo.
- **Brez prijave** – podatki so shranjeni v brskalniku; izvoz/uvoz varnostne kopije v JSON.
- **PWA** – aplikacijo lahko na telefonu dodaš na začetni zaslon; deluje tudi brez povezave.

## Zagon

Potreben je Node.js 20 ali novejši.

```bash
npm install
npm run dev      # razvojni strežnik na http://localhost:5173
npm test         # testi
npm run build    # produkcijska različica v dist/
npm start        # produkcijski strežnik (PORT, privzeto 3000)
```

## Zgradba

| Mapa | Vsebina |
| --- | --- |
| `src/pages` | Zasloni: knjižnica, recept, urejevalnik, uvoz, način kuhanja, načrt, nakupi, nastavitve |
| `src/lib` | Razčlenjevanje sestavin in porcij, nakupovalni seznam, shramba stanja (localStorage) |
| `shared/recipeParsing.js` | Prepoznavanje receptov iz HTML (JSON-LD, OpenGraph) in prostega besedila – uporabljata ga strežnik in brskalnik |
| `server` | `/api/import` (prenos strani z zaščito pred dostopom do zasebnih omrežij) in strežnik za `dist/` |
| `tests` | Vitest testi za razčlenjevanje, preračun porcij in nakupovalni seznam |

## Možne nadgradnje

- Uporabniški računi in sinhronizacija med napravami (npr. Supabase/Firebase).
- Prepoznavanje receptov iz videa ali fotografij z AI modelom (npr. Claude) za objave brez opisa.
- Mobilna aplikacija (React Native/Capacitor) s »Deli z aplikacijo« iz Instagrama in TikToka.
- Hranilne vrednosti in deljenje zbirk receptov s prijatelji.
