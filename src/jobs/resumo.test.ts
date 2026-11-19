import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Vaga } from "../core/tipos.js";
import { criarBot } from "../notificar/bot.js";
import { abrirBanco, criarRepositorio } from "../store/banco.js";
import type { RepositorioVagas } from "../store/tipos.js";
import type { Logger } from "./logger.js";
import { executarResumo } from "./resumo.js";

const CHAT_ID = -1001234567890;
const USER_ID = 987654321;
const AGORA = new Date("2026-11-19T11:00:00.000Z"); // 08:00 America/Recife

function criarVaga(id: string): Vaga {
  return {
    id,
    fonte: "github",
    origem: "backend-br/vagas",
    url: `https://example.com/${id}`,
    titulo: `Vaga ${id}`,
    tituloNormalizado: `vaga ${id}`,
    empresa: "Acme",
    empresaNormalizada: "acme",
    descricao: "Node e TypeScript",
    descricaoNormalizada: "node e typescript",
    labels: ["junior", "remoto"],
    local: null,
    nivel: "junior",
    modalidade: "remoto",
    contrato: "clt",
    publicadaEm: "2026-11-19T06:00:00.000Z",
  };
}

describe("executarResumo", () => {
  let repo: RepositorioVagas;

  beforeEach(() => {
    repo = criarRepositorio(abrirBanco(":memory:"));
  });

  afterEach(() => {
    repo.fechar();
  });

  it("envia vagas por tópico e registra log com totais por perfil", async () => {
    repo.salvarVagas(
      [
        { vaga: criarVaga("v1"), perfil: "dev", score: 80, motivos: ["remoto (+15)"] },
        { vaga: criarVaga("v2"), perfil: "suporte", score: 60, motivos: ["sql (+10)"] },
      ],
      new Date("2026-11-19T09:00:00.000Z"),
    );

    const bot = criarBot({
      token: "000000:TEST-TOKEN",
      chatId: CHAT_ID,
      userId: USER_ID,
      repo,
      agora: () => AGORA,
    });

    let seqMsgId = 500;
    bot.api.config.use(async (_prev, method, payload) => {
      if (method === "sendMessage") {
        seqMsgId += 1;
        return {
          ok: true,
          result: {
            message_id: seqMsgId,
            date: Math.floor(AGORA.getTime() / 1000),
            chat: { id: CHAT_ID, type: "supergroup", title: "Radar" },
            text: String((payload as Record<string, unknown>).text ?? ""),
          },
        } as never;
      }
      return { ok: true, result: true } as never;
    });

    const infos: string[] = [];
    const logger: Logger = {
      info: (m) => infos.push(m),
      warn: () => {},
      error: () => {},
    };

    const resultado = await executarResumo({
      bot,
      repo,
      chatId: CHAT_ID,
      topicos: { dev: 2, suporte: 3 },
      agora: AGORA,
      logger,
    });

    expect(resultado.totalEnviados).toBe(2);
    expect(resultado.enviadosPorPerfil).toEqual({ dev: 1, suporte: 1 });
    expect(resultado.duracaoMs).toBeGreaterThanOrEqual(0);
    expect(infos.some((i) => i.includes("[resumo] iniciando"))).toBe(true);
    expect(
      infos.some(
        (i) =>
          i.includes("[resumo] concluído") &&
          i.includes("total=2") &&
          i.includes("dev=1, suporte=1"),
      ),
    ).toBe(true);
  });
});
