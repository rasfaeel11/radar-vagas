export type NomeFonte = "github" | "greenhouse" | "lever";

export type Nivel = "estagio" | "junior" | "pleno" | "senior" | "especialista" | "desconhecido";

export type Modalidade = "remoto" | "hibrido" | "presencial" | "desconhecida";

export type Contrato = "clt" | "pj" | "estagio" | "freelance" | "outro" | "desconhecido";

/**
 * O que cada adaptador de `src/fontes/` devolve.
 * O adaptador já entrega texto puro (sem HTML) e tenta preencher a empresa;
 * o resto (nível, modalidade, contrato) é inferido por `normalizarVaga`.
 */
export interface VagaBruta {
  fonte: NomeFonte;
  /** Repo do GitHub ("backend-br/vagas") ou slug da empresa ("neon"). */
  origem: string;
  /** ID da vaga na fonte (número da issue, id do Greenhouse/Lever). */
  idExterno: string;
  titulo: string;
  /** `null` quando o adaptador não conseguiu descobrir. */
  empresa: string | null;
  /** Texto puro, sem HTML. */
  descricao: string;
  url: string;
  /** Local como veio da fonte ("São Paulo", "Recife - PE", "Remoto"). */
  local: string | null;
  /** Labels/tags como vieram da fonte ("Júnior", "👦 Junior", "🏢 Flexível"). */
  labels: string[];
  /** Modalidade estruturada quando a fonte informa ("remote", "hybrid", "onsite", "Hybrid"). */
  modalidadeBruta: string | null;
  /** Data de publicação em ISO 8601. */
  publicadaEm: string;
}

/** Vaga depois de `normalizarVaga`: pronta para deduplicar, pontuar e salvar. */
export interface Vaga {
  /** `${fonte}:${origem}:${idExterno}` */
  id: string;
  fonte: NomeFonte;
  origem: string;
  url: string;

  /** Título original, só com espaços aparados. */
  titulo: string;
  /** Ver `normalizarTitulo`. */
  tituloNormalizado: string;
  /** Empresa original ("desconhecida" quando veio `null`). */
  empresa: string;
  /** Ver `normalizarTexto`. */
  empresaNormalizada: string;

  descricao: string;
  /** Ver `normalizarTexto`. */
  descricaoNormalizada: string;
  /** Cada label passada por `normalizarTexto` (sem emoji, sem acento, minúsculas). */
  labels: string[];

  local: string | null;
  nivel: Nivel;
  modalidade: Modalidade;
  contrato: Contrato;
  publicadaEm: string;
}

/** Um perfil de `config/perfis.json`. */
export interface Perfil {
  titulosBons: string[];
  stackForte: string[];
  stackOk: string[];
  eliminatorios: string[];
  niveis: Nivel[];
  modalidades: Modalidade[];
  locaisPresencialAceito: string[];
}

export interface ResultadoPontuacao {
  score: number;
  /** `true` quando a vaga foi eliminada (termo eliminatório no título, presencial fora dos locais). */
  descartada: boolean;
  /** Frases curtas explicando o score. Os 2 primeiros aparecem no Telegram. */
  motivos: string[];
}
