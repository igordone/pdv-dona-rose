# PDV Dona Rose

Sistema de pedidos, gestão de cardápio e controle operacional voltado para atendimento de condomínios da Dona Rose.

## Visão geral

O projeto está dividido em duas frentes:

- `Área do cliente`: cardápio público, montagem do pedido e acompanhamento do status.
- `Área administrativa`: gestão do cardápio, vendas, perdas, compras, gastos, configurações e relatórios.

O fluxo foi pensado para operação em condomínios, onde o cliente faz o pedido, acompanha o andamento e o entregador recebe um código curto para conferência no balcão ou na entrega.

## Funcionalidades

### Cliente

- Visualiza o cardápio público.
- Adiciona itens ao carrinho.
- Envia o pedido com nome, telefone, entrega ou retirada e forma de pagamento.
- Recebe um código curto de 4 dígitos para ditar ao entregador.
- Acompanha o status do pedido em tempo real.
- No PIX, o cliente confirma que pagou, mas o andamento só fica visível depois da confirmação manual do admin.

### Pedido

- Registra itens, total, forma de pagamento, dados de entrega e observações.
- Mantém histórico do pedido mesmo após concluído.
- Gera código diário de 4 dígitos, de `0001` até `9999`.
- Reinicia a sequência todos os dias.
- Se o limite diário for atingido, a API bloqueia novos pedidos naquele dia.
- O envio de pedidos tem rate limit para reduzir spam e abuso no formulário público.

### Gestão

- Cria, edita, ativa e desativa produtos.
- Cria, edita, remove e reordena categorias.
- Define nome, preço, custo, quantidade em estoque, marca, imagem e categoria do produto.
- Permite pausar manualmente um produto no cardápio.

### Compras

- Registra itens comprados para o comércio.
- Aceita itens do cardápio e também itens específicos de compra.
- Permite cadastrar categorias próprias de compras.
- Reaproveita categorias existentes do cardápio na visão de compras.
- Soma automaticamente o total da compra com base nos itens e quantidades.

### Gastos

- Centraliza os controles de `Perdas` e `Compras`.
- Em `Perdas`, registra itens descartados ou perdidos.
- Em `Compras`, registra reposição de insumos e novos produtos.

### Vendas e relatórios

- Exibe pedidos e indicadores operacionais.
- Mostra dados reais do período, sem números fixos hardcoded.

## Regras de negócio principais

- O estoque não é baixado automaticamente a cada venda.
- A entrada real de estoque vem do módulo de `Compras`.
- A disponibilidade de um produto é controlada manualmente na `Gestão`.
- Produtos e categorias criados em `Compras` não vão para o `Cardápio`.
- Todo item ou categoria criada no `Cardápio` também pode aparecer em `Compras`.
- O código do pedido é curto, humano e diário.
- O PIX é confirmado manualmente pelo admin, sem webhook ou conciliação automática.
- As configurações públicas expostas ao cliente ficam restritas ao necessário para o PIX; o acesso completo fica no painel administrativo.

## Segurança e operação

- O endpoint público de pedidos tem rate limit para reduzir spam.
- O PIX mostrado ao cliente é somente informativo e depende de confirmação manual do admin.
- O acesso administrativo é protegido por sessão e verificação de papel.
- O primeiro deploy deve começar com banco vazio, para que categorias e produtos sejam cadastrados do zero.

## Stack

- Next.js
- TypeScript
- PostgreSQL
- NextAuth
- `pg`
- `next-cloudinary`
- Docker
- Docker Compose

## Como rodar com Docker

1. Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

2. Preencha as variáveis do `.env` com seus valores reais.

3. Suba o banco e a aplicação:

```bash
docker compose up --build
```

4. Acesse:

- Aplicação: `http://localhost:3000`
- Painel administrativo: `http://localhost:3000/admin`

### Primeiro acesso

Na primeira instalação, o banco sobe vazio:

- não há categorias pré-criadas
- não há produtos pré-cadastrados
- não há histórico de vendas, compras ou perdas

Depois do login no painel, comece por:

1. criar as categorias
2. cadastrar os itens do cardápio
3. configurar o PIX em `Configurações`
4. ajustar compras, perdas e estoque conforme a operação

## Como rodar sem Docker

1. Instale as dependências:

```bash
npm install
```

2. Garanta que o PostgreSQL esteja disponível e que `DATABASE_URL` aponte para ele.

3. Copie o `.env.example` para `.env` e ajuste os valores.

4. Inicie o projeto:

```bash
npm run dev
```

5. Acesse a aplicação na porta definida pelo Next.js local.

## Variáveis de ambiente

Use `.env` apenas na sua máquina local. Ele está ignorado pelo Git.

O arquivo `.env.example` contém apenas placeholders, sem credenciais reais.

Principais variáveis:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `NEXT_PUBLIC_CLOUDINARY_API_KEY`
- `CLOUDINARY_URL`

## Scripts disponíveis

- `npm run dev`: ambiente de desenvolvimento.
- `npm run build`: build de produção.
- `npm run start`: executa o build de produção.
- `npm run typecheck`: validação de tipos com TypeScript.

## Estrutura principal

- `pages/index.tsx`: cardápio público e envio de pedidos.
- `pages/admin/*`: painel administrativo.
- `pages/api/orders.ts`: criação de pedidos.
- `pages/api/admin/*`: rotas protegidas do painel.
- `pages/api/auth/[...nextauth].ts`: autenticação.
- `pages/api/cloudinary/signature.ts`: assinatura para upload no Cloudinary.
- `pages/api/settings.ts`: settings públicas do PIX e edição administrativa.
- `lib/db.ts`: conexão com o PostgreSQL.
- `lib/rate-limit.ts`: proteção simples contra spam nos pedidos.
- `lib/schema.ts`: preparação do schema do banco.
- `sql/schema.sql`: schema base para o banco.

## Acesso inicial

- Cardápio público: `http://localhost:3000`
- Painel interno: `http://localhost:3000/admin`
- Login do painel: `http://localhost:3000/admin/login`

## Observações

- Se você alterar a porta do projeto local, ajuste `NEXTAUTH_URL`.
- A gestão de vendas, perdas, compras e estoque foi pensada para o fluxo real de uma produção de salgados, com controle operacional manual onde faz mais sentido.
- O fluxo do PIX é propositalmente manual: o cliente paga, o admin confere e confirma no painel.
