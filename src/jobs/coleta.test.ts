import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Perfil, ResultadoPontuacao, Vaga, VagaBruta } from "../core/tipos.js";
import type { AdaptadorFonte } from "../fontes/tipos.js";
import { abrirBanco, criarRepositorio } from "../store/banco.js";
import type { RepositorioVagas } from "../store/tipos.js";
import { executarColeta } from "./coleta.js";
import type { Logger } from "./logger.js";

const AGORA = new Date("2026-11-19T11:00:00.000Z");

const PERFIS: Record<string, Perfil> = {
  dev: {
    titulosBons: ["dev", "backend"],
    stackForte: ["typescript", "node"],
    stackOk: ["sql"],
    eliminatorios: ["senior"],
    niveis: ["estagio", "junior"],
    modalidades: ["remoto"],
    locaisPresencialAceito: ["recife"],
  },
  suporte: {
    titulosBons: ["suporte", "n1"],
    stackForte: ["linux", "sql"],
    stackOk: ["redes"],
    eliminatorios: ["senior"],
    niveis: ["estagio", "junior", "desconhecido"],
    modalidades: ["remoto"],
    locaisPresencialAceito: ["recife"],
  },
};

function criarBruta(idExterno: string, parcial: Partial<VagaBruta> = {}): VagaBruta {
  return {
    fonte: "github",
    origem: "backend-br/vagas",
    idExterno,
    titulo: `Dev Node Jr ${idExterno}`,
    empresa: `Empresa ${idExterno}`,
    descricao: "TypeScript e Node",
    url: `https://example.com/${idExterno}`,
    local: "Remoto",
    labels: ["junior", "remoto"],
    modalidadeBruta: "remote",
    publicadaEm: "2026-11-19T08:00:00.000Z",
    ...parcial,
  };
}

function normalizarFake(bruta: VagaBruta): Vaga {
  const titulo = bruta.titulo.trim();
  const empresa = bruta.empresa?.trim() || "desconhecida";
  return {
    id: `${bruta.fonte}:${bruta.origem}:${bruta.idExterno}`,
    fonte: bruta.fonte,
    origem: bruta.origem,
    url: bruta.url,
    titulo,
    tituloNormalizado: titulo.toLowerCase(),
    empresa,
    empresaNormalizada: empresa.toLowerCase(),
    descricao: bruta.descricao,
    descricaoNormalizada: bruta.descricao.toLowerCase(),
    labels: bruta.labels.map((l) => l.toLowerCase()),
    local: bruta.local,
    nivel: "junior",
    modalidade: "remoto",
    contrato: "clt",
    publicadaEm: bruta.publicadaEm,
  };
}

function pontuarFake(vaga: Vaga, perfil: Perfil): ResultadoPontuacao {
  if (vaga.tituloNormalizado.includes("senior")) {
    return { score: 0, descartada: true, motivos: ["termo eliminatório no título"] };
  }
  const bateTitulo = perfil.titulosBons.some((t) => vaga.tituloNormalizado.includes(t));
  if (bateTitulo) {
    return { score: 65, descartada: false, motivos: ["título compatível (+20)", "remoto (+15)"] };
  }
  return { score: 20, descartada: false, motivos: ["score baixo"] };
}

function criarLoggerMemoria() {
  const infos: string[] = [];
  const warns: string[] = [];
  const errors: string[] = [];
  const logger: Logger = {
    info: (m) => infos.push(m),
    warn: (m) => warns.push(m),
    error: (m) => errors.push(m),
  };
  return { logger, infos, warns, errors };
}

describe("executarColeta", () => {
  let repo: RepositorioVagas;

  beforeEach(() => {
    repo = criarRepositorio(abrirBanco(":memory:"));
  });

  afterEach(() => {
    repo.fechar();
  });

  it("executa fontes → normalizar → deduplicar → pontuar → salvar e registra logs", async () => {
    // Pré-popula o banco com uma vaga já vista nos últimos 14 dias
    const jaVista = normalizarFake(
      criarBruta("0", {
        titulo: "Dev Node Repetida",
        empresa: "Acme",
        publicadaEm: "2026-11-15T10:00:00.000Z",
      }),
    );
    repo.salvarVagas([{ vaga: jaVista, perfil: "dev", score: 65, motivos: ["ok"] }], AGORA);

    const desdesRecebidos: Date[] = [];
    const fonteGithub: AdaptadorFonte = {
      nome: "github:backend-br/vagas",
      async buscar(desde) {
        desdesRecebidos.push(desde);
        return [
          criarBruta("1", { titulo: "Dev Node Jr", empresa: "Tech A" }),
          // Duplicata dentro do mesmo lote (mesma empresa + título)
          criarBruta("2", { titulo: "Dev Node Jr", empresa: "Tech A" }),
          // Duplicata de vaga já salva no banco nos últimos 14 dias
          criarBruta("3", { titulo: "Dev Node Repetida", empresa: "Acme" }),
          // Vaga que vai para o perfil "suporte"
          criarBruta("4", { titulo: "Analista de Suporte N1", empresa: "HelpCo" }),
          // Vaga descartada por termo eliminatório
          criarBruta("5", { titulo: "Dev Senior Java", empresa: "BigCorp" }),
        ];
      },
    };

    const fonteComErro: AdaptadorFonte = {
      nome: "lever:quebrada",
      async buscar() {
        throw new Error("HTTP 500");
      },
    };

    const { logger, infos, warns } = criarLoggerMemoria();

    const resultado = await executarColeta({
      fontes: [fonteGithub, fonteComErro],
      perfis: PERFIS,
      repo,
      agora: AGORA,
      logger,
      normalizar: normalizarFake,
      pontuar: pontuarFake,
    });

    // Janela padrão de 24h antes de AGORA
    expect(desdesRecebidos[0]?.toISOString()).toBe("2026-11-18T11:00:00.000Z");

    expect(resultado.brutas).toBe(5);
    expect(resultado.errosFontes).toHaveLength(1);
    expect(resultado.errosFontes[0]?.fonte).toBe("lever:quebrada");
    expect(resultado.aposDeduplicacao).toBe(3); // ids 1, 4 e 5
    expect(resultado.aprovadas).toBe(2); // ids 1 (dev) e 4 (suporte)
    expect(resultado.descartadas).toBe(1); // id 5 (senior)
    expect(resultado.salvas).toBe(3);

    // Confirma persistência por perfil
    const desde24h = new Date(AGORA.getTime() - 24 * 60 * 60 * 1000);
    const naoEnviadasDev = repo.listarNaoEnviadas("dev", desde24h);
    const naoEnviadasSuporte = repo.listarNaoEnviadas("suporte", desde24h);

    expect(naoEnviadasDev.map((v) => v.id)).toEqual([
      "github:backend-br/vagas:1",
      "github:backend-br/vagas:0",
    ]);
    expect(naoEnviadasSuporte.map((v) => v.id)).toEqual(["github:backend-br/vagas:4"]);

    // Vaga descartada é salva com perfil = null para constar na deduplicação futura
    const vagaDescartada = repo.buscarPorId("github:backend-br/vagas:5");
    expect(vagaDescartada).not.toBeNull();
    expect(vagaDescartada?.perfil).toBeNull();
    expect(vagaDescartada?.score).toBeNull();

    // Logs simples de execução e aviso de erro na fonte
    expect(warns.some((w) => w.includes("lever:quebrada") && w.includes("HTTP 500"))).toBe(true);
    expect(infos.some((i) => i.includes("[coleta] iniciando"))).toBe(true);
    expect(infos.some((i) => i.includes("[coleta] concluída") && i.includes("aprovadas=2"))).toBe(
      true,
    );
  });

  it("não reprocessa como nova uma vaga descartada salva em coleta anterior", async () => {
    const fonte: AdaptadorFonte = {
      nome: "github:backend-br/vagas",
      async buscar() {
        return [criarBruta("99", { titulo: "Dev Senior Java", empresa: "BigCorp" })];
      },
    };
    const { logger } = criarLoggerMemoria();

    const primeira = await executarColeta({
      fontes: [fonte],
      perfis: PERFIS,
      repo,
      agora: AGORA,
      logger,
      normalizar: normalizarFake,
      pontuar: pontuarFake,
    });
    expect(primeira.aposDeduplicacao).toBe(1);
    expect(primeira.salvas).toBe(1);

    const segunda = await executarColeta({
      fontes: [fonte],
      perfis: PERFIS,
      repo,
      agora: new Date(AGORA.getTime() + 3 * 60 * 60 * 1000),
      logger,
      normalizar: normalizarFake,
      pontuar: pontuarFake,
    });
    expect(segunda.aposDeduplicacao).toBe(0);
    expect(segunda.salvas).toBe(0);
  });
});
