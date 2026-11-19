import type Database from "better-sqlite3";

interface Migracao {
  versao: number;
  nome: string;
  sql: string;
}

const MIGRACOES: readonly Migracao[] = [
  {
    versao: 1,
    nome: "schema_inicial",
    sql: `
      CREATE TABLE vagas (
        id TEXT PRIMARY KEY,
        fonte TEXT NOT NULL,
        origem TEXT NOT NULL,
        url TEXT NOT NULL,
        titulo TEXT NOT NULL,
        titulo_normalizado TEXT NOT NULL,
        empresa TEXT NOT NULL,
        empresa_normalizada TEXT NOT NULL,
        descricao TEXT NOT NULL,
        labels_json TEXT NOT NULL,
        local TEXT,
        nivel TEXT NOT NULL,
        modalidade TEXT NOT NULL,
        contrato TEXT NOT NULL,
        publicada_em TEXT NOT NULL,
        coletada_em TEXT NOT NULL,
        perfil TEXT,
        score INTEGER,
        motivos_json TEXT NOT NULL DEFAULT '[]'
      );

      CREATE INDEX idx_vagas_dedup
        ON vagas (publicada_em, empresa_normalizada, titulo_normalizado);

      CREATE INDEX idx_vagas_perfil_coletada
        ON vagas (perfil, coletada_em, score DESC);

      CREATE INDEX idx_vagas_fonte
        ON vagas (fonte);

      CREATE TABLE envios (
        vaga_id TEXT PRIMARY KEY REFERENCES vagas(id) ON DELETE CASCADE,
        perfil TEXT NOT NULL,
        message_id INTEGER,
        enviado_em TEXT NOT NULL
      );

      CREATE INDEX idx_envios_data ON envios (enviado_em);

      CREATE TABLE acoes (
        vaga_id TEXT PRIMARY KEY REFERENCES vagas(id) ON DELETE CASCADE,
        acao TEXT NOT NULL CHECK (acao IN ('apliquei', 'descartar')),
        data TEXT NOT NULL
      );

      CREATE INDEX idx_acoes_data ON acoes (data);
    `,
  },
];

/**
 * Aplica todas as migrações pendentes em ordem de versão.
 * Idempotente: chamar de novo em um banco atualizado não altera nada e devolve 0.
 */
export function aplicarMigracoes(db: Database.Database, agora = new Date()): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migracoes (
      versao INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      aplicada_em TEXT NOT NULL
    );
  `);

  const linhas = db.prepare("SELECT versao FROM migracoes").all() as Array<{ versao: number }>;
  const aplicadas = new Set(linhas.map((l) => l.versao));

  const registrar = db.prepare(
    "INSERT INTO migracoes (versao, nome, aplicada_em) VALUES (?, ?, ?)",
  );

  let total = 0;
  for (const migracao of MIGRACOES) {
    if (aplicadas.has(migracao.versao)) continue;

    const executar = db.transaction(() => {
      db.exec(migracao.sql);
      registrar.run(migracao.versao, migracao.nome, agora.toISOString());
    });
    executar();
    total += 1;
  }

  return total;
}
