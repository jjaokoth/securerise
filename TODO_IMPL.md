# Implementation TODO (Securerise) - step tracking

- [ ] Update `src/routes/paymentRoutes.ts` to use `tenantAuth` for all endpoints (currently unprotected).
- [ ] Align paths/routers so the actual mounted paths match the intended API contract (prefer using `paymentApi.ts` or consolidate).
- [ ] Update `src/index.ts` to mount the consolidated router under `/api/v1/handshake` (and avoid duplicate/conflicting route modules).
- [x] Run `npm run build` to confirm compile health.
- [ ] Run `npm run lint` (if available) to confirm lint health.

- [ ] (If required) run basic route smoke test via `node`/curl against local server.

