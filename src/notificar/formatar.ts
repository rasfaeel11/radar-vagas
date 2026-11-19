import { InlineKeyboard } from "grammy";
import type { Modalidade } from "../core/tipos.js";
import type { ResumoPorFonte, TipoAcao, VagaSalva } from "../store/tipos.js";

const ROTULO_MODALIDADE: Record<Modalidade, string> = {
  remoto: "Remoto",
  hibrido: "Híbrido",
  presencial: "Presencial",
  desconhecida: "Modalidade não informada",
};

const ROTULO_ACAO: Record<TipoAcao, string> = {
  apliquei: "✅ Status: Apliquei",
  descartar: "❌ Status: Descartada",
};

const PREFIXO_ACAO: Record<TipoAcao, string> = {
  apliquei: "a:",
  descartar: "d:",
};

export function escaparHtmlTelegram(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Codifica ação + id da vaga para `callback_data` do Telegram (limite de 64 bytes).
 * Usa prefixo curto (`a:` / `d:`) para maximizar o espaço disponível para o ID.
 */
export function codificarCallback(acao: TipoAcao, vagaId: string): string {
  const payload = `${PREFIXO_ACAO[acao]}${vagaId}`;
  if (Buffer.byteLength(payload, "utf-8") > 64) {
    throw new Error(`callback_data excede 64 bytes para vaga "${vagaId}"`);
  }
  return payload;
}

export function decodificarCallback(data: string): { acao: TipoAcao; vagaId: string } | null {
  if (data.startsWith("a:") && data.length > 2) {
    return { acao: "apliquei", vagaId: data.slice(2) };
  }
  if (data.startsWith("d:") && data.length > 2) {
    return { acao: "descartar", vagaId: data.slice(2) };
  }
  return null;
}

export function criarTecladoVaga(vagaId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Apliquei", codificarCallback("apliquei", vagaId))
    .text("❌ Descartar", codificarCallback("descartar", vagaId));
}

/**
 * Formata uma vaga para envio no Telegram (HTML):
 * título, empresa, modalidade, score, os 2 primeiros motivos e o link.
 */
export function formatarVaga(vaga: VagaSalva, acaoRegistrada?: TipoAcao): string {
  const titulo = escaparHtmlTelegram(vaga.titulo);
  const empresa = escaparHtmlTelegram(vaga.empresa);
  const modalidade = ROTULO_MODALIDADE[vaga.modalidade];
  const score = vaga.score ?? 0;
  const url = escaparHtmlTelegram(vaga.url);

  const linhas = [
    `<b>${titulo}</b>`,
    `${empresa} • ${modalidade} • Score: <b>${score}</b>`,
  ];

  const motivos = vaga.motivos.slice(0, 2);
  for (const motivo of motivos) {
    linhas.push(`• ${escaparHtmlTelegram(motivo)}`);
  }

  linhas.push(`<a href="${url}">Abrir vaga</a>`);

  if (acaoRegistrada) {
    linhas.push("", `<i>${ROTULO_ACAO[acaoRegistrada]}</i>`);
  }

  return linhas.join("\n");
}

export function formatarResumoSemana(itens: readonly ResumoPorFonte[]): string {
  if (itens.length === 0) {
    return "<b>Resumo dos últimos 7 dias</b>\n\nNenhuma vaga enviada ou avaliada no período.";
  }

  const linhas = ["<b>Resumo dos últimos 7 dias</b>", ""];
  let totalRecebidas = 0;
  let totalAplicadas = 0;
  let totalDescartadas = 0;

  for (const item of itens) {
    totalRecebidas += item.recebidas;
    totalAplicadas += item.aplicadas;
    totalDescartadas += item.descartadas;
    linhas.push(
      `<b>${escaparHtmlTelegram(item.fonte)}</b>: ${item.recebidas} recebidas · ${item.aplicadas} aplicadas · ${item.descartadas} descartadas`,
    );
  }

  linhas.push(
    "",
    `<b>Total</b>: ${totalRecebidas} recebidas · ${totalAplicadas} aplicadas · ${totalDescartadas} descartadas`,
  );

  return linhas.join("\n");
}
