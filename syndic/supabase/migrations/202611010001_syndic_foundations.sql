-- Additive migration: preserves existing application tables and auth triggers.
begin;
create table public.syndic_organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(char_length(trim(name)) between 2 and 120),
 created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now()
);
create table public.syndic_organization_members (
 organization_id uuid not null references public.syndic_organizations(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 role text not null check(role in ('admin','manager','viewer')), created_at timestamptz not null default now(), primary key(organization_id,user_id)
);
create index syndic_members_user_idx on public.syndic_organization_members(user_id);
create table public.syndic_residences (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.syndic_organizations(id) on delete restrict,
 name text not null check(char_length(trim(name)) between 2 and 120), address text not null check(char_length(trim(address)) between 4 and 300),
 city text not null check(char_length(trim(city)) between 2 and 80), currency text not null default 'MAD' check(currency='MAD'), created_at timestamptz not null default now()
);
create index syndic_residences_org_idx on public.syndic_residences(organization_id);
create table public.syndic_units (
 id uuid primary key default gen_random_uuid(), residence_id uuid not null references public.syndic_residences(id) on delete restrict,
 label text not null check(char_length(trim(label)) between 1 and 60), kind text not null check(kind in ('apartment','shop','parking')),
 share numeric(14,4) not null check(share>0 and share<=1000000), created_at timestamptz not null default now(), unique(residence_id,label)
);
alter table public.syndic_organizations enable row level security;
alter table public.syndic_organization_members enable row level security;
alter table public.syndic_residences enable row level security;
alter table public.syndic_units enable row level security;
revoke all on public.syndic_organizations,public.syndic_organization_members,public.syndic_residences,public.syndic_units from anon,authenticated;
grant select on public.syndic_organizations,public.syndic_organization_members to authenticated;
grant select,insert on public.syndic_residences,public.syndic_units to authenticated;
create policy syndic_members_self on public.syndic_organization_members for select to authenticated using(user_id=(select auth.uid()));
create policy syndic_org_read on public.syndic_organizations for select to authenticated using(exists(select 1 from public.syndic_organization_members m where m.organization_id=id and m.user_id=(select auth.uid())));
create policy syndic_residence_read on public.syndic_residences for select to authenticated using(exists(select 1 from public.syndic_organization_members m where m.organization_id=syndic_residences.organization_id and m.user_id=(select auth.uid())));
create policy syndic_residence_create on public.syndic_residences for insert to authenticated with check(exists(select 1 from public.syndic_organization_members m where m.organization_id=syndic_residences.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));
create policy syndic_unit_read on public.syndic_units for select to authenticated using(exists(select 1 from public.syndic_residences r where r.id=residence_id));
create policy syndic_unit_create on public.syndic_units for insert to authenticated with check(exists(select 1 from public.syndic_residences r join public.syndic_organization_members m on m.organization_id=r.organization_id where r.id=residence_id and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));
create function public.syndic_create_organization(organization_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare new_id uuid; caller uuid:=auth.uid();
begin
 if caller is null then raise exception 'Authentication required'; end if;
 if char_length(trim(organization_name)) not between 2 and 120 or organization_name is null then raise exception 'Invalid organization name'; end if;
 insert into public.syndic_organizations(name,created_by) values(trim(organization_name),caller) returning id into new_id;
 insert into public.syndic_organization_members(organization_id,user_id,role) values(new_id,caller,'admin');
 return new_id;
end;
$$;
revoke all on function public.syndic_create_organization(text) from public,anon;
grant execute on function public.syndic_create_organization(text) to authenticated;
commit;
