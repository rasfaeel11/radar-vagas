import { describe, expect, it } from "vitest";
import perfisJson from "../../config/perfis.json" with { type: "json" };
import { IMPLEMENTADO, pontuar } from "./pontuar.js";
import type { Perfil, Vaga } from "./tipos.js";

const perfis = perfisJson as unknown as Record<"dev" | "suporte", Perfil>;
const dev = perfis.dev;
const suporte = perfis.suporte;

/**
 * Vaga já normalizada. Os textos aqui JÁ estão como `normalizarTexto` devolveria
 * (minúsculas, sem acento), para os testes de pontuar não dependerem de normalizar.
 * Padrão: score 0 nos dois perfis (título neutro, nível pleno, modalidade desconhecida).
 */
function vaga(p: {
  titulo?: string;
  descricao?: string;
  labels?: string[];
  nivel?: Vaga["nivel"];
  modalidade?: Vaga["modalidade"];
  local?: string | null;
}): Vaga {
  const titulo = p.titulo ?? "analista";
  const descricao = p.descricao ?? "";
  return {
    id: "github:backend-br/vagas:1",
    fonte: "github",
    origem: "backend-br/vagas",
    url: "https://github.com/backend-br/vagas/issues/1",
    titulo,
    tituloNormalizado: titulo,
    empresa: "empresa x",
    empresaNormalizada: "empresa x",
    descricao,
    descricaoNormalizada: descricao,
    labels: p.labels ?? [],
    local: p.local ?? null,
    nivel: p.nivel ?? "pleno",
    modalidade: p.modalidade ?? "desconhecida",
    contrato: "desconhecido",
    publicadaEm: "2026-11-18T12:00:00Z",
  };
}

describe.skipIf(!IMPLEMENTADO)("pontuar", () => {
  it("vaga neutra tem score 0 e não é descartada", () => {
    expect(pontuar(vaga({}), dev)).toMatchObject({ score: 0, descartada: false });
    expect(pontuar(vaga({}), suporte)).toMatchObject({ score: 0, descartada: false });
  });

  describe("casos reais do backend-br/vagas", () => {
    it("#12493 Back-end Júnior Python/TS remoto → 75 no perfil dev", () => {
      const v = vaga({
        titulo: "desenvolvedor(a) back-end junior - python / ai coding & agentic ai - mkdigital",
        descricao:
          "a mkdigital e uma startup suica de tecnologia e inteligencia artificial. " +
          "voce vai construir apis e agentes com python e fastapi.",
        labels: [
          "pj",
          "junior",
          "javascript",
          "python",
          "remoto",
          "testes automatizados",
          "typescript",
          "postgresql",
          "sql",
          "git",
          "linux",
          "docker",
          "ci/cd",
          "contrato",
          "verificada",
          "fastapi",
        ],
        nivel: "junior",
        modalidade: "remoto",
      });
      // título "desenvolvedor"              +20
      // stackForte: typescript (label)      +10   ("postgres" NÃO casa com "postgresql")
      // stackOk: python, sql, javascript    +15
      // nível junior                        +15
      // remoto                              +15
      const r = pontuar(v, dev);
      expect(r.descartada).toBe(false);
      expect(r.score).toBe(75);
      expect(r.motivos.length).toBeGreaterThan(0);
    });

    it('#12495 Product Engineer com label "Sênior" → penaliza mas não descarta', () => {
      const v = vaga({
        titulo: "product engineer na jotpsych",
        descricao:
          "jotpsych makes software for behavioral health clinicians. " +
          "we build through ai coding agents all day.",
        labels: ["pj", "senior", "remoto", "contrato", "verificada"],
        nivel: "senior",
        modalidade: "remoto",
      });
      // remoto +15, eliminatório "senior" fora do título −25
      const r = pontuar(v, dev);
      expect(r.descartada).toBe(false);
      expect(r.score).toBe(-10);
    });
  });

  describe("eliminatórios", () => {
    it("termo eliminatório no título descarta", () => {
      const r = pontuar(
        vaga({ titulo: "desenvolvedor backend senior - mimix", nivel: "senior" }),
        dev,
      );
      expect(r.descartada).toBe(true);
      expect(r.score).toBe(0);
      expect(r.motivos.some((m) => /s[eê]nior/i.test(m))).toBe(true);
    });

    it("descarta termos com pontuação e expressões com espaço", () => {
      expect(pontuar(vaga({ titulo: "desenvolvedor .net pleno" }), dev).descartada).toBe(true);
      expect(pontuar(vaga({ titulo: "desenvolvedor c# pleno" }), dev).descartada).toBe(true);
      expect(pontuar(vaga({ titulo: "tech lead node" }), dev).descartada).toBe(true);
    });

    it('termo só na descrição dá −25 ("não exigimos 3 anos" é comum)', () => {
      const r = pontuar(
        vaga({
          titulo: "desenvolvedor node",
          descricao: "nao exigimos 3 anos de experiencia.",
          nivel: "junior",
          modalidade: "remoto",
        }),
        dev,
      );
      // título +20, node (no título) +10, junior +15, remoto +15, eliminatório −25
      expect(r.descartada).toBe(false);
      expect(r.score).toBe(35);
    });

    it("vários eliminatórios na descrição penalizam uma vez só", () => {
      const r = pontuar(
        vaga({
          titulo: "desenvolvedor",
          descricao: "buscamos perfil senior, com 5 anos de experiencia.",
          nivel: "desconhecido",
        }),
        dev,
      );
      expect(r.score).toBe(20 - 25);
    });
  });

  describe("título", () => {
    it("+20 uma vez só, mesmo batendo vários termos", () => {
      expect(pontuar(vaga({ titulo: "dev fullstack" }), dev).score).toBe(20);
    });

    it('termo casa como palavra inteira: "dev" não casa com "devops"', () => {
      expect(pontuar(vaga({ titulo: "devops engineer" }), dev).score).toBe(0);
    });
  });

  describe("stack", () => {
    it("stackForte +10 cada, máx. +40; stackOk +5 cada, máx. +15", () => {
      const r = pontuar(
        vaga({
          titulo: "desenvolvedor",
          descricao:
            "typescript, node, react, react native e postgres. tambem python, sql, rust e javascript.",
        }),
        dev,
      );
      // 20 (título) + 40 (5 fortes, teto) + 15 (4 ok, teto)
      expect(r.score).toBe(75);
    });

    it("cada termo conta uma vez, não importa quantas vezes aparece", () => {
      expect(pontuar(vaga({ descricao: "node node node" }), dev).score).toBe(10);
    });

    it('"react native" conta "react" e "react native"', () => {
      expect(pontuar(vaga({ descricao: "experiencia com react native" }), dev).score).toBe(20);
    });

    it('"node.js" conta como "node"', () => {
      expect(pontuar(vaga({ descricao: "node.js e typescript" }), dev).score).toBe(20);
    });

    it('palavra inteira: "postgres" e "sql" não casam com "postgresql"', () => {
      // Se quiser pontuar postgresql, adicione o termo ao perfil.
      expect(pontuar(vaga({ descricao: "experiencia com postgresql" }), dev).score).toBe(0);
    });

    it("stack nos labels também conta", () => {
      expect(pontuar(vaga({ labels: ["typescript", "python"] }), dev).score).toBe(15);
    });
  });

  describe("nível", () => {
    it("+15 quando está em niveis", () => {
      expect(pontuar(vaga({ nivel: "junior" }), dev).score).toBe(15);
      expect(pontuar(vaga({ nivel: "estagio" }), dev).score).toBe(15);
      expect(pontuar(vaga({ nivel: "pleno" }), dev).score).toBe(0);
    });

    it('"desconhecido" só pontua no perfil que aceita (suporte)', () => {
      expect(pontuar(vaga({ nivel: "desconhecido" }), dev).score).toBe(0);
      expect(pontuar(vaga({ nivel: "desconhecido" }), suporte).score).toBe(15);
    });
  });

  describe("modalidade", () => {
    it("remoto +15", () => {
      expect(pontuar(vaga({ modalidade: "remoto" }), dev).score).toBe(15);
    });

    it("híbrido em local aceito +10; em outro lugar 0", () => {
      expect(pontuar(vaga({ modalidade: "hibrido", local: "Recife - PE" }), dev).score).toBe(10);
      const sp = pontuar(vaga({ modalidade: "hibrido", local: "São Paulo" }), dev);
      expect(sp).toMatchObject({ score: 0, descartada: false });
    });

    it("presencial em local aceito não pontua nem descarta", () => {
      expect(pontuar(vaga({ modalidade: "presencial", local: "Recife - PE" }), dev)).toMatchObject({
        score: 0,
        descartada: false,
      });
      expect(
        pontuar(vaga({ modalidade: "presencial", local: "Jaboatão dos Guararapes" }), dev),
      ).toMatchObject({ score: 0, descartada: false });
    });

    it("presencial fora dos locais aceitos (ou sem local) descarta", () => {
      expect(
        pontuar(vaga({ modalidade: "presencial", local: "São Paulo - SP" }), dev).descartada,
      ).toBe(true);
      expect(pontuar(vaga({ modalidade: "presencial", local: null }), dev).descartada).toBe(true);
    });
  });

  it("perfil suporte: Analista de Suporte N1 → 85 em suporte e 40 em dev", () => {
    const v = vaga({
      titulo: "analista de suporte n1 - junior",
      descricao: "atendimento a usuarios. conhecimento em sql, linux e windows. desejavel python.",
      nivel: "junior",
      modalidade: "remoto",
    });
    // suporte: título +20, sql/linux/windows +30, python +5, junior +15, remoto +15
    expect(pontuar(v, suporte).score).toBe(85);
    // dev: python/sql +10, junior +15, remoto +15
    expect(pontuar(v, dev).score).toBe(40);
  });

  it("é pura: não altera vaga nem perfil e dá o mesmo resultado sempre", () => {
    const v = Object.freeze(
      vaga({ titulo: "dev node", labels: Object.freeze(["react"]) as string[] }),
    );
    const p = Object.freeze({ ...dev, stackForte: Object.freeze([...dev.stackForte]) as string[] });
    const r1 = pontuar(v, p);
    const r2 = pontuar(v, p);
    expect(r1).toEqual(r2);
  });
});
