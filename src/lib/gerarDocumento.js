import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { saveAs } from 'file-saver'

const VALORES_DIARIA = {
  diaria_intl: 400,
  meia_diaria_intl: 200,
  diaria_capital: 450,
  meia_diaria_capital: 225,
  diaria_cidade: 300,
  meia_diaria_cidade: 150,
  diaria_campo: 300,
  meia_diaria_campo: 150,
  meia_diaria_deslocamento: 225,
  meia_viagem: 225,
}

export function calcularTotais(diarias) {
  let totalDiarias = 0
  for (const [tipo, valorUnit] of Object.entries(VALORES_DIARIA)) {
    const qtd = Number(diarias[`${tipo}_qtd`] || 0)
    const dias = Number(diarias[`${tipo}_dias`] || 1)
    totalDiarias += qtd * dias * valorUnit
  }
  return totalDiarias
}

export function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function gerarDocumentoWord(dados) {
  // Buscar template
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

  // Calcular totais das diárias
  const totalDiarias = calcularTotais(dados.diarias || {})
  const totalPassagem = Number(dados.passagem_valor || 0)
  const totalTransporte = Number(dados.transporte_valor || 0)
  const totalHospedagem = Number(dados.hospedagem_valor || 0)
  const totalGeral = totalDiarias + totalPassagem + totalTransporte + totalHospedagem

  // Montar dados para o template
  const templateData = {
    // Seção 0 — Beneficiário
    nome_completo: dados.nome_completo || '',
    cpf: dados.cpf || '',
    email: dados.email || '',
    telefone: dados.telefone || '',
    endereco: dados.endereco || '',
    cep: dados.cep || '',
    data_nascimento: dados.data_nascimento || '',
    complemento_bairro: dados.complemento_bairro || '',
    cidade_estado: dados.cidade_estado || '',

    // Seção 0b — Projeto
    numero_demanda: dados.numero_demanda || '',
    vigencia_poa: dados.vigencia_poa || '',

    // Seção 1 — Banco
    banco: dados.banco || '',
    agencia: dados.agencia || '',
    conta: dados.conta || '',

    // Seção 3 — Passagem
    nome_solicitante: dados.nome_completo || '',
    unidade_solicitante: dados.unidade_solicitante || '',

    // Total geral
    total_geral: `R$ ${formatarMoeda(totalGeral)}`,
  }

  doc.render(templateData)

  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  const nomeArquivo = `RPAD-${dados.numero_demanda || 'NOVO'}-${(dados.nome_completo || 'beneficiario').split(' ')[0]}.docx`
  saveAs(blob, nomeArquivo)
}
