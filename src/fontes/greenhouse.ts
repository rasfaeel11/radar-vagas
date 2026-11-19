import type { EmpresaConfig } from "../config/arquivos.js";
import type { VagaBruta } from "../core/tipos.js";
import { limparHtml } from "./html.js";
import type { AdaptadorFonte, FetchFn } from "./tipos.js";

interface GreenhouseMetadata {
  name?: string;
  value?: unknown;
}

interface GreenhouseJob {
  id: number | string;
  title: string;
  company_name?: string;
  absolute_url: string;
  location?: { name?: string | null } | null;
  first_published?: string | null;
  updated_at?: string | null;
  content?: string | null;
  metadata?: GreenhouseMetadata[] | null;
  departments?: Array<{ name?: string }> | null;
}

interface GreenhouseResponse {
  jobs?: GreenhouseJob[];
}

export interface OpcoesGreenhouse {
  fetchFn?: FetchFn;
}

const REGEX_WORK_MODEL = /work\s*model|workplace|remote|modalidade/i;

function extrairModalidade(metadata: GreenhouseMetadata[] | null | undefined): string | null {
  if (!metadata) return null;
  for (const item of metadata) {
    if (item.name && REGEX_WORK_MODEL.test(item.name) && typeof item.value === "string") {
      const valor = item.value.trim();
      if (valor) return valor;
    }
  }
  return null;
}

/** Cria um adaptador para o board público do Greenhouse de uma empresa. */
export function criarFonteGreenhouse(
  empresa: EmpresaConfig,
  opcoes: OpcoesGreenhouse = {},
): AdaptadorFonte {
  const fetchFn: FetchFn = opcoes.fetchFn ?? fetch;

  return {
    nome: `greenhouse:${empresa.slug}`,
    async buscar(desde: Date): Promise<VagaBruta[]> {
      const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(empresa.slug)}/jobs?content=true`;

      const resposta = await fetchFn(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "radar-vagas",
        },
      });
      if (!resposta.ok) {
        throw new Error(`Greenhouse (${empresa.slug}) retornou HTTP ${resposta.status}`);
      }

      const dados = (await resposta.json()) as GreenhouseResponse;
      if (!dados || !Array.isArray(dados.jobs)) {
        throw new Error(`Greenhouse (${empresa.slug}) devolveu resposta sem lista "jobs"`);
      }

      const limiteMs = desde.getTime();
      const vagas: VagaBruta[] = [];

      for (const job of dados.jobs) {
        const publicadaEm = job.first_published ?? job.updated_at;
        if (!publicadaEm) continue;
        if (Date.parse(publicadaEm) < limiteMs) continue;

        const labels = (job.departments ?? [])
          .map((d) => d.name?.trim())
          .filter((n): n is string => Boolean(n));

        vagas.push({
          fonte: "greenhouse",
          origem: empresa.slug,
          idExterno: String(job.id),
          titulo: job.title,
          empresa: job.company_name?.trim() || empresa.nome,
          descricao: limparHtml(job.content ?? ""),
          url: job.absolute_url,
          local: job.location?.name?.trim() || null,
          labels,
          modalidadeBruta: extrairModalidade(job.metadata),
          publicadaEm,
        });
      }

      return vagas;
    },
  };
}

export function criarFontesGreenhouse(
  empresas: readonly EmpresaConfig[],
  opcoes: OpcoesGreenhouse = {},
): AdaptadorFonte[] {
  return empresas.map((empresa) => criarFonteGreenhouse(empresa, opcoes));
}
