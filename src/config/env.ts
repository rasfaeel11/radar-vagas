import { z } from "zod";

const inteiroEnv = z
  .string()
  .trim()
  .regex(/^-?\d+$/, "deve ser um número inteiro")
  .transform((v) => Number(v));

const textoNaoVazio = z.string().trim().min(1, "não pode ser vazio");

const textoOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const envSchema = z.object({
  GITHUB_TOKEN: textoOpcional,
  TELEGRAM_BOT_TOKEN: textoNaoVazio,
  TELEGRAM_CHAT_ID: inteiroEnv,
  TELEGRAM_USER_ID: inteiroEnv,
  TELEGRAM_TOPICO_DEV: inteiroEnv,
  TELEGRAM_TOPICO_SUPORTE: inteiroEnv,
  DB_PATH: z.string().trim().min(1).default("./data/radar.db"),
  TZ: z.string().trim().min(1).default("America/Recife"),
  CRON_RESUMO: z.string().trim().min(1).default("0 8 * * *"),
  CRON_COLETA: z.string().trim().min(1).default("0 */3 * * *"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Carrega o arquivo `.env` (se existir) para `process.env` usando a API nativa do Node 22+.
 * Ignora se o arquivo não existir; relança qualquer outro erro de leitura.
 */
export function carregarArquivoEnv(caminho = ".env"): void {
  try {
    process.loadEnvFile(caminho);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
}

/**
 * Valida as variáveis de ambiente (por padrão `process.env`).
 * Lança erro descritivo listando todos os campos inválidos ou faltantes.
 */
export function validarEnv(origem: Record<string, string | undefined> = process.env): Env {
  const resultado = envSchema.safeParse(origem);
  if (!resultado.success) {
    const detalhes = resultado.error.issues
      .map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`)
      .join("; ");
    throw new Error(`Configuração de ambiente (.env) inválida: ${detalhes}`);
  }
  return resultado.data;
}
