import { describe, expect, it } from "vitest";
import { escolherPerfil } from "./escolherPerfil.js";
import type { ResultadoPontuacao } from "./tipos.js";

const r = (score: number, descartada = false): ResultadoPontuacao => ({
  score,
  descartada,
  motivos: [],
});

describe("escolherPerfil", () => {
  it("escolhe o perfil com maior score", () => {
    expect(escolherPerfil({ dev: r(40), suporte: r(85) })?.perfil).toBe("suporte");
    expect(escolherPerfil({ dev: r(75), suporte: r(50) })?.perfil).toBe("dev");
  });

  it("score igual a 40 entra; abaixo não", () => {
    expect(escolherPerfil({ dev: r(40), suporte: r(10) })?.perfil).toBe("dev");
    expect(escolherPerfil({ dev: r(39), suporte: r(10) })).toBeNull();
  });

  it("ignora perfis em que a vaga foi descartada", () => {
    expect(escolherPerfil({ dev: r(90, true), suporte: r(45) })?.perfil).toBe("suporte");
    expect(escolherPerfil({ dev: r(0, true), suporte: r(0, true) })).toBeNull();
  });

  it("empate fica com o primeiro perfil", () => {
    expect(escolherPerfil({ dev: r(60), suporte: r(60) })?.perfil).toBe("dev");
  });

  it("aceita mínimo customizado e devolve o resultado junto", () => {
    const escolhido = escolherPerfil({ dev: r(20) }, 10);
    expect(escolhido).toEqual({ perfil: "dev", resultado: r(20) });
  });
});
