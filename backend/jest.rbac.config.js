/** Jest config for RBAC module only. Enforces coverage threshold for src/rbac (audit 9–10). */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  collectCoverageFrom: [
    'rbac/rbac.service.ts',
    'rbac/rbac.registry.ts',
    'rbac/guards/*.ts',
    'rbac/utils/*.ts',
    'rbac/errors/*.ts',
    'rbac/schemas/*.ts',
    '!rbac/**/*.spec.ts',
  ],
  coverageDirectory: '../coverage-rbac',
  coverageThreshold: {
    global: {
      lines: 75,
      branches: 68,
      functions: 75,
      statements: 80,
    },
  },
};
