import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const TIPO_LABEL = {
  adiantamento_recursos: 'Adiantamento de Recursos',
  pequenas_compras:      'Pequenas Compras',
}

const ITEM_VAZIO = {
  nome: '', valor: '', fornecedor: '',
  nota_fiscal_url: '', fotos_urls: [],
}

function fmtMoeda(v) {
  const n = Number(v || 0)
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export default function ModalAquisicao({ aquisicao, perfilUsuario, unidades, onFechar, onSalvar }) {
  const isEdicao = !!aquisicao
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [itemSel, setItemSel]       = useState(0)
  const [uploadando, setUploadando] = useState(null)

  const notaRefs  = useRef({})
  const fotosRefs = useRef({})

  const [form, setForm] = useState({
    numero_demanda: '',
    tipo: 'pequenas_compras',
    unidade_id: perfilUsuario?.unidade_id || '',
    observacoes: '',
    itens: [{ ...ITEM_VAZIO }],
  })

  useEffect(() => {
    if (isEdicao && aquisicao) {
      setForm({
        numero_demanda: aquisicao.numero_demanda || '',
        tipo:           aquisicao.tipo           || 'pequenas_compras',
        unidade_id:     aquisicao.unidade_id     || '',
        observacoes:    aquisicao.observacoes    || '',
        itens:          aquisicao.itens?.length ? aquisicao.itens : [{ ...ITEM_VAZIO }],
      })
    }
  }, [aquisicao])

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  const setItem = (idx, campo, valor) => {
    setForm(f => ({
      ...f,
      itens: f.itens.map((it, i) => i === idx ? { ...it, [campo]: valor } : it),
    }))
  }

  const adicionarItem = () => {
    setForm(f => ({ ...f, itens: [...f.itens, { ...ITEM_VAZIO }] }))
    setItemSel(form.itens.length)
  }

  const removerItem = (idx) => {
    if (form.itens.length <= 1) return
    setForm(f => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }))
    setItemSel(prev => Math.min(prev, form.itens.length - 2))
  }

  const uploadArquivo = async (idx, tipo, arquivo) => {
    const chave = `${idx}-${tipo}`
    setUploadando(chave)
    try {
      const ext  = arquivo.name.split('.').pop()
      const path = `aquisicoes/${Date.now()}-${tipo}.${ext}`
      const { error } = await supabase.storage.from('anexos').upload(path, arquivo, { upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('anexos').getPublicUrl(path)
      if (tipo === 'nota') {
        setItem(idx, 'nota_fiscal_url', urlData.publicUrl)
      } else {
        setForm(f => ({
          ...f,
          itens: f.itens.map((it, i) =>
            i === idx ? { ...it, fotos_urls: [...(it.fotos_urls || []), urlData.publicUrl] } : it
          ),
        }))
      }
    } catch (e) {
      alert(`Erro ao enviar arquivo: ${e.message}`)
    }
    setUploadando(null)
  }

  const removerFoto = (idxItem, idxFoto) => {
    setForm(f => ({
      ...f,
      itens: f.itens.map((it, i) =>
        i === idxItem
          ? { ...it, fotos_urls: it.fotos_urls.filter((_, j) => j !== idxFoto) }
          : it
      ),
    }))
  }

  const salvar = async (status = 'rascunho') => {
    if (!form.numero_demanda) { setErro('Informe o número da demanda.'); return }
    if (!form.itens[0]?.nome) { setErro('Informe pelo menos um item.'); return }
    setSalvando(true); setErro('')
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id
      const payload = {
        ...form,
        status,
        usuario_id: userId,
        updated_at: new Date().toISOString(),
      }
      if (isEdicao) {
        await supabase.from('aquisicoes').update(payload).eq('id', aquisicao.id)
      } else {
        await supabase.from('aquisicoes').insert(payload)
      }
      onSalvar()
    } catch (e) { setErro('Erro ao salvar: ' + e.message) }
    setSalvando(false)
  }

  const totalPacote = form.itens.reduce((s, it) => s + Number(it.valor || 0), 0)
  const item = form.itens[itemSel] || ITEM_VAZIO

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={styles.modal}>

        {/* Cabeçalho */}
        <div style={styles.cabecalho}>
          <div style={{ flex: 1 }}>
            <h2 style={styles.titulo}>{isEdicao ? 'Editar Aquisição' : 'Nova Aquisição'}</h2>
            <p style={styles.subtitulo}>
              {form.itens.length} item{form.itens.length !== 1 ? 'ns' : ''} · Total: <strong>R$ {fmtMoeda(totalPacote)}</strong>
            </p>
          </div>
          <button onClick={onFechar} style={styles.btnFechar}>✕</button>
        </div>

        {erro && <div style={styles.erro}>{erro}</div>}

        <div style={styles.corpo}>

          {/* ── Dados do pacote ── */}
          <div style={styles.secao}>
            <h3 style={styles.secaoTitulo}>Dados do Pacote</h3>
            <div style={styles.grid3}>
              <Campo label="Número da Demanda *">
                <input style={styles.input} value={form.numero_demanda}
                  onChange={e => set('numero_demanda', e.target.value)}
                  placeholder="DE-ASL2-POA3-XXX-2026-00XX" />
              </Campo>
              <Campo label="Tipo de Aquisição *">
                <select style={styles.input} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                  <option value="pequenas_compras">Pequenas Compras</option>
                  <option value="adiantamento_recursos">Adiantamento de Recursos</option>
                </select>
              </Campo>
              <Campo label="Unidade (UO)">
                <select style={styles.input} value={form.unidade_id} onChange={e => set('unidade_id', e.target.value)}>
                  <option value="">Selecione...</option>
                  {unidades.map(u => (
                    <option key={u.id} value={u.id}>{u.nome} — {u.instituicao}</option>
                  ))}
                </select>
              </Campo>
            </div>
            <Campo label="Observações gerais">
              <textarea style={{ ...styles.input, minHeight: '60px', resize: 'vertical' }}
                value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
                placeholder="Informações adicionais sobre o pacote..." />
            </Campo>
          </div>

          {/* ── Itens do pacote ── */}
          <div style={styles.secao}>
            <div style={styles.itensBarra}>
              <h3 style={styles.secaoTitulo}>Itens do Pacote</h3>
              <button onClick={adicionarItem} style={styles.btnAdicionarItem}>+ Adicionar Item</button>
            </div>

            {/* Seletor de itens */}
            <div style={styles.itensLista}>
              {form.itens.map((it, idx) => (
                <div key={idx} onClick={() => setItemSel(idx)}
                  style={{
                    ...styles.itemChip,
                    background: itemSel === idx ? '#1a4731' : '#f3f4f6',
                    color: itemSel === idx ? 'white' : '#374151',
                  }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.nome || `Item ${idx + 1}`}
                  </span>
                  {form.itens.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); removerItem(idx) }}
                      style={{ ...styles.btnRemoverItem, color: itemSel === idx ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Formulário do item selecionado */}
            <div style={styles.itemForm}>
              <div style={styles.grid3}>
                <Campo label="Nome do Produto / Item *">
                  <input style={styles.input} value={item.nome}
                    onChange={e => setItem(itemSel, 'nome', e.target.value)}
                    placeholder="Ex: Notebook Dell Inspiron" />
                </Campo>
                <Campo label="Valor (R$) *">
                  <input style={styles.input} type="number" step="0.01" value={item.valor}
                    onChange={e => setItem(itemSel, 'valor', e.target.value)}
                    placeholder="0,00" />
                </Campo>
                <Campo label="Fornecedor">
                  <input style={styles.input} value={item.fornecedor}
                    onChange={e => setItem(itemSel, 'fornecedor', e.target.value)}
                    placeholder="Nome da empresa ou pessoa" />
                </Campo>
              </div>

              {/* Nota Fiscal */}
              <div style={styles.uploadSecao}>
                <h4 style={styles.uploadTitulo}>📄 Nota Fiscal</h4>
                {item.nota_fiscal_url ? (
                  <div style={styles.arquivoAnexado}>
                    <a href={item.nota_fiscal_url} target="_blank" rel="noreferrer" style={styles.linkAnexo}>
                      ✅ Nota fiscal anexada — clique para ver
                    </a>
                    <button onClick={() => setItem(itemSel, 'nota_fiscal_url', '')}
                      style={styles.btnRemoverAnexo}>✕ Remover</button>
                  </div>
                ) : (
                  <>
                    <input ref={el => notaRefs.current[itemSel] = el} type="file"
                      accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                      onChange={e => e.target.files[0] && uploadArquivo(itemSel, 'nota', e.target.files[0])} />
                    <button onClick={() => notaRefs.current[itemSel]?.click()}
                      disabled={uploadando === `${itemSel}-nota`}
                      style={styles.btnUpload}>
                      {uploadando === `${itemSel}-nota` ? '⏳ Enviando...' : '📎 Anexar Nota Fiscal (PDF ou imagem)'}
                    </button>
                  </>
                )}
              </div>

              {/* Fotos dos produtos */}
              <div style={styles.uploadSecao}>
                <h4 style={styles.uploadTitulo}>📷 Fotos do Produto</h4>
                <div style={styles.fotosGrid}>
                  {(item.fotos_urls || []).map((url, fi) => (
                    <div key={fi} style={styles.fotoCard}>
                      <img src={url} alt={`Foto ${fi + 1}`} style={styles.fotoImg} />
                      <button onClick={() => removerFoto(itemSel, fi)} style={styles.btnRemoverFoto}>✕</button>
                    </div>
                  ))}
                  <div>
                    <input ref={el => fotosRefs.current[itemSel] = el} type="file"
                      accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                      onChange={e => e.target.files[0] && uploadArquivo(itemSel, 'foto', e.target.files[0])} />
                    <button onClick={() => fotosRefs.current[itemSel]?.click()}
                      disabled={uploadando === `${itemSel}-foto`}
                      style={styles.btnFotoAdd}>
                      {uploadando === `${itemSel}-foto` ? '⏳' : '+ Foto'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Subtotal do item */}
              {item.valor > 0 && (
                <p style={styles.subtotal}>
                  Subtotal deste item: <strong>R$ {fmtMoeda(item.valor)}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Totalizador */}
          <div style={styles.totalBox}>
            <div style={styles.totalLinha}>
              <span style={{ color: '#6b7280' }}>{form.itens.length} item{form.itens.length !== 1 ? 'ns' : ''}</span>
              <span style={styles.totalValor}>R$ {fmtMoeda(totalPacote)}</span>
            </div>
            <div style={styles.tipoBadge}>
              {form.tipo === 'adiantamento_recursos' ? '💳 Adiantamento de Recursos' : '🛒 Pequenas Compras'}
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div style={styles.rodape}>
          <button onClick={onFechar} style={styles.btnCancelar}>Cancelar</button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => salvar('rascunho')} disabled={salvando} style={styles.btnRascunho}>
              {salvando ? 'Salvando...' : '💾 Salvar Rascunho'}
            </button>
            <button onClick={() => salvar('enviado')} disabled={salvando} style={styles.btnEnviar}>
              {salvando ? 'Enviando...' : '📤 Enviar para aprovação'}
            </button>
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
  modal: { background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', marginTop: '8px' },
  cabecalho: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '24px 28px 16px', borderBottom: '1px solid #e5e7eb' },
  titulo: { fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' },
  subtitulo: { fontSize: '13px', color: '#6b7280', margin: 0 },
  btnFechar: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#9ca3af', padding: '4px' },
  erro: { margin: '0 28px 0', background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' },
  corpo: { padding: '20px 28px', overflowY: 'auto', maxHeight: '65vh', display: 'flex', flexDirection: 'column', gap: '20px' },
  secao: { display: 'flex', flexDirection: 'column', gap: '14px' },
  secaoTitulo: { fontSize: '15px', fontWeight: '700', color: '#111827', margin: 0 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '14px', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  itensBarra: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  btnAdicionarItem: { padding: '7px 14px', borderRadius: '8px', border: '1.5px solid #1a4731', background: 'white', color: '#1a4731', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  itensLista: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  itemChip: { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', maxWidth: '180px', transition: 'all 0.15s' },
  btnRemoverItem: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', padding: '0', lineHeight: 1, flexShrink: 0 },
  itemForm: { background: '#f9fafb', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #e5e7eb' },
  uploadSecao: { display: 'flex', flexDirection: 'column', gap: '8px' },
  uploadTitulo: { fontSize: '13px', fontWeight: '600', color: '#374151', margin: 0 },
  arquivoAnexado: { display: 'flex', alignItems: 'center', gap: '12px' },
  linkAnexo: { color: '#1a4731', fontSize: '13px', fontWeight: '600', textDecoration: 'none' },
  btnRemoverAnexo: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  btnUpload: { padding: '9px 16px', borderRadius: '8px', border: '1.5px dashed #d1d5db', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#6b7280', textAlign: 'left' },
  fotosGrid: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  fotoCard: { position: 'relative', width: '80px', height: '80px' },
  fotoImg: { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' },
  btnRemoverFoto: { position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  btnFotoAdd: { width: '80px', height: '80px', borderRadius: '8px', border: '1.5px dashed #d1d5db', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#6b7280', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' },
  subtotal: { fontSize: '13px', color: '#374151', margin: 0, textAlign: 'right' },
  totalBox: { background: '#f0fdf4', borderRadius: '10px', padding: '14px 18px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  totalLinha: { display: 'flex', flexDirection: 'column', gap: '2px' },
  totalValor: { fontSize: '22px', fontWeight: '700', color: '#1a4731' },
  tipoBadge: { fontSize: '13px', fontWeight: '600', color: '#374151', background: 'white', padding: '6px 14px', borderRadius: '20px', border: '1px solid #d1d5db' },
  rodape: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 28px', borderTop: '1px solid #e5e7eb' },
  btnCancelar: { padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '14px' },
  btnRascunho: { padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },
  btnEnviar: { padding: '9px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #1a4731, #2d7a4f)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
}
