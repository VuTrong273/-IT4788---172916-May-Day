const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('yaml');

const EXPECTED_OPERATION_COUNT = 106;
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const MOBILE_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(MOBILE_ROOT, '..');
const OPENAPI_PATH = path.join(PROJECT_ROOT, 'Docs', '[MayDay] openapi.yaml');
const LEDGER_PATH = path.join(
  MOBILE_ROOT,
  'coverage',
  'openapi-operation-coverage.yaml',
);
const REQUIRED_COLUMNS = [
  'method',
  'path',
  'action',
  'domain',
  'roles',
  'task',
  'status',
];

function operationKey(method, route) {
  return `${String(method).toUpperCase()} ${route}`;
}

function readYaml(filePath) {
  return parse(fs.readFileSync(filePath, 'utf8'));
}

function extractRoleIndex(description) {
  const index = new Map();

  for (const line of String(description || '').split(/\r?\n/)) {
    const cells = line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
    const method = cells[0]?.toLowerCase();

    if (cells.length < 4 || !HTTP_METHODS.has(method)) {
      continue;
    }

    const route = cells[1].replace(/^`|`$/g, '').trim();
    const rawRoles = cells[cells.length - 1];
    const roles = /public|c.ng khai/i.test(rawRoles)
      ? ['public']
      : rawRoles
          .split(',')
          .map((role) => role.trim())
          .filter(Boolean);

    index.set(operationKey(method, route), roles.sort());
  }

  return index;
}

function collectOperations(openApi) {
  const rolesByOperation = extractRoleIndex(openApi.info?.description);
  const operations = [];

  for (const [route, pathItem] of Object.entries(openApi.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (!HTTP_METHODS.has(method.toLowerCase())) {
        continue;
      }

      const key = operationKey(method, route);
      operations.push({
        method: method.toUpperCase(),
        path: route,
        operationId: operation.operationId || '',
        domain: operation.tags?.[0] || '',
        roles: rolesByOperation.get(key) || [],
      });
    }
  }

  return operations;
}

function materializeLedger(ledger) {
  if (!Array.isArray(ledger.columns) || !Array.isArray(ledger.operations)) {
    return { rows: [], errors: ['Ledger must contain columns and operations arrays.'] };
  }

  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !ledger.columns.includes(column),
  );
  const errors = missingColumns.map((column) => `Ledger is missing column "${column}".`);

  const rows = ledger.operations.map((values, index) => {
    if (!Array.isArray(values) || values.length !== ledger.columns.length) {
      errors.push(`Ledger row ${index + 1} does not match the columns shape.`);
      return {};
    }
    return Object.fromEntries(ledger.columns.map((column, i) => [column, values[i]]));
  });

  return { rows, errors };
}

function validateCoverage(openApi, ledger, { strict = false } = {}) {
  const errors = [];
  const contractOperations = collectOperations(openApi);
  const { rows, errors: ledgerErrors } = materializeLedger(ledger);
  errors.push(...ledgerErrors);

  if (contractOperations.length !== EXPECTED_OPERATION_COUNT) {
    errors.push(
      `OpenAPI declares ${contractOperations.length} operations; expected ${EXPECTED_OPERATION_COUNT}.`,
    );
  }
  if (rows.length !== EXPECTED_OPERATION_COUNT) {
    errors.push(
      `Coverage ledger contains ${rows.length} rows; expected ${EXPECTED_OPERATION_COUNT}.`,
    );
  }

  const contractByKey = new Map();
  for (const operation of contractOperations) {
    const key = operationKey(operation.method, operation.path);
    if (contractByKey.has(key)) {
      errors.push(`Duplicate OpenAPI operation: ${key}.`);
    }
    contractByKey.set(key, operation);
  }

  const ledgerByKey = new Map();
  for (const row of rows) {
    const key = operationKey(row.method, row.path);
    if (ledgerByKey.has(key)) {
      errors.push(`Duplicate coverage-ledger operation: ${key}.`);
    }
    ledgerByKey.set(key, row);

    const operation = contractByKey.get(key);
    if (!operation) {
      errors.push(`Ledger operation is not in OpenAPI: ${key}.`);
      continue;
    }
    if (row.action !== operation.operationId) {
      errors.push(
        `${key} action "${row.action}" does not match operationId "${operation.operationId}".`,
      );
    }
    if (row.domain !== operation.domain) {
      errors.push(`${key} domain "${row.domain}" does not match "${operation.domain}".`);
    }
    if (
      JSON.stringify([...(row.roles || [])].sort()) !==
      JSON.stringify(operation.roles)
    ) {
      errors.push(`${key} roles do not match the OpenAPI role index.`);
    }
    if (!/^T\d{3}$/.test(String(row.task || ''))) {
      errors.push(`${key} must name an implementation task such as T004.`);
    }
    if (!['planned', 'covered'].includes(row.status)) {
      errors.push(`${key} has unsupported coverage status "${row.status}".`);
    }
    if (strict) {
      const evidenceFields = [
        'screenAction',
        'clientFunction',
        'requestSchemaRefs',
        'responseSchemaRefs',
        'errorTest',
        'browserEvidence',
        'nativeEvidence',
      ];
      for (const field of evidenceFields) {
        if (
          row[field] === undefined ||
          row[field] === null ||
          row[field] === '' ||
          row[field] === 'pending'
        ) {
          errors.push(`${key} is missing completed "${field}" evidence.`);
        }
      }
      if (row.status !== 'covered') {
        errors.push(`${key} is still "${row.status}", not covered.`);
      }
    }
  }

  for (const key of contractByKey.keys()) {
    if (!ledgerByKey.has(key)) {
      errors.push(`OpenAPI operation is missing from the ledger: ${key}.`);
    }
  }

  return { errors, operationCount: contractOperations.length, ledgerCount: rows.length };
}

function run({ strict = process.argv.includes('--strict') } = {}) {
  const openApi = readYaml(OPENAPI_PATH);
  const ledger = readYaml(LEDGER_PATH);
  const result = validateCoverage(openApi, ledger, { strict });

  if (result.errors.length > 0) {
    console.error('OpenAPI coverage check failed:');
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    return 1;
  }

  const status = strict ? 'strict operation evidence' : 'operation mapping baseline';
  console.log(
    `OpenAPI ${status} valid: ${result.operationCount} contract operations match ${result.ledgerCount} unique ledger rows.`,
  );
  if (!strict) {
    console.log('Planned ledger rows are inventory only, not implementation evidence.');
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = run();
}

module.exports = {
  collectOperations,
  materializeLedger,
  operationKey,
  readYaml,
  validateCoverage,
};
