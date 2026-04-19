import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Usuarios from './Usuarios'
import PassagensDiarias from './PassagensDiarias'
import TDRs from './TDRs'
import Aquisicoes from './Aquisicoes'

const modulos = [
  { id: 'passagens', nome: 'Passagens e Diárias', icone: '✈️', descricao: 'Solicitações de passagens aéreas e diárias', cor: '#2d7a4f' },
  { id: 'tdrs', nome: 'TDRs', icone: '📄', descricao: 'Termos de Referência', cor: '#1d4ed8' },
  { id: 'aquisicoes', nome: 'Aquisições', icone: '🛒', descricao: 'Processos de aquisição', cor: '#b45309' },
  { id: 'financeiro', nome: 'Financeiro', icone: '💰', descricao: 'Orçamento e execução financeira', cor: '#7c3aed' },
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
            <div>
              <p style={styles.boasVindas}>Selecione um módulo no menu lateral para começar.</p>
              <div style={styles.grid}>
                {modulos.map(m => (
                  <div key={m.id} onClick={() => setModuloAtivo(m.id)}
                    style={{ ...styles.card, borderTop: `4px solid ${m.cor}` }}>
                    <div style={styles.cardIcone}>{m.icone}</div>
                    <h3 style={{ ...styles.cardTitulo, color: m.cor }}>{m.nome}</h3>
                    <p style={styles.cardDescricao}>{m.descricao}</p>
                    <span style={{ ...styles.cardBotao, color: m.cor }}>Acessar →</span>
                  </div>
                ))}
                {isAdmin && (
                  <div onClick={() => setModuloAtivo('usuarios')}
                    style={{ ...styles.card, borderTop: '4px solid #374151' }}>
                    <div style={styles.cardIcone}>👥</div>
                    <h3 style={{ ...styles.cardTitulo, color: '#374151' }}>Usuários</h3>
                    <p style={styles.cardDescricao}>Gerenciar usuários e acessos</p>
                    <span style={{ ...styles.cardBotao, color: '#374151' }}>Acessar →</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {moduloAtivo === 'usuarios' && isAdmin && <Usuarios />}
          {moduloAtivo === 'passagens' && <PassagensDiarias perfilUsuario={perfilUsuario} />}
          {moduloAtivo === 'tdrs' && <TDRs perfilUsuario={perfilUsuario} />}
          {moduloAtivo === 'aquisicoes' && <Aquisicoes perfilUsuario={perfilUsuario} />}

          {modulos.filter(m => !['passagens','tdrs','aquisicoes'].includes(m.id)).map(m => moduloAtivo === m.id && (
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
