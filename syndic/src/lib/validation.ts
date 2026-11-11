import { z } from "zod";
export const credentials = z.object({
  email: z.email(),
  password: z.string().min(12).max(128),
});
export const organizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
});
export const residenceSchema = z.object({
  organization_id: z.uuid(),
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(4).max(300),
  city: z.string().trim().min(2).max(80),
});
export const unitSchema = z.object({
  residence_id: z.uuid(),
  label: z.string().trim().min(1).max(60),
  kind: z.enum(["apartment", "shop", "parking"]),
  share: z.coerce.number().positive().max(1000000),
});
export const signUpSchema = z.object({
  first_name: z.string().trim().min(2).max(80),
  last_name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{8,24}$/),
  email: z.email(),
  password: z.string().min(12).max(128),
  organization: z.string().trim().min(1).max(120),
  plan: z.enum(["essai", "standard", "entreprise"]),
});
