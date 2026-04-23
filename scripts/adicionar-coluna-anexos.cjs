const https = require('https')

const sql = `
ALTER TABLE public.passagens_diarias
  ADD COLUMN IF NOT EXISTS anexos_assinados jsonb DEFAULT '{}';
`

const body = JSON.stringify({ query: sql })

const options = {
  hostname: 'api.supabase.com',
  path: '/v1/projects/zbxlyaynypypeywsxgnd/database/query',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sbp_30e9467702d08db678da28291e0ce8a9006fabf6',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
}

const req = https.request(options, res => {
  let data = ''
  res.on('data', d => data += d)
  res.on('end', () => {
    if (data === '[]' || data === '') {
      console.log('✅ Coluna anexos_assinados criada!')
    } else {
      console.log('Resposta:', data)
    }
  })
})
req.on('error', e => console.error('Erro:', e))
req.write(body)
req.end()
