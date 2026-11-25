begin;

create table public.actas (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete restrict,
  dignidad public.dignidad_tipo not null,
  total_sufragantes integer not null check (total_sufragantes >= 0),
  votos_blancos integer not null check (votos_blancos >= 0),
  votos_nulos integer not null check (votos_nulos >= 0),
  foto_path text not null,
  latitud double precision not null check (latitud between -90 and 90),
  longitud double precision not null check (longitud between -180 and 180),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint actas_una_por_mesa_y_dignidad unique (mesa_id, dignidad),
  constraint actas_foto_path_por_mesa
    check (foto_path like mesa_id::text || '/%')
);

create table public.votos (
  acta_id uuid not null references public.actas(id) on delete restrict,
  candidato_id uuid not null references public.candidatos(id) on delete restrict,
  cantidad integer not null check (cantidad >= 0),
  primary key (acta_id, candidato_id)
);

create table public.acta_historial (
  id bigint generated always as identity primary key,
  acta_id uuid not null references public.actas(id) on delete restrict,
  mesa_id uuid not null references public.mesas(id) on delete restrict,
  version integer not null,
  snapshot jsonb not null,
  cambiado_por uuid not null references auth.users(id),
  cambiado_en timestamptz not null default now()
);

create index actas_mesa_id_idx on public.actas (mesa_id);
create index votos_candidato_id_idx on public.votos (candidato_id);
create index acta_historial_mesa_id_idx on public.acta_historial (mesa_id, cambiado_en desc);

create or replace function public.puede_editar_acta(p_mesa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.mesas m
    where m.id = p_mesa_id
      and (
        (
          (select public.current_profile_role()) = 'recinto'
          and m.recinto_id = (select public.current_profile_recinto())
        )
        or (
          (select public.current_profile_role()) = 'veedor'
          and exists (
            select 1
            from public.asignaciones_veedor a
            where a.mesa_id = m.id
              and a.veedor_id = (select auth.uid())
              and a.activa
          )
        )
      )
  );
$$;

create or replace function public.puede_leer_evidencia_acta(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when split_part(p_object_name, '/', 1) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.puede_ver_mesa(split_part(p_object_name, '/', 1)::uuid)
    else false
  end;
$$;

create or replace function public.puede_escribir_evidencia_acta(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when split_part(p_object_name, '/', 1) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.puede_editar_acta(split_part(p_object_name, '/', 1)::uuid)
    else false
  end;
$$;

revoke all on function public.puede_editar_acta(uuid) from public, anon;
revoke all on function public.puede_leer_evidencia_acta(text) from public, anon;
revoke all on function public.puede_escribir_evidencia_acta(text) from public, anon;
grant execute on function public.puede_editar_acta(uuid) to authenticated, service_role;
grant execute on function public.puede_leer_evidencia_acta(text) to authenticated, service_role;
grant execute on function public.puede_escribir_evidencia_acta(text) to authenticated, service_role;

alter table public.actas enable row level security;
alter table public.votos enable row level security;
alter table public.acta_historial enable row level security;

revoke all on table public.actas, public.votos, public.acta_historial
from public, anon, authenticated;
grant select on table public.actas, public.votos, public.acta_historial
to authenticated;
grant all on table public.actas, public.votos, public.acta_historial
to service_role;

create policy "actas_read_scope" on public.actas
for select to authenticated
using (public.puede_ver_mesa(mesa_id));

create policy "votos_read_scope" on public.votos
for select to authenticated
using (
  exists (
    select 1
    from public.actas a
    where a.id = acta_id
      and public.puede_ver_mesa(a.mesa_id)
  )
);

create policy "acta_historial_read_scope" on public.acta_historial
for select to authenticated
using (public.puede_ver_mesa(mesa_id));

create or replace function public.guardar_acta(
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
  v_role text;
  v_acta public.actas%rowtype;
  v_acta_id uuid;
  v_version integer;
  v_votos_count bigint;
  v_votos_distintos bigint;
  v_votos_total bigint;
  v_candidatos_esperados bigint;
  v_candidatos_invalidos bigint;
begin
  v_role := (select public.current_profile_role());

  if not public.puede_editar_acta(p_mesa_id) then
    raise exception 'No tiene autorización para registrar o corregir esta mesa.'
      using errcode = '42501';
  end if;

  if p_id is null and v_role <> 'veedor' then
    raise exception 'Solo el veedor asignado puede crear un acta.'
      using errcode = '42501';
  end if;

  if p_total_sufragantes is null or p_total_sufragantes < 0
    or p_votos_blancos is null or p_votos_blancos < 0
    or p_votos_nulos is null or p_votos_nulos < 0 then
    raise exception 'Los totales no pueden ser negativos ni estar vacíos.'
      using errcode = '22023';
  end if;

  if p_latitud is null or p_latitud < -90 or p_latitud > 90
    or p_longitud is null or p_longitud < -180 or p_longitud > 180 then
    raise exception 'Se requiere una ubicación GPS válida para guardar el acta.'
      using errcode = '22023';
  end if;

  if p_foto_path is null
    or p_foto_path !~ (
      '^' || p_mesa_id::text || '/[A-Za-z0-9._-]+[.]jpg$'
    ) then
    raise exception 'La evidencia debe ser una fotografía JPG de esta mesa.'
      using errcode = '22023';
  end if;

  if p_votos is null or jsonb_typeof(p_votos) <> 'array' then
    raise exception 'Los votos deben incluir una lista válida de candidatos.'
      using errcode = '22023';
  end if;

  select
    count(*),
    count(distinct item.candidato_id),
    coalesce(sum(item.cantidad), 0)
  into v_votos_count, v_votos_distintos, v_votos_total
  from jsonb_to_recordset(p_votos) as item(
    candidato_id uuid,
    cantidad integer
  );

  if v_votos_count = 0 or v_votos_count <> v_votos_distintos then
    raise exception 'Incluye una sola cantidad para cada candidato.'
      using errcode = '22023';
  end if;

  select count(*)
  into v_candidatos_invalidos
  from jsonb_to_recordset(p_votos) as item(
    candidato_id uuid,
    cantidad integer
  )
  left join public.candidatos c on c.id = item.candidato_id
  left join public.organizaciones o on o.id = c.organizacion_id
  where item.candidato_id is null
    or item.cantidad is null
    or item.cantidad < 0
    or item.cantidad > p_total_sufragantes
    or c.id is null
    or c.activo is distinct from true
    or c.dignidad is distinct from p_dignidad
    or o.id is null
    or o.activa is distinct from true;

  if v_candidatos_invalidos > 0 then
    raise exception 'Hay votos inválidos o candidatos que no corresponden a esta dignidad.'
      using errcode = '22023';
  end if;

  select count(*)
  into v_candidatos_esperados
  from public.candidatos c
  join public.organizaciones o on o.id = c.organizacion_id
  where c.dignidad = p_dignidad
    and c.activo
    and o.activa;

  if v_votos_count <> v_candidatos_esperados then
    raise exception 'La lista de candidatos cambió. Actualiza los datos antes de guardar.'
      using errcode = '22023';
  end if;

  if v_votos_total + p_votos_blancos + p_votos_nulos
    <> p_total_sufragantes then
    raise exception 'La suma de votos por candidato, blancos y nulos debe coincidir con los sufragantes.'
      using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.actas (
      mesa_id,
      dignidad,
      total_sufragantes,
      votos_blancos,
      votos_nulos,
      foto_path,
      latitud,
      longitud,
      created_by,
      updated_by
    )
    values (
      p_mesa_id,
      p_dignidad,
      p_total_sufragantes,
      p_votos_blancos,
      p_votos_nulos,
      p_foto_path,
      p_latitud,
      p_longitud,
      (select auth.uid()),
      (select auth.uid())
    )
    returning id, actas.version into v_acta_id, v_version;
  else
    select *
    into v_acta
    from public.actas
    where id = p_id
      and mesa_id = p_mesa_id
      and dignidad = p_dignidad
    for update;

    if not found then
      raise exception 'No se encontró el acta que deseas corregir.'
        using errcode = 'P0002';
    end if;

    if p_version_esperada is null
      or v_acta.version <> p_version_esperada then
      raise exception 'El acta fue modificada por otro usuario. Conserva los valores de este formulario, vuelve a abrir el acta y aplica tu corrección sobre la versión actual.'
        using errcode = '40001';
    end if;

    insert into public.acta_historial (
      acta_id,
      mesa_id,
      version,
      snapshot,
      cambiado_por
    )
    values (
      v_acta.id,
      v_acta.mesa_id,
      v_acta.version,
      to_jsonb(v_acta) || jsonb_build_object(
        'votos',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'candidato_id', v.candidato_id,
                'cantidad', v.cantidad
              )
              order by v.candidato_id
            )
            from public.votos v
            where v.acta_id = v_acta.id
          ),
          '[]'::jsonb
        )
      ),
      (select auth.uid())
    );

    update public.actas as current_acta
    set total_sufragantes = p_total_sufragantes,
        votos_blancos = p_votos_blancos,
        votos_nulos = p_votos_nulos,
        foto_path = p_foto_path,
        latitud = p_latitud,
        longitud = p_longitud,
        version = current_acta.version + 1,
        updated_by = (select auth.uid()),
        updated_at = now()
    where current_acta.id = v_acta.id
    returning current_acta.id, current_acta.version
    into v_acta_id, v_version;

    delete from public.votos where acta_id = v_acta_id;
  end if;

  insert into public.votos (acta_id, candidato_id, cantidad)
  select v_acta_id, item.candidato_id, item.cantidad
  from jsonb_to_recordset(p_votos) as item(
    candidato_id uuid,
    cantidad integer
  );

  return query select v_acta_id, v_version;
end;
$$;

revoke all on function public.guardar_acta(
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
grant execute on function public.guardar_acta(
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

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'evidencias-actas',
  'evidencias-actas',
  false,
  8388608,
  array['image/jpeg']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "actas_evidence_read_scope" on storage.objects;
create policy "actas_evidence_read_scope" on storage.objects
for select to authenticated
using (
  bucket_id = 'evidencias-actas'
  and public.puede_leer_evidencia_acta(name)
);

drop policy if exists "actas_evidence_insert_scope" on storage.objects;
create policy "actas_evidence_insert_scope" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'evidencias-actas'
  and public.puede_escribir_evidencia_acta(name)
);

drop policy if exists "actas_evidence_update_scope" on storage.objects;
create policy "actas_evidence_update_scope" on storage.objects
for update to authenticated
using (
  bucket_id = 'evidencias-actas'
  and public.puede_escribir_evidencia_acta(name)
)
with check (
  bucket_id = 'evidencias-actas'
  and public.puede_escribir_evidencia_acta(name)
);

drop policy if exists "actas_evidence_delete_scope" on storage.objects;
create policy "actas_evidence_delete_scope" on storage.objects
for delete to authenticated
using (
  bucket_id = 'evidencias-actas'
  and public.puede_escribir_evidencia_acta(name)
);

commit;
