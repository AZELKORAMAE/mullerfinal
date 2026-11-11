-- Additive operational module. Existing application tables are not altered.
begin;
create function public.syndic_can_access_unit(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.syndic_units u where u.id=target and (public.syndic_manages_residence(u.residence_id) or exists(select 1 from public.syndic_resident_access a where a.unit_id=u.id and a.user_id=auth.uid() and a.revoked_at is null)));
$$;
create function public.syndic_can_access_residence(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.syndic_manages_residence(target) or exists(select 1 from public.syndic_resident_access a join public.syndic_units u on u.id=a.unit_id where u.residence_id=target and a.user_id=auth.uid() and a.revoked_at is null);
$$;
create table public.syndic_expense_entries (
 id uuid primary key default gen_random_uuid(),residence_id uuid not null references public.syndic_residences(id),
 title text not null check(char_length(trim(title)) between 3 and 160), amount_cents bigint not null check(amount_cents>0 and amount_cents<=10000000000),
 due_date date not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.syndic_charge_entries (
 id uuid primary key default gen_random_uuid(),expense_id uuid not null references public.syndic_expense_entries(id),unit_id uuid not null references public.syndic_units(id),
 amount_cents bigint not null check(amount_cents>0),unique(expense_id,unit_id)
);
create table public.syndic_payment_entries (
 id uuid primary key default gen_random_uuid(),charge_id uuid not null references public.syndic_charge_entries(id),amount_cents bigint not null check(amount_cents>0),
 reference text not null check(char_length(trim(reference)) between 3 and 160),paid_on date not null,
 recorded_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(charge_id,reference)
);
create table public.syndic_chat_messages (
 id uuid primary key default gen_random_uuid(),unit_id uuid not null references public.syndic_units(id),sender_id uuid not null references auth.users(id),
 sender_kind text not null check(sender_kind in ('syndic','resident')), body text not null check(char_length(trim(body)) between 1 and 3000),created_at timestamptz not null default now()
);
create index syndic_chat_unit_idx on public.syndic_chat_messages(unit_id,created_at);
create table public.syndic_meetings (
 id uuid primary key default gen_random_uuid(),residence_id uuid not null references public.syndic_residences(id),title text not null check(char_length(trim(title)) between 3 and 160),
 starts_at timestamptz not null,location text not null check(char_length(trim(location)) between 3 and 300),agenda text not null check(char_length(agenda)<=5000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index syndic_meetings_date_idx on public.syndic_meetings(starts_at);
create table public.syndic_inbox (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),unit_id uuid references public.syndic_units(id),residence_id uuid references public.syndic_residences(id),
 title text not null, link text not null check(link in ('/resident','/operations')),dedupe_key text not null,
 created_at timestamptz not null default now(),read_at timestamptz,unique(user_id,dedupe_key)
);
create index syndic_inbox_user_idx on public.syndic_inbox(user_id,created_at);
alter table public.syndic_expense_entries enable row level security;
alter table public.syndic_charge_entries enable row level security;
alter table public.syndic_payment_entries enable row level security;
alter table public.syndic_chat_messages enable row level security;
alter table public.syndic_meetings enable row level security;
alter table public.syndic_inbox enable row level security;
revoke all on public.syndic_expense_entries,public.syndic_charge_entries,public.syndic_payment_entries,public.syndic_chat_messages,public.syndic_meetings,public.syndic_inbox from anon,authenticated;
grant select on public.syndic_expense_entries,public.syndic_charge_entries,public.syndic_payment_entries,public.syndic_chat_messages,public.syndic_meetings,public.syndic_inbox to authenticated;
create policy syndic_expense_access on public.syndic_expense_entries for select to authenticated using(public.syndic_manages_residence(residence_id) or exists(select 1 from public.syndic_charge_entries c where c.expense_id=syndic_expense_entries.id and public.syndic_can_access_unit(c.unit_id)));
create policy syndic_charge_access on public.syndic_charge_entries for select to authenticated using(public.syndic_can_access_unit(unit_id));
create policy syndic_payment_access on public.syndic_payment_entries for select to authenticated using(exists(select 1 from public.syndic_charge_entries c where c.id=charge_id));
create policy syndic_chat_access on public.syndic_chat_messages for select to authenticated using(public.syndic_can_access_unit(unit_id));
create policy syndic_meeting_access on public.syndic_meetings for select to authenticated using(public.syndic_can_access_residence(residence_id));
create policy syndic_inbox_access on public.syndic_inbox for select to authenticated using(user_id=auth.uid() and (unit_id is null or public.syndic_can_access_unit(unit_id)) and (residence_id is null or public.syndic_can_access_residence(residence_id)));
create function public.syndic_create_expense(target_residence uuid,expense_title text,total_cents bigint,deadline date,selected_units uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid; n integer; uid uuid; i integer:=0; portion bigint;
begin
 if not public.syndic_manages_residence(target_residence) then raise exception 'Forbidden'; end if;
 select count(distinct x) into n from unnest(selected_units) x;
 if n<1 or n<>cardinality(selected_units) or total_cents<n or total_cents>10000000000 or total_cents is null then raise exception 'Invalid allocation'; end if;
 if (select count(*) from public.syndic_units where id=any(selected_units) and residence_id=target_residence)<>n then raise exception 'Units must belong to this residence'; end if;
 insert into public.syndic_expense_entries(residence_id,title,amount_cents,due_date,created_by) values(target_residence,trim(expense_title),total_cents,deadline,auth.uid()) returning id into eid;
 for uid in select x from unnest(selected_units) x order by x loop
  portion:=total_cents/n+case when i<total_cents%n then 1 else 0 end;
  insert into public.syndic_charge_entries(expense_id,unit_id,amount_cents) values(eid,uid,portion);
  insert into public.syndic_inbox(user_id,unit_id,title,link,dedupe_key) select a.user_id,uid,'Nouvelle cotisation : '||trim(expense_title),'/operations','expense:'||eid||':'||uid from public.syndic_resident_access a where a.unit_id=uid and a.revoked_at is null on conflict do nothing;
  i:=i+1;
 end loop;
 return eid;
end;$$;
create function public.syndic_record_payment(target_charge uuid,paid_cents bigint,payment_reference text,payment_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.syndic_charge_entries; residence uuid; already_paid bigint; pid uuid;
begin
 select * into c from public.syndic_charge_entries where id=target_charge for update;
 select residence_id into residence from public.syndic_units where id=c.unit_id;
 if not public.syndic_manages_residence(residence) then raise exception 'Forbidden'; end if;
 select coalesce(sum(amount_cents),0) into already_paid from public.syndic_payment_entries where charge_id=c.id;
 if paid_cents is null or paid_cents<=0 or paid_cents>c.amount_cents-already_paid or payment_date>current_date then raise exception 'Invalid payment amount or date'; end if;
 insert into public.syndic_payment_entries(charge_id,amount_cents,reference,paid_on,recorded_by) values(c.id,paid_cents,trim(payment_reference),payment_date,auth.uid()) returning id into pid;
 insert into public.syndic_inbox(user_id,unit_id,title,link,dedupe_key) select user_id,c.unit_id,'Règlement enregistré par votre syndic','/operations','payment:'||pid from public.syndic_resident_access where unit_id=c.unit_id and revoked_at is null;
 return pid;
end;$$;
create function public.syndic_send_message(target_unit uuid,message_body text) returns void language plpgsql security definer set search_path='' as $$
declare mid uuid; residence uuid; manager boolean;
begin
 if not public.syndic_can_access_unit(target_unit) then raise exception 'Forbidden'; end if;
 select residence_id into residence from public.syndic_units where id=target_unit;
 manager:=public.syndic_manages_residence(residence);
 if (select count(*) from public.syndic_chat_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=20 then raise exception 'Please wait before sending more messages'; end if;
 insert into public.syndic_chat_messages(unit_id,sender_id,sender_kind,body) values(target_unit,auth.uid(),case when manager then 'syndic' else 'resident' end,trim(message_body)) returning id into mid;
 insert into public.syndic_inbox(user_id,unit_id,title,link,dedupe_key)
 select recipient,target_unit,'Nouveau message concernant votre lot','/operations','chat:'||mid from (
 select a.user_id as recipient from public.syndic_resident_access a where a.unit_id=target_unit and a.revoked_at is null
 union select m.user_id from public.syndic_organization_members m join public.syndic_residences r on r.organization_id=m.organization_id where r.id=residence and m.role in ('admin','manager')) recipients where recipient<>auth.uid();
end;$$;
create function public.syndic_schedule_meeting(target_residence uuid,meeting_title text,meeting_start timestamp,meeting_location text,meeting_agenda text) returns uuid language plpgsql security definer set search_path='' as $$
declare mid uuid;
begin
 if not public.syndic_manages_residence(target_residence) then raise exception 'Forbidden'; end if;
 if (meeting_start at time zone 'Africa/Casablanca')<=now() or meeting_start is null then raise exception 'Meeting must be in the future'; end if;
 insert into public.syndic_meetings(residence_id,title,starts_at,location,agenda,created_by) values(target_residence,trim(meeting_title),meeting_start at time zone 'Africa/Casablanca',trim(meeting_location),trim(meeting_agenda),auth.uid()) returning id into mid;
 insert into public.syndic_inbox(user_id,residence_id,title,link,dedupe_key) select distinct a.user_id,target_residence,'Nouvelle réunion : '||trim(meeting_title),'/operations','meeting:'||mid from public.syndic_resident_access a join public.syndic_units u on u.id=a.unit_id where u.residence_id=target_residence and a.revoked_at is null;
 return mid;
end;$$;
create function public.syndic_remind_charge(target_charge uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.syndic_charge_entries; residence uuid;
begin
 select * into c from public.syndic_charge_entries where id=target_charge;
 select residence_id into residence from public.syndic_units where id=c.unit_id;
 if not public.syndic_manages_residence(residence) then raise exception 'Forbidden'; end if;
 if c.amount_cents<=(select coalesce(sum(amount_cents),0) from public.syndic_payment_entries where charge_id=c.id) then raise exception 'Already paid'; end if;
 insert into public.syndic_inbox(user_id,unit_id,title,link,dedupe_key) select user_id,c.unit_id,'Rappel : une cotisation reste à régler','/operations','reminder:'||c.id||':'||current_date from public.syndic_resident_access where unit_id=c.unit_id and revoked_at is null on conflict do nothing;
end;$$;
create function public.syndic_refresh_my_reminders() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.syndic_inbox(user_id,residence_id,title,link,dedupe_key) select auth.uid(),m.residence_id,'Réunion dans les prochaines 24 heures : '||m.title,'/operations','meeting-24h:'||m.id from public.syndic_meetings m where m.starts_at>now() and m.starts_at<=now()+interval '24 hours' and public.syndic_can_access_residence(m.residence_id) on conflict do nothing;
end;$$;
create function public.syndic_read_notification(target uuid) returns void language sql security definer set search_path='' as $$update public.syndic_inbox set read_at=coalesce(read_at,now()) where id=target and user_id=auth.uid();$$;
create function public.syndic_operations_context() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('units',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'label',u.label,'residence_id',r.id,'residence',r.name,'can_manage',public.syndic_manages_residence(r.id))) from public.syndic_units u join public.syndic_residences r on r.id=u.residence_id where public.syndic_can_access_unit(u.id)),'[]'::jsonb),'residences',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'can_manage',public.syndic_manages_residence(r.id))) from public.syndic_residences r where public.syndic_can_access_residence(r.id)),'[]'::jsonb));
$$;
revoke all on function public.syndic_can_access_unit(uuid),public.syndic_can_access_residence(uuid),public.syndic_create_expense(uuid,text,bigint,date,uuid[]),public.syndic_record_payment(uuid,bigint,text,date),public.syndic_send_message(uuid,text),public.syndic_schedule_meeting(uuid,text,timestamp,text,text),public.syndic_remind_charge(uuid),public.syndic_refresh_my_reminders(),public.syndic_read_notification(uuid),public.syndic_operations_context() from public,anon;
grant execute on function public.syndic_can_access_unit(uuid),public.syndic_can_access_residence(uuid),public.syndic_create_expense(uuid,text,bigint,date,uuid[]),public.syndic_record_payment(uuid,bigint,text,date),public.syndic_send_message(uuid,text),public.syndic_schedule_meeting(uuid,text,timestamp,text,text),public.syndic_remind_charge(uuid),public.syndic_refresh_my_reminders(),public.syndic_read_notification(uuid),public.syndic_operations_context() to authenticated;
commit;

