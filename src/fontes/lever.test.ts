import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { criarFonteLever } from "./lever.js";
import type { FetchFn } from "./tipos.js";

const FIXTURE = readFileSync(
  path.resolve(import.meta.dirname, "__fixtures__/lever-postings.json"),
  "utf-8",
);

describe("criarFonteLever", () => {
  it("converte postings da fixture, usa nome da empresa do config e filtra por createdAt", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => {
      return new Response(FIXTURE, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const fonte = criarFonteLever({ slug: "neon", nome: "Neon" }, { fetchFn: fetchMock });

    const desde = new Date(1795000000000);
    const vagas = await fonte.buscar(desde);

    expect(fonte.nome).toBe("lever:neon");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.lever.co/v0/postings/neon?mode=json",
      expect.any(Object),
    );

    expect(vagas).toHaveLength(2);
    expect(vagas[0]).toEqual({
      fonte: "lever",
      origem: "neon",
      idExterno: "a1b2c3d4-0001",
      titulo: "Pessoa Desenvolvedora Backend Júnior",
      empresa: "Neon",
      descricao:
        "Atue na evolução das APIs da Neon com TypeScript e Postgres.\n\nRequisitos\nNode.js e TypeScript\nSQL e PostgreSQL\n\nBenefícios completos.",
      url: "https://jobs.lever.co/neon/a1b2c3d4-0001",
      local: "Brasil - Remoto",
      labels: ["CLT", "Core Banking", "Tecnologia"],
      modalidadeBruta: "remote",
      publicadaEm: new Date(1795003200000).toISOString(),
    });

    // workplaceType "unspecified" vira null
    expect(vagas[1]?.modalidadeBruta).toBeNull();
    expect(vagas[1]?.local).toBe("Recife - PE");
    expect(vagas[1]?.labels).toEqual(["CLT"]);
  });

  it('trata resposta {"ok": false, "error": "Document not found"} como erro', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => {
      return new Response(JSON.stringify({ ok: false, error: "Document not found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const fonte = criarFonteLever(
      { slug: "nao-existe", nome: "Não Existe" },
      { fetchFn: fetchMock },
    );

    await expect(fonte.buscar(new Date("2026-11-18T00:00:00Z"))).rejects.toThrow(
      /Document not found/,
    );
  });
});
