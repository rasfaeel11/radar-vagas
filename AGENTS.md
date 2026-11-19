# AGENTS.md — radar-vagas

Instruções para **qualquer agente de IA** (Claude, Codex, Copilot, Gemini, Cursor, etc.) que trabalhe neste repositório. Este arquivo é a fonte da verdade. `CLAUDE.md` e afins apenas apontam para cá.

> Projeto open-source (licença MIT). Não commite segredos, dados pessoais ou o banco local.

---

## 1. O que é

Agregador pessoal de vagas. Puxa vagas de **fontes abertas**, filtra pelo perfil, dá um **score** para cada uma e manda um **resumo diário no Telegram**. A candidatura continua manual.

Toda manhã chega no Telegram uma lista com as vagas novas das últimas 24h que passaram no filtro, ordenadas por score. Cada vaga tem os botões **Apliquei** e **Descartar**. O que é clicado fica registrado, e isso substitui a planilha de acompanhamento.

### Fora do escopo (de propósito)

- Scraping de LinkedIn, Indeed, Glassdoor e Gupy (proíbem nos termos de uso e bloqueiam).
- Candidatura automática.
- LinkedIn em geral: acompanhado manualmente pelos alertas do próprio site.

**Agentes: não proponham nem implementem nada disso.**

---

## 2. ⚠️ Regra de estudo (obrigatória)

`core/pontuar.ts` e `core/normalizar.ts` são as duas funções mais importantes do projeto e são o treino de TypeScript do autor.

1. O agente escreve **primeiro os testes** (Vitest, com casos de vaga real) de `pontuar` e `normalizar`.
2. O **autor escreve a implementação à mão, sem IA**.
3. Depois o agente **revisa** a implementação (comentários, sugestões, bugs), **sem reescrever o código**.

**Agentes NÃO devem escrever, completar, autocompletar ou "corrigir" a implementação de `pontuar` e `normalizar`**, nem colar a solução em comentário, review ou chat. Pode apontar o problema e dar dica; a correção é do autor. Se a tarefa pedir isso, pare e avise.

---

## 3. Stack

- Node.js (LTS) + **TypeScript** (strict)
- **better-sqlite3** para persistência
- **node-cron** para agendamento
- Bot do Telegram: **grammY** (TypeScript nativo, suporte a tópicos via `message_thread_id`)
- **Vitest** para testes
- `fetch` nativo para HTTP

## 4. Estrutura

```
src/
  core/        funções puras: normalizar, deduplicar, pontuar. Sem I/O.
  fontes/      um adaptador por fonte (github.ts, greenhouse.ts, lever.ts)
  store/       SQLite (better-sqlite3): vagas, envios, acoes
  notificar/   bot do Telegram (resumo diário + botões)
  jobs/        coleta agendada (node-cron) e envio do resumo
config/
  perfis.json      perfis "dev" e "suporte"
  empresas.json    empresas do Greenhouse e do Lever (preenchido à mão)
```

### Fluxo da regra de estudo nos arquivos

`src/core/normalizar.ts` e `src/core/pontuar.ts` exportam `IMPLEMENTADO = false` e os testes usam `describe.skipIf(!IMPLEMENTADO)`. Assim o CI fica verde enquanto a implementação não existe. O autor muda para `true` quando começar a implementar.

### Regras de arquitetura

- `core/` é **puro**: sem rede, sem disco, sem `Date.now()` implícito (receba a data por parâmetro). Fácil de testar.
- Cada fonte é um adaptador que devolve `VagaBruta[]`. **Adicionar fonte nova = criar um arquivo novo em `fontes/`**, sem mexer no núcleo.
- Segredos só via `.env` (veja `.env.example`).

---

## 5. Regras de negócio

### Fontes (só abertas)

| Fonte                                                             | Endpoint                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| GitHub (vagas = issues com labels de nível, modalidade, contrato) | `GET /repos/{owner}/{repo}/issues?state=open&since=<ISO>` com token pessoal  |
| Greenhouse (board público por empresa)                            | `GET https://boards-api.greenhouse.io/v1/boards/{empresa}/jobs?content=true` |
| Lever (board público por empresa)                                 | `GET https://api.lever.co/v0/postings/{empresa}?mode=json`                   |

Repos do GitHub: `backend-br/vagas`, `frontendbr/vagas` e outros da mesma família que estiverem ativos.

### Deduplicação

Mesma **empresa** + **título normalizado** (minúsculas, sem acento, sem "vaga para") nos **últimos 14 dias** = duplicata.

### Pontuação (sugerida, ajustar após ver vagas reais)

| Critério                                    | Pontos                                           |
| ------------------------------------------- | ------------------------------------------------ |
| Termo eliminatório no título                | vaga descartada                                  |
| Título bate com `titulosBons`               | +20                                              |
| Cada termo de `stackForte` na descrição     | +10 (máx. +40)                                   |
| Cada termo de `stackOk`                     | +5 (máx. +15)                                    |
| Nível dentro de `niveis`                    | +15                                              |
| Remoto                                      | +15                                              |
| Híbrido em Recife                           | +10                                              |
| Presencial fora de `locaisPresencialAceito` | descartada                                       |
| Termo eliminatório só na descrição          | −25 (não elimina: "não exigimos 3 anos" é comum) |

A vaga entra no resumo do perfil em que tiver o **maior score**, desde que seja **≥ 40**. Pontuar deve devolver também os **motivos** (lista legível de por que ganhou/perdeu pontos).

### Telegram

- Grupo privado com **Tópicos** ativados: tópico "DEV" e tópico "Suporte". Envio com `message_thread_id` (IDs no `.env`).
- Resumo diário às **8h**: até **15 vagas por tópico**, cada uma com título, empresa, modalidade, score, os 2 primeiros motivos e o link.
- Botões inline: **Apliquei** / **Descartar** → grava em `acoes (vaga_id, acao, data)`.
- Comando `/semana`: recebidas, aplicadas e descartadas **por fonte**.
- **Segurança**: só responde ao grupo e ao usuário configurados no `.env`; ignora qualquer outro.

---

## 6. Convenções

- **Idioma**: código de domínio em português (`vaga`, `pontuar`, `fonte`), como na especificação. Commits e docs em português.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/pt-br/), **um commit por mudança lógica**: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`. Escopo opcional: `feat(fontes): ...`.
- Agentes devem identificar a autoria no rodapé do commit (`Co-Authored-By: ...`) quando aplicável.
- Antes de commitar: `npm run typecheck` e `npm test` passando.
- Não adicione dependências sem necessidade clara; prefira a stdlib.
- Atualize a seção **TODO** abaixo ao concluir um item (marque `[x]`).

---

## 7. TODO — escopo geral do MVP

### Fase 0 — Validação das fontes (antes de codar)

- [x] Confirmar que `backend-br/vagas` está ativo (issues recentes) e anotar o formato real dos labels
- [x] Confirmar `frontendbr/vagas` e anotar labels
- [x] Levantar outros repos da mesma família que estejam ativos
- [x] Testar endpoint do Greenhouse com 1 empresa real e anotar o formato
- [x] Testar endpoint do Lever com 1 empresa real e anotar o formato
- [x] Registrar os achados em `docs/fontes.md`

### Fase 1 — Setup do projeto

- [x] `package.json`, TypeScript strict, `tsconfig.json`
- [x] Vitest configurado (`npm test`)
- [x] Scripts: `dev`, `build`, `start`, `test`, `typecheck`, `lint`
- [x] ESLint + Prettier
- [ ] Carregamento e validação do `.env`
- [ ] Carregamento e validação de `config/perfis.json` e `config/empresas.json`
- [x] CI no GitHub Actions (typecheck + testes)

### Fase 2 — Tipos e núcleo (`src/core/`)

- [x] Tipos: `VagaBruta`, `Vaga`, `Perfil`, `ResultadoPontuacao` (score + motivos + descartada)
- [x] **[agente]** Testes de `normalizar` com casos de vaga real
- [ ] **[autor, sem IA]** Implementar `normalizar`
- [ ] **[agente]** Revisar `normalizar`
- [x] **[agente]** Testes de `pontuar` com casos de vaga real
- [ ] **[autor, sem IA]** Implementar `pontuar`
- [ ] **[agente]** Revisar `pontuar`
- [x] `deduplicar` (empresa + título normalizado, janela de 14 dias) + testes
- [x] `escolherPerfil` (maior score, mínimo 40) + testes

### Fase 3 — Fontes (`src/fontes/`)

- [ ] Interface comum do adaptador (`buscar(desde: Date): Promise<VagaBruta[]>`)
- [ ] `github.ts` (issues + labels → nível, modalidade, contrato) com token
- [ ] `greenhouse.ts` lendo empresas de `config/empresas.json`
- [ ] `lever.ts` lendo empresas de `config/empresas.json`
- [ ] Tratamento de erro por fonte (uma fonte falhando não derruba as outras)
- [ ] Testes com fixtures (JSON real salvo, sem rede)

### Fase 4 — Persistência (`src/store/`)

- [ ] Schema SQLite: `vagas`, `envios`, `acoes (vaga_id, acao, data)`
- [ ] Migrações simples
- [ ] Inserir vagas novas e consultar as das últimas 24h não enviadas
- [ ] Registrar envios e ações
- [ ] Consulta agregada para `/semana` (por fonte)

### Fase 5 — Telegram (`src/notificar/`)

- [ ] Bot com token do `.env`
- [ ] Filtro de segurança (só grupo e usuário do `.env`)
- [ ] Formatação da vaga (título, empresa, modalidade, score, 2 motivos, link)
- [ ] Envio por tópico (`message_thread_id`), até 15 vagas por tópico, ordenadas por score
- [ ] Botões inline Apliquei / Descartar → grava em `acoes` e atualiza a mensagem
- [ ] Comando `/semana`

### Fase 6 — Jobs (`src/jobs/`)

- [ ] Coleta agendada (node-cron): fontes → normalizar → deduplicar → pontuar → salvar
- [ ] Resumo diário às 8h (fuso America/Recife)
- [ ] Logs simples de cada execução

### Fase 7 — Deploy e operação

- [ ] Escolher onde rodar (VPS, Raspberry, Fly.io, etc.)
- [ ] Backup do SQLite
- [ ] Documentar setup do bot e do grupo com Tópicos no README

### Depois do MVP (ideias, não fazer agora)

- [ ] Ajustar pesos da pontuação com base em vagas reais e no histórico de `acoes`
- [ ] Novas fontes abertas (novos adaptadores)
