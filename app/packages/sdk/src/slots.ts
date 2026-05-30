export const SLOT_MS = 400;
export function minutesToSlots(minutes: number): bigint { return BigInt(Math.round((minutes * 60 * 1000) / SLOT_MS)); }
export function slotsToApproxMs(slots: bigint): number { return Number(slots) * SLOT_MS; }
export function slotToApproxTime(targetSlot: bigint, currentSlot: bigint, now = Date.now()): Date {
  return new Date(now + Number(targetSlot - currentSlot) * SLOT_MS);
}
