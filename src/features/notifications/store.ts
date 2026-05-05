import { create } from 'zustand';

/**
 * In-app banner queue. Holds up to ~5 transient banners that are rendered by
 * <InAppBannerHost /> over the active route. Stays in memory only — banners
 * are ephemeral by definition; persistence belongs to *push* notifications.
 *
 * Tone semantics:
 *   - info    → neutral primary (e.g. "transaction saved")
 *   - warn    → tertiary / coral (e.g. "60% of budget spent")
 *   - danger  → tertiary, stronger copy + auto-haptic (e.g. "overspent")
 *   - success → secondary (e.g. confirmation toasts)
 */

export type BannerTone = 'info' | 'warn' | 'danger' | 'success';

export type Banner = {
  id: string;
  tone: BannerTone;
  title: string;
  body?: string;
  /** Material Symbols icon name. Defaults are picked from `tone` if omitted. */
  icon?: string;
  /** Auto-dismiss after N ms. 0 / undefined = sticky until user dismisses. */
  autoDismissMs?: number;
  /** Optional CTA action. */
  action?: { label: string; onPress: () => void };
};

type BannerState = {
  banners: Banner[];
  push: (b: Omit<Banner, 'id'> & { id?: string }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

export const useBanners = create<BannerState>((set, get) => ({
  banners: [],
  push: (b) => {
    const id = b.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // De-dupe by id — repeated pushes (e.g., the engine ticking twice) coalesce.
    const next = get().banners.filter((x) => x.id !== id);
    set({ banners: [...next, { ...b, id }] });
    return id;
  },
  dismiss: (id) => set((s) => ({ banners: s.banners.filter((b) => b.id !== id) })),
  clear: () => set({ banners: [] }),
}));
