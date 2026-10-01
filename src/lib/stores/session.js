import { writable } from 'svelte/store';

/**
 * Current Materio ID session. Pages are cached and identical for everyone, so
 * the user is loaded in the browser after hydration instead of during SSR.
 * @type {import('svelte/store').Writable<{ user: any, accessTier: string, ready: boolean }>}
 */
export const session = writable({ user: null, accessTier: 'guest', ready: false });

export async function loadSession() {
    try {
        const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
        const data = res.ok ? await res.json() : null;
        session.set({ user: data?.user ?? null, accessTier: data?.accessTier ?? 'guest', ready: true });
    } catch {
        session.update((s) => ({ ...s, ready: true }));
    }
}
