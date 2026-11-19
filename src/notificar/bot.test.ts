import type { Update } from "grammy/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Vaga } from "../core/tipos.js";
import { abrirBanco, criarRepositorio } from "../store/banco.js";
import type { RepositorioVagas } from "../store/tipos.js";
import { criarBot, ehAutorizado, enviarResumoDiario } from "./bot.js";

const CHAT_ID = -1001234567890;
const USER_ID = 987654321;
const TOPICO_DEV = 2;
const TOPICO_SUPORTE = 3;

interface ChamadaApi {
  method: string;
  payload: Record<string, unknown>;
}

function criarVaga(id: string, parcial: Partial<Vaga> = {}): Vaga {
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
    ...parcial,
  };
}

function prepararBotOffline(repo: RepositorioVagas, agora: Date) {
  const chamadas: ChamadaApi[] = [];
  let seqMsgId = 100;

  const bot = criarBot({
    token: "000000:TEST-TOKEN",
    chatId: CHAT_ID,
    userId: USER_ID,
    repo,
    agora: () => agora,
  });

  bot.botInfo = {
    id: 999999,
    is_bot: true,
    first_name: "RadarVagas",
    username: "radar_vagas_test_bot",
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  };

  bot.api.config.use(async (_prev, method, payload) => {
    chamadas.push({ method, payload: payload as Record<string, unknown> });

    if (method === "sendMessage") {
      seqMsgId += 1;
      return {
        ok: true,
        result: {
          message_id: seqMsgId,
          date: Math.floor(agora.getTime() / 1000),
          chat: { id: CHAT_ID, type: "supergroup", title: "Radar" },
          text: String((payload as Record<string, unknown>).text ?? ""),
        },
      } as never;
    }

    return { ok: true, result: true } as never;
  });

  return { bot, chamadas };
}

describe("ehAutorizado", () => {
  it("só autoriza quando chatId e userId coincidem exatamente", () => {
    const cfg = { chatId: CHAT_ID, userId: USER_ID };
    expect(ehAutorizado(CHAT_ID, USER_ID, cfg)).toBe(true);
    expect(ehAutorizado(CHAT_ID, 111, cfg)).toBe(false);
    expect(ehAutorizado(-100999, USER_ID, cfg)).toBe(false);
    expect(ehAutorizado(undefined, USER_ID, cfg)).toBe(false);
  });
});

describe("bot do Telegram (offline via grammY)", () => {
  let repo: RepositorioVagas;
  const agora = new Date("2026-11-19T08:00:00Z");

  beforeEach(() => {
    repo = criarRepositorio(abrirBanco(":memory:"));
  });

  afterEach(() => {
    repo.fechar();
  });

  it("ignora comandos e cliques vindos de outro grupo ou de outro usuário", async () => {
    const { bot, chamadas } = prepararBotOffline(repo, agora);

    const updateOutroUsuario: Update = {
      update_id: 1,
      message: {
        message_id: 10,
        date: 1795086000,
        chat: { id: CHAT_ID, type: "supergroup", title: "Radar" },
        from: { id: 555555, is_bot: false, first_name: "Intruso" },
        text: "/semana",
        entities: [{ offset: 0, length: 7, type: "bot_command" }],
      },
    };

    const updateOutroGrupo: Update = {
      update_id: 2,
      message: {
        message_id: 11,
        date: 1795086000,
        chat: { id: -1009999999, type: "supergroup", title: "Outro" },
        from: { id: USER_ID, is_bot: false, first_name: "Dono" },
        text: "/semana",
        entities: [{ offset: 0, length: 7, type: "bot_command" }],
      },
    };

    await bot.handleUpdate(updateOutroUsuario);
    await bot.handleUpdate(updateOutroGrupo);

    expect(chamadas).toHaveLength(0);
  });

  it("responde /semana com resumo agregado por fonte no mesmo tópico", async () => {
    repo.salvarVagas(
      [
        { vaga: criarVaga("gh-1", { fonte: "github" }), perfil: "dev", score: 80, motivos: [] },
        { vaga: criarVaga("lv-1", { fonte: "lever" }), perfil: "dev", score: 70, motivos: [] },
      ],
      new Date("2026-11-18T07:00:00Z"),
    );
    repo.registrarEnvio("gh-1", "dev", new Date("2026-11-18T08:00:00Z"), 1);
    repo.registrarEnvio("lv-1", "dev", new Date("2026-11-18T08:00:00Z"), 2);
    repo.registrarAcao("gh-1", "apliquei", new Date("2026-11-18T09:00:00Z"));

    const { bot, chamadas } = prepararBotOffline(repo, agora);

    const updateSemana: Update = {
      update_id: 3,
      message: {
        message_id: 12,
        message_thread_id: TOPICO_DEV,
        date: 1795086000,
        chat: { id: CHAT_ID, type: "supergroup", title: "Radar" },
        from: { id: USER_ID, is_bot: false, first_name: "Rafael" },
        text: "/semana",
        entities: [{ offset: 0, length: 7, type: "bot_command" }],
      },
    };

    await bot.handleUpdate(updateSemana);

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.method).toBe("sendMessage");
    expect(chamadas[0]?.payload.message_thread_id).toBe(TOPICO_DEV);
    expect(String(chamadas[0]?.payload.text)).toContain(
      "<b>github</b>: 1 recebidas · 1 aplicadas · 0 descartadas",
    );
    expect(String(chamadas[0]?.payload.text)).toContain(
      "<b>lever</b>: 1 recebidas · 0 aplicadas · 0 descartadas",
    );
  });

  it("registra ação em `acoes` e atualiza a mensagem ao clicar em Apliquei / Descartar", async () => {
    const vagaId = "github:backend-br/vagas:12493";
    repo.salvarVagas(
      [
        {
          vaga: criarVaga(vagaId),
          perfil: "dev",
          score: 85,
          motivos: ["título compatível (+20)", "remoto (+15)"],
        },
      ],
      new Date("2026-11-19T07:00:00Z"),
    );

    const { bot, chamadas } = prepararBotOffline(repo, agora);

    const updateClick: Update = {
      update_id: 4,
      callback_query: {
        id: "cbq-1",
        from: { id: USER_ID, is_bot: false, first_name: "Rafael" },
        chat_instance: "inst-1",
        data: `a:${vagaId}`,
        message: {
          message_id: 101,
          date: 1795086000,
          chat: { id: CHAT_ID, type: "supergroup", title: "Radar" },
          text: "Vaga...",
        },
      },
    };

    await bot.handleUpdate(updateClick);

    // Gravou no banco
    const resumo = repo.resumoSemana(new Date("2026-11-12T08:00:00Z"));
    expect(resumo).toEqual([{ fonte: "github", recebidas: 0, aplicadas: 1, descartadas: 0 }]);

    // Respondeu o callback e editou a mensagem removendo os botões
    expect(chamadas.map((c) => c.method)).toEqual(["answerCallbackQuery", "editMessageText"]);
    expect(String(chamadas[1]?.payload.text)).toContain("✅ Status: Apliquei");
    expect(chamadas[1]?.payload.reply_markup).toEqual({ inline_keyboard: [] });
  });

  it("envia resumo diário por tópico respeitando limite, ordenação e sem reenviar", async () => {
    repo.salvarVagas(
      [
        { vaga: criarVaga("dev-1"), perfil: "dev", score: 60, motivos: ["m1"] },
        { vaga: criarVaga("dev-2"), perfil: "dev", score: 90, motivos: ["m1", "m2", "m3"] },
        { vaga: criarVaga("dev-3"), perfil: "dev", score: 75, motivos: ["m1"] },
        { vaga: criarVaga("sup-1"), perfil: "suporte", score: 80, motivos: ["s1"] },
      ],
      new Date("2026-11-19T07:00:00Z"),
    );

    const { bot, chamadas } = prepararBotOffline(repo, agora);

    const res1 = await enviarResumoDiario({
      bot,
      repo,
      chatId: CHAT_ID,
      topicos: { dev: TOPICO_DEV, suporte: TOPICO_SUPORTE },
      agora,
      limitePorTopico: 2,
    });

    expect(res1).toEqual({
      enviadosPorPerfil: { dev: 2, suporte: 1 },
      totalEnviados: 3,
    });
    expect(chamadas).toHaveLength(3);

    // Top 2 do tópico DEV em ordem de score (dev-2=90, dev-3=75)
    expect(chamadas[0]?.payload.message_thread_id).toBe(TOPICO_DEV);
    expect(String(chamadas[0]?.payload.text)).toContain("Vaga dev-2");
    expect(chamadas[1]?.payload.message_thread_id).toBe(TOPICO_DEV);
    expect(String(chamadas[1]?.payload.text)).toContain("Vaga dev-3");

    // 1 vaga no tópico Suporte
    expect(chamadas[2]?.payload.message_thread_id).toBe(TOPICO_SUPORTE);
    expect(String(chamadas[2]?.payload.text)).toContain("Vaga sup-1");

    // Segunda execução só envia o que faltou (dev-1), não repete as já enviadas
    const res2 = await enviarResumoDiario({
      bot,
      repo,
      chatId: CHAT_ID,
      topicos: { dev: TOPICO_DEV, suporte: TOPICO_SUPORTE },
      agora,
      limitePorTopico: 2,
    });
    expect(res2).toEqual({
      enviadosPorPerfil: { dev: 1, suporte: 0 },
      totalEnviados: 1,
    });
  });
});
