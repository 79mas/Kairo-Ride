# Kairo Ride: paleidimas per GitHub

Versija 2.0.9.2 · 2026/09/09 · tikros failų būsenos, suprantamos klaidos ir atspari analitika

## Trumpai: atnaujinimas iš 2.0.9 ar ankstesnio paketo

1. Programėlėje atsisiųsk JSON atsarginę kopiją. Neįkeltus originalius priedus išsisaugok atskirai.
2. Išskleisk `Kairo-Ride-2.0.9.2.zip` ir įkelk **vidinio `Kairo-Ride` aplanko turinį** į tą pačią GitHub repozitorijos šaknį. Pasirink `Commit changes`. Senų katalogų prieš tai netrink.
3. Įkelk visus pakeistus bei naujus failus, įskaitant `components/kairo`, `hooks`, `lib/kairo`, `tests`, `build` ir `scripts`. `GOOGLE_CLIENT_ID` GitHub kintamasis ir OAuth nustatymai lieka tie patys. Jei ID įrašytas tiesiai į `public/kairo-config.json`, prieš perrašydamas išsisaugok jo reikšmę ir grąžink ją į naują failą.
4. Sulauk žalio `Actions → Publish Kairo Ride` rezultato. Atverk programėlę su internetu. Kai pasirodo pranešimas apie paruoštą versiją, pasirink `Review update → Update and restart`. Atnaujinimas aktyvuojamas tik visiškai atsisiuntus jo failus ir sukūrus vietinį atkūrimo tašką. Tai atlik **telefone ir kompiuteryje**. Apačioje turi būti **2.0.9.2**. Naršyklės duomenų nevalyk ir PWA neišdiek.
5. `Settings → Synchronization → Automatic sync` numatytai įjungtas. Jei prašoma, paspausk **Refresh access**. Esamos duomenų bazės iš naujo importuoti nereikia.

### Kas pasikeitė 2.0.9.2

- Visų vartotojui rodomų klaidų pagrindas dabar yra aiškus pavadinimas, paaiškinimas ir konkretus tolesnis veiksmas. Kodai, palaikymo numeriai ir techniniai pėdsakai palikti išskleidžiamoje diagnostikos dalyje.
- Analitikos metų palyginimo ašis sutvarkyta taip, kad nekeliamųjų metų vasario 29-oji būtų tuščia reikšmė, o ne visą skirtuką uždaranti `Invalid time value` klaida.
- Aktyvaus failo **Cancel upload** dabar nutraukia būtent jo tinklo užklausą. Vietinis originalas ir Google patvirtinta tęstinio įkėlimo vieta išlieka, todėl failą galima vėliau tęsti.
- Google patvirtintas `driveId` yra vienintelis galutinės įkėlimo būsenos šaltinis: patvirtintas failas visada rodomas kaip **Uploaded and confirmed — 100%**; pasenę 0 % skaitikliai pataisomi.
- Neišsami duomenų istorija pranešime įvardijama žmogui atpažįstamu objekto pavadinimu, o ne vidiniu UUID, ir aiškiai pasiūloma atkurti pilną JSON kopiją.
- Diagnostikos ataskaita išlaiko techninę informaciją ir suprantamą paaiškinimą, tačiau iš jos pašalintas stabilus Google paskyros vardų srities identifikatorius bei el. paštas.

- `Settings → Synchronization → Transfers` rodo kiekvieno failo būseną, procentus ir aiškų paaiškinimą. Galima pristabdyti, tęsti, kartoti arba išimti iš automatinės eilės neištrinant vietinės kopijos. Tęsiama nuo Google patvirtinto baito; pasirinktinai galima neleisti ekranui užmigti aktyvaus įkėlimo metu.
- `Settings → Diagnostics` tikrina visos aplikacijos duomenų bazę, saugyklą, sinchronizavimą, Drive jungtį, aplikacijos talpyklą ir versiją. Vietinis žurnalas turi incidentų kodus. Ataskaita pirmiausia parodoma peržiūrai, neperduodama automatiškai ir išvalo žetonus, sesijų adresus, Drive ID bei asmeninius failus.
- Vietiniai duomenys ir kiekviena Google paskyra laikomi atskirose erdvėse. Jungiant paskyrą aiškiai pasirenkama, ar į ją kopijuoti ankstesnius vietinius įrašus.
- Prieš duomenų migraciją, importą, atkūrimą ir aplikacijos atnaujinimą kuriamas atkūrimo taškas. Atkūrimas įrašomas kaip naujesnė istorijos versija, todėl Drive negali tyliai grąžinti atšauktos būsenos.
- Atnaujinimas pirmiausia pilnai atsisiunčiamas ir laukia vartotojo patvirtinimo. Aktyvų failo įkėlimą reikia užbaigti arba pristabdyti.
- Kritinės klaidos vietoje tuščio ekrano pateikia incidento kodą, perkrovimą, vietinės JSON kopijos ir diagnostikos ataskaitos veiksmus.
- Odometro sumažėjimas ar atstatymas reikalauja aiškaus patvirtinimo ir priežasties; ankstesnių datų įrašai leidžiami, jei nesugadina gretimų odometro įrašų sekos.
- Analitikoje pridėtos 30/90 dienų km/d tendencijos, 30/90 dienų km/sav. tempas, einamo ir trijų ankstesnių savaičių, mėnesių bei metų sukauptos ridos palyginimai ir Insights. Nežinoma aprėptis nepaverčiama nuliu.
- Važiavimui galima neprivalomai įvesti laiką ant rato. Iš tikrų laiko ir atstumo duomenų skaičiuojamas svertinis vidutinis greitis; trūkstamas laikas nespėjamas. Šie laukai įtraukti į Excel eksportą.

Atnaujink visus įrenginius **prieš įvesdamas laiką ant rato ar tęsdamas sinchronizuojamą redagavimą**. Vietinė duomenų bazė saugiai atnaujinama vietoje, tačiau sena programos versija naujo pasirenkamo lauko nesupranta. Duomenų iš naujo importuoti, naujų Google leidimų prašyti ar keisti OAuth nereikia. Prieš atnaujinimą išsisaugok JSON kopiją. Neįkelti originalai gali likti telefone: jų neprarasi, jei nevalysi naršyklės duomenų ir neišdiegsi PWA.

## 1. Pasiruošk paketą

1. Atsisiųsk ir išskleisk `Kairo-Ride-2.0.9.2.zip` kompiuteryje.
2. Atverk išskleistą `Kairo-Ride` aplanką. Jame turi matytis `package.json`, `app`, `components`, `public` ir kiti failai.
3. **Nekelk į GitHub paties ZIP.** Reikia jo viduje esančių failų ir aplankų.
4. Nepridėk savo Excel, JSON duomenų kopijų, nuotraukų, video, GPX ar prisijungimo paslapčių. `.gitignore` nėra apsauga nuo rankinio jų įkėlimo per svetainę.

Jei jau suvedei duomenų ankstesnėje Kairo Ride versijoje, prieš persikeldamas atsidaryk `Settings → Import / Export → Export JSON backup` (`Nustatymai`, pasirinkus lietuvių kalbą). Dar neįkeltus priedų originalus išsisaugok atskirai. Senų duomenų netrink.

## 2. Sukurk naują GitHub saugyklą

1. Prisijunk prie [GitHub](https://github.com/) ir pasirink `New repository`.
2. Pavadinimas: **Kairo-Ride**. Senos `EUC-progress-tracking-PWA` saugyklos nekeisk.
3. Nemokamam paprastam variantui pasirink `Public` – bus viešas programėlės kodas, ne tavo Drive duomenys. GitHub Pages iš privačios saugyklos priklauso nuo plano. [GitHub Pages prieinamumas](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
4. Gali pažymėti `Add a README file`, tada `Create repository`.
5. `Add file → Upload files`: nutempk **visą išskleisto aplanko turinį**. `package.json` turi atsirasti saugyklos šaknyje, ne papildomame `Kairo-Ride/Kairo-Ride` aplanke.
6. Įkelk ir **`.github` aplanką**, `.node-version`, `.gitignore`. macOS paslėptus failus parodo `Command + Shift + .`. Windows failų naršyklėje, jei reikia, įjunk paslėptų elementų rodymą.
7. `Commit changes` į **main** šaką. Jei GitHub prašo failus kelti dalimis, palik tą pačią aplankų struktūrą ir įkelk likusius atskiru veiksmu.

Patikrink, kad GitHub yra failas **`.github/workflows/deploy.yml`**. Jei nepavyko įkelti `.github`, pasirink `Add file → Create new file`, failo vardu įrašyk šį kelią, o turinį nukopijuok iš pakete esančio `deploy.yml`. Taip GitHub sukurs reikiamus aplankus.

Jei atnaujini jau sukurtą repozitoriją ir naršyklė paslėptą failą atmeta, atverk esamą `.github/workflows/deploy.yml`, paspausk pieštuko piktogramą ir pakeisk visą jo turinį pakete esančio failo turiniu. `.node-version`, `.gitignore` ir `.env.example` iš naujo kurti nereikia, jei jie jau yra.

### Kaip diegti vėlesnius pataisų paketus

**Prieš kiekvieną atnaujinimą visko trinti nereikia.** Į tą patį kelią įkeltas tokio pat pavadinimo failas naujame commit'e atnaujinamas. Tačiau failas, kurio naujame pakete nebėra, savaime neištrinamas ir lieka repozitorijoje.

Šiam 2.0.9.2 paketui:

- įkelk išskleisto `Kairo-Ride` aplanko turinį į repozitorijos šaknį ir patvirtink pakeitimus;
- senų `app`, `components`, `lib`, `public` ar kitų katalogų prieš tai netrink;
- jau esančių `.github`, `.gitignore`, `.node-version` ir `.env.example` gali iš naujo nekelti — šiame pataisų pakete jų nustatymų keisti nereikia;
- pasenusio `.kairo-export` failo pakete nebėra. Jei jis yra repozitorijoje, aplikacijai netrukdo ir į svetainę nepublikuojamas; gali jį pašalinti atskirai.

[GitHub naršyklės įkėlimas](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository) priima iki 100 failų vienu kartu ir iki 25 MiB vienam failui. [Visą katalogą galima pašalinti](https://docs.github.com/en/repositories/working-with-files/managing-files/deleting-files-in-a-repository) vienu commit'u, bet kelių nesusijusių failų ir katalogų atnaujinimus patogiau atlikti per **GitHub Desktop**:

1. Vieną kartą pasirink `File → Clone repository` ir atsisiųsk savo `Kairo-Ride` repozitoriją.
2. Nukopijuok naujo paketo turinį į tą vietinį aplanką ir sutik pakeisti tokio pat pavadinimo failus.
3. Jei leidimo pastabose nurodyta pašalinti seną failą, ištrink jį tame vietiniame aplanke. **Neliesk `.git` katalogo.**
4. GitHub Desktop lange peržiūrėk `Changes`, įrašyk, pvz., `Update Kairo Ride to 2.0.9.2`, pasirink `Commit to main`, tada `Push origin`.

GitHub istorija leidžia grįžti prie ankstesnio commit'o, todėl viso projekto ištrynimas prieš kiekvieną pataisą tik padidina riziką netyčia praleisti failą.

## 3. Įjunk GitHub Pages

1. Saugykloje atverk **Settings → Pages**.
2. Skiltyje `Build and deployment`, prie `Source` pasirink **GitHub Actions**. Nekurk papildomo Jekyll ar Next.js workflow – paketui jau paruoštas savas.
3. Atverk **Actions → Publish Kairo Ride → Run workflow → main → Run workflow**.
4. Sulauk, kol žali bus abu darbai: `build` ir `deploy`.
5. Svetainės adresą rasi **Settings → Pages** arba `deploy` rezultatuose.

Įprastos projekto saugyklos adreso pavyzdys:

```text
https://VARTOTOJAS.github.io/Kairo-Ride/
```

Jeigu tavo paskyra vis dar `79mas`, šios naujos saugyklos numatomas adresas būtų `https://79mas.github.io/Kairo-Ride/`. Tai pavyzdys, ne patvirtinimas, kad svetainė jau paskelbta.

Pirmasis automatinis bandymas po failų įkėlimo gali nepavykti, jeigu Pages tuo metu dar nebuvo įjungta. Atlik aukščiau esančius nustatymus ir paleisk workflow iš naujo. Toliau kiekvienas kodo pakeitimas `main` šakoje bus tikrinamas ir publikuojamas automatiškai: GitHub paleidžia TypeScript patikrą, surinkimą ir visą automatinių testų rinkinį. Publikuojama tik `dist/client`, ne šaltiniai, testai ar privatūs duomenys. [GitHub publikavimo workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

### Adresų nereikia taisyti rankomis

Workflow iš GitHub paima tikrą Pages bazinį kelią. Todėl veikia projekto adresas `/Kairo-Ride/`, pagrindinė `<vartotojas>.github.io` saugykla ir Pages su savu domenu. Pasikeitus Pages domenui ar keliui, paleisk workflow dar kartą. OAuth origins reikia atnaujinti atskirai. Naudok HTTPS; savo domenui Pages nustatymuose įjunk `Enforce HTTPS`, kai parinktis pasiekiama. [GitHub pateikiamas `base_path`](https://github.com/actions/configure-pages/blob/main/action.yml).

**Šiame etape svetainė jau veiks vietiniu režimu.** Galėsi pridėti vienaratį, rodmenis, keliones, pasivažinėjimus ir ekipuotę bei eksportuoti duomenis. Kol neatliktas 4 skyrius, telefono ir kompiuterio įrašai dar nebus sujungti.

## 4. Vieną kartą įjunk Google Drive

Šiuos veiksmus atlieki **tu, projekto savininkas**, ne kiekvienas programėlės naudotojas. Serverio, Apps Script ar service account nereikia.

### 4.1. Paruošk Google projektą

1. Atverk [Google Cloud Console](https://console.cloud.google.com/).
2. Pasirink savo esamą projektą, jeigu jį valdai ir nori naudoti, arba sukurk naują, pvz., `Kairo Ride`.
3. `APIs & Services → Library`: surask **Google Drive API** ir paspausk `Enable`.
4. Atverk **Google Auth Platform** (kai kuriose sąsajose – `OAuth consent screen`). Nurodyk programėlės pavadinimą **Kairo Ride**, savo pagalbos el. paštą ir kontaktą.
5. Auditorija – **External**, jeigu jungsis asmeninės Google paskyros. Pradiniam bandymui `Testing` režime į `Test users` įtrauk savo Google paskyrą.
6. `Data Access` / scopes: pridėk tik:

```text
https://www.googleapis.com/auth/drive.file
```

Šis leidimas skirtas programėlės sukurtiems ar jai naudotojo parinktiems failams; pilno Drive leidimo nereikia. Tai nėra techninis „tik vieno aplanko“ užraktas – Kairo Ride pati riboja darbą savo aplankais. [Oficialus Drive leidimų aprašas](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

### 4.2. Sukurk Web OAuth klientą

1. `Clients → Create client` arba `Credentials → Create credentials → OAuth client ID`.
2. Tipas – **Web application**.
3. Prie **Authorized JavaScript origins** įrašyk svetainės kilmę: protokolą ir hostą, **be saugyklos kelio**.

| Svetainės adresas | Authorized JavaScript origin |
| --- | --- |
| `https://79mas.github.io/Kairo-Ride/` | `https://79mas.github.io` |
| `https://VARTOTOJAS.github.io/Kairo-Ride/` | `https://VARTOTOJAS.github.io` |
| `https://ride.manodomenas.lt/` | `https://ride.manodomenas.lt` |

Jei naudoji savo esamą OAuth klientą, **pridėk** naują origin, neištrindamas seno. Ši versija naudoja Google Identity Services žetono modelio langą; callback serverio ir `Authorized redirect URI` šiam srautui kurti nereikia. [Google Web kliento nustatymai](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [GIS žetono modelis](https://developers.google.com/identity/oauth2/web/guides/use-token-model).

4. Nukopijuok **Client ID**, panašų į:

```text
1234567890-abcdefghijklmnop.apps.googleusercontent.com
```

**Client ID nėra paslaptis. `Client secret`, prisijungimo žetonų ir service-account JSON niekur į programėlę ar GitHub nekelk.**

### 4.3. Įrašyk ID GitHub nustatymuose

1. GitHub saugykloje: **Settings → Secrets and variables → Actions → Variables**.
2. Pasirink **New repository variable**.
3. Name: **GOOGLE_CLIENT_ID**.
4. Value: tavo visas Client ID.
5. Išsaugok.
6. **Actions → Publish Kairo Ride → Run workflow**. Vien kintamojo pakeitimas naujo publikavimo nepradeda.

Alternatyva – pakeisti `public/kairo-config.json` turinį:

```json
{
  "googleClientId": "1234567890-abcdefghijklmnop.apps.googleusercontent.com"
}
```

Pakanka vieno iš šių būdų. Jei nustatyti abu, workflow kintamasis turi pirmenybę.

### 4.4. Pirmas tikras prisijungimas

1. Atverk paskelbtą svetainę.
2. Paspausk **Connect Drive** arba `Settings → Synchronization → Connect Google Drive`.
3. Pasirink Google paskyrą ir patvirtink leidimą.
4. Jei vietinių duomenų jau yra, pasirink, ar juos **kopijuoti į šią paskyrą**. Esami vietiniai originalai nebus ištrinti.
5. Palauk, kol sinchronizavimas baigsis. Atverk **Kairo Ride aplanką** ir įsitikink, kad jame yra duomenų istorija.
6. Tik tada tuo pačiu adresu prijunk kitą įrenginį prie tos pačios Google paskyros.

Įprastas naudotojas atlieka tik paskyros pasirinkimą ir sutikimą. Jis nekuria Google projekto ir neveda jokio rakto. Tačiau pasibaigus laikinam žetonui reikia atnaujinti prieigą; ši versija neturi serverio, kuris nuolat atnaujintų prisijungimą fone. [Google žetono galiojimas ir atnaujinimas](https://developers.google.com/identity/oauth2/web/guides/use-token-model).

### Prieš kviesdamas kitus žmones

`Testing` skirtas bandymui, o ne patogiam viešam startui: paskyras reikia įtraukti į testuotojus. Viešai versijai sutvarkyk **In production**, tikrą programėlės pradžios puslapį ir privatumo puslapį. Pakete yra `public/privacy.html`, tačiau jo valdytojo kontaktą turi papildyti pats. Privatumo URL bus tavo svetainės adresas su `privacy.html` pabaigoje. Jei Google paprašys domeno ar programėlės prekės ženklo patvirtinimo, reikės jį atlikti savo Google projekte; iš anksto jo sėkmės negarantuojame. [Google viešos OAuth programėlės reikalavimai](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification).

Naudotojo failai naudoja jo Drive vietą. Google ir GitHub planai bei limitai gali keistis; neriboto ar amžinai nemokamo talpinimo nežadame. [Drive naudojimo limitai](https://developers.google.com/workspace/drive/api/guides/limits).

## 5. Piktograma telefono pagrindiniame ekrane

Pirmą kartą atverk svetainę su internetu. Pačioje programėlėje, `Settings → Information → This device`, turi pasirodyti, kad programėlė paruošta darbui be interneto.

### Android / Chrome

1. Atverk **tikrą paskelbtą HTTPS adresą** per Chrome, ne GitHub failų peržiūrą ir ne Messenger vidinę naršyklę.
2. Programėlėje atverk `Settings → Information → Install on your phone`. Jei rodomas **Install Kairo Ride**, paspausk jį.
3. Kitu atveju Chrome meniu **⋮ → Add to home screen / Install app** (pavadinimas priklauso nuo kalbos ir versijos), tada patvirtink diegimą.
4. Atverk Kairo Ride per naują piktogramą. [Chrome web programėlių diegimas](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en).

### iPhone / Safari

1. Atverk svetainę **Safari**.
2. **Bendrinti / Share → Įtraukti į pagrindinį ekraną / Add to Home Screen**. Naujesnėje Safari sąsajoje `Share` gali būti po `More` mygtuku.
3. Jei rodoma, įjunk **Open as Web App**.
4. Patvirtink pavadinimą **Kairo Ride** ir paspausk **Add**.
5. Atverk per piktogramą. [Apple instrukcija](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).

Manifestas, atskira Apple piktograma, 192 ir 512 px piktogramos, maskable piktograma, SVG / ICO favicon, tamsi sistemos juostos spalva ir ekrano išpjovų paraštės jau įtraukti. Naršyklė pati nusprendžia, ar rodyti automatinį diegimo pasiūlymą. iOS įdiegta programėlė ir Safari kai kuriose versijose gali turėti atskiras vietines saugyklas, todėl pagrindinius duomenis suvesk jau įdiegtoje programėlėje arba pirma užbaik Drive sinchronizavimą.

## 6. Duomenų perkėlimas

Naujoje GitHub versijoje atverk **Settings → Import / Export → Choose import file**. Pasirink ankstesnį Kairo Ride JSON / Excel arba senos PWA failą su `Rides` ir `Models` lapais. Peržiūrėk santrauką ir patvirtink. JSON / Excel importas neperkelia vietinių priedų originalų – juos reikia jau turėti Drive arba prisegti iš naujo.

Naujas domenas ar kitas saugyklos kelias yra nauja vietinė erdvė. Tai normalu: nauja svetainė negali pati perskaityti ankstesnės svetainės naršyklės duomenų. Nepanaikink senos versijos ir jos vietinės kopijos, kol nepatikrinai įrašų bei originalų naujoje.

## 7. Patikrink prieš naudodamas pagrindinį archyvą

Šios patikros turi būti atliekamos po tavo publikavimo; jos dar nėra atliktos su tavo Google paskyra ar telefonu.

- Pridėk bandomą vienaratį su nuliniu pradiniu odometru, rodmenį, kelionę, pasivažinėjimą ir vieną ekipuotės daiktą.
- Eksportuok Excel ir JSON; patikrink, kad juose yra ekipuotė ir teisingi odometrai.
- Prijunk Google, prisegk mažą GPX ar nuotrauką, užbaik sinchronizavimą ir atverk originalą Drive.
- Kitame įrenginyje prisijunk prie tos pačios paskyros. Patikrink įrašus, ekipuotę ir failo atvėrimą.
- Įdiek PWA. Po pirmo sėkmingo paruošimo trumpam atjunk internetą, atverk ją ir sukurk bandomą įrašą. Grąžink internetą, jei reikia atnaujink prieigą ir sinchronizuok.
- Patikrink, kad prijungus kitą Google paskyrą duomenys nepersikelia be tavo pasirinkimo.
- Tik po šių bandymų importuok pagrindinę kopiją. Atsarginę kopiją išsaugok.

Automatiniai testai apima modelį, IndexedDB, Excel, konfliktus, imituojamą Drive ir statinio paketo vientisumą. Jie nepakeičia realaus Google OAuth, naršyklės politikų ir telefono miego režimo bandymo.

## 8. Jei nepavyko

| Situacija | Ką patikrinti |
| --- | --- |
| Svetainė rodo 404 | `Settings → Pages`: Source yra GitHub Actions; `deploy` baigėsi sėkmingai; URL didžiosios ir mažosios raidės sutampa su saugyklos vardu |
| Actions nerodo workflow | Ar tikrai įkeltas `.github/workflows/deploy.yml` į `main`, ne papildomą viršutinį aplanką? |
| Pirmas build nutrūko ties Pages | Pirma įjunk Pages, tada paleisk workflow iš naujo |
| Node paruošimas nepavyko | Ar saugyklos šaknyje yra `.node-version` ir `package-lock.json`? |
| Matau seną temą ar nėra ekipuotės | Palauk sėkmingo `deploy`, atnaujink puslapį, uždaryk visus šios PWA langus ir atverk vėl. Neišvalyk naršyklės duomenų vien dėl dizaino atnaujinimo |
| Google neaktyvuotas | Nustatyk `GOOGLE_CLIENT_ID` ir dar kartą paleisk workflow |
| Google `origin_mismatch` | OAuth leidžiamame origin turi būti tik HTTPS + hostas, be `/Kairo-Ride/`; patikrink visą Client ID |
| Google neleidžia prisijungti | Testing režime paskyra turi būti `Test users`; patikrink, ar įjungta Drive API ir suteiktas `drive.file` leidimas |
| Nėra prisijungimo lango | Atverk išorinėje Chrome / Safari, leisk vartotojo paspaudimu atidaromą Google langą, patikrink turinio blokatorius |
| Kitame įrenginyje tuščia | Tas pats svetainės adresas, ta pati Google paskyra, abiejuose atliktas sinchronizavimas; vietinė kopija savaime nėra Drive kopija |
| Video nebaigia siųsti | Failas iki 512 MB, pakanka naršyklės ir Drive vietos; laikyk programėlę atvirą, atnaujink Google prieigą ir bandyk sinchronizuoti vėl |
| Senas EUC.xlsx neimportuojamas | Jame maišyti vienaračiai. Šio formato programa sąmoningai neatspėja; naudok failą su `Rides` / `Models` arba atskirai paruoštą migraciją |

GitHub paskyrai įjunk dviejų žingsnių apsaugą: programėlės kodo pakeitimai pakeičia ir tai, ką paleidžia jos naudotojai.

## Paketo patikros prieš perdavimą

Statinė versija surinkta ir 242 automatiniai testai sėkmingai paleisti su abiem baziniais keliais: `/` ir `/Kairo-Ride/`. TypeScript ir ESLint patikros sėkmingos. Patikrintas sintetinės Google Client ID reikšmės įtraukimas tik į surinktą viešą konfigūraciją; pateikiamo kodo Client ID paliktas tuščias.

Naujos patikros apima atnaujinimo aktyvavimą tik gavus naudotojo sutikimą, paskyrų vietinių duomenų atskyrimą, migracijas ir atkūrimo taškus, konfliktų sprendimą, diagnostikos duomenų nuasmeninimą, atnaujinamus failų siuntimus su pauze ir tęsimu bei klaidos atveju išsaugotą patvirtintą baitų poziciją. Analitikos patikros apima 30 / 90 dienų slenkančius vidurkius, neišgalvotus nežinomų laikotarpių nulius, palyginamus laikotarpius, įžvalgas, EUC laiką ir svertinį vidutinį greitį. Surinkimo įspėjimas dėl didesnio JavaScript failo nėra klaida; papildomas kodo skaidymas paliktas vėlesniam optimizavimui.

Maintenance patikros apima visus šablonus, abiejų priminimų varnelės būsenas, kitą pasirinktą priemonę, mėnesių pabaigas ir keliamuosius metus, savaitinį kartojimą, senų terminų išlaikymą, vienu veiksmu išsaugomą atlikimą ir kitą užduotį, JSON / Excel atkūrimą, konfliktus, telefono pranešimų siuntimo kelią ir atsisakyto leidimo gerbimą. Realus pranešimas tavo telefono operacinėje sistemoje turi būti išbandytas po publikavimo.

Naudotos jau įdiegtos priklausomybės; `package-lock.json` priklausomybių grafas patikrintas nesiunčiant paketų. Šviežias `npm ci`, GitHub Actions publikavimas, realus Google OAuth ir fizinių telefonų diegimas šioje aplinkoje neatlikti. Pirmas GitHub paleidimas ir 7 skyriaus bandymai yra likusi paleidimo patikra.
