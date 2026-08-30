# Kairo Ride: paleidimas per GitHub

Versija 2.0.4 · 2026-08-30 · papildyta Maintenance šablonais

## Trumpai: atnaujinimas iš 2.0.3 arba ankstesnio 2.0.4 paketo

1. Programėlėje atsisiųsk JSON atsarginę kopiją. Neįkeltus originalius priedus išsisaugok atskirai.
2. Išskleisk `Kairo-Ride-2.0.4.zip` ir įkelk **vidinio `Kairo-Ride` aplanko turinį** į tą pačią GitHub repozitorijos šaknį. Pasirink `Commit changes`. Senų katalogų prieš tai netrink.
3. Įkelk ir naujus failus iš `components/kairo`, `hooks`, `lib/kairo` bei `tests`. Jau esančių paslėptų konfigūracijos failų keisti nereikia. `GOOGLE_CLIENT_ID` GitHub kintamasis ir esama Google konfigūracija lieka tie patys.
4. Sulauk žalio `Actions → Publish Kairo Ride` rezultato. Atnaujink puslapį su internetu, kad atsisiųstų naują programą, tada uždaryk visus Kairo Ride naršyklės ir įdiegtos PWA langus ir atverk dar kartą. Tai atlik **telefone ir kompiuteryje**. Apačioje lieka **2.0.4**; naują paketą atpažinsi iš išplėsto `Maintenance → Add task → Task type` sąrašo ir atskirų `Date` / `Mileage` varnelių. Naršyklės duomenų nevalyk ir PWA neišdiek.
5. `Settings → Google Drive → Automatic sync` numatytai įjungtas. Jei prašoma, paspausk **Refresh access**. Esamos duomenų bazės iš naujo importuoti nereikia.

### Kas pasikeitė

- Analitikoje paslėptos priemonės nebeužima nei laiko, nei aukščio skalės. Keičiant priartintą intervalą persiskaičiuoja ir vertikali skalė. `Fit` grąžina visą pasirinktos priemonės istoriją; stulpelių skalė išlieka nuo nulio.
- Sinchronizavimas siunčia pakeitimus po maždaug 1,5 s, tikrina kito įrenginio pakeitimus kas minutę, grįžus į programą ir atsiradus internetui. Laikinos tinklo / Google klaidos kartojamos retėjančiais bandymais. Nepakitęs `database.json` kas minutę neperrašomas.
- Rides telefone ir kompiuteryje yra lentelė. Viršuje – horizontalus slankiklis ir rodyklės; antraštės bei data prisegtos. Telefone slepiami tušti neprivalomi stulpeliai ir nulinės / brūkšnelio langelių reikšmės, išlaikant lygiavimą.
- `km/d` yra rūšiuojamas atstumo per kalendorinę dieną įvertis tai pačiai priemonei: **70 km / 7 d. = 10 km/d**. Odometro įrašui imamas ankstesnis odometro įrašas; pirmajam – pradinio odometro data. Tos pačios dienos intervalas laikomas viena diena. Tai nėra vieno realaus pasivažinėjimo trukmės matavimas.
- Maintenance papildyta 20 šablonų, automatiniu datos / odometro tikslo užpildymu, atskiromis priminimų varnelėmis, kartojimu dienomis arba mėnesiais ir likusiu atstumu kortelėje. Datos ir ridos riboms galioja „kas sueina pirmiau“. Ankstesni šio paketo pakeitimai išlieka.

### Kaip naudoti naują Maintenance

1. `Garage → Maintenance → Add task` pasirink `Task type` ir transporto priemonę. Pavadinimas, datos ir ridos tikslai užsipildys pagal pasirinktą šabloną.
2. `Date` ir `Mileage` yra nepriklausomos varnelės. Gali palikti abi arba vieną; laukelių reikšmes gali keisti. Jei intervalas buvo nurodytas diapazonu, numatytoji yra trumpesnė riba.
3. Skaičiuojama nuo formos atidarymo dienos ir **paskutinio įrašyto tos priemonės odometro**, o jei rodmenų dar nėra – nuo pradinio rodmens. Programėlė nėra tiesiogiai prijungta prie vienaračio. Jei reikia, pirmiausia atnaujink odometrą Rides skiltyje.
4. Pavyzdys: **2026-08-30**, odometras **1 346 km**, `Check tire pressure` → data **2026-09-06**, odometras **1 446 km**. Priminimas suveikia pasiekus pirmą ribą.
5. `Schedule the next check when completed` įjungia kartojimą. Įrašo redagavime pažymėjus `Mark as completed`, atliktas darbas lieka istorijoje, o kita patikra skaičiuojama nuo atlikimo dienos ir tuo metu įrašyto odometro. Draudimo kartojimas yra išimtis: naudojama polise įvesta galiojimo pabaiga; naują tikrą datą visada patikrink.
6. `Notes / actual condition` įrašyk rastus pažeidimus, nusidėvėjimą, matavimo rezultatus ar atliktus darbus. Rodomas rekomenduojamas intervalas nėra fizinės būklės patvirtinimas.
7. `Settings → Maintenance reminders → Enable local reminders` įjungia neprivalomus sistemos pranešimus. Priežiūros būsena programoje rodoma ir be šio leidimo. Telefonams naudojamas PWA pranešimų mechanizmas; nesėkmingas pranešimas neužskaitomas kaip pristatytas. Visiškai uždarytos / sustabdytos programėlės pranešimų be serverio negarantuojame.

Keitimui pagal būklę, komponento instrukciją bei patikroms prieš kiekvieną važiavimą / įkrovimą fiksuota data ar rida neišgalvojama. Tokį įrašą gali laikyti kontroliniu sąrašu arba pats įjungti ir užpildyti priminimą. Važiavimo pradžios, įkrovimo ir fizinės būklės programa automatiškai neaptinka. Draudimui būtina įvesti tikrą poliso galiojimo pabaigą; numatytas priminimas prieš 14 dienų. Įprastoms patikroms numatyta priminti termino dieną.

Tai tavo siūlomi pradiniai intervalai, **ne oficialus Lynx-S ar kito gamintojo grafikas**. Pirmenybę turi konkretaus modelio bei komponento instrukcija. Po smūgių, drėgmės, purvo ar pastebėjus neįprastus požymius gali reikėti tikrinti anksčiau. Pradinė tvirtinimų patikra yra vienkartinė; vėliau pasirink periodinę tvirtinimų patikrą. Bendros serviso apžiūros orientyras paremtas [Voltride rekomendacija](https://voltride.com/electric-unicycle-maintenance-what-you-can-do-yourself-to-keep-your-wheel-in-good-condition/); kitų šablonų gamintojui nepriskiriame.

Senų priežiūros įrašų terminai atidarant neperrašomi. `Use suggested intervals` mygtukas sąmoningai iš naujo užpildo formos grafiko laukus. Išsaugoti tikslai vėliau nepaslenkami vien nuo naujo odometro įrašo. Duomenų iš naujo importuoti nereikia. Nauji neprivalomi šablono ir kartojimo dienomis laukai lieka Drive, JSON ir Excel istorijoje. **Prieš naudodamas juos atnaujink visus savo įrenginius**: ankstesnis programos kodas šių papildomų laukų neatpažįsta. Google ir GitHub nustatymų keisti nereikia.

### Automatinio sinchronizavimo patikra

1. Telefone ir kompiuteryje atverk tą patį puslapį, prisijunk ta pačia Google paskyra ir palik įjungtą `Automatic sync`.
2. Telefone išsaugok bandomą įrašą. Palik programėlę atvirą, kol nebeliks laukiančių vietinių pakeitimų.
3. Grįžk į programą kompiuteryje arba palauk maždaug minutę, jeigu ji jau aktyvi. Įrašas turi atsirasti be `Sync now`.
4. Pakeisk jo pastabą kompiuteryje ir patikrink telefone. Priemonės nebūtina laikyti atidarytos vienu metu: pirmoji siunčia į Drive, kita pasiima vėliau.
5. Trumpam atjunk internetą, įrašyk pakeitimą ir vėl prisijunk. Jis lieka vietinėje eilėje ir bus siunčiamas automatiškai, jei Google prieiga galioja.

Visiškai uždarytos arba paslėptos PWA fono darbo negarantuojame. Po perkrovimo arba pasibaigus Google žetono galiojimui reikia **Refresh access** paspaudimo. Automatinis sinchronizavimas neatnaujina Google leidimo be naudotojo veiksmo. Konfliktai jo nedraudžia: dvi skirtingos to paties įrašo versijos saugomos peržiūrai. [Google žetono modelis](https://developers.google.com/identity/oauth2/web/guides/use-token-model).

**GitHub talpins programėlę. Kiekvienas naudotojas savo įrašus ir failus saugos savo Google Drive.** Programėlės naudotojams GitHub paskyros nereikia. Toliau aprašytą pradinį paruošimą vieną kartą atlieka projekto savininkas.

## 1. Pasiruošk paketą

1. Atsisiųsk ir išskleisk `Kairo-Ride-2.0.4.zip` kompiuteryje.
2. Atverk išskleistą `Kairo-Ride` aplanką. Jame turi matytis `package.json`, `app`, `components`, `public` ir kiti failai.
3. **Nekelk į GitHub paties ZIP.** Reikia jo viduje esančių failų ir aplankų.
4. Nepridėk savo Excel, JSON duomenų kopijų, nuotraukų, video, GPX ar prisijungimo paslapčių. `.gitignore` nėra apsauga nuo rankinio jų įkėlimo per svetainę.

Jei jau suvedei duomenų ankstesnėje Kairo Ride versijoje, prieš persikeldamas atsidaryk `Settings → Download JSON backup` (`Nustatymai`, pasirinkus lietuvių kalbą). Dar neįkeltus priedų originalus išsisaugok atskirai. Senų duomenų netrink.

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

Šiam 2.0.4 paketui:

- įkelk išskleisto `Kairo-Ride` aplanko turinį į repozitorijos šaknį ir patvirtink pakeitimus;
- senų `app`, `components`, `lib`, `public` ar kitų katalogų prieš tai netrink;
- jau esančių `.github`, `.gitignore`, `.node-version` ir `.env.example` gali iš naujo nekelti — šiame pataisų pakete jų nustatymų keisti nereikia;
- pasenusio `.kairo-export` failo pakete nebėra. Jei jis yra repozitorijoje, aplikacijai netrukdo ir į svetainę nepublikuojamas; gali jį pašalinti atskirai.

[GitHub naršyklės įkėlimas](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository) priima iki 100 failų vienu kartu ir iki 25 MiB vienam failui. [Visą katalogą galima pašalinti](https://docs.github.com/en/repositories/working-with-files/managing-files/deleting-files-in-a-repository) vienu commit'u, bet kelių nesusijusių failų ir katalogų atnaujinimus patogiau atlikti per **GitHub Desktop**:

1. Vieną kartą pasirink `File → Clone repository` ir atsisiųsk savo `Kairo-Ride` repozitoriją.
2. Nukopijuok naujo paketo turinį į tą vietinį aplanką ir sutik pakeisti tokio pat pavadinimo failus.
3. Jei leidimo pastabose nurodyta pašalinti seną failą, ištrink jį tame vietiniame aplanke. **Neliesk `.git` katalogo.**
4. GitHub Desktop lange peržiūrėk `Changes`, įrašyk, pvz., `Update Kairo Ride to 2.0.4`, pasirink `Commit to main`, tada `Push origin`.

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
2. Paspausk **Connect Drive** arba `Settings → Connect Google Drive`.
3. Pasirink Google paskyrą ir patvirtink leidimą.
4. Jei vietinių duomenų jau yra, pasirink, ar juos **kopijuoti į šią paskyrą**. Esami vietiniai originalai nebus ištrinti.
5. Palauk, kol sinchronizavimas baigsis. Atverk **Kairo Ride aplanką** ir įsitikink, kad jame yra duomenų istorija.
6. Tik tada tuo pačiu adresu prijunk kitą įrenginį prie tos pačios Google paskyros.

Įprastas naudotojas atlieka tik paskyros pasirinkimą ir sutikimą. Jis nekuria Google projekto ir neveda jokio rakto. Tačiau pasibaigus laikinam žetonui reikia atnaujinti prieigą; ši versija neturi serverio, kuris nuolat atnaujintų prisijungimą fone. [Google žetono galiojimas ir atnaujinimas](https://developers.google.com/identity/oauth2/web/guides/use-token-model).

### Prieš kviesdamas kitus žmones

`Testing` skirtas bandymui, o ne patogiam viešam startui: paskyras reikia įtraukti į testuotojus. Viešai versijai sutvarkyk **In production**, tikrą programėlės pradžios puslapį ir privatumo puslapį. Pakete yra `public/privacy.html`, tačiau jo valdytojo kontaktą turi papildyti pats. Privatumo URL bus tavo svetainės adresas su `privacy.html` pabaigoje. Jei Google paprašys domeno ar programėlės prekės ženklo patvirtinimo, reikės jį atlikti savo Google projekte; iš anksto jo sėkmės negarantuojame. [Google viešos OAuth programėlės reikalavimai](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification).

Naudotojo failai naudoja jo Drive vietą. Google ir GitHub planai bei limitai gali keistis; neriboto ar amžinai nemokamo talpinimo nežadame. [Drive naudojimo limitai](https://developers.google.com/workspace/drive/api/guides/limits).

## 5. Piktograma telefono pagrindiniame ekrane

Pirmą kartą atverk svetainę su internetu. Pačioje programėlėje, `Settings → This device`, turi pasirodyti, kad programėlė paruošta darbui be interneto.

### Android / Chrome

1. Atverk **tikrą paskelbtą HTTPS adresą** per Chrome, ne GitHub failų peržiūrą ir ne Messenger vidinę naršyklę.
2. Programėlėje atverk `Settings → Install on your phone`. Jei rodomas **Install Kairo Ride**, paspausk jį.
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

Naujoje GitHub versijoje atverk **Settings → Choose import file**. Pasirink ankstesnį Kairo Ride JSON / Excel arba senos PWA failą su `Rides` ir `Models` lapais. Peržiūrėk santrauką ir patvirtink. JSON / Excel importas neperkelia vietinių priedų originalų – juos reikia jau turėti Drive arba prisegti iš naujo.

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

Statinė versija surinkta ir 116 automatinių testų sėkmingai paleisti su abiem baziniais keliais: `/` ir `/Kairo-Ride/`. TypeScript ir ESLint patikros sėkmingos. Patikrintas sintetinės Google Client ID reikšmės įtraukimas tik į surinktą viešą konfigūraciją; pateikiamo kodo Client ID paliktas tuščias.

Naujos patikros apima abiejų grafikų ašių perskaičiavimą pagal rodomas priemones, priartinto intervalo skalę, `km/d` intervalus / laiko juostas / rūšiavimą, kompaktiškos lentelės struktūrą, automatinio sinchronizavimo laikmatį, vienalaikių siuntimų ribojimą, pakartotinius bandymus, atnaujinimų gavimą be vietinių pakeitimų ir dviejų įrenginių konflikto išsaugojimą. Surinkimo įspėjimas dėl didesnio JavaScript failo nėra klaida; papildomas kodo skaidymas paliktas vėlesniam optimizavimui.

Maintenance patikros apima visus šablonus, abiejų priminimų varnelės būsenas, kitą pasirinktą priemonę, mėnesių pabaigas ir keliamuosius metus, savaitinį kartojimą, senų terminų išlaikymą, vienu veiksmu išsaugomą atlikimą ir kitą užduotį, JSON / Excel atkūrimą, konfliktus, telefono pranešimų siuntimo kelią ir atsisakyto leidimo gerbimą. Realus pranešimas tavo telefono operacinėje sistemoje turi būti išbandytas po publikavimo.

Naudotos jau įdiegtos priklausomybės; `package-lock.json` priklausomybių grafas patikrintas nesiunčiant paketų. Šviežias `npm ci`, GitHub Actions publikavimas, realus Google OAuth ir fizinių telefonų diegimas šioje aplinkoje neatlikti. Pirmas GitHub paleidimas ir 7 skyriaus bandymai yra likusi paleidimo patikra.
