import { useState } from 'react'
import { supabase } from '../lib/supabase'

const modulos = [
  {
    id: 'diarias',
    nome: 'Diárias',
    icone: '✈️',
    descricao: 'Solicitações e controle de diárias',
    cor: '#2d7a4f',
  },
  {
    id: 'tdrs',
    nome: 'TDRs',
    icone: '📄',
    descricao: 'Termos de Referência',
    cor: '#1d4ed8',
  },
  {
    id: 'aquisicoes',
    nome: 'Aquisições',
    icone: '🛒',
    descricao: 'Processos de aquisição',
    cor: '#b45309',
  },
  {
    id: 'financeiro',
    nome: 'Financeiro',
    icone: '💰',
    descricao: 'Orçamento e execução financeira',
    cor: '#7c3aed',
  },
]

export default function Dashboard({ usuario }) {
  const [moduloAtivo, setModuloAtivo] = useState(null)
  const [menuAberto, setMenuAberto] = useState(true)

  const handleSair = async () => {
    await supabase.auth.signOut()
  }

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
          <button
            onClick={() => setMenuAberto(!menuAberto)}
            style={styles.botaoMenu}
          >
            {menuAberto ? '◀' : '▶'}
          </button>
        </div>

        <nav style={styles.nav}>
          {modulos.map((modulo) => (
            <button
              key={modulo.id}
              onClick={() => setModuloAtivo(modulo.id)}
              style={{
                ...styles.navItem,
                background:
                  moduloAtivo === modulo.id ? modulo.cor : 'transparent',
                color: moduloAtivo === modulo.id ? '#fff' : '#d1fae5',
              }}
            >
              <span style={styles.navIcone}>{modulo.icone}</span>
              {menuAberto && <span>{modulo.nome}</span>}
            </button>
          ))}
        </nav>

        <button onClick={handleSair} style={styles.botaoSair}>
          <span>🚪</span>
          {menuAberto && <span>Sair</span>}
        </button>
      </aside>

      {/* Conteúdo principal */}
      <main style={styles.main}>
        {/* Cabeçalho */}
        <header style={styles.header}>
          <div>
            <h1 style={styles.headerTitulo}>
              {moduloAtivo
                ? modulos.find((m) => m.id === moduloAtivo)?.nome
                : 'Painel Geral'}
            </h1>
            <p style={styles.headerSubtitulo}>
              Bem-vinda, {usuario?.email}
            </p>
          </div>
          <div style={styles.badges}>
            <span style={{ ...styles.badge, background: '#dcfce7', color: '#166534' }}>
              SEMA
            </span>
            <span style={{ ...styles.badge, background: '#dbeafe', color: '#1e40af' }}>
              ICMBIO
            </span>
          </div>
        </header>

        {/* Conteúdo */}
        {!moduloAtivo ? (
          // Tela inicial com cards
          <div>
            <p style={styles.boasVindas}>
              Selecione um módulo no menu lateral para começar.
            </p>
            <div style={styles.grid}>
              {modulos.map((modulo) => (
                <div
                  key={modulo.id}
                  onClick={() => setModuloAtivo(modulo.id)}
                  style={{ ...styles.card, borderTop: `4px solid ${modulo.cor}` }}
                >
                  <div style={styles.cardIcone}>{modulo.icone}</div>
                  <h3 style={{ ...styles.cardTitulo, color: modulo.cor }}>
                    {modulo.nome}
                  </h3>
                  <p style={styles.cardDescricao}>{modulo.descricao}</p>
                  <span style={{ ...styles.cardBotao, color: modulo.cor }}>
                    Acessar →
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Área do módulo selecionado
          <div style={styles.moduloArea}>
            <div style={styles.moduloPlaceholder}>
              <span style={styles.moduloIconeGrande}>
                {modulos.find((m) => m.id === moduloAtivo)?.icone}
              </span>
              <h2 style={styles.moduloTitulo}>
                {modulos.find((m) => m.id === moduloAtivo)?.nome}
              </h2>
              <p style={styles.moduloMensagem}>
                Este módulo será construído na próxima etapa.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: '#f3f4f6',
    fontFamily: "'Segoe UI', sans-serif",
  },
  sidebar: {
    background: 'linear-gradient(180deg, #1a4731 0%, #2d7a4f 100%)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.3s',
    overflow: 'hidden',
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    zIndex: 100,
  },
  sidebarHeader: {
    padding: '24px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  sidebarTitulo: {
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '700',
    margin: '0 0 4px 0',
  },
  sidebarSubtitulo: {
    color: '#86efac',
    fontSize: '12px',
    margin: 0,
  },
  botaoMenu: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: '#fff',
    borderRadius: '6px',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  nav: {
    flex: 1,
    padding: '16px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    textAlign: 'left',
    transition: 'background 0.2s',
    whiteSpace: 'nowrap',
  },
  navIcone: {
    fontSize: '18px',
    minWidth: '20px',
  },
  botaoSair: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: 'rgba(255,255,255,0.05)',
    border: 'none',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: '14px',
    whiteSpace: 'nowrap',
  },
  main: {
    flex: 1,
    marginLeft: '260px',
    padding: '32px',
    transition: 'margin-left 0.3s',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    background: '#fff',
    padding: '24px 28px',
    borderRadius: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  headerTitulo: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 4px 0',
  },
  headerSubtitulo: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  badges: {
    display: 'flex',
    gap: '8px',
  },
  badge: {
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
  },
  boasVindas: {
    color: '#6b7280',
    marginBottom: '24px',
    fontSize: '15px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '20px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '28px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  cardIcone: {
    fontSize: '32px',
    marginBottom: '12px',
  },
  cardTitulo: {
    fontSize: '18px',
    fontWeight: '700',
    margin: '0 0 8px 0',
  },
  cardDescricao: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 16px 0',
    lineHeight: '1.5',
  },
  cardBotao: {
    fontSize: '14px',
    fontWeight: '600',
  },
  moduloArea: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  moduloPlaceholder: {
    textAlign: 'center',
    background: '#fff',
    padding: '60px',
    borderRadius: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  moduloIconeGrande: {
    fontSize: '64px',
    display: 'block',
    marginBottom: '16px',
  },
  moduloTitulo: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 12px 0',
  },
  moduloMensagem: {
    color: '#6b7280',
    fontSize: '15px',
  },
}
