import type { VagaBruta } from "../core/tipos.js";
import type { AdaptadorFonte, FetchFn } from "./tipos.js";

interface GithubLabel {
  name?: string;
}

interface GithubIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  created_at: string;
  labels: Array<string | GithubLabel>;
  pull_request?: unknown;
}

export interface OpcoesGithub {
  token?: string;
  fetchFn?: FetchFn;
}

const SEGMENTOS_NAO_EMPRESA = new Set([
  "remoto",
  "remote",
  "hibrido",
  "híbrido",
  "hybrid",
  "presencial",
  "onsite",
  "clt",
  "pj",
  "estagio",
  "estágio",
  "junior",
  "júnior",
  "pleno",
  "senior",
  "sênior",
  "especialista",
  "freelance",
]);

/**
 * Tenta descobrir o nome da empresa a partir do título de uma issue de vaga.
 * Padrões reais observados em `backend-br/vagas` e família:
 * - `[Remote] Product Engineer na JotPsych`
 * - `[Remoto] Dev Backend @ Empresa X`
 * - `[Remoto] Desenvolvedor(a) Backend Pleno - White Label e Plataforma - Mimix AI`
 */
export function extrairEmpresaDoTitulo(titulo: string): string | null {
  const semColchetes = titulo.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  if (!semColchetes) return null;

  // Padrão 1: "... na Empresa", "... at Empresa", "... @ Empresa"
  const matchPreposicao = semColchetes.match(/(?:\s+(?:na|no|at)\s+|\s*@\s*)([^|\-[\]]+)$/i);
  if (matchPreposicao?.[1]) {
    const candidata = matchPreposicao[1].trim();
    if (candidata && !SEGMENTOS_NAO_EMPRESA.has(candidata.toLowerCase())) {
      return candidata;
    }
  }

  // Padrão 2: último segmento separado por " - " ou " | "
  const partes = semColchetes
    .split(/\s+[-|]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (partes.length >= 2) {
    const ultima = partes[partes.length - 1];
    if (ultima && !SEGMENTOS_NAO_EMPRESA.has(ultima.toLowerCase())) {
      return ultima;
    }
  }

  return null;
}

function extrairLabels(labels: GithubIssue["labels"]): string[] {
  const resultado: string[] = [];
  for (const label of labels) {
    const nome = typeof label === "string" ? label : label.name;
    if (nome && nome.trim()) {
      resultado.push(nome.trim());
    }
  }
  return resultado;
}

/** Cria um adaptador para um repositório de vagas no GitHub (ex.: `"backend-br/vagas"`). */
export function criarFonteGithub(repo: string, opcoes: OpcoesGithub = {}): AdaptadorFonte {
  const fetchFn: FetchFn = opcoes.fetchFn ?? fetch;

  return {
    nome: `github:${repo}`,
    async buscar(desde: Date): Promise<VagaBruta[]> {
      const url = new URL(`https://api.github.com/repos/${repo}/issues`);
      url.searchParams.set("state", "open");
      url.searchParams.set("since", desde.toISOString());
      url.searchParams.set("per_page", "100");

      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "radar-vagas",
        "X-GitHub-Api-Version": "2022-11-28",
      };
      if (opcoes.token) {
        headers.Authorization = `Bearer ${opcoes.token}`;
      }

      const resposta = await fetchFn(url.toString(), { headers });
      if (!resposta.ok) {
        throw new Error(`GitHub (${repo}) retornou HTTP ${resposta.status}`);
      }

      const dados: unknown = await resposta.json();
      if (!Array.isArray(dados)) {
        throw new Error(`GitHub (${repo}) devolveu resposta inesperada (não é array)`);
      }

      const limiteMs = desde.getTime();
      const vagas: VagaBruta[] = [];

      for (const issue of dados as GithubIssue[]) {
        // Endpoint de issues também inclui pull requests
        if (issue.pull_request) continue;
        // `since` filtra por `updated_at`; garantimos criação >= `desde`
        if (Date.parse(issue.created_at) < limiteMs) continue;

        vagas.push({
          fonte: "github",
          origem: repo,
          idExterno: String(issue.number),
          titulo: issue.title,
          empresa: extrairEmpresaDoTitulo(issue.title),
          descricao: issue.body ?? "",
          url: issue.html_url,
          local: null,
          labels: extrairLabels(issue.labels ?? []),
          modalidadeBruta: null,
          publicadaEm: issue.created_at,
        });
      }

      return vagas;
    },
  };
}

export function criarFontesGithub(
  repos: readonly string[],
  opcoes: OpcoesGithub = {},
): AdaptadorFonte[] {
  return repos.map((repo) => criarFonteGithub(repo, opcoes));
}
