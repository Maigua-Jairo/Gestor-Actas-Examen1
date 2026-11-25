begin;

-- =====================================================================
-- 1. Alcance por rol (opción A: el veedor tiene recinto_id)
-- =====================================================================
alter table public.perfiles drop constraint if exists perfil_alcance_por_rol;
alter table public.perfiles add constraint perfil_alcance_por_rol check (
  (rol = 'provincial' and recinto_id is null and provincia is not null)
  or
  (rol in ('recinto', 'veedor') and recinto_id is not null and provincia is not null)
);

create unique index if not exists un_coordinador_recinto_por_recinto
  on public.perfiles (recinto_id)
  where rol = 'recinto';

-- =====================================================================
-- 2. Funciones auxiliares (security definer evita recursión en RLS)
-- =====================================================================
create or replace function public.current_profile_role()
returns text language sql stable security definer set search_path = ''
as $$
  select p.rol::text from public.perfiles p
  where p.id = (select auth.uid()) limit 1;
$$;

create or replace function public.current_profile_provincia()
returns text language sql stable security definer set search_path = ''
as $$
  select p.provincia from public.perfiles p
  where p.id = (select auth.uid()) limit 1;
$$;

create or replace function public.current_profile_recinto()
returns uuid language sql stable security definer set search_path = ''
as $$
  select p.recinto_id from public.perfiles p
  where p.id = (select auth.uid()) limit 1;
$$;

create or replace function public.puede_ver_mesa(p_mesa uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.mesas m
    join public.recintos r on r.id = m.recinto_id
    where m.id = p_mesa
      and (
        ((select public.current_profile_role()) = 'provincial'
          and r.provincia = (select public.current_profile_provincia()))
        or
        ((select public.current_profile_role()) = 'recinto'
          and r.id = (select public.current_profile_recinto()))
        or
        ((select public.current_profile_role()) = 'veedor'
          and exists (
            select 1 from public.asignaciones_veedor a
            where a.mesa_id = m.id
              and a.veedor_id = (select auth.uid())
              and a.activa
          ))
      )
  );
$$;

create or replace function public.puede_gestionar_mesa(p_mesa uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.mesas m
    where m.id = p_mesa
      and (select public.current_profile_role()) = 'recinto'
      and m.recinto_id = (select public.current_profile_recinto())
  );
$$;

create or replace function public.es_veedor_de_mi_recinto(p_veedor uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = p_veedor
      and p.rol = 'veedor'
      and p.recinto_id = (select public.current_profile_recinto())
  );
$$;

revoke all on function public.current_profile_role() from public, anon;
revoke all on function public.current_profile_provincia() from public, anon;
revoke all on function public.current_profile_recinto() from public, anon;
revoke all on function public.puede_ver_mesa(uuid) from public, anon;
revoke all on function public.puede_gestionar_mesa(uuid) from public, anon;
revoke all on function public.es_veedor_de_mi_recinto(uuid) from public, anon;

grant execute on function public.current_profile_role() to authenticated, service_role;
grant execute on function public.current_profile_provincia() to authenticated, service_role;
grant execute on function public.current_profile_recinto() to authenticated, service_role;
grant execute on function public.puede_ver_mesa(uuid) to authenticated, service_role;
grant execute on function public.puede_gestionar_mesa(uuid) to authenticated, service_role;
grant execute on function public.es_veedor_de_mi_recinto(uuid) to authenticated, service_role;

-- =====================================================================
-- 3. Trigger: al cambiar la clave, debe_cambiar_clave pasa a false
-- =====================================================================
create or replace function public.mark_profile_password_changed()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.perfiles set debe_cambiar_clave = false where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.mark_profile_password_changed() from public, anon, authenticated;

drop trigger if exists auth_user_password_changed on auth.users;
create trigger auth_user_password_changed
after update of encrypted_password on auth.users
for each row execute function public.mark_profile_password_changed();

-- =====================================================================
-- 4. RLS, grants y políticas: perfiles y recintos
-- =====================================================================
alter table public.perfiles enable row level security;
alter table public.recintos enable row level security;

revoke all on table public.perfiles from public, anon, authenticated;
revoke all on table public.recintos from public, anon, authenticated;
grant select on table public.perfiles to authenticated;
grant select, insert on table public.recintos to authenticated;
grant all on table public.perfiles to service_role;
grant all on table public.recintos to service_role;

drop policy if exists "ver mi perfil" on public.perfiles;
drop policy if exists "profiles_read_account_scope" on public.perfiles;
create policy "profiles_read_account_scope" on public.perfiles
for select to authenticated
using (
  id = (select auth.uid())
  or (
    (select public.current_profile_role()) = 'provincial'
    and provincia = (select public.current_profile_provincia())
  )
  or (
    (select public.current_profile_role()) = 'recinto'
    and recinto_id = (select public.current_profile_recinto())
  )
);

drop policy if exists "recintos_read_account_scope" on public.recintos;
create policy "recintos_read_account_scope" on public.recintos
for select to authenticated
using (
  (
    (select public.current_profile_role()) = 'provincial'
    and provincia = (select public.current_profile_provincia())
  )
  or (
    (select public.current_profile_role()) in ('recinto', 'veedor')
    and id = (select public.current_profile_recinto())
  )
);

drop policy if exists "recintos_insert_provincial_scope" on public.recintos;
create policy "recintos_insert_provincial_scope" on public.recintos
for insert to authenticated
with check (
  (select public.current_profile_role()) = 'provincial'
  and provincia = (select public.current_profile_provincia())
);

-- =====================================================================
-- 5. Mesas y asignaciones de veedores
-- =====================================================================
alter table public.mesas enable row level security;
alter table public.asignaciones_veedor enable row level security;

-- Una mesa solo puede tener un veedor activo a la vez (S-05)
create unique index if not exists una_asignacion_activa_por_mesa
  on public.asignaciones_veedor (mesa_id) where activa;

revoke all on table public.mesas from public, anon, authenticated;
revoke all on table public.asignaciones_veedor from public, anon, authenticated;
grant select on table public.mesas to authenticated;
grant select, insert, update on table public.asignaciones_veedor to authenticated;
grant all on table public.mesas to service_role;
grant all on table public.asignaciones_veedor to service_role;

drop policy if exists "mesas_read_scope" on public.mesas;
create policy "mesas_read_scope" on public.mesas
for select to authenticated
using (public.puede_ver_mesa(id));

drop policy if exists "asignaciones_read_scope" on public.asignaciones_veedor;
create policy "asignaciones_read_scope" on public.asignaciones_veedor
for select to authenticated
using (public.puede_ver_mesa(mesa_id));

-- Solo el coordinador de recinto asigna veedores de su propio recinto (RF-08, RF-20)
drop policy if exists "asignaciones_insert_recinto" on public.asignaciones_veedor;
create policy "asignaciones_insert_recinto" on public.asignaciones_veedor
for insert to authenticated
with check (
  public.puede_gestionar_mesa(mesa_id)
  and public.es_veedor_de_mi_recinto(veedor_id)
  and activa
);

drop policy if exists "asignaciones_update_recinto" on public.asignaciones_veedor;
create policy "asignaciones_update_recinto" on public.asignaciones_veedor
for update to authenticated
using (public.puede_gestionar_mesa(mesa_id))
with check (
  public.puede_gestionar_mesa(mesa_id)
  and public.es_veedor_de_mi_recinto(veedor_id)
);

create or replace function public.asignar_veedor_a_mesa(
  p_mesa_id uuid,
  p_veedor_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.puede_gestionar_mesa(p_mesa_id) then
    raise exception 'No tiene autorizacion para asignar esta mesa.'
      using errcode = '42501';
  end if;

  if not public.es_veedor_de_mi_recinto(p_veedor_id) then
    raise exception 'El veedor no pertenece a su recinto.'
      using errcode = '42501';
  end if;

  update public.asignaciones_veedor
  set activa = false
  where mesa_id = p_mesa_id
    and activa;

  insert into public.asignaciones_veedor (mesa_id, veedor_id, activa)
  values (p_mesa_id, p_veedor_id, true);
end;
$$;

revoke all on function public.asignar_veedor_a_mesa(uuid, uuid)
from public, anon;
grant execute on function public.asignar_veedor_a_mesa(uuid, uuid)
to authenticated, service_role;

commit;