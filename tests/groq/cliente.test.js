/**
 * @file tests/groq/cliente.test.js
 * @description Pruebas unitarias con mocks inyectados para el cliente HTTP de Groq.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  llamarGroq,
  ErrorGroqTimeout,
  ErrorGroqRed,
  ErrorGroqHttp4xx,
  ErrorGroqSchemaInvalido,
  ErrorGroqNivelProhibido
} from "../../src/groq/cliente.js";

const mockSystemPrompt = "System prompt de prueba inmutable.";
const mockUserPrompt = {
  zona_id: "ACT",
  zona_resguardo: "Altiplano",
  localidades_evaluadas: [{ loc_id_global: "LOC_HGO_ACT_1_619360b0" }]
};

const dictamenValidoRaw = JSON.stringify({
  dictamenes: [
    {
      loc_id_global: "LOC_HGO_ACT_1_619360b0",
      titulo: "ALERTA AMARILLA POR VIENTO",
      causa: "Ráfagas de 55 km/h previstas.",
      recomendaciones: ["Asegurar láminas y techumbres.", "Evitar transitar cerca de árboles."],
      contexto: "Monitoreo diocesano activo."
    }
  ]
});

function crearMockResponse200(contenidoString, contentType = "application/json; charset=utf-8") {
  return {
    status: 200,
    headers: {
      get: (h) => (h.toLowerCase() === "content-type" ? contentType : null)
    },
    text: async () => JSON.stringify({
      choices: [{ message: { content: contenidoString } }]
    })
  };
}

describe("Cliente HTTP Groq (cliente.js)", () => {
  const noopSleep = async () => {};

  it("a) Caso exitoso: fetchFn retorna 200 con JSON válido -> retorna dictámenes e intentos=1", async () => {
    let fetchLlamado = false;
    const mockFetch = async (url, options) => {
      fetchLlamado = true;
      assert.strictEqual(options.method, "POST");
      return crearMockResponse200(dictamenValidoRaw);
    };

    const res = await llamarGroq({
      systemPrompt: mockSystemPrompt,
      userPrompt: mockUserPrompt,
      apiKey: "gsk_test_key",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b-versatile",
      fetchFn: mockFetch,
      sleepFn: noopSleep
    });

    assert.strictEqual(fetchLlamado, true);
    assert.strictEqual(res.exito, true);
    assert.strictEqual(res.dictamenes.length, 1);
    assert.strictEqual(res.intentos, 1);
  });

  it("b) Retry en 429: fetchFn retorna 429 en primer intento y 200 en el segundo -> éxito con intentos=2", async () => {
    let llamadas = 0;
    const mockFetch = async () => {
      llamadas++;
      if (llamadas === 1) {
        return {
          status: 429,
          headers: { get: () => "application/json" },
          text: async () => "Rate limit"
        };
      }
      return crearMockResponse200(dictamenValidoRaw);
    };

    const res = await llamarGroq({
      systemPrompt: mockSystemPrompt,
      userPrompt: mockUserPrompt,
      apiKey: "gsk_test_key",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b-versatile",
      fetchFn: mockFetch,
      sleepFn: noopSleep,
      maxRetries: 2
    });

    assert.strictEqual(res.exito, true);
    assert.strictEqual(res.intentos, 2);
    assert.strictEqual(llamadas, 2);
  });

  it("c) Retry en 5xx: fetchFn retorna 500 en primer intento y 200 en el segundo", async () => {
    let llamadas = 0;
    const mockFetch = async () => {
      llamadas++;
      if (llamadas === 1) {
        return {
          status: 500,
          headers: { get: () => "text/plain" },
          text: async () => "Internal Server Error"
        };
      }
      return crearMockResponse200(dictamenValidoRaw);
    };

    const res = await llamarGroq({
      systemPrompt: mockSystemPrompt,
      userPrompt: mockUserPrompt,
      apiKey: "gsk_test_key",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b-versatile",
      fetchFn: mockFetch,
      sleepFn: noopSleep,
      maxRetries: 2
    });

    assert.strictEqual(res.exito, true);
    assert.strictEqual(res.intentos, 2);
  });

  it("d) Timeout: fetchFn lanza AbortError -> ErrorGroqTimeout tras agotar reintentos con reintentable=false", async () => {
    const mockFetch = async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    };

    await assert.rejects(
      async () =>
        llamarGroq({
          systemPrompt: mockSystemPrompt,
          userPrompt: mockUserPrompt,
          apiKey: "gsk_test_key",
          baseUrl: "https://api.groq.com/openai/v1",
          model: "llama-3.3-70b-versatile",
          fetchFn: mockFetch,
          sleepFn: noopSleep,
          maxRetries: 2
        }),
      (err) => {
        assert(err instanceof ErrorGroqTimeout);
        assert.strictEqual(err.reintentable, false);
        return true;
      }
    );
  });

  it("e) Error de red: fetchFn lanza error de socket -> ErrorGroqRed", async () => {
    const mockFetch = async () => {
      throw new Error("getaddrinfo ENOTFOUND api.groq.com");
    };

    await assert.rejects(
      async () =>
        llamarGroq({
          systemPrompt: mockSystemPrompt,
          userPrompt: mockUserPrompt,
          apiKey: "gsk_test_key",
          baseUrl: "https://api.groq.com/openai/v1",
          model: "llama-3.3-70b-versatile",
          fetchFn: mockFetch,
          sleepFn: noopSleep,
          maxRetries: 2
        }),
      ErrorGroqRed
    );
  });

  it("f) Content-Type no JSON: fetchFn retorna text/html -> ErrorGroqJsonInvalido inmediato", async () => {
    const mockFetch = async () => crearMockResponse200(dictamenValidoRaw, "text/html; charset=utf-8");

    await assert.rejects(
      async () =>
        llamarGroq({
          systemPrompt: mockSystemPrompt,
          userPrompt: mockUserPrompt,
          apiKey: "gsk_test_key",
          baseUrl: "https://api.groq.com/openai/v1",
          model: "llama-3.3-70b-versatile",
          fetchFn: mockFetch,
          sleepFn: noopSleep,
          maxRetries: 2
        }),
      /Content-Type inesperado/
    );
  });

  it("g) Error HTTP 4xx (ej. 401 Unauthorized) lanza ErrorGroqHttp4xx sin reintentar", async () => {
    let llamadas = 0;
    const mockFetch = async () => {
      llamadas++;
      return {
        status: 401,
        headers: { get: () => "application/json" },
        text: async () => "Invalid API Key"
      };
    };

    await assert.rejects(
      async () =>
        llamarGroq({
          systemPrompt: mockSystemPrompt,
          userPrompt: mockUserPrompt,
          apiKey: "gsk_invalida",
          baseUrl: "https://api.groq.com/openai/v1",
          model: "llama-3.3-70b-versatile",
          fetchFn: mockFetch,
          sleepFn: noopSleep,
          maxRetries: 2
        }),
      (err) => {
        assert(err instanceof ErrorGroqHttp4xx);
        assert.strictEqual(err.status, 401);
        assert.strictEqual(err.reintentable, false);
        return true;
      }
    );

    assert.strictEqual(llamadas, 1);
  });

  it("h) Campo prohibido: respuesta contiene 'nivel' -> ErrorGroqNivelProhibido inmediato", async () => {
    let llamadas = 0;
    const payloadContaminado = JSON.stringify({
      dictamenes: [
        {
          loc_id_global: "LOC_HGO_ACT_1_619360b0",
          titulo: "ALERTA",
          causa: "Causa",
          nivel: 3,
          recomendaciones: ["R1", "R2"],
          contexto: "Ctx"
        }
      ]
    });

    const mockFetch = async () => {
      llamadas++;
      return crearMockResponse200(payloadContaminado);
    };

    await assert.rejects(
      async () =>
        llamarGroq({
          systemPrompt: mockSystemPrompt,
          userPrompt: mockUserPrompt,
          apiKey: "gsk_test_key",
          baseUrl: "https://api.groq.com/openai/v1",
          model: "llama-3.3-70b-versatile",
          fetchFn: mockFetch,
          sleepFn: noopSleep,
          maxRetries: 2
        }),
      ErrorGroqNivelProhibido
    );

    assert.strictEqual(llamadas, 1);
  });

  it("i) Schema inválido: validador schema rechaza -> ErrorGroqSchemaInvalido inmediato", async () => {
    let llamadas = 0;
    const validadorFalla = () => ({ valido: false, errores: [{ ruta: "#", mensaje: "Error schema" }] });

    const mockFetch = async () => {
      llamadas++;
      return crearMockResponse200(dictamenValidoRaw);
    };

    await assert.rejects(
      async () =>
        llamarGroq({
          systemPrompt: mockSystemPrompt,
          userPrompt: mockUserPrompt,
          apiKey: "gsk_test_key",
          baseUrl: "https://api.groq.com/openai/v1",
          model: "llama-3.3-70b-versatile",
          fetchFn: mockFetch,
          sleepFn: noopSleep,
          maxRetries: 2,
          validadorSchema: validadorFalla
        }),
      ErrorGroqSchemaInvalido
    );

    assert.strictEqual(llamadas, 1);
  });

  it("j) Verifica que el body y headers enviados al fetchFn tengan la estructura exacta", async () => {
    let bodyCapturado;
    let headersCapturados;

    const mockFetch = async (_url, options) => {
      bodyCapturado = JSON.parse(options.body);
      headersCapturados = options.headers;
      return crearMockResponse200(dictamenValidoRaw);
    };

    await llamarGroq({
      systemPrompt: mockSystemPrompt,
      userPrompt: mockUserPrompt,
      apiKey: "gsk_test_secret_123",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b-versatile",
      fetchFn: mockFetch,
      sleepFn: noopSleep
    });

    assert.strictEqual(headersCapturados.Authorization, "Bearer gsk_test_secret_123");
    assert.strictEqual(headersCapturados["Content-Type"], "application/json");
    assert.strictEqual(bodyCapturado.model, "llama-3.3-70b-versatile");
    assert.strictEqual(bodyCapturado.temperature, 0.1);
    assert.strictEqual(bodyCapturado.max_tokens, 450);
    assert.deepStrictEqual(bodyCapturado.response_format, { type: "json_object" });
    assert.strictEqual(bodyCapturado.messages[0].role, "system");
    assert.strictEqual(bodyCapturado.messages[0].content, mockSystemPrompt);

    assert.strictEqual(bodyCapturado.messages[1].role, "user");
    const userContenido = JSON.parse(bodyCapturado.messages[1].content);
    assert.strictEqual(userContenido.zona_id, "ACT");
    assert.strictEqual(userContenido.localidades_evaluadas.length, 1);
    assert.strictEqual(userContenido.localidades_evaluadas[0].loc_id_global, "LOC_HGO_ACT_1_619360b0");
  });
});