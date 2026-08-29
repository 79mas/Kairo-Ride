# Kairo Ride · 0.2

Tamsios temos PWA vienaračio ridai, pasivažinėjimams, kelionėms ir ekipuotei. Svetainė veikia **GitHub Pages**, asmeniniai duomenys – naršyklėje ir, prijungus paskyrą, **paties naudotojo Google Drive**. Atskiro duomenų serverio, Apps Script, Firebase ar mokamos duomenų bazės nereikia.

## Paleidimas

Visa instrukcija: [GITHUB_PALEIDIMAS.md](GITHUB_PALEIDIMAS.md).

1. Sukurk naują GitHub saugyklą `Kairo-Ride` ir įkelk šio paketo **turinį**, įskaitant `.github/workflows/deploy.yml`.
2. `Settings → Pages → Source → GitHub Actions`.
3. `Actions → Publish Kairo Ride → Run workflow`.
4. Sėkmingo publikavimo adresą rasi `Settings → Pages`.
5. Google Drive įjungiama atskirai, vieną kartą projekto savininkui nustačius Google OAuth. Kol kas `public/kairo-config.json` yra tuščias – vietinė programėlė ir eksportas veiks.

**Į GitHub nekelk savo Excel, JSON duomenų kopijų, GPX, nuotraukų, video ar Google paslapčių.** Šiame pakete asmeninių įrašų nėra. GitHub publikuoja tik programėlės failus.

## Sritys

| Skirtukas | Paskirtis |
| --- | --- |
| Apžvalga | Ridos santrauka, vienaračiai, naujausios kelionės |
| Odometras | Tikri rodmenys; atstumai tarp jų perskaičiuojami |
| Pasivažinėjimai | Atskiras išvažiavimas arba kelionės etapas, jo failai |
| Kelionės | Viena ar kelios dienos, pasivažinėjimai ir bendri priedai |
| Garažas | Vienaračiai su atskiromis odometro sekomis |
| Ekipuotė | Šalmai, avalynė, apsaugos, apranga, kameros, Cardo ir kiti priedai |

Ekipuotėje yra paieška, kategorijos ir būsenos filtrai. Kiekvienam daiktui galima įrašyti gamintoją, modelį, dydį, įsigijimo datą ir pastabas. Nebenaudojamą daiktą galima palikti archyve pakeitus būseną. Ekipuotė patenka į Drive, JSON kopiją ir Excel `Gear` lapą.

## Saugojimo principas

- Pakeitimai pirmiausia įrašomi į IndexedDB, kad dingęs ryšys nesustabdytų darbo.
- Google leidimas – tik `drive.file`. Prieigos žetonas laikomas lango atmintyje; `client_secret` nėra ir neturi būti.
- Drive aplanke `Kairo Ride` yra `database.json` ir `history` aplankas. Nekintami `history` įvykiai yra atkūrimo šaltinis; `database.json` – patogi sinchronizuotos istorijos kopija.
- Kelionių aplankai kuriami `Kelionės`, atskirų pasivažinėjimų – `Pasivažinėjimai` aplanke. Kelionei priskirtas pasivažinėjimas turi savo aplanką jos viduje. Aplankų pavadinimuose naudojama data, pavadinimas ir ID.
- Priedai įkeliami kaip originalūs failai. Programa jų neinterpretuoja ir pati neatlieka nuolatinio WheelLog ar Komoot paskyrų sinchronizavimo.
- Kitame įrenginyje reikia atverti **tą pačią svetainę**, prijungti **tą pačią Google paskyrą** ir sinchronizuoti.
- Vienalaikiai skirtingi to paties įrašo pakeitimai rodomi kaip konfliktas; nepakeičia vienas kito tyliai.

## Eksportas ir importas

`Duomenys ir saugojimas` leidžia atsisiųsti tikrą `.xlsx` arba JSON. Excel lapai: `Wheels`, `Readings`, `Rides`, `Trips`, `Gear`, `Attachments`, `History` ir `KairoInfo`.

**JSON / Excel nėra nuotraukų, video ar GPX originalų kopija.** Juose saugomi įrašai ir priedų metaduomenys bei Drive nuorodos. Dar neįkeltus originalus atsisiųsk atskirai arba pirma užbaik Drive sinchronizavimą.

Importuojami Kairo Ride JSON / Excel ir senos PWA `.xlsx` su `Rides` bei `Models` lapais. Rodmenys perkeliami kaip rodmenys, ne kaip išgalvoti pasivažinėjimai. Seni apskaičiuoti `Km` / `Total km` stulpeliai ignoruojami. Senasis mišrus `EUC.xlsx` reikalauja atskiro rankinio duomenų atskyrimo.

Pakartotinis tos pačios kopijos importas nedaugina įrašų. Kairo Excel atkūrimas skaito `History`: ranka pakeisti ataskaitų lapai nėra automatiškai paverčiami naujais įrašais. Duomenis keisk programėlėje.

## Ribos, kurias svarbu žinoti

- Tai pirmo etapo versija, ne baigtas viešas produktas. Tikras OAuth prisijungimas ir fizinių telefonų diegimas turi būti patikrinti po publikavimo.
- Vienas priedas gali būti iki **512 MB**, importo failas – iki **25 MB**. Naršyklės laisvos vietos gali būti mažiau.
- Įkelti originalai kol kas automatiškai nepašalinami iš vietinės kopijos. Telefonui trūkstant vietos, nedėk ilgų video, kol nepasirūpinai kopijomis.
- Uždarius ar užmigdžius PWA, didelio failo siuntimas gali nutrūkti. Grįžus ir atnaujinus Google prieigą, programa mėgina tęsti įkėlimą. Fono siuntimo negarantuojame.
- Google leidimas nėra amžinas prisijungimas. Pasibaigus laikinam žetonui reikės paspausti „Atnaujinti prieigą“. Vietiniai įrašai dėl to neprapuola.
- Įrašo pašalinimas išsaugomas istorijoje; priedo nuorodos pašalinimas neištrina Drive originalo. Visiškai išvalyti duomenis reikia atskirai savo Drive ir įrenginiuose.
- Vietinė kopija nėra užrakinta atskiru slaptažodžiu. Naudok asmeninį naršyklės profilį ir įrenginio užraktą.
- Nekintamų įvykių istorija ilgainiui auga. Labai dideliam archyvui dar reikės istorijos sutankinimo ir greitesnio pokyčių gavimo. Vienu metu pirmą kartą jungiant du įrenginius gali susidaryti papildomas Drive aplankas; prieš jungiant kitą įrenginį pirmame užbaik pradinį sinchronizavimą.
- Naujas domenas ar saugyklos kelias turi kitą vietinę saugyklą. Naršyklės duomenys tarp svetainių neperkeliami savaime.

## Vietinis vystymas

GitHub paketui naudojami React ir Vite; vykdymo serverio nėra. Rekomenduojamas Node.js 24; įprastam naudotojui jo nereikia.

```bash
npm ci
npm run dev
```

Statinė versija ir patikros:

```bash
npm run typecheck
npm run lint
npm test
npm run preview
```

`npm test` surenka projektą ir paleidžia domeno, IndexedDB, Excel, imituojamo Drive protokolo, komponentų bei statinio PWA paketo testus. Naršyklės ar fizinio telefono bandymo jie nepakeičia. Surinkti vieši failai – tik `dist/client`.

GitHub workflow automatiškai nustato `KAIRO_BASE_PATH` iš Pages adreso. Vietinis subkatalogo bandymas POSIX terminale:

```bash
KAIRO_BASE_PATH=/Kairo-Ride npm test
KAIRO_BASE_PATH=/Kairo-Ride npm run preview
```

Surinkimui taip pat galima nusikopijuoti `.env.example` į `.env.local` ir nustatyti jo reikšmes. Vietiniame `dev` režime Google ID nustatyk `public/kairo-config.json`.

Google ID galima nustatyti GitHub Actions kintamuoju `GOOGLE_CLIENT_ID` arba `public/kairo-config.json`. Vietiniam Google bandymui pridėk lokalų adresą prie OAuth leidžiamų JavaScript origins. Niekada nenaudok `file://` paleidimo.

## Failų žemėlapis

- `components/kairo` – programėlės ekranai ir formos.
- `lib/kairo` – duomenų modelis, istorija, IndexedDB, Drive ir Excel.
- `app/globals.css` – tamsi tema ir išdėstymas.
- `build/kairo-pwa.ts`, `build/pwa-worker.js` – versijuojama PWA talpykla.
- `public` – ikonėlės, manifestas, vieša OAuth konfigūracija ir privatumo aprašas.
- `.github/workflows/deploy.yml` – automatinis surinkimas, patikros ir publikavimas.
- `tests` – automatinės patikros su sintetiniais duomenimis.

Šis atskiras GitHub paketas neturi privataus prototipo talpinimo konfigūracijos, autentifikavimo ar duomenų serverio.
