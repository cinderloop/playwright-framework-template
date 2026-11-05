import { z } from 'zod';
import { idSchema } from './common.schema';

export const addressSchema = z.object({
  street: z.string().nullable(),
  house_number: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  postal_code: z.string().nullable(),
});

export const userSchema = z.object({
  id: idSchema,
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  dob: z.string().nullable(),
  address: addressSchema,
});

/** What an admin sees: these extra fields are hidden from customers. */
export const adminUserSchema = userSchema.extend({
  role: z.string(),
  enabled: z.boolean(),
  failed_login_attempts: z.number().int().nullable(),
  totp_enabled: z.boolean(),
});

/** `GET /postcode-lookup`: the address the API considers valid for a country + postcode. */
export const postcodeLookupSchema = z.object({
  street: z.string(),
  house_number: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  postcode: z.string(),
});

export type User = z.infer<typeof userSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type Address = z.infer<typeof addressSchema>;
export type PostcodeLookup = z.infer<typeof postcodeLookupSchema>;

/** `PUT /users/{id}`. The address needs at least a street, city and country. */
export interface ProfileUpdate {
  first_name: string;
  last_name: string;
  email: string;
  address: { street: string; city: string; country: string };
}

export interface RegistrationInput {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone: string;
  dob: string;
  address: {
    street: string;
    house_number: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
  };
}
