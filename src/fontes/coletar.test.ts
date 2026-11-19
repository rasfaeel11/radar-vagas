import { describe, expect, it } from "vitest";
import type { VagaBruta } from "../core/tipos.js";
import { coletarVagas, criarFontesPadrao } from "./coletar.js";
import type { AdaptadorFonte } from "./tipos.js";

function vagaExemplo(id: string): VagaBruta {
  return {
    fonte: "github",
    origem: "backend-br/vagas",
    idExterno: id,
    titulo: "Dev Node",
    empresa: "Acme",
    descricao: "TypeScript e Postgres",
    url: `https://example.com/${id}`,
    local: null,
    labels: [],
    modalidadeBruta: "remote",
    publicadaEm: "2026-11-19T08:00:00Z",
  };
}

describe("coletarVagas", () => {
  it("isola falhas por fonte: uma fonte com erro não derruba as outras", async () => {
    const fonteOk1: AdaptadorFonte = {
      nome: "github:backend-br/vagas",
      async buscar() {
        return [vagaExemplo("1"), vagaExemplo("2")];
      },
    };
    const fonteFalha: AdaptadorFonte = {
      nome: "greenhouse:quebrada",
      async buscar() {
        throw new Error("HTTP 503");
      },
    };
    const fonteOk2: AdaptadorFonte = {
      nome: "lever:neon",
      async buscar() {
        return [vagaExemplo("3")];
      },
    };

    const resultado = await coletarVagas(
      [fonteOk1, fonteFalha, fonteOk2],
      new Date("2026-11-18T00:00:00Z"),
    );

    expect(resultado.vagas.map((v) => v.idExterno)).toEqual(["1", "2", "3"]);
    expect(resultado.erros).toHaveLength(1);
    expect(resultado.erros[0]?.fonte).toBe("greenhouse:quebrada");
    expect(resultado.erros[0]?.erro.message).toBe("HTTP 503");
  });
});

describe("criarFontesPadrao", () => {
  it("cria adaptadores para todos os repos e empresas configurados", () => {
    const fontes = criarFontesPadrao({
      repos: ["backend-br/vagas", "frontendbr/vagas"],
      empresas: {
        greenhouse: [{ slug: "wildlifestudios", nome: "Wildlife Studios" }],
        lever: [{ slug: "neon", nome: "Neon" }],
      },
    });

    expect(fontes.map((f) => f.nome)).toEqual([
      "github:backend-br/vagas",
      "github:frontendbr/vagas",
      "greenhouse:wildlifestudios",
      "lever:neon",
    ]);
  });
});
