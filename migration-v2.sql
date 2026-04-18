-- =============================================
-- MIGRATION V2 — Sistema de Gestão FGV
-- Execute este arquivo no SQL Editor do Supabase
-- =============================================

-- 1. Novas colunas na tabela passagens_diarias
ALTER TABLE public.passagens_diarias
  ADD COLUMN IF NOT EXISTS grupo_id UUID,
  ADD COLUMN IF NOT EXISTS data_aprovacao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prazo_prestacao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anexo_declaracao_url TEXT,
  ADD COLUMN IF NOT EXISTS anexo_relatorio_url TEXT;

-- Atualizar constraint de status para incluir novos estados
ALTER TABLE public.passagens_diarias
  DROP CONSTRAINT IF EXISTS passagens_diarias_status_check;

ALTER TABLE public.passagens_diarias
  ADD CONSTRAINT passagens_diarias_status_check
  CHECK (status IN ('rascunho','enviado','aprovado','cancelado','aguardando_prestacao','prestacao_entregue'));

-- 2. Tabela de Notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  referencia_id UUID,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Admins veem todas as notificações
CREATE POLICY "notificacoes_admin" ON public.notificacoes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.perfis_usuarios p
    WHERE p.id = auth.uid() AND p.perfil = 'administrador'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.perfis_usuarios p
    WHERE p.id = auth.uid() AND p.perfil = 'administrador'
  ));

-- Qualquer usuário autenticado pode inserir notificações
CREATE POLICY "notificacoes_insert" ON public.notificacoes
  FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Bucket de Storage para anexos de prestação de contas
-- Execute no painel Storage do Supabase:
-- Criar bucket "anexos" com acesso público

-- 4. Policy de storage (após criar o bucket "anexos")
-- INSERT INTO storage.buckets (id, name, public) VALUES ('anexos', 'anexos', true)
-- ON CONFLICT DO NOTHING;

-- CREATE POLICY "anexos_upload" ON storage.objects
--   FOR INSERT TO authenticated WITH CHECK (bucket_id = 'anexos');

-- CREATE POLICY "anexos_read" ON storage.objects
--   FOR SELECT TO authenticated USING (bucket_id = 'anexos');
