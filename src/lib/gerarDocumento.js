import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { saveAs } from 'file-saver'

const DIARIAS_CONFIG = [
  { key: 'diaria_intl',              valor: 400,  moeda: 'US$' },
  { key: 'meia_diaria_intl',         valor: 200,  moeda: 'US$' },
  { key: 'diaria_capital',           valor: 450,  moeda: 'R$'  },
  { key: 'meia_diaria_capital',      valor: 225,  moeda: 'R$'  },
  { key: 'diaria_cidade',            valor: 300,  moeda: 'R$'  },
  { key: 'meia_diaria_cidade',       valor: 150,  moeda: 'R$'  },
  { key: 'diaria_campo',             valor: 300,  moeda: 'R$'  },
  { key: 'meia_diaria_campo',        valor: 150,  moeda: 'R$'  },
  { key: 'meia_diaria_deslocamento', valor: 225,  moeda: 'R$', tipo: 'toggle' },
  { key: 'meia_viagem',              valor: 225,  moeda: 'R$'  },
]

export function calcularTotais(diarias) {
  let total = 0
  for (const d of DIARIAS_CONFIG) {
    if (d.tipo === 'toggle') {
      total += diarias[d.key] === 'sim' ? d.valor : 0
    } else {
      const qtd = Number(diarias[`${d.key}_qtd`] || 0)
      total += qtd * d.valor
    }
  }
  return total
}

export function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmt(valor, moeda = 'R$') {
  const n = Number(valor || 0)
  if (n === 0) return ''
  return `${moeda} ${formatarMoeda(n)}`
}

function fmtData(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export async function gerarDocumentoWord(dados) {
  const baseUrl = import.meta.env.BASE_URL || '/'
  const response = await fetch(`${baseUrl}template-passagens.docx`)
  if (!response.ok) throw new Error('Template não encontrado')

  const arrayBuffer = await response.arrayBuffer()
  const zip = new PizZip(arrayBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  })

  const diarias = dados.diarias || {}

  // ── Calcular valores por tipo de diária ──────────────────────────────────
  const valoresDiarias = {}
  let totalDiarias = 0

  for (const d of DIARIAS_CONFIG) {
    if (d.tipo === 'toggle') {
      const ativo = diarias[d.key] === 'sim'
      totalDiarias += ativo ? d.valor : 0
      valoresDiarias[`val_${d.key}`] = ativo ? fmt(d.valor, d.moeda) : ''
      valoresDiarias[`qtd_${d.key}`] = ativo ? '1' : ''
    } else {
      const qtd   = Number(diarias[`${d.key}_qtd`] || 0)
      const total = qtd * d.valor
      totalDiarias += total
      valoresDiarias[`val_${d.key}`] = qtd > 0 ? fmt(total, d.moeda) : ''
      valoresDiarias[`qtd_${d.key}`] = qtd > 0 ? String(qtd) : ''
    }
  }

  const totalPassagem   = Number(dados.passagem_valor   || 0)
  const totalTransporte = Number(dados.transporte_valor  || 0)
  const totalHospedagem = Number(dados.hospedagem_valor  || 0)
  const totalGeral      = totalDiarias + totalPassagem + totalTransporte + totalHospedagem

  // ── Agência e conta: passa número e dígito separadamente ─────────────────
  const agencia        = dados.agencia_numero || dados.agencia || ''
  const agencia_digito = dados.agencia_digito || ''
  const conta          = dados.conta_numero   || dados.conta   || ''
  const conta_digito   = dados.conta_digito   || ''

  // ── Passagem: se não houver, passa vazio ──────────────────────────────────
  const temPassagem = dados.tem_passagem === 'sim'

  doc.render({
    // ── Beneficiário ────────────────────────────────────────────────────────
    nome_completo:       dados.nome_completo      || '',
    cpf:                 dados.cpf                || '',
    email:               dados.email              || '',
    telefone:            dados.telefone           || '',
    endereco:            dados.endereco           || '',
    cep:                 dados.cep                || '',
    data_nascimento:     fmtData(dados.data_nascimento),
    complemento_bairro:  dados.complemento_bairro || '',
    cidade_estado:       dados.cidade_estado      || '',

    // ── Projeto ─────────────────────────────────────────────────────────────
    numero_demanda:      dados.numero_demanda     || '',
    vigencia_poa:        dados.vigencia_poa       || '2025-26',
    linhas_poa:          dados.linhas_poa         || '',
    componente:          dados.componente         || '',
    sei:                 dados.sei                || '',
    proc_numero:         dados.proc_numero        || '',

    // ── Justificativa ───────────────────────────────────────────────────────
    justificativa:       dados.justificativa      || '',

    // ── Banco ───────────────────────────────────────────────────────────────
    banco:               dados.banco              || '',
    codigo_banco:        dados.codigo_banco       || '',
    agencia,
    agencia_digito,
    conta,
    conta_digito,

    // ── Solicitante ─────────────────────────────────────────────────────────
    nome_solicitante:    dados.nome_completo      || '',
    unidade_solicitante: dados.unidade_solicitante || '',

    // ── Passagem aérea (vazio se não tem passagem) ──────────────────────────
    passagem_orig_1:     temPassagem ? (dados.passagem_origem_1  || '') : '',
    passagem_dest_1:     temPassagem ? (dados.passagem_destino_1 || '') : '',
    passagem_orig_2:     temPassagem ? (dados.passagem_destino_1 || '') : '', // volta = destino → origem
    passagem_dest_2:     temPassagem ? (dados.passagem_origem_1  || '') : '',
    passagem_ida_data:   temPassagem ? fmtData(dados.passagem_ida_data)   : '',
    passagem_ida_hora:   temPassagem ? (dados.passagem_ida_hora  || '') : '',
    passagem_volta_data: temPassagem ? fmtData(dados.passagem_volta_data) : '',
    passagem_volta_hora: temPassagem ? (dados.passagem_volta_hora || '') : '',
    passagem_bagagem:    temPassagem ? (dados.passagem_bagagem   || '') : '',
    total_passagem:      totalPassagem > 0 ? fmt(totalPassagem) : '',

    // ── Transporte ──────────────────────────────────────────────────────────
    transporte_origem:        dados.transporte_origem        || '',
    transporte_destino:       dados.transporte_destino       || '',
    transporte_partida_data:  fmtData(dados.transporte_partida_data),
    transporte_chegada_data:  fmtData(dados.transporte_chegada_data),
    transporte_tipo:          dados.transporte_tipo          || '',
    total_transporte:         totalTransporte > 0 ? fmt(totalTransporte) : '',

    // ── Hospedagem ──────────────────────────────────────────────────────────
    hospedagem_local:    dados.hospedagem_local   || '',
    hospedagem_tipo:     dados.hospedagem_tipo    || '',
    hospedagem_entrada:  fmtData(dados.hospedagem_entrada),
    hospedagem_saida:    fmtData(dados.hospedagem_saida),
    total_hospedagem:    totalHospedagem > 0 ? fmt(totalHospedagem) : '',

    // ── Total geral ─────────────────────────────────────────────────────────
    total_geral: `R$ ${formatarMoeda(totalGeral)}`,

    // ── Valores por tipo de diária ──────────────────────────────────────────
    ...valoresDiarias,
  })

  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  const nome = `RPAD-${dados.numero_demanda || 'NOVO'}-${(dados.nome_completo || 'beneficiario').split(' ')[0]}.docx`
  saveAs(blob, nome)
}
