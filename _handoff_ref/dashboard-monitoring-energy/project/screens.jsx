// Five redesigned screens for D.CC, presented inside design canvas artboards.

const t = window.tokens;

// ============================================================
// SHARED UI BITS
// ============================================================
const btn = {
  primary: {
    background: t.orange, color: '#fff', border: 'none',
    padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
  },
  ghost: {
    background: '#fff', color: t.textSub,
    border: `1px solid ${t.border}`,
    padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  },
  outlineOrange: {
    background: '#fff', color: t.orangeDark,
    border: `1px solid ${t.orangeTint2}`,
    padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  },
};

function Pill({ color = 'orange', children }) {
  const c = {
    orange:  { bg: t.orangeTint,  fg: t.orangeDark, dot: t.orange },
    green:   { bg: t.successTint, fg: t.success,    dot: '#22C55E' },
    red:     { bg: t.dangerTint,  fg: t.danger,     dot: '#DC2626' },
    stone:   { bg: '#F5F5F4',     fg: t.textSub,    dot: '#A8A29E' },
  }[color];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: c.bg, color: c.fg,
      padding: '3px 9px 3px 7px', borderRadius: 999,
      fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
      {children}
    </span>
  );
}

// Striped placeholder used for food imagery (no fake hand-drawn food art)
function FoodPlaceholder({ label = 'product shot', hue = 25, height = 150 }) {
  const stripeA = `oklch(0.93 0.04 ${hue})`;
  const stripeB = `oklch(0.88 0.06 ${hue})`;
  return (
    <div style={{
      height, width: '100%', borderRadius: 8,
      background: `repeating-linear-gradient(135deg, ${stripeA} 0 10px, ${stripeB} 10px 20px)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11, color: `oklch(0.35 0.06 ${hue})`,
        background: 'rgba(255,255,255,0.7)',
        padding: '4px 8px', borderRadius: 4, letterSpacing: 0.2,
      }}>{label}</div>
    </div>
  );
}

const labelStyle = {
  fontSize: 10.5, fontWeight: 600, letterSpacing: 1.2,
  color: t.textMute, textTransform: 'uppercase',
};

// ============================================================
// 1. DASHBOARD
// ============================================================
function DashboardScreen() {
  const stats = [
    { label: 'Total de pedidos', value: 18, accent: t.orange,   delta: '+12% vs ontem', sub: 'no dia' },
    { label: 'Pendentes',        value: 6,  accent: '#F59E0B',  delta: 'tempo médio 8 min', sub: 'aguardando' },
    { label: 'Completos',        value: 10, accent: '#16A34A',  delta: 'R$ 612,50 faturado', sub: 'finalizados' },
    { label: 'Cancelados',       value: 2,  accent: '#DC2626',  delta: 'R$ 38,00 perdidos', sub: 'no dia' },
  ];

  const orders = [
    { id: '20251011071230', cliente: 'Maria Costa', hora: '12:30', status: 'pendente', preco: '55,00', itens: '2x Coxinha, 1x Suco', tempo: '4 min' },
    { id: '20251011071229', cliente: 'Paulo Lima',  hora: '12:15', status: 'completo', preco: '78,50', itens: '1x Combo Frito, 2x Refri', tempo: '— entregue 12:22' },
    { id: '20251011071228', cliente: 'Ana Souza',   hora: '12:10', status: 'pendente', preco: '32,00', itens: '4x Esfiha, 1x Água', tempo: '12 min' },
    { id: '20251011071227', cliente: 'Bruno Reis',  hora: '12:02', status: 'completo', preco: '24,00', itens: '3x Kibe Frito', tempo: '— entregue 12:09' },
    { id: '20251011071226', cliente: 'Júlia Mota',  hora: '11:58', status: 'pendente', preco: '41,50', itens: '1x Pastel Queijo, 1x Suco', tempo: '18 min' },
    { id: '20251011071225', cliente: 'Diego Alves', hora: '11:50', status: 'cancelado', preco: '19,00', itens: '2x Empada', tempo: 'cancelado pelo cliente' },
  ];

  return (
    <Frame active="dashboard" title="Dashboard" subtitle="Visão geral dos pedidos · hoje, 22 de maio">
      {/* Stat cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
      }}>
        {stats.map((s) => (
          <div key={s.label} style={{
            background: '#fff', border: `1px solid ${t.border}`, borderRadius: 12,
            padding: '14px 16px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 14, bottom: 14, width: 3,
              background: s.accent, borderRadius: '0 3px 3px 0',
            }} />
            <div style={{ ...labelStyle, fontSize: 10.5 }}>{s.label}</div>
            <div style={{
              fontSize: 30, fontWeight: 700, letterSpacing: -1,
              color: t.text, marginTop: 6, lineHeight: 1,
            }}>{s.value}</div>
            <div style={{ fontSize: 11.5, color: t.textMute, marginTop: 6 }}>{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Orders header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 24, marginBottom: 12,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>Pedidos do dia</h2>
          <div style={{ fontSize: 12, color: t.textMute, marginTop: 2 }}>18 pedidos · atualizado agora</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={btn.ghost}>Todos</button>
          <button style={{ ...btn.ghost, color: t.orangeDark, background: t.orangeTint, borderColor: t.orangeTint2 }}>Pendentes (6)</button>
          <button style={btn.ghost}>Completos</button>
        </div>
      </div>

      {/* Orders grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
      }}>
        {orders.map((o) => {
          const color = o.status === 'pendente' ? 'orange' : o.status === 'completo' ? 'green' : 'red';
          const accent = o.status === 'pendente' ? t.orange : o.status === 'completo' ? '#22C55E' : '#DC2626';
          return (
            <div key={o.id + o.hora} style={{
              background: '#fff', border: `1px solid ${t.border}`, borderRadius: 12,
              padding: '14px 16px',
              display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px',
              borderLeft: `3px solid ${accent}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, gridColumn: '1 / 3' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
                  #{o.id}
                </span>
                <Pill color={color}>{o.status}</Pill>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
                  R$ {o.preco}
                </span>
              </div>

              <div style={{ fontSize: 12.5, color: t.textSub }}>
                <span style={{ color: t.textMute }}>Cliente · </span>{o.cliente}
              </div>
              <div style={{ fontSize: 12.5, color: t.textSub, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: t.textMute }}>{o.hora}</span>
              </div>

              <div style={{ fontSize: 12.5, color: t.textSub, gridColumn: '1 / 3' }}>
                {o.itens}
              </div>

              <div style={{
                gridColumn: '1 / 3',
                marginTop: 10, paddingTop: 10,
                borderTop: `1px solid ${t.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: t.textMute, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <IconClock size={13} /> {o.tempo}
                </span>
                <span style={{
                  fontSize: 12.5, fontWeight: 600, color: t.orangeDark,
                  display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                }}>
                  Ver detalhes <IconChevronRight size={13} />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

// ============================================================
// 2. CARDÁPIO
// ============================================================
function CardapioScreen() {
  const products = [
    { name: 'Coxinha de Frango',     desc: 'Massa de batata recheada com frango desfiado temperado e frito.', price: '8,00',  hue: 30 },
    { name: 'Esfiha de Carne',       desc: 'Massa assada com recheio de carne moída temperada, cebola e tomate.', price: '6,00',  hue: 40 },
    { name: 'Kibe Frito',            desc: 'Bolinho de carne moída com trigo e hortelã, frito e crocante.', price: '7,00',  hue: 50 },
    { name: 'Pastel de Queijo',      desc: 'Massa fina e crocante recheada com queijo derretido.', price: '5,00',  hue: 60 },
    { name: 'Empada de Palmito',     desc: 'Massa amanteigada com recheio cremoso de palmito.', price: '9,00',  hue: 70 },
    { name: 'Enroladinho de Salsicha', desc: 'Massa assada recheada com salsicha.', price: '4,50',  hue: 25 },
    { name: 'Risole de Camarão',     desc: 'Massa empanada recheada com camarão e catupiry.', price: '9,50',  hue: 15 },
    { name: 'Bolinha de Queijo',     desc: 'Bolinhas crocantes recheadas com muçarela.', price: '6,50',  hue: 45 },
  ];

  const right = (
    <>
      <div style={{
        display: 'flex', background: '#F5F5F4', borderRadius: 8, padding: 3,
        border: `1px solid ${t.border}`,
      }}>
        <button style={{
          background: '#fff', color: t.text, border: 'none',
          padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          display: 'flex', alignItems: 'center',
        }}><IconLayoutGrid size={15} /></button>
        <button style={{
          background: 'transparent', color: t.textMute, border: 'none',
          padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
          display: 'flex', alignItems: 'center',
        }}><IconList size={15} /></button>
      </div>
    </>
  );

  return (
    <Frame active="cardapio" title="Cardápio" subtitle="Itens disponíveis para venda · 23 produtos ativos" right={right}>
      {/* Tabs + search */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 18,
      }}>
        <div style={{
          display: 'inline-flex', background: '#fff',
          border: `1px solid ${t.border}`, borderRadius: 10, padding: 3,
        }}>
          {['Fritos', 'Assados', 'Bebidas', 'Combos'].map((tab, i) => (
            <button key={tab} style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: i === 0 ? t.orange : 'transparent',
              color: i === 0 ? '#fff' : t.textSub,
              fontSize: 13, fontWeight: i === 0 ? 600 : 500, fontFamily: 'inherit',
            }}>{tab}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fff', border: `1px solid ${t.border}`, borderRadius: 8,
            padding: '7px 12px', minWidth: 220, color: t.textMute,
          }}>
            <IconSearch size={15} />
            <input placeholder="Buscar produto..." style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'inherit', fontSize: 13, color: t.text, flex: 1,
            }} />
          </div>
          <button style={btn.primary}>
            <IconPlus size={14} /> Novo item
          </button>
        </div>
      </div>

      {/* Product grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
      }}>
        {products.map((p) => (
          <div key={p.name} style={{
            background: '#fff', border: `1px solid ${t.border}`, borderRadius: 12,
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: 8, paddingBottom: 0 }}>
              <FoodPlaceholder label="foto do produto" hue={p.hue} height={140} />
            </div>
            <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, letterSpacing: -0.1 }}>
                {p.name}
              </div>
              <div style={{
                fontSize: 12, color: t.textSub, lineHeight: 1.4,
                display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
              }}>{p.desc}</div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 8, paddingTop: 10, borderTop: `1px solid ${t.border}`,
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
                  R$ {p.price}
                </div>
                <button style={btn.ghost}>
                  <IconEdit size={13} /> Editar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ============================================================
// 3. GESTÃO
// ============================================================
function GestaoScreen() {
  const categories = [
    { name: 'Fritos',    count: 12, hue: 30 },
    { name: 'Assados',   count:  8, hue: 50 },
    { name: 'Bebidas',   count:  6, hue: 200 },
    { name: 'Combos',    count:  4, hue: 350 },
  ];

  const items = [
    { name: 'Coxinha de Frango', desc: 'Massa de batata, frango desfiado e temperos da casa.',  price: '8,00', cat: 'Fritos',  hue: 30 },
    { name: 'Esfiha de Carne',   desc: 'Massa assada com carne moída, cebola e tomate.',         price: '6,00', cat: 'Assados', hue: 40 },
    { name: 'Pastel de Queijo',  desc: 'Massa crocante recheada com muçarela derretida.',        price: '5,00', cat: 'Fritos',  hue: 60 },
    { name: 'Empada de Palmito', desc: 'Massa amanteigada, recheio cremoso de palmito.',         price: '9,00', cat: 'Assados', hue: 70 },
  ];

  return (
    <Frame active="gestao" title="Gestão" subtitle="Organize categorias e itens do cardápio">
      {/* Categorias section */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Categorias</h2>
          <div style={{ fontSize: 12, color: t.textMute, marginTop: 2 }}>4 categorias · arraste para reordenar</div>
        </div>
        <button style={btn.primary}>
          <IconPlus size={14} /> Nova categoria
        </button>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28,
      }}>
        {categories.map((c) => (
          <div key={c.name} style={{
            background: '#fff', border: `1px solid ${t.border}`, borderRadius: 12,
            padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{c.name}</div>
                <div style={{ fontSize: 12, color: t.textMute, marginTop: 2 }}>{c.count} itens</div>
              </div>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `oklch(0.95 0.04 ${c.hue})`,
                color: `oklch(0.45 0.12 ${c.hue})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
              }}>{c.name[0]}</div>
            </div>
            <div style={{
              display: 'flex', gap: 6, paddingTop: 10,
              borderTop: `1px solid ${t.border}`,
            }}>
              <button style={{ ...btn.ghost, flex: 1, justifyContent: 'center' }}>
                <IconEdit size={13} /> Editar
              </button>
              <button style={{ ...btn.ghost, flex: 1, justifyContent: 'center', color: t.danger }}>
                <IconTrash size={13} /> Remover
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Itens section */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Itens do cardápio</h2>
          <div style={{ fontSize: 12, color: t.textMute, marginTop: 2 }}>30 itens cadastrados</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn.ghost}>
            <IconFilter size={13} /> Filtrar
          </button>
          <button style={btn.primary}>
            <IconPlus size={14} /> Novo item
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
      }}>
        {items.map((p) => (
          <div key={p.name} style={{
            background: '#fff', border: `1px solid ${t.border}`, borderRadius: 12,
            overflow: 'hidden',
          }}>
            <div style={{ padding: 8, paddingBottom: 0 }}>
              <FoodPlaceholder label="foto do produto" hue={p.hue} height={130} />
            </div>
            <div style={{ padding: '12px 14px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 600, color: t.textMute,
                  textTransform: 'uppercase', letterSpacing: 0.6,
                }}>{p.cat}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{p.name}</div>
              <div style={{
                fontSize: 12, color: t.textSub, lineHeight: 1.4, marginTop: 4,
                display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
                overflow: 'hidden',
              }}>{p.desc}</div>

              <div style={{
                marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6,
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
                  R$ {p.price}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={{
                    ...btn.ghost, padding: '6px 8px',
                  }}><IconEdit size={13} /></button>
                  <button style={{
                    ...btn.ghost, padding: '6px 8px', color: t.danger,
                  }}><IconTrash size={13} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ============================================================
// 4. HISTÓRICO DE VENDAS
// ============================================================
function HistoricoScreen() {
  const days = [
    {
      label: 'Sexta-feira, 22/05/2026', short: 'Hoje',
      total: '300,00', orders: 8, items: 14, open: true,
      rows: [
        { id: '12026052211064916', hora: '12:30', itens: '2x Coxinha, 1x Suco',     valor: '85,00', forma: 'Pix' },
        { id: '12026052211064917', hora: '12:45', itens: '1x Esfiha, 1x Refri',     valor: '45,00', forma: 'Cartão' },
        { id: '12026052211064918', hora: '13:02', itens: '4x Kibe, 2x Água',        valor: '78,00', forma: 'Pix' },
        { id: '12026052211064919', hora: '13:25', itens: '1x Combo Frito',          valor: '92,00', forma: 'Dinheiro' },
      ],
    },
    { label: 'Quinta-feira, 21/05/2026', short: '1 dia atrás', total: '450,00', orders: 12, items: 22 },
    { label: 'Quarta-feira, 20/05/2026', short: '2 dias atrás', total: '280,00', orders:  7, items: 13 },
    { label: 'Terça-feira, 19/05/2026',  short: '3 dias atrás', total: '510,00', orders: 14, items: 26 },
  ];

  const right = (
    <button style={btn.ghost}>
      <IconFilter size={13} /> Período
    </button>
  );

  return (
    <Frame active="historico" title="Histórico de vendas" subtitle="Acompanhe as vendas dia a dia" right={right}>
      {/* Summary strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20,
      }}>
        {[
          { l: 'Total na semana', v: 'R$ 2.184', s: '+8% vs semana anterior' },
          { l: 'Pedidos',          v: '54',      s: 'média 7,7 / dia' },
          { l: 'Ticket médio',     v: 'R$ 40,44',s: '+R$ 2,10 vs anterior' },
          { l: 'Item mais vendido',v: 'Coxinha', s: '38 unidades' },
        ].map((s) => (
          <div key={s.l} style={{
            background: '#fff', border: `1px solid ${t.border}`, borderRadius: 12,
            padding: '12px 14px',
          }}>
            <div style={labelStyle}>{s.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginTop: 4, letterSpacing: -0.3 }}>{s.v}</div>
            <div style={{ fontSize: 11.5, color: t.textMute, marginTop: 2 }}>{s.s}</div>
          </div>
        ))}
      </div>

      {/* Day list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {days.map((d) => (
          <div key={d.label} style={{
            background: '#fff', border: `1px solid ${t.border}`, borderRadius: 12,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px',
              cursor: 'pointer',
              background: d.open ? '#FFFBF5' : '#fff',
              borderBottom: d.open ? `1px solid ${t.border}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: d.open ? t.orangeTint : '#F5F5F4',
                  color: d.open ? t.orangeDark : t.textSub,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {d.open ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{d.label}</div>
                  <div style={{ fontSize: 12, color: t.textMute, marginTop: 2 }}>
                    {d.short} · {d.orders} pedidos · {d.items} itens vendidos
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.text, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3 }}>
                  R$ {d.total}
                </div>
                <div style={{ fontSize: 11.5, color: t.textMute }}>faturamento</div>
              </div>
            </div>

            {d.open && (
              <table style={{
                width: '100%', borderCollapse: 'collapse', fontSize: 13,
                fontFamily: 'inherit',
              }}>
                <thead>
                  <tr style={{ background: '#FAFAF9' }}>
                    {['Pedido', 'Hora', 'Itens', 'Pagamento', 'Valor'].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i === 4 ? 'right' : 'left',
                        padding: '10px 18px',
                        fontSize: 10.5, fontWeight: 600, letterSpacing: 1,
                        color: t.textMute, textTransform: 'uppercase',
                        borderBottom: `1px solid ${t.border}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((r, i) => (
                    <tr key={r.id} style={{
                      borderBottom: i < d.rows.length - 1 ? `1px solid ${t.border}` : 'none',
                    }}>
                      <td style={{ padding: '12px 18px', fontVariantNumeric: 'tabular-nums', color: t.textSub, fontSize: 12 }}>
                        #{r.id}
                      </td>
                      <td style={{ padding: '12px 18px', color: t.textSub, fontVariantNumeric: 'tabular-nums' }}>
                        {r.hora}
                      </td>
                      <td style={{ padding: '12px 18px', color: t.text }}>
                        {r.itens}
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <Pill color="stone">{r.forma}</Pill>
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
                        R$ {r.valor}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#FAFAF9' }}>
                    <td colSpan={4} style={{ padding: '12px 18px', fontWeight: 600, color: t.textSub }}>
                      Total do dia
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: t.orangeDark, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                      R$ {d.total}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ============================================================
// 5. PERDAS
// ============================================================
function PerdasScreen() {
  const losses = [
    { produto: 'Tomate',         qtd: '5 kg',    motivo: 'Validade vencida — descarte necessário.', valor: '25,00', data: '22/05', tag: 'Vencimento' },
    { produto: 'Frango',         qtd: '2 un',    motivo: 'Quebra no manuseio durante o preparo.',     valor: '18,00', data: '22/05', tag: 'Manuseio' },
    { produto: 'Queijo Mussarela', qtd: '1 kg',  motivo: 'Deterioração por falha na temperatura.',    valor: '45,00', data: '21/05', tag: 'Armazenamento' },
    { produto: 'Alface',         qtd: '3 maços', motivo: 'Murcho, impróprio para consumo.',           valor: '9,00',  data: '21/05', tag: 'Vencimento' },
    { produto: 'Massa de Pastel', qtd: '2 pcts', motivo: 'Caída no chão durante reposição.',           valor: '14,00', data: '20/05', tag: 'Manuseio' },
  ];

  const tagColor = { Vencimento: 'orange', Manuseio: 'stone', Armazenamento: 'red' };

  return (
    <Frame active="perdas" title="Perdas" subtitle="Registre e acompanhe perdas do estoque">
      {/* Summary */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 22,
      }}>
        {[
          { l: 'Perdas no mês',       v: 'R$ 412,00', s: '23 registros' },
          { l: 'Categoria mais comum', v: 'Vencimento', s: '48% das ocorrências' },
          { l: 'Comparado a abril',    v: '−12%',       s: 'redução de R$ 56,00', good: true },
        ].map((s) => (
          <div key={s.l} style={{
            background: '#fff', border: `1px solid ${t.border}`, borderRadius: 12,
            padding: '12px 14px',
          }}>
            <div style={labelStyle}>{s.l}</div>
            <div style={{
              fontSize: 20, fontWeight: 700, color: s.good ? t.success : t.text,
              marginTop: 4, letterSpacing: -0.3,
            }}>{s.v}</div>
            <div style={{ fontSize: 11.5, color: t.textMute, marginTop: 2 }}>{s.s}</div>
          </div>
        ))}
      </div>

      {/* Register form */}
      <div style={{
        background: '#fff', border: `1px solid ${t.border}`, borderRadius: 12,
        padding: 20, marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Registrar nova perda</h2>
            <div style={{ fontSize: 12, color: t.textMute, marginTop: 2 }}>Os dados são adicionados ao histórico abaixo</div>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: t.orangeTint, color: t.orangeDark,
            padding: '4px 10px', borderRadius: 999,
            fontSize: 11.5, fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.orange }} />
            Operador: João Silva
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 16,
        }}>
          <Field label="Produto">
            <Select value="Tomate" />
          </Field>
          <Field label="Quantidade">
            <div style={{ display: 'flex', gap: 6 }}>
              <Input value="5" style={{ flex: 1 }} />
              <Select value="kg" style={{ width: 80 }} />
            </div>
          </Field>
          <Field label="Motivo da perda">
            <Textarea placeholder="Ex: validade vencida, queda no manuseio…" />
          </Field>

          <Field label="Categoria">
            <Select value="Vencimento" />
          </Field>
          <Field label="Valor estimado">
            <Input value="R$ 25,00" />
          </Field>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 8 }}>
            <button style={btn.ghost}>Cancelar</button>
            <button style={btn.primary}>
              <IconPlus size={14} /> Registrar perda
            </button>
          </div>
        </div>
      </div>

      {/* History table */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Histórico de perdas</h2>
          <div style={{ fontSize: 12, color: t.textMute, marginTop: 2 }}>{losses.length} registros · últimos 7 dias</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fff', border: `1px solid ${t.border}`, borderRadius: 8,
            padding: '7px 12px', minWidth: 200, color: t.textMute,
          }}>
            <IconSearch size={15} />
            <input placeholder="Pesquisar..." style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'inherit', fontSize: 13, color: t.text, flex: 1,
            }} />
          </div>
          <button style={btn.ghost}>
            <IconFilter size={13} /> Filtros
          </button>
        </div>
      </div>

      <div style={{
        background: '#fff', border: `1px solid ${t.border}`, borderRadius: 12,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#FAFAF9' }}>
              {['Produto', 'Quantidade', 'Categoria', 'Motivo', 'Data', 'Valor'].map((h, i) => (
                <th key={h} style={{
                  textAlign: i === 5 ? 'right' : 'left',
                  padding: '11px 18px',
                  fontSize: 10.5, fontWeight: 600, letterSpacing: 1,
                  color: t.textMute, textTransform: 'uppercase',
                  borderBottom: `1px solid ${t.border}`,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {losses.map((r, i) => (
              <tr key={i} style={{
                borderBottom: i < losses.length - 1 ? `1px solid ${t.border}` : 'none',
              }}>
                <td style={{ padding: '14px 18px', fontWeight: 600, color: t.text }}>{r.produto}</td>
                <td style={{ padding: '14px 18px', color: t.textSub, fontVariantNumeric: 'tabular-nums' }}>{r.qtd}</td>
                <td style={{ padding: '14px 18px' }}>
                  <Pill color={tagColor[r.tag]}>{r.tag}</Pill>
                </td>
                <td style={{ padding: '14px 18px', color: t.textSub }}>{r.motivo}</td>
                <td style={{ padding: '14px 18px', color: t.textMute, fontVariantNumeric: 'tabular-nums' }}>{r.data}</td>
                <td style={{
                  padding: '14px 18px', textAlign: 'right',
                  fontWeight: 700, color: t.danger, fontVariantNumeric: 'tabular-nums',
                }}>R$ {r.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

// Form primitives
function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>{label}</span>
      {children}
    </label>
  );
}
function Input({ value, placeholder, style = {} }) {
  return (
    <input defaultValue={value} placeholder={placeholder} style={{
      border: `1px solid ${t.border}`, borderRadius: 8,
      padding: '9px 12px', fontSize: 13, fontFamily: 'inherit',
      color: t.text, outline: 'none', background: '#fff',
      ...style,
    }} />
  );
}
function Select({ value, style = {} }) {
  return (
    <div style={{
      border: `1px solid ${t.border}`, borderRadius: 8,
      padding: '9px 36px 9px 12px', fontSize: 13,
      color: t.text, background: '#fff', position: 'relative', cursor: 'pointer',
      ...style,
    }}>
      {value}
      <IconChevronDown size={15} style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        color: t.textMute,
      }} />
    </div>
  );
}
function Textarea({ placeholder }) {
  return (
    <textarea placeholder={placeholder} rows={3} style={{
      border: `1px solid ${t.border}`, borderRadius: 8,
      padding: '9px 12px', fontSize: 13, fontFamily: 'inherit',
      color: t.text, outline: 'none', resize: 'none', background: '#fff',
    }} />
  );
}

Object.assign(window, {
  DashboardScreen, CardapioScreen, GestaoScreen, HistoricoScreen, PerdasScreen,
});
