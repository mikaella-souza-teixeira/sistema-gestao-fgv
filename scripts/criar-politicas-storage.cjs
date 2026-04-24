const https = require('https')

const sql = `
INSERT INTO storage.buckets (id, name, public)
VALUES ('anexos', 'anexos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS upload_autenticados ON storage.objects;
DROP POLICY IF EXISTS update_autenticados ON storage.objects;
DROP POLICY IF EXISTS select_public ON storage.objects;

CREATE POLICY upload_autenticados ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'anexos');

CREATE POLICY update_autenticados ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'anexos');

CREATE POLICY select_public ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'anexos');
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
      console.log('✅ Políticas de storage criadas!')
    } else {
      console.log('Resposta:', data)
    }
  })
})
req.on('error', e => console.error('Erro:', e))
req.write(body)
req.end()
