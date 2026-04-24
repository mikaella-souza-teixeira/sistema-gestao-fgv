const https = require('https')

const sql = `
CREATE TABLE IF NOT EXISTS public.beneficiarios_cadastrados (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo text NOT NULL,
  cpf text,
  email text,
  telefone text,
  data_nascimento text,
  endereco text,
  cep text,
  complemento_bairro text,
  cidade_estado text,
  banco text,
  codigo_banco text,
  agencia_numero text,
  agencia_digito text,
  conta_numero text,
  conta_digito text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS beneficiarios_cpf_idx
  ON public.beneficiarios_cadastrados(cpf)
  WHERE cpf IS NOT NULL AND cpf != '';

ALTER TABLE public.beneficiarios_cadastrados ENABLE ROW LEVEL SECURITY;

DO $do$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'beneficiarios_cadastrados'
    AND policyname = 'Autenticados gerenciam beneficiarios'
  ) THEN
    CREATE POLICY "Autenticados gerenciam beneficiarios"
      ON public.beneficiarios_cadastrados
      FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $do$;
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
      console.log('✅ Tabela beneficiarios_cadastrados criada com sucesso!')
    } else {
      console.log('Resposta:', data)
    }
  })
})
req.on('error', e => console.error('Erro:', e))
req.write(body)
req.end()
