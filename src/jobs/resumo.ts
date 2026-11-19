import type { Bot } from "grammy";
import { enviarResumoDiario, type ResultadoResumoDiario } from "../notificar/bot.js";
import type { RepositorioVagas } from "../store/tipos.js";
import { criarLoggerConsole, type Logger } from "./logger.js";

export interface OpcoesExecucaoResumo {
  bot: Bot;
  repo: RepositorioVagas;
  chatId: number;
  topicos: Readonly<Record<string, number>>;
  agora?: Date;
  limitePorTopico?: number;
  logger?: Logger;
}

export interface ResultadoExecucaoResumo extends ResultadoResumoDiario {
  duracaoMs: number;
}

/**
 * Executa o envio do resumo diário no Telegram (até 15 vagas por tópico)
 * e registra um log simples com os totais enviados.
 */
export async function executarResumo(
  opcoes: OpcoesExecucaoResumo,
): Promise<ResultadoExecucaoResumo> {
  const inicioMs = Date.now();
  const agora = opcoes.agora ?? new Date();
  const logger = opcoes.logger ?? criarLoggerConsole();

  logger.info(`[resumo] iniciando envio diário (${agora.toISOString()})`);

  const resultado = await enviarResumoDiario({
    bot: opcoes.bot,
    repo: opcoes.repo,
    chatId: opcoes.chatId,
    topicos: opcoes.topicos,
    agora,
    limitePorTopico: opcoes.limitePorTopico,
  });

  const duracaoMs = Math.max(0, Date.now() - inicioMs);
  const detalhesPerfis = Object.entries(resultado.enviadosPorPerfil)
    .map(([perfil, qtd]) => `${perfil}=${qtd}`)
    .join(", ");

  logger.info(
    `[resumo] concluído em ${duracaoMs}ms — total=${resultado.totalEnviados}${detalhesPerfis ? ` (${detalhesPerfis})` : ""}`,
  );

  return {
    ...resultado,
    duracaoMs,
  };
}
