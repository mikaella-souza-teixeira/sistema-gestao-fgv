import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    // Verifica se já existe sessão ativa
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUsuario(session?.user ?? null)
      setCarregando(false)
    })

    // Escuta mudanças de login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUsuario(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (carregando) {
    return (
      <div style={styles.loading}>
        <p>Carregando...</p>
      </div>
    )
  }

  return usuario ? <Dashboard usuario={usuario} /> : <Login />
}

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Segoe UI', sans-serif",
    color: '#6b7280',
    fontSize: '16px',
  },
}
