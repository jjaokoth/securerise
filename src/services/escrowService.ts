// PrismaClient import can be type-fragile in this environment; use dynamic require.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client');


type EscrowStatus = 'PENDING' | 'COMPLETED' | 'CANCELED';

export class EscrowService {
  private prisma: any;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createEscrow(escrowData: {
    amount: number;
    senderId: string;
    receiverId: string;
  }) {
    // Prisma schema currently models:
    // - EscrowTransaction(sender, receiver, amount, status)
    // It does not include `terms`.
    const escrow = await this.prisma.escrowTransaction.create({
      data: {
        amount: escrowData.amount,
        sender: escrowData.senderId,
        receiver: escrowData.receiverId,
        status: 'PENDING',
      },
    });
    return escrow;
  }

  async getEscrowById(escrowId: string) {
    const id = Number(escrowId);
    if (Number.isNaN(id)) return null;
    const escrow = await this.prisma.escrowTransaction.findUnique({
      where: { id },
    });
    return escrow;
  }

  async updateEscrow(escrowId: string, escrowData: { status?: EscrowStatus }) {
    const id = Number(escrowId);
    if (Number.isNaN(id)) return null;

    if (!escrowData?.status) {
      return this.prisma.escrowTransaction.findUnique({ where: { id } });
    }

    try {
      const updated = await this.prisma.escrowTransaction.update({
        where: { id },
        data: { status: escrowData.status },
      });
      return updated;
    } catch {
      return null;
    }
  }

  async deleteEscrow(_escrowId: string) {
    // Current schema has no relation requiring soft delete.
    // Implement as a no-op hard delete only if model exists.
    const id = Number(_escrowId);
    if (Number.isNaN(id)) return false;

    try {
      await this.prisma.escrowTransaction.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async completeEscrow(escrowId: string) {
    const id = Number(escrowId);
    if (Number.isNaN(id)) return null;
    const escrow = await this.prisma.escrowTransaction.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
    return escrow;
  }

  async cancelEscrow(escrowId: string) {
    const id = Number(escrowId);
    if (Number.isNaN(id)) return null;
    const escrow = await this.prisma.escrowTransaction.update({
      where: { id },
      data: { status: 'CANCELED' },
    });
    return escrow;
  }

  async getAllEscrows() {
    const escrows = await this.prisma.escrowTransaction.findMany();
    return escrows;
  }
}
