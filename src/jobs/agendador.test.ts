import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CRON_COLETA_PADRAO,
  CRON_RESUMO_PADRAO,
  iniciarAgendador,
  TIMEZONE_PADRAO,
  type Agendador,
} from "./agendador.js";
import type { Logger } from "./logger.js";

function criarLoggerMemoria() {
  const infos: string[] = [];
  const errors: Array<{ mensagem: string; erro: unknown }> = [];
  const logger: Logger = {
    info: (m) => infos.push(m),
    warn: () => {},
    error: (mensagem, erro) => errors.push({ mensagem, erro }),
  };
  return { logger, infos, errors };
}

describe("iniciarAgendador", () => {
  const agendadores: Agendador[] = [];

  afterEach(async () => {
    while (agendadores.length > 0) {
      await agendadores.pop()?.parar();
    }
  });

  it("agenda coleta e resumo com padrões (8h America/Recife) e encerra corretamente", async () => {
    const aoColetar = vi.fn(async () => {});
    const aoEnviarResumo = vi.fn(async () => {});
    const { logger, infos } = criarLoggerMemoria();

    const agendador = iniciarAgendador({
      aoColetar,
      aoEnviarResumo,
      logger,
    });
    agendadores.push(agendador);

    expect(agendador.tarefas.coleta.getPattern()).toBe(CRON_COLETA_PADRAO);
    expect(agendador.tarefas.resumo.getPattern()).toBe(CRON_RESUMO_PADRAO);
    expect(infos.some((i) => i.includes(`tz=${TIMEZONE_PADRAO}`))).toBe(true);

    await agendador.executarColetaAgora();
    await agendador.executarResumoAgora();

    expect(aoColetar).toHaveBeenCalledTimes(1);
    expect(aoEnviarResumo).toHaveBeenCalledTimes(1);

    await agendador.parar();
    expect(infos.some((i) => i.includes("[agendador] jobs encerrados"))).toBe(true);
  });

  it("captura e loga erros dos jobs sem derrubar o processo", async () => {
    const { logger, errors } = criarLoggerMemoria();
    const agendador = iniciarAgendador({
      aoColetar: async () => {
        throw new Error("falha na coleta");
      },
      aoEnviarResumo: async () => {
        throw new Error("falha no telegram");
      },
      logger,
    });
    agendadores.push(agendador);

    await expect(agendador.executarColetaAgora()).resolves.toBeUndefined();
    await expect(agendador.executarResumoAgora()).resolves.toBeUndefined();

    expect(errors).toHaveLength(2);
    expect(errors[0]?.mensagem).toContain("[coleta]");
    expect((errors[0]?.erro as Error).message).toBe("falha na coleta");
    expect(errors[1]?.mensagem).toContain("[resumo]");
    expect((errors[1]?.erro as Error).message).toBe("falha no telegram");
  });

  it("rejeita expressões cron inválidas antes de agendar", () => {
    const { logger } = criarLoggerMemoria();

    expect(() =>
      iniciarAgendador({
        cronColeta: "cron-invalido",
        aoColetar: async () => {},
        aoEnviarResumo: async () => {},
        logger,
      }),
    ).toThrow(/coleta/);

    expect(() =>
      iniciarAgendador({
        cronResumo: "99 99 * * *",
        aoColetar: async () => {},
        aoEnviarResumo: async () => {},
        logger,
      }),
    ).toThrow(/resumo/);
  });
});
