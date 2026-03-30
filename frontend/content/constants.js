const STRATEGIES = Object.freeze(
  {
    CV: {
      id: "CV",
      name: "Doppia forma (M/F)",
      nestedOptions: [
        "gli studenti e le studenti",
        "i/le studenti"
      ]
    },
    CO: {
      id: "CO",
      name: "Nome astratto",
      nestedOptions: ["la comunità studentesca"]
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
      ]
    },
    IV: {
      id: "IV",
      name: "Tripla forma (M/F/N)",
      nestedOptions: [
        "gli studenti, le studenti e l* student*",
        "gli/le/l* student*"
      ]
    }
  });
const DOMAINS = ["unito.it"]