import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111",
  resident = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333",
  stranger = "44444444-4444-4444-8444-444444444444";
let org: string, residence: string, unit: string, invitation: string;
async function asUser(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`,
  );
}
async function call<T = unknown>(name: string, args: unknown[] = []) {
  const r = await db.query<{ result: T }>(
    `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
    args,
  );
  return r.rows[0]?.result;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; insert into auth.users values('${owner}','owner@example.com',now()),('${resident}','resident@example.com',now()),('${admin}','admin@example.com',now()),('${stranger}','stranger@example.com',null);`,
  );
  for (const f of [
    "202611010001_syndic_foundations.sql",
    "202611010002_admin_residents.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.query(
    "insert into public.syndic_platform_admins(user_id) values($1)",
    [admin],
  );
  await asUser(owner);
  org = await call<string>("syndic_create_organization", ["Organization A"]);
  residence = (
    await db.query<{ id: string }>(
      "insert into public.syndic_residences(organization_id,name,address,city) values($1,'Residence A','Rue Atlas','Rabat') returning id",
      [org],
    )
  ).rows[0].id;
  unit = (
    await db.query<{ id: string }>(
      "insert into public.syndic_units(residence_id,label,kind,share) values($1,'A1','apartment',1) returning id",
      [residence],
    )
  ).rows[0].id;
}, 30000);
afterAll(async () => {
  await db.close();
});
it("syndic cannot become platform admin or list all organizations", async () => {
  await asUser(owner);
  expect(await call("syndic_is_platform_admin")).toBe(false);
  await expect(
    db.query("insert into public.syndic_platform_admins(user_id) values($1)", [
      owner,
    ]),
  ).rejects.toThrow();
  await expect(call("syndic_admin_organizations")).rejects.toThrow();
  await expect(
    call("syndic_set_subscription", [
      org,
      "pro",
      "active",
      "2030-01-01",
      "verified payment",
    ]),
  ).rejects.toThrow();
});
it("admin can manage and audit subscriptions without reading resident data", async () => {
  await asUser(admin);
  expect(await call("syndic_is_platform_admin")).toBe(true);
  expect(
    (await db.query("select * from public.syndic_admin_organizations()")).rows,
  ).toHaveLength(1);
  await call("syndic_set_subscription", [
    org,
    "pro",
    "active",
    "2030-01-01",
    "verified payment reference",
  ]);
  expect(
    (await db.query("select * from public.syndic_subscription_history")).rows,
  ).toHaveLength(1);
  expect(
    (await db.query("select * from public.syndic_units")).rows,
  ).toHaveLength(0);
  await expect(
    db.query("delete from public.syndic_subscription_history"),
  ).rejects.toThrow();
});
it("rejects expired active subscriptions and missing reasons", async () => {
  await asUser(admin);
  await expect(
    call("syndic_set_subscription", [
      org,
      "pro",
      "active",
      "2000-01-01",
      "valid reason",
    ]),
  ).rejects.toThrow();
  await expect(
    call("syndic_set_subscription", [org, "pro", "active", "2030-01-01", "x"]),
  ).rejects.toThrow();
});
it("creates a restricted invitation, blocks stranger and unverified email", async () => {
  await asUser(owner);
  invitation = await call<string>("syndic_invite_resident", [
    unit,
    "resident@example.com",
  ]);
  const unverified = await call<string>("syndic_invite_resident", [
    unit,
    "stranger@example.com",
  ]);
  await asUser(stranger);
  await expect(
    call("syndic_accept_invitation", [invitation]),
  ).rejects.toThrow();
  await expect(
    call("syndic_accept_invitation", [unverified]),
  ).rejects.toThrow();
  await expect(
    call("syndic_invite_resident", [unit, "stranger@example.com"]),
  ).rejects.toThrow();
});
it("acceptance exposes only the associated lot and residence announcements", async () => {
  await asUser(owner);
  await call("syndic_publish_post", [
    residence,
    "Entretien",
    "Nettoyage des parties communes lundi.",
  ]);
  await asUser(resident);
  expect(
    (await call<{ units: unknown[] }>("syndic_my_resident_space")).units,
  ).toHaveLength(0);
  await call("syndic_accept_invitation", [invitation]);
  const space = await call<{ units: unknown[]; posts: unknown[] }>(
    "syndic_my_resident_space",
  );
  expect(space.units).toHaveLength(1);
  expect(space.posts).toHaveLength(1);
  expect(
    (await db.query("select * from public.syndic_organization_members")).rows,
  ).toHaveLength(0);
  await expect(
    call("syndic_accept_invitation", [invitation]),
  ).rejects.toThrow();
  await expect(
    call("syndic_publish_post", [residence, "Fake", "A fake announcement"]),
  ).rejects.toThrow();
});
it("stranger sees no resident activities or subscriptions", async () => {
  await asUser(stranger);
  const space = await call<{ units: unknown[]; posts: unknown[] }>(
    "syndic_my_resident_space",
  );
  expect(space.units).toHaveLength(0);
  expect(space.posts).toHaveLength(0);
  expect(
    (await db.query("select * from public.syndic_subscription_records")).rows,
  ).toHaveLength(0);
});
it("revocation removes resident access immediately", async () => {
  await asUser(owner);
  await call("syndic_revoke_invitation", [invitation]);
  await asUser(resident);
  const space = await call<{ units: unknown[]; posts: unknown[] }>(
    "syndic_my_resident_space",
  );
  expect(space.units).toHaveLength(0);
  expect(space.posts).toHaveLength(0);
});
it("expired invitations cannot be accepted", async () => {
  await asUser(owner);
  const id = await call<string>("syndic_invite_resident", [
    unit,
    "resident@example.com",
  ]);
  await db.exec("reset role");
  await db.query(
    "update public.syndic_resident_invitations set expires_at=now()-interval '1 day' where id=$1",
    [id],
  );
  await asUser(resident);
  await expect(call("syndic_accept_invitation", [id])).rejects.toThrow();
});
