// Shared design system: tokens, icons, sidebar, top bar for D.CC redesign

const tokens = {
  orange: '#F97316',
  orangeDark: '#EA580C',
  orangeTint: '#FFF7ED',
  orangeTint2: '#FFEDD5',
  bg: '#FAFAF9',
  card: '#FFFFFF',
  border: '#E7E5E4',
  borderStrong: '#D6D3D1',
  text: '#1C1917',
  textSub: '#57534E',
  textMute: '#A8A29E',
  success: '#15803D',
  successTint: '#F0FDF4',
  danger: '#B91C1C',
  dangerTint: '#FEF2F2',
  warnTint: '#FFFBEB',
};

// Lucide-style stroke icons, all 18×18, stroke-width 1.75 for consistency
function Icon({ d, size = 18, className = '', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}>
      {d}
    </svg>
  );
}

const IconGrid = (p) => <Icon {...p} d={<>
  <rect x="3" y="3" width="7" height="7" rx="1.5" />
  <rect x="14" y="3" width="7" height="7" rx="1.5" />
  <rect x="3" y="14" width="7" height="7" rx="1.5" />
  <rect x="14" y="14" width="7" height="7" rx="1.5" />
</>} />;

const IconMenu = (p) => <Icon {...p} d={<>
  <path d="M3 7h18M3 12h18M3 17h18" />
</>} />;

const IconBook = (p) => <Icon {...p} d={<>
  <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z" />
  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
</>} />;

const IconSliders = (p) => <Icon {...p} d={<>
  <path d="M4 6h10M4 12h6M4 18h12" />
  <circle cx="18" cy="6" r="2" />
  <circle cx="14" cy="12" r="2" />
  <circle cx="16" cy="18" r="2" />
</>} />;

const IconHistory = (p) => <Icon {...p} d={<>
  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
  <path d="M3 3v5h5" />
  <path d="M12 7v5l3 2" />
</>} />;

const IconTrendDown = (p) => <Icon {...p} d={<>
  <path d="M3 7l6 6 4-4 8 8" />
  <path d="M21 17v-5h-5" />
</>} />;

const IconBell = (p) => <Icon {...p} d={<>
  <path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7Z" />
  <path d="M10 20a2 2 0 0 0 4 0" />
</>} />;

const IconSettings = (p) => <Icon {...p} d={<>
  <circle cx="12" cy="12" r="3" />
  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
</>} />;

const IconSearch = (p) => <Icon {...p} d={<>
  <circle cx="11" cy="11" r="7" />
  <path d="m20 20-3.5-3.5" />
</>} />;

const IconFilter = (p) => <Icon {...p} d={<>
  <path d="M3 5h18l-7 9v6l-4-2v-4L3 5Z" />
</>} />;

const IconPlus = (p) => <Icon {...p} d={<>
  <path d="M12 5v14M5 12h14" />
</>} />;

const IconEdit = (p) => <Icon {...p} d={<>
  <path d="M12 20h9" />
  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
</>} />;

const IconTrash = (p) => <Icon {...p} d={<>
  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
</>} />;

const IconCheck = (p) => <Icon {...p} d={<>
  <path d="m4 12 5 5L20 6" />
</>} />;

const IconX = (p) => <Icon {...p} d={<>
  <path d="M6 6l12 12M18 6 6 18" />
</>} />;

const IconClock = (p) => <Icon {...p} d={<>
  <circle cx="12" cy="12" r="9" />
  <path d="M12 7v5l3 2" />
</>} />;

const IconChevronRight = (p) => <Icon {...p} d={<>
  <path d="m9 6 6 6-6 6" />
</>} />;

const IconChevronDown = (p) => <Icon {...p} d={<>
  <path d="m6 9 6 6 6-6" />
</>} />;

const IconLayoutGrid = (p) => <Icon {...p} d={<>
  <rect x="3" y="3" width="7" height="7" rx="1" />
  <rect x="14" y="3" width="7" height="7" rx="1" />
  <rect x="3" y="14" width="7" height="7" rx="1" />
  <rect x="14" y="14" width="7" height="7" rx="1" />
</>} />;

const IconList = (p) => <Icon {...p} d={<>
  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
</>} />;

const IconMoreVert = (p) => <Icon {...p} d={<>
  <circle cx="12" cy="5" r="1.2" />
  <circle cx="12" cy="12" r="1.2" />
  <circle cx="12" cy="19" r="1.2" />
</>} />;

// D.CC logo: orange rounded square with white bite (circle)
function Logo({ size = 36 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: size, height: size, borderRadius: 10,
        background: tokens.orange,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', flexShrink: 0,
      }}>
        <div style={{
          width: size * 0.45, height: size * 0.45, borderRadius: '50%',
          background: '#fff',
          maskImage: `radial-gradient(circle at 70% 30%, transparent 32%, #000 33%)`,
          WebkitMaskImage: `radial-gradient(circle at 70% 30%, transparent 32%, #000 33%)`,
        }} />
      </div>
      <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: -0.5, color: tokens.text }}>
        D<span style={{ color: tokens.orange }}>.</span>CC
      </div>
    </div>
  );
}

function Sidebar({ active = 'dashboard' }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: IconGrid, group: 'menu' },
    { id: 'cardapio',  label: 'Cardápio',  icon: IconBook, group: 'menu' },
    { id: 'gestao',    label: 'Gestão',    icon: IconSliders, group: 'gestao' },
    { id: 'historico', label: 'Histórico de vendas', icon: IconHistory, group: 'gestao' },
    { id: 'perdas',    label: 'Perdas',    icon: IconTrendDown, group: 'gestao' },
  ];

  const renderItem = (it) => {
    const isActive = it.id === active;
    const IconC = it.icon;
    return (
      <div key={it.id} style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '9px 12px',
        borderRadius: 8,
        background: isActive ? tokens.orangeTint : 'transparent',
        color: isActive ? tokens.orangeDark : tokens.textSub,
        fontWeight: isActive ? 600 : 500,
        fontSize: 13.5,
        cursor: 'pointer',
        position: 'relative',
      }}>
        {isActive && (
          <div style={{
            position: 'absolute', left: -16, top: 8, bottom: 8, width: 3,
            background: tokens.orange, borderRadius: '0 3px 3px 0',
          }} />
        )}
        <IconC size={17} />
        <span>{it.label}</span>
      </div>
    );
  };

  return (
    <aside style={{
      width: 232, flexShrink: 0,
      background: '#fff',
      borderRight: `1px solid ${tokens.border}`,
      display: 'flex', flexDirection: 'column',
      padding: '20px 16px',
      fontFamily: 'Manrope, sans-serif',
    }}>
      <div style={{ padding: '0 4px 18px' }}>
        <Logo size={32} />
      </div>

      <div style={{
        fontSize: 10.5, fontWeight: 600, letterSpacing: 1.2,
        color: tokens.textMute, padding: '0 12px 8px', textTransform: 'uppercase',
      }}>Menu</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.filter(i => i.group === 'menu').map(renderItem)}
      </div>

      <div style={{
        fontSize: 10.5, fontWeight: 600, letterSpacing: 1.2,
        color: tokens.textMute, padding: '18px 12px 8px', textTransform: 'uppercase',
      }}>Gestão</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.filter(i => i.group === 'gestao').map(renderItem)}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 8px',
        borderTop: `1px solid ${tokens.border}`,
        marginTop: 16, paddingTop: 14,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg,#FDBA74,#F97316)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700,
        }}>JS</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: tokens.text, lineHeight: 1.2 }}>João Silva</div>
          <div style={{ fontSize: 11.5, color: tokens.textMute, lineHeight: 1.3 }}>Administrador</div>
        </div>
        <div style={{ color: tokens.textMute, cursor: 'pointer' }}>
          <IconMoreVert size={16} />
        </div>
      </div>
    </aside>
  );
}

function TopBar({ title, subtitle, right }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 28px',
      borderBottom: `1px solid ${tokens.border}`,
      background: '#fff',
      fontFamily: 'Manrope, sans-serif',
    }}>
      <div>
        <h1 style={{
          margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.3,
          color: tokens.text, lineHeight: 1.2,
        }}>{title}</h1>
        {subtitle && (
          <div style={{ fontSize: 13, color: tokens.textSub, marginTop: 4 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {right}
        <button style={iconBtn}>
          <IconBell />
          <span style={{
            position: 'absolute', top: 4, right: 5,
            background: tokens.orange, color: '#fff',
            fontSize: 9, fontWeight: 700,
            borderRadius: 10, padding: '1px 5px',
            minWidth: 14, textAlign: 'center', lineHeight: 1.3,
          }}>5</span>
        </button>
        <button style={iconBtn}><IconSettings /></button>
      </div>
    </header>
  );
}

const iconBtn = {
  position: 'relative',
  width: 36, height: 36, borderRadius: 8,
  border: `1px solid ${tokens.border}`,
  background: '#fff',
  color: tokens.textSub,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

function Frame({ active, title, subtitle, right, children, contentStyle = {} }) {
  return (
    <div style={{
      display: 'flex', width: '100%', height: '100%',
      background: tokens.bg, fontFamily: 'Manrope, sans-serif',
      color: tokens.text,
    }}>
      <Sidebar active={active} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title={title} subtitle={subtitle} right={right} />
        <div style={{
          flex: 1, overflow: 'auto', padding: '24px 28px',
          ...contentStyle,
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  tokens, Icon,
  IconGrid, IconBook, IconSliders, IconHistory, IconTrendDown,
  IconBell, IconSettings, IconSearch, IconFilter, IconPlus,
  IconEdit, IconTrash, IconCheck, IconX, IconClock,
  IconChevronRight, IconChevronDown, IconLayoutGrid, IconList, IconMoreVert,
  IconMenu,
  Logo, Sidebar, TopBar, Frame, iconBtn,
});
