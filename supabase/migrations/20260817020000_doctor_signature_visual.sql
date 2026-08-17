-- Assinatura VISUAL do médico (representação gráfica: nome digitado, imagem ou desenho).
-- NÃO é assinatura digital ICP-Brasil — apenas aparência no documento. Aditiva e reversível.
alter table public.doctors add column if not exists signature_visual jsonb;
