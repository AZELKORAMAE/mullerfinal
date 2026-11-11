-- Public sign-up, syndic approval, join requests, resident moderation and subscription payments by bank transfer.
-- Additive except: widened CHECK constraints (plans, inbox links) and one nullable column on syndic_resident_access.
begin;

-- Plans: free trial (1 month), standard (30 MAD / month), entreprise (on quote). Legacy values stay valid.
alter table public.syndic_subscription_records drop constraint syndic_subscription_records_plan_check;
alter table public.syndic_subscription_records add constraint syndic_subscription_records_plan_check
 check(plan in ('essentiel','pro','business','essai','standard','entreprise'));
alter table public.syndic_inbox drop constraint syndic_inbox_link_check;
alter table public.syndic_inbox add constraint syndic_inbox_link_check
 check(link in ('/resident','/operations','/app/abonnement','/app/communaute','/admin'));

-- 1. Syndic account requests (approved by a platform admin) ------------------------------------
create table public.syndic_account_requests (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 full_name text not null check(char_length(trim(full_name)) between 2 and 160),
 phone text not null check(char_length(trim(phone)) between 6 and 24),
 organization_name text not null check(char_length(trim(organization_name)) between 2 and 120),
 desired_plan text not null check(desired_plan in ('essai','standard','entreprise')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 organization_id uuid references public.syndic_organizations(id),
 created_at timestamptz not null default now(),
 decided_at timestamptz, decided_by uuid references auth.users(id)
);
alter table public.syndic_account_requests enable row level security;
revoke all on public.syndic_account_requests from anon,authenticated;
grant select on public.syndic_account_requests to authenticated;
create policy syndic_account_request_read on public.syndic_account_requests for select to authenticated
 using(user_id=auth.uid() or public.syndic_is_platform_admin());

create function public.syndic_request_syndic_account(organization text,plan_choice text,person_name text,person_phone text) returns void
language plpgsql security definer set search_path='' as $$
declare mail text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if exists(select 1 from public.syndic_organization_members where user_id=auth.uid()) then raise exception 'Already a syndic'; end if;
 select lower(email) into mail from auth.users where id=auth.uid();
 insert into public.syndic_account_requests(user_id,email,full_name,phone,organization_name,desired_plan)
 values(auth.uid(),mail,trim(person_name),trim(person_phone),trim(organization),plan_choice)
 on conflict(user_id) do update set organization_name=excluded.organization_name,desired_plan=excluded.desired_plan,
  full_name=excluded.full_name,phone=excluded.phone,status='pending',created_at=now(),decided_at=null,decided_by=null
 where public.syndic_account_requests.status='rejected';
 if not found then raise exception 'Request already exists'; end if;
 insert into public.syndic_inbox(user_id,title,link,dedupe_key)
 select a.user_id,'Nouveau compte syndic à approuver : '||trim(organization),'/admin','account:'||auth.uid()||':'||now()
 from public.syndic_platform_admins a on conflict do nothing;
end;$$;

create function public.syndic_admin_decide_account(target uuid,approve boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare req public.syndic_account_requests; oid uuid; rec jsonb;
begin
 if not public.syndic_is_platform_admin() then raise exception 'Forbidden'; end if;
 select * into req from public.syndic_account_requests where user_id=target for update;
 if not found or req.status<>'pending' then raise exception 'No pending request'; end if;
 if not approve then
  update public.syndic_account_requests set status='rejected',decided_at=now(),decided_by=auth.uid() where user_id=target;
  return null;
 end if;
 insert into public.syndic_organizations(name,created_by) values(req.organization_name,target) returning id into oid;
 insert into public.syndic_organization_members(organization_id,user_id,role) values(oid,target,'admin');
 insert into public.syndic_subscription_records(organization_id,plan,status,ends_at,note,updated_by)
 values(oid,'essai','trialing',now()+interval '1 month','Essai gratuit d''un mois (compte approuvé)',auth.uid());
 select to_jsonb(s) into rec from public.syndic_subscription_records s where organization_id=oid;
 insert into public.syndic_subscription_history(organization_id,actor_id,previous_value,new_value) values(oid,auth.uid(),null,rec);
 update public.syndic_account_requests set status='approved',organization_id=oid,decided_at=now(),decided_by=auth.uid() where user_id=target;
 insert into public.syndic_inbox(user_id,title,link,dedupe_key) values(target,'Votre compte syndic est approuvé : essai gratuit d''un mois','/app/abonnement','account-approved:'||oid);
 return oid;
end;$$;

-- Account overview used for redirects after sign-in.
create function public.syndic_my_status() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'admin',public.syndic_is_platform_admin(),
  'member',exists(select 1 from public.syndic_organization_members where user_id=auth.uid()),
  'resident',exists(select 1 from public.syndic_resident_access where user_id=auth.uid() and revoked_at is null),
  'request',(select status from public.syndic_account_requests where user_id=auth.uid()));
$$;

-- 2. Bank details shown to syndics (edited by the platform admin) -----------------------------
create table public.syndic_billing_settings (
 id boolean primary key default true check(id),
 account_holder text not null default '' check(char_length(account_holder)<=160),
 bank_name text not null default '' check(char_length(bank_name)<=160),
 rib text not null default '' check(char_length(rib)<=64),
 instructions text not null default '' check(char_length(instructions)<=1000),
 updated_at timestamptz not null default now()
);
insert into public.syndic_billing_settings(id) values(true);
alter table public.syndic_billing_settings enable row level security;
revoke all on public.syndic_billing_settings from anon,authenticated;
grant select on public.syndic_billing_settings to authenticated;
create policy syndic_billing_read on public.syndic_billing_settings for select to authenticated using(true);
create function public.syndic_admin_set_billing(holder text,bank text,account_rib text,notes text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.syndic_is_platform_admin() then raise exception 'Forbidden'; end if;
 update public.syndic_billing_settings set account_holder=trim(holder),bank_name=trim(bank),rib=trim(account_rib),instructions=trim(notes),updated_at=now() where id;
end;$$;

-- 3. Subscription payments by bank transfer, validated by the platform admin -------------------
create table public.syndic_subscription_payments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.syndic_organizations(id),
 plan text not null check(plan in ('standard','entreprise')),
 months integer not null check(months between 1 and 24),
 amount_cents bigint not null check(amount_cents>0 and amount_cents<=100000000),
 reference text not null default '' check(char_length(reference)<=160),
 proof_path text not null check(char_length(proof_path) between 5 and 300),
 submitted_by uuid not null references auth.users(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 admin_note text not null default '' check(char_length(admin_note)<=500),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz, reviewed_by uuid references auth.users(id)
);
create index syndic_sub_payments_org_idx on public.syndic_subscription_payments(organization_id,created_at);
alter table public.syndic_subscription_payments enable row level security;
revoke all on public.syndic_subscription_payments from anon,authenticated;
grant select on public.syndic_subscription_payments to authenticated;
create policy syndic_sub_payment_read on public.syndic_subscription_payments for select to authenticated
 using(public.syndic_is_platform_admin() or exists(select 1 from public.syndic_organization_members m where m.organization_id=syndic_subscription_payments.organization_id and m.user_id=auth.uid()));

create function public.syndic_submit_subscription_payment(target_org uuid,plan_choice text,month_count integer,paid_cents bigint,payment_reference text,proof text) returns uuid
language plpgsql security definer set search_path='' as $$
declare pid uuid; org_name text;
begin
 if not exists(select 1 from public.syndic_organization_members where organization_id=target_org and user_id=auth.uid() and role in ('admin','manager')) then raise exception 'Forbidden'; end if;
 if proof is null or left(proof,char_length(target_org::text)+1)<>target_org::text||'/' then raise exception 'Invalid proof'; end if;
 if plan_choice='standard' and paid_cents<>3000*month_count then raise exception 'Invalid amount'; end if;
 if (select count(*) from public.syndic_subscription_payments where organization_id=target_org and status='pending')>=3 then raise exception 'Too many pending payments'; end if;
 insert into public.syndic_subscription_payments(organization_id,plan,months,amount_cents,reference,proof_path,submitted_by)
 values(target_org,plan_choice,month_count,paid_cents,trim(coalesce(payment_reference,'')),proof,auth.uid()) returning id into pid;
 select name into org_name from public.syndic_organizations where id=target_org;
 insert into public.syndic_inbox(user_id,title,link,dedupe_key)
 select a.user_id,'Nouveau virement à vérifier : '||org_name,'/admin','payment-submitted:'||pid from public.syndic_platform_admins a;
 return pid;
end;$$;

create function public.syndic_admin_review_payment(target uuid,approve boolean,note text) returns void
language plpgsql security definer set search_path='' as $$
declare p public.syndic_subscription_payments; old_record jsonb; new_record jsonb; base timestamptz;
begin
 if not public.syndic_is_platform_admin() then raise exception 'Forbidden'; end if;
 select * into p from public.syndic_subscription_payments where id=target for update;
 if not found or p.status<>'pending' then raise exception 'Payment already reviewed'; end if;
 update public.syndic_subscription_payments set status=case when approve then 'approved' else 'rejected' end,
  admin_note=trim(coalesce(note,'')),reviewed_at=now(),reviewed_by=auth.uid() where id=target;
 if approve then
  perform 1 from public.syndic_organizations where id=p.organization_id for update;
  select to_jsonb(s) into old_record from public.syndic_subscription_records s where organization_id=p.organization_id;
  select greatest(now(),coalesce((select ends_at from public.syndic_subscription_records where organization_id=p.organization_id and status in ('active','trialing')),now())) into base;
  insert into public.syndic_subscription_records(organization_id,plan,status,ends_at,note,updated_by)
  values(p.organization_id,p.plan,'active',base+make_interval(months=>p.months),'Virement validé (paiement '||p.id||')',auth.uid())
  on conflict(organization_id) do update set plan=excluded.plan,status=excluded.status,ends_at=excluded.ends_at,note=excluded.note,updated_by=excluded.updated_by,updated_at=now();
  select to_jsonb(s) into new_record from public.syndic_subscription_records s where organization_id=p.organization_id;
  insert into public.syndic_subscription_history(organization_id,actor_id,previous_value,new_value) values(p.organization_id,auth.uid(),old_record,new_record);
 end if;
 insert into public.syndic_inbox(user_id,title,link,dedupe_key)
 select m.user_id,case when approve then 'Paiement validé : abonnement prolongé' else 'Paiement refusé : contactez le support' end,'/app/abonnement','payment-review:'||p.id
 from public.syndic_organization_members m where m.organization_id=p.organization_id and m.role in ('admin','manager') on conflict do nothing;
end;$$;

-- 4. Join requests: a link (new or existing account) creates a request the syndic approves ------
create table public.syndic_join_requests (
 id uuid primary key default gen_random_uuid(),
 link_id uuid not null unique references public.syndic_join_links(id),
 unit_id uuid not null references public.syndic_units(id),
 user_id uuid not null references auth.users(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 invitation_id uuid references public.syndic_resident_invitations(id),
 created_at timestamptz not null default now(), decided_at timestamptz, decided_by uuid references auth.users(id)
);
alter table public.syndic_join_requests enable row level security;
revoke all on public.syndic_join_requests from anon,authenticated;
grant select on public.syndic_join_requests to authenticated;
create policy syndic_join_request_read on public.syndic_join_requests for select to authenticated
 using(user_id=auth.uid() or exists(select 1 from public.syndic_units u where u.id=unit_id and public.syndic_manages_residence(u.residence_id)));

-- Internal helper: consume a valid link for an account and create the pending request.
create function public.syndic_link_to_request(token uuid,attempt uuid,account_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare link public.syndic_join_links; rid uuid; residence uuid;
begin
 select * into link from public.syndic_join_links where id=token for update;
 if not found or link.used_by is not null or link.revoked_at is not null or link.expires_at<=now() then raise exception 'Invalid invitation'; end if;
 if attempt is null and link.reserved_until is not null and link.reserved_until>now() then raise exception 'Invitation in use'; end if;
 if attempt is not null and (link.reservation is distinct from attempt or link.reserved_until<=now()) then raise exception 'Invalid invitation'; end if;
 if exists(select 1 from public.syndic_resident_access where unit_id=link.unit_id and user_id=account_id and revoked_at is null) then raise exception 'Already a resident'; end if;
 insert into public.syndic_join_requests(link_id,unit_id,user_id) values(token,link.unit_id,account_id) returning id into rid;
 update public.syndic_join_links set used_by=account_id,reservation=null,reserved_until=null where id=token;
 select residence_id into residence from public.syndic_units where id=link.unit_id;
 insert into public.syndic_inbox(user_id,title,link,dedupe_key)
 select m.user_id,'Nouvelle demande d''adhésion à valider','/app/communaute','join-request:'||rid
 from public.syndic_organization_members m join public.syndic_residences r on r.organization_id=m.organization_id
 where r.id=residence and m.role in ('admin','manager');
 return rid;
end;$$;
-- Server (service role) path: new account created through the Auth API after reserving the link.
create function public.syndic_request_join_link(token uuid,attempt uuid,account_id uuid) returns uuid
language sql security definer set search_path='' as $$ select public.syndic_link_to_request(token,attempt,account_id); $$;
-- Signed-in path: an existing account joins with the link.
create function public.syndic_request_join(token uuid) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 return public.syndic_link_to_request(token,null,auth.uid());
end;$$;

create function public.syndic_decide_join_request(target uuid,approve boolean) returns void
language plpgsql security definer set search_path='' as $$
declare req public.syndic_join_requests; residence uuid; mail text; invitation uuid;
begin
 select * into req from public.syndic_join_requests where id=target for update;
 if not found then raise exception 'Unknown request'; end if;
 select residence_id into residence from public.syndic_units where id=req.unit_id;
 if not public.syndic_manages_residence(residence) then raise exception 'Forbidden'; end if;
 if req.status<>'pending' then raise exception 'Already decided'; end if;
 if approve then
  select lower(email) into mail from auth.users where id=req.user_id;
  insert into public.syndic_resident_invitations(unit_id,email,invited_by,accepted_at) values(req.unit_id,coalesce(mail,'inconnu@invalid'),auth.uid(),now()) returning id into invitation;
  insert into public.syndic_resident_access(unit_id,user_id,invitation_id) values(req.unit_id,req.user_id,invitation)
  on conflict(unit_id,user_id) do update set invitation_id=excluded.invitation_id,revoked_at=null,blocked_at=null;
  update public.syndic_join_links set invitation_id=invitation where id=req.link_id;
 end if;
 update public.syndic_join_requests set status=case when approve then 'approved' else 'rejected' end,invitation_id=invitation,decided_at=now(),decided_by=auth.uid() where id=target;
 insert into public.syndic_inbox(user_id,unit_id,title,link,dedupe_key)
 values(req.user_id,case when approve then req.unit_id end,case when approve then 'Votre demande d''adhésion est acceptée' else 'Votre demande d''adhésion a été refusée' end,'/resident','join-decision:'||req.id);
end;$$;

-- 5. Resident moderation: block / unblock / remove -------------------------------------------
alter table public.syndic_resident_access add column blocked_at timestamptz;
create function public.syndic_set_resident_blocked(target_unit uuid,target_user uuid,blocked boolean) returns void
language plpgsql security definer set search_path='' as $$
declare residence uuid;
begin
 select residence_id into residence from public.syndic_units where id=target_unit;
 if not public.syndic_manages_residence(residence) then raise exception 'Forbidden'; end if;
 if blocked then
  update public.syndic_resident_access set blocked_at=now(),revoked_at=now() where unit_id=target_unit and user_id=target_user and revoked_at is null;
 else
  update public.syndic_resident_access set blocked_at=null,revoked_at=null where unit_id=target_unit and user_id=target_user and blocked_at is not null;
 end if;
 if not found then raise exception 'Nothing to update'; end if;
end;$$;
create function public.syndic_remove_resident(target_unit uuid,target_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare residence uuid; inv uuid;
begin
 select residence_id into residence from public.syndic_units where id=target_unit;
 if not public.syndic_manages_residence(residence) then raise exception 'Forbidden'; end if;
 delete from public.syndic_resident_access where unit_id=target_unit and user_id=target_user returning invitation_id into inv;
 if not found then raise exception 'Unknown resident'; end if;
 update public.syndic_resident_invitations set revoked_at=coalesce(revoked_at,now()) where id=inv;
end;$$;

-- People overview for syndics (residents + pending requests) with contact details from Auth.
create function public.syndic_manager_people() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'residents',coalesce((select jsonb_agg(jsonb_build_object('unit_id',a.unit_id,'user_id',a.user_id,'unit',u.label,'residence',r.name,
   'email',au.email,'name',trim(coalesce(au.raw_user_meta_data->>'first_name','')||' '||coalesce(au.raw_user_meta_data->>'last_name','')),
   'phone',coalesce(au.raw_user_meta_data->>'phone',''),'blocked',a.blocked_at is not null,'revoked',a.revoked_at is not null,'since',a.created_at) order by r.name,u.label)
  from public.syndic_resident_access a join public.syndic_units u on u.id=a.unit_id join public.syndic_residences r on r.id=u.residence_id join auth.users au on au.id=a.user_id
  where public.syndic_manages_residence(r.id)),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'unit',u.label,'residence',r.name,'email',au.email,
   'name',trim(coalesce(au.raw_user_meta_data->>'first_name','')||' '||coalesce(au.raw_user_meta_data->>'last_name','')),
   'phone',coalesce(au.raw_user_meta_data->>'phone',''),'created_at',q.created_at) order by q.created_at)
  from public.syndic_join_requests q join public.syndic_units u on u.id=q.unit_id join public.syndic_residences r on r.id=u.residence_id join auth.users au on au.id=q.user_id
  where q.status='pending' and public.syndic_manages_residence(r.id)),'[]'::jsonb));
$$;

-- My pending join requests (resident side).
create function public.syndic_my_join_requests() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'status',q.status,'unit',u.label,'residence',r.name,'created_at',q.created_at) order by q.created_at desc),'[]'::jsonb)
 from public.syndic_join_requests q join public.syndic_units u on u.id=q.unit_id join public.syndic_residences r on r.id=u.residence_id where q.user_id=auth.uid();
$$;

revoke all on function public.syndic_request_syndic_account(text,text,text,text),public.syndic_admin_decide_account(uuid,boolean),public.syndic_my_status(),
 public.syndic_admin_set_billing(text,text,text,text),public.syndic_submit_subscription_payment(uuid,text,integer,bigint,text,text),public.syndic_admin_review_payment(uuid,boolean,text),
 public.syndic_request_join(uuid),public.syndic_decide_join_request(uuid,boolean),public.syndic_set_resident_blocked(uuid,uuid,boolean),public.syndic_remove_resident(uuid,uuid),
 public.syndic_manager_people(),public.syndic_my_join_requests() from public,anon;
grant execute on function public.syndic_request_syndic_account(text,text,text,text),public.syndic_admin_decide_account(uuid,boolean),public.syndic_my_status(),
 public.syndic_admin_set_billing(text,text,text,text),public.syndic_submit_subscription_payment(uuid,text,integer,bigint,text,text),public.syndic_admin_review_payment(uuid,boolean,text),
 public.syndic_request_join(uuid),public.syndic_decide_join_request(uuid,boolean),public.syndic_set_resident_blocked(uuid,uuid,boolean),public.syndic_remove_resident(uuid,uuid),
 public.syndic_manager_people(),public.syndic_my_join_requests() to authenticated;
revoke all on function public.syndic_link_to_request(uuid,uuid,uuid),public.syndic_request_join_link(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.syndic_request_join_link(uuid,uuid,uuid) to service_role;

-- Private bucket for transfer screenshots (uploads and signed URLs go through the server only).
do $$ begin
 if exists(select 1 from pg_namespace where nspname='storage') then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('syndic-payment-proofs','syndic-payment-proofs',false,5242880,array['image/png','image/jpeg','image/webp','application/pdf'])
  on conflict(id) do nothing;
 end if;
end $$;
commit;
