const XLSX = require('xlsx')
const https = require('https')
const path = require('path')

const SUPABASE_URL = process.env.SUPABASE_URL || 'zbxlyaynypypeywsxgnd.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_KEY || ''

function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const options = {
      hostname: SUPABASE_URL,
      path: `/rest/v1/${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }
    const req = https.request(options, (res) => {
      let responseData = ''
      res.on('data', chunk => responseData += chunk)
      res.on('end', () => resolve({ status: res.statusCode, data: responseData }))
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function importar() {
  const arquivoPath = 'C:\\Users\\SEMA\\OneDrive - FGV\\CLAUDE\\EXECUCAO - ASL2POA3 (POWERBI).xlsx'

  console.log('📖 Lendo Excel...')
  const workbook = XLSX.readFile(arquivoPath)
  const sheet = workbook.Sheets['Sheet1']
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  console.log(`📊 ${rows.length} linhas encontradas`)

  // Filtrar somente linhas com ID válido
  const atividades = rows
    .filter(r => r['ID'] && String(r['ID']).startsWith('DE-'))
    .map(r => ({
      id: String(r['ID']).trim(),
      unidade_operativa: String(r['UNIDADE OPERATIVA'] || '').trim(),
      linhas_poa: String(r['LINHAS DO POA'] || '').trim(),
      area_departamento: String(r['AREA ou DEPARTAMENTO'] || '').trim(),
      componente: String(r['COMPONENTE'] || '').trim(),
      indicador: String(r['INDICADOR'] || '').trim(),
      atividade_proposta: String(r['ATIVIDADE PROPOSTA (POA 3) - O que precisa ser feito?'] || '').trim().slice(0, 500),
      resultado: String(r['RESULTADO DA ATIVIDADE (POA 3) - Para o que essa atividade é necessária?'] || '').trim().slice(0, 500),
      valor: Number(r['VALOR DA ATIVIDADE - Quanto essa atividade irá custar? Qual o orçamento necessário?'] || 0) || null,
      execucao: String(r['EXECUÇÃO'] || '').trim(),
      instituicao: 'SEMA',
    }))

  // Remover duplicatas por ID
  const unicos = []
  const ids = new Set()
  for (const a of atividades) {
    if (!ids.has(a.id)) {
      ids.add(a.id)
      unicos.push(a)
    }
  }

  console.log(`✅ ${unicos.length} atividades únicas para importar`)

  // Importar em lotes de 50
  const LOTE = 50
  let importados = 0
  for (let i = 0; i < unicos.length; i += LOTE) {
    const lote = unicos.slice(i, i + LOTE)
    const res = await supabaseRequest('POST', 'atividades?on_conflict=id', lote)
    if (res.status >= 400) {
      console.error(`❌ Erro no lote ${i}: ${res.data}`)
    } else {
      importados += lote.length
      process.stdout.write(`\r⬆️  ${importados}/${unicos.length} importados`)
    }
  }

  console.log(`\n🎉 Importação concluída! ${importados} atividades no banco.`)
}

importar().catch(console.error)
