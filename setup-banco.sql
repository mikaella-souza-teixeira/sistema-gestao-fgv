-- =============================================
-- SISTEMA DE GESTÃO FGV - Configuração do Banco
-- =============================================

-- 1. Tabela de Unidades
CREATE TABLE IF NOT EXISTS public.unidades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  instituicao TEXT NOT NULL CHECK (instituicao IN ('SEMA', 'ICMBIO')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.unidades (nome, instituicao) VALUES
  ('DEUC', 'SEMA'), ('DEBIO', 'SEMA'), ('FUNTAC', 'SEMA'),
  ('DESIL', 'SEMA'), ('CIGMA', 'SEMA'),
  ('NGI NOVO AIRAO', 'ICMBIO'), ('NGI TEFÉ', 'ICMBIO'),
  ('CBC', 'ICMBIO'), ('DSAM', 'ICMBIO'), ('COMAG', 'ICMBIO')
ON CONFLICT DO NOTHING;

-- 2. Tabela de Perfis de Usuários
CREATE TABLE IF NOT EXISTS public.perfis_usuarios (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  whatsapp BOOLEAN DEFAULT FALSE,
  perfil TEXT NOT NULL CHECK (perfil IN ('administrador', 'ponto_focal_sema', 'ponto_focal_icmbio', 'ponto_focal_tecnico')),
  unidade_id UUID REFERENCES public.unidades(id),
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Histórico de Acesso
CREATE TABLE IF NOT EXISTS public.historico_acesso (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entrada TIMESTAMPTZ DEFAULT NOW(),
  saida TIMESTAMPTZ
);

-- 4. Ativar proteção de dados (RLS)
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_acesso ENABLE ROW LEVEL SECURITY;

-- 5. Regras de acesso - Unidades
CREATE POLICY "unidades_leitura" ON public.unidades
  FOR SELECT TO authenticated USING (true);

-- 6. Regras de acesso - Perfis
CREATE POLICY "perfis_admin" ON public.perfis_usuarios
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.perfis_usuarios p
    WHERE p.id = auth.uid() AND p.perfil = 'administrador'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.perfis_usuarios p
    WHERE p.id = auth.uid() AND p.perfil = 'administrador'
  ));

CREATE POLICY "perfis_proprio" ON public.perfis_usuarios
  FOR SELECT TO authenticated USING (id = auth.uid());

-- 7. Regras de acesso - Histórico
CREATE POLICY "historico_admin" ON public.historico_acesso
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.perfis_usuarios p
    WHERE p.id = auth.uid() AND p.perfil = 'administrador'
  ));

CREATE POLICY "historico_proprio_insert" ON public.historico_acesso
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "historico_proprio_update" ON public.historico_acesso
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid());

CREATE POLICY "historico_proprio_select" ON public.historico_acesso
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());

-- 8. Função para criar usuário (somente admins)
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT, p_password TEXT, p_nome_completo TEXT,
  p_telefone TEXT DEFAULT NULL, p_whatsapp BOOLEAN DEFAULT FALSE,
  p_perfil TEXT DEFAULT 'ponto_focal_tecnico', p_unidade_id UUID DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = auth, public
AS $$
DECLARE new_user_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.perfis_usuarios
    WHERE id = auth.uid() AND perfil = 'administrador' AND status = 'ativo'
  ) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

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
    '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), new_user_id,
    json_build_object('sub', new_user_id::text, 'email', p_email),
    'email', NOW(), NOW(), NOW()
  );

  INSERT INTO public.perfis_usuarios (
    id, nome_completo, email, telefone,
    whatsapp, perfil, unidade_id, status
  ) VALUES (
    new_user_id, p_nome_completo, p_email,
    p_telefone, p_whatsapp, p_perfil, p_unidade_id, 'ativo'
  );

  RETURN json_build_object('id', new_user_id, 'email', p_email);
END;
$$;

-- 9. Função para alterar senha (somente admins)
CREATE OR REPLACE FUNCTION public.admin_update_password(
  p_user_id UUID, p_nova_senha TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = auth, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.perfis_usuarios
    WHERE id = auth.uid() AND perfil = 'administrador' AND status = 'ativo'
  ) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_nova_senha, gen_salt('bf')), updated_at = NOW()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;
