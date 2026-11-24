-- Aprovar / recusar empresas pelo web-admin (RF017, RN008).
-- Rode no SQL Editor do Supabase (projeto grvhxufpbvgvgurjaavb). Pode rodar de novo sem problema (create or replace).
--
-- O admin já podia alterar `partners` pela regra de acesso (partners_update + protect_partner_columns liberam admin),
-- mas a decisão passa por esta função para gravar sempre o conjunto certo de colunas:
--   aprovar -> status 'approved', approved_at = agora, approved_by = admin, motivo apagado
--   recusar -> status 'rejected', motivo obrigatório, approved_at/approved_by apagados
-- Só sai de 'pending' ou 'rejected' (uma empresa recusada pode ser aprovada depois). Empresa aprovada não é recusada
-- aqui: isso tiraria do ar produtos com reservas em aberto, e esse caso (suspensão) ainda não foi tratado.
-- Se existir o gatilho que chama a função `partner-approved-email`, ele dispara normalmente ao aprovar.

create or replace function public.review_partner(p_partner_id uuid, p_approve boolean, p_reason text default null)
returns public.partner_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.partner_status;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_uid is null or not private.is_admin() then
    raise exception 'Só administradores podem aprovar ou recusar empresas.' using errcode = 'P0001';
  end if;

  select p.status into v_status from public.partners p where p.id = p_partner_id for update;
  if not found then
    raise exception 'Empresa não encontrada.' using errcode = 'P0001';
  end if;

  if p_approve then
    if v_status = 'approved' then
      raise exception 'Esta empresa já está aprovada.' using errcode = 'P0001';
    end if;
    update public.partners
       set status = 'approved', approved_at = now(), approved_by = v_uid, rejection_reason = null
     where id = p_partner_id;
    return 'approved';
  end if;

  if v_status <> 'pending' then
    raise exception 'Só cadastros aguardando aprovação podem ser recusados.' using errcode = 'P0001';
  end if;
  if v_reason is null then
    raise exception 'Informe o motivo da recusa.' using errcode = 'P0001';
  end if;
  if length(v_reason) > 500 then
    raise exception 'O motivo pode ter no máximo 500 caracteres.' using errcode = 'P0001';
  end if;

  update public.partners
     set status = 'rejected', rejection_reason = v_reason, approved_at = null, approved_by = null
   where id = p_partner_id;
  return 'rejected';
end;
$$;

revoke execute on function public.review_partner(uuid, boolean, text) from public, anon;
grant execute on function public.review_partner(uuid, boolean, text) to authenticated;
