import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Usuarios from './Usuarios'
import PassagensDiarias from './PassagensDiarias'
import TDRs from './TDRs'
import Aquisicoes from './Aquisicoes'
import Financeiro from './Financeiro'
import Relatorios from './Relatorios'

// ── Painel de Execução (tela inicial) ────────────────────────────────────────
function PainelExecucao({ setModuloAtivo }) {
  const [diarias,    setDiarias]    = useState([])
  const [aquisicoes, setAquisicoes] = useState([])
  const [tdrs,       setTdrs]       = useState([])
  const [orcamento,  setOrcamento]  = useState(0)
  const [editandoOrc, setEditandoOrc] = useState(false)
  const [novoOrc,    setNovoOrc]    = useState('')
  const [carregando, setCarregando] = useState(true)

  const carregar = async () => {
    setCarregando(true)
    const [{ data: d }, { data: a }, { data: t }, { data: c }] = await Promise.all([
      supabase.from('passagens_diarias').select('id,status,urgente,updated_at,created_at').neq('status','rascunho').neq('status','cancelado'),
      supabase.from('aquisicoes').select('id,status,urgente,updated_at,created_at,itens').neq('status','cancelado'),
      supabase.from('tdrs').select('id,status,urgente,updated_at,created_at,valor_brl,numero,objeto').neq('status','cancelado'),
      supabase.from('configuracoes').select('orcamento_total').eq('id','global').single(),
    ])
    setDiarias(d || [])
    setAquisicoes(a || [])
    setTdrs(t || [])
    setOrcamento(Number(c?.orcamento_total || 0))
    setNovoOrc(String(c?.orcamento_total || 0))
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  const salvarOrcamento = async () => {
    const valor = Number(novoOrc.replace(',', '.')) || 0
    await supabase.from('configuracoes').upsert({ id: 'global', orcamento_total: valor, updated_at: new Date().toISOString() })
    setOrcamento(valor)
    setEditandoOrc(false)
  }

  // cálculos
  const sete = 7 * 24 * 60 * 60 * 1000
  const agora = Date.now()
  const STATUS_ATIVOS_AQ = ['rascunho','enviado']
  const STATUS_ATIVOS_TDR = ['rascunho','revisao_interna','ajustes','enviado_unesco','retorno_unesco']
  const STATUS_ATIVOS_PD = ['enviado','aguardando_prestacao']

  const totalExecutado =
    aquisicoes.filter(a => a.status === 'aprovado').reduce((s,a) => s + (a.itens||[]).reduce((si,it) => si + Number(it.valor||0), 0), 0) +
    tdrs.filter(t => t.status === 'aprovado').reduce((s,t) => s + Number(t.valor_brl||0), 0)

  const emAndamento = [
    ...diarias.filter(d => STATUS_ATIVOS_PD.includes(d.status)).map(d => ({ ...d, modulo: 'Diárias' })),
    ...aquisicoes.filter(a => STATUS_ATIVOS_AQ.includes(a.status)).map(a => ({ ...a, modulo: 'Aquisições' })),
    ...tdrs.filter(t => STATUS_ATIVOS_TDR.includes(t.status)).map(t => ({ ...t, modulo: 'TDRs' })),
  ]

  const parados = emAndamento.filter(i => agora - new Date(i.updated_at).getTime() > sete)

  const urgentes = [
    ...diarias.filter(d => d.urgente).map(d => ({ ...d, modulo: 'Diárias' })),
    ...aquisicoes.filter(a => a.urgente).map(a => ({ ...a, modulo: 'Aquisições' })),
    ...tdrs.filter(t => t.urgente).map(t => ({ ...t, modulo: 'TDRs' })),
  ]

  const saldoDisponivel = orcamento - totalExecutado
  const pctExecutado = orcamento > 0 ? Math.min((totalExecutado / orcamento) * 100, 100) : 0

  const fmtMoeda = v => Number(v||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const fmtDias = iso => {
    const diff = agora - new Date(iso).getTime()
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24))
    return dias === 0 ? 'hoje' : `${dias}d atrás`
  }
  const MODULO_NAV = { 'Diárias': 'passagens', 'Aquisições': 'aquisicoes', 'TDRs': 'tdrs' }
  const MODULO_COR = { 'Diárias': '#2d7a4f', 'Aquisições': '#b45309', 'TDRs': '#1d4ed8' }

  if (carregando) return <p style={{ textAlign:'center', padding:'60px', color:'#6b7280' }}>Carregando...</p>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>

      {/* ── Orçamento + barra de execução ── */}
      <div style={ep.orcCard}>
        <div style={{ flex: 1 }}>
          <p style={ep.orcLabel}>💰 Orçamento Total Disponível</p>
          {editandoOrc ? (
            <div style={{ display:'flex', gap:'8px', alignItems:'center', marginTop:'6px' }}>
              <span style={{ fontSize:'20px', color:'#1a4731', fontWeight:'700' }}>R$</span>
              <input
                style={ep.orcInput}
                value={novoOrc}
                onChange={e => setNovoOrc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && salvarOrcamento()}
                autoFocus
                placeholder="0,00"
              />
              <button onClick={salvarOrcamento} style={ep.btnSalvarOrc}>Salvar</button>
              <button onClick={() => setEditandoOrc(false)} style={ep.btnCancelarOrc}>Cancelar</button>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'baseline', gap:'12px', marginTop:'4px' }}>
              <span style={ep.orcValor}>R$ {fmtMoeda(orcamento)}</span>
              <button onClick={() => setEditandoOrc(true)} style={ep.btnEditarOrc}>✏️ Editar</button>
            </div>
          )}
        </div>
        <div style={{ flex: 2 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
            <span style={{ fontSize:'12px', color:'#6b7280' }}>Executado: <strong style={{ color:'#1a4731' }}>R$ {fmtMoeda(totalExecutado)}</strong></span>
            <span style={{ fontSize:'12px', color:'#6b7280' }}>Saldo: <strong style={{ color: saldoDisponivel >= 0 ? '#1a4731' : '#dc2626' }}>R$ {fmtMoeda(saldoDisponivel)}</strong></span>
          </div>
          <div style={ep.barraFundo}>
            <div style={{ ...ep.barraPreenchida, width: `${pctExecutado}%`, background: pctExecutado > 90 ? '#dc2626' : pctExecutado > 70 ? '#d97706' : '#2d7a4f' }} />
          </div>
          <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'4px', textAlign:'right' }}>{pctExecutado.toFixed(1)}% executado</p>
        </div>
      </div>

      {/* ── Cards de situação ── */}
      <div style={ep.cardsGrid}>
        <SitCard
          icone="🔄" titulo="Em Andamento" valor={emAndamento.length}
          sub="aguardando ação" cor="#1d4ed8"
          onClick={() => setModuloAtivo('passagens')}
        />
        <SitCard
          icone="⚠️" titulo="Precisam de Verificação" valor={parados.length}
          sub="sem movimentação há 7+ dias" cor="#d97706"
          onClick={() => {}}
        />
        <SitCard
          icone="🚨" titulo="Urgentes" valor={urgentes.length}
          sub="marcados como urgentes" cor="#dc2626"
          onClick={() => {}}
        />
        <SitCard
          icone="✅" titulo="Executado" valor={`R$ ${fmtMoeda(totalExecutado)}`}
          sub="aprovados + concluídos" cor="#166534"
          onClick={() => setModuloAtivo('financeiro')}
        />
      </div>

      {/* ── Urgentes ── */}
      {urgentes.length > 0 && (
        <div style={ep.secao}>
          <h3 style={ep.secaoTitulo}>🚨 Urgentes ({urgentes.length})</h3>
          <div style={ep.itensLista}>
            {urgentes.map(item => (
              <div key={`${item.modulo}-${item.id}`} style={{ ...ep.itemCard, borderLeft: '4px solid #dc2626', background: '#fff5f5' }}>
                <span style={{ ...ep.moduloBadge, background: MODULO_COR[item.modulo] + '20', color: MODULO_COR[item.modulo] }}>{item.modulo}</span>
                <span style={ep.itemTexto}>{item.objeto || item.numero_demanda || item.numero || 'Sem descrição'}</span>
                <span style={ep.itemData}>{fmtDias(item.updated_at)}</span>
                <button onClick={() => setModuloAtivo(MODULO_NAV[item.modulo])} style={ep.btnVer}>Ver →</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Parados / precisando de verificação ── */}
      {parados.length > 0 && (
        <div style={ep.secao}>
          <h3 style={ep.secaoTitulo}>⚠️ Precisam de Verificação ({parados.length})</h3>
          <div style={ep.itensLista}>
            {parados.map(item => (
              <div key={`${item.modulo}-${item.id}`} style={{ ...ep.itemCard, borderLeft: '4px solid #d97706', background: '#fffbeb' }}>
                <span style={{ ...ep.moduloBadge, background: MODULO_COR[item.modulo] + '20', color: MODULO_COR[item.modulo] }}>{item.modulo}</span>
                <span style={ep.itemTexto}>{item.objeto || item.numero_demanda || item.numero || 'Sem descrição'}</span>
                <span style={{ ...ep.itemData, color: '#d97706', fontWeight: '600' }}>Parado há {fmtDias(item.updated_at)}</span>
                <button onClick={() => setModuloAtivo(MODULO_NAV[item.modulo])} style={ep.btnVer}>Ver →</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Atalhos de módulos ── */}
      {urgentes.length === 0 && parados.length === 0 && (
        <div style={ep.secao}>
          <p style={{ color:'#6b7280', fontSize:'15px', margin:'0 0 16px 0' }}>Selecione um módulo no menu lateral para começar.</p>
        </div>
      )}
    </div>
  )
}

function SitCard({ icone, titulo, valor, sub, cor, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'#fff', borderRadius:'12px', padding:'20px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', borderTop:`4px solid ${cor}`, cursor: onClick ? 'pointer' : 'default', transition:'transform 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
        <span style={{ fontSize:'11px', fontWeight:'700', color:cor, letterSpacing:'0.5px' }}>{titulo.toUpperCase()}</span>
        <span style={{ fontSize:'22px' }}>{icone}</span>
      </div>
      <p style={{ fontSize:'26px', fontWeight:'700', color:'#111827', margin:'0 0 4px 0', lineHeight:1.2 }}>{valor}</p>
      <p style={{ fontSize:'12px', color:'#9ca3af', margin:0 }}>{sub}</p>
    </div>
  )
}

const ep = {
  orcCard: { background:'#fff', borderRadius:'12px', padding:'24px 28px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', display:'flex', gap:'40px', alignItems:'flex-start', flexWrap:'wrap' },
  orcLabel: { fontSize:'12px', fontWeight:'700', color:'#6b7280', letterSpacing:'0.5px', margin:0, textTransform:'uppercase' },
  orcValor: { fontSize:'28px', fontWeight:'700', color:'#1a4731' },
  orcInput: { fontSize:'22px', fontWeight:'700', color:'#1a4731', border:'2px solid #2d7a4f', borderRadius:'8px', padding:'4px 10px', outline:'none', width:'200px', fontFamily:'inherit' },
  btnSalvarOrc: { padding:'6px 16px', borderRadius:'8px', border:'none', background:'#1a4731', color:'white', cursor:'pointer', fontSize:'13px', fontWeight:'600' },
  btnCancelarOrc: { padding:'6px 12px', borderRadius:'8px', border:'1px solid #d1d5db', background:'white', cursor:'pointer', fontSize:'13px', color:'#6b7280' },
  btnEditarOrc: { fontSize:'12px', color:'#6b7280', background:'none', border:'none', cursor:'pointer', padding:'4px 8px', borderRadius:'6px', textDecoration:'underline' },
  barraFundo: { height:'12px', background:'#f3f4f6', borderRadius:'6px', overflow:'hidden' },
  barraPreenchida: { height:'12px', borderRadius:'6px', transition:'width 0.5s ease' },
  cardsGrid: { display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'16px' },
  secao: { background:'#fff', borderRadius:'12px', padding:'20px 24px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' },
  secaoTitulo: { fontSize:'15px', fontWeight:'700', color:'#111827', margin:'0 0 14px 0' },
  itensLista: { display:'flex', flexDirection:'column', gap:'8px' },
  itemCard: { display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', borderRadius:'8px', border:'1px solid #e5e7eb' },
  moduloBadge: { fontSize:'11px', fontWeight:'700', padding:'2px 10px', borderRadius:'20px', whiteSpace:'nowrap', flexShrink:0 },
  itemTexto: { flex:1, fontSize:'13px', color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  itemData: { fontSize:'11px', color:'#9ca3af', whiteSpace:'nowrap' },
  btnVer: { padding:'4px 12px', borderRadius:'6px', border:'1px solid #d1d5db', background:'white', cursor:'pointer', fontSize:'12px', fontWeight:'600', whiteSpace:'nowrap' },
}

const modulos = [
  { id: 'passagens',  nome: 'Passagens e Diárias', icone: '✈️', descricao: 'Solicitações de passagens aéreas e diárias', cor: '#2d7a4f' },
  { id: 'tdrs',       nome: 'TDRs',                icone: '📄', descricao: 'Termos de Referência',                        cor: '#1d4ed8' },
  { id: 'aquisicoes', nome: 'Aquisições',           icone: '🛒', descricao: 'Processos de aquisição',                      cor: '#b45309' },
  { id: 'financeiro', nome: 'Financeiro',           icone: '💰', descricao: 'Orçamento e execução financeira',             cor: '#7c3aed' },
  { id: 'relatorios', nome: 'Relatórios',           icone: '📊', descricao: 'Exportar e imprimir relatórios',              cor: '#0f766e' },
]

export default function Dashboard({ usuario, perfilUsuario }) {
  const [moduloAtivo, setModuloAtivo] = useState(null)
  const [menuAberto, setMenuAberto] = useState(true)
  const [pendentes, setPendentes] = useState(0)
  const isAdmin = perfilUsuario?.perfil === 'administrador'

  useEffect(() => {
    if (!isAdmin) return
    const buscar = async () => {
      const { count } = await supabase
        .from('notificacoes')
        .select('id', { count: 'exact', head: true })
        .eq('lida', false)
      setPendentes(count || 0)
    }
    buscar()
    const canal = supabase.channel('notif-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacoes' }, buscar)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [isAdmin])

  const handleSair = async () => {
    await supabase.auth.signOut()
  }

  const nomeExibicao = perfilUsuario?.nome_completo || usuario?.email

  return (
    <div style={styles.container}>
      {/* Menu lateral */}
      <aside style={{ ...styles.sidebar, width: menuAberto ? '260px' : '60px' }}>
        <div style={styles.sidebarHeader}>
          {menuAberto && (
            <div>
              <h2 style={styles.sidebarTitulo}>Sistema de Gestão</h2>
              <p style={styles.sidebarSubtitulo}>FGV · SEMA · ICMBIO</p>
            </div>
          )}
          <button onClick={() => setMenuAberto(!menuAberto)} style={styles.botaoMenu}>
            {menuAberto ? '◀' : '▶'}
          </button>
        </div>

        <nav style={styles.nav}>
          {/* Painel */}
          <button
            onClick={() => setModuloAtivo(null)}
            style={{
              ...styles.navItem,
              background: moduloAtivo === null ? '#2d7a4f' : 'transparent',
              color: moduloAtivo === null ? '#fff' : '#d1fae5',
            }}>
            <span style={styles.navIcone}>🏠</span>
            {menuAberto && <span>Painel</span>}
          </button>

          {/* Módulos principais */}
          {modulos.map(m => (
            <button key={m.id} onClick={() => setModuloAtivo(m.id)}
              style={{
                ...styles.navItem,
                background: moduloAtivo === m.id ? m.cor : 'transparent',
                color: moduloAtivo === m.id ? '#fff' : '#d1fae5',
              }}>
              <span style={styles.navIcone}>{m.icone}</span>
              {menuAberto && <span style={{ flex: 1 }}>{m.nome}</span>}
              {menuAberto && m.id === 'passagens' && isAdmin && pendentes > 0 && (
                <span style={styles.navBadge}>{pendentes}</span>
              )}
            </button>
          ))}

          {/* Separador */}
          {isAdmin && menuAberto && (
            <p style={styles.separador}>ADMINISTRAÇÃO</p>
          )}

          {/* Usuários — somente admin */}
          {isAdmin && (
            <button onClick={() => setModuloAtivo('usuarios')}
              style={{
                ...styles.navItem,
                background: moduloAtivo === 'usuarios' ? '#374151' : 'transparent',
                color: moduloAtivo === 'usuarios' ? '#fff' : '#d1fae5',
              }}>
              <span style={styles.navIcone}>👥</span>
              {menuAberto && <span>Usuários</span>}
            </button>
          )}
        </nav>

        {/* Perfil + sair */}
        <div style={styles.rodapeSidebar}>
          {menuAberto && (
            <div style={styles.perfilInfo}>
              <div style={styles.perfilAvatar}>
                {nomeExibicao?.charAt(0)?.toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <p style={styles.perfilNome}>{nomeExibicao}</p>
                <p style={styles.perfilRole}>
                  {perfilUsuario?.perfil === 'administrador' ? 'Administrador' :
                   perfilUsuario?.perfil === 'ponto_focal_sema' ? 'Focal SEMA' :
                   perfilUsuario?.perfil === 'ponto_focal_icmbio' ? 'Focal ICMBIO' :
                   'Focal Técnico'}
                </p>
              </div>
            </div>
          )}
          <button onClick={handleSair} style={styles.botaoSair}>
            <span>🚪</span>
            {menuAberto && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main style={{ ...styles.main, marginLeft: menuAberto ? '260px' : '60px' }}>
        {/* Cabeçalho */}
        <header style={styles.header}>
          <div>
            <h1 style={styles.headerTitulo}>
              {moduloAtivo === null ? 'Painel Geral' :
               moduloAtivo === 'usuarios' ? 'Usuários' :
               modulos.find(m => m.id === moduloAtivo)?.nome}
            </h1>
            <p style={styles.headerSubtitulo}>Bem-vinda, {nomeExibicao}</p>
          </div>
          <div style={styles.badges}>
            <span style={{ ...styles.badge, background: '#dcfce7', color: '#166534' }}>SEMA</span>
            <span style={{ ...styles.badge, background: '#dbeafe', color: '#1e40af' }}>ICMBIO</span>
          </div>
        </header>

        {/* Conteúdo por módulo */}
        <div style={styles.conteudo}>
          {moduloAtivo === null && (
            <PainelExecucao setModuloAtivo={setModuloAtivo} />
          )}

          {moduloAtivo === 'usuarios' && isAdmin && <Usuarios />}
          {moduloAtivo === 'passagens' && <PassagensDiarias perfilUsuario={perfilUsuario} />}
          {moduloAtivo === 'tdrs' && <TDRs perfilUsuario={perfilUsuario} />}
          {moduloAtivo === 'aquisicoes' && <Aquisicoes perfilUsuario={perfilUsuario} />}
          {moduloAtivo === 'financeiro'  && <Financeiro  perfilUsuario={perfilUsuario} />}
          {moduloAtivo === 'relatorios' && <Relatorios  perfilUsuario={perfilUsuario} />}

          {modulos.filter(m => !['passagens','tdrs','aquisicoes','financeiro','relatorios'].includes(m.id)).map(m => moduloAtivo === m.id && (
            <div key={m.id} style={styles.moduloArea}>
              <div style={styles.moduloPlaceholder}>
                <span style={styles.moduloIconeGrande}>{m.icone}</span>
                <h2 style={styles.moduloTitulo}>{m.nome}</h2>
                <p style={styles.moduloMensagem}>Este módulo será construído na próxima etapa.</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

const styles = {
  container: { display: 'flex', minHeight: '100vh', background: '#f3f4f6', fontFamily: "'Segoe UI', sans-serif" },
  sidebar: {
    background: 'linear-gradient(180deg, #1a4731 0%, #2d7a4f 100%)',
    display: 'flex', flexDirection: 'column', transition: 'width 0.3s',
    overflow: 'hidden', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100,
  },
  sidebarHeader: {
    padding: '24px 16px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  sidebarTitulo: { color: '#ffffff', fontSize: '16px', fontWeight: '700', margin: '0 0 4px 0' },
  sidebarSubtitulo: { color: '#86efac', fontSize: '12px', margin: 0 },
  botaoMenu: {
    background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
    borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px',
  },
  nav: { flex: 1, padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
    borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px',
    fontWeight: '500', textAlign: 'left', transition: 'background 0.2s', whiteSpace: 'nowrap',
  },
  navIcone: { fontSize: '18px', minWidth: '20px' },
  navBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '20px', height: '20px', borderRadius: '10px', background: '#dc2626', color: 'white', fontSize: '11px', fontWeight: '700', padding: '0 5px' },
  separador: {
    fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.4)',
    letterSpacing: '1px', padding: '12px 16px 4px', margin: 0,
  },
  rodapeSidebar: {
    borderTop: '1px solid rgba(255,255,255,0.1)',
    padding: '12px 8px',
  },
  perfilInfo: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px', marginBottom: '4px',
  },
  perfilAvatar: {
    width: '32px', height: '32px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontWeight: '700', flexShrink: 0,
  },
  perfilNome: {
    color: '#fff', fontSize: '13px', fontWeight: '600',
    margin: '0 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  perfilRole: { color: '#86efac', fontSize: '11px', margin: 0 },
  botaoSair: {
    display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
    padding: '10px 16px', background: 'rgba(255,255,255,0.05)', border: 'none',
    borderRadius: '8px', color: '#fca5a5', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap',
  },
  main: { flex: 1, padding: '32px', transition: 'margin-left 0.3s' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '32px', background: '#fff', padding: '24px 28px',
    borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  headerTitulo: { fontSize: '24px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' },
  headerSubtitulo: { fontSize: '14px', color: '#6b7280', margin: 0 },
  badges: { display: 'flex', gap: '8px' },
  badge: { padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' },
  conteudo: {},
  boasVindas: { color: '#6b7280', marginBottom: '24px', fontSize: '15px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' },
  card: {
    background: '#ffffff', borderRadius: '12px', padding: '28px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  cardIcone: { fontSize: '32px', marginBottom: '12px' },
  cardTitulo: { fontSize: '18px', fontWeight: '700', margin: '0 0 8px 0' },
  cardDescricao: { fontSize: '14px', color: '#6b7280', margin: '0 0 16px 0', lineHeight: '1.5' },
  cardBotao: { fontSize: '14px', fontWeight: '600' },
  moduloArea: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
  moduloPlaceholder: {
    textAlign: 'center', background: '#fff', padding: '60px',
    borderRadius: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  moduloIconeGrande: { fontSize: '64px', display: 'block', marginBottom: '16px' },
  moduloTitulo: { fontSize: '24px', fontWeight: '700', color: '#111827', margin: '0 0 12px 0' },
  moduloMensagem: { color: '#6b7280', fontSize: '15px' },
}
