-- =============================================
-- MIGRATION Aquisições — Sistema de Gestão FGV
-- Execute no SQL Editor do Supabase
-- =============================================

-- 1. Tabela principal de Aquisições (cabeçalho do pacote)
CREATE TABLE IF NOT EXISTS public.aquisicoes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_demanda  TEXT,
  tipo            TEXT NOT NULL DEFAULT 'pequenas_compras'
                  CHECK (tipo IN ('adiantamento_recursos', 'pequenas_compras')),
  unidade_id      UUID REFERENCES public.unidades(id),
  status          TEXT NOT NULL DEFAULT 'rascunho'
                  CHECK (status IN ('rascunho','enviado','aprovado','cancelado')),
  observacoes     TEXT,
  itens           JSONB DEFAULT '[]'::jsonb,
  -- itens é um array de objetos:
  -- { nome, valor, fornecedor, nota_fiscal_url, fotos_urls: [] }
  usuario_id      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE public.aquisicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aquisicoes_select" ON public.aquisicoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "aquisicoes_insert" ON public.aquisicoes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "aquisicoes_update" ON public.aquisicoes
  FOR UPDATE TO authenticated USING (true);
