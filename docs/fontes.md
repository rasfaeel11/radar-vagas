# Fontes: validação (Fase 0)

Levantamento feito em **2026-11-19**. Contagem = issues abertas atualizadas nos últimos 30 dias.

## GitHub (vagas como issues)

| Repo | Issues 30d | Última | Usar? |
|---|---|---|---|
| `backend-br/vagas` | 39 | 2026-11-18 | ✅ principal |
| `react-brasil/vagas` | 4 | 2026-11-18 | ✅ |
| `frontendbr/vagas` | 3 | 2026-11-18 | ✅ |
| `phpdevbr/vagas` | 3 | 2026-11-05 | ⚪ opcional |
| `androiddevbr/vagas` | 3 | 2026-10-30 | ⚪ opcional |
| `qa-brasil/vagas` | 1 | 2026-11-17 | ⚪ opcional |
| `soujava/vagas-java` | 1 | 2026-11-17 | ❌ (Java/Spring é eliminatório no perfil dev) |
| `nodejsdevbr/vagas` | 1 | 2026-08-27 | ❌ parado |
| `CocoaHeadsBrasil/vagas`, `vuejs-br/vagas`, `datascience-br/vagas`, `Gommunity/vagas`, `uxbrasil/vagas` | 0 | — | ❌ parados |
| `devopsbr/vagas`, `golang-br/vagas`, `python-brasil/vagas` | — | — | ❌ não existem (404) |

### Observações da API

- `since` filtra por **`updated_at`**, não por criação. Filtrar `created_at` no adaptador.
- O endpoint de issues também devolve **PRs**: descartar itens com `pull_request`.
- **Não existe campo de empresa.** Ela vem no título, em formatos variados:
  - `[Remoto] Desenvolvedor(a) Backend Pleno - White Label e Plataforma - Mimix AI` → último segmento após ` - `
  - `[Remote] Product Engineer na JotPsych` → depois de ` na ` / ` at `
  - Corpo costuma ter a seção `### Sobre a empresa` / `### About the company`.
  - Fallback: `desconhecida`.
- Título costuma começar com a modalidade entre colchetes: `[Remoto]`, `[Remote]`, `[Híbrido]`.

### Formato dos labels

**backend-br/vagas** (labels "limpos", com acento):
- Nível: `Júnior`, `Pleno`, `Sênior`, `Especialista`
- Modalidade: `Remoto`, `Híbrido` (presencial: ausência de ambos)
- Contrato: `CLT`, `PJ`, `Contrato`, `Freelance`
- Stack: `Node.js`, `TypeScript`, `PostgreSQL`, `Python`, `SQL`, `JavaScript`, `.NET`, `C#`, `Java`, `Spring`, `Linux`, ...
- Meta (ignorar): `verificada`, `formato-sugerido`, `em-triagem`, `link-quebrado`

**frontendbr/vagas**: mesmo padrão (`Sênior`, `Especialista`, `PJ`, `Remoto`).

**react-brasil/vagas** (labels com emoji, **sem acento**):
- Nível: `👦 Junior`, `👨 Pleno`, `👴 Senior`
- Modalidade: `🏢 Remoto`, `🏢 Presencial`, `🏢 Flexível` (= híbrido)
- Contrato: `⚖️ CLT`, `⚖️ PJ`, `⚖️ Outros`

**qa-brasil/vagas**: `CLT`, `Presencial`, `Remoto`, `Sênior`, `Inglês`, `São Paulo` (cidade vira label).

➡️ Conclusão: o adaptador deve **normalizar o label** (remover emoji, minúsculas, sem acento) antes de mapear para nível/modalidade/contrato. Ex.: `👦 Junior` e `Júnior` → `junior`; `🏢 Flexível` e `Híbrido` → `hibrido`.

## Greenhouse

`GET https://boards-api.greenhouse.io/v1/boards/{empresa}/jobs?content=true`

- Slug inexistente → 404. `nubank` existe mas está com 0 vagas.
- Testado com `wildlifestudios` (15 vagas).
- Campos úteis: `id`, `title`, `company_name`, `absolute_url`, `location.name`, `first_published`, `updated_at`, `content`.
- **`content` vem com HTML escapado** (`&lt;p&gt;`): precisa `unescape` + remover tags.
- Modalidade às vezes em `metadata[]` (ex.: `{"name": "Work Model", "value": "Hybrid"}`), senão inferir de `location.name`/conteúdo.

## Lever

`GET https://api.lever.co/v0/postings/{empresa}?mode=json`

- Slug inexistente → `{"ok": false, "error": "Document not found"}` (tratar como erro, não como lista).
- Testado com `neon` (11 vagas).
- Campos úteis: `id`, `text` (título), `hostedUrl`, `createdAt` (**epoch em ms**), `descriptionPlain`, `workplaceType` (`remote` / `hybrid` / `onsite`), `categories.location`, `categories.commitment` (`CLT`, ...), `country`.
- Não tem nome da empresa: usar o slug/nome do `config/empresas.json`.
