/** Wall-clock budget for session read + gated verify on cold start / retry (product SLA). */
export const AUTH_BOOTSTRAP_BUDGET_MS = 3000

/** Tight per-fetch ceiling during bootstrap so required checks can finish inside {@link AUTH_BOOTSTRAP_BUDGET_MS}. */
export const AUTH_BOOTSTRAP_FETCH_MS = 2200

export class AuthBootstrapTimeoutError extends Error {
  readonly name = 'AuthBootstrapTimeoutError'
  constructor() {
    super(`Auth bootstrap exceeded ${AUTH_BOOTSTRAP_BUDGET_MS}ms`)
  }
}
