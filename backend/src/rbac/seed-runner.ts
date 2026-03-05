/**
 * Standalone runner for RBAC seed. Usage: npx ts-node -r tsconfig-paths/register src/rbac/seed-runner.ts
 * Requires MONGODB_URI in env (or .env).
 * Must not run in production (NODE_ENV === 'production').
 */
require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  console.error('RBAC seed must not run in production. Refusing to run.');
  process.exit(1);
}

import { seedRbac } from './rbac.seed';

seedRbac({ mongoUri: process.env.MONGODB_URI })
  .then(() => {
    console.log('RBAC seed completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('RBAC seed failed:', err);
    process.exit(1);
  });
