import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
let org: string, residence: string;
async function asUser(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; insert into auth.users values ('${alice}'),('${bob}'); create table public.existing_app(id integer); insert into public.existing_app values(42);`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202611010001_syndic_foundations.sql",
      "utf8",
    ),
  );
  await asUser(alice);
  const result = await db.query<{ id: string }>(
    "select public.syndic_create_organization('Atlas gestion') as id",
  );
  org = result.rows[0].id;
  const res = await db.query<{ id: string }>(
    "insert into public.syndic_residences(organization_id,name,address,city) values($1,'Atlas','Rue Atlas','Rabat') returning id",
    [org],
  );
  residence = res.rows[0].id;
  await db.query(
    "insert into public.syndic_units(residence_id,label,kind,share) values($1,'A1','apartment',1)",
    [residence],
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
it("le créateur voit ses données et son rôle admin", async () => {
  await asUser(alice);
  expect(
    (await db.query("select * from public.syndic_units")).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query<{ role: string }>(
        "select role from public.syndic_organization_members",
      )
    ).rows[0].role,
  ).toBe("admin");
});
it("un autre utilisateur ne voit aucune donnée", async () => {
  await asUser(bob);
  for (const table of [
    "syndic_organizations",
    "syndic_organization_members",
    "syndic_residences",
    "syndic_units",
  ])
    expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(
      0,
    );
});
it("refuse la création dans une autre organisation", async () => {
  await asUser(bob);
  await expect(
    db.query(
      "insert into public.syndic_residences(organization_id,name,address,city) values($1,'Fraude','Rue Test','Rabat')",
      [org],
    ),
  ).rejects.toThrow();
  await expect(
    db.query(
      "insert into public.syndic_units(residence_id,label,kind,share) values($1,'B1','apartment',1)",
      [residence],
    ),
  ).rejects.toThrow();
});
it("interdit de se promouvoir administrateur", async () => {
  await asUser(bob);
  await expect(
    db.query(
      "insert into public.syndic_organization_members values($1,$2,'admin',now())",
      [org, bob],
    ),
  ).rejects.toThrow();
});
it("refuse les lots dupliqués et quotes-parts négatives", async () => {
  await asUser(alice);
  await expect(
    db.query(
      "insert into public.syndic_units(residence_id,label,kind,share) values($1,'A1','apartment',1)",
      [residence],
    ),
  ).rejects.toThrow();
  await expect(
    db.query(
      "insert into public.syndic_units(residence_id,label,kind,share) values($1,'A2','apartment',-1)",
      [residence],
    ),
  ).rejects.toThrow();
});
it("viewer peut lire mais ne peut pas écrire", async () => {
  await db.exec("reset role");
  await db.query(
    "insert into public.syndic_organization_members(organization_id,user_id,role) values($1,$2,'viewer')",
    [org, bob],
  );
  await asUser(bob);
  expect(
    (await db.query("select * from public.syndic_units")).rows,
  ).toHaveLength(1);
  await expect(
    db.query(
      "insert into public.syndic_units(residence_id,label,kind,share) values($1,'B2','parking',1)",
      [residence],
    ),
  ).rejects.toThrow();
});
it("les accès anonymes sont refusés", async () => {
  await db.exec(
    "reset role; set role anon; select set_config('request.jwt.claim.sub','',false)",
  );
  await expect(
    db.query("select * from public.syndic_organizations"),
  ).rejects.toThrow();
  await expect(
    db.query("select public.syndic_create_organization('Anonyme')"),
  ).rejects.toThrow();
});
it("préserve les tables préexistantes", async () => {
  await db.exec("reset role");
  expect(
    (await db.query<{ id: number }>("select * from public.existing_app"))
      .rows[0].id,
  ).toBe(42);
});
