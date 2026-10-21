# Objava aplikacije Taisty

Vrstni red: **1. strežnik → 2. Supabase za produkcijo → 3. produkcijska gradnja → 4. App Store → 5. Google Play.**

---

## 1. Strežnik na Renderju (prevajanje, spletna različica, politika zasebnosti)

1. Na [render.com](https://render.com) se prijavi z GitHub računom (Adonov).
2. **New → Blueprint** → izberi repozitorij `Adonov/sn-test` → Render prebere `render.yaml`.
3. Vpiše te za tri skrivne vrednosti:
   - `ANTHROPIC_API_KEY` – nov ključ iz Claude Console (ne tisti, ki je bil na posnetku zaslona),
   - `VITE_SUPABASE_URL` in `VITE_SUPABASE_ANON_KEY` – iste kot v tvoji `.env`.
4. **Apply**. Prva gradnja traja nekaj minut. Na vrhu storitve se prikaže naslov, npr.
   `https://taisty.onrender.com`.
5. Preveri:
   - `https://taisty.onrender.com/api/health` → `{"ok":true}`
   - `https://taisty.onrender.com/privacy.html` → politika zasebnosti
   - `https://taisty.onrender.com` → spletna različica aplikacije

Načrt `starter` (~7 $/mesec) je vedno prižgan. Na `free` strežnik po 15 minutah nedejavnosti zaspi in prvi
prevod traja ~30 sekund – za testiranje je to v redu, za objavo priporočam `starter`.

**Zaščita stroškov:** strežnik dovoli največ 60 prevodov na 10 minut na napravo in 300 na dan skupaj
(`MAX_TRANSLATIONS_PER_DAY` v nastavitvah Renderja). V Claude Console pod **Limits** nastavi še mesečno
omejitev porabe.

### V politiko zasebnosti vpiši svoj kontakt
V `public/privacy.html` zamenjaj vse `CONTACT_EMAIL` s svojim e-naslovom za podporo in spremembo pošlji
na GitHub – Render se posodobi sam.

---

## 1b. Povezava s Stravo (neobvezno)

1. Prijavi se na [strava.com/settings/api](https://www.strava.com/settings/api) in ustvari aplikacijo:
   - **Application Name**: Taisty, **Category**: Training, **Website**: `https://taisty.onrender.com`
   - **Authorization Callback Domain**: `taisty.onrender.com` (za preizkus v simulatorju na Macu: `localhost`)
   - naloži ikono aplikacije.
2. **Client ID** in **Client Secret** vpiši v Render (**Environment**): `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` in
   `STRAVA_CALLBACK_DOMAIN=taisty.onrender.com`. Za simulator jih dodaj v `.env` (s `STRAVA_CALLBACK_DOMAIN=localhost`).
   Skrivnost (Client Secret) ostane samo na strežniku – v aplikaciji je ni.
3. ⚠️ **Omejitev športnikov:** nova Strava aplikacija sprva dovoli povezavo **samo tvojemu računu**. Pred objavo
   v [Strava Developer Program](https://developers.strava.com/) zaprosi za večjo kapaciteto (pregled traja nekaj
   tednov). Do takrat lahko Stravo preizkušaš samo ti; drugi uporabniki še vedno dobijo vadbe prek Apple Health /
   Health Connect.
4. **Smernice blagovne znamke:** pred oddajo gumb »Connect with Strava« in napis »Powered by Strava« zamenjaj z
   uradnima slikama s [developers.strava.com/guidelines](https://developers.strava.com/guidelines/).
5. **Pogoji Strave:** podatkov iz Strave ne smemo pošiljati v AI modele. Trener v Taisty dela na napravi s pravili
   (brez AI), zato je to v redu – tako naj tudi ostane.

---

## 2. Supabase za produkcijo

- **Authentication → Sign In / Providers → Email**: ponovno vklopi **Confirm email**.
- **Authentication → URL Configuration → Site URL**: `https://taisty.onrender.com`
  (sem vodi povezava za potrditev e-pošte).
- **Authentication → Emails** (neobvezno): prevedi besedila e-pošte v slovenščino/angleščino.

---

## 3. Produkcijska gradnja aplikacije

V `.env` zamenjaj naslov strežnika:

```
VITE_API_URL=https://taisty.onrender.com
```

nato:

```bash
npm run build
npx cap sync
```

Pred vsako novo oddajo povečaj številko različice:
- **iOS** (Xcode → App → General): *Version* `1.0` → `1.1`, *Build* `1` → `2` – enako tudi pri cilju
  **TaistyWidget** (pripomoček mora imeti isto številko kot aplikacija)
- **Android** (`android/app/build.gradle`): `versionCode 1` → `2`, `versionName "1.0"` → `"1.1"`

---

## 4. Apple App Store

### Enkratna priprava
1. **Apple Developer Program**: [developer.apple.com/programs](https://developer.apple.com/programs) → Enroll
   (99 $/leto, potrditev 1–2 dni).
2. **Identifiers**: [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers)
   → **+** → App IDs → App → Bundle ID `com.taisty.app` (če je zaseden, izberi npr. `com.adonov.taisty`
   in ga enako nastavi v Xcodu in `capacitor.config.ts`).
3. **App Store Connect** → [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps → + → New App**:
   platforma iOS, ime *Taisty* (če je zasedeno, npr. *Taisty – Recipe Keeper*), primarni jezik, Bundle ID,
   SKU `taisty`.

4. **App Group** (za pripomočke na začetnem zaslonu): [Identifiers](https://developer.apple.com/account/resources/identifiers)
   → **+** → *App Groups* → `group.com.taisty.app`. Nato odpri App ID `com.taisty.app` in vklopi **App Groups**
   (izberi to skupino) ter **HealthKit**. Ustvari še drugi App ID `com.taisty.app.widget` (pripomoček) z vklopljenim
   **App Groups** (ista skupina).

### Nalaganje
1. `npx cap open ios`
2. Xcode → **App → Signing & Capabilities** → *Team*: tvoj plačljivi račun, obkljukano *Automatically manage signing*.
   Enako naredi za cilj **TaistyWidget** (levo zgoraj izberi cilj). Če Xcode javi napako za App Group/HealthKit, klikni
   **Try Again** ali v *Signing & Capabilities* odstrani in ponovno dodaj **App Groups** / **HealthKit** – Xcode jih tako
   registrira sam.
3. Zgoraj izberi **Any iOS Device (arm64)**.
4. **Product → Archive** → ko se odpre *Organizer*: **Distribute App → App Store Connect → Upload**.
5. Čez ~15 minut je gradnja v App Store Connect pod **TestFlight** – namesti jo na svoj iPhone z aplikacijo
   TestFlight in preizkusi.

### Podatki za pregled
- **Posnetki zaslona**: v simulatorju **iPhone 17 Pro Max** (ali največjem, ki ga imaš) naredi 3–6 posnetkov s
  **Cmd + S** (knjižnica, recept, način kuhanja, načrt, nakupovalni seznam).
- **Privacy Policy URL**: `https://taisty.onrender.com/privacy.html`
- **Support URL**: `https://taisty.onrender.com/privacy.html#contact`
- **Age rating**: odgovori »None« povsod → 4+.
- **App Review Information → Notes**: »An account is optional. All features work without signing in.
  To test sync, create an account in More → Account. Apple Health: More → Apple Health → Connect. The app only reads
  steps, workouts and weight and writes nothing. Widgets: long-press the home screen → + → Taisty.«

### App Privacy (vprašalnik v App Store Connect)
| Podatek | Zbran? | Povezan z uporabnikom | Sledenje | Namen |
| --- | --- | --- | --- | --- |
| Contact Info → Email Address | Da (samo z računom) | Da | Ne | App Functionality |
| User Content → Other User Content (recepti) | Da | Da | Ne | App Functionality |
| User Content → Photos | Da (fotografije receptov z računom; fotografije obrokov za oceno AI) | Da | Ne | App Functionality |
| Health & Fitness → Health (prehranski dnevnik, teža) | Da (samo z računom) | Da | Ne | App Functionality |
| Health & Fitness → Fitness (koraki, vadbe iz Apple Health) | Ne – ostane na napravi | | | |
| Vse ostalo (lokacija, analitika, oglasi …) | Ne | | | |

Nato **Add for Review → Submit**. Pregled običajno traja 1–3 dni.

---

## 5. Google Play

### Enkratna priprava
1. **Play Console**: [play.google.com/console](https://play.google.com/console) → račun razvijalca (25 $ enkratno,
   potrebna je potrditev identitete).
2. ⚠️ **Novi osebni računi** morajo pred javno objavo izvesti **zaprto testiranje z vsaj 12 testerji 14 dni
   zapored**. Testerje dodaš z e-naslovi (prijatelji, družina), aplikacijo dobijo prek povezave v Trgovini Play.
3. **Create app** → ime *Taisty*, brezplačna, aplikacija.

### Podpisan paket
1. Namesti [Android Studio](https://developer.android.com/studio), nato `npx cap open android`.
2. **Build → Generate Signed App Bundle or APK → Android App Bundle → Create new keystore**.
   - Datoteko `.jks` in gesli **shrani varno** (npr. v Keychain in na USB). Brez njih ne moreš izdati posodobitve.
   - Ne dodajaj je v Git.
3. Izberi **release** → nastane `android/app/release/app-release.aab`.
4. Play Console → **Testing → Closed testing → Create release** → naloži `.aab` (Google ponudi *Play App Signing* – sprejmi).

### Health Connect (obvezno, ker aplikacija bere zdravstvene podatke)
Play Console → **App content → Health apps**: označi kategorijo *Fitness / Nutrition* in pri vsakem dovoljenju
(Steps, Exercise, Active calories burned, Weight) vpiši namen, npr. »Shows daily steps and adds workout calories to
the user's calorie goal; imports weight from smart scales into the weight log.« Google pregleda obrazec pred objavo
(lahko traja nekaj dni). Druga dovoljenja Health Connect so v `AndroidManifest.xml` odstranjena.

### Obrazci v Play Console
- **Privacy policy**: `https://taisty.onrender.com/privacy.html`
- **Data safety**: zbira *Email address* (Account management, neobvezno), *Other user-generated content*
  (App functionality), *Photos* (ocena obroka z AI, se ne hrani), *Health info* (prehranski dnevnik in teža, samo z
  računom) in *Fitness info* (koraki in vadbe iz Health Connect – ostanejo na napravi, zato »not collected«); podatki
  so šifrirani med prenosom; uporabnik lahko zahteva izbris (v aplikaciji).
  Ne deli podatkov s tretjimi za oglaševanje.
- **Content rating**: vprašalnik → kategorija *Reference/Utility*, vse »No« → Everyone.
- **Target audience**: 13+ (ni namenjena otrokom).
- **Ads**: No ads.
- **Posnetki**: vsaj 2 posnetka telefona (lahko iz Android emulatorja ali kar iz iPhone simulatorja), ikona 512×512
  (`assets/icon-only.png` pomanjšana), grafika 1024×500.

## 6. Taisty Premium (naročnina)

Brez naročnine dobi uporabnik **5 AI ocen na teden** (fotografija, opis, hranila recepta, popravek). Premium
odklene neomejeno. Dokler ključev RevenueCat ni v `.env`, omejitve ni in stran *Premium* se ne prikaže.

> Pred tem morata biti v App Store Connect podpisana **Paid Apps Agreement** (Business → Agreements, z bančnim
> računom in davčnimi podatki), v Play Console pa **Payments profile**. Brez tega nakupi ne delujejo.

### 6a. Izdelki v trgovinah
**App Store Connect** → aplikacija Taisty → **Monetization → Subscriptions**:
1. **Create subscription group** → ime *Taisty Premium*.
2. V skupini dodaj dve naročnini:
   - *Reference name* `Premium monthly`, *Product ID* `taisty_premium_monthly`, trajanje **1 month**, cena npr. 4,99 €
   - *Reference name* `Premium yearly`, *Product ID* `taisty_premium_yearly`, trajanje **1 year**, cena npr. 29,99 €
3. Pri vsaki dodaj ime in opis (npr. »Unlimited AI meal estimates«) ter posnetek zaslona strani Premium (za pregled).
4. Neobvezno: **Introductory offer → Free trial 1 week**.

**Play Console** → **Monetize → Products → Subscriptions → Create subscription**:
- `taisty_premium_monthly` z osnovnim paketom (*base plan*) **monthly**, auto-renewing, 4,99 €
- `taisty_premium_yearly` z osnovnim paketom **yearly**, 29,99 €
- Vsak base plan **Activate**.

### 6b. RevenueCat
1. Račun na [app.revenuecat.com](https://app.revenuecat.com) (brezplačno do 2.500 $ mesečnega prihodka, nato 1 %).
2. **Create project** → *Taisty*.
3. **Apps → + App Store**: Bundle ID `com.taisty.app`, nato po navodilih naloži **In-App Purchase Key** (App Store
   Connect → Users and Access → Integrations → In-App Purchase → Generate).
4. **Apps → + Play Store**: package `com.taisty.app`, nato po navodilih naloži **service account JSON** iz Google
   Cloud (RevenueCat ima vodnik korak za korakom; aktivacija lahko traja do 36 ur).
5. **Product catalog → Entitlements → + New** → identifier **`premium`** (točno tako).
6. **Products → Import** iz obeh trgovin in vse štiri izdelke pripni na entitlement `premium`.
7. **Offerings → default** → dodaj paketa **Monthly** (`$rc_monthly`) in **Annual** (`$rc_annual`) z ustreznimi
   izdelki za iOS in Android. Offering `default` mora biti označen kot **Current**.
8. **API keys** → kopiraj *public* ključa (iOS se začne z `appl_`, Android z `goog_`) v `.env`:

```
VITE_REVENUECAT_IOS_KEY=appl_...
VITE_REVENUECAT_ANDROID_KEY=goog_...
```

To sta javna ključa (sta v aplikaciji), zato nista skrivnost. Nato `npm run build && npx cap sync`.

### 6c. Preizkus nakupa
- **iPhone**: App Store Connect → Users and Access → **Sandbox → Test accounts** → dodaj testni Apple ID. Na
  telefonu: Nastavitve → App Store → **Sandbox Account** → prijava. Nakup v aplikaciji je nato brezplačen, mesečna
  naročnina se podaljša vsakih 5 minut.
- **Android**: Play Console → Settings → **License testing** → dodaj svoj Gmail. Aplikacijo namesti iz zaprtega
  testiranja.
- V aplikaciji: Nastavitve → *Taisty Premium* → izberi paket → Nadaljuj. Po nakupu piše »Premium je vklopljen«.
  Preizkusi tudi **Obnovi nakupe** (izbriši aplikacijo, namesti znova).

### 6d. App Review
Apple zahteva na strani nakupa ceno, trajanje, samodejno podaljševanje ter povezavi na zasebnost in pogoje – vse to
stran Premium že prikazuje (pogoji so Applova standardna licenca EULA). V App Store Connect pri aplikaciji v polje
**License Agreement** pusti *Apple's Standard License Agreement*.

V **App Privacy** (Apple) in **Data safety** (Google) dodaj še *Purchases → Purchase history* (App functionality,
ni povezano z oglaševanjem) in *Diagnostics → Crash data* (poročila o napakah, ni povezano z uporabnikom).

---

## 7. Poročila o napakah

Ko v aplikaciji pride do nepričakovane napake, pošlje kratko poročilo strežniku (brez receptov, dnevnika ali
zdravstvenih podatkov). Najdeš jih na Renderju: **taisty → Logs** → v iskanje vpiši `[client-error]`. Če se ista
napaka ponavlja, mi kopiraj vrstico in jo popravim.

## 8. Natančnost AI ocen

Glej [`eval/README.md`](../eval/README.md): fotografiraš stehtane obroke, vpišeš prave vrednosti in zaženeš
`npm run eval:photos`.

---

## Besedila za trgovini

### English
- **Name**: Taisty
- **Subtitle** (iOS, max 30): AI calorie counter & recipes
- **Short description** (Android, max 80): Save recipes from any website or social post, plan meals, shop smarter.
- **Keywords** (iOS, max 100): recipe,recipes,meal planner,grocery list,cooking,recipe keeper,shopping list,food,cookbook
- **Description**:

  > Taisty keeps all your recipes in one calm, simple place.
  >
  > • Import recipes from any website, Instagram, TikTok or Pinterest – or paste the caption and Taisty finds the
  >   ingredients and steps for you.
  > • Change servings and every amount updates instantly.
  > • Cook step by step with large text, built-in timers and a screen that stays on.
  > • Plan your week and turn it into one grocery list, merged and sorted by aisle.
  > • Watch the recipe video right inside the recipe.
  > • Track calories, protein, carbs, fat, vitamins and minerals: scan a barcode, snap a photo of your meal or just
  >   describe it, and log a serving of any recipe with one tap.
  > • Get personal calorie and macro goals in a one-minute setup, track water and weight, and keep your streak going.
  > • Intermittent fasting timer with 12:12 to 20:4 plans, fasting stages and a history of your fasts.
  > • Connect Apple Health or Health Connect: steps, workout calories added to your goal, and your weight straight
  >   from a smart scale.
  > • A training coach that reads your recent runs and rides – after a 10 km race it suggests an easy spin
  >   instead of another run – and asks after long workouts whether you had gels or drinks, logging them in a tap.
  > • Gentle reminders for meals, water and weigh-ins – they skip themselves once you've logged.
  > • Home screen and lock screen widgets for calories left and your fasting timer.
  > • Plan your week and see each day's calories before you cook – then log planned meals with one tap.
  > • Use the app in English, German, Spanish, French, Italian, Portuguese, Slovenian or Croatian – recipes are
  >   translated automatically.
  > • Optional account to sync between your phone, tablet and computer.
  >
  > No ads. No tracking. Your recipes stay yours.

### Slovenščina
- **Podnaslov**: AI štetje kalorij in recepti
- **Kratek opis**: Shrani recepte s spleta in družbenih omrežij, načrtuj obroke in nakupuj pametneje.
- **Ključne besede**: recepti,recept,načrt obrokov,nakupovalni seznam,kuhanje,kuharska knjiga,hrana,nakupi
- **Opis**:

  > Taisty hrani vse tvoje recepte na enem mirnem, preprostem mestu.
  >
  > • Uvozi recepte s katerekoli spletne strani, Instagrama, TikToka ali Pinteresta – ali prilepi opis objave in
  >   Taisty sam najde sestavine in korake.
  > • Spremeni število porcij in vse količine se takoj preračunajo.
  > • Kuhaj korak za korakom z velikimi črkami, časovniki in zaslonom, ki ostane prižgan.
  > • Načrtuj teden in ga spremeni v en nakupovalni seznam, združen in razvrščen po oddelkih.
  > • Video recepta si oglej kar v receptu.
  > • Spremljaj kalorije, beljakovine, ogljikove hidrate, maščobe, vitamine in minerale: skeniraj črtno kodo,
  >   fotografiraj obrok ali ga samo opiši, porcijo recepta pa vpišeš z enim dotikom.
  > • Osebni cilji kalorij in makrohranil v minutni nastavitvi, sledenje vodi in teži ter niz zaporednih dni.
  > • Časovnik za intermitentno postenje z načrti od 12:12 do 20:4, fazami posta in zgodovino.
  > • Poveži Apple Health ali Health Connect: koraki, kalorije vadbe se prištejejo cilju, teža pa se vpiše kar s
  >   pametne tehtnice.
  > • Trener, ki pozna tvoje zadnje teke in vožnje – po 10-kilometrski tekmi predlaga lahkotno vrtenje na kolesu
  >   namesto novega teka – in po daljši vadbi vpraša, ali si imel/-a gele ali pijačo, ter jih vpiše z enim dotikom.
  > • Nežni opomniki za obroke, vodo in tehtanje – sami se preskočijo, ko že vpišeš.
  > • Pripomočki na začetnem in zaklenjenem zaslonu za preostale kalorije in časovnik posta.
  > • Načrtuj teden in že vnaprej vidi kalorije vsakega dne – načrtovane obroke nato vpišeš z enim dotikom.
  > • Aplikacijo uporabljaj v slovenščini, hrvaščini, angleščini, nemščini, italijanščini, španščini, francoščini ali
  >   portugalščini – recepti se prevedejo samodejno.
  > • Neobvezen račun za sinhronizacijo med telefonom, tablico in računalnikom.
  >
  > Brez oglasov. Brez sledenja. Tvoji recepti ostanejo tvoji.
