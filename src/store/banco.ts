import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { VagaVista } from "../core/deduplicar.js";
import type { Contrato, Modalidade, Nivel, NomeFonte } from "../core/tipos.js";
import { aplicarMigracoes } from "./migracoes.js";
import type {
  RepositorioVagas,
  ResumoPorFonte,
  TipoAcao,
  VagaParaSalvar,
  VagaSalva,
} from "./tipos.js";

const LIMITE_PADRAO_ENVIO = 15;

interface LinhaVaga {
  id: string;
  fonte: NomeFonte;
  origem: string;
  url: string;
  titulo: string;
  empresa: string;
  descricao: string;
  labels_json: string;
  local: string | null;
  nivel: Nivel;
  modalidade: Modalidade;
  contrato: Contrato;
  publicada_em: string;
  coletada_em: string;
  perfil: string | null;
  score: number | null;
  motivos_json: string;
}

function mapearVagaSalva(linha: LinhaVaga): VagaSalva {
  return {
    id: linha.id,
    fonte: linha.fonte,
    origem: linha.origem,
    url: linha.url,
    titulo: linha.titulo,
    empresa: linha.empresa,
    descricao: linha.descricao,
    labels: JSON.parse(linha.labels_json) as string[],
    local: linha.local,
    nivel: linha.nivel,
    modalidade: linha.modalidade,
    contrato: linha.contrato,
    publicadaEm: linha.publicada_em,
    coletadaEm: linha.coletada_em,
    perfil: linha.perfil,
    score: linha.score,
    motivos: JSON.parse(linha.motivos_json) as string[],
  };
}

/**
 * Abre o banco SQLite (criando o diretório pai se necessário), configura PRAGMAs
 * e aplica as migrações pendentes. Aceita `":memory:"` para testes.
 */
export function abrirBanco(caminho: string): Database.Database {
  if (caminho !== ":memory:") {
    mkdirSync(path.dirname(caminho), { recursive: true });
  }

  const db = new Database(caminho);
  db.pragma("foreign_keys = ON");
  if (caminho !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }
  aplicarMigracoes(db);
  return db;
}

export function criarRepositorio(db: Database.Database): RepositorioVagas {
  const stmtInserirVaga = db.prepare(`
    INSERT OR IGNORE INTO vagas (
      id, fonte, origem, url,
      titulo, titulo_normalizado, empresa, empresa_normalizada,
      descricao, labels_json, local, nivel, modalidade, contrato,
      publicada_em, coletada_em, perfil, score, motivos_json
    ) VALUES (
      @id, @fonte, @origem, @url,
      @titulo, @titulo_normalizado, @empresa, @empresa_normalizada,
      @descricao, @labels_json, @local, @nivel, @modalidade, @contrato,
      @publicada_em, @coletada_em, @perfil, @score, @motivos_json
    )
  `);

  const stmtListarVistas = db.prepare(`
    SELECT
      empresa_normalizada AS empresaNormalizada,
      titulo_normalizado AS tituloNormalizado,
      publicada_em AS publicadaEm
    FROM vagas
    WHERE publicada_em >= ?
  `);

  const stmtListarNaoEnviadas = db.prepare(`
    SELECT v.*
    FROM vagas v
    LEFT JOIN envios e ON e.vaga_id = v.id
    WHERE v.perfil = ?
      AND v.coletada_em >= ?
      AND e.vaga_id IS NULL
    ORDER BY v.score DESC, v.publicada_em DESC
    LIMIT ?
  `);

  const stmtBuscarPorId = db.prepare(`
    SELECT * FROM vagas WHERE id = ?
  `);

  const stmtRegistrarEnvio = db.prepare(`
    INSERT OR IGNORE INTO envios (vaga_id, perfil, message_id, enviado_em)
    VALUES (?, ?, ?, ?)
  `);

  const stmtRegistrarAcao = db.prepare(`
    INSERT INTO acoes (vaga_id, acao, data)
    VALUES (?, ?, ?)
    ON CONFLICT(vaga_id) DO UPDATE SET
      acao = excluded.acao,
      data = excluded.data
  `);

  const stmtRecebidasPorFonte = db.prepare(`
    SELECT v.fonte AS fonte, COUNT(*) AS total
    FROM envios e
    JOIN vagas v ON v.id = e.vaga_id
    WHERE e.enviado_em >= ?
    GROUP BY v.fonte
  `);

  const stmtAcoesPorFonte = db.prepare(`
    SELECT
      v.fonte AS fonte,
      SUM(CASE WHEN a.acao = 'apliquei' THEN 1 ELSE 0 END) AS aplicadas,
      SUM(CASE WHEN a.acao = 'descartar' THEN 1 ELSE 0 END) AS descartadas
    FROM acoes a
    JOIN vagas v ON v.id = a.vaga_id
    WHERE a.data >= ?
    GROUP BY v.fonte
  `);

  const inserirLote = db.transaction(
    (entradas: readonly VagaParaSalvar[], coletadaEmIso: string): number => {
      let inseridas = 0;
      for (const { vaga, perfil, score, motivos } of entradas) {
        const res = stmtInserirVaga.run({
          id: vaga.id,
          fonte: vaga.fonte,
          origem: vaga.origem,
          url: vaga.url,
          titulo: vaga.titulo,
          titulo_normalizado: vaga.tituloNormalizado,
          empresa: vaga.empresa,
          empresa_normalizada: vaga.empresaNormalizada,
          descricao: vaga.descricao,
          labels_json: JSON.stringify(vaga.labels),
          local: vaga.local,
          nivel: vaga.nivel,
          modalidade: vaga.modalidade,
          contrato: vaga.contrato,
          publicada_em: vaga.publicadaEm,
          coletada_em: coletadaEmIso,
          perfil,
          score,
          motivos_json: JSON.stringify(motivos),
        });
        inseridas += res.changes;
      }
      return inseridas;
    },
  );

  return {
    salvarVagas(entradas, coletadaEm) {
      return inserirLote(entradas, coletadaEm.toISOString());
    },

    listarVistasRecentes(desde) {
      return stmtListarVistas.all(desde.toISOString()) as VagaVista[];
    },

    listarNaoEnviadas(perfil, desde, limite = LIMITE_PADRAO_ENVIO) {
      const linhas = stmtListarNaoEnviadas.all(perfil, desde.toISOString(), limite) as LinhaVaga[];
      return linhas.map(mapearVagaSalva);
    },

    buscarPorId(vagaId) {
      const linha = stmtBuscarPorId.get(vagaId) as LinhaVaga | undefined;
      return linha ? mapearVagaSalva(linha) : null;
    },

    registrarEnvio(vagaId, perfil, enviadoEm, messageId) {
      stmtRegistrarEnvio.run(vagaId, perfil, messageId ?? null, enviadoEm.toISOString());
    },

    registrarAcao(vagaId, acao: TipoAcao, data) {
      stmtRegistrarAcao.run(vagaId, acao, data.toISOString());
    },

    resumoSemana(desde) {
      const desdeIso = desde.toISOString();
      const mapa = new Map<NomeFonte, ResumoPorFonte>();

      const garantir = (fonte: NomeFonte): ResumoPorFonte => {
        let item = mapa.get(fonte);
        if (!item) {
          item = { fonte, recebidas: 0, aplicadas: 0, descartadas: 0 };
          mapa.set(fonte, item);
        }
        return item;
      };

      const recebidas = stmtRecebidasPorFonte.all(desdeIso) as Array<{
        fonte: NomeFonte;
        total: number;
      }>;
      for (const r of recebidas) {
        garantir(r.fonte).recebidas = r.total;
      }

      const acoes = stmtAcoesPorFonte.all(desdeIso) as Array<{
        fonte: NomeFonte;
        aplicadas: number;
        descartadas: number;
      }>;
      for (const a of acoes) {
        const item = garantir(a.fonte);
        item.aplicadas = a.aplicadas;
        item.descartadas = a.descartadas;
      }

      return [...mapa.values()].sort((a, b) => a.fonte.localeCompare(b.fonte));
    },

    fechar() {
      db.close();
    },
  };
}
