import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { gerarDocumentoWord, calcularTotais, formatarMoeda } from '../lib/gerarDocumento'

// ── Autocomplete de nome do beneficiário ────────────────────────────────────
function AutocompleteNome({ value, onChange, onSelect, inputStyle }) {
  const [sugestoes, setSugestoes] = useState([])
  const [aberto, setAberto] = useState(false)
  const timerRef = useRef(null)

  const handleChange = (e) => {
    const val = e.target.value
    onChange(val)
    clearTimeout(timerRef.current)
    if (val.length >= 2) {
      timerRef.current = setTimeout(async () => {
        const { data } = await supabase
          .from('beneficiarios_cadastrados')
          .select('*')
          .ilike('nome_completo', `%${val}%`)
          .limit(6)
        setSugestoes(data || [])
        setAberto((data || []).length > 0)
      }, 300)
    } else {
      setSugestoes([])
      setAberto(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        value={value}
        onChange={handleChange}
        onFocus={() => sugestoes.length > 0 && setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 180)}
        placeholder="Digite para buscar cadastros anteriores..."
        autoComplete="off"
      />
      {aberto && (
        <div style={estilosAC.caixa}>
          {sugestoes.map(b => (
            <div key={b.id} onMouseDown={() => { onSelect(b); setAberto(false) }}
              style={estilosAC.item}>
              <span style={estilosAC.nome}>{b.nome_completo}</span>
              <span style={estilosAC.info}>{b.cpf ? `CPF: ${b.cpf}` : 'Sem CPF'}{b.banco ? ` · ${b.banco}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const estilosAC = {
  caixa: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
    background: 'white', border: '1.5px solid #1a4731', borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginTop: '3px', overflow: 'hidden',
  },
  item: {
    padding: '10px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column',
    gap: '2px', borderBottom: '1px solid #f3f4f6', transition: 'background 0.1s',
  },
  nome: { fontSize: '14px', fontWeight: '600', color: '#111827' },
  info: { fontSize: '12px', color: '#6b7280' },
}

const BANCOS_BR = [
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '041', nome: 'Banrisul' },
  { codigo: '047', nome: 'Banese' },
  { codigo: '070', nome: 'BRB' },
  { codigo: '077', nome: 'Inter' },
  { codigo: '085', nome: 'Via Credi' },
  { codigo: '097', nome: 'Credisis' },
  { codigo: '099', nome: 'Uniprime' },
  { codigo: '104', nome: 'Caixa Econômica Federal' },
  { codigo: '197', nome: 'Stone' },
  { codigo: '208', nome: 'BTG Pactual' },
  { codigo: '212', nome: 'Banco Original' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '260', nome: 'Nubank' },
  { codigo: '290', nome: 'PagBank' },
  { codigo: '323', nome: 'Mercado Pago' },
  { codigo: '336', nome: 'C6 Bank' },
  { codigo: '341', nome: 'Itaú Unibanco' },
  { codigo: '380', nome: 'PicPay' },
  { codigo: '422', nome: 'Safra' },
  { codigo: '655', nome: 'Votorantim' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '756', nome: 'Sicoob' },
  { codigo: 'outro', nome: 'Outro' },
]

const DIARIAS_LISTA = [
  { key: 'diaria_intl',              label: 'Diária Internacional',        valor: 400, moeda: 'US$' },
  { key: 'meia_diaria_intl',         label: 'Meia Diária Internacional',   valor: 200, moeda: 'US$' },
  { key: 'diaria_capital',           label: 'Diária Capital',              valor: 450, moeda: 'R$'  },
  { key: 'meia_diaria_capital',      label: 'Meia Diária Capital',         valor: 225, moeda: 'R$'  },
  { key: 'diaria_cidade',            label: 'Diária Cidade',               valor: 300, moeda: 'R$'  },
  { key: 'meia_diaria_cidade',       label: 'Meia Diária Cidade',          valor: 150, moeda: 'R$'  },
  { key: 'diaria_campo',             label: 'Diária de Campo',             valor: 300, moeda: 'R$'  },
  { key: 'meia_diaria_campo',        label: 'Meia Diária de Campo',        valor: 150, moeda: 'R$'  },
  { key: 'meia_diaria_deslocamento', label: 'Meia Diária de Deslocamento', valor: 225, moeda: 'R$', tipo: 'toggle' },
  { key: 'meia_viagem',              label: 'Meia Viagem sem Pernoite',    valor: 225, moeda: 'R$'  },
]

const VIAJANTE_VAZIO = {
  nome_completo: '', cpf: '', email: '', telefone: '', data_nascimento: '',
  endereco: '', cep: '', complemento_bairro: '', cidade_estado: '',
  banco: '', codigo_banco: '', agencia_numero: '', agencia_digito: '',
  conta_numero: '', conta_digito: '',
}

function diasEntreDatas(de, ate) {
  if (!de || !ate) return 0
  const diff = new Date(ate) - new Date(de)
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)) + 1)
}

export default function FormPassagens({ solicitacao, perfilUsuario, onVoltar, onSalvar }) {
  const isEdicao = !!solicitacao
  const [aba, setAba] = useState(0)
  const [viajanteSel, setViajanteSel] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [buscandoDemanda, setBuscandoDemanda] = useState(false)

  const [form, setForm] = useState({
    // Viajantes (lista de beneficiários)
    beneficiarios: [{ ...VIAJANTE_VAZIO }],
    // Projeto
    numero_demanda: '', vigencia_poa: '2025-26', linhas_poa: '', sei: '',
    componente: '', proc_numero: '', unidade_solicitante: '', tem_passagem: 'nao',
    justificativa: '',
    // Passagem aérea
    passagem_origem_1: '', passagem_destino_1: '',
    passagem_ida_data: '', passagem_ida_hora: '',
    passagem_volta_data: '', passagem_volta_hora: '',
    passagem_valor: '', passagem_bagagem: 'sem despacho de bagagem',
    // Transporte
    transporte_origem: '', transporte_destino: '',
    transporte_partida_data: '', transporte_chegada_data: '',
    transporte_tipo: 'Veículo Oficial', transporte_valor: '',
    // Hospedagem
    hospedagem_local: '', hospedagem_entrada: '', hospedagem_saida: '',
    hospedagem_tipo: 'Café da manhã', hospedagem_valor: '',
    // Diárias
    diarias: { meia_diaria_deslocamento: 'nao' },
  })

  useEffect(() => {
    if (isEdicao && solicitacao.dados) {
      const d = solicitacao.dados
      // Compatibilidade: solicitações antigas têm campos planos, não array
      if (d.beneficiarios) {
        setForm(prev => ({ ...prev, ...d }))
      } else {
        const { nome_completo, cpf, email, telefone, data_nascimento,
          endereco, cep, complemento_bairro, cidade_estado,
          banco, codigo_banco, agencia_numero, agencia_digito,
          conta_numero, conta_digito, ...resto } = d
        setForm(prev => ({
          ...prev, ...resto,
          beneficiarios: [{ nome_completo, cpf, email, telefone, data_nascimento,
            endereco, cep, complemento_bairro, cidade_estado,
            banco, codigo_banco, agencia_numero, agencia_digito,
            conta_numero, conta_digito }],
        }))
      }
    } else if (perfilUsuario) {
      setForm(prev => ({
        ...prev,
        unidade_solicitante: perfilUsuario.unidade?.nome || '',
        beneficiarios: [{
          nome_completo:      perfilUsuario.nome_completo  || '',
          email:              perfilUsuario.email          || '',
          telefone:           perfilUsuario.telefone       || '',
          banco:              perfilUsuario.banco          || '',
          codigo_banco:       perfilUsuario.codigo_banco   || '',
          agencia_numero:     perfilUsuario.agencia_numero || '',
          agencia_digito:     perfilUsuario.agencia_digito || '',
          conta_numero:       perfilUsuario.conta_numero   || '',
          conta_digito:       perfilUsuario.conta_digito   || '',
          cpf: '', data_nascimento: '', endereco: '', cep: '',
          complemento_bairro: '', cidade_estado: '',
        }],
      }))
    }
  }, [isEdicao, solicitacao, perfilUsuario])

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  const setViajante = (idx, campo, valor) => {
    setForm(f => {
      const beneficiarios = f.beneficiarios.map((b, i) =>
        i === idx ? { ...b, [campo]: valor } : b
      )
      return { ...f, beneficiarios }
    })
  }

  const setBancoViajante = (idx, nomeBanco) => {
    const banco = BANCOS_BR.find(b => b.nome === nomeBanco)
    setForm(f => {
      const beneficiarios = f.beneficiarios.map((b, i) =>
        i === idx ? {
          ...b, banco: nomeBanco,
          codigo_banco: banco && banco.codigo !== 'outro' ? banco.codigo : b.codigo_banco,
        } : b
      )
      return { ...f, beneficiarios }
    })
  }

  const adicionarViajante = () => {
    setForm(f => ({ ...f, beneficiarios: [...f.beneficiarios, { ...VIAJANTE_VAZIO }] }))
    setViajanteSel(form.beneficiarios.length)
  }

  const removerViajante = (idx) => {
    if (form.beneficiarios.length <= 1) return
    setForm(f => ({ ...f, beneficiarios: f.beneficiarios.filter((_, i) => i !== idx) }))
    setViajanteSel(prev => Math.min(prev, form.beneficiarios.length - 2))
  }

  const setDiariaRange = (key, campo, valor) => {
    setForm(f => {
      const diarias = { ...f.diarias, [`${key}_${campo}`]: valor }
      if (campo === 'de' || campo === 'ate') {
        const de  = campo === 'de'  ? valor : (diarias[`${key}_de`]  || '')
        const ate = campo === 'ate' ? valor : (diarias[`${key}_ate`] || '')
        const dias = diasEntreDatas(de, ate)
        if (dias > 0) diarias[`${key}_qtd`] = dias
      }
      return { ...f, diarias }
    })
  }

  const setDiariaToggle = (key, valor) => {
    setForm(f => ({ ...f, diarias: { ...f.diarias, [key]: valor } }))
  }

  const buscarCep = useCallback(async (cep, idx) => {
    const cepLimpo = cep.replace(/\D/g, '')
    if (cepLimpo.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setForm(f => {
          const beneficiarios = f.beneficiarios.map((b, i) =>
            i === idx ? {
              ...b,
              endereco:           data.logradouro || b.endereco,
              complemento_bairro: data.bairro     || b.complemento_bairro,
              cidade_estado:      `${data.localidade} - ${data.uf}`,
            } : b
          )
          return { ...f, beneficiarios }
        })
      }
    } catch {}
    setBuscandoCep(false)
  }, [])

  const buscarDemanda = useCallback(async (id) => {
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
  }, [])

  // Salva/atualiza cada beneficiário no banco para autocomplete futuro
  const upsertBeneficiarios = async () => {
    for (const b of form.beneficiarios) {
      if (!b.nome_completo) continue
      const dados = {
        nome_completo: b.nome_completo,
        cpf: b.cpf || null,
        email: b.email || null,
        telefone: b.telefone || null,
        data_nascimento: b.data_nascimento || null,
        endereco: b.endereco || null,
        cep: b.cep || null,
        complemento_bairro: b.complemento_bairro || null,
        cidade_estado: b.cidade_estado || null,
        banco: b.banco || null,
        codigo_banco: b.codigo_banco || null,
        agencia_numero: b.agencia_numero || null,
        agencia_digito: b.agencia_digito || null,
        conta_numero: b.conta_numero || null,
        conta_digito: b.conta_digito || null,
        updated_at: new Date().toISOString(),
      }
      if (b.cpf) {
        await supabase.from('beneficiarios_cadastrados')
          .upsert(dados, { onConflict: 'cpf' })
      } else {
        // Sem CPF: tenta atualizar por nome ou inserir novo
        const { data: ex } = await supabase
          .from('beneficiarios_cadastrados')
          .select('id').ilike('nome_completo', b.nome_completo).limit(1).maybeSingle()
        if (ex) {
          await supabase.from('beneficiarios_cadastrados').update(dados).eq('id', ex.id)
        } else {
          await supabase.from('beneficiarios_cadastrados').insert(dados)
        }
      }
    }
  }

  const salvar = async (status = 'rascunho') => {
    setSalvando(true); setErro('')
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id
      const payload = { usuario_id: userId, dados: form, status, updated_at: new Date().toISOString() }
      if (isEdicao) {
        await supabase.from('passagens_diarias').update(payload).eq('id', solicitacao.id)
      } else {
        await supabase.from('passagens_diarias').insert(payload)
      }
      await upsertBeneficiarios()
      onSalvar()
    } catch { setErro('Erro ao salvar. Tente novamente.') }
    setSalvando(false)
  }

  const gerarDoc = async () => {
    setGerando(true); setErro('')
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id
      const payload = { usuario_id: userId, dados: form, status: 'enviado', updated_at: new Date().toISOString() }
      if (isEdicao) {
        await supabase.from('passagens_diarias').update(payload).eq('id', solicitacao.id)
      } else {
        const { data: inserted } = await supabase.from('passagens_diarias').insert(payload).select('id').single()
        // Notificar admin
        if (inserted) {
          await supabase.from('notificacoes').insert({
            tipo: 'nova_solicitacao',
            referencia_id: inserted.id,
            mensagem: `Nova solicitação de ${form.beneficiarios[0]?.nome_completo || 'viajante'} — ${form.beneficiarios.length} viajante(s)`,
          })
        }
      }
      await upsertBeneficiarios()
      // Gerar um Word por viajante
      for (const beneficiario of form.beneficiarios) {
        await gerarDocumentoWord({ ...form, ...beneficiario })
      }
      onSalvar()
    } catch (e) { setErro(`Erro ao gerar documento: ${e.message}`) }
    setGerando(false)
  }

  const totalDiarias = calcularTotais(form.diarias || {})
  const totalGeral = totalDiarias + Number(form.passagem_valor || 0) + Number(form.transporte_valor || 0) + Number(form.hospedagem_valor || 0)

  const abas = [
    'Viajantes', 'Projeto',
    ...(form.tem_passagem === 'sim' ? ['Passagem Aérea'] : []),
    'Transporte',
    ...(form.tem_passagem === 'sim' ? ['Hospedagem'] : []),
    'Diárias',
  ]
  const v = form.beneficiarios[viajanteSel] || VIAJANTE_VAZIO

  return (
    <div>
      <div style={styles.cabecalho}>
        <button onClick={onVoltar} style={styles.btnVoltar}>← Voltar</button>
        <h2 style={styles.titulo}>{isEdicao ? 'Editar Solicitação' : 'Nova Solicitação'}</h2>
        <div style={styles.acoesHeader}>
          <button onClick={() => salvar('rascunho')} disabled={salvando} style={styles.btnRascunho}>
            {salvando ? 'Salvando...' : '💾 Salvar Rascunho'}
          </button>
          <button onClick={gerarDoc} disabled={gerando} style={styles.btnGerar}>
            {gerando ? 'Gerando...' : '📄 Gerar Documento(s) Word'}
          </button>
        </div>
      </div>

      {erro && <div style={styles.erro}>{erro}</div>}

      <div style={styles.abas}>
        {abas.map((a, i) => (
          <button key={i} onClick={() => setAba(i)} style={{
            ...styles.aba,
            borderBottom: aba === i ? '3px solid #1a4731' : '3px solid transparent',
            color: aba === i ? '#1a4731' : '#6b7280',
            fontWeight: aba === i ? '700' : '400',
          }}>{a}</button>
        ))}
      </div>

      <div style={styles.card}>

        {/* ── ABA: Viajantes ─────────────────────────────────────────────────── */}
        {abas[aba] === 'Viajantes' && (
          <div style={styles.secao}>
            {/* Lista de viajantes */}
            <div style={styles.viajantesBarra}>
              <span style={styles.viajantesTitulo}>
                {form.beneficiarios.length} viajante{form.beneficiarios.length > 1 ? 's' : ''} nesta solicitação
              </span>
              <button onClick={adicionarViajante} style={styles.btnAdicionarViajante}>
                + Adicionar Viajante
              </button>
            </div>

            <div style={styles.viajantesLista}>
              {form.beneficiarios.map((b, idx) => (
                <div key={idx} onClick={() => setViajanteSel(idx)}
                  style={{
                    ...styles.viajanteCard,
                    border: viajanteSel === idx ? '2px solid #1a4731' : '2px solid #e5e7eb',
                    background: viajanteSel === idx ? '#f0fdf4' : '#fff',
                  }}>
                  <div style={styles.viajanteAvatar}>
                    {(b.nome_completo || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={styles.viajanteNome}>{b.nome_completo || 'Sem nome'}</p>
                    <p style={styles.viajanteEmail}>{b.email || '—'}</p>
                  </div>
                  {form.beneficiarios.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); removerViajante(idx) }}
                      style={styles.btnRemoverViajante} title="Remover viajante">✕</button>
                  )}
                </div>
              ))}
            </div>

            <hr style={styles.hr} />
            <h3 style={styles.subtituloSecao}>
              Dados de: {v.nome_completo || `Viajante ${viajanteSel + 1}`}
            </h3>
            <p style={styles.dica}>💡 Dados pré-preenchidos do cadastro. Verifique e ajuste se necessário.</p>

            <div style={styles.grid2}>
              <Campo label="Nome Completo *">
                <AutocompleteNome
                  value={v.nome_completo}
                  inputStyle={styles.input}
                  onChange={val => setViajante(viajanteSel, 'nome_completo', val)}
                  onSelect={b => {
                    // Preenche todos os campos do beneficiário com os dados salvos
                    const { id: _id, created_at: _c, updated_at: _u, ...campos } = b
                    setForm(f => ({
                      ...f,
                      beneficiarios: f.beneficiarios.map((ben, i) =>
                        i === viajanteSel ? { ...ben, ...campos } : ben
                      ),
                    }))
                  }}
                />
              </Campo>
              <Campo label="CPF">
                <input style={styles.input} value={v.cpf}
                  onChange={e => setViajante(viajanteSel, 'cpf', e.target.value)}
                  placeholder="XX.XXX.XXX-XX" />
              </Campo>
              <Campo label="E-mail">
                <input style={styles.input} value={v.email}
                  onChange={e => setViajante(viajanteSel, 'email', e.target.value)} />
              </Campo>
              <Campo label="Telefone">
                <input style={styles.input} value={v.telefone}
                  onChange={e => setViajante(viajanteSel, 'telefone', e.target.value)}
                  placeholder="(XX) X XXXX-XXXX" />
              </Campo>
              <Campo label="Data de Nascimento">
                <input style={styles.input} type="date" value={v.data_nascimento}
                  onChange={e => setViajante(viajanteSel, 'data_nascimento', e.target.value)} />
              </Campo>
              <Campo label={buscandoCep ? 'CEP  🔄 Buscando...' : 'CEP'}>
                <input style={styles.input} value={v.cep}
                  onChange={e => setViajante(viajanteSel, 'cep', e.target.value)}
                  onBlur={e => buscarCep(e.target.value, viajanteSel)}
                  placeholder="XXXXX-XXX" />
              </Campo>
              <Campo label="Endereço Completo">
                <input style={styles.input} value={v.endereco}
                  onChange={e => setViajante(viajanteSel, 'endereco', e.target.value)} />
              </Campo>
              <Campo label="Complemento e Bairro">
                <input style={styles.input} value={v.complemento_bairro}
                  onChange={e => setViajante(viajanteSel, 'complemento_bairro', e.target.value)} />
              </Campo>
              <Campo label="Cidade e Estado">
                <input style={styles.input} value={v.cidade_estado}
                  onChange={e => setViajante(viajanteSel, 'cidade_estado', e.target.value)}
                  placeholder="Ex: Rio Branco - AC" />
              </Campo>
            </div>

            <hr style={styles.hr} />
            <h3 style={styles.subtituloSecao}>Dados Bancários</h3>

            <div style={styles.grid2}>
              <Campo label="Banco *">
                <select style={styles.input} value={v.banco}
                  onChange={e => setBancoViajante(viajanteSel, e.target.value)}>
                  <option value="">Selecione o banco...</option>
                  {BANCOS_BR.map(b => (
                    <option key={b.codigo} value={b.nome}>{b.nome}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Código COMPE (preenchido automaticamente)">
                <input style={{ ...styles.input, background: '#f9fafb' }}
                  value={v.codigo_banco}
                  onChange={e => setViajante(viajanteSel, 'codigo_banco', e.target.value)}
                  placeholder="Ex: 001" />
              </Campo>
            </div>
            <div style={styles.grid2}>
              <Campo label="Agência">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input style={{ ...styles.input, flex: 3 }} value={v.agencia_numero}
                    onChange={e => setViajante(viajanteSel, 'agencia_numero', e.target.value)}
                    placeholder="Número" />
                  <span style={{ color: '#6b7280', fontWeight: '600', fontSize: '16px' }}>-</span>
                  <input style={{ ...styles.input, flex: 1, textAlign: 'center' }} value={v.agencia_digito}
                    onChange={e => setViajante(viajanteSel, 'agencia_digito', e.target.value)}
                    placeholder="D" maxLength={2} />
                </div>
              </Campo>
              <Campo label="Conta Corrente">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input style={{ ...styles.input, flex: 3 }} value={v.conta_numero}
                    onChange={e => setViajante(viajanteSel, 'conta_numero', e.target.value)}
                    placeholder="Número" />
                  <span style={{ color: '#6b7280', fontWeight: '600', fontSize: '16px' }}>-</span>
                  <input style={{ ...styles.input, flex: 1, textAlign: 'center' }} value={v.conta_digito}
                    onChange={e => setViajante(viajanteSel, 'conta_digito', e.target.value)}
                    placeholder="D" maxLength={2} />
                </div>
              </Campo>
            </div>
          </div>
        )}

        {/* ── ABA: Projeto ─────────────────────────────────────────────────── */}
        {abas[aba] === 'Projeto' && (
          <div style={styles.secao}>
            <div style={styles.grid2}>
              <Campo label={buscandoDemanda ? 'Número da Demanda  🔄 Buscando...' : 'Número da Demanda *'}>
                <input style={styles.input} value={form.numero_demanda}
                  onChange={e => set('numero_demanda', e.target.value)}
                  onBlur={e => buscarDemanda(e.target.value)}
                  placeholder="DE-ASL2-POA3-XXX-2026-00XX" />
              </Campo>
              <Campo label="Vigência do POA">
                <input style={{ ...styles.input, background: '#f9fafb', color: '#6b7280' }}
                  value={form.vigencia_poa} readOnly />
              </Campo>
              <Campo label="Linha(s) do POA">
                <input style={styles.input} value={form.linhas_poa}
                  onChange={e => set('linhas_poa', e.target.value)}
                  placeholder="Preenchido automaticamente pelo número da demanda" />
              </Campo>
              <Campo label="Componente">
                <input style={styles.input} value={form.componente}
                  onChange={e => set('componente', e.target.value)} placeholder="Preenchido automaticamente" />
              </Campo>
              <Campo label="SEI">
                <input style={styles.input} value={form.sei}
                  onChange={e => set('sei', e.target.value)} placeholder="Número do processo SEI" />
              </Campo>
              <Campo label="Processo">
                <input style={styles.input} value={form.proc_numero}
                  onChange={e => set('proc_numero', e.target.value)} placeholder="Número do processo administrativo" />
              </Campo>
              <Campo label="Unidade do Solicitante">
                <select style={styles.input} value={form.unidade_solicitante}
                  onChange={e => set('unidade_solicitante', e.target.value)}>
                  <option value="">Selecione a unidade...</option>
                  <optgroup label="SEMA AC">
                    <option>SEMA AC/DEBIO</option>
                    <option>SEMA AC/DEUC</option>
                    <option>SEMA AC/FUNTAC</option>
                    <option>SEMA AC/DESIL</option>
                    <option>SEMA AC/CIGMA</option>
                  </optgroup>
                  <optgroup label="ICMBIO">
                    <option>ICMBIO/NGI NOVO AIRAO</option>
                    <option>ICMBIO/NGI TEFÉ</option>
                    <option>ICMBIO/CBC</option>
                    <option>ICMBIO/DSAM</option>
                    <option>ICMBIO/COMAG</option>
                  </optgroup>
                </select>
              </Campo>
            </div>

            <hr style={styles.hr} />

            <Campo label="A viagem inclui passagem aérea?">
              <div style={styles.toggle}>
                <button onClick={() => set('tem_passagem', 'sim')}
                  style={{ ...styles.toggleBtn, ...(form.tem_passagem === 'sim' ? styles.toggleAtivo : {}) }}>
                  ✈️ Sim, tem passagem
                </button>
                <button onClick={() => set('tem_passagem', 'nao')}
                  style={{ ...styles.toggleBtn, ...(form.tem_passagem === 'nao' ? styles.toggleAtivo : {}) }}>
                  🚗 Não, só terrestre/fluvial
                </button>
              </div>
            </Campo>

            <hr style={styles.hr} />
            <Campo label="Justificativa da Viagem *">
              <textarea style={{ ...styles.input, minHeight: '140px', resize: 'vertical' }}
                value={form.justificativa} onChange={e => set('justificativa', e.target.value)}
                placeholder="Descreva o motivo da viagem e justificativa do gasto em relação ao ASL2..." />
            </Campo>
          </div>
        )}

        {/* ── ABA: Passagem Aérea ───────────────────────────────────────────── */}
        {abas[aba] === 'Passagem Aérea' && (
          <div style={styles.secao}>
            <h3 style={styles.subtituloSecao}>Trecho de Ida</h3>
            <div style={styles.grid2}>
              <Campo label="Origem"><input style={styles.input} value={form.passagem_origem_1} onChange={e => set('passagem_origem_1', e.target.value)} placeholder="Cidade de origem" /></Campo>
              <Campo label="Destino"><input style={styles.input} value={form.passagem_destino_1} onChange={e => set('passagem_destino_1', e.target.value)} placeholder="Cidade de destino" /></Campo>
              <Campo label="Data da Ida"><input style={styles.input} type="date" value={form.passagem_ida_data} onChange={e => set('passagem_ida_data', e.target.value)} /></Campo>
              <Campo label="Hora / Voo (Ida)"><input style={styles.input} value={form.passagem_ida_hora} onChange={e => set('passagem_ida_hora', e.target.value)} placeholder="Ex: 3807/16h50" /></Campo>
              <Campo label="Data da Volta"><input style={styles.input} type="date" value={form.passagem_volta_data} onChange={e => set('passagem_volta_data', e.target.value)} /></Campo>
              <Campo label="Hora / Voo (Volta)"><input style={styles.input} value={form.passagem_volta_hora} onChange={e => set('passagem_volta_hora', e.target.value)} placeholder="Ex: 3806/21h05" /></Campo>
              <Campo label="Valor Total (R$)"><input style={styles.input} type="number" value={form.passagem_valor} onChange={e => set('passagem_valor', e.target.value)} placeholder="0,00" /></Campo>
              <Campo label="Bagagem">
                <select style={styles.input} value={form.passagem_bagagem} onChange={e => set('passagem_bagagem', e.target.value)}>
                  <option value="com despacho de bagagem">Com despacho de bagagem</option>
                  <option value="sem despacho de bagagem">Sem despacho de bagagem</option>
                </select>
              </Campo>
            </div>
          </div>
        )}

        {/* ── ABA: Transporte ───────────────────────────────────────────────── */}
        {abas[aba] === 'Transporte' && (
          <div style={styles.secao}>
            <div style={styles.grid2}>
              <Campo label="Origem"><input style={styles.input} value={form.transporte_origem} onChange={e => set('transporte_origem', e.target.value)} /></Campo>
              <Campo label="Destino"><input style={styles.input} value={form.transporte_destino} onChange={e => set('transporte_destino', e.target.value)} /></Campo>
              <Campo label="Data de Partida"><input style={styles.input} type="date" value={form.transporte_partida_data} onChange={e => set('transporte_partida_data', e.target.value)} /></Campo>
              <Campo label="Data de Chegada"><input style={styles.input} type="date" value={form.transporte_chegada_data} onChange={e => set('transporte_chegada_data', e.target.value)} /></Campo>
              <Campo label="Tipo de Transporte">
                <select style={styles.input} value={form.transporte_tipo} onChange={e => set('transporte_tipo', e.target.value)}>
                  <option>Veículo Oficial</option>
                  <option>Veículo Particular</option>
                  <option>Rodoviário</option>
                  <option>Barco Particular</option>
                  <option>Voadeira</option>
                </select>
              </Campo>
              <Campo label="Valor Total (R$)"><input style={styles.input} type="number" value={form.transporte_valor} onChange={e => set('transporte_valor', e.target.value)} placeholder="0,00" /></Campo>
            </div>
          </div>
        )}

        {/* ── ABA: Hospedagem ───────────────────────────────────────────────── */}
        {abas[aba] === 'Hospedagem' && (
          <div style={styles.secao}>
            <div style={styles.grid2}>
              <Campo label="Local / Hotel"><input style={styles.input} value={form.hospedagem_local} onChange={e => set('hospedagem_local', e.target.value)} /></Campo>
              <Campo label="Tipo de Hospedagem">
                <select style={styles.input} value={form.hospedagem_tipo} onChange={e => set('hospedagem_tipo', e.target.value)}>
                  <option>Café da manhã</option><option>Almoço</option><option>Pensão completa</option>
                </select>
              </Campo>
              <Campo label="Data de Entrada"><input style={styles.input} type="date" value={form.hospedagem_entrada} onChange={e => set('hospedagem_entrada', e.target.value)} /></Campo>
              <Campo label="Data de Saída"><input style={styles.input} type="date" value={form.hospedagem_saida} onChange={e => set('hospedagem_saida', e.target.value)} /></Campo>
              <Campo label="Valor Total (R$)"><input style={styles.input} type="number" value={form.hospedagem_valor} onChange={e => set('hospedagem_valor', e.target.value)} placeholder="0,00" /></Campo>
            </div>
          </div>
        )}

        {/* ── ABA: Diárias ──────────────────────────────────────────────────── */}
        {abas[aba] === 'Diárias' && (
          <div style={styles.secao}>
            <p style={styles.dica}>📅 Selecione o período de cada tipo de diária. A quantidade é calculada automaticamente.</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={styles.thTabela}>Tipo de Diária</th>
                  <th style={styles.thTabela}>Data Início</th>
                  <th style={styles.thTabela}>Data Fim</th>
                  <th style={styles.thTabela}>Quantidade</th>
                  <th style={styles.thTabela}>Valor Unit.</th>
                  <th style={styles.thTabela}>Total</th>
                </tr>
              </thead>
              <tbody>
                {DIARIAS_LISTA.map((d, i) => {
                  const isToggle = d.tipo === 'toggle'
                  const ativo = isToggle ? form.diarias?.[d.key] === 'sim' : false
                  const de  = form.diarias?.[`${d.key}_de`]  || ''
                  const ate = form.diarias?.[`${d.key}_ate`] || ''
                  const qtd = isToggle ? (ativo ? 1 : 0) : Number(form.diarias?.[`${d.key}_qtd`] || 0)
                  const total = qtd * d.valor

                  return (
                    <tr key={d.key} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px 12px', fontSize: '14px', color: '#374151', minWidth: '200px' }}>{d.label}</td>

                      {isToggle ? (
                        <td colSpan={2} style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setDiariaToggle(d.key, 'sim')}
                              style={{ padding: '6px 18px', borderRadius: '6px', border: '1.5px solid', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: ativo ? '#1a4731' : 'white', color: ativo ? 'white' : '#374151', borderColor: ativo ? '#1a4731' : '#d1d5db' }}>
                              Sim
                            </button>
                            <button onClick={() => setDiariaToggle(d.key, 'nao')}
                              style={{ padding: '6px 18px', borderRadius: '6px', border: '1.5px solid', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: !ativo ? '#6b7280' : 'white', color: !ativo ? 'white' : '#374151', borderColor: !ativo ? '#6b7280' : '#d1d5db' }}>
                              Não
                            </button>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td style={{ padding: '8px' }}>
                            <input type="date" style={styles.inputData}
                              value={de} onChange={e => setDiariaRange(d.key, 'de', e.target.value)} />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input type="date" style={styles.inputData}
                              value={ate} onChange={e => setDiariaRange(d.key, 'ate', e.target.value)} />
                          </td>
                        </>
                      )}

                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', background: qtd > 0 ? '#dcfce7' : '#f3f4f6', color: qtd > 0 ? '#166534' : '#9ca3af', fontSize: '13px', fontWeight: '600' }}>
                          {isToggle ? (ativo ? 'Sim' : 'Não') : (qtd > 0 ? `${qtd} dia${qtd > 1 ? 's' : ''}` : '—')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#6b7280' }}>
                        {d.moeda} {d.valor.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '600', color: total > 0 ? '#166534' : '#9ca3af' }}>
                        {total > 0 ? `R$ ${formatarMoeda(total)}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={styles.resumo}>
              {form.tem_passagem === 'sim' && (
                <div style={styles.resumoLinha}><span>Passagem aérea</span><span>R$ {formatarMoeda(Number(form.passagem_valor || 0))}</span></div>
              )}
              <div style={styles.resumoLinha}><span>Transporte</span><span>R$ {formatarMoeda(Number(form.transporte_valor || 0))}</span></div>
              <div style={styles.resumoLinha}><span>Hospedagem</span><span>R$ {formatarMoeda(Number(form.hospedagem_valor || 0))}</span></div>
              <div style={styles.resumoLinha}><span>Diárias</span><span>R$ {formatarMoeda(totalDiarias)}</span></div>
              <div style={{ ...styles.resumoLinha, ...styles.resumoTotal }}>
                <span>TOTAL GERAL (por viajante)</span><span>R$ {formatarMoeda(totalGeral)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={styles.navegacao}>
        {aba > 0 && <button onClick={() => setAba(a => a - 1)} style={styles.btnNav}>← Anterior</button>}
        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
          {aba < abas.length - 1 && <button onClick={() => setAba(a => a + 1)} style={styles.btnNavPrimario}>Próximo →</button>}
          {aba === abas.length - 1 && (
            <button onClick={gerarDoc} disabled={gerando} style={styles.btnGerar}>
              {gerando ? 'Gerando...' : '📄 Gerar Documento(s) Word'}
            </button>
          )}
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
  cabecalho: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
  btnVoltar: { padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '14px' },
  titulo: { fontSize: '20px', fontWeight: '700', color: '#111827', margin: 0, flex: 1 },
  acoesHeader: { display: 'flex', gap: '10px' },
  btnRascunho: { padding: '9px 16px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },
  btnGerar: { padding: '9px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #1a4731, #2d7a4f)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  erro: { background: '#fef2f2', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' },
  abas: { display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '20px', overflowX: 'auto' },
  aba: { padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', transition: 'all 0.2s' },
  card: { background: '#fff', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '20px' },
  secao: { display: 'flex', flexDirection: 'column', gap: '16px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '14px', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  inputData: { padding: '7px 10px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '13px', outline: 'none', fontFamily: 'inherit', width: '140px' },
  hr: { border: 'none', borderTop: '1px solid #e5e7eb', margin: '4px 0' },
  subtituloSecao: { fontSize: '15px', fontWeight: '600', color: '#374151', margin: 0 },
  dica: { background: '#f0fdf4', color: '#166534', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', margin: 0 },
  toggle: { display: 'flex', gap: '10px' },
  toggleBtn: { flex: 1, padding: '12px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },
  toggleAtivo: { background: '#1a4731', color: 'white', borderColor: '#1a4731' },
  thTabela: { padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' },
  resumo: { background: '#f9fafb', borderRadius: '10px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' },
  resumoLinha: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#374151' },
  resumoTotal: { fontSize: '16px', fontWeight: '700', color: '#111827', borderTop: '2px solid #d1d5db', paddingTop: '8px', marginTop: '4px' },
  navegacao: { display: 'flex', justifyContent: 'space-between', gap: '12px' },
  btnNav: { padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '14px' },
  btnNavPrimario: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#1a4731', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  viajantesBarra: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  viajantesTitulo: { fontSize: '14px', fontWeight: '600', color: '#374151' },
  btnAdicionarViajante: { padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #1a4731', background: 'white', color: '#1a4731', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  viajantesLista: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  viajanteCard: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', minWidth: '180px', flex: '1 1 180px', maxWidth: '260px' },
  viajanteAvatar: { width: '36px', height: '36px', borderRadius: '50%', background: '#1a4731', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', flexShrink: 0 },
  viajanteNome: { fontSize: '13px', fontWeight: '600', color: '#111827', margin: '0 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  viajanteEmail: { fontSize: '12px', color: '#6b7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  btnRemoverViajante: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: '2px 4px', flexShrink: 0 },
}
