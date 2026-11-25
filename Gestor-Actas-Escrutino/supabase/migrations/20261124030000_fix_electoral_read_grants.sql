begin;

revoke all on table public.organizaciones, public.candidatos
from anon;
grant select on table public.organizaciones, public.candidatos
to authenticated;

commit;
