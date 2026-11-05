import type { TestData } from '@app/data';
import { buildMessage } from '@app/data';
import type { ContractClients, ContractSamples } from './operations';

/** Creates the data the covered operations refer to. */
export async function createSamples(
  testData: TestData,
  { anonymous, admin }: Pick<ContractClients, 'anonymous' | 'admin'>,
): Promise<ContractSamples> {
  const [customer, product, brand, category, images, address, catalog] = await Promise.all([
    testData.customer(),
    testData.product(),
    testData.brand(),
    testData.category(),
    anonymous.products.images(),
    anonymous.addresses.lookup('NL', '1012AB'),
    anonymous.products.list(),
  ]);
  const [firstImage] = images;
  const [firstProduct, secondProduct] = catalog.data;
  if (!firstImage || !firstProduct || !secondProduct) {
    throw new Error('The catalog is empty; has Toolshop been seeded?');
  }

  const [cartId, order, favorite, message] = await Promise.all([
    testData.cart(),
    testData.order(customer),
    customer.api.favorites.create(firstProduct.id),
    customer.api.messages.create(buildMessage()),
  ]);
  await anonymous.carts.addItem(cartId, product.id);
  await admin.productSpecs.create(product.id, { spec_name: 'Colour', spec_value: 'Red' });

  return {
    customer,
    product,
    address,
    imageId: firstImage.id,
    brandId: brand.id,
    categoryId: category.id,
    cartId,
    invoiceId: order.invoice.id,
    invoiceInput: await testData.orderInput(customer),
    favoriteId: favorite.id,
    messageId: message.id,
    secondProductId: secondProduct.id,
  };
}
