/**
 * © 2026 Securerise Solutions Limited
 * Payment Provider Factory
 * 
 * Factory pattern for instantiating payment provider adapters.
 * Enables seamless multi-provider integration without coupling to specific implementations.
 */

import type { IPaymentProvider, ProviderType } from '../../shared/interfaces/IPaymentProvider';

import { MpesaAdapter } from './mpesa.adapter';
import { StripeAdapter } from './stripe.adapter';
import { BankTransferAdapter } from './bank-transfer.adapter';


export class ProviderFactory {
  private static instances: Map<ProviderType, IPaymentProvider> = new Map();

  /**
   * Get or create a provider adapter instance.
   * Uses singleton pattern to reuse provider instances across the application.
   */
  static getProvider(providerType: ProviderType): IPaymentProvider {
    // Return cached instance if available
    if (this.instances.has(providerType)) {
      return this.instances.get(providerType)!;
    }

    let provider: IPaymentProvider;

    switch (providerType) {
      case 'MPESA':
        provider = new MpesaAdapter();
        break;

      case 'STRIPE':
        provider = new StripeAdapter();
        break;

      case 'BANK_TRANSFER':
        provider = new BankTransferAdapter();
        break;

      case 'USDC':
      case 'AIRTEL':
        throw new Error(`PROVIDER_NOT_YET_IMPLEMENTED_${providerType}`);

      default:
        throw new Error(`PROVIDER_NOT_SUPPORTED_${providerType}`);
    }

    this.instances.set(providerType, provider);
    return provider;
  }

  /**
   * Get all supported provider types.
   */
  static getSupportedProviders(): ProviderType[] {
    return ['MPESA', 'STRIPE', 'BANK_TRANSFER'];
  }

  /**
   * Check if a provider type is supported.
   */
  static isProviderSupported(providerType: string): boolean {
    return this.getSupportedProviders().includes(providerType as ProviderType);
  }

  /**
   * Clear cached instances (for testing or provider reconfiguration).
   */
  static clearCache(): void {
    this.instances.clear();
  }
}
