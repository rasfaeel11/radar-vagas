import { describe, expect, it } from "vitest";
import type { VagaSalva } from "../store/tipos.js";
import {
  codificarCallback,
  criarTecladoVaga,
  decodificarCallback,
  escaparHtmlTelegram,
  formatarResumoSemana,
  formatarVaga,
} from "./formatar.js";

function vagaExemplo(parcial: Partial<VagaSalva> = {}): VagaSalva {
  return {
    id: "github:backend-br/vagas:12493",
    fonte: "github",
    origem: "backend-br/vagas",
    url: "https://github.com/backend-br/vagas/issues/12493",
    titulo: "Desenvolvedor <Node & TS>",
    empresa: "Mimix AI",
    descricao: "Stack Node.js e TypeScript",
    labels: ["junior", "remoto"],
    local: null,
    nivel: "junior",
    modalidade: "remoto",
    contrato: "clt",
    publicadaEm: "2026-11-19T06:00:00.000Z",
    coletadaEm: "2026-11-19T07:00:00.000Z",
    perfil: "dev",
    score: 80,
    motivos: ["título compatível (+20)", "stack forte: node, typescript (+20)", "remoto (+15)"],
    ...parcial,
  };
}

describe("escaparHtmlTelegram", () => {
  it("escapa caracteres especiais de HTML", () => {
    expect(escaparHtmlTelegram('Dev <C# & "TS">')).toBe("Dev &lt;C# &amp; &quot;TS&quot;&gt;");
  });
});

describe("callback_data", () => {
  it("codifica e decodifica ações de apliquei e descartar", () => {
    const c1 = codificarCallback("apliquei", "github:backend-br/vagas:12493");
    const c2 = codificarCallback("descartar", "lever:neon:abc-123");

    expect(decodificarCallback(c1)).toEqual({
      acao: "apliquei",
      vagaId: "github:backend-br/vagas:12493",
    });
    expect(decodificarCallback(c2)).toEqual({
      acao: "descartar",
      vagaId: "lever:neon:abc-123",
    });
    expect(decodificarCallback("invalido")).toBeNull();
    expect(decodificarCallback("a:")).toBeNull();
  });

  it("rejeita callback_data acima do limite de 64 bytes do Telegram", () => {
    const idEnorme = "lever:" + "x".repeat(60);
    expect(() => codificarCallback("apliquei", idEnorme)).toThrow(/64 bytes/);
  });

  it("monta teclado inline com os dois botões esperados", () => {
    const teclado = criarTecladoVaga("github:backend-br/vagas:12493");
    expect(teclado.inline_keyboard).toEqual([
      [
        { text: "✅ Apliquei", callback_data: "a:github:backend-br/vagas:12493" },
        { text: "❌ Descartar", callback_data: "d:github:backend-br/vagas:12493" },
      ],
    ]);
  });
});

describe("formatarVaga", () => {
  it("inclui título, empresa, modalidade, score, apenas os 2 primeiros motivos e link", () => {
    const texto = formatarVaga(vagaExemplo());
    expect(texto).toBe(
      [
        "<b>Desenvolvedor &lt;Node &amp; TS&gt;</b>",
        "Mimix AI • Remoto • Score: <b>80</b>",
        "• título compatível (+20)",
        "• stack forte: node, typescript (+20)",
        '<a href="https://github.com/backend-br/vagas/issues/12493">Abrir vaga</a>',
      ].join("\n"),
    );
    expect(texto).not.toContain("remoto (+15)");
  });

  it("adiciona linha de status quando uma ação foi registrada", () => {
    expect(formatarVaga(vagaExemplo(), "apliquei")).toContain("<i>✅ Status: Apliquei</i>");
    expect(formatarVaga(vagaExemplo(), "descartar")).toContain("<i>❌ Status: Descartada</i>");
  });
});

describe("formatarResumoSemana", () => {
  it("formata mensagem vazia quando não há dados", () => {
    expect(formatarResumoSemana([])).toContain("Nenhuma vaga enviada ou avaliada");
  });

  it("lista contagens por fonte e linha de total", () => {
    const texto = formatarResumoSemana([
      { fonte: "github", recebidas: 10, aplicadas: 3, descartadas: 4 },
      { fonte: "lever", recebidas: 2, aplicadas: 1, descartadas: 0 },
    ]);
    expect(texto).toContain("<b>github</b>: 10 recebidas · 3 aplicadas · 4 descartadas");
    expect(texto).toContain("<b>lever</b>: 2 recebidas · 1 aplicadas · 0 descartadas");
    expect(texto).toContain("<b>Total</b>: 12 recebidas · 4 aplicadas · 4 descartadas");
  });
});
