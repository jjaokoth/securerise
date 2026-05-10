import { Request, Response } from 'express';

export class EscrowController {
  constructor(private escrowService: any) {}

  async createEscrow(req: Request, res: Response) {
    try {
      const { amount, senderId, receiverId } = req.body;
      const escrow = await this.escrowService.createEscrow({
        amount,
        senderId,
        receiverId,
      });
      res.status(201).json(escrow);
    } catch {
      res.status(500).json({ error: 'Failed to create escrow' });
    }
  }

  async getEscrow(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const escrow = await this.escrowService.getEscrowById(id);
      if (!escrow) {
        return res.status(404).json({ error: 'Escrow not found' });
      }
      res.status(200).json(escrow);
    } catch {
      res.status(500).json({ error: 'Failed to retrieve escrow' });
    }
  }

  async updateEscrow(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const escrowData = req.body;
      const updatedEscrow = await this.escrowService.updateEscrow(id, escrowData);
      if (!updatedEscrow) {
        return res.status(404).json({ error: 'Escrow not found' });
      }
      res.status(200).json(updatedEscrow);
    } catch {
      res.status(500).json({ error: 'Failed to update escrow' });
    }
  }

  async deleteEscrow(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deleted = await this.escrowService.deleteEscrow(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Escrow not found' });
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'Failed to delete escrow' });
    }
  }
}

