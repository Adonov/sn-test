# Sonar

Iskalnik podobnih komadov za DJ-je. Spustiš komad ali cel DJ set,
program posluša dejanski zvok in najde najbolj podobne komade. Teče na tvojem računalniku, zato ni naročnine
ne kreditov.

## Zagon

Potrebuješ Python 3.10+ in ffmpeg (na Macu `brew install ffmpeg`). Vse ostalo, tudi deno za YouTube, namesti `start.sh`.

```bash
cd sonar
./start.sh
```

Prvi zagon namesti knjižnice (nekaj minut), nato se odpre `http://localhost:8765`.
Podatki so v `~/.sonar` (drugo mapo nastaviš z `SONAR_HOME=/pot ./start.sh`).

## Najprej zgradi katalog

Plačljive storitve iščejo po milijonih komadov. Tukaj je katalog tvoj in ga zgradiš v zavihku **Collection**:

1. **Connect collection** – poveži svoje račune. Sonar prebere javno zbirko, analizira vsak komad in ga označi
   z **IN YOUR COLLECTION**. Gumb *Sync* kasneje doda nove komade.
   - **Bandcamp** – uporabniško ime (bandcamp.com/*ime*): vsa kupljena glasba.
   - **SoundCloud** – uporabniško ime (tvoji všečki) ali povezava do profila/playliste.
   - **YouTube** – povezava do javne playliste ali kanala.
   - **Discogs** – uporabniško ime: plošče iz tvoje zbirke prek YouTube posnetkov, ki so pripeti k izdajam
     (če jih ni, isti album z Deezerja). Za zasebno zbirko vpiši še
     [osebni token](https://www.discogs.com/settings/developers).
   - **Mixcloud** – uporabniško ime: komadi iz priljubljenih.
2. **Tvoja glasba** – pot do mape na računalniku (npr. Rekordbox/Serato/Traktor knjižnica). Datoteke ne zapustijo
   računalnika.
3. **Discover** – razširi katalog s česarkoli, vsako v svojo vrstico:
   - ime izvajalca: najbolj poslušani komadi z Deezerja in sorodni izvajalci (ali iskanje na SoundCloudu/YouTubu),
   - `label:Innervisions`, `q:minimal house`,
   - povezava do komada, playliste, profila, založbe ali albuma na SoundCloudu, YouTubu, Bandcampu, Mixcloudu,
     Beatportu, Audiomacku ali Deezerju.

Miksi, daljši od 15 minut, ne gredo v katalog. Sete analiziraš na strani **Sets**: spusti datoteko ali prilepi
povezavo (SoundCloud, Mixcloud, YouTube …).

Hitrost je približno 1 komad na sekundo na jedro procesorja, torej 10.000 komadov v slabi uri na 8 jedrih.
Isto lahko poženeš iz ukazne vrstice:

```bash
.venv/bin/python -m sonar import ~/Music/DJ
.venv/bin/python -m sonar crawl "Octave" "Ricardo Villalobos" "label:Perlon" --max 5000
```

## Kaj zna

- **Dig** – za katerikoli komad (naložen ali iz kataloga) do 200 najbližjih po zvoku, z odstotkom ujemanja in
  razčlenitvijo na *rhythm / bass / texture / atmosphere*. Filter po tempu (± 3/6/10 %, upošteva tudi
  half-/double-time), BPM in tonaliteta v Camelot zapisu.
- **Sets** – DJ set (daljši od 12 minut) se razreže na odseke, približno en komad na odsek. Za vsak odsek
  pokaže najbližji komad (*TRACK ID FOUND*, če je skoraj enak, sicer *CLOSEST WE FOUND*) in še 4 podobne.
  Predvajalnik seta skoči na odsek, ki ga klikneš. Dodatno: podobni komadi celemu setu in podobni seti.
- **Collection** – všečkani (♥) in shranjeni (🔖) komadi ter iskanje po katalogu.
- **Playlists** – seznami z izvozom v M3U za Rekordbox, Serato in Traktor.
- **Predvajalnik** s tipkami: ↓ naslednji, ↑ prejšnji, presledek predvajaj, ←/→ preskok, L všečkaj,
  S shrani, »Start at 25 %« preskoči intro.
- **Buy** – iskanje komada na Bandcampu, Beatportu, Junu, Discogsu in YouTubu.

## Kako deluje

Iz vsakega komada vzamemo tri 30-sekundne izseke iz sredine in izračunamo ~120 zvočnih značilk
(`sonar/features.py`):

| skupina    | kaj meri                                                                    |
|------------|------------------------------------------------------------------------------|
| rhythm     | vzorec groova na šestnajstinkah (neodvisen od tempa), tempo, delež tolkal     |
| bass       | energija sub/bas/nizkih srednjih, groove basa                                |
| texture    | barva zvoka (MFCC), spektralni kontrast, svetlost, šumnost                   |
| atmosphere | harmonska vsebina (neodvisna od tonalitete), dur/mol, dinamika, »zrak«       |

Značilke so normalizirane glede na tvoj katalog, podobnost pa je utežena kosinusna razdalja. Seti se analizirajo
v 30-sekundnih oknih, ki jih združujemo, dokler ne ostane približno en odsek na 5 minut.

## Omejitve (pošteno)

- Kakovost je odvisna od velikosti in izbire kataloga. 2.000 dobro izbranih komadov v tvojem žanru je boljših
  od 50.000 naključnih.
- Značilke so klasična obdelava signala, ne nevronska mreža. Za techno, house, DnB in breaks dobro ločijo
  groove in zvok, ne razumejo pa »vibe-a« tako dobro kot velik model, naučen na milijonih komadov.
- *TRACK ID FOUND* ni pravo prepoznavanje (kot Shazam), ampak zelo visoka podobnost.
- Deezer predposlušanja so za osebno rabo. Javno objavljanje tega kataloga ni dovoljeno.
- Glasbo s SoundClouda, YouTuba, Bandcampa in Mixclouda bere [yt-dlp](https://github.com/yt-dlp/yt-dlp). Datoteke
  se po analizi zbrišejo, predvajanje gre v živo s platforme. Platforme pogosto spreminjajo strani, zato `start.sh`
  ob vsakem zagonu posodobi yt-dlp. Uporaba je na tvojo odgovornost in v skladu s pogoji posamezne platforme.
- Spotify, Apple Music in Beatport ne dajo zvoka zunanjim programom (Beatport le posamezne komade), zato tam
  zbirke ni mogoče povezati.

## Testi

```bash
.venv/bin/pip install pytest httpx
.venv/bin/python -m pytest tests
```

Testi ustvarijo sintetične komade v petih slogih in preverijo iskanje, nalaganje, razrez seta, sezname in
zajem z Deezerja (s ponarejenim API-jem).
