const STRATEGIES = Object.freeze(
  {
    CV: {
      id: "CV",
      name: "Doppia forma (M/F)",
      nestedOptions: [
        "gli studenti e le studenti",
        "i/le studenti"
      ],
      info: "doppia forma Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris sit amet tincidunt lorem. Etiam ac faucibus mi."
    },
    CO: {
      id: "CO",
      name: "Nome astratto",
      nestedOptions: ["la comunità studentesca"],
      info: "nome astratto Lorem ipsum dolor sit amet, consectetur adipiscing elit."
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
      info: "forme innovative Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris sit amet tincidunt lorem. Etiam ac faucibus mi."
    },
    IV: {
      id: "IV",
      name: "Tripla forma (M/F/N)",
      nestedOptions: [
        "gli studenti, le studenti e l* student*",
        "gli/le/l* student*"
      ],
      info: "tripla forma Lorem ipsum dolor sit amet, consectetur adipiscing elit."
    }
  });
const DOMAINS = ["unito.it"]