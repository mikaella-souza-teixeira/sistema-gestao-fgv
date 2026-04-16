-- =============================================
-- CORREÇÃO: Políticas de acesso
-- =============================================

-- 1. Remover política com conflito
DROP POLICY IF EXISTS "perfis_admin" ON public.perfis_usuarios;

-- 2. Adicionar perfil no token do usuário administrador
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"perfil": "administrador"}'::jsonb
WHERE id = '1f252078-afb4-486c-a6ae-fed1491b1446';

-- 3. Recriar política sem conflito (usa o token do usuário)
CREATE POLICY "perfis_admin" ON public.perfis_usuarios
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'perfil') = 'administrador')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'perfil') = 'administrador');

-- 4. Atualizar função de criar usuário para salvar perfil no token
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT, p_password TEXT, p_nome_completo TEXT,
  p_telefone TEXT DEFAULT NULL, p_whatsapp BOOLEAN DEFAULT FALSE,
  p_perfil TEXT DEFAULT 'ponto_focal_tecnico', p_unidade_id UUID DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = auth, public
AS $$
DECLARE new_user_id UUID;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'perfil') != 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token,
    email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id, 'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')), NOW(),
    json_build_object('provider','email','providers',array['email'],'perfil',p_perfil)::jsonb,
    '{}', NOW(), NOW(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), new_user_id,
    json_build_object('sub', new_user_id::text, 'email', p_email),
    'email', NOW(), NOW(), NOW()
  );

  INSERT INTO public.perfis_usuarios (
    id, nome_completo, email, telefone, whatsapp, perfil, unidade_id, status
  ) VALUES (
    new_user_id, p_nome_completo, p_email,
    p_telefone, p_whatsapp, p_perfil, p_unidade_id, 'ativo'
  );

  RETURN json_build_object('id', new_user_id, 'email', p_email);
END;
$$;
