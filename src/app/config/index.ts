import { z } from 'zod';
import { baseEnvSchema, loadConfig } from '@core/config';

/**
 * Toolshop targets. `local` is the Docker Compose stack in this repo;
 * `public` is the hosted demo, which is shared, so keep runs against it light.
 */
const environments = {
  local: {
    BASE_URL: 'http://localhost:4200',
    API_URL: 'http://localhost:8091',
  },
  public: {
    BASE_URL: 'https://practicesoftwaretesting.com',
    API_URL: 'https://api.practicesoftwaretesting.com',
  },
};

const toolshopEnvSchema = baseEnvSchema
  .extend({
    CUSTOMER_EMAIL: z.email(),
    CUSTOMER_PASSWORD: z.string().min(1),
    ADMIN_EMAIL: z.email(),
    ADMIN_PASSWORD: z.string().min(1),
  })
  .transform((env) => ({
    environment: env.TEST_ENV,
    baseUrl: env.BASE_URL,
    apiUrl: env.API_URL,
    users: {
      customer: { email: env.CUSTOMER_EMAIL, password: env.CUSTOMER_PASSWORD },
      admin: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
    },
  }));

export type ToolshopConfig = z.output<typeof toolshopEnvSchema>;
export type Role = keyof ToolshopConfig['users'];
export type Credentials = ToolshopConfig['users'][Role];

export const roles = ['customer', 'admin'] as const satisfies readonly Role[];

export const config: ToolshopConfig = loadConfig({
  schema: toolshopEnvSchema,
  environments,
  defaultEnvironment: 'local',
});
