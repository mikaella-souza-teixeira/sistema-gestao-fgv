import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [msgRecuperar, setMsgRecuperar] = useState('')
  const [enviandoRecuperar, setEnviandoRecuperar] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    setMsgRecuperar('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setErro('E-mail ou senha incorretos. Tente novamente.')
    }

    setCarregando(false)
  }

  const handleRecuperarSenha = async () => {
    if (!email) {
      setErro('Digite seu e-mail acima para recuperar a senha.')
      return
    }
    setEnviandoRecuperar(true)
    setErro('')
    setMsgRecuperar('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/sistema-gestao-fgv/',
    })
    if (error) {
      setErro('Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.')
    } else {
      setMsgRecuperar('E-mail de recuperação enviado! Verifique sua caixa de entrada.')
    }
    setEnviandoRecuperar(false)
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.titulo}>Sistema de Gestão</h1>
          <p style={styles.subtitulo}>SEMA · ICMBIO · FGV</p>
        </div>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.campo}>
            <label style={styles.label}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.campo}>
            <label style={styles.label}>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              style={styles.input}
              required
            />
          </div>

          {erro && <p style={styles.erro}>{erro}</p>}
          {msgRecuperar && <p style={styles.sucesso}>{msgRecuperar}</p>}

          <button
            type="submit"
            disabled={carregando}
            style={{
              ...styles.botao,
              opacity: carregando ? 0.7 : 1,
            }}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={handleRecuperarSenha}
            disabled={enviandoRecuperar}
            style={styles.linkSenha}
          >
            {enviandoRecuperar ? 'Enviando...' : 'Esqueceu sua senha?'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a4731 0%, #2d7a4f 100%)',
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '36px',
  },
  titulo: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#1a4731',
    margin: '0 0 6px 0',
  },
  subtitulo: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
    letterSpacing: '1px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  campo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1.5px solid #d1d5db',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  botao: {
    padding: '14px',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #1a4731 0%, #2d7a4f 100%)',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'opacity 0.2s',
  },
  erro: {
    color: '#dc2626',
    fontSize: '14px',
    textAlign: 'center',
    margin: 0,
    padding: '10px',
    background: '#fef2f2',
    borderRadius: '6px',
  },
  sucesso: {
    color: '#166534',
    fontSize: '14px',
    textAlign: 'center',
    margin: 0,
    padding: '10px',
    background: '#dcfce7',
    borderRadius: '6px',
  },
  linkSenha: {
    background: 'none',
    border: 'none',
    color: '#2d7a4f',
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'center',
    textDecoration: 'underline',
    padding: '4px',
    marginTop: '-8px',
  },
}
