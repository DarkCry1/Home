# Home — Hemma

Mobilanpassat hemmalager på svenska med streckkod, antal, sökning, förvaringskategorier och inköpslista.

## Användning

Lägg till en vara med namn och valfri streckkod. Vid skanning av en sparad kod ökas antalet med ett. En ny streckkod får du namnge första gången. Ingen extern produktdatabas används.

Data sparas i webbläsarens localStorage på respektive enhet. Ingen synkronisering mellan enheter ingår. Rensad webbplatslagring tar bort det lokala lagret.

Kameraskanning kräver HTTPS eller localhost och tillåten kameraåtkomst. Där webbläsarens BarcodeDetector saknas eller inte stöder vanliga varukoder laddas ZXing Browser 0.1.5 från jsDelivr, med integritetskontroll (SRI). Detta ger avläsning även i webbläsare utan inbyggd streckkodsläsare, exempelvis Safari på iPhone. Kamerabilder bearbetas lokalt och skickas inte till någon produktdatabas. Fallback-läsaren kräver internet vid laddning.

Efter en avläst vara pausas registreringen tills du trycker på **Skanna nästa**, för att undvika dubbelräkning. En ny streckkod öppnar formuläret för varunamn. Alternativet **Fortsätt skanna efter att jag sparat** startar kameran igen efter att varan sparats. Lampknappen visas när kameran stöder det. Kameran stängs av när dialogen stängs eller appen läggs i bakgrunden. Manuell kodinmatning finns alltid.

Avläsningen beror på kamerans fokus, ljus och streckkodens kvalitet. Fysisk kameratestning på iPhone och Android återstår.

Streckkodsläsare: [ZXing Browser (MIT)](https://github.com/zxing-js/browser).

## GitHub Pages

Öppna Settings → Pages. Välj Deploy from a branch, main och / (root), sedan Save.

Förväntad adress efter lyckad publicering: https://darkcry1.github.io/Home/

Appen är en fristående index.html och kräver inget byggsteg.
