"use server";
import { z } from "zod";
import { signedIn } from "@/lib/access";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
export async function incidentAction(form: FormData) {
  const { db } = await signedIn();
  let error = true;
  try {
    const target = z.uuid().parse(form.get("target"));
    if (form.get("task") === "report") {
      const title = z.string().trim().min(3).max(160).parse(form.get("title"));
      const description = z
        .string()
        .trim()
        .min(5)
        .max(5000)
        .parse(form.get("description"));
      const priority = z.enum(["normal", "urgent"]).parse(form.get("priority"));
      error = Boolean(
        (
          await db.rpc("syndic_report_incident", {
            target_unit: target,
            incident_title: title,
            incident_description: description,
            incident_priority: priority,
          })
        ).error,
      );
    } else {
      const status = z
        .enum(["open", "in_progress", "resolved"])
        .parse(form.get("status"));
      const resolution = z
        .string()
        .trim()
        .max(5000)
        .parse(form.get("resolution"));
      error = Boolean(
        (
          await db.rpc("syndic_update_incident", {
            target_incident: target,
            incident_status: status,
            incident_resolution: resolution,
          })
        ).error,
      );
    }
  } catch {}
  revalidatePath("/incidents");
  redirect(
    "/incidents?message=" +
      encodeURIComponent(
        error
          ? "Action refusée. Vérifiez vos droits et renseignez un compte rendu pour clôturer."
          : "Incident enregistré.",
      ),
  );
}
