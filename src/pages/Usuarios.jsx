import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ModalUsuario from '../components/ModalUsuario'
import ModalSenha from '../components/ModalSenha'
import ModalHistorico from '../components/ModalHistorico'

const PERFIL_LABEL = {
  administrador: 'Administrador',
  ponto_focal_sema: 'Ponto Focal SEMA',
  ponto_focal_icmbio: 'Ponto Focal ICMBIO',
  ponto_focal_tecnico: 'Ponto Focal Técnico',
}

const PERFIL_COR = {
  administrador: { bg: '#fef3c7', cor: '#92400e' },
  ponto_focal_sema: { bg: '#dcfce7', cor: '#166534' },
  ponto_focal_icmbio: { bg: '#dbeafe', cor: '#1e40af' },
  ponto_focal_tecnico: { bg: '#f3e8ff', cor: '#6b21a8' },
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [unidades, setUnidades] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroPerfil, setFiltroPerfil] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('ativo')

  const [modalAberto, setModalAberto] = useState(false)
  const [modalSenha, setModalSenha] = useState(false)
  const [modalHistorico, setModalHistorico] = useState(false)
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null)

  const carregar = async () => {
    setCarregando(true)
    const { data } = await supabase
      .from('perfis_usuarios')
      .select('*, unidade:unidades(nome, instituicao)')
      .order('nome_completo')
    setUsuarios(data || [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    supabase.from('unidades').select('*').then(({ data }) => setUnidades(data || []))
  }, [])

  const usuariosFiltrados = usuarios.filter(u => {
    const buscaOk = !busca || u.nome_completo.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase())
    const perfilOk = !filtroPerfil || u.perfil === filtroPerfil
    const statusOk = !filtroStatus || u.status === filtroStatus
    return buscaOk && perfilOk && statusOk
  })

  const abrirNovo = () => { setUsuarioSelecionado(null); setModalAberto(true) }
  const abrirEditar = (u) => { setUsuarioSelecionado(u); setModalAberto(true) }
  const abrirSenha = (u) => { setUsuarioSelecionado(u); setModalSenha(true) }
  const abrirHistorico = (u) => { setUsuarioSelecionado(u); setModalHistorico(true) }

  const fecharModais = () => {
    setModalAberto(false); setModalSenha(false); setModalHistorico(false)
    setUsuarioSelecionado(null)
  }

  const aoSalvar = () => { fecharModais(); carregar() }

  const toggleStatus = async (u) => {
    const novoStatus = u.status === 'ativo' ? 'inativo' : 'ativo'
    await supabase.from('perfis_usuarios').update({ status: novoStatus }).eq('id', u.id)
    carregar()
  }

  return (
    <div>
      {/* Cabeçalho da página */}
      <div style={styles.topBar}>
        <div>
          <h2 style={styles.titulo}>Usuários</h2>
          <p style={styles.subtitulo}>{usuarios.length} usuários cadastrados</p>
        </div>
        <button onClick={abrirNovo} style={styles.botaoNovo}>
          + Novo Usuário
        </button>
      </div>

      {/* Filtros */}
      <div style={styles.filtros}>
        <input
          style={styles.busca}
          placeholder="🔍  Buscar por nome ou e-mail..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <select style={styles.select} value={filtroPerfil}
          onChange={e => setFiltroPerfil(e.target.value)}>
          <option value="">Todos os perfis</option>
          {Object.entries(PERFIL_LABEL).map(([v, l]) =>
            <option key={v} value={v}>{l}</option>)}
        </select>
        <select style={styles.select} value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
        </select>
      </div>

      {/* Tabela */}
      <div style={styles.tabela}>
        {carregando ? (
          <p style={styles.mensagem}>Carregando...</p>
        ) : usuariosFiltrados.length === 0 ? (
          <p style={styles.mensagem}>Nenhum usuário encontrado.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>Nome</th>
                <th style={styles.th}>Contato</th>
                <th style={styles.th}>Perfil</th>
                <th style={styles.th}>Unidade</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((u, i) => {
                const cor = PERFIL_COR[u.perfil] || { bg: '#f3f4f6', cor: '#374151' }
                return (
                  <tr key={u.id} style={{
                    background: i % 2 === 0 ? '#fff' : '#f9fafb',
                    borderBottom: '1px solid #e5e7eb',
                  }}>
                    <td style={styles.td}>
                      <div style={styles.nomeCell}>
                        <div style={styles.avatar}>
                          {u.nome_completo.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={styles.nomeTexto}>{u.nome_completo}</p>
                          <p style={styles.emailTexto}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <p style={{ fontSize: '13px', color: '#374151' }}>{u.telefone || '—'}</p>
                      {u.telefone && (
                        <p style={{ fontSize: '12px', color: u.whatsapp ? '#16a34a' : '#9ca3af' }}>
                          {u.whatsapp ? '✓ WhatsApp' : 'Sem WhatsApp'}
                        </p>
                      )}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        background: cor.bg, color: cor.cor,
                      }}>
                        {PERFIL_LABEL[u.perfil]}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {u.unidade ? (
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                            {u.unidade.nome}
                          </p>
                          <p style={{ fontSize: '12px', color: '#6b7280' }}>
                            {u.unidade.instituicao}
                          </p>
                        </div>
                      ) : <span style={{ color: '#9ca3af', fontSize: '13px' }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        background: u.status === 'ativo' ? '#dcfce7' : '#f3f4f6',
                        color: u.status === 'ativo' ? '#166534' : '#6b7280',
                      }}>
                        {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.acoes}>
                        <BotaoAcao onClick={() => abrirEditar(u)} title="Editar">✏️</BotaoAcao>
                        <BotaoAcao onClick={() => abrirSenha(u)} title="Alterar senha">🔑</BotaoAcao>
                        <BotaoAcao onClick={() => abrirHistorico(u)} title="Ver histórico">📋</BotaoAcao>
                        <BotaoAcao
                          onClick={() => toggleStatus(u)}
                          title={u.status === 'ativo' ? 'Desativar' : 'Ativar'}
                          danger={u.status === 'ativo'}>
                          {u.status === 'ativo' ? '🔴' : '🟢'}
                        </BotaoAcao>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modais */}
      {modalAberto && (
        <ModalUsuario
          usuario={usuarioSelecionado}
          onFechar={fecharModais}
          onSalvar={aoSalvar}
        />
      )}
      {modalSenha && usuarioSelecionado && (
        <ModalSenha
          usuario={usuarioSelecionado}
          onFechar={fecharModais}
          onSalvar={aoSalvar}
        />
      )}
      {modalHistorico && usuarioSelecionado && (
        <ModalHistorico
          usuario={usuarioSelecionado}
          onFechar={fecharModais}
        />
      )}
    </div>
  )
}

function BotaoAcao({ onClick, title, children, danger }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: '16px', padding: '4px 6px', borderRadius: '6px',
      transition: 'background 0.2s',
    }}>
      {children}
    </button>
  )
}

const styles = {
  topBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '24px',
  },
  titulo: { fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' },
  subtitulo: { fontSize: '14px', color: '#6b7280', margin: 0 },
  botaoNovo: {
    padding: '10px 20px', borderRadius: '8px', border: 'none',
    background: 'linear-gradient(135deg, #1a4731, #2d7a4f)',
    color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
  },
  filtros: {
    display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap',
  },
  busca: {
    flex: 1, minWidth: '240px', padding: '10px 14px',
    borderRadius: '8px', border: '1.5px solid #d1d5db',
    fontSize: '14px', outline: 'none',
  },
  select: {
    padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #d1d5db',
    fontSize: '14px', outline: 'none', background: 'white', cursor: 'pointer',
  },
  tabela: {
    background: '#fff', borderRadius: '12px', overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb',
  },
  mensagem: { padding: '48px', textAlign: 'center', color: '#6b7280', fontSize: '14px' },
  thead: { background: '#f9fafb', borderBottom: '2px solid #e5e7eb' },
  th: {
    padding: '12px 16px', textAlign: 'left', fontSize: '12px',
    fontWeight: '600', color: '#6b7280', textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  nomeCell: { display: 'flex', alignItems: 'center', gap: '12px' },
  avatar: {
    width: '36px', height: '36px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #1a4731, #2d7a4f)',
    color: 'white', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '14px', fontWeight: '700',
    flexShrink: 0,
  },
  nomeTexto: { fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 2px 0' },
  emailTexto: { fontSize: '12px', color: '#6b7280', margin: 0 },
  badge: {
    display: 'inline-block', padding: '4px 10px', borderRadius: '20px',
    fontSize: '12px', fontWeight: '500',
  },
  acoes: { display: 'flex', gap: '4px', alignItems: 'center' },
}
