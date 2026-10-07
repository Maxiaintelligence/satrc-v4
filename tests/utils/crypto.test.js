/**
 * @file tests/utils/crypto.test.js
 * @description Pruebas unitarias para utilidades de hashing SHA-256.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcularSha256 } from "../../src/utils/crypto.js";

describe("Utilidades Criptográficas (crypto.js)", () => {
  it("Produce hashes deterministas (mismo input produce idéntico output)", () => {
    const input = "SARA_PIPELINE_HASH_TEST_2026";
    const hash1 = calcularSha256(input);
    const hash2 = calcularSha256(input);

    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64);
  });

  it("Coincide con vectores de prueba conocidos (RFC 6234 / NIST)", () => {
    assert.strictEqual(
      calcularSha256(""),
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );

    assert.strictEqual(
      calcularSha256("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );

    assert.strictEqual(
      calcularSha256("hola"),
      "b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79"
    );
  });

  it("Maneja correctamente caracteres UTF-8 complejos y acentos", () => {
    const inputUtf8 = "Arquidiócesis de Tulancingo: Huayacocotla y Tenango de Doria (Ñandú)";
    const hash = calcularSha256(inputUtf8);
    assert.strictEqual(typeof hash, "string");
    assert.strictEqual(hash.length, 64);
  });

  it("Lanza TypeError si el parámetro no es una cadena de texto", () => {
    assert.throws(() => calcularSha256(12345), TypeError);
    assert.throws(() => calcularSha256(null), TypeError);
    assert.throws(() => calcularSha256(undefined), TypeError);
  });
});