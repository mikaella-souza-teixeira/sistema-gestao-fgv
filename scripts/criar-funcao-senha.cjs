const https = require('https')

const sql = `CREATE OR REPLACE FUNCTION public.admin_update_password(p_user_id uuid, p_nova_senha text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_perfil text;
BEGIN
  SELECT p.perfil INTO v_perfil
  FROM public.perfis_usuarios p
  WHERE p.id = auth.uid();

  IF v_perfil IS DISTINCT FROM 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar senhas';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_nova_senha, extensions.gen_salt('bf'))
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario nao encontrado';
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_password(uuid, text) TO authenticated;`

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
      console.log('✅ Função admin_update_password criada com sucesso!')
    } else {
      console.log('Resposta:', data)
    }
  })
})
req.on('error', e => console.error('Erro:', e))
req.write(body)
req.end()
