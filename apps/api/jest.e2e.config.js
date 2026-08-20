/** Integration tests: hit the real NestJS app + real Postgres via Prisma, no mocks. */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  setupFiles: ['<rootDir>/test/jest-e2e-setup.ts'],
  testTimeout: 30000,
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
};
