import { Bot } from "grammy";
import type { RepositorioVagas } from "../store/tipos.js";
import {
  criarTecladoVaga,
  decodificarCallback,
  formatarResumoSemana,
  formatarVaga,
} from "./formatar.js";

const MS_24H = 24 * 60 * 60 * 1000;
const MS_7D = 7 * MS_24H;
const LIMITE_PADRAO_TOPICO = 15;

export interface ConfigSegurancaTelegram {
  chatId: number;
  userId: number;
}

export interface OpcoesBot extends ConfigSegurancaTelegram {
  token: string;
  repo: RepositorioVagas;
  /** Relógio injetável para testes determinísticos. */
  agora?: () => Date;
}

export interface OpcoesResumoDiario {
  bot: Bot;
  repo: RepositorioVagas;
  chatId: number;
  /** Mapa de nome do perfil (ex.: "dev", "suporte") para `message_thread_id`. */
  topicos: Readonly<Record<string, number>>;
  agora: Date;
  limitePorTopico?: number;
}

export interface ResultadoResumoDiario {
  enviadosPorPerfil: Record<string, number>;
  totalEnviados: number;
}

/** Verifica se o update veio exatamente do grupo e do usuário configurados no `.env`. */
export function ehAutorizado(
  chatIdAtual: number | undefined,
  userIdAtual: number | undefined,
  config: ConfigSegurancaTelegram,
): boolean {
  return chatIdAtual === config.chatId && userIdAtual === config.userId;
}

/**
 * Cria o bot do Telegram com:
 * - filtro de segurança (ignora qualquer chat/usuário diferente do `.env`);
 * - comando `/semana` (agregado por fonte nos últimos 7 dias);
 * - botões inline Apliquei / Descartar (salva em `acoes` e atualiza a mensagem).
 */
export function criarBot(opcoes: OpcoesBot): Bot {
  const bot = new Bot(opcoes.token);
  const agora = opcoes.agora ?? (() => new Date());

  // Middleware de segurança: ignora silenciosamente qualquer outro grupo ou usuário
  bot.use(async (ctx, next) => {
    if (!ehAutorizado(ctx.chat?.id, ctx.from?.id, opcoes)) {
      return;
    }
    await next();
  });

  bot.command("semana", async (ctx) => {
    const desde = new Date(agora().getTime() - MS_7D);
    const resumo = opcoes.repo.resumoSemana(desde);
    await ctx.reply(formatarResumoSemana(resumo), {
      parse_mode: "HTML",
      message_thread_id: ctx.message?.message_thread_id,
    });
  });

  bot.on("callback_query:data", async (ctx) => {
    const parsed = decodificarCallback(ctx.callbackQuery.data);
    if (!parsed) {
      await ctx.answerCallbackQuery();
      return;
    }

    const vaga = opcoes.repo.buscarPorId(parsed.vagaId);
    if (!vaga) {
      await ctx.answerCallbackQuery({ text: "Vaga não encontrada." });
      return;
    }

    opcoes.repo.registrarAcao(vaga.id, parsed.acao, agora());

    const textoToast =
      parsed.acao === "apliquei" ? "Registrado: Apliquei" : "Registrado: Descartada";
    await ctx.answerCallbackQuery({ text: textoToast });

    await ctx.editMessageText(formatarVaga(vaga, parsed.acao), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: [] },
    });
  });

  return bot;
}

/**
 * Envia o resumo diário (vagas não enviadas das últimas 24h, ordenadas por score,
 * até `limitePorTopico` por tópico) e registra cada envio em `envios`.
 */
export async function enviarResumoDiario(
  opcoes: OpcoesResumoDiario,
): Promise<ResultadoResumoDiario> {
  const limite = opcoes.limitePorTopico ?? LIMITE_PADRAO_TOPICO;
  const desde = new Date(opcoes.agora.getTime() - MS_24H);

  const enviadosPorPerfil: Record<string, number> = {};
  let totalEnviados = 0;

  for (const [perfil, threadId] of Object.entries(opcoes.topicos)) {
    const vagas = opcoes.repo.listarNaoEnviadas(perfil, desde, limite);
    let enviados = 0;

    for (const vaga of vagas) {
      const msg = await opcoes.bot.api.sendMessage(opcoes.chatId, formatarVaga(vaga), {
        message_thread_id: threadId,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: criarTecladoVaga(vaga.id),
      });

      opcoes.repo.registrarEnvio(vaga.id, perfil, opcoes.agora, msg.message_id);
      enviados += 1;
      totalEnviados += 1;
    }

    enviadosPorPerfil[perfil] = enviados;
  }

  return { enviadosPorPerfil, totalEnviados };
}
