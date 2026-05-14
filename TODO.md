# TODO

- [x] Create `packages/backend/src/config/settlement.ts` (NCBA Loop master payout destination)
- [x] Create `packages/backend/src/middleware/integrity.ts` (License Guard + 1% surcharge + fee routing)

- [x] Create `packages/frontend_flutter/lib/services/ussd_service.dart` (USSD offline dialer using url_launcher)

- [ ] Update `packages/frontend_flutter/lib/main.dart` (UI updates: Bank/USSD option, syntax rules)
- [ ] Update `packages/backend/src/controllers/PaymentController.ts` to apply integrity logic in payment processing path
- [ ] Ensure response payload includes final amount with 1% adjustment when license fails
- [ ] Run `flutter pub add url_launcher` in `packages/frontend_flutter`
- [ ] Build/Typecheck backend + Flutter to ensure compilation

