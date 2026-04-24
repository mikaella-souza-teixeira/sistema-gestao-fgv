const https = require('https')

// Cria função PostgreSQL que busca em duas fontes:
// 1. beneficiarios_cadastrados (cadastro consolidado)
// 2. passagens_diarias JSONB (histórico de solicitações)
const sql = `
CREATE OR REPLACE FUNCTION public.buscar_beneficiarios(termo text)
RETURNS TABLE(
  id               uuid,
  nome_completo    text,
  cpf              text,
  email            text,
  telefone         text,
  data_nascimento  text,
  endereco         text,
  cep              text,
  complemento_bairro text,
  cidade_estado    text,
  banco            text,
  codigo_banco     text,
  agencia_numero   text,
  agencia_digito   text,
  conta_numero     text,
  conta_digito     text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cadastros AS (
    SELECT
      id, nome_completo, cpf, email, telefone, data_nascimento,
      endereco, cep, complemento_bairro, cidade_estado,
      banco, codigo_banco, agencia_numero, agencia_digito,
      conta_numero, conta_digito
    FROM beneficiarios_cadastrados
    WHERE nome_completo ILIKE '%' || termo || '%'
    LIMIT 6
  ),
  historico AS (
    SELECT DISTINCT ON (b->>'nome_completo')
      gen_random_uuid()            AS id,
      b->>'nome_completo'          AS nome_completo,
      NULLIF(b->>'cpf','')         AS cpf,
      NULLIF(b->>'email','')       AS email,
      NULLIF(b->>'telefone','')    AS telefone,
      NULLIF(b->>'data_nascimento','') AS data_nascimento,
      NULLIF(b->>'endereco','')    AS endereco,
      NULLIF(b->>'cep','')         AS cep,
      NULLIF(b->>'complemento_bairro','') AS complemento_bairro,
      NULLIF(b->>'cidade_estado','') AS cidade_estado,
      NULLIF(b->>'banco','')       AS banco,
      NULLIF(b->>'codigo_banco','') AS codigo_banco,
      NULLIF(b->>'agencia_numero','') AS agencia_numero,
      NULLIF(b->>'agencia_digito','') AS agencia_digito,
      NULLIF(b->>'conta_numero','') AS conta_numero,
      NULLIF(b->>'conta_digito','') AS conta_digito
    FROM passagens_diarias,
      jsonb_array_elements(dados->'beneficiarios') AS b
    WHERE b->>'nome_completo' ILIKE '%' || termo || '%'
      AND dados->'beneficiarios' IS NOT NULL
      AND jsonb_typeof(dados->'beneficiarios') = 'array'
      AND b->>'nome_completo' NOT IN (SELECT nome_completo FROM cadastros)
    ORDER BY b->>'nome_completo', passagens_diarias.created_at DESC
    LIMIT 4
  )
  SELECT * FROM cadastros
  UNION ALL
  SELECT * FROM historico;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_beneficiarios(text) TO authenticated;
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
      console.log('✅ Função buscar_beneficiarios criada!')
    } else {
      console.log('Resposta:', data)
    }
  })
})
req.on('error', e => console.error('Erro:', e))
req.write(body)
req.end()
