import { z } from 'zod';
import { idSchema, paginated } from './common.schema';

export const paymentMethods = [
  'bank-transfer',
  'cash-on-delivery',
  'credit-card',
  'buy-now-pay-later',
  'gift-card',
] as const;

const billingAddress = {
  billing_street: z.string(),
  billing_city: z.string(),
  billing_state: z.string().nullable(),
  billing_country: z.string(),
  billing_postal_code: z.string().nullable(),
};

export const invoiceNumberSchema = z.string().regex(/^INV-\d+$/);

export const createdInvoiceSchema = z.object({
  id: idSchema,
  invoice_number: invoiceNumberSchema,
  user_id: idSchema,
  subtotal: z.number(),
  total: z.number(),
  ...billingAddress,
});

export const invoiceLineSchema = z.object({
  id: idSchema,
  invoice_id: idSchema,
  product_id: idSchema,
  unit_price: z.number(),
  quantity: z.number().int().positive(),
  product: z.object({ id: idSchema, name: z.string() }),
});

export const invoiceSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  invoice_number: invoiceNumberSchema,
  invoice_date: z.string(),
  status: z.string(),
  subtotal: z.number(),
  total: z.number(),
  invoicelines: z.array(invoiceLineSchema),
  payment: z.object({ payment_method: z.enum(paymentMethods) }),
  ...billingAddress,
});

export const invoicePageSchema = paginated(invoiceSchema);

export type Invoice = z.infer<typeof invoiceSchema>;
export type CreatedInvoice = z.infer<typeof createdInvoiceSchema>;
export type PaymentMethod = (typeof paymentMethods)[number];

export interface InvoiceInput {
  cart_id: string;
  payment_method: PaymentMethod;
  payment_details: Record<string, string>;
  billing_street: string;
  billing_city: string;
  billing_state: string;
  billing_country: string;
  billing_postal_code: string;
}
