type Listener = (slot: bigint) => void;
export function createSlotClock(rpc: { getSlot: () => { send: () => Promise<bigint> } }, opts?: { intervalMs?: number }) {
  const interval = opts?.intervalMs ?? 2000;
  const listeners = new Set<Listener>();
  let current: bigint | null = null;
  const tick = async () => {
    try { current = await rpc.getSlot().send(); listeners.forEach((l) => l(current!)); } catch { /* transient RPC error */ }
  };
  void tick();
  const timer = setInterval(tick, interval);
  return {
    get current() { return current; },
    subscribe(l: Listener) { listeners.add(l); if (current != null) l(current); return () => listeners.delete(l); },
    dispose() { clearInterval(timer); listeners.clear(); },
  };
}
