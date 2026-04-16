import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PERFIS = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'ponto_focal_sema', label: 'Ponto Focal SEMA' },
  { value: 'ponto_focal_icmbio', label: 'Ponto Focal ICMBIO' },
  { value: 'ponto_focal_tecnico', label: 'Ponto Focal Técnico' },
]

export default function ModalUsuario({ usuario, onFechar, onSalvar }) {
  const isEdicao = !!usuario
  const [unidades, setUnidades] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    nome_completo: usuario?.nome_completo || '',
    email: usuario?.email || '',
    telefone: usuario?.telefone || '',
    whatsapp: usuario?.whatsapp || false,
    perfil: usuario?.perfil || 'ponto_focal_tecnico',
    unidade_id: usuario?.unidade_id || '',
    status: usuario?.status || 'ativo',
    senha: '',
  })

  useEffect(() => {
    supabase.from('unidades').select('*').order('instituicao').order('nome')
      .then(({ data }) => setUnidades(data || []))
  }, [])

  const precisaUnidade = form.perfil === 'ponto_focal_tecnico'

  const handleChange = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }))
    setErro('')
  }

  const handleSalvar = async () => {
    if (!form.nome_completo || !form.email || !form.perfil) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }
    if (precisaUnidade && !form.unidade_id) {
      setErro('Selecione a unidade do ponto focal técnico.')
      return
    }
    if (!isEdicao && !form.senha) {
      setErro('Defina uma senha para o novo usuário.')
      return
    }

    setCarregando(true)
    setErro('')

    try {
      if (isEdicao) {
        const { error } = await supabase.from('perfis_usuarios').update({
          nome_completo: form.nome_completo,
          telefone: form.telefone || null,
          whatsapp: form.whatsapp,
          perfil: form.perfil,
          unidade_id: precisaUnidade ? form.unidade_id : null,
          status: form.status,
          updated_at: new Date().toISOString(),
        }).eq('id', usuario.id)

        if (error) throw error
      } else {
        const { error } = await supabase.rpc('admin_create_user', {
          p_email: form.email,
          p_password: form.senha,
          p_nome_completo: form.nome_completo,
          p_telefone: form.telefone || null,
          p_whatsapp: form.whatsapp,
          p_perfil: form.perfil,
          p_unidade_id: precisaUnidade ? form.unidade_id : null,
        })

        if (error) throw error
      }

      onSalvar()
    } catch (e) {
      setErro(e.message || 'Erro ao salvar. Tente novamente.')
    }

    setCarregando(false)
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.titulo}>{isEdicao ? 'Editar Usuário' : 'Novo Usuário'}</h2>
          <button onClick={onFechar} style={styles.botaoFechar}>✕</button>
        </div>

        <div style={styles.corpo}>
          <div style={styles.grid2}>
            <Campo label="Nome Completo *">
              <input style={styles.input} value={form.nome_completo}
                onChange={e => handleChange('nome_completo', e.target.value)}
                placeholder="Nome completo" />
            </Campo>

            <Campo label="E-mail *">
              <input style={{ ...styles.input, background: isEdicao ? '#f9fafb' : 'white' }}
                value={form.email} type="email"
                onChange={e => handleChange('email', e.target.value)}
                placeholder="email@exemplo.com" disabled={isEdicao} />
            </Campo>

            <Campo label="Telefone">
              <input style={styles.input} value={form.telefone}
                onChange={e => handleChange('telefone', e.target.value)}
                placeholder="(XX) XXXXX-XXXX" />
            </Campo>

            <Campo label="Usa WhatsApp?">
              <div style={styles.toggle}>
                <button
                  onClick={() => handleChange('whatsapp', true)}
                  style={{ ...styles.toggleBtn, ...(form.whatsapp ? styles.toggleAtivo : {}) }}>
                  Sim
                </button>
                <button
                  onClick={() => handleChange('whatsapp', false)}
                  style={{ ...styles.toggleBtn, ...(!form.whatsapp ? styles.toggleAtivo : {}) }}>
                  Não
                </button>
              </div>
            </Campo>

            <Campo label="Perfil de Acesso *">
              <select style={styles.input} value={form.perfil}
                onChange={e => handleChange('perfil', e.target.value)}>
                {PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Campo>

            {precisaUnidade && (
              <Campo label="Unidade *">
                <select style={styles.input} value={form.unidade_id}
                  onChange={e => handleChange('unidade_id', e.target.value)}>
                  <option value="">Selecione...</option>
                  <optgroup label="SEMA">
                    {unidades.filter(u => u.instituicao === 'SEMA').map(u =>
                      <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </optgroup>
                  <optgroup label="ICMBIO">
                    {unidades.filter(u => u.instituicao === 'ICMBIO').map(u =>
                      <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </optgroup>
                </select>
              </Campo>
            )}

            {isEdicao && (
              <Campo label="Status">
                <select style={styles.input} value={form.status}
                  onChange={e => handleChange('status', e.target.value)}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </Campo>
            )}

            {!isEdicao && (
              <Campo label="Senha *">
                <input style={styles.input} value={form.senha} type="password"
                  onChange={e => handleChange('senha', e.target.value)}
                  placeholder="Mínimo 6 caracteres" />
              </Campo>
            )}
          </div>

          {erro && <p style={styles.erro}>{erro}</p>}
        </div>

        <div style={styles.rodape}>
          <button onClick={onFechar} style={styles.botaoCancelar}>Cancelar</button>
          <button onClick={handleSalvar} disabled={carregando}
            style={{ ...styles.botaoSalvar, opacity: carregando ? 0.7 : 1 }}>
            {carregando ? 'Salvando...' : isEdicao ? 'Salvar Alterações' : 'Criar Usuário'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{label}</label>
      {children}
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
    maxWidth: '640px', maxHeight: '90vh', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '24px 28px', borderBottom: '1px solid #e5e7eb',
  },
  titulo: { fontSize: '18px', fontWeight: '700', color: '#111827', margin: 0 },
  botaoFechar: {
    background: 'none', border: 'none', fontSize: '18px',
    cursor: 'pointer', color: '#6b7280', padding: '4px 8px',
  },
  corpo: { padding: '24px 28px', overflowY: 'auto', flex: 1 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  input: {
    padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #d1d5db',
    fontSize: '14px', outline: 'none', width: '100%', fontFamily: 'inherit',
  },
  toggle: { display: 'flex', gap: '8px' },
  toggleBtn: {
    flex: 1, padding: '10px', borderRadius: '8px', border: '1.5px solid #d1d5db',
    background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500',
  },
  toggleAtivo: { background: '#1a4731', color: 'white', borderColor: '#1a4731' },
  erro: {
    color: '#dc2626', fontSize: '13px', background: '#fef2f2',
    padding: '10px 14px', borderRadius: '8px', marginTop: '16px',
  },
  rodape: {
    display: 'flex', justifyContent: 'flex-end', gap: '12px',
    padding: '20px 28px', borderTop: '1px solid #e5e7eb',
  },
  botaoCancelar: {
    padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #d1d5db',
    background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500',
  },
  botaoSalvar: {
    padding: '10px 24px', borderRadius: '8px', border: 'none',
    background: 'linear-gradient(135deg, #1a4731, #2d7a4f)',
    color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
  },
}
