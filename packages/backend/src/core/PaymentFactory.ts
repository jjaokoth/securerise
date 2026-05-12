/**
 * @license
 * Univer-Escrow "Fortress" PaymentFactory
 *
 * Registry + factory pattern returning IPaymentProvider interface.
 */

import type { IPaymentProvider } from './IPaymentProvider';
import { MpesaAdapter } from '../adapters/mpesa.adapter';

export class PaymentFactory {
  static getProvider(type: string): IPaymentProvider {
    switch (type.toUpperCase()) {
      case 'MPESA':
        return new MpesaAdapter();
      default:
        throw new Error('Provider not authorized.');
    }
  }
}


