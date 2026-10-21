# Preverjanje natančnosti AI ocen s fotografije

Ta skripta pove, kako blizu so ocene AI pravim vrednostim. Tako lahko pošteno napišeš, kako
natančen je Taisty (in vidiš, ali se ocene po spremembah izboljšajo).

## 1. Zberi fotografije (20–50 obrokov)

1. Preden ješ, **stehtaj** vsako sestavino obroka (kuhinjska tehtnica).
2. Iz deklaracij ali tabel (npr. [OpenFoodFacts](https://world.openfoodfacts.org)) izračunaj
   kalorije, beljakovine, ogljikove hidrate in maščobe za ves obrok.
3. Obrok fotografiraj s telefonom, tako kot bi ga v aplikaciji (od zgoraj ali pod kotom).
4. Fotografije kopiraj v mapo `eval/photos/` (JPEG, PNG, WebP; na Macu tudi HEIC).

Izberi pestro mešanico: zajtrki, kosila, solate, testenine, sendviči, sladice, pijače.

## 2. Vpiši prave vrednosti

V mapi `eval/photos/` naredi datoteko `answers.csv` (primer: `answers.example.csv`):

```
file,kcal,protein,carbs,fat
kosilo-1.jpg,650,38,70,22
```

Lahko jo urediš tudi v Excelu ali Numbers in shraniš kot CSV.

## 3. Zaženi

V Terminalu v mapi projekta:

```
npm run eval:photos
```

Potrebuje `ANTHROPIC_API_KEY` v `.env`. **Vsaka fotografija je ena prava AI zahteva (približno
0,04 $)**, 50 fotografij torej stane okoli 2 $.

## 4. Preberi rezultat

```
Kalorije           odstopanje ±95 kcal (16 %), preceni za 4 %, znotraj ±20 %: 72 % fotografij
```

- **odstopanje**: povprečna razlika od prave vrednosti.
- **preceni/podceni**: ali se AI v povprečju moti navzgor ali navzdol.
- **znotraj ±20 %**: delež fotografij, kjer je ocena dovolj blizu.

Za primerjavo: tudi ljudje (in dietetiki) na oko kalorije obroka praviloma ocenijo z napako
okoli 20–40 %. Podrobnosti za vsako fotografijo so v `eval/photos/results.csv`.

Fotografije in rezultati se ne shranijo v git (mapa je v `.gitignore`).
