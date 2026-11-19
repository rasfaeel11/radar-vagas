import type { VagaBruta } from "../core/tipos.js";

/** Interface comum que todo adaptador de `src/fontes/` implementa. */
export interface AdaptadorFonte {
  /** Identificador legível da fonte/origem (ex.: "github:backend-br/vagas", "lever:neon"). */
  readonly nome: string;
  buscar(desde: Date): Promise<VagaBruta[]>;
}

/** Assinatura de `fetch` injetável para testes sem rede. */
export type FetchFn = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface ErroColeta {
  fonte: string;
  erro: Error;
}

export interface ResultadoColeta {
  vagas: VagaBruta[];
  erros: ErroColeta[];
}
