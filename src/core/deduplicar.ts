import type { Vaga } from "./tipos.js";

export const JANELA_DEDUP_DIAS = 14;

/** O mínimo de uma vaga já vista que a deduplicação precisa. */
export type VagaVista = Pick<Vaga, "empresaNormalizada" | "tituloNormalizado" | "publicadaEm">;

export function chaveDedup(v: Pick<Vaga, "empresaNormalizada" | "tituloNormalizado">): string {
  return `${v.empresaNormalizada}|${v.tituloNormalizado}`;
}

/**
 * Remove das `novas` as vagas que já apareceram (mesma empresa + título normalizado)
 * nos últimos `janelaDias` dias, e também as duplicatas dentro do próprio lote
 * (fica a primeira). Não altera os arrays recebidos.
 */
export function deduplicar(
  novas: readonly Vaga[],
  vistas: readonly VagaVista[],
  agora: Date,
  janelaDias = JANELA_DEDUP_DIAS,
): Vaga[] {
  const limite = agora.getTime() - janelaDias * 24 * 60 * 60 * 1000;
  const chaves = new Set(
    vistas.filter((v) => Date.parse(v.publicadaEm) >= limite).map((v) => chaveDedup(v)),
  );

  const resultado: Vaga[] = [];
  for (const vaga of novas) {
    const chave = chaveDedup(vaga);
    if (chaves.has(chave)) continue;
    chaves.add(chave);
    resultado.push(vaga);
  }
  return resultado;
}
