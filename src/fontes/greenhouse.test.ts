import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { criarFonteGreenhouse } from "./greenhouse.js";
import type { FetchFn } from "./tipos.js";

const FIXTURE = readFileSync(
  path.resolve(import.meta.dirname, "__fixtures__/greenhouse-jobs.json"),
  "utf-8",
);

describe("criarFonteGreenhouse", () => {
  it("converte vagas da fixture, limpa HTML escapado, extrai Work Model e filtra por data", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => {
      return new Response(FIXTURE, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const fonte = criarFonteGreenhouse(
      { slug: "wildlifestudios", nome: "Wildlife Studios" },
      { fetchFn: fetchMock },
    );

    const vagas = await fonte.buscar(new Date("2026-11-18T00:00:00Z"));

    expect(fonte.nome).toBe("greenhouse:wildlifestudios");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/wildlifestudios/jobs?content=true",
      expect.any(Object),
    );

    expect(vagas).toHaveLength(1);
    expect(vagas[0]).toEqual({
      fonte: "greenhouse",
      origem: "wildlifestudios",
      idExterno: "6214098",
      titulo: "Software Engineer - Backend",
      empresa: "Wildlife Studios",
      descricao: "Venha trabalhar com Node.js & TypeScript .\nPostgreSQL\nAWS",
      url: "https://job-boards.greenhouse.io/wildlifestudios/jobs/6214098",
      local: "São Paulo, Brazil",
      labels: ["Engineering"],
      modalidadeBruta: "Hybrid",
      publicadaEm: "2026-11-18T15:30:00-03:00",
    });
  });

  it("lança erro quando o slug não existe (404)", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => new Response("Not Found", { status: 404 }));
    const fonte = criarFonteGreenhouse(
      { slug: "inexistente", nome: "Inexistente" },
      { fetchFn: fetchMock },
    );

    await expect(fonte.buscar(new Date("2026-11-18T00:00:00Z"))).rejects.toThrow(/HTTP 404/);
  });
});
