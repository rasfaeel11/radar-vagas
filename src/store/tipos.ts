import type { VagaVista } from "../core/deduplicar.js";
import type { Contrato, Modalidade, Nivel, NomeFonte, Vaga } from "../core/tipos.js";

export type TipoAcao = "apliquei" | "descartar";

export interface VagaParaSalvar {
  vaga: Vaga;
  /** Nome do perfil escolhido ("dev", "suporte") ou `null` se não passou no filtro. */
  perfil: string | null;
  score: number | null;
  motivos: string[];
}

export interface VagaSalva {
  id: string;
  fonte: NomeFonte;
  origem: string;
  url: string;
  titulo: string;
  empresa: string;
  descricao: string;
  labels: string[];
  local: string | null;
  nivel: Nivel;
  modalidade: Modalidade;
  contrato: Contrato;
  publicadaEm: string;
  coletadaEm: string;
  perfil: string | null;
  score: number | null;
  motivos: string[];
}

export interface ResumoPorFonte {
  fonte: NomeFonte;
  recebidas: number;
  aplicadas: number;
  descartadas: number;
}

export interface RepositorioVagas {
  salvarVagas(entradas: readonly VagaParaSalvar[], coletadaEm: Date): number;
  listarVistasRecentes(desde: Date): VagaVista[];
  listarNaoEnviadas(perfil: string, desde: Date, limite?: number): VagaSalva[];
  buscarPorId(vagaId: string): VagaSalva | null;
  registrarEnvio(vagaId: string, perfil: string, enviadoEm: Date, messageId?: number): void;
  registrarAcao(vagaId: string, acao: TipoAcao, data: Date): void;
  resumoSemana(desde: Date): ResumoPorFonte[];
  fechar(): void;
}
