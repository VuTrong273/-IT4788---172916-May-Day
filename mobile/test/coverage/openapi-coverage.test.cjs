const path = require('node:path');
const {
  collectOperations,
  operationKey,
  readYaml,
  validateCoverage,
} = require('../../scripts/check-openapi-coverage.cjs');

const projectRoot = path.resolve(__dirname, '..', '..');
const openApiPath = path.resolve(projectRoot, '..', 'Docs', '[MayDay] openapi.yaml');
const ledgerPath = path.join(
  projectRoot,
  'coverage',
  'openapi-operation-coverage.yaml',
);

describe('OpenAPI operation coverage baseline', () => {
  const openApi = readYaml(openApiPath);
  const ledger = readYaml(ledgerPath);

  test('enumerates 107 unique method/path operations', () => {
    const operations = collectOperations(openApi);
    const keys = operations.map((operation) =>
      operationKey(operation.method, operation.path),
    );

    expect(operations).toHaveLength(107);
    expect(new Set(keys).size).toBe(107);
  });

  test('matches each operation with role, action, domain, and implementation task', () => {
    expect(validateCoverage(openApi, ledger).errors).toEqual([]);
  });

  test('detects duplicated ledger identities instead of silently counting them', () => {
    const duplicateLedger = {
      ...ledger,
      operations: [...ledger.operations, ledger.operations[0]],
    };

    expect(validateCoverage(openApi, duplicateLedger).errors).toContain(
      'Coverage ledger contains 108 rows; expected 107.',
    );
    expect(
      validateCoverage(openApi, duplicateLedger).errors.some((message) =>
        message.startsWith('Duplicate coverage-ledger operation:'),
      ),
    ).toBe(true);
  });
});
