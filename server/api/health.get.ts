// Public uptime check. Deliberately returns no data about users/addresses.
export default defineEventHandler(() => {
  return { ok: true };
});
