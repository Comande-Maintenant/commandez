import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, from } }));
import { banCustomer, unbanCustomer } from "@/lib/api";
describe("merchant customer identity decisions", () => {
  beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: {}, error: null }); });
  it("atomically binds a ban to the displayed UID, never a direct contact update", async () => {
    await banCustomer("contact", "reason", "2026-10-20T00:00:00Z", "127.0.0.1", "bob");
    expect(rpc).toHaveBeenCalledWith("set_restaurant_customer_ban", { p_customer_id: "contact", p_expected_user_id: "bob", p_banned: true, p_reason: "reason", p_expires_at: "2026-10-20T00:00:00Z", p_ip: "127.0.0.1" });
    expect(from).not.toHaveBeenCalled();
  });
  it("explicitly identifies a phone-only contact with a null UID", async () => {
    await banCustomer("contact", "reason", null);
    expect(rpc).toHaveBeenCalledWith("set_restaurant_customer_ban", expect.objectContaining({ p_expected_user_id: null, p_expires_at: null, p_ip: null }));
  });
  it("unbans the displayed account as one server decision", async () => {
    await unbanCustomer("contact", "bob");
    expect(rpc).toHaveBeenCalledWith("set_restaurant_customer_ban", { p_customer_id: "contact", p_expected_user_id: "bob", p_banned: false, p_reason: "", p_expires_at: null, p_ip: null });
  });
  it("surfaces a stale snapshot to the existing UI error handling", async () => {
    const error = { code: "22023", message: "customer_identity_changed" };
    rpc.mockResolvedValueOnce({ data: null, error });
    await expect(banCustomer("contact", "reason", null, undefined, "alice")).rejects.toBe(error);
  });
});
