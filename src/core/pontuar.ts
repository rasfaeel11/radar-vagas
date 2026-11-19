/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * ⚠️ REGRA DE ESTUDO (AGENTS.md §2)
 * A implementação deste arquivo é escrita À MÃO pelo autor, sem IA.
 * Agentes: não implementem, não completem e não sugiram o código pronto.
 *
 * Os testes estão em `pontuar.test.ts`. Quando começar a implementar,
 * mude `IMPLEMENTADO` para `true` para ligar os testes.
 *
 * Regras (AGENTS.md §5):
 * - termo eliminatório no título → descartada
 * - título bate com titulosBons → +20 (uma vez)
 * - cada termo de stackForte (título, descrição ou labels) → +10, máx. +40
 * - cada termo de stackOk → +5, máx. +15
 * - nível dentro de niveis → +15
 * - remoto → +15 · híbrido em local aceito → +10 · presencial fora dos locais aceitos → descartada
 * - termo eliminatório só na descrição/labels → −25 (uma vez, não elimina)
 *
 * Termos casam como palavra/expressão inteira, comparando textos normalizados.
 */
import type { Perfil, ResultadoPontuacao, Vaga } from "./tipos.js";

export const IMPLEMENTADO = false;

export function pontuar(vaga: Vaga, perfil: Perfil): ResultadoPontuacao {
  throw new Error("pontuar: não implementado");
}
