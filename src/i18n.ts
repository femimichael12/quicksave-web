import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        home: "Home",
        blog: "Blog",
        screenshot: "Generate Screenshot",
        more: "More"
      }
    },
    fr: {
      translation: {
        home: "Accueil",
        blog: "Blog",
        screenshot: "Générer une Capture",
        more: "Plus"
      }
    },
    es: {
      translation: {
        home: "Inicio",
        blog: "Blog",
        screenshot: "Generar Captura",
        more: "Más"
      }
    }
  },

  lng: "en",
  fallbackLng: "en",

  interpolation: {
    escapeValue: false
  }
});

export default i18n;