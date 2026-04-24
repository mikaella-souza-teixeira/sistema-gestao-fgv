import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { downloadArquivo } from '../lib/downloads'

// ── constantes ─────────────────────────────────────────────────────────────────
const TIPOS_DOC = {
  tdr_principal:   { label: 'TDR Principal',       icon: '📄', cor: '#1e40af', bg: '#dbeafe' },
  memoria_calculo: { label: 'Memória de Cálculo',  icon: '🧮', cor: '#92400e', bg: '#fef3c7' },
  criterio_selecao:{ label: 'Critério de Seleção', icon: '📋', cor: '#5b21b6', bg: '#ede9fe' },
}

const TIPO_ACAO = {
  encaminhou:       { label: 'Encaminhou',         cor: '#1d4ed8', bg: '#dbeafe', icone: '📤' },
  devolveu:         { label: 'Devolveu',            cor: '#92400e', bg: '#fef3c7', icone: '↩️' },
  solicitou_ajuste: { label: 'Solicitou ajuste',   cor: '#9a3412', bg: '#ffedd5', icone: '✏️' },
  revisao_final:    { label: 'Revisão final UO',   cor: '#5b21b6', bg: '#ede9fe', icone: '🔍' },
  aprovou:          { label: 'Aprovou',            cor: '#166534', bg: '#dcfce7', icone: '✅' },
}

const STATUS_CONTRATO = {
  negociacao:  { label: 'Em negociação', cor: '#92400e', bg: '#fef3c7' },
  assinado:    { label: 'Assinado',      cor: '#1e40af', bg: '#dbeafe' },
  em_execucao: { label: 'Em execução',  cor: '#166534', bg: '#dcfce7' },
  encerrado:   { label: 'Encerrado',    cor: '#6b7280', bg: '#f3f4f6' },
}

const STATUS_PRODUTO = {
  pendente: { label: 'Pendente',  cor: '#6b7280', bg: '#f3f4f6' },
  entregue: { label: 'Entregue', cor: '#1e40af', bg: '#dbeafe' },
  aprovado: { label: 'Aprovado', cor: '#166534', bg: '#dcfce7' },
  rejeitado:{ label: 'Rejeitado',cor: '#991b1b', bg: '#fee2e2' },
}

const ETAPAS = [
  { key: 'tdr',       label: 'TDR',       icon: '📝' },
  { key: 'aquisicao', label: 'Aquisição', icon: '🛒' },
  { key: 'contrato',  label: 'Contrato',  icon: '📑' },
  { key: 'produtos',  label: 'Produtos',  icon: '📦' },
]

function fmtData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
function fmtDataSimples(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

// ── componente principal ───────────────────────────────────────────────────────
export default function ModalTDR({ tdr, perfilUsuario, onVoltar, onSalvar }) {
  const isEdicao = !!tdr
  const [abaAtiva,   setAbaAtiva]   = useState('geral')
  const [salvando,   setSalvando]   = useState(false)
  const [erro,       setErro]       = useState('')
  const [uploadando, setUploadando] = useState(null)

  // dados relacionados
  const [docs,     setDocs]     = useState([])
  const [movs,     setMovs]     = useState([])
  const [contrato, setContrato] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [etapa,    setEtapa]    = useState(tdr?.etapa || 'tdr')
  const [enviandoAquisicao, setEnviandoAquisicao] = useState(false)
  const [buscandoDemanda, setBuscandoDemanda] = useState(false)

  // refs de upload
  const docRef      = useRef()
  const comprovRef  = useRef()
  const contratoRef = useRef()
  const produtoRef  = useRef()

  // ── form principal ─────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    numero: '', numero_demanda: '', linhas_poa: '', componente: '', tipo: 'PF',
    objeto: '', descricao: '', prazo_limite: '', observacoes: '',
    valor_brl: '', valor_usd: '',
  })

  // ── form novo documento ───────────────────────────────────────────────────
  const DOC_VAZIO = {
    tipo: 'tdr_principal', nome_versao: '', observacoes: '',
    data_inclusao: new Date().toISOString().substring(0, 16),
  }
  const [novoDoc,     setNovoDoc]     = useState(DOC_VAZIO)
  const [salvandoDoc, setSalvandoDoc] = useState(false)

  // ── form nova movimentação ────────────────────────────────────────────────
  const MOV_VAZIO = {
    de: '', para: '', tipo: 'encaminhou', versao_doc: '', observacoes: '',
    arquivo_url: '', data_movimentacao: new Date().toISOString().substring(0, 16),
  }
  const [novaMov,     setNovaMov]     = useState(MOV_VAZIO)
  const [salvandoMov, setSalvandoMov] = useState(false)

  // ── form contrato ─────────────────────────────────────────────────────────
  const CONT_VAZIO = {
    numero_contrato: '', contratado: '', valor_brl: '', valor_usd: '',
    data_assinatura: '', vigencia_inicio: '', vigencia_fim: '',
    status: 'negociacao', arquivo_url: '', observacoes: '',
  }
  const [formCont,     setFormCont]     = useState(CONT_VAZIO)
  const [salvandoCont, setSalvandoCont] = useState(false)

  // ── form novo produto ─────────────────────────────────────────────────────
  const PROD_VAZIO = { nome: '', descricao: '', data_prevista: '', data_entrega: '', status: 'pendente' }
  const [novoProd,     setNovoProd]     = useState(PROD_VAZIO)
  const [salvandoProd, setSalvandoProd] = useState(false)

  // ── carregar dados ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isEdicao && tdr) {
      setForm({
        numero:         tdr.numero         || '',
        numero_demanda: tdr.numero_demanda || '',
        linhas_poa:     tdr.linhas_poa     || '',
        componente:     tdr.componente     || '',
        tipo:           tdr.tipo           || 'PF',
        objeto:         tdr.objeto         || '',
        descricao:      tdr.descricao      || '',
        prazo_limite:   tdr.prazo_limite   || '',
        observacoes:    tdr.observacoes    || '',
        valor_brl:      tdr.valor_brl      || '',
        valor_usd:      tdr.valor_usd      || '',
      })
      setEtapa(tdr.etapa || 'tdr')
      carregarDocs()
      carregarMovs()
      carregarContrato()
      carregarProdutos()
    }
  }, [tdr])

  const carregarDocs = async () => {
    const { data } = await supabase
      .from('tdrs_documentos')
      .select('*')
      .eq('tdr_id', tdr.id)
      .order('tipo')
      .order('versao_numero', { ascending: false })
    setDocs(data || [])
  }

  const carregarMovs = async () => {
    const { data } = await supabase
      .from('tdrs_movimentacoes')
      .select('*')
      .eq('tdr_id', tdr.id)
      .order('data_movimentacao', { ascending: true })
    setMovs(data || [])
  }

  const carregarContrato = async () => {
    const { data } = await supabase
      .from('tdrs_contratos')
      .select('*')
      .eq('tdr_id', tdr.id)
      .maybeSingle()
    if (data) {
      setContrato(data)
      setFormCont({
        numero_contrato: data.numero_contrato || '',
        contratado:      data.contratado      || '',
        valor_brl:       data.valor_brl       || '',
        valor_usd:       data.valor_usd       || '',
        data_assinatura: data.data_assinatura || '',
        vigencia_inicio: data.vigencia_inicio || '',
        vigencia_fim:    data.vigencia_fim    || '',
        status:          data.status          || 'negociacao',
        arquivo_url:     data.arquivo_url     || '',
        observacoes:     data.observacoes     || '',
      })
    }
  }

  const carregarProdutos = async () => {
    const { data } = await supabase
      .from('tdrs_produtos')
      .select('*')
      .eq('tdr_id', tdr.id)
      .order('created_at')
    setProdutos(data || [])
  }

  // ── buscar demanda na tabela atividades ──────────────────────────────────
  const buscarDemanda = async (id) => {
    if (!id || id.length < 10) return
    setBuscandoDemanda(true)
    try {
      const { data } = await supabase
        .from('atividades')
        .select('linhas_poa, componente')
        .eq('id', id.trim())
        .single()
      if (data) {
        setForm(f => ({
          ...f,
          linhas_poa: data.linhas_poa || f.linhas_poa,
          componente: data.componente || f.componente,
        }))
      }
    } catch {}
    setBuscandoDemanda(false)
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  const set    = (c, v) => setForm(f => ({ ...f, [c]: v }))
  const setDoc = (c, v) => setNovoDoc(f => ({ ...f, [c]: v }))
  const setMov = (c, v) => setNovaMov(f => ({ ...f, [c]: v }))
  const setCont = (c, v) => setFormCont(f => ({ ...f, [c]: v }))
  const setProd = (c, v) => setNovoProd(f => ({ ...f, [c]: v }))

  const uploadArquivo = async (arquivo, pasta, chave) => {
    setUploadando(chave)
    try {
      const ext  = arquivo.name.split('.').pop()
      const path = `tdrs/${tdr?.id || 'novo'}/${pasta}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('anexos').upload(path, arquivo, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('anexos').getPublicUrl(path)
      return data.publicUrl
    } catch (e) {
      alert('Erro ao enviar arquivo: ' + e.message)
      return null
    } finally {
      setUploadando(null)
    }
  }

  // ── salvar TDR (campos + valores) ─────────────────────────────────────────
  const salvar = async () => {
    if (!form.objeto) { setErro('Informe o objeto do TDR.'); return }
    setSalvando(true); setErro('')
    try {
      const userId  = (await supabase.auth.getUser()).data.user?.id
      const payload = { ...form, usuario_id: userId, updated_at: new Date().toISOString() }
      if (isEdicao) {
        const { error } = await supabase.from('tdrs').update(payload).eq('id', tdr.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('tdrs').insert({ ...payload, etapa: 'tdr', status: 'rascunho' })
        if (error) throw error
      }
      onSalvar()
    } catch (e) { setErro('Erro ao salvar: ' + e.message) }
    setSalvando(false)
  }

  // ── salvar documento versionado ───────────────────────────────────────────
  const salvarDoc = async () => {
    if (!docRef.current?.files?.[0]) { alert('Selecione um arquivo.'); return }
    setSalvandoDoc(true)
    try {
      const file        = docRef.current.files[0]
      const docsDoTipo  = docs.filter(d => d.tipo === novoDoc.tipo)
      const proxVersao  = docsDoTipo.length > 0
        ? Math.max(...docsDoTipo.map(d => d.versao_numero || 1)) + 1
        : 1
      const url = await uploadArquivo(file, `docs/${novoDoc.tipo}_v${proxVersao}`, 'doc')
      if (!url) return
      const { error } = await supabase.from('tdrs_documentos').insert({
        tdr_id:        tdr.id,
        tipo:          novoDoc.tipo,
        versao_numero: proxVersao,
        nome_versao:   novoDoc.nome_versao || `Versão ${proxVersao}`,
        observacoes:   novoDoc.observacoes,
        arquivo_url:   url,
        data_inclusao: novoDoc.data_inclusao
          ? new Date(novoDoc.data_inclusao).toISOString()
          : new Date().toISOString(),
        usuario_id:    perfilUsuario?.id,
      })
      if (error) throw error
      setNovoDoc(DOC_VAZIO)
      if (docRef.current) docRef.current.value = ''
      carregarDocs()
    } catch (e) { alert('Erro ao salvar documento: ' + e.message) }
    setSalvandoDoc(false)
  }

  // ── salvar movimentação ───────────────────────────────────────────────────
  const salvarMovimentacao = async () => {
    if (!novaMov.de || !novaMov.para) { alert('Preencha "De" e "Para".'); return }
    setSalvandoMov(true)
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id
      let arquivo_url = novaMov.arquivo_url
      if (comprovRef.current?.files?.[0]) {
        arquivo_url = await uploadArquivo(comprovRef.current.files[0], 'comprovacoes', 'comprov') || ''
      }
      await supabase.from('tdrs_movimentacoes').insert({
        tdr_id:            tdr.id,
        de:                novaMov.de,
        para:              novaMov.para,
        tipo:              novaMov.tipo,
        versao_doc:        novaMov.versao_doc,
        observacoes:       novaMov.observacoes,
        arquivo_url,
        data_movimentacao: new Date(novaMov.data_movimentacao).toISOString(),
        usuario_id:        userId,
      })
      setNovaMov(MOV_VAZIO)
      if (comprovRef.current) comprovRef.current.value = ''
      await carregarMovs()
    } catch (e) { alert('Erro: ' + e.message) }
    setSalvandoMov(false)
  }

  const removerMov = async (id) => {
    if (!confirm('Remover esta movimentação?')) return
    await supabase.from('tdrs_movimentacoes').delete().eq('id', id)
    await carregarMovs()
  }

  // ── avançar para aquisições ───────────────────────────────────────────────
  const enviarParaAquisicoes = async () => {
    if (!confirm('Confirmar aprovação do TDR e envio para o setor de Aquisições?')) return
    setEnviandoAquisicao(true)
    try {
      // Atualizar etapa do TDR
      const { error: e1 } = await supabase.from('tdrs')
        .update({ etapa: 'aquisicao', status: 'aprovado', updated_at: new Date().toISOString() })
        .eq('id', tdr.id)
      if (e1) throw e1
      // Criar aquisição vinculada automaticamente
      const { error: e2 } = await supabase.from('aquisicoes').insert({
        numero_demanda: form.numero_demanda,
        tipo:           'pequenas_compras',
        unidade_id:     perfilUsuario?.unidade_id || null,
        tdr_id:         tdr.id,
        status:         'rascunho',
        observacoes:    `Gerado a partir do TDR ${form.numero || ''}. Objeto: ${form.objeto}`.trim(),
        itens:          [],
        created_at:     new Date().toISOString(),
        updated_at:     new Date().toISOString(),
      })
      if (e2) throw e2
      setEtapa('aquisicao')
      alert('TDR aprovado e enviado para Aquisições com sucesso!')
      onSalvar()
    } catch (e) { alert('Erro: ' + e.message) }
    setEnviandoAquisicao(false)
  }

  // ── salvar contrato ───────────────────────────────────────────────────────
  const salvarContrato = async () => {
    setSalvandoCont(true)
    try {
      let arquivo_url = formCont.arquivo_url
      if (contratoRef.current?.files?.[0]) {
        arquivo_url = await uploadArquivo(contratoRef.current.files[0], 'contratos', 'contrato') || arquivo_url
      }
      const payload = { ...formCont, arquivo_url, tdr_id: tdr.id, updated_at: new Date().toISOString() }
      if (contrato?.id) {
        await supabase.from('tdrs_contratos').update(payload).eq('id', contrato.id)
      } else {
        const { data } = await supabase.from('tdrs_contratos')
          .insert({ ...payload, created_at: new Date().toISOString() })
          .select().single()
        setContrato(data)
        // avança etapa
        await supabase.from('tdrs').update({ etapa: 'contrato', updated_at: new Date().toISOString() }).eq('id', tdr.id)
        setEtapa('contrato')
      }
      await carregarContrato()
      alert('Contrato salvo!')
    } catch (e) { alert('Erro: ' + e.message) }
    setSalvandoCont(false)
  }

  // ── salvar produto ────────────────────────────────────────────────────────
  const salvarProduto = async () => {
    if (!novoProd.nome) { alert('Informe o nome do produto.'); return }
    setSalvandoProd(true)
    try {
      let arquivo_url = ''
      if (produtoRef.current?.files?.[0]) {
        arquivo_url = await uploadArquivo(produtoRef.current.files[0], 'produtos', 'produto') || ''
      }
      const { error } = await supabase.from('tdrs_produtos').insert({
        tdr_id:        tdr.id,
        nome:          novoProd.nome,
        descricao:     novoProd.descricao,
        data_prevista: novoProd.data_prevista || null,
        data_entrega:  novoProd.data_entrega  || null,
        arquivo_url,
        status:        novoProd.status,
        created_at:    new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      })
      if (error) throw error
      setNovoProd(PROD_VAZIO)
      if (produtoRef.current) produtoRef.current.value = ''
      await carregarProdutos()
      // avança etapa se for o primeiro produto
      if (['tdr','aquisicao','contrato'].includes(etapa)) {
        await supabase.from('tdrs').update({ etapa: 'produtos', updated_at: new Date().toISOString() }).eq('id', tdr.id)
        setEtapa('produtos')
      }
    } catch (e) { alert('Erro: ' + e.message) }
    setSalvandoProd(false)
  }

  const atualizarStatusProduto = async (id, novoStatus) => {
    await supabase.from('tdrs_produtos')
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
    await carregarProdutos()
  }

  const removerProduto = async (id) => {
    if (!confirm('Remover este produto?')) return
    await supabase.from('tdrs_produtos').delete().eq('id', id)
    await carregarProdutos()
  }

  // ── derivados ─────────────────────────────────────────────────────────────
  const ultimaMov = movs.length > 0 ? movs[movs.length - 1] : null
  const docsPorTipo = {}
  Object.keys(TIPOS_DOC).forEach(tipo => {
    docsPorTipo[tipo] = docs.filter(d => d.tipo === tipo)
  })

  const abas = [
    { key: 'geral',          label: '📋 Geral' },
    { key: 'documentos',     label: `📁 Documentos${docs.length ? ` (${docs.length})` : ''}` },
    { key: 'movimentacoes',  label: `📤 Movimentações${movs.length ? ` (${movs.length})` : ''}` },
    { key: 'contrato',       label: '📑 Contrato' },
    { key: 'produtos',       label: `📦 Produtos${produtos.length ? ` (${produtos.length})` : ''}` },
  ]

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={st.pagina}>

      {/* ── Barra superior (igual ao FormPassagens) ── */}
      <div style={st.cabecalho}>
        <button onClick={onVoltar} style={st.btnVoltar}>← Voltar</button>
        <div style={{ flex: 1 }}>
          <h2 style={st.titulo}>{form.numero || (isEdicao ? 'Contratação' : 'Nova Contratação')}</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
            {form.numero_demanda && (
              <span style={st.tagDemanda}>📋 {form.numero_demanda}</span>
            )}
            <span style={st.tagTipo}>{form.tipo}</span>
            {ultimaMov && (
              <span style={{ ...st.tagStatus, background: TIPO_ACAO[ultimaMov.tipo]?.bg, color: TIPO_ACAO[ultimaMov.tipo]?.cor }}>
                {TIPO_ACAO[ultimaMov.tipo]?.icone} Com: <strong>{ultimaMov.para}</strong>
              </span>
            )}
            {contrato?.status && (
              <span style={{ ...st.tagStatus, background: STATUS_CONTRATO[contrato.status]?.bg, color: STATUS_CONTRATO[contrato.status]?.cor }}>
                📑 {STATUS_CONTRATO[contrato.status]?.label}
              </span>
            )}
          </div>
        </div>
        <button onClick={salvar} disabled={salvando} style={st.btnSalvarTopo}>
          {salvando ? 'Salvando...' : '💾 Salvar'}
        </button>
      </div>

      {/* Barra de etapas */}
      {isEdicao && (
        <div style={st.etapasBar}>
          {ETAPAS.map((e, i) => {
            const idx   = ETAPAS.findIndex(x => x.key === etapa)
            const feito = i < idx
            const ativo = e.key === etapa
            return (
              <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                  background: ativo ? '#1a4731' : feito ? '#d1fae5' : '#f3f4f6',
                  color:      ativo ? '#fff'    : feito ? '#166534' : '#9ca3af',
                }}>
                  {feito ? '✓' : e.icon} {e.label}
                </div>
                {i < ETAPAS.length - 1 && (
                  <span style={{ color: '#d1d5db', fontSize: '16px', fontWeight: '300' }}>›</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {erro && <div style={st.erro}>{erro}</div>}

      {/* ── Abas ── */}
      <div style={st.abas}>
        {abas.map(a => (
          <button key={a.key} onClick={() => setAbaAtiva(a.key)} style={{
            ...st.aba,
            borderBottom: abaAtiva === a.key ? '3px solid #1a4731' : '3px solid transparent',
            color:      abaAtiva === a.key ? '#1a4731' : '#6b7280',
            fontWeight: abaAtiva === a.key ? '700' : '400',
          }}>{a.label}</button>
        ))}
      </div>

      {/* ── Corpo ── */}
      <div style={st.corpo}>

          {/* ════════ ABA: GERAL ════════ */}
          {abaAtiva === 'geral' && (
            <div style={st.form}>
              <div style={st.grid3}>
                <Campo label="Número do TDR">
                  <input style={st.input} value={form.numero}
                    onChange={e => set('numero', e.target.value)} placeholder="TDR-001" />
                </Campo>
                <Campo label={buscandoDemanda ? 'Número da Demanda  🔄 Buscando...' : 'Número da Demanda'}>
                  <input style={st.input} value={form.numero_demanda}
                    onChange={e => set('numero_demanda', e.target.value)}
                    onBlur={e => buscarDemanda(e.target.value)}
                    placeholder="DE-ASL2-POA3-XXX-2026-00XX" />
                </Campo>
                <Campo label="Tipo">
                  <select style={st.input} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                    <option value="PF">Pessoa Física (PF)</option>
                    <option value="PJ">Pessoa Jurídica (PJ)</option>
                  </select>
                </Campo>
              </div>

              <div style={st.grid2}>
                <Campo label="Linha(s) do POA">
                  <input style={st.input} value={form.linhas_poa}
                    onChange={e => set('linhas_poa', e.target.value)}
                    placeholder="Preenchido automaticamente pelo número da demanda" />
                </Campo>
                <Campo label="Componente">
                  <input style={st.input} value={form.componente}
                    onChange={e => set('componente', e.target.value)}
                    placeholder="Preenchido automaticamente" />
                </Campo>
              </div>

              <Campo label="Objeto / Escopo *">
                <textarea style={{ ...st.input, minHeight: '80px' }} value={form.objeto}
                  onChange={e => set('objeto', e.target.value)} placeholder="Descreva o objeto..." />
              </Campo>

              <Campo label="Descrição detalhada">
                <textarea style={{ ...st.input, minHeight: '80px' }} value={form.descricao}
                  onChange={e => set('descricao', e.target.value)} />
              </Campo>

              <div style={st.grid2}>
                <Campo label="Prazo limite">
                  <input style={st.input} type="date" value={form.prazo_limite}
                    onChange={e => set('prazo_limite', e.target.value)} />
                </Campo>
                <div />
              </div>

              {/* Valores financeiros */}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '14px' }}>
                <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '700', color: '#374151' }}>💰 Valores</p>
                <div style={st.grid2}>
                  <Campo label="Valor em R$ (Reais)">
                    <div style={st.inputPreco}>
                      <span style={st.moeda}>R$</span>
                      <input style={{ ...st.input, borderLeft: 'none', borderRadius: '0 8px 8px 0' }}
                        type="number" step="0.01" value={form.valor_brl}
                        onChange={e => set('valor_brl', e.target.value)} placeholder="0,00" />
                    </div>
                  </Campo>
                  <Campo label="Valor em U$ (Dólares)">
                    <div style={st.inputPreco}>
                      <span style={st.moeda}>U$</span>
                      <input style={{ ...st.input, borderLeft: 'none', borderRadius: '0 8px 8px 0' }}
                        type="number" step="0.01" value={form.valor_usd}
                        onChange={e => set('valor_usd', e.target.value)} placeholder="0,00" />
                    </div>
                  </Campo>
                </div>
              </div>

              <Campo label="Observações gerais">
                <textarea style={{ ...st.input, minHeight: '60px' }} value={form.observacoes}
                  onChange={e => set('observacoes', e.target.value)} />
              </Campo>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={salvar} disabled={salvando} style={st.btnSalvar}>
                  {salvando ? 'Salvando...' : '💾 Salvar'}
                </button>
                {!isEdicao && (
                  <button onClick={onVoltar} style={st.btnSecundario}>Cancelar</button>
                )}
              </div>
            </div>
          )}

          {/* ════════ ABA: DOCUMENTOS ════════ */}
          {abaAtiva === 'documentos' && (
            <div style={st.form}>
              {!isEdicao ? (
                <p style={st.vazio}>Salve a contratação primeiro para adicionar documentos.</p>
              ) : (
                <>
                  {/* Histórico por tipo */}
                  {Object.entries(TIPOS_DOC).map(([tipo, info]) => {
                    const versoes = docsPorTipo[tipo] || []
                    return (
                      <div key={tipo} style={st.docGrupo}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ ...st.docTipoTag, background: info.bg, color: info.cor }}>
                            {info.icon} {info.label}
                          </span>
                          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {versoes.length === 0 ? 'Nenhuma versão' : `${versoes.length} versão(ões)`}
                          </span>
                        </div>
                        {versoes.length === 0 ? (
                          <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 4px' }}>Nenhum documento enviado.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {versoes.map(v => (
                              <div key={v.id} style={st.docVersao}>
                                <div style={{ flex: 1 }}>
                                  <span style={st.versaoBadge}>v{v.versao_numero}</span>
                                  <span style={{ fontWeight: '600', fontSize: '13px', color: '#111827' }}>
                                    {v.nome_versao || `Versão ${v.versao_numero}`}
                                  </span>
                                  <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>
                                    📅 {fmtData(v.data_inclusao || v.created_at)}
                                  </span>
                                  {v.observacoes && (
                                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#6b7280' }}>{v.observacoes}</p>
                                  )}
                                </div>
                                {v.arquivo_url && (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <a href={v.arquivo_url} target="_blank" rel="noreferrer" style={st.btnLink}>👁️ Ver</a>
                                    <button
                                      onClick={() => downloadArquivo(v.arquivo_url, `${tipo}_v${v.versao_numero}.pdf`)}
                                      style={st.btnLink}>⬇️ Baixar</button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Formulário: nova versão de documento */}
                  <div style={st.novaMovCard}>
                    <h4 style={st.novaMovTitulo}>+ Adicionar nova versão de documento</h4>
                    <div style={st.grid2}>
                      <Campo label="Tipo de documento">
                        <select style={st.input} value={novoDoc.tipo} onChange={e => setDoc('tipo', e.target.value)}>
                          {Object.entries(TIPOS_DOC).map(([k, v]) => (
                            <option key={k} value={k}>{v.icon} {v.label}</option>
                          ))}
                        </select>
                      </Campo>
                      <Campo label="Nome / descrição da versão">
                        <input style={st.input} value={novoDoc.nome_versao}
                          onChange={e => setDoc('nome_versao', e.target.value)}
                          placeholder="Ex: Revisão 1, Após feedback UO..." />
                      </Campo>
                    </div>
                    <div style={st.grid2}>
                      <Campo label="Data de inclusão (retroativo ok)">
                        <input style={st.input} type="datetime-local" value={novoDoc.data_inclusao}
                          onChange={e => setDoc('data_inclusao', e.target.value)} />
                      </Campo>
                      <Campo label="Observações">
                        <input style={st.input} value={novoDoc.observacoes}
                          onChange={e => setDoc('observacoes', e.target.value)}
                          placeholder="Ex: Corrigida a seção 3..." />
                      </Campo>
                    </div>
                    <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx"
                      style={{ display: 'none' }} />
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button onClick={() => docRef.current?.click()} style={st.btnUploadPeq}
                        disabled={uploadando === 'doc'}>
                        {uploadando === 'doc' ? '⏳ Enviando...' : '📎 Selecionar arquivo'}
                      </button>
                      <button onClick={salvarDoc} disabled={salvandoDoc} style={{ ...st.btnSalvar, marginLeft: 'auto' }}>
                        {salvandoDoc ? 'Salvando...' : '+ Adicionar versão'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════════ ABA: MOVIMENTAÇÕES ════════ */}
          {abaAtiva === 'movimentacoes' && (
            <div style={st.form}>

              {/* Botão avançar para Aquisições */}
              {isEdicao && etapa === 'tdr' && (
                <div style={st.aquisicaoBox}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontWeight: '700', color: '#166534', fontSize: '14px' }}>
                      ✅ TDR aprovado? Avançar para Aquisições
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                      Isso aprovará o TDR e criará automaticamente um registro no módulo de Aquisições.
                    </p>
                  </div>
                  <button onClick={enviarParaAquisicoes} disabled={enviandoAquisicao}
                    style={st.btnAvancar}>
                    {enviandoAquisicao ? '⏳ Enviando...' : '🛒 Enviar para Aquisições'}
                  </button>
                </div>
              )}
              {isEdicao && etapa !== 'tdr' && (
                <div style={{ ...st.aquisicaoBox, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#166534', fontWeight: '600' }}>
                    ✅ TDR aprovado — processo em etapa: <strong>{ETAPAS.find(e => e.key === etapa)?.label}</strong>
                  </p>
                </div>
              )}

              {/* Timeline */}
              {movs.length === 0 ? (
                <p style={st.vazio}>Nenhuma movimentação registrada ainda.</p>
              ) : (
                <div style={st.timeline}>
                  {movs.map((m, i) => {
                    const ta = TIPO_ACAO[m.tipo] || TIPO_ACAO.encaminhou
                    return (
                      <div key={m.id} style={st.timelineItem}>
                        <div style={st.timelineLinha}>
                          <div style={{ ...st.timelineCircle, background: ta.cor }}>{ta.icone}</div>
                          {i < movs.length - 1 && <div style={st.timelineConector} />}
                        </div>
                        <div style={{ ...st.timelineCard, borderLeft: `3px solid ${ta.cor}` }}>
                          <div style={st.timelineTopo}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ ...st.tipoTag, background: ta.bg, color: ta.cor }}>{ta.label}</span>
                              <span style={st.deParaTexto}><strong>{m.de}</strong> → <strong>{m.para}</strong></span>
                              {m.versao_doc && <span style={st.versaoTag}>📄 {m.versao_doc}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={st.timelineData}>{fmtData(m.data_movimentacao)}</span>
                              <button onClick={() => removerMov(m.id)} style={st.btnRemover}>🗑️</button>
                            </div>
                          </div>
                          {m.observacoes && <p style={st.timelineObs}>{m.observacoes}</p>}
                          {m.arquivo_url && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                              <a href={m.arquivo_url} target="_blank" rel="noreferrer" style={st.btnLink}>📎 Ver comprovação</a>
                              <button onClick={() => downloadArquivo(m.arquivo_url, `comprovacao-${i+1}.pdf`)} style={st.btnLink}>⬇️ Baixar</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Formulário nova movimentação */}
              <div style={st.novaMovCard}>
                <h4 style={st.novaMovTitulo}>+ Registrar movimentação</h4>
                <div style={st.grid2}>
                  <Campo label="De (quem enviou)">
                    <input style={st.input} value={novaMov.de}
                      onChange={e => setMov('de', e.target.value)} placeholder="Ex: UO / Mikaella / Superior" />
                  </Campo>
                  <Campo label="Para (quem recebeu)">
                    <input style={st.input} value={novaMov.para}
                      onChange={e => setMov('para', e.target.value)} placeholder="Ex: Mikaella / Superior / UO" />
                  </Campo>
                </div>
                <div style={st.grid3}>
                  <Campo label="Tipo da ação">
                    <select style={st.input} value={novaMov.tipo} onChange={e => setMov('tipo', e.target.value)}>
                      {Object.entries(TIPO_ACAO).map(([k, v]) => (
                        <option key={k} value={k}>{v.icone} {v.label}</option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="Versão do documento">
                    <input style={st.input} value={novaMov.versao_doc}
                      onChange={e => setMov('versao_doc', e.target.value)} placeholder="v1, v2..." />
                  </Campo>
                  <Campo label="Data / hora (retroativo ok)">
                    <input style={st.input} type="datetime-local" value={novaMov.data_movimentacao}
                      onChange={e => setMov('data_movimentacao', e.target.value)} />
                  </Campo>
                </div>
                <Campo label="Observações / texto do e-mail">
                  <textarea style={{ ...st.input, minHeight: '70px' }} value={novaMov.observacoes}
                    onChange={e => setMov('observacoes', e.target.value)}
                    placeholder="Cole aqui o conteúdo do e-mail ou descreva o encaminhamento..." />
                </Campo>
                <input ref={comprovRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.eml,.msg"
                  style={{ display: 'none' }}
                  onChange={async e => {
                    if (!e.target.files[0]) return
                    const url = await uploadArquivo(e.target.files[0], 'comprovacoes', 'comprov')
                    if (url) setMov('arquivo_url', url)
                  }} />
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {novaMov.arquivo_url ? (
                    <span style={{ fontSize: '13px', color: '#1a4731', fontWeight: '600' }}>✅ Comprovação anexada</span>
                  ) : (
                    <button onClick={() => comprovRef.current?.click()} style={st.btnUploadPeq}
                      disabled={uploadando === 'comprov'}>
                      {uploadando === 'comprov' ? '⏳' : '📎 Anexar comprovação'}
                    </button>
                  )}
                  {novaMov.arquivo_url && (
                    <button onClick={() => setMov('arquivo_url', '')} style={st.btnSecundario}>✕ Remover</button>
                  )}
                  <button onClick={salvarMovimentacao} disabled={salvandoMov || !novaMov.de || !novaMov.para}
                    style={{ ...st.btnSalvar, marginLeft: 'auto' }}>
                    {salvandoMov ? 'Registrando...' : '+ Registrar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════════ ABA: CONTRATO ════════ */}
          {abaAtiva === 'contrato' && (
            <div style={st.form}>
              {!isEdicao ? (
                <p style={st.vazio}>Salve a contratação primeiro para registrar o contrato.</p>
              ) : (
                <>
                  <div style={st.grid2}>
                    <Campo label="Número do contrato">
                      <input style={st.input} value={formCont.numero_contrato}
                        onChange={e => setCont('numero_contrato', e.target.value)} placeholder="CONT-2026-001" />
                    </Campo>
                    <Campo label="Contratado (nome / empresa)">
                      <input style={st.input} value={formCont.contratado}
                        onChange={e => setCont('contratado', e.target.value)} />
                    </Campo>
                  </div>
                  <div style={st.grid2}>
                    <Campo label="Valor contratado (R$)">
                      <div style={st.inputPreco}>
                        <span style={st.moeda}>R$</span>
                        <input style={{ ...st.input, borderLeft: 'none', borderRadius: '0 8px 8px 0' }}
                          type="number" step="0.01" value={formCont.valor_brl}
                          onChange={e => setCont('valor_brl', e.target.value)} placeholder="0,00" />
                      </div>
                    </Campo>
                    <Campo label="Valor contratado (U$)">
                      <div style={st.inputPreco}>
                        <span style={st.moeda}>U$</span>
                        <input style={{ ...st.input, borderLeft: 'none', borderRadius: '0 8px 8px 0' }}
                          type="number" step="0.01" value={formCont.valor_usd}
                          onChange={e => setCont('valor_usd', e.target.value)} placeholder="0,00" />
                      </div>
                    </Campo>
                  </div>
                  <div style={st.grid3}>
                    <Campo label="Data de assinatura">
                      <input style={st.input} type="date" value={formCont.data_assinatura}
                        onChange={e => setCont('data_assinatura', e.target.value)} />
                    </Campo>
                    <Campo label="Vigência — início">
                      <input style={st.input} type="date" value={formCont.vigencia_inicio}
                        onChange={e => setCont('vigencia_inicio', e.target.value)} />
                    </Campo>
                    <Campo label="Vigência — fim">
                      <input style={st.input} type="date" value={formCont.vigencia_fim}
                        onChange={e => setCont('vigencia_fim', e.target.value)} />
                    </Campo>
                  </div>
                  <Campo label="Status do contrato">
                    <select style={st.input} value={formCont.status} onChange={e => setCont('status', e.target.value)}>
                      {Object.entries(STATUS_CONTRATO).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="Observações">
                    <textarea style={{ ...st.input, minHeight: '60px' }} value={formCont.observacoes}
                      onChange={e => setCont('observacoes', e.target.value)} />
                  </Campo>

                  {/* Upload do contrato */}
                  <input ref={contratoRef} type="file" accept=".pdf,.doc,.docx"
                    style={{ display: 'none' }}
                    onChange={async e => {
                      if (!e.target.files[0]) return
                      const url = await uploadArquivo(e.target.files[0], 'contratos', 'contrato')
                      if (url) setCont('arquivo_url', url)
                    }} />
                  <Campo label="Arquivo do contrato assinado">
                    {formCont.arquivo_url ? (
                      <div style={st.arquivoAnexado}>
                        <span>📄 Contrato anexado</span>
                        <a href={formCont.arquivo_url} target="_blank" rel="noreferrer" style={st.btnLink}>👁️ Ver</a>
                        <button onClick={() => downloadArquivo(formCont.arquivo_url, `contrato-${formCont.numero_contrato || 'arquivo'}.pdf`)}
                          style={st.btnLink}>⬇️ Baixar</button>
                        <button onClick={() => contratoRef.current?.click()} style={st.btnSecundario}>🔄 Substituir</button>
                      </div>
                    ) : (
                      <button onClick={() => contratoRef.current?.click()} style={st.btnUpload}
                        disabled={uploadando === 'contrato'}>
                        {uploadando === 'contrato' ? '⏳ Enviando...' : '📎 Anexar contrato (PDF ou Word)'}
                      </button>
                    )}
                  </Campo>

                  <button onClick={salvarContrato} disabled={salvandoCont} style={st.btnSalvar}>
                    {salvandoCont ? 'Salvando...' : '💾 Salvar contrato'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ════════ ABA: PRODUTOS ════════ */}
          {abaAtiva === 'produtos' && (
            <div style={st.form}>
              {!isEdicao ? (
                <p style={st.vazio}>Salve a contratação primeiro para registrar produtos.</p>
              ) : (
                <>
                  {/* Lista de produtos */}
                  {produtos.length === 0 ? (
                    <p style={st.vazio}>Nenhum produto registrado ainda.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {produtos.map((p, i) => {
                        const sp = STATUS_PRODUTO[p.status] || STATUS_PRODUTO.pendente
                        return (
                          <div key={p.id} style={st.produtoCard}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                              <span style={{ fontWeight: '700', fontSize: '13px', color: '#1a4731' }}>
                                #{i + 1}
                              </span>
                              <span style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>{p.nome}</span>
                              <span style={{ ...st.tipoTag, background: sp.bg, color: sp.cor }}>{sp.label}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                              {p.data_prevista && (
                                <span style={{ fontSize: '11px', color: '#6b7280' }}>
                                  📅 Previsto: {fmtDataSimples(p.data_prevista)}
                                </span>
                              )}
                              {p.data_entrega && (
                                <span style={{ fontSize: '11px', color: '#166534' }}>
                                  ✅ Entregue: {fmtDataSimples(p.data_entrega)}
                                </span>
                              )}
                              <select
                                value={p.status}
                                onChange={e => atualizarStatusProduto(p.id, e.target.value)}
                                style={{ ...st.input, padding: '4px 8px', fontSize: '12px', width: 'auto' }}>
                                {Object.entries(STATUS_PRODUTO).map(([k, v]) => (
                                  <option key={k} value={k}>{v.label}</option>
                                ))}
                              </select>
                              {p.arquivo_url && (
                                <>
                                  <a href={p.arquivo_url} target="_blank" rel="noreferrer" style={st.btnLink}>👁️ Ver</a>
                                  <button onClick={() => downloadArquivo(p.arquivo_url, `produto-${i+1}.pdf`)}
                                    style={st.btnLink}>⬇️</button>
                                </>
                              )}
                              <button onClick={() => removerProduto(p.id)} style={st.btnRemover}>🗑️</button>
                            </div>
                            {p.descricao && (
                              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280', width: '100%' }}>{p.descricao}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Formulário novo produto */}
                  <div style={st.novaMovCard}>
                    <h4 style={st.novaMovTitulo}>+ Registrar produto / entrega</h4>
                    <div style={st.grid2}>
                      <Campo label="Nome do produto *">
                        <input style={st.input} value={novoProd.nome}
                          onChange={e => setProd('nome', e.target.value)}
                          placeholder="Ex: Produto 1 — Relatório Inicial" />
                      </Campo>
                      <Campo label="Status inicial">
                        <select style={st.input} value={novoProd.status}
                          onChange={e => setProd('status', e.target.value)}>
                          {Object.entries(STATUS_PRODUTO).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </Campo>
                    </div>
                    <Campo label="Descrição">
                      <textarea style={{ ...st.input, minHeight: '60px' }} value={novoProd.descricao}
                        onChange={e => setProd('descricao', e.target.value)} />
                    </Campo>
                    <div style={st.grid2}>
                      <Campo label="Data prevista">
                        <input style={st.input} type="date" value={novoProd.data_prevista}
                          onChange={e => setProd('data_prevista', e.target.value)} />
                      </Campo>
                      <Campo label="Data de entrega">
                        <input style={st.input} type="date" value={novoProd.data_entrega}
                          onChange={e => setProd('data_entrega', e.target.value)} />
                      </Campo>
                    </div>
                    <input ref={produtoRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip"
                      style={{ display: 'none' }} />
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button onClick={() => produtoRef.current?.click()} style={st.btnUploadPeq}
                        disabled={uploadando === 'produto'}>
                        {uploadando === 'produto' ? '⏳ Enviando...' : '📎 Anexar arquivo do produto'}
                      </button>
                      <button onClick={salvarProduto} disabled={salvandoProd}
                        style={{ ...st.btnSalvar, marginLeft: 'auto' }}>
                        {salvandoProd ? 'Salvando...' : '+ Registrar produto'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

      </div>
    </div>
  )
}

// ── sub-componentes ────────────────────────────────────────────────────────────
function Campo({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{label}</label>
      {children}
    </div>
  )
}

// ── estilos ────────────────────────────────────────────────────────────────────
const st = {
  pagina:       { display: 'flex', flexDirection: 'column', minHeight: '100%' },
  cabecalho:    { display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' },
  btnVoltar:    { padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '14px', color: '#374151', fontWeight: '600', whiteSpace: 'nowrap' },
  btnSalvarTopo:{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#1a4731', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap' },
  titulo:       { fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 3px' },
  etapasBar:    { display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 24px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' },
  tagDemanda:   { fontSize: '11px', fontWeight: '600', color: '#1e40af', background: '#dbeafe', padding: '2px 10px', borderRadius: '20px' },
  tagTipo:      { fontSize: '11px', fontWeight: '600', color: '#92400e', background: '#fef3c7', padding: '2px 10px', borderRadius: '20px' },
  tagStatus:    { fontSize: '11px', fontWeight: '600', padding: '2px 10px', borderRadius: '20px' },
  erro:         { margin: '8px 24px 0', background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' },
  abas:         { display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 20px', overflowX: 'auto', background: '#fff' },
  aba:          { padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', transition: 'all 0.15s' },
  corpo:        { padding: '24px', flex: 1 },
  form:         { display: 'flex', flexDirection: 'column', gap: '16px' },
  grid2:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' },
  grid3:        { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' },
  input:        { padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '14px', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', resize: 'vertical' },
  inputPreco:   { display: 'flex', alignItems: 'stretch' },
  moeda:        { display: 'flex', alignItems: 'center', padding: '0 12px', background: '#f9fafb', border: '1.5px solid #d1d5db', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: '14px', color: '#6b7280', fontWeight: '600' },
  vazio:        { color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '32px 0' },
  arquivoAnexado: { display: 'flex', alignItems: 'center', gap: '12px', background: '#f0fdf4', padding: '12px 16px', borderRadius: '8px', border: '1px solid #bbf7d0', flexWrap: 'wrap' },
  btnUpload:    { padding: '12px 18px', borderRadius: '8px', border: '1.5px dashed #d1d5db', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#6b7280' },
  btnUploadPeq: { padding: '7px 14px', borderRadius: '8px', border: '1.5px dashed #d1d5db', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#6b7280' },
  btnLink:      { padding: '5px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#1a4731', fontWeight: '600', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
  btnSalvar:    { padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#1a4731', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  btnSecundario:{ padding: '9px 16px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#6b7280' },
  btnRemover:   { background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#9ca3af', padding: '2px 4px' },
  btnAvancar:   { padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#166534', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap' },
  rodape:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 28px', borderTop: '1px solid #e5e7eb' },
  // timeline
  timeline:     { display: 'flex', flexDirection: 'column', gap: '0' },
  timelineItem: { display: 'flex', gap: '12px' },
  timelineLinha:{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 },
  timelineCircle:{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'white', flexShrink: 0 },
  timelineConector: { width: '2px', flex: 1, background: '#e5e7eb', minHeight: '16px', margin: '2px 0' },
  timelineCard: { flex: 1, background: '#f9fafb', borderRadius: '10px', padding: '12px 16px', marginBottom: '12px', border: '1px solid #e5e7eb' },
  timelineTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' },
  tipoTag:      { fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' },
  deParaTexto:  { fontSize: '13px', color: '#374151' },
  versaoTag:    { fontSize: '11px', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '10px' },
  timelineData: { fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' },
  timelineObs:  { fontSize: '13px', color: '#374151', margin: '0', whiteSpace: 'pre-wrap', lineHeight: '1.5' },
  novaMovCard:  { background: '#f9fafb', borderRadius: '12px', padding: '16px 18px', border: '1.5px dashed #d1d5db', display: 'flex', flexDirection: 'column', gap: '12px' },
  novaMovTitulo:{ fontSize: '14px', fontWeight: '700', color: '#374151', margin: 0 },
  // documentos
  docGrupo:     { background: '#f9fafb', borderRadius: '10px', padding: '14px 16px', border: '1px solid #e5e7eb' },
  docTipoTag:   { fontSize: '12px', fontWeight: '700', padding: '3px 12px', borderRadius: '20px' },
  docVersao:    { display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'white', borderRadius: '8px', padding: '10px 12px', border: '1px solid #e5e7eb', flexWrap: 'wrap' },
  versaoBadge:  { background: '#1a4731', color: 'white', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', marginRight: '6px' },
  // aquisição
  aquisicaoBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '10px', padding: '14px 16px', flexWrap: 'wrap' },
  // produtos
  produtoCard:  { display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f9fafb', borderRadius: '10px', padding: '12px 14px', border: '1px solid #e5e7eb', flexWrap: 'wrap' },
}
