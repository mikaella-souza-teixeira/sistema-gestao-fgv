const PizZip = require('pizzip')
const fs = require('fs')
const path = require('path')

const inputPath = path.join(__dirname, '..', 'template-original.docx')
const outputPath = path.join(__dirname, '..', 'public', 'template-passagens.docx')

const content = fs.readFileSync(inputPath)
const zip = new PizZip(content)

let xml = zip.files['word/document.xml'].asText()

// Mapeamento: texto original → placeholder docxtemplater
const substituicoes = [
  // Seção 0 — Beneficiário
  ['XXXXXXXXX XXXXXX',                    '{nome_completo}'],
  ['XX.XXX.XXX-XX',                       '{cpf}'],
  ['xx.xxxx@xxxxxx.org',                  '{email}'],
  ['(XX) X XXXX-XXXX',                    '{telefone}'],
  ['(exemplo) Rua Senador Ponce, 294',    '{endereco}'],
  ['XXX.XX-XXX',                          '{cep}'],
  ['XX/XX/XXXX',                          '{data_nascimento}'],
  ['(exemplo) Apto 33, Monte Verde',      '{complemento_bairro}'],
  ['(exemplo) Jaú - SP',                  '{cidade_estado}'],

  // Seção 0b — Projeto
  ['DE-ASL2-POA2-XXX-2026-00XX',          '{numero_demanda}'],
  ['2024-25',                             '{vigencia_poa}'],

  // Seção 1 — Dados bancários
  ['Banco ASL',                           '{banco}'],
  ['000XX',                               '{agencia}'],
  ['XXXX',                                '{conta}'],

  // Seção 3 — Passagem aérea
  ['Xxxxxxxxxx',                          '{nome_solicitante}'],
  ['XXXX/MMA',                            '{unidade_solicitante}'],

  // Diárias — quantidades e dias
  ['US$ 000,00',                          '{valor_calc}'],
  ['R$ 0.000,00',                         '{total_geral}'],
]

for (const [de, para] of substituicoes) {
  xml = xml.split(de).join(para)
}

zip.file('word/document.xml', xml)

const output = zip.generate({
  type: 'nodebuffer',
  compression: 'DEFLATE',
})

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, output)
console.log('✅ Template gerado em:', outputPath)
