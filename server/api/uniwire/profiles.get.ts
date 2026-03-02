import { requireUser } from "../../utils/auth";
import { uniwireRequest } from "../../utils/uniwire";
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  if (!user) return { ok: false };

  return await uniwireRequest("/v1/profiles/", {}, "GET");
});
