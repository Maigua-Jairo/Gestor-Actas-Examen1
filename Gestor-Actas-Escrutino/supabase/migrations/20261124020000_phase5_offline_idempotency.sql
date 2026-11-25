begin;

create table if not exists public.acta_operaciones (
  operation_id uuid primary key,
  mesa_id uuid not null references public.mesas(id) on delete restrict,
  dignidad public.dignidad_tipo not null,
  acta_id uuid not null,
  version integer not null,
  resultado jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.acta_operaciones enable row level security;

revoke all on table public.acta_operaciones
from public, anon, authenticated;
grant all on table public.acta_operaciones to service_role;

create or replace function public.guardar_acta_offline(
  p_operation_id uuid,
  p_id uuid,
  p_mesa_id uuid,
  p_dignidad public.dignidad_tipo,
  p_total_sufragantes integer,
  p_votos_blancos integer,
  p_votos_nulos integer,
  p_foto_path text,
  p_latitud double precision,
  p_longitud double precision,
  p_votos jsonb,
  p_version_esperada integer
)
returns table (acta_id uuid, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous public.acta_operaciones%rowtype;
  v_acta_id uuid;
  v_version integer;
begin
  if p_operation_id is null then
    raise exception 'Toda operación offline requiere un identificador único.'
      using errcode = '22023';
  end if;

  select *
  into v_previous
  from public.acta_operaciones
  where operation_id = p_operation_id;

  if found then
    return query
    select
      v_previous.acta_id,
      v_previous.version;
    return;
  end if;

  select result.acta_id, result.version
  into v_acta_id, v_version
  from public.guardar_acta(
    p_id,
    p_mesa_id,
    p_dignidad,
    p_total_sufragantes,
    p_votos_blancos,
    p_votos_nulos,
    p_foto_path,
    p_latitud,
    p_longitud,
    p_votos,
    p_version_esperada
  ) as result(acta_id, version);

  insert into public.acta_operaciones (
    operation_id,
    mesa_id,
    dignidad,
    acta_id,
    version,
    resultado
  )
  values (
    p_operation_id,
    p_mesa_id,
    p_dignidad,
    v_acta_id,
    v_version,
    jsonb_build_object(
      'acta_id', v_acta_id,
      'version', v_version
    )
  );

  return query
  select v_acta_id, v_version;
end;
$$;

revoke all on function public.guardar_acta_offline(
  uuid,
  uuid,
  uuid,
  public.dignidad_tipo,
  integer,
  integer,
  integer,
  text,
  double precision,
  double precision,
  jsonb,
  integer
) from public, anon;

grant execute on function public.guardar_acta_offline(
  uuid,
  uuid,
  uuid,
  public.dignidad_tipo,
  integer,
  integer,
  integer,
  text,
  double precision,
  double precision,
  jsonb,
  integer
) to authenticated;

commit;
