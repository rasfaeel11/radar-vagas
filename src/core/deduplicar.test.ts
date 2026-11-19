import { describe, expect, it } from "vitest";
import { chaveDedup, deduplicar, type VagaVista } from "./deduplicar.js";
import type { Vaga } from "./tipos.js";

const AGORA = new Date("2026-11-19T12:00:00Z");

function vaga(
  id: string,
  empresa: string,
  titulo: string,
  publicadaEm = "2026-11-19T08:00:00Z",
): Vaga {
  return {
    id,
    fonte: "github",
    origem: "backend-br/vagas",
    url: `https://example.com/${id}`,
    titulo,
    tituloNormalizado: titulo,
    empresa,
    empresaNormalizada: empresa,
    descricao: "",
    descricaoNormalizada: "",
    labels: [],
    local: null,
    nivel: "junior",
    modalidade: "remoto",
    contrato: "pj",
    publicadaEm,
  };
}

const vista = (empresa: string, titulo: string, publicadaEm: string): VagaVista => ({
  empresaNormalizada: empresa,
  tituloNormalizado: titulo,
  publicadaEm,
});

describe("chaveDedup", () => {
  it("combina empresa e título normalizados", () => {
    expect(chaveDedup(vaga("1", "neon", "desenvolvedor junior"))).toBe("neon|desenvolvedor junior");
  });
});

describe("deduplicar", () => {
  it("mantém vagas inéditas", () => {
    const novas = [vaga("1", "neon", "dev node"), vaga("2", "neon", "dev react")];
    expect(deduplicar(novas, [], AGORA)).toEqual(novas);
  });

  it("remove vaga já vista nos últimos 14 dias", () => {
    const novas = [vaga("1", "neon", "dev node")];
    const vistas = [vista("neon", "dev node", "2026-11-10T12:00:00Z")];
    expect(deduplicar(novas, vistas, AGORA)).toEqual([]);
  });

  it("vaga vista há mais de 14 dias não conta como duplicata", () => {
    const novas = [vaga("1", "neon", "dev node")];
    const vistas = [vista("neon", "dev node", "2026-11-04T11:59:59Z")];
    expect(deduplicar(novas, vistas, AGORA)).toHaveLength(1);
  });

  it("exatamente no limite de 14 dias ainda é duplicata", () => {
    const novas = [vaga("1", "neon", "dev node")];
    const vistas = [vista("neon", "dev node", "2026-11-05T12:00:00Z")];
    expect(deduplicar(novas, vistas, AGORA)).toEqual([]);
  });

  it("mesmo título em empresa diferente não é duplicata", () => {
    const novas = [vaga("1", "neon", "dev node")];
    const vistas = [vista("stone", "dev node", "2026-11-18T12:00:00Z")];
    expect(deduplicar(novas, vistas, AGORA)).toHaveLength(1);
  });

  it("remove duplicatas dentro do mesmo lote (fica a primeira)", () => {
    // mesma vaga postada em backend-br e frontendbr
    const a = vaga("github:backend-br/vagas:1", "mimix ai", "dev fullstack");
    const b = vaga("github:frontendbr/vagas:9", "mimix ai", "dev fullstack");
    expect(deduplicar([a, b], [], AGORA)).toEqual([a]);
  });

  it("não altera os arrays recebidos", () => {
    const novas = Object.freeze([vaga("1", "neon", "dev node")]);
    const vistas = Object.freeze([vista("neon", "dev node", "2026-11-18T12:00:00Z")]);
    expect(() => deduplicar(novas, vistas, AGORA)).not.toThrow();
    expect(novas).toHaveLength(1);
  });
});
