import { deduplicar, JANELA_DEDUP_DIAS } from "../core/deduplicar.js";
import { escolherPerfil, SCORE_MINIMO } from "../core/escolherPerfil.js";
import { normalizarVaga as normalizarVagaPadrao } from "../core/normalizar.js";
import { pontuar as pontuarPadrao } from "../core/pontuar.js";
import type { Perfil, ResultadoPontuacao, Vaga, VagaBruta } from "../core/tipos.js";
import { coletarVagas } from "../fontes/coletar.js";
import type { AdaptadorFonte, ErroColeta } from "../fontes/tipos.js";
import type { RepositorioVagas, VagaParaSalvar } from "../store/tipos.js";
import { criarLoggerConsole, type Logger } from "./logger.js";

const MS_HORA = 60 * 60 * 1000;
const MS_DIA = 24 * MS_HORA;
export const JANELA_COLETA_HORAS_PADRAO = 24;

export interface OpcoesExecucaoColeta {
  fontes: readonly AdaptadorFonte[];
  perfis: Readonly<Record<string, Perfil>>;
  repo: RepositorioVagas;
  agora?: Date;
  janelaColetaHoras?: number;
  janelaDedupDias?: number;
  scoreMinimo?: number;
  logger?: Logger;
  /** Injetáveis para testes sem depender da implementação manual de `normalizar`/`pontuar`. */
  normalizar?: (bruta: VagaBruta) => Vaga;
  pontuar?: (vaga: Vaga, perfil: Perfil) => ResultadoPontuacao;
}

export interface ResultadoExecucaoColeta {
  brutas: number;
  errosFontes: ErroColeta[];
  aposDeduplicacao: number;
  aprovadas: number;
  descartadas: number;
  salvas: number;
  duracaoMs: number;
}

/**
 * Executa o pipeline completo de coleta:
 * fontes → normalizar → deduplicar → pontuar → escolherPerfil → salvar.
 */
export async function executarColeta(
  opcoes: OpcoesExecucaoColeta,
): Promise<ResultadoExecucaoColeta> {
  const inicioMs = Date.now();
  const agora = opcoes.agora ?? new Date();
  const janelaColetaHoras = opcoes.janelaColetaHoras ?? JANELA_COLETA_HORAS_PADRAO;
  const janelaDedupDias = opcoes.janelaDedupDias ?? JANELA_DEDUP_DIAS;
  const scoreMinimo = opcoes.scoreMinimo ?? SCORE_MINIMO;
  const logger = opcoes.logger ?? criarLoggerConsole();
  const normalizar = opcoes.normalizar ?? normalizarVagaPadrao;
  const pontuar = opcoes.pontuar ?? pontuarPadrao;

  const desdeColeta = new Date(agora.getTime() - janelaColetaHoras * MS_HORA);
  const desdeDedup = new Date(agora.getTime() - janelaDedupDias * MS_DIA);

  logger.info(
    `[coleta] iniciando (${opcoes.fontes.length} fontes, desde ${desdeColeta.toISOString()})`,
  );

  const { vagas: brutas, erros: errosFontes } = await coletarVagas(opcoes.fontes, desdeColeta);

  for (const erroFonte of errosFontes) {
    logger.warn(`[coleta] falha na fonte ${erroFonte.fonte}: ${erroFonte.erro.message}`);
  }

  const normalizadas = brutas.map((bruta) => normalizar(bruta));
  const vistas = opcoes.repo.listarVistasRecentes(desdeDedup);
  const unicas = deduplicar(normalizadas, vistas, agora, janelaDedupDias);

  const entradasPerfis = Object.entries(opcoes.perfis);
  const paraSalvar: VagaParaSalvar[] = [];
  let aprovadas = 0;
  let descartadas = 0;

  for (const vaga of unicas) {
    const resultados: Record<string, ResultadoPontuacao> = {};
    for (const [nomePerfil, perfil] of entradasPerfis) {
      resultados[nomePerfil] = pontuar(vaga, perfil);
    }

    const escolhido = escolherPerfil(resultados, scoreMinimo);
    if (escolhido) {
      aprovadas += 1;
      paraSalvar.push({
        vaga,
        perfil: escolhido.perfil,
        score: escolhido.resultado.score,
        motivos: escolhido.resultado.motivos,
      });
    } else {
      descartadas += 1;
      paraSalvar.push({
        vaga,
        perfil: null,
        score: null,
        motivos: [],
      });
    }
  }

  const salvas = opcoes.repo.salvarVagas(paraSalvar, agora);
  const duracaoMs = Math.max(0, Date.now() - inicioMs);

  logger.info(
    `[coleta] concluída em ${duracaoMs}ms — brutas=${brutas.length}, únicas=${unicas.length}, aprovadas=${aprovadas}, descartadas=${descartadas}, salvas=${salvas}, errosFontes=${errosFontes.length}`,
  );

  return {
    brutas: brutas.length,
    errosFontes,
    aposDeduplicacao: unicas.length,
    aprovadas,
    descartadas,
    salvas,
    duracaoMs,
  };
}
