import { describe, expect, it } from "vitest";
import { validarEnv } from "./env.js";

function envValido(parcial: Record<string, string | undefined> = {}) {
  return {
    GITHUB_TOKEN: "ghp_exemplo123",
    TELEGRAM_BOT_TOKEN: "123456:ABC-DEF",
    TELEGRAM_CHAT_ID: "-1001234567890",
    TELEGRAM_USER_ID: "987654321",
    TELEGRAM_TOPICO_DEV: "2",
    TELEGRAM_TOPICO_SUPORTE: "3",
    ...parcial,
  };
}

describe("validarEnv", () => {
  it("valida variáveis obrigatórias e aplica defaults", () => {
    const env = validarEnv(envValido());
    expect(env).toEqual({
      GITHUB_TOKEN: "ghp_exemplo123",
      TELEGRAM_BOT_TOKEN: "123456:ABC-DEF",
      TELEGRAM_CHAT_ID: -1001234567890,
      TELEGRAM_USER_ID: 987654321,
      TELEGRAM_TOPICO_DEV: 2,
      TELEGRAM_TOPICO_SUPORTE: 3,
      DB_PATH: "./data/radar.db",
      TZ: "America/Recife",
      CRON_RESUMO: "0 8 * * *",
      CRON_COLETA: "0 */3 * * *",
    });
  });

  it("permite GITHUB_TOKEN ausente ou vazio (vira undefined)", () => {
    expect(validarEnv(envValido({ GITHUB_TOKEN: undefined })).GITHUB_TOKEN).toBeUndefined();
    expect(validarEnv(envValido({ GITHUB_TOKEN: "   " })).GITHUB_TOKEN).toBeUndefined();
  });

  it("permite sobrescrever defaults (DB_PATH, TZ, crons)", () => {
    const env = validarEnv(
      envValido({
        DB_PATH: "/var/lib/radar.db",
        TZ: "America/Sao_Paulo",
        CRON_RESUMO: "30 7 * * *",
        CRON_COLETA: "0 */6 * * *",
      }),
    );
    expect(env.DB_PATH).toBe("/var/lib/radar.db");
    expect(env.TZ).toBe("America/Sao_Paulo");
    expect(env.CRON_RESUMO).toBe("30 7 * * *");
    expect(env.CRON_COLETA).toBe("0 */6 * * *");
  });

  it("rejeita TELEGRAM_BOT_TOKEN ausente ou vazio", () => {
    expect(() => validarEnv(envValido({ TELEGRAM_BOT_TOKEN: "" }))).toThrow(/TELEGRAM_BOT_TOKEN/);
    expect(() => validarEnv(envValido({ TELEGRAM_BOT_TOKEN: undefined }))).toThrow(
      /TELEGRAM_BOT_TOKEN/,
    );
  });

  it("rejeita IDs do Telegram vazios ou não numéricos", () => {
    expect(() => validarEnv(envValido({ TELEGRAM_CHAT_ID: "" }))).toThrow(/TELEGRAM_CHAT_ID/);
    expect(() => validarEnv(envValido({ TELEGRAM_USER_ID: "abc" }))).toThrow(/TELEGRAM_USER_ID/);
    expect(() => validarEnv(envValido({ TELEGRAM_TOPICO_DEV: "2.5" }))).toThrow(
      /TELEGRAM_TOPICO_DEV/,
    );
  });
});
