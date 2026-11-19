import type { ResultadoPontuacao } from "./tipos.js";

export const SCORE_MINIMO = 40;

export interface PerfilEscolhido<P extends string> {
  perfil: P;
  resultado: ResultadoPontuacao;
}

/**
 * A vaga vai para o perfil em que teve o maior score, desde que não tenha sido
 * descartada nele e o score seja >= `minimo`. Empate: vale a ordem das chaves.
 * Devolve `null` se nenhum perfil serve.
 */
export function escolherPerfil<P extends string>(
  resultados: Readonly<Record<P, ResultadoPontuacao>>,
  minimo = SCORE_MINIMO,
): PerfilEscolhido<P> | null {
  let melhor: PerfilEscolhido<P> | null = null;
  for (const perfil of Object.keys(resultados) as P[]) {
    const resultado = resultados[perfil];
    if (resultado.descartada || resultado.score < minimo) continue;
    if (!melhor || resultado.score > melhor.resultado.score) {
      melhor = { perfil, resultado };
    }
  }
  return melhor;
}
