import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Vaga } from "../core/tipos.js";
import { abrirBanco, criarRepositorio } from "./banco.js";
import type { RepositorioVagas, VagaParaSalvar } from "./tipos.js";

function criarVaga(parcial: Partial<Vaga> = {}): Vaga {
  const id = parcial.id ?? "github:backend-br/vagas:1";
  return {
    id,
    fonte: "github",
    origem: "backend-br/vagas",
    url: `https://example.com/${id}`,
    titulo: "Desenvolvedor Backend Júnior",
    tituloNormalizado: "desenvolvedor backend junior",
    empresa: "Acme",
    empresaNormalizada: "acme",
    descricao: "Node.js, TypeScript e PostgreSQL",
    descricaoNormalizada: "node.js, typescript e postgresql",
    labels: ["junior", "remoto", "clt"],
    local: null,
    nivel: "junior",
    modalidade: "remoto",
    contrato: "clt",
    publicadaEm: "2026-11-19T06:00:00.000Z",
    ...parcial,
  };
}

function entrada(
  parcialVaga: Partial<Vaga> = {},
  extras: Partial<Omit<VagaParaSalvar, "vaga">> = {},
): VagaParaSalvar {
  return {
    vaga: criarVaga(parcialVaga),
    perfil: "dev",
    score: 75,
    motivos: ["título compatível (+20)", "remoto (+15)"],
    ...extras,
  };
}

describe("RepositorioVagas (SQLite)", () => {
  let repo: RepositorioVagas;

  beforeEach(() => {
    repo = criarRepositorio(abrirBanco(":memory:"));
  });

  afterEach(() => {
    repo.fechar();
  });

  it("salva vagas novas, ignora IDs repetidos e recupera por ID", () => {
    const agora = new Date("2026-11-19T07:00:00Z");
    const inseridas1 = repo.salvarVagas(
      [
        entrada({ id: "github:backend-br/vagas:1" }),
        entrada({ id: "lever:neon:2", fonte: "lever", origem: "neon", empresa: "Neon" }),
      ],
      agora,
    );
    expect(inseridas1).toBe(2);

    // Tentar inserir a mesma vaga novamente não duplica
    const inseridas2 = repo.salvarVagas([entrada({ id: "github:backend-br/vagas:1" })], agora);
    expect(inseridas2).toBe(0);

    const salva = repo.buscarPorId("github:backend-br/vagas:1");
    expect(salva).not.toBeNull();
    expect(salva?.perfil).toBe("dev");
    expect(salva?.score).toBe(75);
    expect(salva?.motivos).toEqual(["título compatível (+20)", "remoto (+15)"]);
    expect(salva?.labels).toEqual(["junior", "remoto", "clt"]);
    expect(repo.buscarPorId("inexistente")).toBeNull();
  });

  it("lista vistas recentes dentro da janela para deduplicação (inclusive descartadas)", () => {
    repo.salvarVagas(
      [
        entrada(
          {
            id: "v-recente",
            publicadaEm: "2026-11-15T10:00:00.000Z",
            empresaNormalizada: "mimix ai",
            tituloNormalizado: "dev backend",
          },
          { perfil: null, score: null, motivos: [] },
        ),
        entrada({
          id: "v-antiga",
          publicadaEm: "2026-10-01T10:00:00.000Z",
          empresaNormalizada: "antiga",
          tituloNormalizado: "dev antigo",
        }),
      ],
      new Date("2026-11-19T07:00:00Z"),
    );

    const vistas = repo.listarVistasRecentes(new Date("2026-11-05T00:00:00Z"));
    expect(vistas).toEqual([
      {
        empresaNormalizada: "mimix ai",
        tituloNormalizado: "dev backend",
        publicadaEm: "2026-11-15T10:00:00.000Z",
      },
    ]);
  });

  it("lista vagas não enviadas das últimas 24h por perfil, ordenadas por score DESC e com limite", () => {
    const ontem = new Date("2026-11-17T06:00:00Z"); // > 24h atrás
    const hoje = new Date("2026-11-19T07:00:00Z");

    repo.salvarVagas([entrada({ id: "antiga-24h" }, { score: 95 })], ontem);
    repo.salvarVagas(
      [
        entrada({ id: "dev-60" }, { perfil: "dev", score: 60 }),
        entrada({ id: "dev-90" }, { perfil: "dev", score: 90 }),
        entrada({ id: "dev-80" }, { perfil: "dev", score: 80 }),
        entrada({ id: "dev-enviada" }, { perfil: "dev", score: 99 }),
        entrada({ id: "suporte-85" }, { perfil: "suporte", score: 85 }),
        entrada({ id: "sem-perfil" }, { perfil: null, score: null, motivos: [] }),
      ],
      hoje,
    );

    repo.registrarEnvio("dev-enviada", "dev", new Date("2026-11-19T07:30:00Z"), 101);

    const desde24h = new Date("2026-11-18T08:00:00Z");
    const top2Dev = repo.listarNaoEnviadas("dev", desde24h, 2);
    expect(top2Dev.map((v) => v.id)).toEqual(["dev-90", "dev-80"]);

    const suporte = repo.listarNaoEnviadas("suporte", desde24h, 15);
    expect(suporte.map((v) => v.id)).toEqual(["suporte-85"]);
  });

  it("registra ações e agrega resumo semanal por fonte sem contagem dupla", () => {
    const coleta = new Date("2026-11-18T07:00:00Z");
    repo.salvarVagas(
      [
        entrada({ id: "gh-1", fonte: "github" }),
        entrada({ id: "gh-2", fonte: "github" }),
        entrada({ id: "gh-antiga", fonte: "github" }),
        entrada({ id: "lv-1", fonte: "lever", origem: "neon" }),
        entrada({ id: "gr-1", fonte: "greenhouse", origem: "wildlifestudios" }),
      ],
      coleta,
    );

    // Envio antigo (fora da semana)
    repo.registrarEnvio("gh-antiga", "dev", new Date("2026-11-01T08:00:00Z"));
    repo.registrarAcao("gh-antiga", "apliquei", new Date("2026-11-01T09:00:00Z"));

    // Envios dentro da semana
    repo.registrarEnvio("gh-1", "dev", new Date("2026-11-18T08:00:00Z"), 10);
    repo.registrarEnvio("gh-2", "dev", new Date("2026-11-18T08:00:00Z"), 11);
    repo.registrarEnvio("lv-1", "dev", new Date("2026-11-18T08:00:00Z"), 12);
    repo.registrarEnvio("gr-1", "suporte", new Date("2026-11-19T08:00:00Z"), 13);

    // Ações: muda gh-1 de "descartar" para "apliquei" (deve contar só 1 vez como aplicada)
    repo.registrarAcao("gh-1", "descartar", new Date("2026-11-18T09:00:00Z"));
    repo.registrarAcao("gh-1", "apliquei", new Date("2026-11-18T09:30:00Z"));
    repo.registrarAcao("gh-2", "descartar", new Date("2026-11-18T10:00:00Z"));
    repo.registrarAcao("lv-1", "apliquei", new Date("2026-11-19T09:00:00Z"));

    const resumo = repo.resumoSemana(new Date("2026-11-12T08:00:00Z"));
    expect(resumo).toEqual([
      { fonte: "github", recebidas: 2, aplicadas: 1, descartadas: 1 },
      { fonte: "greenhouse", recebidas: 1, aplicadas: 0, descartadas: 0 },
      { fonte: "lever", recebidas: 1, aplicadas: 1, descartadas: 0 },
    ]);
  });
});
