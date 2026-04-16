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
  { key: 'meia_diaria_deslocamento', valor: 225,  moeda: 'R$'  },
  { key: 'meia_viagem',              valor: 225,  moeda: 'R$'  },
]

export function calcularTotais(diarias) {
  let total = 0
  for (const d of DIARIAS_CONFIG) {
    const qtd = Number(diarias[`${d.key}_qtd`] || 0)
    total += qtd * d.valor
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

  // Calcular valores por tipo de diária
  const valoresDiarias = {}
  let totalDiarias = 0
  for (const d of DIARIAS_CONFIG) {
    const qtd = Number(diarias[`${d.key}_qtd`] || 0)
    const total = qtd * d.valor
    totalDiarias += total
    valoresDiarias[`val_${d.key}`] = qtd > 0 ? fmt(total, d.moeda) : ''
    valoresDiarias[`qtd_${d.key}`] = qtd > 0 ? String(qtd) : ''
  }

  const totalPassagem   = Number(dados.passagem_valor   || 0)
  const totalTransporte = Number(dados.transporte_valor  || 0)
  const totalHospedagem = Number(dados.hospedagem_valor  || 0)
  const totalGeral      = totalDiarias + totalPassagem + totalTransporte + totalHospedagem

  // Formatar data nascimento
  let dataNascFormatada = ''
  if (dados.data_nascimento) {
    const [y, m, d] = dados.data_nascimento.split('-')
    dataNascFormatada = `${d}/${m}/${y}`
  }

  doc.render({
    // Beneficiário
    nome_completo:      dados.nome_completo      || '',
    cpf:                dados.cpf                || '',
    email:              dados.email              || '',
    telefone:           dados.telefone           || '',
    endereco:           dados.endereco           || '',
    cep:                dados.cep                || '',
    data_nascimento:    dataNascFormatada,
    complemento_bairro: dados.complemento_bairro || '',
    cidade_estado:      dados.cidade_estado      || '',

    // Projeto
    numero_demanda:     dados.numero_demanda     || '',
    vigencia_poa:       dados.vigencia_poa       || '2025-26',

    // Banco
    banco:              dados.banco              || '',
    agencia:            dados.agencia            || '',
    conta:              dados.conta              || '',

    // Solicitante
    nome_solicitante:   dados.nome_completo      || '',
    unidade_solicitante: dados.unidade_solicitante || '',

    // Total
    total_geral: `R$ ${formatarMoeda(totalGeral)}`,

    // Valores por tipo de diária
    ...valoresDiarias,
  })

  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  const nome = `RPAD-${dados.numero_demanda || 'NOVO'}-${(dados.nome_completo || 'beneficiario').split(' ')[0]}.docx`
  saveAs(blob, nome)
}
