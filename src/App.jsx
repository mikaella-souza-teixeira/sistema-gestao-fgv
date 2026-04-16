import { useEffect, useState, useRef } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [perfilUsuario, setPerfilUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const sessaoIdRef = useRef(null)

  const registrarEntrada = async (userId) => {
    const { data } = await supabase
      .from('historico_acesso')
      .insert({ usuario_id: userId })
      .select('id')
      .single()
    if (data) sessaoIdRef.current = data.id
  }

  const registrarSaida = async () => {
    if (sessaoIdRef.current) {
      await supabase
        .from('historico_acesso')
        .update({ saida: new Date().toISOString() })
        .eq('id', sessaoIdRef.current)
      sessaoIdRef.current = null
    }
  }

  const carregarPerfil = async (userId) => {
    const { data } = await supabase
      .from('perfis_usuarios')
      .select('*, unidade:unidades(nome, instituicao)')
      .eq('id', userId)
      .single()
    setPerfilUsuario(data || null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null
      setUsuario(user)
      if (user) {
        carregarPerfil(user.id)
        registrarEntrada(user.id)
      }
      setCarregando(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null

        if (event === 'SIGNED_IN' && user) {
          setUsuario(user)
          carregarPerfil(user.id)
          registrarEntrada(user.id)
        }

        if (event === 'SIGNED_OUT') {
          await registrarSaida()
          setUsuario(null)
          setPerfilUsuario(null)
        }
      }
    )

    // Registrar saída ao fechar a aba
    const handleUnload = () => registrarSaida()
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [])

  if (carregando) {
    return (
      <div style={styles.loading}>
        <p>Carregando...</p>
      </div>
    )
  }

  return usuario
    ? <Dashboard usuario={usuario} perfilUsuario={perfilUsuario} />
    : <Login />
}

const styles = {
  loading: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontFamily: "'Segoe UI', sans-serif",
    color: '#6b7280', fontSize: '16px',
  },
}
