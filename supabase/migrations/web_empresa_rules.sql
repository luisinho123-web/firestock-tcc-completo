-- Aplicada ao projeto grvhxufpbvgvgurjaavb em 19/10/2026 (migração `web_empresa_rules`).
-- Já existiam antes: protect_partner_columns (sem autoaprovação), CHECKs de products (desconto 20-90,
-- quantity >= 0, preço original > 0), price_cents gerado e CNPJ único. O que faltava:

-- 1) RN001: validade futura ao criar o produto ou ao trocar a validade.
create or replace function private.check_product_expiry()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.expires_at is distinct from old.expires_at) and new.expires_at <= now() then
    raise exception 'A validade precisa ser uma data futura.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists check_product_expiry on public.products;
create trigger check_product_expiry before insert or update on public.products
for each row execute function private.check_product_expiry();

-- 2) Quem cadastra uma empresa passa a ser `partner` (o cadastro público sempre cria `consumer`).
create or replace function private.set_partner_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set role = 'partner' where id = new.owner_id and role = 'consumer';
  return new;
end;
$$;
revoke execute on function private.set_partner_role() from public, anon, authenticated;
drop trigger if exists set_partner_role on public.partners;
create trigger set_partner_role after insert on public.partners
for each row execute function private.set_partner_role();

-- 3) Fotos: leitura pública; escrita só do dono de empresa APROVADA, na pasta com o id da empresa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
-- (políticas product_images_select_own / insert_own / update_own / delete_own em storage.objects,
--  ver a migração aplicada no projeto)
