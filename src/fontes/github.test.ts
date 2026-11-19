import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { criarFonteGithub, extrairEmpresaDoTitulo } from "./github.js";
import type { FetchFn } from "./tipos.js";

const FIXTURE = readFileSync(
  path.resolve(import.meta.dirname, "__fixtures__/github-issues.json"),
  "utf-8",
);

describe("extrairEmpresaDoTitulo", () => {
  it("extrai empresa depois do último ' - '", () => {
    expect(
      extrairEmpresaDoTitulo(
        "[Remoto] Desenvolvedor(a) Backend Pleno - White Label e Plataforma - Mimix AI",
      ),
    ).toBe("Mimix AI");
  });

  it("extrai empresa depois de 'na', 'at' ou '@'", () => {
    expect(extrairEmpresaDoTitulo("[Remote] Product Engineer na JotPsych")).toBe("JotPsych");
    expect(extrairEmpresaDoTitulo("[Remoto] Dev Backend @ Acme Corp")).toBe("Acme Corp");
    expect(extrairEmpresaDoTitulo("Software Engineer at CoolStartup")).toBe("CoolStartup");
  });

  it("devolve null quando não há nome de empresa no título", () => {
    expect(extrairEmpresaDoTitulo("[Remoto] Desenvolvedor Júnior")).toBeNull();
    expect(extrairEmpresaDoTitulo("[Híbrido] Dev Backend - Remoto")).toBeNull();
  });
});

describe("criarFonteGithub", () => {
  it("busca issues, ignora PRs e issues criadas antes de `desde`, e envia token", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => {
      return new Response(FIXTURE, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const fonte = criarFonteGithub("backend-br/vagas", {
      token: "ghp_teste",
      fetchFn: fetchMock,
    });

    const desde = new Date("2026-11-18T00:00:00Z");
    const vagas = await fonte.buscar(desde);

    expect(fonte.nome).toBe("github:backend-br/vagas");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [urlChamada, init] = fetchMock.mock.calls[0]!;
    expect(String(urlChamada)).toContain("https://api.github.com/repos/backend-br/vagas/issues?");
    expect(String(urlChamada)).toContain("state=open");
    expect(String(urlChamada)).toContain("since=2026-11-18T00%3A00%3A00.000Z");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer ghp_teste");

    // 4 itens na fixture: 2 válidos, 1 PR ignorado, 1 issue antiga ignorada
    expect(vagas).toHaveLength(2);

    expect(vagas[0]).toEqual({
      fonte: "github",
      origem: "backend-br/vagas",
      idExterno: "12493",
      titulo: "[Remoto] Desenvolvedor(a) Backend Pleno - White Label e Plataforma - Mimix AI",
      empresa: "Mimix AI",
      descricao:
        "### Sobre a empresa\nA Mimix AI desenvolve soluções white label.\n\n### Requisitos\n- Node.js e TypeScript\n- PostgreSQL",
      url: "https://github.com/backend-br/vagas/issues/12493",
      local: null,
      labels: ["PJ", "Pleno", "Node.js", "TypeScript", "Remoto", "verificada"],
      modalidadeBruta: null,
      publicadaEm: "2026-11-18T22:39:26Z",
    });

    expect(vagas[1]?.empresa).toBe("JotPsych");
    expect(vagas[1]?.labels).toEqual(["👦 Junior", "🏢 Flexível", "⚖️ CLT"]);
  });

  it("lança erro quando a API retorna status HTTP não-2xx", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => new Response("rate limit", { status: 403 }));
    const fonte = criarFonteGithub("backend-br/vagas", { fetchFn: fetchMock });

    await expect(fonte.buscar(new Date("2026-11-18T00:00:00Z"))).rejects.toThrow(/HTTP 403/);
  });
});
