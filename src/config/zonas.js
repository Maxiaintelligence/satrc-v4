/**
 * @file src/config/zonas.js
 * @description Catálogo inmutable de las 14 zonas pastorales diocesanas de resguardo.
 */

// [Sesión 1] Catálogo oficial de las 14 zonas diocesanas de la Arquidiócesis de Tulancingo
export const ZONAS_DIOCESANAS = Object.freeze({
  ACT: {
    nombre: "Altiplano Tula–Actopan",
    entidad: "Hidalgo",
    localidades_conteo: 67,
    municipios_principales: ["Actopan", "Ajacuba", "El Arenal", "Francisco I. Madero", "San Salvador", "Tetepango"]
  },
  APN: {
    nombre: "Apan y Llanos Altos",
    entidad: "Hidalgo",
    localidades_conteo: 18,
    municipios_principales: ["Almoloya", "Apan", "Emiliano Zapata", "Tepeapulco", "Tlanalapa"]
  },
  ATG: {
    nombre: "Atotonilco–Sierra de Amajac",
    entidad: "Hidalgo",
    localidades_conteo: 16,
    municipios_principales: ["Atotonilco el Grande", "Huasca de Ocampo", "Mineral del Chico", "Mineral del Monte", "Omitlán de Juárez"]
  },
  CHG: {
    nombre: "Chignahuapan",
    entidad: "Puebla",
    localidades_conteo: 17,
    municipios_principales: ["Aquixtla", "Chignahuapan", "Ixtacamaxtitlán"]
  },
  HUA: {
    nombre: "Huauchinango y Cuenca del Necaxa",
    entidad: "Puebla",
    localidades_conteo: 32,
    municipios_principales: ["Chiconcuautla", "Huauchinango", "Jopala", "Juan Galindo", "Tlaola"]
  },
  HYC: {
    nombre: "Huayacocotla y Sierra de Vinazco",
    entidad: "Veracruz de Ignacio de la Llave",
    localidades_conteo: 13,
    municipios_principales: ["Benito Juárez", "Huayacocotla", "Ilamatlán", "Texcatepec", "Tlachichilco", "Zacualpan", "Zontecomatlán"]
  },
  PMN: {
    nombre: "Pachuca Metropolitana Norte",
    entidad: "Hidalgo",
    localidades_conteo: 13,
    municipios_principales: ["Mineral de la Reforma", "Pachuca de Soto"]
  },
  PMS: {
    nombre: "Pachuca Metropolitana Sur",
    entidad: "Hidalgo",
    localidades_conteo: 48,
    municipios_principales: ["Mineral de la Reforma", "Pachuca de Soto", "Zempoala"]
  },
  SPP: {
    nombre: "Sierra de Pahuatlán y Otomí-Tepehua",
    entidad: "Hidalgo / Puebla",
    localidades_conteo: 43,
    municipios_principales: ["Acaxochitlán", "Huehuetla", "San Bartolo Tutotepec", "Tenango de Doria", "Honey", "Naupan", "Pahuatlán", "Tlacuilotepec"]
  },
  TIZ: {
    nombre: "Tizayuca y Corredor Industrial Sur",
    entidad: "Hidalgo",
    localidades_conteo: 26,
    municipios_principales: ["Tizayuca", "Tolcayuca", "Villa de Tezontepec", "Zapotlán de Juárez"]
  },
  TUL: {
    nombre: "Valle de Tulancingo",
    entidad: "Hidalgo",
    localidades_conteo: 54,
    municipios_principales: ["Acatlán", "Agua Blanca de Iturbide", "Cuautepec de Hinojosa", "Epazoyucan", "Metepec", "Santiago Tulantepec", "Singuilucan", "Tulancingo de Bravo"]
  },
  XIC: {
    nombre: "Xicotepec y Cañón de San Marcos",
    entidad: "Puebla",
    localidades_conteo: 15,
    municipios_principales: ["Jalpan", "Tlaxco", "Xicotepec", "Zihuateutla"]
  },
  ZAC: {
    nombre: "Zacatlán y Cañadas Orientales",
    entidad: "Puebla",
    localidades_conteo: 36,
    municipios_principales: ["Ahuacatlán", "Ahuazotepec", "Cuautempan", "Tepetzintla", "Tetela de Ocampo", "Zacatlán"]
  },
  ZAH: {
    nombre: "Zacualtipán y Sierra Alta Hidalguense",
    entidad: "Hidalgo",
    localidades_conteo: 7,
    municipios_principales: ["Metztitlán", "San Agustín Metzquititlán", "Tianguistengo", "Zacualtipán de Ángeles"]
  }
});

// [Sesión 1] Total de localidades diocesanas registradas
export const TOTAL_LOCALIDADES_DIOCESIS = 405;

/**
 * Valida si un identificador de zona pertenece al catálogo oficial.
 * @param {string} zonaId - Clave de 3 letras de la zona.
 * @returns {boolean} True si es válida.
 */
export function esZonaValida(zonaId) {
  return typeof zonaId === "string" && Object.prototype.hasOwnProperty.call(ZONAS_DIOCESANAS, zonaId.toUpperCase());
}