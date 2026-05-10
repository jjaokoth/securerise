# TODO

- [ ] Update `prisma/schema.prisma` to support multiple payment providers (multi-tenant):
  - [ ] Add `TenantStatus` enum (ACTIVE/SUSPENDED)
  - [ ] Update `Tenant` model: `hashedApiKey` (rename from `apiKey`), add `@unique`, add `status`
  - [ ] Update `AuditLog` model: link to both `Tenant` and `PayoutHandshake` via mandatory `handshakeId` FK
  - [ ] Add `updatedAt` to `AuditLog`
- [ ] Create Prisma migration(s)
- [ ] Run Prisma generate / quick typecheck

