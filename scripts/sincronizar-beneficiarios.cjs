const https = require('https')

// Varre todas as passagens_diarias e popula beneficiarios_cadastrados
const sql = `
INSERT INTO public.beneficiarios_cadastrados (
  nome_completo, cpf, email, telefone, data_nascimento,
  endereco, cep, complemento_bairro, cidade_estado,
  banco, codigo_banco, agencia_numero, agencia_digito,
  conta_numero, conta_digito, updated_at
)
-- Formato novo: beneficiarios é um array JSON
SELECT DISTINCT ON (COALESCE(NULLIF(b->>'cpf',''), b->>'nome_completo'))
  b->>'nome_completo',
  NULLIF(b->>'cpf', ''),
  NULLIF(b->>'email', ''),
  NULLIF(b->>'telefone', ''),
  NULLIF(b->>'data_nascimento', ''),
  NULLIF(b->>'endereco', ''),
  NULLIF(b->>'cep', ''),
  NULLIF(b->>'complemento_bairro', ''),
  NULLIF(b->>'cidade_estado', ''),
  NULLIF(b->>'banco', ''),
  NULLIF(b->>'codigo_banco', ''),
  NULLIF(b->>'agencia_numero', ''),
  NULLIF(b->>'agencia_digito', ''),
  NULLIF(b->>'conta_numero', ''),
  NULLIF(b->>'conta_digito', ''),
  now()
FROM public.passagens_diarias,
  jsonb_array_elements(dados->'beneficiarios') AS b
WHERE dados->'beneficiarios' IS NOT NULL
  AND jsonb_typeof(dados->'beneficiarios') = 'array'
  AND b->>'nome_completo' IS NOT NULL
  AND b->>'nome_completo' <> ''
ON CONFLICT (cpf) WHERE cpf IS NOT NULL AND cpf <> ''
DO UPDATE SET
  email            = COALESCE(EXCLUDED.email,            beneficiarios_cadastrados.email),
  telefone         = COALESCE(EXCLUDED.telefone,         beneficiarios_cadastrados.telefone),
  data_nascimento  = COALESCE(EXCLUDED.data_nascimento,  beneficiarios_cadastrados.data_nascimento),
  endereco         = COALESCE(EXCLUDED.endereco,         beneficiarios_cadastrados.endereco),
  cep              = COALESCE(EXCLUDED.cep,              beneficiarios_cadastrados.cep),
  complemento_bairro = COALESCE(EXCLUDED.complemento_bairro, beneficiarios_cadastrados.complemento_bairro),
  cidade_estado    = COALESCE(EXCLUDED.cidade_estado,    beneficiarios_cadastrados.cidade_estado),
  banco            = COALESCE(EXCLUDED.banco,            beneficiarios_cadastrados.banco),
  codigo_banco     = COALESCE(EXCLUDED.codigo_banco,     beneficiarios_cadastrados.codigo_banco),
  agencia_numero   = COALESCE(EXCLUDED.agencia_numero,   beneficiarios_cadastrados.agencia_numero),
  agencia_digito   = COALESCE(EXCLUDED.agencia_digito,   beneficiarios_cadastrados.agencia_digito),
  conta_numero     = COALESCE(EXCLUDED.conta_numero,     beneficiarios_cadastrados.conta_numero),
  conta_digito     = COALESCE(EXCLUDED.conta_digito,     beneficiarios_cadastrados.conta_digito),
  updated_at       = now();

-- Formato antigo: campos planos no topo do dados JSON
INSERT INTO public.beneficiarios_cadastrados (
  nome_completo, cpf, email, telefone, data_nascimento,
  endereco, cep, complemento_bairro, cidade_estado,
  banco, codigo_banco, agencia_numero, agencia_digito,
  conta_numero, conta_digito, updated_at
)
SELECT DISTINCT ON (COALESCE(NULLIF(dados->>'cpf',''), dados->>'nome_completo'))
  dados->>'nome_completo',
  NULLIF(dados->>'cpf', ''),
  NULLIF(dados->>'email', ''),
  NULLIF(dados->>'telefone', ''),
  NULLIF(dados->>'data_nascimento', ''),
  NULLIF(dados->>'endereco', ''),
  NULLIF(dados->>'cep', ''),
  NULLIF(dados->>'complemento_bairro', ''),
  NULLIF(dados->>'cidade_estado', ''),
  NULLIF(dados->>'banco', ''),
  NULLIF(dados->>'codigo_banco', ''),
  NULLIF(dados->>'agencia_numero', ''),
  NULLIF(dados->>'agencia_digito', ''),
  NULLIF(dados->>'conta_numero', ''),
  NULLIF(dados->>'conta_digito', ''),
  now()
FROM public.passagens_diarias
WHERE (dados->'beneficiarios' IS NULL OR jsonb_typeof(dados->'beneficiarios') <> 'array')
  AND dados->>'nome_completo' IS NOT NULL
  AND dados->>'nome_completo' <> ''
ON CONFLICT (cpf) WHERE cpf IS NOT NULL AND cpf <> ''
DO NOTHING;
`

const body = JSON.stringify({ query: sql })

const options = {
  hostname: 'api.supabase.com',
  path: '/v1/projects/zbxlyaynypypeywsxgnd/database/query',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sbp_cc1f290fd64b3e4f342407d9f6b8c624ae1b6c95',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
}

const req = https.request(options, res => {
  let data = ''
  res.on('data', d => data += d)
  res.on('end', () => {
    if (data === '[]' || data === '') {
      console.log('✅ Beneficiários sincronizados com sucesso!')
    } else {
      console.log('Resposta:', data)
    }
  })
})
req.on('error', e => console.error('Erro:', e))
req.write(body)
req.end()
