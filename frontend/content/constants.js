const LINK = Object.freeze({
  PRIVACY: "https://fairly.unito.it/privacy-policy/",
  INFO: "https://fairly.di.unito.it/approfondisci-qui-2/"
});
const STRATEGIES = Object.freeze(
  {
    CV: {
      id: "CV",
      name: "Doppia forma (M/F)",
      nestedOptions: [
        "es. gli studenti e le studenti",
        "es. i/le studenti"
      ],
      info: "Utilizzo della doppia forma maschile e femminile per riferirsi alle persone coinvolte; non comprende le persone non binarie."
    },
    CO: {
      id: "CO",
      name: "Nome astratto",
      nestedOptions: ["es. la comunità studentesca"],
      info: "Parola che indica un insieme di entità o individui, senza indicare il genere in modo esplicito."
    },
    IO: {
      id: "IO",
      name: "Forme innovative",
      nestedOptions: [
        "es. l* student*",
        "es. l@ student@",
        "es. lx studentx",
        "es. lu studentu",
        "es. lə studentə"
      ],
      info: "Utilizzo di neomorfemi, ossia simboli utilizzati per evitare la marcatura di genere maschile e femminile, includendo le persone non binarie."
    },
    IV: {
      id: "IV",
      name: "Tripla forma (M/F/N)",
      nestedOptions: [
        "es. gli studenti, le studenti e l* student*",
        "es. gli/le/l* student*"
      ],
      info: "Include le tre forme maschile, femminile e neutra per rappresentare tutte le identità di genere."
    }
  });
const DOMAINS = ["unito.it"]

const ERROR_MESSAGES = Object.freeze(
 { "INVALID_PAYLOAD": "Si è verificato un errore interno. Riprova!",
   "ANALYSIS_FAILED": "Si è verificato un errore durante l'analisi. Riprova!",
   "NETWORK_ERROR": "Si è verificato un errore di connessione. Riprova più tardi!",
   "TIMEOUT": "L'analisi ha impiegato troppo tempo. Il server potrebbe non essere disponibile."
 }

)
const POPUP_MESSAGES = Object.freeze(
  {
    "success": "success-popup",
    "warning": "warning-popup",
    "error": "error-popup",
  }
)



    
