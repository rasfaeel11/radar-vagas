import { describe, expect, it } from "vitest";
import {
  carregarEmpresas,
  carregarPerfis,
  carregarRepos,
  validarEmpresas,
  validarPerfis,
  validarRepos,
} from "./arquivos.js";

describe("arquivos reais em config/", () => {
  it("carrega e valida config/perfis.json", () => {
    const perfis = carregarPerfis();
    expect(Object.keys(perfis)).toEqual(["dev", "suporte"]);
    expect(perfis.dev?.niveis).toContain("junior");
    expect(perfis.suporte?.titulosBons).toContain("suporte");
  });

  it("carrega e valida config/empresas.json", () => {
    const empresas = carregarEmpresas();
    expect(empresas.greenhouse.length).toBeGreaterThan(0);
    expect(empresas.lever.length).toBeGreaterThan(0);
  });

  it("carrega e valida config/repos.json", () => {
    const repos = carregarRepos();
    expect(repos.github).toContain("backend-br/vagas");
  });
});

describe("validação de erros", () => {
  it("rejeita perfis.json vazio ou com nível inválido", () => {
    expect(() => validarPerfis({})).toThrow(/pelo menos um perfil/);
    expect(() =>
      validarPerfis({
        dev: {
          titulosBons: ["dev"],
          stackForte: [],
          stackOk: [],
          eliminatorios: [],
          niveis: ["trainee"],
          modalidades: ["remoto"],
          locaisPresencialAceito: [],
        },
      }),
    ).toThrow(/perfis\.json/);
  });

  it("rejeita empresas.json com slug vazio ou lista faltando", () => {
    expect(() => validarEmpresas({ greenhouse: [{ slug: "", nome: "X" }], lever: [] })).toThrow(
      /empresas\.json/,
    );
    expect(() => validarEmpresas({ greenhouse: [] })).toThrow(/empresas\.json/);
  });

  it("rejeita repos.json fora do formato owner/repo", () => {
    expect(() => validarRepos({ github: ["backend-br"] })).toThrow(/owner\/repo/);
    expect(() => validarRepos({ github: ["a/b/c"] })).toThrow(/owner\/repo/);
  });
});
