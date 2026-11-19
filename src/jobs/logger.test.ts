import { describe, expect, it } from "vitest";
import { criarLoggerConsole, type NivelLog } from "./logger.js";

describe("criarLoggerConsole", () => {
  it("formata timestamp ISO, nível e mensagem para info, warn e error", () => {
    const linhas: Array<{ nivel: NivelLog; linha: string }> = [];
    const logger = criarLoggerConsole({
      agora: () => new Date("2026-11-19T11:00:00.000Z"),
      escrever: (nivel, linha) => linhas.push({ nivel, linha }),
    });

    logger.info("[coleta] iniciando");
    logger.warn("[coleta] fonte falhou");
    logger.error("[coleta] erro fatal", new Error("timeout"));
    logger.error("[coleta] erro texto", "falha simples");

    expect(linhas).toEqual([
      { nivel: "info", linha: "[2026-11-19T11:00:00.000Z] [INFO] [coleta] iniciando" },
      { nivel: "warn", linha: "[2026-11-19T11:00:00.000Z] [WARN] [coleta] fonte falhou" },
      {
        nivel: "error",
        linha: "[2026-11-19T11:00:00.000Z] [ERROR] [coleta] erro fatal — timeout",
      },
      {
        nivel: "error",
        linha: "[2026-11-19T11:00:00.000Z] [ERROR] [coleta] erro texto — falha simples",
      },
    ]);
  });
});
