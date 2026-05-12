# Securerise - Architectural Reset Checklist

- [ ] Update Dockerfile to node:18-alpine multi-stage build with Prisma generate in build stage + Alpine-compatible Prisma engines
- [ ] Rewrite .github/workflows/deploy.yml for Cloud Run pipeline (Checkout, Google Auth via SA key, Docker build/push to GCR/Artifact Registry, Deploy with --allow-unauthenticated)
- [ ] Fix src/index.ts to use const PORT = process.env.PORT || 8080 and keep BigInt JSON patch
- [ ] Ensure src/index.ts includes cors configuration and BigInt.prototype.toJSON patch (and no conflicting double initialization)
- [ ] Ensure GET /health route exists (Cloud Run health check)
- [ ] Update src/services/PaymentService.ts with full createHandshake + verifyAndRelease logic: BigInt KES cents, crypto SHA-256 OTP hashing, and capture podPhotoUrl + podGps metadata
- [ ] Update src/controllers/PaymentController.ts to cleanly map service, use x-idempotency-key from headers
- [ ] Harden .gitignore to exclude sensitive .env and prisma/*.db files
- [ ] Update README.md with professional investor-ready description of Universal Trust Layer architecture

