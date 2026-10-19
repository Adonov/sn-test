# Forkful 🍲

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
- **8 jezikov** – angleščina, nemščina, španščina, francoščina, italijanščina, portugalščina, slovenščina in hrvaščina.
  Jezik se izbere po nastavitvah naprave in ga lahko spremeniš v »Več«. Prepoznavanje sestavin, enot (EL, cucharada,
  c. à soupe …), razdelkov receptov, časovnikov in oddelkov trgovine deluje v vseh teh jezikih. Prevodi so v
  `src/i18n/locales/`; nov jezik dodaš z novo datoteko po vzoru `en.ts`.
- **Samodejno prevajanje receptov** – ko zamenjaš jezik, se vsi recepti (tudi uvoženi in tvoji) prikažejo v
  izbranem jeziku. Prevaja Claude (Anthropic) na strežniku (`server/translate.js`); prevodi se shranijo na napravi,
  zato se vsak recept v posamezen jezik prevede samo enkrat. Izvirnik ostane shranjen. Vzorčni recepti imajo
  ročno napisane prevode.
- **Računi in sinhronizacija** (neobvezno) – prijava z e-pošto in geslom prek [Supabase](https://supabase.com);
  recepti, načrt in nakupovalni seznam se sinhronizirajo med napravami. Ob prvi prijavi se podatki z naprave
  združijo s podatki računa. Račun lahko izbrišeš v aplikaciji (zahteva App Store).
- **Videi v receptu** – YouTube, TikTok, Instagram Reels, Vimeo ali neposredna povezava do videa se predvajajo
  znotraj recepta. Pri uvozu se video doda samodejno, če ga stran ali objava vsebuje.

## Zagon

Potreben je Node.js 20 ali novejši.

```bash
npm install
npm run dev      # razvojni strežnik na http://localhost:5173
npm test         # testi
npm run build    # produkcijska različica v dist/
npm start        # produkcijski strežnik (PORT, privzeto 3000)
```

## Mobilni aplikaciji (iOS in Android)

Aplikacija je s [Capacitorjem](https://capacitorjs.com/) zapakirana v izvorni aplikaciji za iOS (`ios/`) in
Android (`android/`). Koda je ena sama – spletni del se ob vsaki gradnji skopira v obe aplikaciji.

Kaj se v aplikacijah razlikuje od spletne različice:

- **Uvoz s povezave deluje brez strežnika** – telefon stran prenese sam (`CapacitorHttp`).
- **Podatki so shranjeni v datoteki** v prostoru aplikacije (iOS lahko briše podatke brskalnika).
- **»Deli → Forkful« na Androidu** – povezavo iz Instagrama, TikToka ali brskalnika deliš neposredno v aplikacijo.
- **»Prilepi in uvozi«** – kopirana povezava se uvozi z enim dotikom (tudi na iOS).
- Zaslon med kuhanjem ostane prižgan, nakupovalni seznam se deli z izvornim menijem »Deli«.

### Gradnja

```bash
npm install
npm run android   # zgradi, sinhronizira in odpre projekt v Android Studiu
npm run ios       # isto za Xcode (potreben je Mac z Xcode 26+)
```

V Android Studiu / Xcodu nato izbereš napravo ali simulator in pritisneš ▶︎. Po spremembah spletne kode zadošča
`npm run cap:sync`.

GitHub Actions (`.github/workflows/mobile.yml`) ob vsakem pushu zgradi Android APK (za namestitev na telefon) in
iOS različico za simulator; obe najdeš med »Artifacts« pri posameznem zagonu.

### Objava v trgovinah

Celoten postopek (strežnik na Renderju, App Store, Google Play, besedila za trgovini in odgovori na vprašalnike o
zasebnosti) je v **[docs/OBJAVA.md](docs/OBJAVA.md)**. Politika zasebnosti je v `public/privacy.html`.

### Še ni narejeno

- **»Deli → Forkful« na iOS** zahteva Share Extension, ki jo je treba dodati v Xcodu (vtičnik
  `@capgo/capacitor-share-target` je že nameščen). Do takrat na iOS deluje »Kopiraj povezavo« → »Prilepi in uvozi«.
- Sinhronizacija med napravami (zahteva uporabniške račune in strežnik).

## Nastavitev prevajanja

1. Ustvari API ključ na [console.anthropic.com](https://console.anthropic.com) (plačljivo po porabi).
2. Kopiraj `.env.example` v `.env` in vpiši `ANTHROPIC_API_KEY=…`.
3. Za iPhone simulator v `.env` nastavi tudi `VITE_API_URL=http://localhost:5173`, pusti `npm run dev`
   zagnan in nato zaženi `npm run build && npx cap sync ios`.
4. Za objavljeno aplikacijo mora strežnik (`npm start`) teči na javnem https naslovu; tega vpišeš v `VITE_API_URL`
   pred gradnjo aplikacije.

Brez ključa aplikacija deluje normalno, recepti pa ostanejo v izvirnem jeziku.

## Nastavitev računov (Supabase)

1. Na [supabase.com](https://supabase.com) ustvari brezplačen projekt.
2. **SQL Editor → New query**: prilepi vsebino `supabase/schema.sql` in klikni **Run**.
3. **Project Settings → API**: v `.env` vpiši `VITE_SUPABASE_URL` (Project URL) in `VITE_SUPABASE_ANON_KEY`
   (ključ *anon* / *publishable* – ta je namenjen javni rabi; ključa *service_role* nikoli ne vpisuj v aplikacijo).
4. `npm run build && npx cap sync ios`.

Brez teh nastavitev aplikacija deluje kot prej, samo brez računov.

## Zgradba

| Mapa | Vsebina |
| --- | --- |
| `src/pages` | Zasloni: knjižnica, recept, urejevalnik, uvoz, način kuhanja, načrt, nakupi, nastavitve |
| `src/lib` | Razčlenjevanje sestavin in porcij, nakupovalni seznam, shramba stanja (localStorage) |
| `shared/recipeParsing.js` | Prepoznavanje receptov iz HTML (JSON-LD, OpenGraph) in prostega besedila – uporabljata ga strežnik in brskalnik |
| `server` | `/api/import` (prenos strani z zaščito pred dostopom do zasebnih omrežij) in strežnik za `dist/` |
| `android`, `ios` | Izvorna projekta (Capacitor) – ikone in zaslon ob zagonu so generirani iz `assets/` |
| `tests` | Vitest testi za razčlenjevanje, preračun porcij in nakupovalni seznam |

## Možne nadgradnje

- Uporabniški računi in sinhronizacija med napravami (npr. Supabase/Firebase).
- Prepoznavanje receptov iz videa ali fotografij z AI modelom (npr. Claude) za objave brez opisa.
- Mobilna aplikacija (React Native/Capacitor) s »Deli z aplikacijo« iz Instagrama in TikToka.
- Hranilne vrednosti in deljenje zbirk receptov s prijatelji.
