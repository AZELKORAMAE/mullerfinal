begin;
create table public.syndic_join_links (
 id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.syndic_units(id),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '7 days',
 revoked_at timestamptz,used_by uuid references auth.users(id),invitation_id uuid references public.syndic_resident_invitations(id),reservation uuid,reserved_until timestamptz
);
alter table public.syndic_join_links enable row level security;
revoke all on public.syndic_join_links from anon,authenticated;
grant select on public.syndic_join_links to authenticated;
create policy syndic_join_manager on public.syndic_join_links for select to authenticated using(exists(select 1 from public.syndic_units u where u.id=unit_id and public.syndic_manages_residence(u.residence_id)));
create function public.syndic_create_join_link(target_unit uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare residence uuid; result uuid;
begin
 select residence_id into residence from public.syndic_units where id=target_unit;
 if not public.syndic_manages_residence(residence) then raise exception 'Forbidden'; end if;
 if (select count(*) from public.syndic_join_links where created_by=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'Too many invitations'; end if;
 insert into public.syndic_join_links(unit_id,created_by) values(target_unit,auth.uid()) returning id into result;return result;
end;$$;
create function public.syndic_reserve_join_link(token uuid,attempt uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.syndic_join_links set reservation=attempt,reserved_until=now()+interval '5 minutes' where id=token and used_by is null and revoked_at is null and expires_at>now() and (reserved_until is null or reserved_until<now());return found;
end;$$;
create function public.syndic_release_join_link(token uuid,attempt uuid) returns void language sql security definer set search_path='' as $$update public.syndic_join_links set reservation=null,reserved_until=null where id=token and reservation=attempt and used_by is null;$$;
create function public.syndic_finish_join_link(token uuid,attempt uuid,account_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare link public.syndic_join_links; invitation uuid; mail text;
begin
 select * into link from public.syndic_join_links where id=token for update;
 if not found or link.used_by is not null or link.revoked_at is not null or link.expires_at<=now() or link.reservation is distinct from attempt or link.reserved_until<=now() then raise exception 'Invalid invitation';end if;
 select lower(email) into mail from auth.users where id=account_id and email_confirmed_at is not null;
 if mail is null then raise exception 'Invalid account';end if;
 insert into public.syndic_resident_invitations(unit_id,email,invited_by,accepted_at) values(link.unit_id,mail,link.created_by,now()) returning id into invitation;
 insert into public.syndic_resident_access(unit_id,user_id,invitation_id) values(link.unit_id,account_id,invitation);
 update public.syndic_join_links set used_by=account_id,invitation_id=invitation,reservation=null,reserved_until=null where id=token;
end;$$;
create function public.syndic_revoke_join_link(token uuid) returns void language plpgsql security definer set search_path='' as $$
declare link public.syndic_join_links; residence uuid;
begin
 select * into link from public.syndic_join_links where id=token for update;
 select residence_id into residence from public.syndic_units where id=link.unit_id;
 if not public.syndic_manages_residence(residence) then raise exception 'Forbidden';end if;
 update public.syndic_join_links set revoked_at=now() where id=token;
 if link.invitation_id is not null then perform public.syndic_revoke_invitation(link.invitation_id);end if;
end;$$;
revoke all on function public.syndic_create_join_link(uuid),public.syndic_revoke_join_link(uuid) from public,anon;
grant execute on function public.syndic_create_join_link(uuid),public.syndic_revoke_join_link(uuid) to authenticated;
revoke all on function public.syndic_reserve_join_link(uuid,uuid),public.syndic_release_join_link(uuid,uuid),public.syndic_finish_join_link(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.syndic_reserve_join_link(uuid,uuid),public.syndic_release_join_link(uuid,uuid),public.syndic_finish_join_link(uuid,uuid,uuid) to service_role;
grant select on public.syndic_join_links,public.syndic_units,public.syndic_residences,public.syndic_organizations to service_role;
commit;
