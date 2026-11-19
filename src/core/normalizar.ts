/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * ⚠️ REGRA DE ESTUDO (AGENTS.md §2)
 * A implementação deste arquivo é escrita À MÃO pelo autor, sem IA.
 * Agentes: não implementem, não completem e não sugiram o código pronto.
 *
 * Os testes estão em `normalizar.test.ts`. Quando começar a implementar,
 * mude `IMPLEMENTADO` para `true` para ligar os testes.
 */
import type { Vaga, VagaBruta } from "./tipos.js";

export const IMPLEMENTADO = false;

/**
 * Minúsculas, sem acento, sem emoji, espaços colapsados e aparados.
 * Mantém pontuação que importa para stack: ".", "#", "+", "/", "-", "(", ")".
 */
export function normalizarTexto(texto: string): string {
  throw new Error("normalizarTexto: não implementado");
}

/**
 * `normalizarTexto` + remove tags entre colchetes ("[Remoto]")
 * e os prefixos "vaga para" / "vaga de". Usado na deduplicação.
 */
export function normalizarTitulo(titulo: string): string {
  throw new Error("normalizarTitulo: não implementado");
}

/** Converte a vaga crua da fonte em `Vaga`, inferindo nível, modalidade e contrato. */
export function normalizarVaga(bruta: VagaBruta): Vaga {
  throw new Error("normalizarVaga: não implementado");
}
