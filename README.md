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

Todas as rotas de escrita validam o corpo da requisição com `zod` (`src/schemas.ts`) e retornam `400` com detalhes em caso de erro.

**Deliberadamente fora do escopo desta primeira versão:** endpoint de preço calculado (`getDrinkPrice`) — o cliente já tem os dados de `GET /drinks` + `GET /drinks/milk-options` para calcular isso localmente, sem round-trip. Autenticação/autorização também não foi implementada (API aberta), já que é um único estabelecimento com dispositivos confiáveis na mesma rede — revisar se o uso mudar (ex: acesso pela internet).

## Tempo real (Socket.io)

O servidor Socket.io roda no mesmo processo/porta do Express. Eventos emitidos: `order:created`, `order:updated`, `order:deleted`, `drink:created` — cada um com o objeto serializado igual ao retorno REST correspondente. Testado manualmente com um cliente `socket.io-client` (não é dependência do backend — isso é responsabilidade do app cliente).

## Setup

```bash
npm install
cp .env.example .env        # ajuste PORT/DB_FILE se necessário
npm run db:generate         # gera SQL de migração a partir do schema (só ao mudar src/db/schema.ts)
npm run db:migrate          # aplica as migrações no arquivo SQLite
npm run db:seed             # popula o catálogo inicial de bebidas
npm run dev                 # sobe o servidor com reload automático (ts-node-dev)
```

Produção: `npm run build && npm start`.

## Vulnerabilidades conhecidas (dev-only)

`npm audit` acusa 2 avisos em dependências de build/CLI (não usadas em runtime):
- `deepmerge-ts` via `@prisma/client`, puxado como dependência opcional pelo próprio `drizzle-orm` (adaptador Prisma que não usamos — não é invocado neste projeto).
- `esbuild` via `drizzle-kit` (usado só para gerar migrações localmente, nunca em produção).

Nenhum dos dois afeta o servidor rodando. Resolver exigiria downgrade do `drizzle-kit` para uma versão bem mais antiga — não vale a pena para um problema puramente de tooling de desenvolvimento.

## Ainda não feito

- **Integração com o app React Native.** O app já tem a abstração certa para isso: `IOrderService`/`IDrinkService` (`src/services/`) com `setOrderService`/`setDrinkService` nos stores Zustand. O próximo passo é criar implementações desses dois services que chamem esta API (fetch/axios) e um listener de Socket.io que atualize o `orderStore`/`drinkStore` quando os eventos chegarem — sem precisar mudar as telas.
- Autenticação (se necessário no futuro).
- Deploy/hosting (a decidir: rodar localmente na rede da cafeteria, um servidor na nuvem, etc. — influencia se `DB_FILE` deve virar Postgres).
- Testes automatizados (nenhum teste ainda neste projeto; o app RN tem 33 testes, o backend não tem nenhum ainda).
