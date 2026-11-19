import { carregarEmpresas, carregarPerfis, carregarRepos } from "./config/arquivos.js";
import { carregarArquivoEnv, validarEnv } from "./config/env.js";
import { IMPLEMENTADO as NORMALIZAR_IMPLEMENTADO } from "./core/normalizar.js";
import { IMPLEMENTADO as PONTUAR_IMPLEMENTADO } from "./core/pontuar.js";
import { criarFontesPadrao } from "./fontes/coletar.js";
import { iniciarAgendador } from "./jobs/agendador.js";
import { executarColeta } from "./jobs/coleta.js";
import { criarLoggerConsole } from "./jobs/logger.js";
import { executarResumo } from "./jobs/resumo.js";
import { criarBot } from "./notificar/bot.js";
import { abrirBanco, criarRepositorio } from "./store/banco.js";

async function iniciar(): Promise<void> {
  const logger = criarLoggerConsole();

  carregarArquivoEnv();
  const env = validarEnv();

  if (!NORMALIZAR_IMPLEMENTADO || !PONTUAR_IMPLEMENTADO) {
    logger.warn(
      "[app] atenção: normalizar e/ou pontuar ainda não foram implementados (regra de estudo); a coleta falhará até serem implementados",
    );
  }

  const perfis = carregarPerfis();
  const empresas = carregarEmpresas();
  const repos = carregarRepos();

  const db = abrirBanco(env.DB_PATH);
  const repo = criarRepositorio(db);

  const fontes = criarFontesPadrao({
    repos: repos.github,
    empresas,
    tokenGithub: env.GITHUB_TOKEN,
  });

  const bot = criarBot({
    token: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
    userId: env.TELEGRAM_USER_ID,
    repo,
  });

  const topicos: Record<string, number> = {
    dev: env.TELEGRAM_TOPICO_DEV,
    suporte: env.TELEGRAM_TOPICO_SUPORTE,
  };

  const agendador = iniciarAgendador({
    cronColeta: env.CRON_COLETA,
    cronResumo: env.CRON_RESUMO,
    timezone: env.TZ,
    logger,
    aoColetar: () =>
      executarColeta({
        fontes,
        perfis,
        repo,
        logger,
      }),
    aoEnviarResumo: () =>
      executarResumo({
        bot,
        repo,
        chatId: env.TELEGRAM_CHAT_ID,
        topicos,
        logger,
      }),
  });

  let encerrando = false;
  const encerrar = async (sinal: string): Promise<void> => {
    if (encerrando) return;
    encerrando = true;
    logger.info(`[app] encerrando (${sinal})...`);
    await agendador.parar();
    await bot.stop();
    repo.fechar();
    logger.info("[app] encerrado com sucesso");
  };

  process.once("SIGINT", () => void encerrar("SIGINT"));
  process.once("SIGTERM", () => void encerrar("SIGTERM"));

  logger.info(`[app] iniciando bot do Telegram (${fontes.length} fontes configuradas)`);
  await bot.start({
    onStart: (info) => {
      logger.info(`[app] bot @${info.username} conectado e pronto`);
    },
  });
}

iniciar().catch((erro: unknown) => {
  const logger = criarLoggerConsole();
  logger.error("[app] falha fatal na inicialização", erro);
  process.exit(1);
});
