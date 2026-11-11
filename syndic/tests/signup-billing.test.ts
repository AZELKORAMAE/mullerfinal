import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const syndic = "11111111-1111-4111-8111-111111111111",
  resident = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333",
  other = "44444444-4444-4444-8444-444444444444";
let org: string, unit: string;
async function as(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`,
  );
}
async function one<T>(sql: string, args: unknown[] = []) {
  return (await db.query<{ r: T }>(sql, args)).rows[0]?.r;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,public to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated,anon,service_role; insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${syndic}','syndic@example.com',now(),'{}'),('${resident}','resident@example.com',now(),'{"first_name":"Sara","last_name":"Alami","phone":"0600000000"}'),('${admin}','admin@example.com',now(),'{}'),('${other}','other@example.com',now(),'{}');`,
  );
  for (const f of [
    "202611010001_syndic_foundations.sql",
    "202611010002_admin_residents.sql",
    "202611010003_operations.sql",
    "202611020001_private_registration.sql",
    "202611080001_support_and_accounts.sql",
    "202611080002_join_links.sql",
    "202611110001_signup_billing.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.query("insert into public.syndic_platform_admins values($1)", [admin]);
}, 60000);
afterAll(async () => {
  await db.close();
});
it("a syndic sign-up waits for admin approval and starts a one-month trial", async () => {
  await as(syndic);
  await db.query("select public.syndic_request_syndic_account('Atlas Gestion','standard','Karim B','0611223344')");
  expect((await one<{ request: string; member: boolean }>("select public.syndic_my_status() r")).request).toBe("pending");
  await expect(db.query("select public.syndic_request_syndic_account('Atlas','standard','Karim','0611223344')")).rejects.toThrow();
  await expect(db.query("select public.syndic_admin_decide_account($1,true)", [syndic])).rejects.toThrow();
  await as(admin);
  expect((await db.query("select * from public.syndic_account_requests")).rows).toHaveLength(1);
  org = (await one<string>("select public.syndic_admin_decide_account($1,true) r", [syndic]))!;
  await as(syndic);
  const status = await one<{ member: boolean; request: string }>("select public.syndic_my_status() r");
  expect(status.member).toBe(true);
  const sub = (await db.query<{ plan: string; status: string; ends_at: Date }>("select plan,status,ends_at from public.syndic_subscription_records")).rows[0];
  expect(sub.plan).toBe("essai");
  expect(sub.status).toBe("trialing");
  const days = (sub.ends_at.getTime() - Date.now()) / 86400000;
  expect(days).toBeGreaterThan(27);
  expect(days).toBeLessThan(32);
});
it("bank transfer payments are validated or refused by the admin and extend the subscription", async () => {
  await as(syndic);
  await expect(db.query("select public.syndic_submit_subscription_payment($1,'standard',3,1000,'VIR1',$2)", [org, org + "/a.png"])).rejects.toThrow();
  await expect(db.query("select public.syndic_submit_subscription_payment($1,'standard',3,9000,'VIR1','other/a.png')", [org])).rejects.toThrow();
  const p1 = await one<string>("select public.syndic_submit_subscription_payment($1,'standard',3,9000,'VIR1',$2) r", [org, org + "/a.png"]);
  const p2 = await one<string>("select public.syndic_submit_subscription_payment($1,'entreprise',1,50000,'VIR2',$2) r", [org, org + "/b.png"]);
  await as(other);
  expect((await db.query("select * from public.syndic_subscription_payments")).rows).toHaveLength(0);
  await expect(db.query("select public.syndic_submit_subscription_payment($1,'standard',1,3000,'X',$2)", [org, org + "/x.png"])).rejects.toThrow();
  await as(syndic);
  await expect(db.query("select public.syndic_admin_review_payment($1,true,'')", [p1])).rejects.toThrow();
  await as(admin);
  expect((await db.query("select * from public.syndic_inbox where link='/admin'")).rows.length).toBeGreaterThanOrEqual(2);
  const before = (await db.query<{ ends_at: Date }>("select ends_at from public.syndic_subscription_records")).rows[0].ends_at;
  await db.query("select public.syndic_admin_review_payment($1,true,'')", [p1]);
  await expect(db.query("select public.syndic_admin_review_payment($1,true,'')", [p1])).rejects.toThrow();
  const after = (await db.query<{ ends_at: Date; plan: string; status: string }>("select ends_at,plan,status from public.syndic_subscription_records")).rows[0];
  expect(after.plan).toBe("standard");
  expect(after.status).toBe("active");
  const addedDays = (after.ends_at.getTime() - before.getTime()) / 86400000;
  expect(addedDays).toBeGreaterThan(88);
  expect(addedDays).toBeLessThan(93);
  await db.query("select public.syndic_admin_review_payment($1,false,'Montant incorrect')", [p2]);
  expect((await db.query<{ plan: string }>("select plan from public.syndic_subscription_records")).rows[0].plan).toBe("standard");
  await db.query("select public.syndic_admin_set_billing('Alia Digital','Banque','011780000012345678901234','Indiquez le nom du syndic')");
  await as(syndic);
  expect((await db.query<{ rib: string }>("select rib from public.syndic_billing_settings")).rows[0].rib).toBe("011780000012345678901234");
  await expect(db.query("select public.syndic_admin_set_billing('x','y','z','')")).rejects.toThrow();
});
it("join links create requests the syndic approves, then can block and remove residents", async () => {
  await as(syndic);
  const residence = await one<string>("insert into public.syndic_residences(organization_id,name,address,city) values($1,'Atlas','Rue Atlas','Rabat') returning id r", [org]);
  unit = (await one<string>("insert into public.syndic_units(residence_id,label,kind,share) values($1,'A1','apartment',1) returning id r", [residence]))!;
  const link = await one<string>("select public.syndic_create_join_link($1) r", [unit]);
  await as(resident);
  const req = await one<string>("select public.syndic_request_join($1) r", [link]);
  await expect(db.query("select public.syndic_request_join($1)", [link])).rejects.toThrow();
  expect(await one<boolean>("select public.syndic_can_access_unit($1) r", [unit])).toBe(false);
  await expect(db.query("select public.syndic_decide_join_request($1,true)", [req])).rejects.toThrow();
  await as(syndic);
  const people = await one<{ requests: { email: string; name: string }[] }>("select public.syndic_manager_people() r");
  expect(people.requests[0].email).toBe("resident@example.com");
  expect(people.requests[0].name).toBe("Sara Alami");
  await db.query("select public.syndic_decide_join_request($1,true)", [req]);
  await as(resident);
  expect(await one<boolean>("select public.syndic_can_access_unit($1) r", [unit])).toBe(true);
  await as(other);
  await expect(db.query("select public.syndic_set_resident_blocked($1,$2,true)", [unit, resident])).rejects.toThrow();
  await as(syndic);
  await db.query("select public.syndic_set_resident_blocked($1,$2,true)", [unit, resident]);
  await as(resident);
  expect(await one<boolean>("select public.syndic_can_access_unit($1) r", [unit])).toBe(false);
  await as(syndic);
  await db.query("select public.syndic_set_resident_blocked($1,$2,false)", [unit, resident]);
  await as(resident);
  expect(await one<boolean>("select public.syndic_can_access_unit($1) r", [unit])).toBe(true);
  await as(syndic);
  await db.query("select public.syndic_remove_resident($1,$2)", [unit, resident]);
  await as(resident);
  expect(await one<boolean>("select public.syndic_can_access_unit($1) r", [unit])).toBe(false);
  // Service-role path for brand-new accounts.
  await as(syndic);
  const link2 = await one<string>("select public.syndic_create_join_link($1) r", [unit]);
  await db.exec("reset role; set role service_role");
  const attempt = "55555555-5555-4555-8555-555555555555";
  expect(await one<boolean>("select public.syndic_reserve_join_link($1,$2) r", [link2, attempt])).toBe(true);
  await db.query("select public.syndic_request_join_link($1,$2,$3)", [link2, attempt, other]);
  await as(other);
  expect((await one<{ status: string }[]>("select public.syndic_my_join_requests() r"))[0].status).toBe("pending");
  await expect(db.query("select public.syndic_request_join_link($1,$2,$3)", [link2, attempt, other])).rejects.toThrow();
});
