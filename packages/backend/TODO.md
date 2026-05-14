# Univer-Escrow Phase 1/2 Scaffold Checklist

- [ ] Wire HMAC-based integrity validation middleware into escrow state-changing routes.
- [ ] Update core PaymentFactory to match required switch-based scaffold (`getProvider(type: string)`).
- [ ] Ensure EscrowService imports canonical `src/core/IPaymentProvider` types (single source of truth).
- [ ] Ensure adapter-agnostic flow for lock/release/refund transitions remains intact.
- [ ] Align escrow state enum export surface (PENDING/LOCKED/DISPUTED/RELEASED/REFUNDED).
- [ ] Compile TypeScript backend package to verify no type/import breakage.
- [ ] Smoke-test endpoints for:
  - [ ] missing/invalid integrityHash => rejected
  - [ ] valid integrityHash => accepted

