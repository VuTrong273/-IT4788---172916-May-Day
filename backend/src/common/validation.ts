import { fail } from './database.service.js';

export type Input = Record<string, unknown>;
export function object(value: unknown): Input {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('2007', 'Request body is invalid');
  return value as Input;
}
export function integer(value: unknown, min = 1, max = 2147483647): number {
  if (value === undefined) fail('2001', 'Missing required parameter');
  if (typeof value !== 'number' || !Number.isSafeInteger(value))
    fail('2002', 'Expected an integer');
  if (value < min || value > max) fail('2003', 'Integer out of range');
  return value;
}
export function id(value: unknown): number {
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value))
    return integer(Number(value));
  return integer(value);
}
export function text(value: unknown, max = 10000): string {
  if (value === undefined) fail('2001', 'Missing required parameter');
  if (typeof value !== 'string') fail('2002', 'Expected a string');
  if (!value.trim() || value.length > max)
    fail('2003', 'Invalid string length');
  return value.trim();
}
export function array(value: unknown, max = 100): unknown[] {
  if (!Array.isArray(value)) fail('2002', 'Expected an array');
  if (!value.length || value.length > max) fail('2003', 'Invalid array length');
  return value;
}
export function page(query: Input) {
  return {
    page: query.page === undefined ? 1 : id(query.page),
    limit: query.limit === undefined ? 20 : integer(id(query.limit), 1, 100),
  };
}
export type Field = {
  type: 'text' | 'integer' | 'json';
  max?: number;
  min?: number;
  nullable?: boolean;
  values?: readonly unknown[];
  column?: string;
};
export type Fields = Record<string, Field>;
export const str = (max: number, nullable = false): Field => ({
  type: 'text',
  max,
  nullable,
});
export const int = (min = 1, max = 2147483647, nullable = false): Field => ({
  type: 'integer',
  min,
  max,
  nullable,
});
export function validate(
  body: unknown,
  fields: Fields,
  required: string[] = [],
): Input {
  const input = object(body);
  for (const key of Object.keys(input))
    if (!fields[key]) fail('2003', `Unknown field: ${key}`);
  for (const key of required)
    if (input[key] === undefined)
      fail('2001', `Missing required parameter: ${key}`);
  const result: Input = {};
  for (const [key, value] of Object.entries(input)) {
    const field = fields[key];
    if (value === null && field.nullable) {
      result[field.column ?? key] = null;
      continue;
    }
    let parsed: unknown;
    if (field.type === 'integer') parsed = integer(value, field.min, field.max);
    else if (field.type === 'text') parsed = text(value, field.max);
    else {
      try {
        parsed = typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        fail('2003', `Invalid JSON: ${key}`);
      }
      if (!parsed || typeof parsed !== 'object')
        fail('2003', `Invalid JSON: ${key}`);
      parsed = JSON.stringify(parsed);
    }
    if (field.values && !field.values.includes(parsed))
      fail('2003', `Invalid value: ${key}`);
    result[field.column ?? key] = parsed;
  }
  return result;
}
