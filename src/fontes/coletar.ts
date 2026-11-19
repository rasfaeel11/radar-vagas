import type { EmpresasConfig } from "../config/arquivos.js";
import type { VagaBruta } from "../core/tipos.js";
import { criarFontesGithub } from "./github.js";
import { criarFontesGreenhouse } from "./greenhouse.js";
import { criarFontesLever } from "./lever.js";
import type { AdaptadorFonte, ErroColeta, FetchFn, ResultadoColeta } from "./tipos.js";

export interface OpcoesFontesPadrao {
  repos: readonly string[];
  empresas: EmpresasConfig;
  tokenGithub?: string;
  fetchFn?: FetchFn;
}

/** Monta todos os adaptadores configurados em `config/repos.json` e `config/empresas.json`. */
export function criarFontesPadrao(opcoes: OpcoesFontesPadrao): AdaptadorFonte[] {
  return [
    ...criarFontesGithub(opcoes.repos, {
      token: opcoes.tokenGithub,
      fetchFn: opcoes.fetchFn,
    }),
    ...criarFontesGreenhouse(opcoes.empresas.greenhouse, {
      fetchFn: opcoes.fetchFn,
    }),
    ...criarFontesLever(opcoes.empresas.lever, {
      fetchFn: opcoes.fetchFn,
    }),
  ];
}

/**
 * Executa todas as fontes em paralelo com isolamento de falhas:
 * se uma fonte lançar erro, as demais continuam e o erro é registrado em `erros`.
 */
export async function coletarVagas(
  fontes: readonly AdaptadorFonte[],
  desde: Date,
): Promise<ResultadoColeta> {
  const resultados = await Promise.allSettled(fontes.map((fonte) => fonte.buscar(desde)));

  const vagas: VagaBruta[] = [];
  const erros: ErroColeta[] = [];

  for (let i = 0; i < resultados.length; i++) {
    const res = resultados[i];
    const fonte = fontes[i];
    if (!res || !fonte) continue;

    if (res.status === "fulfilled") {
      vagas.push(...res.value);
    } else {
      const erro = res.reason instanceof Error ? res.reason : new Error(String(res.reason));
      erros.push({ fonte: fonte.nome, erro });
    }
  }

  return { vagas, erros };
}
