/**
 * @file tests/config/constantes.test.js
 * @description Pruebas de regresión determinista sobre el catálogo de constantes inmutables.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as C from "../../src/config/constantes.js";
import { ZONAS_DIOCESANAS, TOTAL_LOCALIDADES_DIOCESIS, esZonaValida } from "../../src/config/zonas.js";

describe("Catálogo de Constantes Inmutables (Regresión)", () => {
  it("Constantes físicas tienen valores correctos", () => {
    assert.strictEqual(C.G0_ESTANDAR, 9.80665);
    assert.strictEqual(C.K_KELVIN, 273.15);
    assert.strictEqual(C.GRADIENTE_TERMICO_FALLBACK, -0.65);
    assert.strictEqual(C.AZIMUT_VIENTO_GOLFO_DEG, 67.5);
  });

  it("Parámetros de horizonte y consenso coinciden con especificación", () => {
    assert.strictEqual(C.HORAS_HORIZONTE_INGESTA, 192);
    assert.strictEqual(C.HORAS_HISTORIAL_API, 168);
    assert.strictEqual(C.VENTANA_PRONOSTICO_INICIO, 168);
    assert.strictEqual(C.VENTANA_PRONOSTICO_FIN, 191);
    assert.strictEqual(C.FACTOR_DECAIMIENTO_API, 0.85);
    assert.strictEqual(C.PISO_MEMORIA_HIDRICA_MM, 15.0);
    assert.strictEqual(C.SPREAD_ALTA_MAX_MM, 5.0);
    assert.strictEqual(C.SPREAD_MODERADA_MAX_MM, 15.0);
    assert.strictEqual(C.SPREAD_MODULADOR_FRONTERA_MM, 15.0);
  });

  it("Umbrales, factores y ratios de deslave son exactos", () => {
    assert.strictEqual(C.FACTOR_RELIEVE_LADERA, 15.0);
    assert.strictEqual(C.FACTOR_RELIEVE_LOMA, 8.0);
    assert.strictEqual(C.FACTOR_RELIEVE_DEFAULT, 0.0);
    assert.strictEqual(C.DESLAVE_PISO_UMBRAL_MM, 12.0);
    assert.strictEqual(C.DESLAVE_FACTOR_N4, 1.5);
    assert.strictEqual(C.DESLAVE_FACTOR_N2, 0.70);
    assert.strictEqual(C.DESLAVE_FACTOR_MODULADOR, 0.60);
    assert.strictEqual(C.OVERRIDE_PENDIENTE_CRITICA_DEG, 45.0);
    assert.strictEqual(C.OVERRIDE_SATURACION_N4_MM, 40.0);
    assert.strictEqual(C.OVERRIDE_LLUVIA_N3_MM, 12.0);
  });

  it("Jerarquía de desempate y niveles de alerta están congelados", () => {
    assert.deepStrictEqual(C.JERARQUIA_VECTORES, [
      "DESLAVE",
      "INUNDACION",
      "AISLAMIENTO_VIAL",
      "TEMPERATURA",
      "VIENTO",
      "NIEBLA"
    ]);
    assert.strictEqual(C.MAPA_NIVELES_COLORES[1], "VERDE");
    assert.strictEqual(C.MAPA_NIVELES_COLORES[2], "AMARILLO");
    assert.strictEqual(C.MAPA_NIVELES_COLORES[3], "NARANJA");
    assert.strictEqual(C.MAPA_NIVELES_COLORES[4], "ROJO");
  });

  it("Catálogo de Zonas Diocesanas contiene exactamente 14 zonas y 405 localidades", () => {
    const zonasClaves = Object.keys(ZONAS_DIOCESANAS);
    assert.strictEqual(zonasClaves.length, 14);

    let sumaLocalidades = 0;
    for (const clave of zonasClaves) {
      sumaLocalidades += ZONAS_DIOCESANAS[clave].localidades_conteo;
    }
    assert.strictEqual(sumaLocalidades, TOTAL_LOCALIDADES_DIOCESIS);
    assert.strictEqual(TOTAL_LOCALIDADES_DIOCESIS, 405);

    assert.strictEqual(esZonaValida("SPP"), true);
    assert.strictEqual(esZonaValida("spp"), true);
    assert.strictEqual(esZonaValida("XYZ"), false);
  });
});