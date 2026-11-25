-- Corrige "column reference \"acta_id\" is ambiguous" al CORREGIR un acta.
--
-- guardar_acta declara `returns table (acta_id uuid, version integer)`; en
-- PL/pgSQL esas columnas de salida son variables. En la rama de corrección,
-- `delete from public.votos where acta_id = v_acta_id` no podía distinguir la
-- columna votos.acta_id de la variable de salida acta_id, y toda corrección
-- (en línea o desde la cola offline) fallaba. El alta de actas nuevas no pasa
-- por esa línea, por eso sí funcionaba.
--
-- Única diferencia con 20261124000000_actas_results.sql: el DELETE califica la
-- columna con un alias. El resto de la función se mantiene idéntico.

begin;

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

    delete from public.votos as voto_anterior
    where voto_anterior.acta_id = v_acta_id;
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

commit;
