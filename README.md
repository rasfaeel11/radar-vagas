# radar-vagas

Agregador pessoal de vagas, open-source. Puxa vagas de **fontes abertas** (repositórios de vagas no GitHub, boards públicos do Greenhouse e do Lever), filtra por perfil, dá um score para cada vaga e manda um **resumo diário no Telegram** com botões **Apliquei** / **Descartar**.

A candidatura continua manual. Não faz scraping de LinkedIn, Indeed, Glassdoor ou Gupy.

> 🚧 Em construção. Veja o roadmap na seção TODO do [AGENTS.md](./AGENTS.md).

## Como funciona

1. **Coleta**: cada fonte é um adaptador em `src/fontes/` que devolve `VagaBruta[]`.
2. **Núcleo** (`src/core/`, funções puras): normaliza, deduplica (empresa + título nos últimos 14 dias) e pontua contra os perfis de `config/perfis.json`.
3. **Store**: SQLite com vagas, envios e ações.
4. **Telegram**: às 8h, até 15 vagas por tópico (DEV / Suporte), com score ≥ 40. Comando `/semana` mostra qual fonte rende.

## Configuração

```bash
cp .env.example .env   # preencha os tokens e IDs
```

- `config/perfis.json`: termos, níveis e modalidades de cada perfil.
- `config/empresas.json`: slugs das empresas no Greenhouse e no Lever.

## Contribuindo

Pull requests são bem-vindos. Use [Conventional Commits](https://www.conventionalcommits.org/pt-br/) e leia o [AGENTS.md](./AGENTS.md), que vale para humanos e IAs.

## Licença

[MIT](./LICENSE)
