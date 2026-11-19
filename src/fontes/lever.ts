import type { EmpresaConfig } from "../config/arquivos.js";
import type { VagaBruta } from "../core/tipos.js";
import { limparHtml } from "./html.js";
import type { AdaptadorFonte, FetchFn } from "./tipos.js";

interface LeverList {
  text?: string;
  content?: string;
}

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt: number;
  descriptionPlain?: string;
  additionalPlain?: string;
  lists?: LeverList[];
  workplaceType?: string;
  categories?: {
    location?: string;
    commitment?: string;
    department?: string;
    team?: string;
  };
}

export interface OpcoesLever {
  fetchFn?: FetchFn;
}

function montarDescricao(posting: LeverPosting): string {
  const partes: string[] = [];

  if (posting.descriptionPlain?.trim()) {
    partes.push(posting.descriptionPlain.trim());
  }

  for (const lista of posting.lists ?? []) {
    const titulo = lista.text?.trim();
    const conteudo = lista.content ? limparHtml(lista.content) : "";
    const bloco = [titulo, conteudo].filter(Boolean).join("\n");
    if (bloco) partes.push(bloco);
  }

  if (posting.additionalPlain?.trim()) {
    partes.push(posting.additionalPlain.trim());
  }

  return partes.join("\n\n");
}

function extrairModalidade(workplaceType: string | undefined): string | null {
  const valor = workplaceType?.trim();
  if (!valor || valor.toLowerCase() === "unspecified") return null;
  return valor;
}

/** Cria um adaptador para o board público do Lever de uma empresa. */
export function criarFonteLever(
  empresa: EmpresaConfig,
  opcoes: OpcoesLever = {},
): AdaptadorFonte {
  const fetchFn: FetchFn = opcoes.fetchFn ?? fetch;

  return {
    nome: `lever:${empresa.slug}`,
    async buscar(desde: Date): Promise<VagaBruta[]> {
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(empresa.slug)}?mode=json`;

      const resposta = await fetchFn(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "radar-vagas",
        },
      });
      if (!resposta.ok) {
        throw new Error(`Lever (${empresa.slug}) retornou HTTP ${resposta.status}`);
      }

      const dados: unknown = await resposta.json();
      if (!Array.isArray(dados)) {
        const msgErro =
          typeof dados === "object" && dados !== null && "error" in dados
            ? String((dados as { error: unknown }).error)
            : "resposta não é um array";
        throw new Error(`Lever (${empresa.slug}) falhou: ${msgErro}`);
      }

      const limiteMs = desde.getTime();
      const vagas: VagaBruta[] = [];

      for (const posting of dados as LeverPosting[]) {
        if (typeof posting.createdAt !== "number" || posting.createdAt < limiteMs) continue;

        const labels = [
          posting.categories?.commitment,
          posting.categories?.team,
          posting.categories?.department,
        ]
          .map((v) => v?.trim())
          .filter((v): v is string => Boolean(v));

        vagas.push({
          fonte: "lever",
          origem: empresa.slug,
          idExterno: posting.id,
          titulo: posting.text,
          empresa: empresa.nome,
          descricao: montarDescricao(posting),
          url: posting.hostedUrl,
          local: posting.categories?.location?.trim() || null,
          labels,
          modalidadeBruta: extrairModalidade(posting.workplaceType),
          publicadaEm: new Date(posting.createdAt).toISOString(),
        });
      }

      return vagas;
    },
  };
}

export function criarFontesLever(
  empresas: readonly EmpresaConfig[],
  opcoes: OpcoesLever = {},
): AdaptadorFonte[] {
  return empresas.map((empresa) => criarFonteLever(empresa, opcoes));
}
