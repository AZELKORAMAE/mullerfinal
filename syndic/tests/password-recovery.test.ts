import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(), verifyOtp: vi.fn(),
  updateUser: vi.fn(), signOut: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ supabase: async () => ({ auth }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(url); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { resetPassword, resetPasswordWithCode } from "../src/app/actions";
function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [k, v] of Object.entries({ email: " TEST@example.com ", code: "012345", password: "a-long-password", confirmation: "a-long-password", ...overrides })) data.set(k, v);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  auth.verifyOtp.mockResolvedValue({ data: { user: { id: "test" }, session: {} }, error: null });
  auth.updateUser.mockResolvedValue({ error: null });
});
describe("récupération par code", () => {
  it("envoie une demande recovery sans lien de redirection", async () => {
    await expect(resetPassword(form())).rejects.toThrow("/reinitialiser-mot-de-passe?message=");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("test@example.com");
  });
  it.each(["12345", "1234567", "abcdef"])("refuse le code mal formé %s", async (code) => {
    await expect(resetPasswordWithCode(form({ code }))).rejects.toThrow();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("refuse une confirmation différente avant de consommer le code", async () => {
    await expect(resetPasswordWithCode(form({ confirmation: "different-password" }))).rejects.toThrow();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
  it("ne change pas le mot de passe avec un code expiré", async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: { message: "expired" } });
    await expect(resetPasswordWithCode(form())).rejects.toThrow();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("vérifie le code recovery avec son zéro initial puis change le mot de passe", async () => {
    await expect(resetPasswordWithCode(form())).rejects.toThrow("/connexion?message=");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "test@example.com", token: "012345", type: "recovery" });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "a-long-password" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
