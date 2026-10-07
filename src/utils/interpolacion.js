/**
 * @file src/utils/interpolacion.js
 * @description Algoritmo determinista de interpolación espacial bilineal sobre 4 vértices circundantes.
 */

/**
 * @typedef {Object} CeldaMalla
 * @property {number} lat - Latitud del vértice.
 * @property {number} lon - Longitud del vértice.
 * @property {number} valor - Valor numérico de la variable meteorológica.
 */

/**
 * Realiza una interpolación bilineal a partir de 4 puntos de malla circundantes.
 * @param {CeldaMalla[]} celdas - Array de 4 celdas circundantes.
 * @param {number} lat - Latitud objetivo.
 * @param {number} lon - Longitud objetivo.
 * @returns {number} Valor numérico interpolado.
 */
export function interpolarBilineal(celdas, lat, lon) {
  if (!Array.isArray(celdas) || celdas.length !== 4) {
    throw new Error("interpolarBilineal requiere un arreglo de exactamente 4 celdas circundantes.");
  }

  const lats = celdas.map(c => c.lat);
  const lons = celdas.map(c => c.lon);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const deltaLat = maxLat - minLat;
  const deltaLon = maxLon - minLon;

  if (deltaLat === 0 && deltaLon === 0) {
    return celdas[0].valor;
  }

  if (deltaLat === 0) {
    const p1 = celdas.find(c => c.lon === minLon) || celdas[0];
    const p2 = celdas.find(c => c.lon === maxLon) || celdas[1];
    const tLon = (lon - minLon) / deltaLon;
    return p1.valor + tLon * (p2.valor - p1.valor);
  }

  if (deltaLon === 0) {
    const p1 = celdas.find(c => c.lat === minLat) || celdas[0];
    const p2 = celdas.find(c => c.lat === maxLat) || celdas[1];
    const tLat = (lat - minLat) / deltaLat;
    return p1.valor + tLat * (p2.valor - p1.valor);
  }

  const cSW = celdas.find(c => c.lat === minLat && c.lon === minLon) || celdas[0];
  const cSE = celdas.find(c => c.lat === minLat && c.lon === maxLon) || celdas[1];
  const cNW = celdas.find(c => c.lat === maxLat && c.lon === minLon) || celdas[2];
  const cNE = celdas.find(c => c.lat === maxLat && c.lon === maxLon) || celdas[3];

  const x = (lon - minLon) / deltaLon;
  const y = (lat - minLat) / deltaLat;

  const rBottom = cSW.valor * (1 - x) + cSE.valor * x;
  const rTop = cNW.valor * (1 - x) + cNE.valor * x;

  return rBottom * (1 - y) + rTop * y;
}