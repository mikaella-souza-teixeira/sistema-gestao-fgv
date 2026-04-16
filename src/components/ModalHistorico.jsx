import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ModalHistorico({ usuario, onFechar }) {
  const [historico, setHistorico] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.from('historico_acesso')
      .select('*')
      .eq('usuario_id', usuario.id)
      .order('entrada', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setHistorico(data || [])
        setCarregando(false)
      })
  }, [usuario.id])

  const formatarData = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const calcularDuracao = (entrada, saida) => {
    if (!saida) return 'Em sessão'
    const diff = new Date(saida) - new Date(entrada)
    const min = Math.floor(diff / 60000)
    if (min < 60) return `${min} min`
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${h}h ${m}min`
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.titulo}>Histórico de Acesso</h2>
            <p style={styles.subtitulo}>{usuario.nome_completo}</p>
          </div>
          <button onClick={onFechar} style={styles.botaoFechar}>✕</button>
        </div>

        <div style={styles.corpo}>
          {carregando ? (
            <p style={styles.mensagem}>Carregando...</p>
          ) : historico.length === 0 ? (
            <p style={styles.mensagem}>Nenhum acesso registrado.</p>
          ) : (
            <table style={styles.tabela}>
              <thead>
                <tr>
                  <th style={styles.th}>Entrada</th>
                  <th style={styles.th}>Saída</th>
                  <th style={styles.th}>Duração</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((h, i) => (
                  <tr key={h.id} style={{ background: i % 2 === 0 ? '#f9fafb' : 'white' }}>
                    <td style={styles.td}>{formatarData(h.entrada)}</td>
                    <td style={styles.td}>{formatarData(h.saida)}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        background: !h.saida ? '#dcfce7' : '#f3f4f6',
                        color: !h.saida ? '#166534' : '#374151',
                      }}>
                        {calcularDuracao(h.entrada, h.saida)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={styles.rodape}>
          <button onClick={onFechar} style={styles.botaoFechar2}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px',
  },
  modal: {
    background: '#fff', borderRadius: '16px', width: '100%',
    maxWidth: '640px', maxHeight: '80vh', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '24px 28px', borderBottom: '1px solid #e5e7eb',
  },
  titulo: { fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' },
  subtitulo: { fontSize: '13px', color: '#6b7280', margin: 0 },
  botaoFechar: {
    background: 'none', border: 'none', fontSize: '18px',
    cursor: 'pointer', color: '#6b7280',
  },
  corpo: { padding: '8px 0', overflowY: 'auto', flex: 1 },
  mensagem: { padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '14px' },
  tabela: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '12px 24px', textAlign: 'left', fontSize: '12px',
    fontWeight: '600', color: '#6b7280', textTransform: 'uppercase',
    letterSpacing: '0.5px', borderBottom: '1px solid #e5e7eb',
  },
  td: { padding: '12px 24px', fontSize: '14px', color: '#374151' },
  badge: {
    display: 'inline-block', padding: '3px 10px',
    borderRadius: '20px', fontSize: '12px', fontWeight: '500',
  },
  rodape: {
    display: 'flex', justifyContent: 'flex-end',
    padding: '16px 28px', borderTop: '1px solid #e5e7eb',
  },
  botaoFechar2: {
    padding: '10px 24px', borderRadius: '8px', border: '1.5px solid #d1d5db',
    background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500',
  },
}
