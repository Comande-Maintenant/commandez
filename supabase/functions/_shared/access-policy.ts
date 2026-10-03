// Current public offer, 3 October 2026: free access for everyone.
// A future paid offer requires a separate, explicitly approved rollout.
export const FREE_ACCESS = true;
export const freeAccessResponse = () => ({ skipped: true, reason: 'currently_free', checkout: false });
