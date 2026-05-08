const PizZip = require('pizzip')
const fs = require('fs')
const path = require('path')

const inputPath = path.join(__dirname, '..', 'template-original.docx')
const outputPath = path.join(__dirname, '..', 'public', 'template-passagens.docx')

// ─── Funções auxiliares ──────────────────────────────────────────────────────

/**
 * Mescla todos os <w:r> de um parágrafo num único run.
 * Preserva o <w:rPr> do primeiro run e combina todo o texto.
 */
function mergeParagraphRuns(paraXml) {
  const runRe = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g
  const runs = []
  let m
  while ((m = runRe.exec(paraXml)) !== null) {
    runs.push({ start: m.index, end: m.index + m[0].length, xml: m[0] })
  }
  if (runs.length <= 1) return paraXml

  const allText = runs.map(r => {
    const t = r.xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/)
    return t ? t[1] : ''
  }).join('')
  if (!allText) return paraXml

  const rPrM = runs[0].xml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)
  const rPr = rPrM ? rPrM[0] : ''
  const sp = (allText.includes(' ') || allText.includes('\t')) ? ' xml:space="preserve"' : ''
  const merged = `<w:r>${rPr}<w:t${sp}>${allText}</w:t></w:r>`

  // Remove de trás pra frente para preservar offsets, depois substitui o primeiro
  let result = paraXml
  for (let i = runs.length - 1; i >= 1; i--) {
    const r = runs[i]
    result = result.slice(0, r.start) + result.slice(r.end)
  }
  const first = runs[0]
  result = result.slice(0, first.start) + merged + result.slice(first.end)
  return result
}

/** Aplica mergeParagraphRuns em todos os parágrafos do XML */
function mergeAllRuns(xml) {
  return xml.replace(/(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/g, (_, open, inner, close) => {
    return open + mergeParagraphRuns(inner) + close
  })
}

/** Substitui a N-ésima ocorrência de `search` por `replace` */
function replaceNth(xml, search, replace, n) {
  let count = 0
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return xml.replace(new RegExp(escaped, 'g'), match => {
    count++
    return count === n ? replace : match
  })
}

/**
 * Divide o XML por </w:tc>, encontra a célula que contém `labelContains`
 * e SUBSTITUI o conteúdo da célula em `offset` posições à frente pelo placeholder.
 * Diferente de injectAfterLabel: LIMPA o conteúdo existente antes de inserir.
 *
 * @param {boolean} force - se true, substitui mesmo que a célula tenha conteúdo
 */
function replaceCellAfterLabel(xml, labelContains, placeholder, offset = 1, force = false) {
  const SEP = '</w:tc>'
  const parts = xml.split(SEP)
  for (let i = 0; i < parts.length - offset; i++) {
    const cellText = parts[i].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (cellText.includes(labelContains)) {
      const ti = i + offset
      const targetText = parts[ti].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      if (force || !targetText || targetText.length <= 10) {
        // Substitui o primeiro parágrafo da célula: remove runs existentes e insere placeholder
        parts[ti] = parts[ti].replace(
          /(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/,
          (_, o, inner, c) => {
            const semRuns = inner.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, '')
            return `${o}${semRuns}<w:r><w:t>${placeholder}</w:t></w:r>${c}`
          }
        )
        break
      }
    }
  }
  return parts.join(SEP)
}

// ─── Leitura do arquivo original ─────────────────────────────────────────────

const content = fs.readFileSync(inputPath)
const zip = new PizZip(content)
let xml = zip.files['word/document.xml'].asText()

// ─── Passo 1: Mesclar runs divididos ─────────────────────────────────────────
console.log('🔄 Mesclando runs divididos em parágrafos...')
xml = mergeAllRuns(xml)

// ─── Passo 2: Substituições de texto conhecido ───────────────────────────────
console.log('✏️  Aplicando substituições de texto...')

// Ordem IMPORTA: strings mais longas/específicas PRIMEIRO para evitar colisões de substring

const substituicoes = [
  // ── Unidade de origem (célula 3) e solicitante (célula 85) ────────────────
  ['(exemplo) MMA/SBIO/DCBIO',         '{unidade_solicitante}'],

  // ── Data do documento (célula 4: "XX/XX/2026") ────────────────────────────
  ['XX/XX/2026',                       '{data_documento}'],

  // ── Beneficiário ──────────────────────────────────────────────────────────
  ['XXXXXXXXX XXXXXX',                 '{nome_completo}'],
  ['XX.XXX.XXX-XX',                    '{cpf}'],
  ['xx.xxxx@xxxxxx.org',               '{email}'],
  ['(XX) X XXXX-XXXX',                 '{telefone}'],
  ['(exemplo) Rua Senador Ponce, 294', '{endereco}'],
  ['XXX.XX-XXX',                       '{cep}'],
  ['XX/XX/XXXX',                       '{data_nascimento}'],
  ['(exemplo) Apto 33, Monte Verde',   '{complemento_bairro}'],
  ['(exemplo) Jaú - SP',               '{cidade_estado}'],

  // ── Projeto ───────────────────────────────────────────────────────────────
  ['DE-ASL2-POA2-XXX-2026-00XX',       '{numero_demanda}'],
  ['2024-25',                          '{vigencia_poa}'],

  // ── Banco ─────────────────────────────────────────────────────────────────
  ['Banco ASL',                        '{banco}'],
  ['000XX',                            '{agencia}'],

  // ── Solicitante ───────────────────────────────────────────────────────────
  ['XXXX/MMA',                         '{unidade_solicitante}'],
  ['Xxxxxxxxxx',                       '{nome_solicitante}'],

  // ── Hospedagem ────────────────────────────────────────────────────────────
  ['Hotel',                            '{hospedagem_local}'],

  // ── Totais ────────────────────────────────────────────────────────────────
  ['R$ 0.000,00',                      '{total_geral}'],
]

for (const [de, para] of substituicoes) {
  xml = xml.split(de).join(para)
}

// ATENÇÃO: "XXXX" (4 chars) ANTES de "XXX" (3 chars) para evitar que "XXXX" vire "{codigo_banco}X"
xml = xml.split('XXXX').join('{conta}')   // conta corrente (célula 48)
xml = xml.split('XXX').join('{codigo_banco}')  // código COMPE banco (célula 45)

// ─── Passo 3: Substituições por ocorrência ───────────────────────────────────
console.log('🔢 Substituindo ocorrências numeradas...')

// "Campo Grande" aparece 4x no template original, nesta ordem de documento:
//   Célula 63 → passagem ida origem
//   Célula 70 → passagem volta destino
//   Célula 110 → transporte ida origem
//   Célula 117 → transporte volta destino
xml = replaceNth(xml, 'Campo Grande', '{passagem_orig_1}',    1) // célula 63
xml = replaceNth(xml, 'Campo Grande', '{passagem_dest_2}',    1) // célula 70 (volta destino)
xml = replaceNth(xml, 'Campo Grande', '{transporte_origem}',  1) // célula 110
xml = replaceNth(xml, 'Campo Grande', '{transporte_destino_2}', 1) // célula 117

// "Brasília" aparece 4x, nesta ordem:
//   Célula 64 → passagem ida destino
//   Célula 69 → passagem volta origem
//   Célula 111 → transporte ida destino
//   Célula 116 → transporte volta origem
xml = replaceNth(xml, 'Brasília', '{passagem_dest_1}',    1) // célula 64
xml = replaceNth(xml, 'Brasília', '{passagem_orig_2}',    1) // célula 69
xml = replaceNth(xml, 'Brasília', '{transporte_destino}', 1) // célula 111
xml = replaceNth(xml, 'Brasília', '{transporte_origem_2}',1) // célula 116

// Datas de passagem (cada valor aparece 2x: passagem e transporte)
xml = replaceNth(xml, '9/12/25',    '{passagem_ida_data}',       1) // célula 65
xml = replaceNth(xml, '9/12/25',    '{transporte_partida_data}', 1) // célula 112
xml = replaceNth(xml, '12/12/25',   '{passagem_volta_data}',     1) // célula 73
xml = replaceNth(xml, '12/12/25',   '{transporte_chegada_data}', 1) // célula 120

// Voos/horas de passagem (cada valor aparece 2x: passagem e transporte)
xml = replaceNth(xml, '3807/16h50', '{passagem_ida_hora}',       1) // célula 66
xml = replaceNth(xml, '3807/16h50', '{transporte_partida_hora}', 1) // célula 113
xml = replaceNth(xml, '3806/21h05', '{passagem_volta_hora}',     1) // célula 74
xml = replaceNth(xml, '3806/21h05', '{transporte_chegada_hora}', 1) // célula 121

// Datas de hospedagem: "XX/XX/XX" aparece 4x (2 rows × 2 colunas)
// Substitui as 2 primeiras (row 1) e limpa o restante
xml = replaceNth(xml, 'XX/XX/XX', '{hospedagem_entrada}', 1) // célula 156
xml = replaceNth(xml, 'XX/XX/XX', '{hospedagem_saida}',   1) // célula 157
xml = xml.split('XX/XX/XX').join('') // limpa row 2 (células 160-161)

// "R$ -" aparece 3x: totais de passagem, transporte e hospedagem
xml = replaceNth(xml, 'R$ -', '{total_passagem}',   1)
xml = replaceNth(xml, 'R$ -', '{total_transporte}',  1)
xml = replaceNth(xml, 'R$ -', '{total_hospedagem}',  1)

// "US$ 000,00" → diárias internacionais (2 ocorrências)
xml = replaceNth(xml, 'US$ 000,00', '{val_diaria_intl}',       1)
xml = replaceNth(xml, 'US$ 000,00', '{val_meia_diaria_intl}',  1)

// "R$ 000,00" → totais por tipo de diária (8 ocorrências, na ordem do documento)
const diariaOrderR = [
  'diaria_capital',
  'meia_diaria_capital',
  'diaria_cidade',
  'meia_diaria_cidade',
  'diaria_campo',
  'meia_diaria_campo',
  'meia_diaria_deslocamento',
  'meia_viagem',
]
for (const key of diariaOrderR) {
  xml = replaceNth(xml, 'R$ 000,00', `{val_${key}}`, 1)
}

// ─── Passo 4: Substituir conteúdo de células adjacentes às labels ────────────
// Estrutura do documento (células consecutivas no XML):
//   Célula 28: "Linha(s) do POA:" label   →   Célula 30: valor "-"   (offset=2)
//   Célula 29: "SEI:" label               →   Célula 31: valor "-"   (offset=2)
//   Célula 32: "Componente:" label         →   Célula 34: valor ""    (offset=2)
//   Célula 33: "Proc nº" label             →   Célula 35: valor "-"   (offset=2)
//   Célula 40: "Agência" label             →   Célula 47: dígito "X"  (offset=7)
//   Célula 42: "Conta Corrente" label      →   Célula 49: dígito "X"  (offset=7)
//   Célula 50: "Descrever o motivo..." label → Célula 51: instrução (force replace)

console.log('💉 Substituindo células de valor...')
xml = replaceCellAfterLabel(xml, 'Linha(s) do POA', '{linhas_poa}',      2)
xml = replaceCellAfterLabel(xml, 'SEI:',            '{sei}',             2)
xml = replaceCellAfterLabel(xml, 'Componente:',     '{componente}',      2)
xml = replaceCellAfterLabel(xml, 'Proc nº',         '{proc_numero}',     2)
xml = replaceCellAfterLabel(xml, 'Agência',         '{agencia_digito}',  7)
xml = replaceCellAfterLabel(xml, 'Conta Corrente',  '{conta_digito}',    7)
xml = replaceCellAfterLabel(xml, 'Descrever o motivo', '{justificativa}', 1, true)

// ─── Geração do arquivo ───────────────────────────────────────────────────────
zip.file('word/document.xml', xml)
const output = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, output)
console.log('✅ Template gerado em:', outputPath)
