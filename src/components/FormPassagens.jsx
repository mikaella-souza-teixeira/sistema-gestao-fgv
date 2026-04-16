import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { gerarDocumentoWord, calcularTotais, formatarMoeda } from '../lib/gerarDocumento'

const VALORES = { diaria_intl: 400, meia_diaria_intl: 200, diaria_capital: 450, meia_diaria_capital: 225, diaria_cidade: 300, meia_diaria_cidade: 150, diaria_campo: 300, meia_diaria_campo: 150, meia_diaria_deslocamento: 225, meia_viagem: 225 }
const DIARIAS_LISTA = [
  { key: 'diaria_intl', label: 'Diária Internacional', valor: 400, moeda: 'US$' },
  { key: 'meia_diaria_intl', label: 'Meia Diária Internacional', valor: 200, moeda: 'US$' },
  { key: 'diaria_capital', label: 'Diária Capital', valor: 450, moeda: 'R$' },
  { key: 'meia_diaria_capital', label: 'Meia Diária Capital', valor: 225, moeda: 'R$' },
  { key: 'diaria_cidade', label: 'Diária Cidade', valor: 300, moeda: 'R$' },
  { key: 'meia_diaria_cidade', label: 'Meia Diária Cidade', valor: 150, moeda: 'R$' },
  { key: 'diaria_campo', label: 'Diária de Campo', valor: 300, moeda: 'R$' },
  { key: 'meia_diaria_campo', label: 'Meia Diária de Campo', valor: 150, moeda: 'R$' },
  { key: 'meia_diaria_deslocamento', label: 'Meia Diária de Deslocamento', valor: 225, moeda: 'R$' },
  { key: 'meia_viagem', label: 'Meia Viagem sem Pernoite', valor: 225, moeda: 'R$' },
]

export default function FormPassagens({ solicitacao, perfilUsuario, onVoltar, onSalvar }) {
  const isEdicao = !!solicitacao
  const [aba, setAba] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    // Beneficiário
    nome_completo: '', cpf: '', email: '', telefone: '',
    endereco: '', cep: '', data_nascimento: '', complemento_bairro: '', cidade_estado: '',
    // Banco
    banco: '', agencia: '', conta: '',
    // Projeto
    numero_demanda: '', vigencia_poa: '', linhas_poa: '', sei: '', componente: '',
    unidade_solicitante: '',
    // Justificativa
    justificativa: '',
    // Passagem
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
    diarias: {},
  })

  useEffect(() => {
    if (isEdicao && solicitacao.dados) {
      setForm(prev => ({ ...prev, ...solicitacao.dados }))
    } else if (perfilUsuario) {
      setForm(prev => ({
        ...prev,
        nome_completo: perfilUsuario.nome_completo || '',
        email: perfilUsuario.email || '',
        telefone: perfilUsuario.telefone || '',
        banco: perfilUsuario.banco || '',
        agencia: perfilUsuario.agencia || '',
        conta: perfilUsuario.conta || '',
        unidade_solicitante: perfilUsuario.unidade?.nome || '',
      }))
    }
  }, [isEdicao, solicitacao, perfilUsuario])

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))
  const setDiaria = (campo, valor) => setForm(f => ({ ...f, diarias: { ...f.diarias, [campo]: valor } }))

  const salvar = async (status = 'rascunho') => {
    setSalvando(true)
    setErro('')
    try {
      const payload = {
        usuario_id: (await supabase.auth.getUser()).data.user?.id,
        dados: form,
        status,
        updated_at: new Date().toISOString(),
      }
      if (isEdicao) {
        await supabase.from('passagens_diarias').update(payload).eq('id', solicitacao.id)
      } else {
        await supabase.from('passagens_diarias').insert(payload)
      }
      onSalvar()
    } catch (e) {
      setErro('Erro ao salvar. Tente novamente.')
    }
    setSalvando(false)
  }

  const gerarDoc = async () => {
    setGerando(true)
    setErro('')
    try {
      // Salva antes de gerar
      const userId = (await supabase.auth.getUser()).data.user?.id
      const payload = { usuario_id: userId, dados: form, status: 'enviado', updated_at: new Date().toISOString() }
      if (isEdicao) {
        await supabase.from('passagens_diarias').update(payload).eq('id', solicitacao.id)
      } else {
        await supabase.from('passagens_diarias').insert(payload)
      }
      await gerarDocumentoWord(form)
      onSalvar()
    } catch (e) {
      setErro(`Erro ao gerar documento: ${e.message}`)
    }
    setGerando(false)
  }

  const totalDiarias = calcularTotais(form.diarias || {})
  const totalGeral = totalDiarias + Number(form.passagem_valor || 0) + Number(form.transporte_valor || 0) + Number(form.hospedagem_valor || 0)

  const abas = ['Beneficiário', 'Projeto', 'Passagem Aérea', 'Transporte', 'Hospedagem', 'Diárias']

  return (
    <div>
      {/* Cabeçalho */}
      <div style={styles.cabecalho}>
        <button onClick={onVoltar} style={styles.btnVoltar}>← Voltar</button>
        <h2 style={styles.titulo}>{isEdicao ? 'Editar Solicitação' : 'Nova Solicitação'}</h2>
        <div style={styles.acoesHeader}>
          <button onClick={() => salvar('rascunho')} disabled={salvando} style={styles.btnRascunho}>
            {salvando ? 'Salvando...' : '💾 Salvar Rascunho'}
          </button>
          <button onClick={gerarDoc} disabled={gerando} style={styles.btnGerar}>
            {gerando ? 'Gerando...' : '📄 Gerar Documento Word'}
          </button>
        </div>
      </div>

      {erro && <div style={styles.erro}>{erro}</div>}

      {/* Abas */}
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

      {/* Conteúdo das abas */}
      <div style={styles.card}>

        {/* ABA 0 — Beneficiário */}
        {aba === 0 && (
          <div style={styles.secao}>
            <p style={styles.dica}>💡 Campos pré-preenchidos do seu cadastro. Verifique e ajuste se necessário.</p>
            <div style={styles.grid2}>
              <Campo label="Nome Completo *"><input style={styles.input} value={form.nome_completo} onChange={e => set('nome_completo', e.target.value)} /></Campo>
              <Campo label="CPF"><input style={styles.input} value={form.cpf} onChange={e => set('cpf', e.target.value)} placeholder="XX.XXX.XXX-XX" /></Campo>
              <Campo label="E-mail"><input style={styles.input} value={form.email} onChange={e => set('email', e.target.value)} /></Campo>
              <Campo label="Telefone"><input style={styles.input} value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(XX) X XXXX-XXXX" /></Campo>
              <Campo label="Data de Nascimento"><input style={styles.input} type="date" value={form.data_nascimento} onChange={e => set('data_nascimento', e.target.value)} /></Campo>
              <Campo label="CEP"><input style={styles.input} value={form.cep} onChange={e => set('cep', e.target.value)} placeholder="XXXXX-XXX" /></Campo>
              <Campo label="Endereço Completo"><input style={styles.input} value={form.endereco} onChange={e => set('endereco', e.target.value)} /></Campo>
              <Campo label="Complemento e Bairro"><input style={styles.input} value={form.complemento_bairro} onChange={e => set('complemento_bairro', e.target.value)} /></Campo>
              <Campo label="Cidade e Estado"><input style={styles.input} value={form.cidade_estado} onChange={e => set('cidade_estado', e.target.value)} placeholder="Ex: Rio Branco - AC" /></Campo>
            </div>
            <hr style={styles.hr} />
            <h3 style={styles.subtitulo}>Dados Bancários</h3>
            <div style={styles.grid3}>
              <Campo label="Banco"><input style={styles.input} value={form.banco} onChange={e => set('banco', e.target.value)} /></Campo>
              <Campo label="Agência"><input style={styles.input} value={form.agencia} onChange={e => set('agencia', e.target.value)} /></Campo>
              <Campo label="Conta Corrente"><input style={styles.input} value={form.conta} onChange={e => set('conta', e.target.value)} /></Campo>
            </div>
          </div>
        )}

        {/* ABA 1 — Projeto */}
        {aba === 1 && (
          <div style={styles.secao}>
            <div style={styles.grid2}>
              <Campo label="Número da Demanda *"><input style={styles.input} value={form.numero_demanda} onChange={e => set('numero_demanda', e.target.value)} placeholder="DE-ASL2-POA3-XXX-2026-00XX" /></Campo>
              <Campo label="Vigência do POA"><input style={styles.input} value={form.vigencia_poa} onChange={e => set('vigencia_poa', e.target.value)} placeholder="Ex: 2025-26" /></Campo>
              <Campo label="Linha(s) do POA"><input style={styles.input} value={form.linhas_poa} onChange={e => set('linhas_poa', e.target.value)} /></Campo>
              <Campo label="SEI"><input style={styles.input} value={form.sei} onChange={e => set('sei', e.target.value)} /></Campo>
              <Campo label="Componente"><input style={styles.input} value={form.componente} onChange={e => set('componente', e.target.value)} /></Campo>
              <Campo label="Unidade do Solicitante"><input style={styles.input} value={form.unidade_solicitante} onChange={e => set('unidade_solicitante', e.target.value)} /></Campo>
            </div>
            <hr style={styles.hr} />
            <Campo label="Justificativa da Viagem *">
              <textarea style={{ ...styles.input, minHeight: '140px', resize: 'vertical' }}
                value={form.justificativa}
                onChange={e => set('justificativa', e.target.value)}
                placeholder="Descreva o motivo da viagem e justificativa do gasto em relação ao ASL2..." />
            </Campo>
          </div>
        )}

        {/* ABA 2 — Passagem Aérea */}
        {aba === 2 && (
          <div style={styles.secao}>
            <h3 style={styles.subtitulo}>Trecho de Ida</h3>
            <div style={styles.grid2}>
              <Campo label="Origem"><input style={styles.input} value={form.passagem_origem_1} onChange={e => set('passagem_origem_1', e.target.value)} placeholder="Cidade de origem" /></Campo>
              <Campo label="Destino"><input style={styles.input} value={form.passagem_destino_1} onChange={e => set('passagem_destino_1', e.target.value)} placeholder="Cidade de destino" /></Campo>
              <Campo label="Data da Ida"><input style={styles.input} type="date" value={form.passagem_ida_data} onChange={e => set('passagem_ida_data', e.target.value)} /></Campo>
              <Campo label="Hora / Voo (Ida)"><input style={styles.input} value={form.passagem_ida_hora} onChange={e => set('passagem_ida_hora', e.target.value)} placeholder="Ex: 3807/16h50" /></Campo>
              <Campo label="Data da Volta"><input style={styles.input} type="date" value={form.passagem_volta_data} onChange={e => set('passagem_volta_data', e.target.value)} /></Campo>
              <Campo label="Hora / Voo (Volta)"><input style={styles.input} value={form.passagem_volta_hora} onChange={e => set('passagem_volta_hora', e.target.value)} placeholder="Ex: 3806/21h05" /></Campo>
              <Campo label="Valor Total da Passagem (R$)"><input style={styles.input} type="number" value={form.passagem_valor} onChange={e => set('passagem_valor', e.target.value)} placeholder="0,00" /></Campo>
              <Campo label="Bagagem">
                <select style={styles.input} value={form.passagem_bagagem} onChange={e => set('passagem_bagagem', e.target.value)}>
                  <option value="com despacho de bagagem">Com despacho de bagagem</option>
                  <option value="sem despacho de bagagem">Sem despacho de bagagem</option>
                </select>
              </Campo>
            </div>
          </div>
        )}

        {/* ABA 3 — Transporte */}
        {aba === 3 && (
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

        {/* ABA 4 — Hospedagem */}
        {aba === 4 && (
          <div style={styles.secao}>
            <div style={styles.grid2}>
              <Campo label="Local / Hotel"><input style={styles.input} value={form.hospedagem_local} onChange={e => set('hospedagem_local', e.target.value)} /></Campo>
              <Campo label="Tipo de Hospedagem">
                <select style={styles.input} value={form.hospedagem_tipo} onChange={e => set('hospedagem_tipo', e.target.value)}>
                  <option>Café da manhã</option>
                  <option>Almoço</option>
                  <option>Pensão completa</option>
                </select>
              </Campo>
              <Campo label="Data de Entrada"><input style={styles.input} type="date" value={form.hospedagem_entrada} onChange={e => set('hospedagem_entrada', e.target.value)} /></Campo>
              <Campo label="Data de Saída"><input style={styles.input} type="date" value={form.hospedagem_saida} onChange={e => set('hospedagem_saida', e.target.value)} /></Campo>
              <Campo label="Valor Total (R$)"><input style={styles.input} type="number" value={form.hospedagem_valor} onChange={e => set('hospedagem_valor', e.target.value)} placeholder="0,00" /></Campo>
            </div>
          </div>
        )}

        {/* ABA 5 — Diárias */}
        {aba === 5 && (
          <div style={styles.secao}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={styles.thTabela}>Tipo de Diária</th>
                  <th style={styles.thTabela}>Qtd</th>
                  <th style={styles.thTabela}>Dias</th>
                  <th style={styles.thTabela}>Valor Unit.</th>
                  <th style={styles.thTabela}>Total</th>
                </tr>
              </thead>
              <tbody>
                {DIARIAS_LISTA.map((d, i) => {
                  const qtd = Number(form.diarias?.[`${d.key}_qtd`] || 0)
                  const dias = Number(form.diarias?.[`${d.key}_dias`] || 1)
                  const total = qtd * dias * d.valor
                  return (
                    <tr key={d.key} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px 12px', fontSize: '14px', color: '#374151' }}>{d.label}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <input type="number" min="0" style={{ ...styles.inputPequeno }}
                          value={form.diarias?.[`${d.key}_qtd`] || ''}
                          onChange={e => setDiaria(`${d.key}_qtd`, e.target.value)} />
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <input type="number" min="1" style={{ ...styles.inputPequeno }}
                          value={form.diarias?.[`${d.key}_dias`] || ''}
                          onChange={e => setDiaria(`${d.key}_dias`, e.target.value)} />
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

            {/* Resumo total */}
            <div style={styles.resumo}>
              <div style={styles.resumoLinha}><span>Passagem aérea</span><span>R$ {formatarMoeda(Number(form.passagem_valor || 0))}</span></div>
              <div style={styles.resumoLinha}><span>Transporte</span><span>R$ {formatarMoeda(Number(form.transporte_valor || 0))}</span></div>
              <div style={styles.resumoLinha}><span>Hospedagem</span><span>R$ {formatarMoeda(Number(form.hospedagem_valor || 0))}</span></div>
              <div style={styles.resumoLinha}><span>Diárias</span><span>R$ {formatarMoeda(totalDiarias)}</span></div>
              <div style={{ ...styles.resumoLinha, ...styles.resumoTotal }}>
                <span>TOTAL GERAL</span>
                <span>R$ {formatarMoeda(totalGeral)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navegação entre abas */}
      <div style={styles.navegacao}>
        {aba > 0 && <button onClick={() => setAba(a => a - 1)} style={styles.btnNav}>← Anterior</button>}
        {aba < abas.length - 1 && <button onClick={() => setAba(a => a + 1)} style={styles.btnNavPrimario}>Próximo →</button>}
        {aba === abas.length - 1 && (
          <button onClick={gerarDoc} disabled={gerando} style={styles.btnGerar}>
            {gerando ? 'Gerando...' : '📄 Gerar Documento Word'}
          </button>
        )}
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
  abas: { display: 'flex', gap: '0', borderBottom: '2px solid #e5e7eb', marginBottom: '20px', overflowX: 'auto' },
  aba: { padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', transition: 'all 0.2s' },
  card: { background: '#fff', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '20px' },
  secao: { display: 'flex', flexDirection: 'column', gap: '16px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '14px', outline: 'none', fontFamily: 'inherit', width: '100%' },
  inputPequeno: { padding: '6px 8px', borderRadius: '6px', border: '1.5px solid #d1d5db', fontSize: '14px', outline: 'none', width: '70px', textAlign: 'center' },
  hr: { border: 'none', borderTop: '1px solid #e5e7eb', margin: '8px 0' },
  subtitulo: { fontSize: '15px', fontWeight: '600', color: '#374151', margin: 0 },
  dica: { background: '#f0fdf4', color: '#166534', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', margin: 0 },
  thTabela: { padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' },
  resumo: { background: '#f9fafb', borderRadius: '10px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' },
  resumoLinha: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#374151' },
  resumoTotal: { fontSize: '16px', fontWeight: '700', color: '#111827', borderTop: '2px solid #d1d5db', paddingTop: '8px', marginTop: '4px' },
  navegacao: { display: 'flex', justifyContent: 'space-between', gap: '12px' },
  btnNav: { padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '14px' },
  btnNavPrimario: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#1a4731', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginLeft: 'auto' },
}
