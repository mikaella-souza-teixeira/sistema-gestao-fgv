import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import FormPassagens from '../components/FormPassagens'

const STATUS_COR = {
  rascunho:  { bg: '#f3f4f6', cor: '#6b7280' },
  enviado:   { bg: '#dbeafe', cor: '#1e40af' },
  aprovado:  { bg: '#dcfce7', cor: '#166534' },
  cancelado: { bg: '#fee2e2', cor: '#991b1b' },
}

const STATUS_LABEL = {
  rascunho:  'Rascunho',
  enviado:   'Enviado',
  aprovado:  'Aprovado',
  cancelado: 'Cancelado',
}

export default function PassagensDiarias({ perfilUsuario }) {
  const [solicitacoes, setSolicitacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [selecionada, setSelecionada] = useState(null)

  const carregar = async () => {
    setCarregando(true)
    const { data } = await supabase
      .from('passagens_diarias')
      .select('*, unidade:unidades(nome, instituicao)')
      .order('created_at', { ascending: false })
    setSolicitacoes(data || [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  const abrirNova = () => { setSelecionada(null); setFormAberto(true) }
  const abrirEditar = (s) => { setSelecionada(s); setFormAberto(true) }
  const fechar = () => { setFormAberto(false); setSelecionada(null) }
  const aoSalvar = () => { fechar(); carregar() }

  if (formAberto) {
    return (
      <FormPassagens
        solicitacao={selecionada}
        perfilUsuario={perfilUsuario}
        onVoltar={fechar}
        onSalvar={aoSalvar}
      />
    )
  }

  return (
    <div>
      <div style={styles.topBar}>
        <div>
          <h2 style={styles.titulo}>Passagens e Diárias</h2>
          <p style={styles.subtitulo}>{solicitacoes.length} solicitações registradas</p>
        </div>
        <button onClick={abrirNova} style={styles.botaoNovo}>
          + Nova Solicitação
        </button>
      </div>

      <div style={styles.tabela}>
        {carregando ? (
          <p style={styles.mensagem}>Carregando...</p>
        ) : solicitacoes.length === 0 ? (
          <div style={styles.vazio}>
            <p style={styles.vazioPrimario}>Nenhuma solicitação ainda</p>
            <p style={styles.vazioSecundario}>Clique em "Nova Solicitação" para começar</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>Nº / Beneficiário</th>
                <th style={styles.th}>Demanda</th>
                <th style={styles.th}>Destino</th>
                <th style={styles.th}>Data</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {solicitacoes.map((s, i) => {
                const d = s.dados || {}
                const cor = STATUS_COR[s.status] || STATUS_COR.rascunho
                return (
                  <tr key={s.id} style={{
                    background: i % 2 === 0 ? '#fff' : '#f9fafb',
                    borderBottom: '1px solid #e5e7eb',
                  }}>
                    <td style={styles.td}>
                      <p style={styles.nomeTexto}>{d.nome_completo || '—'}</p>
                      <p style={styles.emailTexto}>{s.numero_rpad || 'Sem número'}</p>
                    </td>
                    <td style={styles.td}>
                      <p style={{ fontSize: '13px', color: '#374151' }}>{d.numero_demanda || '—'}</p>
                    </td>
                    <td style={styles.td}>
                      <p style={{ fontSize: '13px', color: '#374151' }}>
                        {d.passagem_destino_1 || d.transporte_destino || '—'}
                      </p>
                    </td>
                    <td style={styles.td}>
                      <p style={{ fontSize: '13px', color: '#374151' }}>
                        {new Date(s.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, background: cor.bg, color: cor.cor }}>
                        {STATUS_LABEL[s.status]}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => abrirEditar(s)} style={styles.btnAcao} title="Editar / Gerar documento">
                          ✏️
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const styles = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  titulo: { fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' },
  subtitulo: { fontSize: '14px', color: '#6b7280', margin: 0 },
  botaoNovo: {
    padding: '10px 20px', borderRadius: '8px', border: 'none',
    background: 'linear-gradient(135deg, #1a4731, #2d7a4f)',
    color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
  },
  tabela: {
    background: '#fff', borderRadius: '12px', overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb',
  },
  mensagem: { padding: '48px', textAlign: 'center', color: '#6b7280', fontSize: '14px' },
  vazio: { padding: '64px', textAlign: 'center' },
  vazioPrimario: { fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 8px 0' },
  vazioSecundario: { fontSize: '14px', color: '#9ca3af', margin: 0 },
  thead: { background: '#f9fafb', borderBottom: '2px solid #e5e7eb' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  nomeTexto: { fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 2px 0' },
  emailTexto: { fontSize: '12px', color: '#6b7280', margin: 0 },
  badge: { display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' },
  btnAcao: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px 6px', borderRadius: '6px' },
}
