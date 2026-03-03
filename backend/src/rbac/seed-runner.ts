/**
 * Standalone runner for RBAC seed. Usage: npx ts-node -r tsconfig-paths/register src/rbac/seed-runner.ts
 * Requires MONGODB_URI in env (or .env).
 */
require('dotenv').config();
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
