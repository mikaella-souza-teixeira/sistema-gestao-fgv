import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ModalSenha({ usuario, onFechar, onSalvar }) {
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const handleSalvar = async () => {
    if (!senha || senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }

    setCarregando(true)
    setErro('')

    const { error } = await supabase.rpc('admin_update_password', {
      p_user_id: usuario.id,
      p_nova_senha: senha,
    })

    if (error) {
      setErro(`Erro: ${error.message}`)
    } else {
      onSalvar()
    }

    setCarregando(false)
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.titulo}>Alterar Senha</h2>
            <p style={styles.subtitulo}>{usuario.nome_completo}</p>
          </div>
          <button onClick={onFechar} style={styles.botaoFechar}>✕</button>
        </div>

        <div style={styles.corpo}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={styles.campo}>
              <label style={styles.label}>Nova Senha</label>
              <input style={styles.input} type="password" value={senha}
                onChange={e => { setSenha(e.target.value); setErro('') }}
                placeholder="Mínimo 6 caracteres" />
            </div>
            <div style={styles.campo}>
              <label style={styles.label}>Confirmar Senha</label>
              <input style={styles.input} type="password" value={confirmar}
                onChange={e => { setConfirmar(e.target.value); setErro('') }}
                placeholder="Repita a senha" />
            </div>
            {erro && <p style={styles.erro}>{erro}</p>}
          </div>
        </div>

        <div style={styles.rodape}>
          <button onClick={onFechar} style={styles.botaoCancelar}>Cancelar</button>
          <button onClick={handleSalvar} disabled={carregando}
            style={{ ...styles.botaoSalvar, opacity: carregando ? 0.7 : 1 }}>
            {carregando ? 'Salvando...' : 'Alterar Senha'}
          </button>
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
    maxWidth: '440px', boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
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
  corpo: { padding: '24px 28px' },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '600', color: '#374151' },
  input: {
    padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #d1d5db',
    fontSize: '14px', outline: 'none', fontFamily: 'inherit',
  },
  erro: {
    color: '#dc2626', fontSize: '13px', background: '#fef2f2',
    padding: '10px 14px', borderRadius: '8px',
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
