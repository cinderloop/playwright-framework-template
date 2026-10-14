import { BaseApiClient } from '@core/api';
import { postcodeLookupSchema, type PostcodeLookup } from '@app/schemas';

export class AddressesApi extends BaseApiClient {
  /**
   * The address Toolshop considers valid for a country + postcode. Checkout
   * rejects billing addresses whose city/state disagree with this lookup.
   */
  async lookup(country: string, postcode: string): Promise<PostcodeLookup> {
    const response = await this.send('GET', '/postcode-lookup', { params: { country, postcode } });
    return this.parse(response, postcodeLookupSchema);
  }
}
