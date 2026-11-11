-- New tables/functions only. No ALTER/UPDATE/DELETE of existing tables.
begin;
create table public.syndic_platform_admins (
 user_id uuid primary key references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create table public.syndic_subscription_records (
 organization_id uuid primary key references public.syndic_organizations(id) on delete restrict,
 plan text not null check(plan in ('essentiel','pro','business')),
 status text not null check(status in ('trialing','active','past_due','canceled','expired','suspended')),
 ends_at timestamptz not null,
 note text not null check(char_length(trim(note)) between 5 and 500),
 updated_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now()
);
create table public.syndic_subscription_history (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.syndic_organizations(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 previous_value jsonb, new_value jsonb not null, created_at timestamptz not null default now()
);
create table public.syndic_resident_invitations (
 id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.syndic_units(id) on delete restrict,
 email text not null check(email=lower(trim(email)) and char_length(email)<=254 and position('@' in email)>1),
 invited_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz, revoked_at timestamptz
);
create index syndic_invitation_email_idx on public.syndic_resident_invitations(email);
create table public.syndic_resident_access (
 unit_id uuid not null references public.syndic_units(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 invitation_id uuid not null unique references public.syndic_resident_invitations(id) on delete restrict,
 created_at timestamptz not null default now(), revoked_at timestamptz,
 primary key(unit_id,user_id)
);
create index syndic_resident_user_idx on public.syndic_resident_access(user_id);
create table public.syndic_residence_posts (
 id uuid primary key default gen_random_uuid(), residence_id uuid not null references public.syndic_residences(id) on delete restrict,
 author_id uuid not null references auth.users(id) on delete restrict,
 title text not null check(char_length(trim(title)) between 3 and 160),
 body text not null check(char_length(trim(body)) between 3 and 5000), created_at timestamptz not null default now()
);
create index syndic_posts_residence_idx on public.syndic_residence_posts(residence_id);
alter table public.syndic_platform_admins enable row level security;
alter table public.syndic_subscription_records enable row level security;
alter table public.syndic_subscription_history enable row level security;
alter table public.syndic_resident_invitations enable row level security;
alter table public.syndic_resident_access enable row level security;
alter table public.syndic_residence_posts enable row level security;
revoke all on public.syndic_platform_admins,public.syndic_subscription_records,public.syndic_subscription_history,public.syndic_resident_invitations,public.syndic_resident_access,public.syndic_residence_posts from anon,authenticated;
grant select on public.syndic_platform_admins,public.syndic_subscription_records,public.syndic_subscription_history,public.syndic_resident_invitations,public.syndic_resident_access,public.syndic_residence_posts to authenticated;
create function public.syndic_is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.syndic_platform_admins where user_id=auth.uid());
$$;
create function public.syndic_manages_residence(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.syndic_residences r join public.syndic_organization_members m on m.organization_id=r.organization_id where r.id=target and m.user_id=auth.uid() and m.role in ('admin','manager'));
$$;
create function public.syndic_verified_email() returns text language sql stable security definer set search_path='' as $$
 select lower(email) from auth.users where id=auth.uid() and email_confirmed_at is not null;
$$;
create policy syndic_platform_self on public.syndic_platform_admins for select to authenticated using(user_id=auth.uid());
create policy syndic_sub_read on public.syndic_subscription_records for select to authenticated using(public.syndic_is_platform_admin() or exists(select 1 from public.syndic_organization_members m where m.organization_id=syndic_subscription_records.organization_id and m.user_id=auth.uid()));
create policy syndic_history_admin on public.syndic_subscription_history for select to authenticated using(public.syndic_is_platform_admin());
create policy syndic_invitation_read on public.syndic_resident_invitations for select to authenticated using(email=public.syndic_verified_email() or exists(select 1 from public.syndic_units u where u.id=unit_id and public.syndic_manages_residence(u.residence_id)));
create policy syndic_access_read on public.syndic_resident_access for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.syndic_units u where u.id=unit_id and public.syndic_manages_residence(u.residence_id)));
create policy syndic_posts_read on public.syndic_residence_posts for select to authenticated using(public.syndic_manages_residence(residence_id) or exists(select 1 from public.syndic_resident_access a join public.syndic_units u on u.id=a.unit_id where a.user_id=auth.uid() and a.revoked_at is null and u.residence_id=syndic_residence_posts.residence_id));
-- Residents use a narrowly scoped RPC: existing unit/residence policies remain untouched.
create function public.syndic_my_resident_space() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('units',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'label',u.label,'residence',r.name,'residence_id',r.id,'city',r.city)) from public.syndic_resident_access a join public.syndic_units u on u.id=a.unit_id join public.syndic_residences r on r.id=u.residence_id where a.user_id=auth.uid() and a.revoked_at is null),'[]'::jsonb),
 'posts',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'body',p.body,'created_at',p.created_at,'residence_id',p.residence_id) order by p.created_at desc) from public.syndic_residence_posts p where exists(select 1 from public.syndic_resident_access a join public.syndic_units u on u.id=a.unit_id where a.user_id=auth.uid() and a.revoked_at is null and u.residence_id=p.residence_id)),'[]'::jsonb));
$$;
create function public.syndic_admin_organizations() returns table(id uuid,name text,created_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.syndic_is_platform_admin() then raise exception 'Forbidden'; end if;
 return query select o.id,o.name,o.created_at from public.syndic_organizations o order by o.created_at desc;
end;$$;
create function public.syndic_set_subscription(target uuid,selected_plan text,selected_status text,end_date timestamptz,reason text) returns void language plpgsql security definer set search_path='' as $$
declare old_record jsonb; new_record jsonb;
begin
 if not public.syndic_is_platform_admin() then raise exception 'Forbidden'; end if;
 perform 1 from public.syndic_organizations where id=target for update;
 if not found then raise exception 'Unknown organization'; end if;
 select to_jsonb(s) into old_record from public.syndic_subscription_records s where organization_id=target;
 if selected_status in ('active','trialing') and end_date<=now() then raise exception 'Future end date required'; end if;
 insert into public.syndic_subscription_records(organization_id,plan,status,ends_at,note,updated_by) values(target,selected_plan,selected_status,end_date,trim(reason),auth.uid())
 on conflict(organization_id) do update set plan=excluded.plan,status=excluded.status,ends_at=excluded.ends_at,note=excluded.note,updated_by=excluded.updated_by,updated_at=now();
 select to_jsonb(s) into new_record from public.syndic_subscription_records s where organization_id=target;
 insert into public.syndic_subscription_history(organization_id,actor_id,previous_value,new_value) values(target,auth.uid(),old_record,new_record);
end;$$;
create function public.syndic_invite_resident(target_unit uuid,resident_email text) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation uuid; residence uuid;
begin
 select residence_id into residence from public.syndic_units where id=target_unit;
 if not public.syndic_manages_residence(residence) then raise exception 'Forbidden'; end if;
 insert into public.syndic_resident_invitations(unit_id,email,invited_by) values(target_unit,lower(trim(resident_email)),auth.uid()) returning id into invitation;
 return invitation;
end;$$;
create function public.syndic_accept_invitation(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare invitation public.syndic_resident_invitations;
begin
 select * into invitation from public.syndic_resident_invitations where id=target for update;
 if not found or invitation.email is distinct from public.syndic_verified_email() or invitation.expires_at<=now() or invitation.revoked_at is not null or invitation.accepted_at is not null then raise exception 'Invalid invitation'; end if;
 insert into public.syndic_resident_access(unit_id,user_id,invitation_id) values(invitation.unit_id,auth.uid(),invitation.id)
 on conflict(unit_id,user_id) do update set revoked_at=null,invitation_id=excluded.invitation_id;
 update public.syndic_resident_invitations set accepted_at=now() where id=target;
end;$$;
create function public.syndic_revoke_invitation(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare residence uuid;
begin
 select u.residence_id into residence from public.syndic_resident_invitations i join public.syndic_units u on u.id=i.unit_id where i.id=target for update of i;
 if not public.syndic_manages_residence(residence) then raise exception 'Forbidden'; end if;
 update public.syndic_resident_invitations set revoked_at=now() where id=target;
 update public.syndic_resident_access set revoked_at=now() where invitation_id=target;
end;$$;
create function public.syndic_publish_post(target_residence uuid,post_title text,post_body text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.syndic_manages_residence(target_residence) then raise exception 'Forbidden'; end if;
 insert into public.syndic_residence_posts(residence_id,author_id,title,body) values(target_residence,auth.uid(),trim(post_title),trim(post_body));
end;$$;
revoke all on function public.syndic_is_platform_admin(),public.syndic_manages_residence(uuid),public.syndic_verified_email(),public.syndic_my_resident_space(),public.syndic_admin_organizations(),public.syndic_set_subscription(uuid,text,text,timestamptz,text),public.syndic_invite_resident(uuid,text),public.syndic_accept_invitation(uuid),public.syndic_revoke_invitation(uuid),public.syndic_publish_post(uuid,text,text) from public,anon;
grant execute on function public.syndic_is_platform_admin(),public.syndic_manages_residence(uuid),public.syndic_verified_email(),public.syndic_my_resident_space(),public.syndic_admin_organizations(),public.syndic_set_subscription(uuid,text,text,timestamptz,text),public.syndic_invite_resident(uuid,text),public.syndic_accept_invitation(uuid),public.syndic_revoke_invitation(uuid),public.syndic_publish_post(uuid,text,text) to authenticated;
commit;
