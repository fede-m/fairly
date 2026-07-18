# Piano per preparare Fairly alla submission per Chrome Web Store

## Problem statement
L'estensione Fairly deve passara il processo di revisione del Chrome Web Store di Google. Questo documento identifica tutti i problemi riguardanti sicurezza, privacy, compliance e qualità riscontrati. 

## 1. CRITICAL: security issues

### 1.1 XSS Vulnerability via `innerHTML`
- In `fontend/content/domUtils.js` quando creiamo il paragrafo con:
```js
p.innerHTML = `<strong><del>${spanEl.dataset.original}</del> ${ICONS.arrowRight} ${spanEl.dataset.reformulation}<strong>`;
```
- `${spanEl.dataset.original}` e  `${spanEl.dataset.reformulation}` potrebbero contentere markup nocivo usato da attackers che verrebbe inserito all'interno dell'HTML della pagina, ponendo problemi di sicurezza.
- Soluzione: creazione sicura del DOM senza usare `innerHTML`. Usando `textContent`, il browser interpreta il valore come testo e non come HTML, impedendo che del codice JavaScript possa essere eseguito.

### 1.2 Sostituire `http://localhost`
- Non appena caricato il codice sui server di UniTo e una volta ricevuto l'URL per il backend, il BASE_URL dovrà essere sostituito con il nuovo URL
- È inoltre fondamentale che supporti richieste HTTPS dal momento che dovremo inviare PII (email dell'utente) al backend.
- La pseudonomizzazione verrà infatti effettuata esclusivamente nel backend per non esporre al pubblico la security key usata per l'encryption dell'indirizzo email

### 1.3 Sostituire `localStorage`
- Attualmente, localstorage scrive direttamente nel localStorage di Gmail. 
- Ciò può essere considerato:
    - Una policy violation: dal momento che l'estensione modifica la pagina host
    - Non stabile: Gmail può cancellare il contenuto del local storage in qualsiasi momento
    - Rischio di privacy: altri script operanti sulla pagina possono leggere il `localStorage` e le informazioni in esso salvate
- Soluzione: usare ``chrome.storage``
    - Area di storage separata collegata solo alla tua specifica estensione (usando l'ID). 
    - Nè Gmail nè altri script possono accedervi o cancellarne i dati
    - Puoi trovare i valori salvati nel developer tool in "Application > Extension storage > Local"

### 1.4 Extension Fingerprinting
- Extension Fingerprinting: quando la pagina host è in grado di identificare che estensioni sono installate dall'utente senza il suo consenso.
- Se Gmail sa che hai Grammarly + Fairly + Dark Reader --> questa combinazione potrebbe renderti identificabile sul web, anche senza l'utilizzo di cookies.
- Con `window._fairlyInitialized=true` qualsiasi script su Gmail può fare:
```js
if (window.__fairlyInitialized) {
    // Estensione X/Attacker può sapere che quest* user ha Fairly installata 
}
```
- Ciò può essere nocivo in molti modi:
    - Attacchi targettizzati: "User X ha estensione Y che ha una nota vulnerabilità --> sfruttala"
    - Profilazione di utenti: le estensioni (come ad es. anche Feirly), potrebbero rivelare interessi, visioni politiche, disabilità, professione dell'utente
    - Cross-site tracking: la combinazione delle estensioni che usi ti rende identificabile da un sito web all'altro (anche se elimini i coockies, resti identificabile)

## 2. CRITICAL: privacy issues
### 2.1 Link all Privacy Policy dall'UI
- Chrome Web Store richiede un link alla privacy policy quando si fa la domanda
- Una best practice è di aggiungere un hook alla privacy policy direttamente dall'UI
- Il link alla privacy policy inoltre contiene:
    - target = "_blank": indica al browser che il link deve essere aperto in una nuova pagina
    - rel = "noopener noreferrer": 
        - noopener --> la nuova tab non può accedere alla tab che lo ha aperto (Gmail) usando window.opener. Ciò previene il `reverse tabnabbing`: user apre il sito di Fairly. Qualcuno lo ha compromesso ad ha aggiunto nel JS del sito la linea di codice `window.opener.location= "https://fake-gmail-login.com`. Se l'utente va indietro, viene aperta la pagina indicata da quel link, che è una pagina di Gmail fake in cui l'attacker può richiedere email e password e rubarle all'utente
        - noreferrer --> Quando invia l'utente al sito di Fairly, il browser non manda l'URL di Gmail come "Referrer" nell'Header della richiesta. In questo modo il sito di Fairly non sa che l'utente è arrivato lì da Gmail

### 2.2 Trasferimento dell'Email al backend
- L'email viene hashata con HMAC-SHA256 solo nel backend, prima del salvataggio in MongoDB. Per ragioni di sicurezza, ciò non verrà fatto nel frontend per evitare di esporre pubblicamente la secret key usata per la pseudonimizzazione.
- L'utilizzo dell'email è necessario solo in un primo momento per poter incrociare i dati provenienti dal questionario con quelli di utilizzo durante la fase di sperimentazione
- Ciò rende necessario assicurare che la trasmissione dei dati al backend avvenga esclusivamente tramite HTTPS che garantisce che l'indirizzo email sia criptato in transito (TLS) e che nessun intermediario possa leggerne il contenuto.
- Tale procedura deve essere descritta nel dettaglio nella Privacy policy

### 2.3 Richiedere la Consent Notice
- La prima volta che l'utente apre Fairly, dobbiamo mostrare una consent notice che spieghi brevemente:
    - Quali dati sono inviati
    - Dove
    - Che nessuna email è salvata permanentemente
    - Link alla Privacy Policy completa
- L'utente può poi decidere se accettare (e usare Fairly) o rifiutare (in tal caso almeno durante la fase di sperimentazione NON sarà possibile usare Fairly per niente. Successivamente, la consent notice consentirà di accettare o rifiutare il raccoglimento dei dati personali senza impedire l'utilizzo di Fairly in toto in caso di rifiuto di condivisione dei dati).

### 2.4. Eliminare tutti i console.log e i print non necessari
Per evitare data lickage

## 3. REQUIRED: Chrome Web Store Compliance
### 3.1. Aggiungere icone
- Aggiungere le icone (128, 48, 32, 16 px) a partire dal logo e citarle nel manifest.json

### 3.2. Controllare permissions
- Quando facciamo la richiesta dobbiamo specificare a cosa ci servono:
    - `storage`: per salvare le preferenze dell'utente tra sessioni diverse.  Nessun dato sensibile è salvato, solo l'ordine in cui vengono presentate le strategie e se l'utente ha acconsentito o meno alla Consent Notice
    - `host_permission`: dal momento che Fairly è un tool che funziona esclusivamente su Gmail per favorire un utilizzo inclusivo del linguaggio utilizzato nelle email, necessita di avere accesso a `mail.google.com` per inserire i content script ed eseguire l'analisi. 

### 3.3. Eliminare il codice commentato 
-  Prima di sottomettere il codice, eliminare tutte le parti commentate

### 3.4. Implementare il popup
- Nel popup viene semplicemente indicato che Fairly è attiva + link a sito e privacy policy

### 3.5. Pulire resources
- Eliminare immagini che non sono utilizzate

### 3.6. Remote code/Data Policy compliance
- Nel frontend non viene iniettato nessun `codice` se non quello dichiarato nel frontend dell'estensione:
    - Nessuno `<script>` tag è generato dal backend e iniettato nell'UI di Gmail
    - Non abbiamo nessun `chrome.scripting.executeScript` con codice remoto 
- MA vengono inserite nell'UI di Gmail span di testo prodotte dal backend (quindi `dati`).
- Dal momento che con il fix 1.1. non mettiamo niente come `innerHTML` ma come semplice plain text content, anche questo non è un problema 
- Spacificare nella richiesta che: "The extension receives text suggestions from our API and displays them as plain text content (using the `textContent` attribute and not `innerHTML`). No remote code is executed"

## 4. IMPORTANT: Robustness & Quality
### 4.1. Aggiungere `content_security_policy`
- Definisce restrizioni di sicurezza per l'estensione, in particolare:
    - `script-src 'self'`: solo scripts dell'estensione stessa sono permessi
    - `object-src 'self'`: solo embedded objects dell'estensione stessa sono permessi

- Consente di evitare:
    - Che scripts malintenzionati vengano iniettati nell'estensione
    - Attacchi XSS (Cross-Site Scripting)
    - il caricamento non sicuro di materiale esterno
```js
"content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
```

### 4.2. Aggiungere keep-alive pattern
- I server workers di MV3 vengono killed dopo 30 secondi di inattività. 
- Dal momento che la durata della chiamata all'LLM potrebbe in alcuni casi essere più lunga e superare il limite di 30 secondi, il service worker potrebbe venire disconnesso senza aver finito di processare la richiesta.
- Per evitare che ciò avvenga, bisogna implementare il `keep-alive` pattern, che consente di mandare un ping a Chrome ogni 25 secondi per indicare che il service worker sta ancora eseguendo quanto deve e non deve ancora essere disconnesso al passare dei 30 secondi
- In `background.js` le funzioni `startKeepAlive` e `stopKeepAlive` implementano tale pattern

### 4.3. Aggiungere error handling per `chrome.runtime.sendMessage`
- Se la comunicazione con il background fallisce (e.g. il service worker è inattivo, l'estensione è stata aggiornata mentre la pagina è ancora aperta, l'estensione è stata disattivata/disinstallata) l'utente non riceve alcun feedback cha qualcosa è andato storto



