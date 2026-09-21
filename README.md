<div align="center">

# Dona Rose Salgados

**Sistema de pedidos, gestão de cardápio e controle operacional.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![Mercado Pago](https://img.shields.io/badge/Mercado%20Pago-PIX-009EE3?style=flat-square&logo=mercadopago&logoColor=white)](https://www.mercadopago.com.br/)

</div>

---

## Visão Geral

Essa aplicação foi desenvolvida para solucionar uma necessidade real do comércio Dona Rose. Trata-se de um sistema web full-stack criado para gerenciar todo o ciclo operacional do estabelecimento, desde a apresentação do cardápio e realização de pedidos pelos clientes até o gerenciamento e controle das operações pelo administrador.

O projeto é dividido em duas frentes:

- **Área do cliente** — cardápio público, montagem do pedido, pagamento via PIX com QR Code e acompanhamento em tempo real.
- **Área administrativa** — dashboard, gestão de cardápio, vendas, perdas, compras, gastos, configurações e relatórios.

<div align="center">

![Cardápio do Cliente](screenshots/cardapio_cliente.png)

*Cardápio público com produtos, preços e categorias*

</div>

---

## Funcionalidades

### Área do Cliente

| Funcionalidade | Descrição |
|----------------|-----------|
| Cardápio público | Visualiza produtos com imagem, preço e categoria |
| Carrinho | Adiciona e remove itens com controles +/- |
| Pedido | Envia com nome, telefone, entrega/retirada e pagamento |
| PIX com QR Code | QR Code gerado automaticamente via Mercado Pago |
| Código curto | Recebe código de 4 dígitos (ex: 0007) para o entregador |
| Acompanhamento | Stepper de status em tempo real com estimativa de tempo |
| Cancelamento | Cancela pedidos pendentes diretamente pelo cliente |
| Pedir novamente | Repete o pedido anterior com um clique |

<div align="center">

| Cardápio | Carrinho | Pagamento PIX | Acompanhamento |
|:---------:|:--------:|:-------------:|:--------------:|
| ![Cardápio](screenshots/cardapio_cliente.png) | ![Carrinho](screenshots/carrinho_cliente.png) | ![PIX](screenshots/cliente_pagtopix.png) | ![Acompanhar](screenshots/acompanharpedido_cliente.png) |

</div>

### Área Administrativa

| Funcionalidade | Descrição |
|----------------|-----------|
| Dashboard | Pedidos do dia com status, badges e resumo operacional |
| Gestão de cardápio | CRUD completo de categorias e produtos |
| Histórico de vendas | Pedidos agrupados por data com indicadores |
| Perdas e compras | Registro de itens descartados e reposição de insumos |
| Configurações | Gateway Mercado Pago, PIX estático (fallback), dados do recebedor |
| Autenticação | Login seguro com NextAuth |

<div align="center">

| Dashboard | Gestão | Vendas | Configurações |
|:---------:|:------:|:------:|:-------------:|
| ![Dashboard](screenshots/admin_dashboardpedidos.png) | ![Gestão](screenshots/admin_gestaocardapio.png) | ![Vendas](screenshots/admin_historicodevendas.png) | ![Config](screenshots/admin_configgatewaymlb.png) |

</div>

---

## Fluxo de Pagamento

O sistema implementa uma arquitetura de pagamento com **fallback automático**:

<div align="center">

![Fluxo de Pagamento PIX](screenshots/fluxo_pix_mercado_pago_fallback.png)

*Fluxo de pagamento: Mercado Pago (automático) com fallback para PIX Estático (manual)*

</div>

- **PIX via Mercado Pago** — QR Code gerado automaticamente, confirmação via webhook
- **PIX Estático (fallback)** — QR Code fixo, confirmação manual pelo admin
- **Criptografia** — Access Token e Webhook Secret criptografados com AES-256-GCM

<div align="center">

![Detalhe Pedido](screenshots/admin_dashboarddetalhespedido.png)

*Dashboard com detalhes do pedido e status de pagamento*

</div>

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19, Next.js 15, TypeScript |
| Backend | Next.js API Routes |
| Banco de Dados | PostgreSQL 16 |
| Autenticação | NextAuth v4 |
| Pagamentos | Mercado Pago (Orders API - PIX) |
| Imagens | Cloudinary |
| Criptografia | AES-256-GCM (Node.js crypto) |
| Infraestrutura | Docker, Docker Compose |

---

## Pré-requisitos

- **Node.js** 18+
- **Docker** e **Docker Compose** (recomendado)
- Conta gratuita no **[Mercado Pago](https://www.mercadopago.com.br/)**
- Conta gratuita no **[Cloudinary](https://cloudinary.com/)**

---

## Como Rodar

### Com Docker (Recomendado)

```bash
# 1. Clonar o repositório
git clone https://github.com/seu-usuario/pdv-dona-rose.git
cd pdv-dona-rose

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais (veja Guia de Configuração)

# 3. Subir banco e aplicação
docker compose up --build

# 4. Acessar
# Cardápio: http://localhost:3000
# Admin:    http://localhost:3000/admin
```

### Sem Docker

```bash
# 1. Instalar dependências
npm install

# 2. Configurar PostgreSQL e .env
cp .env.example .env
# Ajuste DATABASE_URL para seu PostgreSQL

# 3. Iniciar
npm run dev
```

---

## Guia de Configuração

### 1. Criar aplicação no Mercado Pago

1. Acesse o [Painel de Desenvolvedores](https://www.mercadopago.com.br/developers/panel/app)
2. Clique em **Criar aplicação**
3. Preencha:
   - **Nome da aplicação**: Ex: "PDV Dona Rose"
   - **Descrição**: Ex: "Sistema de pedidos para salgados"
   - **Setor**: Selecione o mais adequado
4. Clique em **Criar aplicação**
5. Na página da aplicação, vá em **Credenciais** no menu lateral
6. Copie a **Public Key** e o **Access Token** (aba "Testes")

### 2. Ativar PIX na conta

1. No painel do Mercado Pago, vá em **Seu negócio > Meios de pagamento**
2. Procure **PIX** e ative-o
3. Cadastre uma **chave PIX** (e-mail, CPF, telefone ou aleatória)
4. Pronto! PIX estará disponível para receber pagamentos

### 3. Configurar Webhook

O webhook permite que o Mercado Pago notifique sua aplicação quando um pagamento for confirmado.

1. No painel do Mercado Pago, vá em **Sua aplicação > Webhooks**
2. Clique em **Adicionar webhook**
3. Cole a URL do webhook:
   ```
   https://seudominio.com/api/webhooks/mercadopago
   ```
4. Selecione o tópico: **Pagamentos**
5. Clique em **Salvar**

> **Desenvolvimento local:** Use o [ngrok](https://ngrok.com/) para expor sua aplicação:
> ```bash
> ngrok http 3000
> ```
> Copie a URL pública (ex: `https://abc123.ngrok-free.app`) e use como `APP_URL` no `.env`.

### 4. Configurar Cloudinary

O Cloudinary é usado para armazenar imagens dos produtos.

1. Acesse o [Cloudinary](https://cloudinary.com/) e crie uma conta gratuita
2. No painel, copie:
   - **Cloud Name** (aba Dashboard)
   - **API Key** (aba Settings > API Keys)
3. Monte a **CLOUDINARY_URL**:
   ```
   cloudinary://API_KEY:API_SECRET@CLOUD_NAME
   ```
   O **API Secret** também está na aba Settings > API Keys.

### 5. Configurar no painel admin

1. Acesse `http://localhost:3000/admin/login`
2. Faça login com as credenciais do `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`)
3. Vá em **Configurações**
4. Na seção **Gateway de Pagamento**:
   - Cole o **Access Token** do Mercado Pago
   - Cole a **Public Key** do Mercado Pago
   - Clique em **Salvar credenciais**
   - Clique em **Testar conexão** para verificar
5. Na seção **PIX estático (Fallback)**:
   - Envie uma imagem de QR Code PIX (opcional, para fallback)
   - Preencha a **Chave PIX** (e-mail, telefone ou chave aleatória)
   - Preencha o **Nome do recebedor**
   - Clique em **Salvar**

### 6. Configuração inicial do cardápio

1. Vá em **Gestão** no painel admin
2. Crie **categorias** (ex: Assados, Fritos, Bebidas)
3. Crie **produtos** para cada categoria:
   - Nome, preço, custo
   - Imagem (upload via Cloudinary)
   - Categoria
4. Os produtos aparecerão automaticamente no cardápio público

---

## Variáveis de Ambiente

### Obrigatórias

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | String de conexão com PostgreSQL |
| `NEXTAUTH_URL` | URL da aplicação (ex: http://localhost:3000) |
| `NEXTAUTH_SECRET` | Secret para NextAuth (min 32 chars) |
| `ADMIN_EMAIL` | Email do administrador |
| `ADMIN_PASSWORD` | Senha do administrador |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Nome da nuvem Cloudinary |
| `NEXT_PUBLIC_CLOUDINARY_API_KEY` | API Key do Cloudinary |
| `CLOUDINARY_URL` | URL completa do Cloudinary |

### Opcionais (PIX Gateway)

| Variável | Descrição |
|----------|-----------|
| `MERCADO_PAGO_ACCESS_TOKEN` | Access Token do Mercado Pago |
| `MERCADO_PAGO_PUBLIC_KEY` | Public Key do Mercado Pago |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Segredo para validar webhooks |
| `SETTINGS_ENCRYPTION_KEY` | Chave de criptografia (32 bytes hex) |
| `APP_URL` | URL pública (para webhook) |

> **Nota:** As variáveis do Mercado Pago são opcionais. Se não configuradas, o sistema usa PIX estático como fallback. As credenciais também podem ser configuradas pelo painel admin em **Configurações**.

---

## Estrutura do Projeto

```
pdv-dona-rose/
├── components/
│   ├── AdminLayout.tsx          # Layout do painel administrativo
│   └── Feedback.tsx             # Sistema de notificações toast
├── lib/
│   ├── admin-access.ts          # Verificação de acesso admin
│   ├── cloudinary.ts            # Configuração do Cloudinary
│   ├── crypto.ts                # Criptografia AES-256-GCM
│   ├── db.ts                    # Conexão com PostgreSQL
│   ├── mercadopago.ts           # Integração Mercado Pago (Orders API)
│   ├── rate-limit.ts            # Rate limiting para API
│   ├── schema.ts                # Migrations do banco
│   └── session.ts               # Sessão do cliente (localStorage)
├── pages/
│   ├── api/
│   │   ├── admin/               # APIs protegidas do admin
│   │   ├── auth/                # Autenticação NextAuth
│   │   ├── webhooks/            # Webhook do Mercado Pago
│   │   ├── menu.ts              # API pública do cardápio
│   │   ├── orders.ts            # Criação de pedidos
│   │   └── settings.ts          # Configurações do sistema
│   ├── admin/
│   │   ├── cardapio.tsx         # Gestão de cardápio
│   │   ├── configuracoes.tsx    # Configurações gateway PIX
│   │   ├── gastos.tsx           # Perdas e compras
│   │   ├── gestao.tsx           # Gestão de produtos
│   │   ├── index.tsx            # Dashboard principal
│   │   ├── login/               # Login do admin
│   │   ├── perdas.tsx           # Registro de perdas
│   │   └── vendas.tsx           # Histórico de vendas
│   ├── index.tsx                # Cardápio público (cliente)
│   └── _app.tsx                 # Provider global
├── sql/
│   └── schema.sql               # Schema base do banco
├── styles/
│   └── globals.css              # Estilos globais
├── types/
│   └── domain.ts                # Tipos do domínio
├── docker-compose.yml           # Configuração Docker
├── Dockerfile                   # Build de produção
└── package.json
```

---

## Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| Estoque manual | O estoque não é baixado automaticamente a cada venda |
| Compras = Entrada | A entrada real de estoque vem do módulo de Compras |
| Disponibilidade | Controlada manualmente na Gestão |
| Código diário | Sequencial de 0001 a 9999, reinicia todo dia |
| PIX fallback | Se Mercado Pago falhar, usa PIX estático automaticamente |
| Criptografia | Access Token e Webhook Secret criptografados no banco |
| Cache | Credenciais cacheadas por 60 segundos, invalidadas ao salvar |

---

## Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Ambiente de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Executa build de produção |
| `npm run typecheck` | Validação de tipos TypeScript |

---

## Acesso Inicial

| Rota | Descrição |
|------|-----------|
| `/` | Cardápio público (cliente) |
| `/admin` | Painel administrativo |
| `/admin/login` | Login do administrativo |
