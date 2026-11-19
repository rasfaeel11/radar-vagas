import cron, { type ScheduledTask } from "node-cron";
import { criarLoggerConsole, type Logger } from "./logger.js";

export const TIMEZONE_PADRAO = "America/Recife";
export const CRON_COLETA_PADRAO = "0 */3 * * *";
export const CRON_RESUMO_PADRAO = "0 8 * * *";

export interface OpcoesAgendador {
  cronColeta?: string;
  cronResumo?: string;
  timezone?: string;
  aoColetar: () => Promise<unknown>;
  aoEnviarResumo: () => Promise<unknown>;
  logger?: Logger;
}

export interface Agendador {
  tarefas: {
    coleta: ScheduledTask;
    resumo: ScheduledTask;
  };
  executarColetaAgora(): Promise<void>;
  executarResumoAgora(): Promise<void>;
  parar(): Promise<void>;
}

/**
 * Agenda os jobs periódicos de coleta e resumo diário via `node-cron`,
 * no fuso configurado (padrão `America/Recife`), com prevenção de sobreposição
 * e captura de erros para não derrubar o processo.
 */
export function iniciarAgendador(opcoes: OpcoesAgendador): Agendador {
  const cronColeta = opcoes.cronColeta ?? CRON_COLETA_PADRAO;
  const cronResumo = opcoes.cronResumo ?? CRON_RESUMO_PADRAO;
  const timezone = opcoes.timezone ?? TIMEZONE_PADRAO;
  const logger = opcoes.logger ?? criarLoggerConsole();

  if (!cron.validate(cronColeta)) {
    throw new Error(`Expressão cron inválida para coleta: "${cronColeta}"`);
  }
  if (!cron.validate(cronResumo)) {
    throw new Error(`Expressão cron inválida para resumo: "${cronResumo}"`);
  }

  const executarSeguro = async (nome: string, fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn();
    } catch (erro) {
      logger.error(`[${nome}] erro na execução`, erro);
    }
  };

  const executarColetaAgora = () => executarSeguro("coleta", opcoes.aoColetar);
  const executarResumoAgora = () => executarSeguro("resumo", opcoes.aoEnviarResumo);

  const coleta = cron.schedule(cronColeta, executarColetaAgora, {
    timezone,
    name: "coleta",
    noOverlap: true,
  });

  const resumo = cron.schedule(cronResumo, executarResumoAgora, {
    timezone,
    name: "resumo",
    noOverlap: true,
  });

  logger.info(
    `[agendador] jobs iniciados (tz=${timezone}) — coleta="${cronColeta}", resumo="${cronResumo}"`,
  );

  return {
    tarefas: { coleta, resumo },
    executarColetaAgora,
    executarResumoAgora,
    async parar() {
      await coleta.stop();
      await resumo.stop();
      await coleta.destroy();
      await resumo.destroy();
      logger.info("[agendador] jobs encerrados");
    },
  };
}
