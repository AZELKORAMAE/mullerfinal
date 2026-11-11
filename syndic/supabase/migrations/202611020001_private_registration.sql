begin;
-- Public organization onboarding is closed. Auth settings shared with other apps remain unchanged.
revoke execute on function public.syndic_create_organization(text) from authenticated;
create function public.syndic_provision_organization(account_id uuid,organization_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare oid uuid;
begin
 insert into public.syndic_organizations(name,created_by) values(trim(organization_name),account_id) returning id into oid;
 insert into public.syndic_organization_members(organization_id,user_id,role) values(oid,account_id,'admin');
 return oid;
end;$$;
revoke all on function public.syndic_provision_organization(uuid,text) from public,anon,authenticated;
grant execute on function public.syndic_provision_organization(uuid,text) to service_role;
grant select,insert on public.syndic_resident_access to service_role;
grant select,update on public.syndic_resident_invitations to service_role;
commit;
