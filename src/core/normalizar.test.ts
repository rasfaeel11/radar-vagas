import { describe, expect, it } from "vitest";
import { IMPLEMENTADO, normalizarTexto, normalizarTitulo, normalizarVaga } from "./normalizar.js";
import type { VagaBruta } from "./tipos.js";

/** Vaga crua mínima; cada teste sobrescreve só o que importa. */
function bruta(parcial: Partial<VagaBruta> = {}): VagaBruta {
  return {
    fonte: "github",
    origem: "backend-br/vagas",
    idExterno: "12493",
    titulo: "Desenvolvedor",
    empresa: "Empresa X",
    descricao: "",
    url: "https://github.com/backend-br/vagas/issues/12493",
    local: null,
    labels: [],
    modalidadeBruta: null,
    publicadaEm: "2026-11-18T22:39:26Z",
    ...parcial,
  };
}

describe.skipIf(!IMPLEMENTADO)("normalizarTexto", () => {
  it("passa para minúsculas e remove acentos", () => {
    expect(normalizarTexto("Desenvolvedor(a) Back-end Júnior")).toBe(
      "desenvolvedor(a) back-end junior",
    );
    expect(normalizarTexto("Estágio em Sustentação")).toBe("estagio em sustentacao");
    expect(normalizarTexto("Programação")).toBe("programacao");
    expect(normalizarTexto("Jaboatão dos Guararapes")).toBe("jaboatao dos guararapes");
  });

  it("apara e colapsa espaços, quebras de linha e tabs", () => {
    expect(normalizarTexto("  Sênior   ")).toBe("senior");
    expect(normalizarTexto("linha 1\n\n\t  linha 2")).toBe("linha 1 linha 2");
  });

  it("remove emoji dos labels do react-brasil/vagas", () => {
    expect(normalizarTexto("👦 Junior")).toBe("junior");
    expect(normalizarTexto("🏢 Flexível")).toBe("flexivel");
    // "⚖️" é ⚖ + seletor de variação (U+FE0F): os dois têm que sumir
    expect(normalizarTexto("⚖️ CLT")).toBe("clt");
  });

  it("mantém pontuação de stack", () => {
    expect(normalizarTexto("C# / .NET")).toBe("c# / .net");
    expect(normalizarTexto("Node.js")).toBe("node.js");
    expect(normalizarTexto("C++")).toBe("c++");
    expect(normalizarTexto("CI/CD")).toBe("ci/cd");
  });

  it("devolve string vazia para entrada vazia ou só com espaços", () => {
    expect(normalizarTexto("")).toBe("");
    expect(normalizarTexto("   \n ")).toBe("");
  });
});

describe.skipIf(!IMPLEMENTADO)("normalizarTitulo", () => {
  it("remove tags entre colchetes (título real do backend-br/vagas)", () => {
    expect(
      normalizarTitulo(
        "[Remoto] Desenvolvedor(a) Backend Pleno - White Label e Plataforma - Mimix AI",
      ),
    ).toBe("desenvolvedor(a) backend pleno - white label e plataforma - mimix ai");
  });

  it("remove várias tags, em qualquer posição", () => {
    expect(normalizarTitulo("[Remote] [PJ] Dev Node")).toBe("dev node");
    expect(normalizarTitulo("Dev Node [Remoto]")).toBe("dev node");
  });

  it('remove "vaga para" e "vaga de" (sem diferenciar maiúsculas)', () => {
    expect(normalizarTitulo("Vaga para Desenvolvedor Júnior")).toBe("desenvolvedor junior");
    expect(normalizarTitulo("VAGA PARA desenvolvedor   júnior")).toBe("desenvolvedor junior");
    expect(normalizarTitulo("Vaga de Estágio em Suporte")).toBe("estagio em suporte");
  });

  it("títulos que só diferem em formato viram a mesma chave", () => {
    const a = normalizarTitulo("[Remoto] Vaga para Desenvolvedor Júnior");
    const b = normalizarTitulo("desenvolvedor junior");
    expect(a).toBe(b);
  });
});

describe.skipIf(!IMPLEMENTADO)("normalizarVaga", () => {
  it("monta o id e preserva os campos de origem", () => {
    const v = normalizarVaga(bruta({ titulo: "  Dev Node  " }));
    expect(v.id).toBe("github:backend-br/vagas:12493");
    expect(v.fonte).toBe("github");
    expect(v.origem).toBe("backend-br/vagas");
    expect(v.url).toBe("https://github.com/backend-br/vagas/issues/12493");
    expect(v.publicadaEm).toBe("2026-11-18T22:39:26Z");
    expect(v.titulo).toBe("Dev Node");
    expect(v.tituloNormalizado).toBe("dev node");
  });

  it('usa "desconhecida" quando a empresa vem null', () => {
    const v = normalizarVaga(bruta({ empresa: null }));
    expect(v.empresa).toBe("desconhecida");
    expect(v.empresaNormalizada).toBe("desconhecida");
  });

  it("normaliza empresa, descrição e labels", () => {
    const v = normalizarVaga(
      bruta({
        empresa: "Mimix AI",
        descricao: "Experiência com Node.js e PostgreSQL.\nDesejável React.",
        labels: ["PJ", "👦 Junior", "🏢 Flexível"],
      }),
    );
    expect(v.empresaNormalizada).toBe("mimix ai");
    expect(v.descricaoNormalizada).toBe("experiencia com node.js e postgresql. desejavel react.");
    expect(v.labels).toEqual(["pj", "junior", "flexivel"]);
  });

  describe("nível", () => {
    it("vem do label (backend-br/vagas, com acento)", () => {
      // labels reais da issue #12493 do backend-br/vagas
      const labels = ["PJ", "Júnior", "JavaScript", "Python", "Remoto", "verificada"];
      expect(normalizarVaga(bruta({ labels })).nivel).toBe("junior");
    });

    it("vem do label (react-brasil/vagas, com emoji)", () => {
      expect(normalizarVaga(bruta({ labels: ["👨 Pleno"] })).nivel).toBe("pleno");
      expect(normalizarVaga(bruta({ labels: ["👴 Senior"] })).nivel).toBe("senior");
    });

    it("label tem prioridade sobre o título", () => {
      const v = normalizarVaga(bruta({ titulo: "Dev Júnior/Pleno", labels: ["Pleno"] }));
      expect(v.nivel).toBe("pleno");
    });

    it("sem label, infere pelo título", () => {
      expect(normalizarVaga(bruta({ titulo: "Estágio em Desenvolvimento" })).nivel).toBe("estagio");
      expect(normalizarVaga(bruta({ titulo: "Estagiário de Suporte" })).nivel).toBe("estagio");
      expect(normalizarVaga(bruta({ titulo: "Desenvolvedor Jr" })).nivel).toBe("junior");
      expect(normalizarVaga(bruta({ titulo: "Advogado(a) de Contratos Sênior" })).nivel).toBe(
        "senior",
      );
      expect(normalizarVaga(bruta({ titulo: "Backend Developer Sr" })).nivel).toBe("senior");
      expect(normalizarVaga(bruta({ titulo: "Especialista em Dados" })).nivel).toBe("especialista");
    });

    it('"jr" e "sr" só contam como palavra inteira', () => {
      expect(normalizarVaga(bruta({ titulo: "Desenvolvedor Python" })).nivel).toBe("desconhecido");
      expect(normalizarVaga(bruta({ titulo: "Srta. Dev" })).nivel).toBe("desconhecido");
    });

    it('sem pista nenhuma, fica "desconhecido"', () => {
      expect(normalizarVaga(bruta({ titulo: "Product Engineer" })).nivel).toBe("desconhecido");
    });
  });

  describe("modalidade", () => {
    it("usa a modalidade estruturada da fonte primeiro (Lever/Greenhouse)", () => {
      expect(normalizarVaga(bruta({ modalidadeBruta: "remote" })).modalidade).toBe("remoto");
      expect(normalizarVaga(bruta({ modalidadeBruta: "hybrid" })).modalidade).toBe("hibrido");
      expect(normalizarVaga(bruta({ modalidadeBruta: "Hybrid" })).modalidade).toBe("hibrido");
      expect(normalizarVaga(bruta({ modalidadeBruta: "onsite" })).modalidade).toBe("presencial");
    });

    it("modalidade estruturada ganha do título", () => {
      const v = normalizarVaga(bruta({ titulo: "[Remoto] Dev", modalidadeBruta: "onsite" }));
      expect(v.modalidade).toBe("presencial");
    });

    it("depois olha os labels", () => {
      expect(normalizarVaga(bruta({ labels: ["Remoto"] })).modalidade).toBe("remoto");
      expect(normalizarVaga(bruta({ labels: ["Híbrido"] })).modalidade).toBe("hibrido");
      expect(normalizarVaga(bruta({ labels: ["🏢 Flexível"] })).modalidade).toBe("hibrido");
      expect(normalizarVaga(bruta({ labels: ["🏢 Presencial"] })).modalidade).toBe("presencial");
    });

    it("depois a tag do título", () => {
      expect(
        normalizarVaga(bruta({ titulo: "[Remote] Product Engineer na JotPsych" })).modalidade,
      ).toBe("remoto");
      expect(normalizarVaga(bruta({ titulo: "[Híbrido] Dev Node" })).modalidade).toBe("hibrido");
      expect(normalizarVaga(bruta({ titulo: "[Presencial] Suporte N1" })).modalidade).toBe(
        "presencial",
      );
    });

    it("por último o local (Lever da Neon usa location = Remoto)", () => {
      expect(normalizarVaga(bruta({ local: "Remoto" })).modalidade).toBe("remoto");
    });

    it('sem pista nenhuma, fica "desconhecida"', () => {
      expect(normalizarVaga(bruta({ local: "São Paulo" })).modalidade).toBe("desconhecida");
    });
  });

  describe("contrato", () => {
    it("vem dos labels", () => {
      // labels reais da issue #12495 do backend-br/vagas: PJ e Contrato juntos → pj
      const labels = ["PJ", "Sênior", "Remoto", "Contrato", "verificada"];
      expect(normalizarVaga(bruta({ labels })).contrato).toBe("pj");
      expect(normalizarVaga(bruta({ labels: ["⚖️ CLT"] })).contrato).toBe("clt");
      expect(normalizarVaga(bruta({ labels: ["Freelance"] })).contrato).toBe("freelance");
      expect(normalizarVaga(bruta({ labels: ["Estágio"] })).contrato).toBe("estagio");
    });

    it('"Outros" ou só "Contrato" viram "outro"', () => {
      expect(normalizarVaga(bruta({ labels: ["⚖️ Outros"] })).contrato).toBe("outro");
      expect(normalizarVaga(bruta({ labels: ["Contrato"] })).contrato).toBe("outro");
    });

    it('sem label, fica "desconhecido"', () => {
      expect(normalizarVaga(bruta()).contrato).toBe("desconhecido");
    });
  });

  it("não altera o objeto recebido", () => {
    const entrada = Object.freeze(bruta({ labels: Object.freeze(["Júnior"]) as string[] }));
    expect(() => normalizarVaga(entrada)).not.toThrow();
  });
});
