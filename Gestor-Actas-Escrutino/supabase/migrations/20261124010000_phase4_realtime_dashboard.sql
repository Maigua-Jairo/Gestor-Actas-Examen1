begin;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'actas'
    ) then
      alter publication supabase_realtime add table public.actas;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'votos'
    ) then
      alter publication supabase_realtime add table public.votos;
    end if;
  end if;
end;
$$;

commit;
