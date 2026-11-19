import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Modalidade, Nivel, Perfil } from "../core/tipos.js";

const nivelSchema: z.ZodType<Nivel> = z.enum([
  "estagio",
  "junior",
  "pleno",
  "senior",
  "especialista",
  "desconhecido",
]);

const modalidadeSchema: z.ZodType<Modalidade> = z.enum([
  "remoto",
  "hibrido",
  "presencial",
  "desconhecida",
]);

const listaTextos = z.array(z.string().trim().min(1));

export const perfilSchema: z.ZodType<Perfil> = z.object({
  titulosBons: listaTextos,
  stackForte: listaTextos,
  stackOk: listaTextos,
  eliminatorios: listaTextos,
  niveis: z.array(nivelSchema),
  modalidades: z.array(modalidadeSchema),
  locaisPresencialAceito: listaTextos,
});

export const perfisSchema = z
  .record(z.string().trim().min(1), perfilSchema)
  .refine((perfis) => Object.keys(perfis).length > 0, {
    message: "deve haver pelo menos um perfil configurado",
  });

export const empresaSchema = z.object({
  slug: z.string().trim().min(1),
  nome: z.string().trim().min(1),
});

export const empresasConfigSchema = z.object({
  greenhouse: z.array(empresaSchema),
  lever: z.array(empresaSchema),
});

export const reposConfigSchema = z.object({
  github: z.array(
    z
      .string()
      .trim()
      .regex(/^[^/\s]+\/[^/\s]+$/, "repo deve estar no formato owner/repo"),
  ),
});

export type EmpresaConfig = z.infer<typeof empresaSchema>;
export type EmpresasConfig = z.infer<typeof empresasConfigSchema>;
export type ReposConfig = z.infer<typeof reposConfigSchema>;

function lerJson(caminho: string): unknown {
  const bruto = readFileSync(caminho, "utf-8");
  try {
    return JSON.parse(bruto);
  } catch (err) {
    throw new Error(`JSON inválido em ${caminho}: ${(err as Error).message}`, { cause: err });
  }
}

function validar<T>(schema: z.ZodType<T>, dados: unknown, rotulo: string): T {
  const res = schema.safeParse(dados);
  if (!res.success) {
    const detalhes = res.error.issues
      .map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`)
      .join("; ");
    throw new Error(`Configuração inválida em ${rotulo}: ${detalhes}`);
  }
  return res.data;
}

export function validarPerfis(dados: unknown): Record<string, Perfil> {
  return validar(perfisSchema, dados, "config/perfis.json");
}

export function validarEmpresas(dados: unknown): EmpresasConfig {
  return validar(empresasConfigSchema, dados, "config/empresas.json");
}

export function validarRepos(dados: unknown): ReposConfig {
  return validar(reposConfigSchema, dados, "config/repos.json");
}

export function carregarPerfis(
  caminho = path.resolve(process.cwd(), "config/perfis.json"),
): Record<string, Perfil> {
  return validarPerfis(lerJson(caminho));
}

export function carregarEmpresas(
  caminho = path.resolve(process.cwd(), "config/empresas.json"),
): EmpresasConfig {
  return validarEmpresas(lerJson(caminho));
}

export function carregarRepos(
  caminho = path.resolve(process.cwd(), "config/repos.json"),
): ReposConfig {
  return validarRepos(lerJson(caminho));
}
