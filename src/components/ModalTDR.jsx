import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const STEPS = [
  { key: 'rascunho',        label: 'Rascunho',         short: 'Rascunho' },
  { key: 'revisao_interna', label: 'Revisão Interna',  short: 'Revisão Inter...' },
  { key: 'ajustes',         label: 'Ajustes',          short: 'Ajustes' },
  { key: 'enviado_unesco',  label: 'Enviado UNESCO',   short: 'Enviado UNE...' },
  { key: 'retorno_unesco',  label: 'Retorno UNESCO',   short: 'Retorno UNE...' },
  { key: 'aprovado',        label: 'Aprovado',         short: 'Aprovado' },
]

const PROXIMO_LABEL = {
  rascunho:        '→ Enviar para revisão interna',
  revisao_interna: '→ Solicitar ajustes',
  ajustes:         '→ Enviar para UNESCO',
  enviado_unesco:  '→ Registrar retorno UNESCO',
  retorno_unesco:  '→ Aprovar TDR',
}

export default function ModalTDR({ tdr, perfilUsuario, onFechar, onSalvar }) {
  const isEdicao = !!tdr
  const isAdmin  = perfilUsuario?.perfil === 'administrador'
  const stepIdx  = STEPS.findIndex(s => s.key === (tdr?.status || 'rascunho'))

  const [abaAtiva, setAbaAtiva]     = useState('campos')
  const [salvando, setSalvando]     = useState(false)
  const [avancando, setAvancando]   = useState(false)
  const [erro, setErro]             = useState('')
  const [versoes, setVersoes]       = useState([])
  const [revisoes, setRevisoes]     = useState([])
  const [novoComent, setNovoComent] = useState('')
  const [enviandoComent, setEnviandoComent] = useState(false)

  const [form, setForm] = useState({
    numero: '', linha: '', tipo: 'PF',
    objeto: '', descricao: '', formacao: '',
    experiencia: '', prazo_limite: '', data_contratacao: '',
    observacoes: '', valor_rs: '', valor_us: '',
    google_drive_url: '',
  })

  useEffect(() => {
    if (isEdicao && tdr) {
      setForm({
        numero:           tdr.numero           || '',
        linha:            tdr.linha            || '',
        tipo:             tdr.tipo             || 'PF',
        objeto:           tdr.objeto           || '',
        descricao:        tdr.descricao        || '',
        formacao:         tdr.formacao         || '',
        experiencia:      tdr.experiencia      || '',
        prazo_limite:     tdr.prazo_limite     || '',
        data_contratacao: tdr.data_contratacao || '',
        observacoes:      tdr.observacoes      || '',
        valor_rs:         tdr.valor_rs         || '',
        valor_us:         tdr.valor_us         || '',
        google_drive_url: tdr.google_drive_url || '',
      })
      carregarVersoes()
      carregarRevisoes()
    }
  }, [tdr])

  const carregarVersoes = async () => {
    const { data } = await supabase
      .from('tdrs_versoes')
      .select('*, autor:criado_por(nome_completo)')
      .eq('tdr_id', tdr.id)
      .order('versao', { ascending: false })
    setVersoes(data || [])
  }

  const carregarRevisoes = async () => {
    const { data } = await supabase
      .from('tdrs_revisoes')
      .select('*, autor:autor_id(nome_completo)')
      .eq('tdr_id', tdr.id)
      .order('created_at', { ascending: true })
    setRevisoes(data || [])
  }

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  const salvar = async () => {
    setSalvando(true); setErro('')
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id
      const payload = { ...form, usuario_id: userId, updated_at: new Date().toISOString() }

      if (isEdicao) {
        // Salva nova versão antes de atualizar
        await supabase.from('tdrs_versoes').insert({
          tdr_id: tdr.id, versao: (tdr.versao || 1) + 1,
          dados: form, criado_por: userId,
        })
        await supabase.from('tdrs').update({
          ...payload, versao: (tdr.versao || 1) + 1,
        }).eq('id', tdr.id)
      } else {
        await supabase.from('tdrs').insert({ ...payload, versao: 1 })
      }
      onSalvar()
    } catch (e) { setErro('Erro ao salvar: ' + e.message) }
    setSalvando(false)
  }

  const avancarStatus = async () => {
    if (stepIdx >= STEPS.length - 1) return
    setAvancando(true)
    const novoStatus = STEPS[stepIdx + 1].key
    const userId = (await supabase.auth.getUser()).data.user?.id
    await supabase.from('tdrs').update({
      status: novoStatus, updated_at: new Date().toISOString(),
    }).eq('id', tdr.id)
    // Registra comentário automático de mudança de status
    await supabase.from('tdrs_revisoes').insert({
      tdr_id: tdr.id,
      comentario: `Status alterado para: ${STEPS[stepIdx + 1].label}`,
      autor_id: userId,
    })
    setAvancando(false)
    onSalvar()
  }

  const enviarComentario = async () => {
    if (!novoComent.trim()) return
    setEnviandoComent(true)
    const userId = (await supabase.auth.getUser()).data.user?.id
    await supabase.from('tdrs_revisoes').insert({
      tdr_id: tdr.id, comentario: novoComent.trim(), autor_id: userId,
    })
    setNovoComent('')
    await carregarRevisoes()
    setEnviandoComent(false)
  }

  const podeAvancar = isEdicao && stepIdx < STEPS.length - 1 && tdr?.status !== 'aprovado'
  const podeEditar  = !isEdicao || ['rascunho', 'ajustes'].includes(tdr?.status)

  const abas = [
    { key: 'campos',   label: '📋 Editar campos' },
    { key: 'financeiro', label: '💰 Financeiro' },
    { key: 'versoes',  label: `🔄 Versões (${versoes.length})` },
    { key: 'revisao',  label: `💬 Revisão (${revisoes.length})` },
    { key: 'arquivo',  label: '📁 Arquivo' },
    { key: 'ia',       label: '🤖 Análise IA' },
  ]

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={styles.modal}>

        {/* Cabeçalho */}
        <div style={styles.cabecalho}>
          <div style={{ flex: 1 }}>
            <h2 style={styles.titulo}>{form.numero || 'Novo TDR'}</h2>
            <p style={styles.subtitulo}>
              {form.tipo} · v{isEdicao ? tdr.versao : 1} · {form.linha || '—'}
              {podeEditar && <span style={styles.podeEditar}> · Você pode editar</span>}
            </p>
          </div>
          <button onClick={onFechar} style={styles.btnFechar}>✕</button>
        </div>

        {/* Barra de progresso */}
        <div style={styles.steps}>
          {STEPS.map((s, i) => {
            const atual = isEdicao ? stepIdx : 0
            const ativo = i === atual
            const feito = i < atual
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{
                    ...styles.stepCircle,
                    background: ativo ? '#1a4731' : feito ? '#2d7a4f' : '#e5e7eb',
                    color: (ativo || feito) ? 'white' : '#9ca3af',
                    border: ativo ? '2px solid #1a4731' : 'none',
                  }}>{feito ? '✓' : i + 1}</div>
                  <span style={{ fontSize: '10px', color: ativo ? '#1a4731' : '#9ca3af', fontWeight: ativo ? '700' : '400', whiteSpace: 'nowrap' }}>
                    {s.short}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: '2px', background: feito ? '#2d7a4f' : '#e5e7eb', margin: '0 4px', marginBottom: '16px' }} />
                )}
              </div>
            )
          })}
        </div>

        {erro && <div style={styles.erro}>{erro}</div>}

        {/* Abas */}
        <div style={styles.abas}>
          {abas.map(a => (
            <button key={a.key} onClick={() => setAbaAtiva(a.key)}
              style={{ ...styles.aba, borderBottom: abaAtiva === a.key ? '2px solid #1a4731' : '2px solid transparent', color: abaAtiva === a.key ? '#1a4731' : '#6b7280', fontWeight: abaAtiva === a.key ? '700' : '400' }}>
              {a.label}
            </button>
          ))}
        </div>

        {/* Conteúdo das abas */}
        <div style={styles.corpo}>

          {/* ── Editar campos ── */}
          {abaAtiva === 'campos' && (
            <div style={styles.form}>
              <Campo label="Objeto / Escopo *">
                <textarea style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                  value={form.objeto} onChange={e => set('objeto', e.target.value)}
                  disabled={!podeEditar} placeholder="Descreva o objeto e escopo do TDR..." />
              </Campo>
              <Campo label="Descrição detalhada">
                <textarea style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                  value={form.descricao} onChange={e => set('descricao', e.target.value)}
                  disabled={!podeEditar} />
              </Campo>
              <Campo label="Formação / Qualificação exigida">
                <textarea style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                  value={form.formacao} onChange={e => set('formacao', e.target.value)}
                  disabled={!podeEditar} />
              </Campo>
              <Campo label="Experiência requerida">
                <textarea style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                  value={form.experiencia} onChange={e => set('experiencia', e.target.value)}
                  disabled={!podeEditar} />
              </Campo>
              <div style={styles.grid2}>
                <Campo label="Prazo limite">
                  <input style={styles.input} type="date" value={form.prazo_limite}
                    onChange={e => set('prazo_limite', e.target.value)} disabled={!podeEditar} />
                </Campo>
                <Campo label="Data de contratação">
                  <input style={styles.input} type="date" value={form.data_contratacao}
                    onChange={e => set('data_contratacao', e.target.value)} disabled={!podeEditar} />
                </Campo>
              </div>
              <Campo label="Observações gerais">
                <textarea style={{ ...styles.input, minHeight: '70px', resize: 'vertical' }}
                  value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
                  disabled={!podeEditar} />
              </Campo>
              {podeEditar && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={salvar} disabled={salvando} style={styles.btnSalvar}>
                    {salvando ? 'Salvando...' : '💾 Salvar nova versão'}
                  </button>
                  <button onClick={() => setForm(prev => ({ ...prev, objeto: tdr?.objeto || '', descricao: tdr?.descricao || '' }))}
                    style={styles.btnDescartar}>
                    ↩ Descartar alterações
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Financeiro ── */}
          {abaAtiva === 'financeiro' && (
            <div style={styles.form}>
              <div style={styles.grid2}>
                <Campo label="Valor em R$ (Reais)">
                  <div style={styles.inputPreco}>
                    <span style={styles.moeda}>R$</span>
                    <input style={{ ...styles.input, borderLeft: 'none', borderRadius: '0 8px 8px 0' }}
                      type="number" step="0.01" value={form.valor_rs}
                      onChange={e => set('valor_rs', e.target.value)}
                      disabled={!podeEditar} placeholder="0,00" />
                  </div>
                </Campo>
                <Campo label="Valor em U$ (Dólares)">
                  <div style={styles.inputPreco}>
                    <span style={styles.moeda}>U$</span>
                    <input style={{ ...styles.input, borderLeft: 'none', borderRadius: '0 8px 8px 0' }}
                      type="number" step="0.01" value={form.valor_us}
                      onChange={e => set('valor_us', e.target.value)}
                      disabled={!podeEditar} placeholder="0,00" />
                  </div>
                </Campo>
              </div>
              <Campo label="Link Google Drive (contrato / arquivos)">
                <input style={styles.input} type="url" value={form.google_drive_url}
                  onChange={e => set('google_drive_url', e.target.value)}
                  placeholder="https://drive.google.com/..." />
              </Campo>
              {podeEditar && (
                <button onClick={salvar} disabled={salvando} style={styles.btnSalvar}>
                  {salvando ? 'Salvando...' : '💾 Salvar'}
                </button>
              )}
            </div>
          )}

          {/* ── Versões ── */}
          {abaAtiva === 'versoes' && (
            <div style={styles.form}>
              {versoes.length === 0 ? (
                <p style={styles.vazio}>Nenhuma versão salva ainda. Salve uma nova versão para ver o histórico.</p>
              ) : versoes.map(v => (
                <div key={v.id} style={styles.versaoCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={styles.versaoNumero}>v{v.versao}</span>
                    <span style={styles.versaoData}>{new Date(v.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <p style={styles.versaoAutor}>por {v.autor?.nome_completo || '—'}</p>
                  <p style={styles.versaoObjeto}>{v.dados?.objeto || '—'}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Revisão ── */}
          {abaAtiva === 'revisao' && (
            <div style={styles.form}>
              <div style={styles.comentarios}>
                {revisoes.length === 0 && (
                  <p style={styles.vazio}>Nenhum comentário ainda.</p>
                )}
                {revisoes.map(r => (
                  <div key={r.id} style={styles.comentarioCard}>
                    <div style={styles.comentarioTopo}>
                      <span style={styles.comentarioAutor}>{r.autor?.nome_completo || '—'}</span>
                      <span style={styles.comentarioData}>{new Date(r.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <p style={styles.comentarioTexto}>{r.comentario}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <textarea
                  value={novoComent}
                  onChange={e => setNovoComent(e.target.value)}
                  style={{ ...styles.input, flex: 1, minHeight: '60px', resize: 'none' }}
                  placeholder="Escreva um comentário de revisão..." />
                <button onClick={enviarComentario} disabled={enviandoComent || !novoComent.trim()}
                  style={{ ...styles.btnSalvar, alignSelf: 'flex-end' }}>
                  {enviandoComent ? '...' : 'Enviar'}
                </button>
              </div>
            </div>
          )}

          {/* ── Arquivo ── */}
          {abaAtiva === 'arquivo' && (
            <div style={styles.form}>
              <p style={styles.dica}>📁 Use o link do Google Drive para compartilhar o arquivo do TDR.</p>
              <Campo label="Link Google Drive">
                <input style={styles.input} type="url" value={form.google_drive_url}
                  onChange={e => set('google_drive_url', e.target.value)}
                  placeholder="https://drive.google.com/..." />
              </Campo>
              {form.google_drive_url && (
                <a href={form.google_drive_url} target="_blank" rel="noreferrer" style={styles.linkDrive}>
                  🔗 Abrir no Google Drive
                </a>
              )}
              {podeEditar && (
                <button onClick={salvar} disabled={salvando} style={styles.btnSalvar}>
                  {salvando ? 'Salvando...' : '💾 Salvar link'}
                </button>
              )}
            </div>
          )}

          {/* ── Análise IA ── */}
          {abaAtiva === 'ia' && (
            <div style={{ ...styles.form, alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
              <span style={{ fontSize: '48px' }}>🤖</span>
              <p style={{ color: '#6b7280', textAlign: 'center' }}>
                Análise inteligente do TDR será disponibilizada em breve.
              </p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div style={styles.rodape}>
          <button onClick={onFechar} style={styles.btnRodape}>Fechar</button>
          <div style={{ display: 'flex', gap: '10px' }}>
            {isEdicao && (
              <a href={form.google_drive_url || '#'} target="_blank" rel="noreferrer"
                style={{ ...styles.btnRodape, textDecoration: 'none', opacity: form.google_drive_url ? 1 : 0.4, pointerEvents: form.google_drive_url ? 'auto' : 'none' }}>
                📝 Editor
              </a>
            )}
            {podeAvancar && (
              <button onClick={avancarStatus} disabled={avancando} style={styles.btnAvancar}>
                {avancando ? 'Avançando...' : PROXIMO_LABEL[tdr?.status || 'rascunho']}
              </button>
            )}
            {!isEdicao && (
              <button onClick={salvar} disabled={salvando} style={styles.btnAvancar}>
                {salvando ? 'Criando...' : '+ Criar TDR'}
              </button>
            )}
          </div>
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
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px', overflowY: 'auto' },
  modal: { background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '860px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', marginTop: '8px' },
  cabecalho: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '24px 28px 16px', borderBottom: '1px solid #e5e7eb' },
  titulo: { fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' },
  subtitulo: { fontSize: '13px', color: '#6b7280', margin: 0 },
  podeEditar: { color: '#1a4731', fontWeight: '600' },
  btnFechar: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#9ca3af', padding: '4px', lineHeight: 1 },
  steps: { display: 'flex', alignItems: 'flex-start', padding: '16px 28px', borderBottom: '1px solid #e5e7eb' },
  stepCircle: { width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0 },
  erro: { margin: '0 28px 8px', background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' },
  abas: { display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 28px', overflowX: 'auto' },
  aba: { padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap', transition: 'all 0.15s' },
  corpo: { padding: '20px 28px', overflowY: 'auto', maxHeight: '50vh' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '14px', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', resize: 'vertical' },
  inputPreco: { display: 'flex', alignItems: 'stretch' },
  moeda: { display: 'flex', alignItems: 'center', padding: '0 12px', background: '#f9fafb', border: '1.5px solid #d1d5db', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: '14px', color: '#6b7280', fontWeight: '600', whiteSpace: 'nowrap' },
  dica: { background: '#f0fdf4', color: '#166534', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', margin: 0 },
  vazio: { color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '24px 0' },
  versaoCard: { background: '#f9fafb', borderRadius: '8px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid #e5e7eb' },
  versaoNumero: { fontWeight: '700', color: '#1a4731', fontSize: '14px' },
  versaoData: { fontSize: '12px', color: '#9ca3af' },
  versaoAutor: { fontSize: '12px', color: '#6b7280', margin: 0 },
  versaoObjeto: { fontSize: '13px', color: '#374151', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  comentarios: { display: 'flex', flexDirection: 'column', gap: '10px' },
  comentarioCard: { background: '#f9fafb', borderRadius: '8px', padding: '12px 16px', border: '1px solid #e5e7eb' },
  comentarioTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  comentarioAutor: { fontWeight: '600', fontSize: '13px', color: '#374151' },
  comentarioData: { fontSize: '11px', color: '#9ca3af' },
  comentarioTexto: { fontSize: '13px', color: '#374151', margin: 0 },
  linkDrive: { color: '#1a4731', fontWeight: '600', fontSize: '14px' },
  rodape: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 28px', borderTop: '1px solid #e5e7eb' },
  btnRodape: { padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '14px' },
  btnSalvar: { padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #1a4731', background: '#1a4731', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  btnDescartar: { padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '14px', color: '#6b7280' },
  btnAvancar: { padding: '9px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #1a4731, #2d7a4f)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
}
