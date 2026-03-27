### TODOs
- Improve the UI (change colors, disposition of elements, dimension etc. to make it more functional and beautiful) 
- Add any feature that would make the tool accessible for everyone (e.g. add alt text etc.)
- Add some animation while loading: it takes very long before we receive a response from the model (slow API call to HPC4AI servers) but the user does not have any indication that something is happening in the background. We should add some form of animation showing that the process has started and the user should wait for a response
- Store the following events (and others tbd) in MongoDB (NOTE: a session id is already created at the beginning in `initExtension` and should be used in combination with current datetime, to follow the interaction of the user with the tool):
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
- [] scrivi in maniera più letterale le opzioni "shua"
- [] pop-up con info sulle formulazioni: i per ogni opzione o singolo tasto sotto
- [x] keyboard flow non è funzionalissimo perchè il tab si blocca dentro le mail scritte (insolvibile)
- [] testa con estensioni se lo screen reader legge solo facendo hovering
- [x] "accetta tutto" e "rifiuta tutto" ora ci sono sempre ma hanno display none. non va bene
- [x] animazione caricamento dopo aver premuto analizza
- [] verify pop up messages are all solid. unify their logic. check if there are federica's messages left over

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
