### TODOs
- [x] Improve the UI (change colors, disposition of elements, dimension etc. to make it more functional and beautiful) 
- [x] Add any feature that would make the tool accessible for everyone (e.g. add alt text etc.)
- [x] Add some animation while loading: it takes very long before we receive a response from the model (slow API call to HPC4AI servers) but the user does not have any indication that something is happening in the background. We should add some form of animation showing that the process has started and the user should wait for a response
- [] Store the following events (and others tbd) in MongoDB (NOTE: a session id is already created at the beginning in `initExtension` and should be used in combination with current datetime, to follow the interaction of the user with the tool):
    - in `start_analysis` --> store the option/inclusive strategy that was selected
    - in `content/actions.js` --> the `accept` function should store the single or all accepted text(s) (could be our suggestion or the one written by the user)
    - in `content/actions.js` --> the `discard` function should store the single or all discarded text(s)


## accessibility

[freecodecamp](https://www.freecodecamp.org/news/how-to-design-accessible-browser-extensions/#:~:text=the%20same%20extension.-,How%20to%20Perform%20Automated%20Browser%20Extension%20Accessibility%20Tests,violations%20and%20implement%20suggested%20fixes)

[WAVE Web Accessibility Evaluation Tools](https://wave.webaim.org/)

manual testing:

- [x] Keyboard Navigation: Ensure you can navigate through the entire extension using only the Tab and Enter/Space keys. Check for a visible focus indicator so users know which element they are currently on.
- [x] Screen Reader Testing: Used linux mint default screen reader to test it. it works.
- [x] Zoom and Resizing: Verify that the extension remains functional and readable when the browser or system zoom is set to 200%.
- [x] Color and Contrast: Ensure text has a contrast ratio of at least 4.5:1 against its background.

##

- [x] cambia azzurrino della barra in alto
- [x] scrivi in maniera più letterale le opzioni "shua" (meglio non farlo -> se sono non vedente sono abituato all'internet normale, non a forme personalizzate)
- [] pop-up con info sulle formulazioni: i per ogni opzione o singolo tasto sotto
- [x] keyboard flow non è funzionalissimo perchè il tab si blocca dentro le mail scritte (insolvibile)
- [x] testa con estensioni se lo screen reader legge solo facendo hovering (non lo fanno)
- [x] "accetta tutto" e "rifiuta tutto" ora ci sono sempre ma hanno display none. non va bene
- [x] animazione caricamento dopo aver premuto analizza
- [x] verify pop up messages are all solid. unify their logic. check if there are federica's messages left over

### user flow

- [] firefox compatibility
- [] se non si seleziona nulla, quale opzione viene usata premendo analizza ? sembrerebbe la prima. va bene o va bloccato il bottone se prima non si seleziona?
- [] dopo analisi effettuata, prima di aver accettato tutte le proposte, va bloccato il tasto analisi? potremmo farlo sparire
- [] se riavvio analisi, serve impedire che ri-analizzi cose appena cambiate? andrebbero indicate in qualche modo ed escluse dall'analisi ?
- [x] pop-up che dica "premi sulle singole ri-formulazioni per accettare, rifiutare o proporre una tua riformulazione"
- [] oppure, navigatore sul main widget per manipolare le singole evidenziazioni: sarebbe più chiaro ma complex e renderebbe affollato il widget
- [] mettere su una seconda linea i tasti "accetta tutto" e "rifiuta tutto" ?
- [x] cambiare user flow della riformulazione: rimuovere tasto edit, cambiare comportamento del tasto back, aggiungere "salva e accetta"
- [x] cambiare graficamente per rendere più armonioso il box del cambio annotazione
- [x] aumentare dimensione del logo iniziale del widget
- [] effettuare test su individui con problemi visivi per i colori del logo (semanticamente avere due colori separati non ha un vero motivo)
- [] potenzialmente ingrandire il widget: nessun lato negativo nel farlo
- [] time limit al loading dell'analisi
- [] rimettere i popup in alto, nell'aria live, e dargli dei limiti di espansione orizzontale come il widget direi

### privacy policy 

- [x] verificare ad una ad una le permission date all'estensione e perchè servono
- [] privacy notice
- [] encription e decription dei dati

permissions test: removing all permissions caused no error.
Possibly because 
```
"host_permissions": [
    "https://mail.google.com/*",
    "https://docs.google.com/*"
  ],
```
already gives the needed permission to read data and run code.

the permission "storage" was kept because it will be needed to store local data
or id, but at the current stage could be removed.
