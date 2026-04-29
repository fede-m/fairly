const STRATEGIES = Object.freeze(
  {
    CV: {
      id: "CV",
      name: "Doppia forma (M/F)",
      nestedOptions: [
        "gli studenti e le studenti",
        "i/le studenti"
      ],
      info: "La doppia forma utilizza sia il maschile che il femminile, riconoscendo le principali identità di genere."
    },
    CO: {
      id: "CO",
      name: "Nome astratto",
      nestedOptions: ["la comunità studentesca"],
      info: "Il nome astratto evita l'uso del genere, riferendosi al gruppo in modo neutro"
    },
    IO: {
      id: "IO",
      name: "Forme innovative",
      nestedOptions: [
        "l* student*",
        "l@ student@",
        "lx studentx",
        "lu studentu",
        "lə studentə"
      ],
      info: "Le forme innovative sperimentano nuovi modi per includere le identità di genere. Sono soluzioni creative, spesso adottate in contesti informali o progressisti."
    },
    IV: {
      id: "IV",
      name: "Tripla forma (M/F/N)",
      nestedOptions: [
        "gli studenti, le studenti e l* student*",
        "gli/le/l* student*"
      ],
      info: "La tripla forma include maschile, femminile e neutro per coprire tutte le identità di genere. È una scelta completa, ma può risultare complessa."
    }
  });
const DOMAINS = ["unito.it"]

const ERROR_MESSAGES = Object.freeze(
 { "INVALID_PAYLOAD": "Si è verificato un errore interno. Riprova!",
   "ANALYSIS_FAILED": "Si è verificato un errore durante l'analisi. Riprova!",
   "NETWORK_ERROR": "Si è verificato un errore di connessione. Riprova più tardi!"
 }

)
const POPUP_MESSAGES = Object.freeze(
  {
    "success": "success-popup",
    "warning": "warning-popup",
    "error": "error-popup",
  }
)



    
