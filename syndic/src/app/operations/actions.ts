"use server";
import { signedIn } from "@/lib/access";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
const money = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/)
  .transform((v) => Math.round(Number(v) * 100))
  .pipe(z.number().int().positive().max(10000000000));
export async function operate(form: FormData) {
  const { db } = await signedIn();
  let error = false;
  const task = String(form.get("task"));
  const id = z.uuid().safeParse(form.get("target"));
  try {
    if (task === "expense") {
      const amount = money.parse(form.get("amount"));
      const units = z.array(z.uuid()).min(1).parse(form.getAll("units"));
      const title = z.string().trim().min(3).max(160).parse(form.get("title"));
      const date = z.iso.date().parse(form.get("date"));
      if (!id.success) throw Error();
      error = Boolean(
        (
          await db.rpc("syndic_create_expense", {
            target_residence: id.data,
            expense_title: title,
            total_cents: amount,
            deadline: date,
            selected_units: units,
          })
        ).error,
      );
    } else if (task === "payment") {
      if (!id.success) throw Error();
      error = Boolean(
        (
          await db.rpc("syndic_record_payment", {
            target_charge: id.data,
            paid_cents: money.parse(form.get("amount")),
            payment_reference: z
              .string()
              .trim()
              .min(3)
              .max(160)
              .parse(form.get("reference")),
            payment_date: z.iso.date().parse(form.get("date")),
          })
        ).error,
      );
    } else if (task === "chat") {
      if (!id.success) throw Error();
      error = Boolean(
        (
          await db.rpc("syndic_send_message", {
            target_unit: id.data,
            message_body: z
              .string()
              .trim()
              .min(1)
              .max(3000)
              .parse(form.get("body")),
          })
        ).error,
      );
    } else if (task === "remind") {
      if (!id.success) throw Error();
      error = Boolean(
        (await db.rpc("syndic_remind_charge", { target_charge: id.data }))
          .error,
      );
    } else if (task === "read") {
      if (!id.success) throw Error();
      error = Boolean(
        (await db.rpc("syndic_read_notification", { target: id.data })).error,
      );
    } else if (task === "meeting") {
      if (!id.success) throw Error();
      error = Boolean(
        (
          await db.rpc("syndic_schedule_meeting", {
            target_residence: id.data,
            meeting_title: z
              .string()
              .trim()
              .min(3)
              .max(160)
              .parse(form.get("title")),
            meeting_start: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
              .parse(form.get("date")),
            meeting_location: z
              .string()
              .trim()
              .min(3)
              .max(300)
              .parse(form.get("location")),
            meeting_agenda: z.string().max(5000).parse(form.get("body")),
          })
        ).error,
      );
    } else throw Error();
  } catch {
    error = true;
  }
  revalidatePath("/operations");
  const nextView =
    task === "chat"
      ? "messages"
      : task === "meeting"
        ? "meetings"
        : task === "read"
          ? "notifications"
          : "expenses";
  const selectedUnit = task === "chat" && id.success ? "&unit=" + id.data : "";
  redirect(
    "/operations?view=" +
      nextView +
      selectedUnit +
      "&message=" +
      encodeURIComponent(
        error
          ? "Action refusée. Vérifiez les champs, vos droits et les montants."
          : "Enregistrement effectué.",
      ),
  );
}
