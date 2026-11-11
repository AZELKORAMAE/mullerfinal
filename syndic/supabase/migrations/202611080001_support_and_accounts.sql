begin;
create table public.syndic_incidents (
 id uuid primary key default gen_random_uuid(),unit_id uuid not null references public.syndic_units(id),
 reported_by uuid not null references auth.users(id),title text not null check(char_length(trim(title)) between 3 and 160),
 description text not null check(char_length(trim(description)) between 5 and 5000),
 priority text not null check(priority in ('normal','urgent')),
 status text not null default 'open' check(status in ('open','in_progress','resolved')),
 resolution text not null default '' check(char_length(resolution)<=5000),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index syndic_incidents_unit_idx on public.syndic_incidents(unit_id,created_at);
alter table public.syndic_incidents enable row level security;
revoke all on public.syndic_incidents from anon,authenticated;
grant select on public.syndic_incidents to authenticated;
create policy syndic_incident_access on public.syndic_incidents for select to authenticated using(public.syndic_can_access_unit(unit_id));
create function public.syndic_report_incident(target_unit uuid,incident_title text,incident_description text,incident_priority text) returns uuid language plpgsql security definer set search_path='' as $$
declare incident uuid;
begin
 if not public.syndic_can_access_unit(target_unit) then raise exception 'Forbidden'; end if;
 if (select count(*) from public.syndic_incidents where reported_by=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Too many reports'; end if;
 insert into public.syndic_incidents(unit_id,reported_by,title,description,priority) values(target_unit,auth.uid(),trim(incident_title),trim(incident_description),incident_priority) returning id into incident;
 insert into public.syndic_inbox(user_id,unit_id,title,link,dedupe_key)
 select m.user_id,target_unit,'Incident déclaré : '||trim(incident_title),'/operations','incident:'||incident from public.syndic_organization_members m join public.syndic_residences r on r.organization_id=m.organization_id join public.syndic_units u on u.residence_id=r.id where u.id=target_unit and m.role in ('admin','manager') and m.user_id<>auth.uid();
 return incident;
end;$$;
create function public.syndic_update_incident(target_incident uuid,incident_status text,incident_resolution text) returns void language plpgsql security definer set search_path='' as $$
declare incident public.syndic_incidents; residence uuid;
begin
 select * into incident from public.syndic_incidents where id=target_incident for update;
 select residence_id into residence from public.syndic_units where id=incident.unit_id;
 if not public.syndic_manages_residence(residence) then raise exception 'Forbidden'; end if;
 if incident_status='resolved' and char_length(trim(incident_resolution))<5 then raise exception 'Resolution required'; end if;
 update public.syndic_incidents set status=incident_status,resolution=trim(incident_resolution),updated_at=now() where id=target_incident;
 insert into public.syndic_inbox(user_id,unit_id,title,link,dedupe_key) select user_id,incident.unit_id,'Suivi de votre incident : '||incident.title,'/operations','incident-update:'||gen_random_uuid() from public.syndic_resident_access where unit_id=incident.unit_id and revoked_at is null;
end;$$;
-- Atomic resident association. The account itself is created through the Auth API.
create function public.syndic_provision_resident(account_id uuid,target_unit uuid,manager_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare mail text; invitation uuid;
begin
 if not exists(select 1 from public.syndic_units u join public.syndic_residences r on r.id=u.residence_id join public.syndic_organization_members m on m.organization_id=r.organization_id where u.id=target_unit and m.user_id=manager_id and m.role in ('admin','manager')) then raise exception 'Forbidden'; end if;
 select lower(email) into mail from auth.users where id=account_id and email_confirmed_at is not null;
 if mail is null then raise exception 'Confirmed account required'; end if;
 insert into public.syndic_resident_invitations(unit_id,email,invited_by,accepted_at) values(target_unit,mail,manager_id,now()) returning id into invitation;
 insert into public.syndic_resident_access(unit_id,user_id,invitation_id) values(target_unit,account_id,invitation) on conflict(unit_id,user_id) do update set invitation_id=excluded.invitation_id,revoked_at=null;
end;$$;
revoke all on function public.syndic_provision_resident(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.syndic_provision_resident(uuid,uuid,uuid) to service_role;
revoke all on function public.syndic_report_incident(uuid,text,text,text),public.syndic_update_incident(uuid,text,text) from public,anon;
grant execute on function public.syndic_report_incident(uuid,text,text,text),public.syndic_update_incident(uuid,text,text) to authenticated;
commit;
