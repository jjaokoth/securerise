# TODO - Prisma schema updates

- [ ] Update `securerise/prisma/schema.prisma` to be Prisma 6 compatible and add the `Transaction` model with requested fields.
- [ ] Add `TransactionStatus` enum: PENDING, LOCKED, RELEASED, DISPUTED.
- [ ] Ensure `datasource db` keeps `url = env("DATABASE_URL")` for Prisma 6 compatibility.
- [ ] Keep existing other models/enums intact (Tenant/PayoutHandshake/etc.).

