# Home — Hemma

Mobilanpassat hemmalager på svenska med streckkod, antal, sökning, förvaringskategorier och inköpslista.

## Användning

Lägg till en vara med namn och valfri streckkod. Vid skanning av en sparad kod ökas antalet med ett. En ny streckkod får du namnge första gången. Ingen extern produktdatabas används.

Data sparas i webbläsarens localStorage på respektive enhet. Ingen synkronisering mellan enheter ingår. Rensad webbplatslagring tar bort det lokala lagret.

Kameraskanning kräver HTTPS eller localhost och tillåten kameraåtkomst. Där webbläsarens BarcodeDetector saknas eller inte stöder vanliga varukoder laddas ZXing Browser 0.1.5 från jsDelivr, med integritetskontroll (SRI). Detta ger avläsning även i webbläsare utan inbyggd streckkodsläsare, exempelvis Safari på iPhone. Kamerabilder bearbetas lokalt och skickas inte till någon produktdatabas. Fallback-läsaren kräver internet vid laddning.

Efter en avläst vara pausas registreringen tills du trycker på **Skanna nästa**, för att undvika dubbelräkning. En ny streckkod öppnar formuläret för varunamn. Alternativet **Fortsätt skanna efter att jag sparat** startar kameran igen efter att varan sparats. Lampknappen visas när kameran stöder det. Kameran stängs av när dialogen stängs eller appen läggs i bakgrunden. Manuell kodinmatning finns alltid.

Avläsningen beror på kamerans fokus, ljus och streckkodens kvalitet. Kameraskanningen har provats av användaren på den publicerade sidan.

Streckkodsläsare: [ZXing Browser (MIT)](https://github.com/zxing-js/browser).

## GitHub Pages

Öppna Settings → Pages. Välj Deploy from a branch, main och / (root), sedan Save.

Förväntad adress efter lyckad publicering: https://darkcry1.github.io/Home/

Appen är en fristående index.html och kräver inget byggsteg.

## Importera kvitton

Välj **Importera kvitto** och fotografera eller ladda upp en bild, PDF eller textfil. Du kan även klistra in kvittotext direkt. Bilder läses med svensk och engelsk OCR. PDF-filer läses som text där det går; skannade sidor läses med OCR.

Granska alla föreslagna varurader innan du lägger till dem i lagret. Namn, antal och förvaring går att ändra. Välj bort oönskade rader och koppla kvittorader till befintliga varor för att öka deras antal. Endast exakt namnmatchning förväljs automatiskt; andra matchningar väljer du själv. Nya kvittovaror saknar streckkod tills de registreras separat. Ingen extern produktdatabas används.

Pant, rabatter, betalningsrader och totalsummor filtreras bort med regler för vanliga svenska kvittoformat. Viktvaror föreslås som en förpackning/påse och markeras för kontroll. OCR och kvittoformat kan ge fel eller missade rader; rätta kvittotexten eller lägg till saknade varurader manuellt.

Kvittohistoriken visar de senaste 100 importerna på samma enhet. Samma kvittofil eller identisk normaliserad kvittotext ger en varning före upprepad import. Historiken sparar filnamn, importtid, antal rader/förpackningar och kontrollsummor. Kvittobilder och fullständig kvittotext sparas inte och skickas inte till en server för tolkning.

Filer får vara högst 20 MB. PDF-filer får innehålla högst 5 sidor och varje import högst 200 varurader. Läsverktygen hämtas från CDN vid behov; internet behövs vid första laddningen. Bibliotek: [Tesseract.js 5.1.1](https://github.com/naptha/tesseract.js) och [PDF.js 4.10.38](https://github.com/mozilla/pdf.js), båda Apache 2.0.

### ICA och Kivra

Ingen direkt ICA-kontokoppling ingår. ICA hänvisar digitala kvitton till Kivra: https://www.ica.se/appar-och-tjanster/digitala-kvitton/. Importera en sparad kvittofil, en skärmbild eller kopierad kvittotext. Någon offentligt dokumenterad konsumentanslutning för att läsa ICA-kvitton till den här appen har inte identifierats. Appen begär inga ICA-, Kivra- eller BankID-inloggningsuppgifter.

## Kontroller

Kör från repositoryts rot med Node.js:

```sh
node receipt-tests/parser-check.cjs
node receipt-tests/flow-check.cjs
```

Regeltester täcker olika kvittolayouter, antal, viktvaror, pant, rabatter, totalsummor, PDF-radordning, matchning till lager och antalgränser. Flödestester täcker granskning före import, lagringsfel, dubblettvarning och avbruten/asynkron avläsning.

Hela PDF- och bildflödet har även kontrollerats i Chromium med svensk/engelsk Tesseract OCR och mobil skärmstorlek. Testkvittot var syntetiskt; verkliga butikskvitton och iPhone-avläsning kan ge andra resultat.
