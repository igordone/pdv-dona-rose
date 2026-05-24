# PDV Dona Rose

Base inicial do sistema de pedidos e operação para venda de salgados.

## Stack

- Next.js
- TypeScript
- PostgreSQL
- Docker
- docker-compose
- NextAuth
- `pg`
- `next-cloudinary`

## Estrutura inicial

- `pages/index.tsx`: cardápio público para o cliente
- `pages/admin/*`: painel interno
- `pages/api/menu.ts`: cardápio público
- `pages/api/orders.ts`: criação de pedidos
- `pages/api/admin/*`: rotas protegidas do painel
- `pages/api/auth/[...nextauth].ts`: autenticação
- `pages/api/cloudinary/signature.ts`: assinatura para upload no Cloudinary
- `lib/db.ts`: conexão com o PostgreSQL
- `sql/schema.sql`: schema inicial do banco

## Como subir localmente

1. Copie `.env.example` para `.env`.
2. Ajuste as variáveis se quiser.
3. Suba o banco e a aplicação:

```bash
docker compose up --build
```

## Variáveis de ambiente

Use `.env` apenas na sua máquina local. Ele já está ignorado pelo Git.

O arquivo `.env.example` contém apenas placeholders, sem credenciais reais.

## Acesso inicial

- Cardápio público: `http://localhost:3000`
- Painel interno: `http://localhost:3000/admin`
- Login do painel: `http://localhost:3000/admin/login`

## Credenciais padrão

Se não houver funcionário cadastrado no banco ainda, use as variáveis do `.env`:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `NEXT_PUBLIC_CLOUDINARY_API_KEY`
- `CLOUDINARY_URL`

## Categorias

O sistema já inicia com:

- Bebidas
- Fritos
- Assados

Na gestão, você pode criar novas categorias e vincular cada produto a uma delas.

## Próximos passos naturais

- adicionar edição e exclusão de itens
- criar detalhe de pedido por ID
- exibir pedidos em tempo real no painel
- permitir cadastro de funcionários no painel
