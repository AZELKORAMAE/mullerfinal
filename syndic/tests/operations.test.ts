import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("isolates operations and preserves exact allocations and payment balances", async () => {
  const db = new PGlite();
  try {
    const a = "11111111-1111-4111-8111-111111111111",
      b = "22222222-2222-4222-8222-222222222222";
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${a}','a@test.com',now()),('${b}','b@test.com',now());`,
    );
    for (const f of [
      "202611010001_syndic_foundations.sql",
      "202611010002_admin_residents.sql",
      "202611010003_operations.sql",
    ])
      await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${a}',false)`,
    );
    const org = (
      await db.query<{ id: string }>(
        "select public.syndic_create_organization('Atlas') id",
      )
    ).rows[0].id;
    const r = (
      await db.query<{ id: string }>(
        "insert into public.syndic_residences(organization_id,name,address,city) values($1,'Atlas','Rue Atlas','Rabat') returning id",
        [org],
      )
    ).rows[0].id;
    const units = (
      await db.query<{ id: string }>(
        "insert into public.syndic_units(residence_id,label,kind,share) values($1,'A','apartment',1),($1,'B','apartment',1) returning id",
        [r],
      )
    ).rows.map((x) => x.id);
    await db.query(
      "select public.syndic_create_expense($1,'Nettoyage',101,'2030-01-01',$2)",
      [r, units],
    );
    const charges = (
      await db.query<{ id: string; amount_cents: number }>(
        "select * from public.syndic_charge_entries order by amount_cents",
      )
    ).rows;
    expect(charges.map((c) => Number(c.amount_cents))).toEqual([50, 51]);
    await db.query(
      "select public.syndic_record_payment($1,50,'REF-01',current_date)",
      [charges[0].id],
    );
    await expect(
      db.query(
        "select public.syndic_record_payment($1,1,'REF-02',current_date)",
        [charges[0].id],
      ),
    ).rejects.toThrow();
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
    for (const table of [
      "syndic_expense_entries",
      "syndic_charge_entries",
      "syndic_payment_entries",
    ])
      expect(
        (await db.query("select * from public." + table)).rows,
      ).toHaveLength(0);
    await expect(
      db.query("select public.syndic_send_message($1,'Intrusion')", [units[0]]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "select public.syndic_create_expense($1,'Intrusion',100,'2030-01-01',$2)",
        [r, units],
      ),
    ).rejects.toThrow();
    await db.exec("reset role; create role service_role;");
    await db.exec(
      readFileSync(
        "supabase/migrations/202611080001_support_and_accounts.sql",
        "utf8",
      ),
    );
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${a}',false)`,
    );
    const incident = (
      await db.query<{ id: string }>(
        "select public.syndic_report_incident($1,'Fuite eau','Fuite dans le couloir','urgent') id",
        [units[0]],
      )
    ).rows[0].id;
    await expect(
      db.query("select public.syndic_update_incident($1,'resolved','')", [
        incident,
      ]),
    ).rejects.toThrow();
    await db.query(
      "select public.syndic_update_incident($1,'resolved','Reparation terminee')",
      [incident],
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
    expect(
      (await db.query("select * from public.syndic_incidents")).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select public.syndic_update_incident($1,'open','Intrusion')", [
        incident,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query("select public.syndic_provision_resident($1,$2,$3)", [
        b,
        units[0],
        a,
      ]),
    ).rejects.toThrow();
    await db.exec("reset role");
    await db.exec(
      readFileSync("supabase/migrations/202611080002_join_links.sql", "utf8"),
    );
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${a}',false)`,
    );
    const token = (
      await db.query<{ id: string }>(
        "select public.syndic_create_join_link($1) id",
        [units[0]],
      )
    ).rows[0].id;
    const attempt = "33333333-3333-4333-8333-333333333333";
    await expect(
      db.query("select public.syndic_reserve_join_link($1,$2)", [
        token,
        attempt,
      ]),
    ).rejects.toThrow();
    await db.exec("reset role; set role service_role");
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select public.syndic_reserve_join_link($1,$2) ok",
          [token, attempt],
        )
      ).rows[0].ok,
    ).toBe(true);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select public.syndic_reserve_join_link($1,$2) ok",
          [token, b],
        )
      ).rows[0].ok,
    ).toBe(false);
    await expect(
      db.query("select public.syndic_finish_join_link($1,$2,$3)", [
        token,
        b,
        b,
      ]),
    ).rejects.toThrow();
    await db.query("select public.syndic_finish_join_link($1,$2,$3)", [
      token,
      attempt,
      b,
    ]);
    await expect(
      db.query("select public.syndic_finish_join_link($1,$2,$3)", [
        token,
        attempt,
        b,
      ]),
    ).rejects.toThrow();
    await db.exec(
      `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${b}',false)`,
    );
    expect(
      (await db.query("select * from public.syndic_join_links")).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select public.syndic_create_join_link($1)", [units[1]]),
    ).rejects.toThrow();
    await db.exec(`select set_config('request.jwt.claim.sub','${a}',false)`);
    await db.query("select public.syndic_revoke_join_link($1)", [token]);
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
    expect(
      (
        await db.query<{ok:boolean}>("select public.syndic_can_access_unit($1) ok", [
          units[0],
        ])
      ).rows[0].ok,
    ).toBe(false);
  } finally {
    await db.close();
  }
}, 30000);
