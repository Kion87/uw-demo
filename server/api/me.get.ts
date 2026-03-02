import { requireUser } from "../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  if (!user) return { ok: false, error: "Unauthorized" };

  return { ok: true, user };
});
