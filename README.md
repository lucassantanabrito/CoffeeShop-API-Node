# CoffeeShop Backend

API REST + tempo real (Socket.io) para o app CoffeeShop-V2, permitindo que Caixa e Barista rodem em dispositivos separados sincronizados por um backend comum.

## Stack

- **Node.js + TypeScript**, para compartilhar o mesmo tipo de dados (`src/types.ts`) que o app React Native (`CoffeeShop/src/types/order.ts`).
- **Express** para a API REST.
- **Socket.io** para sincronização em tempo real (pedido criado/atualizado/excluído, bebida cadastrada).
- **SQLite + Drizzle ORM + better-sqlite3** para persistência.
  - **Por que não Prisma:** a primeira versão deste backend usava Prisma, mas `prisma generate`/`migrate` precisa baixar um binário de `binaries.prisma.sh`, host bloqueado pela política de rede desta organização/conta (erro 403 no proxy, confirmado tanto no ambiente de automação quanto direto). Trocado para Drizzle + `better-sqlite3` (binário nativo instalado via npm/GitHub releases, sem essa dependência externa) — funcionalmente equivalente para esse projeto, sem esse bloqueio.

## Modelo de dados

Espelha exatamente os tipos do app (`Order`, `DrinkItem`, `DrinkOption`, `MilkOption`, `CreateOrderDTO`, `NewDrinkInput`) — ver `src/types.ts`. O `id` do pedido é o `seq` (autoincremento) formatado com zero-padding de 3 dígitos (`"001"`, `"002"`...), igual ao `MemoryOrderService` do app. O catálogo de bebidas usa o mesmo formato de id dinâmico para bebidas cadastradas pelo usuário (`custom-<timestamp>-<random>`).

## Endpoints

- `GET /health` — healthcheck.
- `GET /orders` — lista todos os pedidos.
- `GET /orders/:id` — um pedido (404 se não existir).
- `POST /orders` — cria um pedido (`CreateOrderDTO`). Emite `order:created`.
- `PUT /orders/:id` — atualiza um pedido existente (`CreateOrderDTO`). Emite `order:updated`.
- `PATCH /orders/:id/status` — atualiza só o status (`{status}`). Emite `order:updated`.
- `DELETE /orders/:id` — remove um pedido. Emite `order:deleted`.
- `GET /drinks` — catálogo de bebidas.
- `GET /drinks/milk-options` — opções de leite (estático, espelha `MILK_OPTIONS` do app).
- `POST /drinks` — cadastra uma bebida nova (`NewDrinkInput`). Emite `drink:created`.

### Relatórios (painel web)

Rotas somente leitura usadas pelo painel administrativo. "Hoje" e o agrupamento por dia usam o fuso `BUSINESS_TIMEZONE` (padrão `America/Sao_Paulo`). Parâmetros de query inválidos retornam `400`; filtros vazios (`status=`) são ignorados.

- `GET /reports/summary?period=today|7d|30d` (padrão `today`) — métricas do período, cada uma com `value`, `previous` (período anterior de mesmo tamanho) e `deltaPct` (`null` se o anterior for 0): `orders` (todos os status), `revenue` e `averageTicket` (**só pedidos concluídos**), mais `topDrink` (`{type, label, quantity}` ou `null`, por quantidade vendida).
- `GET /reports/orders-by-day?days=7` (1–90) — `[{date: 'YYYY-MM-DD', orders, revenue}]`, um item por dia local (inclusive sem pedidos), do mais antigo ao mais recente. `revenue` só conta concluídos.
- `GET /reports/orders` — histórico paginado, do mais recente ao mais antigo. Filtros: `from`/`to` (`YYYY-MM-DD`, inclusivos, no fuso local), `status` (`pending|in_progress|completed`), `drink` (`type` da bebida; o pedido precisa conter o item), `search` (trecho do nome do cliente ou número do pedido, ex. `12` ou `#12`), `page` (padrão 1) e `pageSize` (padrão 20, máx. 100). Resposta: `{data: Order[], page, pageSize, total, totalPages}`. Os pedidos recentes do dashboard são `?pageSize=5`.
- `GET /reports/orders.csv` — mesmos filtros (sem paginação, até 10.000 linhas) em CSV para Excel pt-BR (`;`, BOM UTF-8, valores com vírgula decimal), como download (`pedidos-YYYY-MM-DD.csv`).

Limitação conhecida: a busca por nome usa `LIKE` do SQLite, que ignora maiúsculas/minúsculas só para caracteres ASCII (`lucas` acha `Lucas`, mas `joao` não acha `João`).

Todas as rotas de escrita validam o corpo da requisição com `zod` (`src/schemas.ts`) e retornam `400` com detalhes em caso de erro.

**Deliberadamente fora do escopo desta primeira versão:** endpoint de preço calculado (`getDrinkPrice`) — o cliente já tem os dados de `GET /drinks` + `GET /drinks/milk-options` para calcular isso localmente, sem round-trip. Autenticação/autorização também não foi implementada (API aberta), já que é um único estabelecimento com dispositivos confiáveis na mesma rede — revisar se o uso mudar (ex: acesso pela internet).

`PUT /drinks/:type` e `DELETE /drinks/:type` editam/removem uma bebida do catálogo (emitem `drink:updated`/`drink:deleted`).

## Tempo real (Socket.io)

O servidor Socket.io roda no mesmo processo/porta do Express. Eventos emitidos: `order:created`, `order:updated`, `order:deleted`, `drink:created`, `drink:updated`, `drink:deleted` — cada um com o objeto serializado igual ao retorno REST correspondente. Coberto pelos testes de `__tests__/realtime/` (ver seção Testes abaixo).

## Setup

```bash
npm install
cp .env.example .env        # ajuste PORT/DB_FILE se necessário
npm run db:generate         # gera SQL de migração a partir do schema (só ao mudar src/db/schema.ts)
npm run db:migrate          # aplica as migrações no arquivo SQLite
npm run db:seed             # popula o catálogo inicial de bebidas
npm run dev                 # sobe o servidor com reload automático (ts-node-dev)
```

Produção: `npm run build && npm start`. O `start` já roda `db:migrate` automaticamente antes de subir o servidor (importante em produção, onde o arquivo SQLite pode não existir ainda no volume persistente) — só `db:seed` continua manual, porque é opcional e específico do catálogo inicial.

## Testes

```bash
npm test          # roda tudo (unitários + integração + Socket.io) uma vez
npm run test:watch
```

Três camadas, todas em `__tests__/`, todas contra um SQLite **em memória** isolado (nunca toca no `dev.db` real):

- `unit/` — `orderService`/`drinkService` isolados (cálculo de total, erros `NOT_FOUND`, geração do `type` auto-gerado).
- `integration/` — rotas de `/orders` e `/drinks` fim a fim via `supertest` (validação do zod, 404s, etc.).
- `realtime/` — conecta um client de `socket.io-client` de verdade contra um `httpServer` numa porta efêmera e confirma que as rotas emitem os eventos certos.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): a cada push/PR na `main`, roda `typecheck`, `test` e `build` no GitHub Actions.
- **CD**: deploy automático via integração nativa do [Railway](https://railway.app) com o repositório GitHub — configurado para só deployar depois que o CI passar ("Wait for CI" nas configurações do serviço no Railway). Nenhum workflow de deploy customizado; o Railway detecta o Node.js sozinho (via Nixpacks) e usa os scripts `build`/`start` do `package.json`.

### Deploy no Railway

1. Crie um projeto no Railway e conecte este repositório (`lucassantanabrito/CoffeeShop-API-Node`).
2. Adicione um **volume persistente** ao serviço (ex: montado em `/data`) — sem isso, o arquivo SQLite seria apagado a cada redeploy.
3. Configure as variáveis de ambiente do serviço:
   - `DB_FILE=/data/coffeeshop.db` (caminho dentro do volume montado no passo 2)
   - `PORT` não precisa ser definida — o Railway injeta a própria e o `index.ts` já lê `process.env.PORT`.
4. Nas configurações do serviço, ative **"Wait for CI"** apontando pro workflow do GitHub Actions, pra garantir que só deploya código com os testes passando.
5. Primeiro deploy: se quiser o catálogo inicial de bebidas populado, rode `npm run db:seed` uma vez via shell do Railway (`railway run npm run db:seed` pela CLI, ou o botão de shell no painel) — as migrações já rodam sozinhas a cada start.

## Vulnerabilidades conhecidas (dev-only)

`npm audit` acusa 2 avisos em dependências de build/CLI (não usadas em runtime):
- `deepmerge-ts` via `@prisma/client`, puxado como dependência opcional pelo próprio `drizzle-orm` (adaptador Prisma que não usamos — não é invocado neste projeto).
- `esbuild` via `drizzle-kit` (usado só para gerar migrações localmente, nunca em produção).

Nenhum dos dois afeta o servidor rodando. Resolver exigiria downgrade do `drizzle-kit` para uma versão bem mais antiga — não vale a pena para um problema puramente de tooling de desenvolvimento.

## Dados de demonstração

`npm run db:seed:demo` cria ~65 dias de pedidos **fictícios** (clientes inventados, mais movimento nos fins de semana e fila do barista simulada para "hoje") para testar o dashboard e o histórico do painel web. Pré-requisito: catálogo de bebidas populado (`npm run db:seed`). O script só roda em banco **sem pedidos** (recusa se já houver algum) e não tem comando de limpeza — para recomeçar, apague o `dev.db` e rode `db:migrate`, `db:seed` e `db:seed:demo` de novo.

## Ainda não feito

- Autenticação (se necessário no futuro — hoje é API aberta, ok pro cenário de um único estabelecimento com dispositivos confiáveis).
- Se o volume de dados crescer muito além do que um único SQLite aguenta bem, considerar migrar pra Postgres (o Drizzle já suporta trocar de dialeto sem reescrever a lógica de negócio).
