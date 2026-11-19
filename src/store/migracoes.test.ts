import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { aplicarMigracoes } from "./migracoes.js";

describe("aplicarMigracoes", () => {
  it("cria tabelas vagas, envios, acoes e migracoes de forma idempotente", () => {
    const db = new Database(":memory:");
    try {
      const primeira = aplicarMigracoes(db, new Date("2026-11-19T08:00:00Z"));
      expect(primeira).toBe(1);

      const tabelas = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Array<{ name: string }>;
      expect(tabelas.map((t) => t.name)).toEqual(["acoes", "envios", "migracoes", "vagas"]);

      // Chamar novamente não aplica nada
      const segunda = aplicarMigracoes(db, new Date("2026-11-19T09:00:00Z"));
      expect(segunda).toBe(0);
    } finally {
      db.close();
    }
  });

  it("rejeita ação fora dos valores permitidos (CHECK constraint)", () => {
    const db = new Database(":memory:");
    try {
      db.pragma("foreign_keys = ON");
      aplicarMigracoes(db);

      db.prepare(
        `INSERT INTO vagas (
          id, fonte, origem, url, titulo, titulo_normalizado, empresa, empresa_normalizada,
          descricao, labels_json, local, nivel, modalidade, contrato, publicada_em, coletada_em
        ) VALUES (
          'v1', 'github', 'backend-br/vagas', 'https://ex.com/1', 'Dev', 'dev', 'Acme', 'acme',
          '', '[]', NULL, 'junior', 'remoto', 'clt', '2026-11-19T08:00:00Z', '2026-11-19T08:00:00Z'
        )`,
      ).run();

      expect(() =>
        db
          .prepare("INSERT INTO acoes (vaga_id, acao, data) VALUES ('v1', 'invalida', ?)")
          .run("2026-11-19T08:05:00Z"),
      ).toThrow(/CHECK constraint/);
    } finally {
      db.close();
    }
  });
});
