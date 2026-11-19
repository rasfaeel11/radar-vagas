export type NivelLog = "info" | "warn" | "error";

export interface Logger {
  info(mensagem: string): void;
  warn(mensagem: string): void;
  error(mensagem: string, erro?: unknown): void;
}

export interface OpcoesLoggerConsole {
  agora?: () => Date;
  escrever?: (nivel: NivelLog, linha: string) => void;
}

function formatarErro(erro: unknown): string {
  if (erro instanceof Error) {
    return erro.message;
  }
  return String(erro);
}

/**
 * Logger simples de linha única com timestamp ISO e nível.
 * Ex.: `[2026-11-19T08:00:00.000Z] [INFO] [coleta] concluída em 120ms`
 */
export function criarLoggerConsole(opcoes: OpcoesLoggerConsole = {}): Logger {
  const agora = opcoes.agora ?? (() => new Date());
  const escrever =
    opcoes.escrever ??
    ((nivel: NivelLog, linha: string) => {
      if (nivel === "error") {
        console.error(linha);
      } else if (nivel === "warn") {
        console.warn(linha);
      } else {
        console.log(linha);
      }
    });

  const registrar = (nivel: NivelLog, mensagem: string, erro?: unknown): void => {
    const ts = agora().toISOString();
    const sufixo = erro !== undefined ? ` — ${formatarErro(erro)}` : "";
    escrever(nivel, `[${ts}] [${nivel.toUpperCase()}] ${mensagem}${sufixo}`);
  };

  return {
    info: (mensagem) => registrar("info", mensagem),
    warn: (mensagem) => registrar("warn", mensagem),
    error: (mensagem, erro) => registrar("error", mensagem, erro),
  };
}
