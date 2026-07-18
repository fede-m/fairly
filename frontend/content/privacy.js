function showConsentDialog() {
  /**
   * Creates the consent dialog div where the user should give their consent in order to use Fairly.
   * In case the user accepts the conditions, Fairly widget is shown on page
   * Otherwise, it is not
   * This is the draggable floating widget that appears on the page.
   * @returns {null}
   */
  const overlay = document.createElement("div");
  overlay.id = "fairly-consent-overlay";
  overlay.className = "consent-overlay"
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "fairly-consent-title");
  dialog.className = "consent-dialog"
  // Close button (counts as refusal)
  const closeBtn = document.createElement("button");
  closeBtn.className = "popup-close-btn";
  closeBtn.setAttribute("aria-label", "Chiudi finestra di consenso");
  closeBtn.appendChild(svgToNode(ICONS.close));
  closeBtn.addEventListener("click", () => {
    CONSENT_GIVEN = false;
    chrome.storage.local.set({"fairlyConsentGiven": false});
    overlay.remove();
  });
  
  // Title
  const title = document.createElement("h2");
  title.textContent = "Informativa sull'uso dei dati";
  // Paragraph
  const p1 = document.createElement("p");
  p1.textContent = "Per funzionare, Fairly invia il testo delle email ad un server dell'Università di Torino per analizzare ed eventualmente suggerire formulazioni più inclusive tramite modelli di intelligenza artificiale.";
  const p2 = document.createElement("p");
  p2.textContent = "I modelli vengono eseguiti sull'infrastruttura dell'Università di Torino e di HPC4AI. I dati non vengono condivisi con terze parti né utilizzati per l'addestramento o il miglioramento dei modelli."
  // const p3 = document.createElement("p");
  // p3.textContent = "Prima dell'analisi, il contenuto dell'email viene anonimizzato, rimuovendo eventuali informazioni personali identificalbili (Personally Identifiable Information, PII) presenti nel testo."
  const p3 = document.createElement("p");
  p3.textContent = "Fairly non conserva il testo completo delle email, ma solo eventuali porzioni di testo segnalate come non inclusive e le relative interazioni dell'utente con l'applicazione. Inoltre, l'indirizzo email dell'utente viene salvato solo dopo essere stato pseudonimizzato."
  const p4 = document.createElement("p");
  p4.textContent = "Tali dati vengono conservati esclusivamente per finalità di ricerca e possono essere consultati unicamente da personale autorizzato dell’Università di Torino."
  const p5 = document.createElement("p");
  p5.textContent = "Per saperne di più potete consultare la nostra ";
  const a = document.createElement("a");
  a.href = LINK.PRIVACY;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = "Privacy Policy";
  p5.appendChild(a);

  const btnWrap = document.createElement("div");
  btnWrap.className = "consent-dialog-btnWrap";
  const accept = document.createElement("button");
  accept.className = "accept-all-btn";
  accept.textContent = "Accetta";
  accept.addEventListener("click", () => {
    CONSENT_GIVEN = true;
    chrome.storage.local.set({"fairlyConsentGiven": true});
    overlay.remove();
    initExtension();
  });
  const refuse = document.createElement("button");
  refuse.className = "refuse-all-btn";
  refuse.textContent = "Rifiuta";
  refuse.addEventListener("click", () => {
    CONSENT_GIVEN = false;
    chrome.storage.local.set({"fairlyConsentGiven": false});
    overlay.remove();
  });

  btnWrap.appendChild(accept);
  btnWrap.appendChild(refuse);
  
  dialog.appendChild(closeBtn);
  dialog.appendChild(title);
  dialog.appendChild(p1);
  dialog.appendChild(p2);
  dialog.appendChild(p3);
  dialog.appendChild(p4);
  dialog.appendChild(p5);
  dialog.appendChild(btnWrap);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  accept.focus();
}
