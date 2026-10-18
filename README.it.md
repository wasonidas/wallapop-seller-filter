# Filtri venditori per Wallapop

[English](README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · Italiano · [Português](README.pt.md)

Estensione locale e open source per **Chrome ed Edge**. Filtra i risultati caricati in base al numero di recensioni del venditore e a prove esplicite di verifica dell'identità. Manifest V3, JavaScript, licenza MIT. Nessun backend, telemetria, abbonamento o chiamata a modelli IA.

**Ambito attuale:** solo `https://es.wallapop.com/`. L'interfaccia rimane in spagnolo. Queste traduzioni del README non aggiungono altri domini Wallapop né traducono l'estensione. Progetto indipendente, non affiliato a Wallapop.

## Installazione

1. Nel repository scegli **Code → Download ZIP** ed estrai l'archivio in una cartella permanente.
2. Nella barra degli indirizzi di **Google Chrome** scrivi `chrome://extensions`. In **Microsoft Edge** usa `edge://extensions`. Usa il browser, non Esplora file di Windows.
3. Attiva la **Modalità sviluppatore** e scegli **Carica estensione non pacchettizzata**.
4. Seleziona la cartella **`extension`**, per esempio `wallapop-seller-filter-main/extension`. Deve contenere `manifest.json` direttamente al suo interno. Non scegliere Documenti o la cartella principale del repository.
5. Apri una ricerca su [Wallapop Spagna](https://es.wallapop.com/) e ricarica la scheda se era già aperta. Il pannello **Reputación del vendedor** appare sopra i risultati.

Per usarla non servono Node.js o assistenti di sviluppo. Dopo una compilazione puoi caricare anche la cartella generata `dist`.

## Uso

- **Filtrado activo:** filtro inizialmente attivo e rigoroso; disattivandolo ripristini gli annunci senza ricaricare.
- **Mínimo de reseñas:** minimo 5 recensioni come valore iniziale. Vale **numero di recensioni ≥ minimo**: esattamente 5 soddisfa un minimo di 5. È il totale generale del profilo, non le stelle né solo le recensioni sulle vendite.
- **Solo identidad verificada:** richiede prove esplicite di identità personale. Verifica commerciale e assenza di badge rimangono dati sconosciuti.
- **Mostrar sin comprobar:** mostra anche annunci in attesa, sconosciuti o con errori, identificandoli con un'etichetta.
- **Comprobar 10 más:** elabora fino a dieci URL mai tentati. Dopo il primo gruppo la continuazione è manuale.
- **Reintentar errores:** riprova fino a dieci URL falliti senza svuotare la cache né ripetere risultati già noti o sconosciuti.
- **Actualizar datos:** svuota la cache condivisa e rielabora fino a dieci annunci.
- **Reanudar consultas:** riprende manualmente dopo un limite o blocco di accesso.

I contatori separano corrispondenze, esclusioni, richieste in corso, annunci mai tentati, dati sconosciuti ed errori. **Elaborato non significa verificato.** Quando tutti gli annunci caricati sono stati elaborati, il pulsante di continuazione si disattiva anche se alcuni dati rimangono sconosciuti.

Gli annunci nascosti mantengono spazio e ordine per non spostare i meccanismi di caricamento durante lo scorrimento. Si filtrano solo **risultati caricati ed elaborati**, non tutto il catalogo. Zero corrispondenze confermate con dati incompleti non dimostra l'assenza di venditori adatti.

## Richieste e privacy

Una richiesta simultanea tra le schede, almeno tre secondi tra gli avvii e dieci URL distinti per gruppo. Viene letto l'HTML degli annunci collegati, senza inventare endpoint API o scaricare codice eseguibile remoto.

Cache locale valida 24 ore: ID del venditore, numero di recensioni, prova di identità, data, URL sorgente e collegamenti annuncio-venditore. Le voci scadute vengono eliminate all'accesso alla cache, non con una cancellazione programmata. Si salvano anche preferenze e stato di pausa. Non vengono ispezionati né salvati valori dei cookie o credenziali; nomi, telefoni e testi delle recensioni non vengono conservati. Le normali richieste a Wallapop possono includere i cookie di sessione gestiti dal browser.

Permessi: `storage` e `https://es.wallapop.com/*`. HTTP 429 mette in pausa e rispetta `Retry-After`; 401/403 e CAPTCHA fermano le richieste fino a un'azione manuale. Un errore non diventa mai zero recensioni. Due annunci nuovi della stessa persona possono richiedere due letture per scoprire il collegamento; quelli già collegati riutilizzano la cache del venditore.

## Aggiornamento, sviluppo e limiti

Sostituisci la cartella permanente, ricarica l'estensione dalla pagina delle estensioni e poi Wallapop. Le preferenze sopravvivono a una normale ricarica. Per disinstallare scegli **Rimuovi**, quindi ricarica le schede aperte.

Versioni di Node.js in `package.json`. Il nucleo non richiede pacchetti aggiuntivi:

```sh
npm run check
npm test
npm run build
```

Output: `dist/` e `wallapop-seller-filters.zip`, con manifesto e licenza MIT nella radice. Test facoltativi del browser:

```sh
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

Puoi scegliere installazioni esistenti con `BROWSER_EXECUTABLE` o `PLAYWRIGHT_MODULE`. I test usano un profilo separato, debug limitato alla macchina locale e risposte intercettate; non interrogano Wallapop. CI esegue sintassi, test del nucleo e compilazione. I test del browser sono separati.

Sono stati confrontati tre annunci e profili reali; un utente ha mostrato il filtro in Chrome. Rimangono da verificare i singoli profili in quel browser e l'esecuzione in Edge. I fixture non dimostrano l'integrazione reale. Vedi [test](docs/TESTING.md), [ricerca](docs/RESEARCH.md) e [manutenzione](docs/MAINTENANCE.md).

Contributi e traduzioni: [CONTRIBUTING.md](CONTRIBUTING.md). Non pubblicare dati di sessione o schermate senza anonimizzazione.

[Licenza MIT](LICENSE) · Copyright © 2026 wasonidas.
