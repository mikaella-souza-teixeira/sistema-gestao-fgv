-- =============================================
-- MIGRATION TDRs — Sistema de Gestão FGV
-- Execute no SQL Editor do Supabase
-- =============================================

-- 1. Tabela principal de TDRs
CREATE TABLE IF NOT EXISTS public.tdrs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero        TEXT,
  linha         TEXT,
  tipo          TEXT NOT NULL DEFAULT 'PF' CHECK (tipo IN ('PF','PJ')),
  objeto        TEXT,
  descricao     TEXT,
  formacao      TEXT,
  experiencia   TEXT,
  prazo_limite  DATE,
  data_contratacao DATE,
  observacoes   TEXT,
  status        TEXT NOT NULL DEFAULT 'rascunho'
                CHECK (status IN ('rascunho','revisao_interna','ajustes','enviado_unesco','retorno_unesco','aprovado','cancelado')),
  versao        INTEGER DEFAULT 1,
  valor_rs      NUMERIC(14,2),
  valor_us      NUMERIC(14,2),
  google_drive_url TEXT,
  usuario_id    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Histórico de versões
CREATE TABLE IF NOT EXISTS public.tdrs_versoes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tdr_id     UUID REFERENCES public.tdrs(id) ON DELETE CASCADE,
  versao     INTEGER NOT NULL,
  dados      JSONB NOT NULL,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Comentários de revisão
CREATE TABLE IF NOT EXISTS public.tdrs_revisoes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tdr_id     UUID REFERENCES public.tdrs(id) ON DELETE CASCADE,
  comentario TEXT NOT NULL,
  autor_id   UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS
ALTER TABLE public.tdrs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdrs_versoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdrs_revisoes ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ler e criar TDRs
CREATE POLICY "tdrs_select" ON public.tdrs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tdrs_insert" ON public.tdrs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "tdrs_update" ON public.tdrs
  FOR UPDATE TO authenticated USING (true);

-- Versões
CREATE POLICY "tdrs_versoes_all" ON public.tdrs_versoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Revisões
CREATE POLICY "tdrs_revisoes_all" ON public.tdrs_revisoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
