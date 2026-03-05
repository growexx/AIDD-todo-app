import { escapeForRegex } from './regex-escape';

describe('escapeForRegex', () => {
  it('returns empty string for null or undefined', () => {
    expect(escapeForRegex(null)).toBe('');
    expect(escapeForRegex(undefined)).toBe('');
  });

  it('escapes special regex characters', () => {
    expect(escapeForRegex('a.b')).toBe('a\\.b');
    expect(escapeForRegex('a*b')).toBe('a\\*b');
    expect(escapeForRegex('(x)')).toBe('\\(x\\)');
    expect(escapeForRegex('[a-z]')).toBe('\\[a-z\\]');
    expect(escapeForRegex('a+b')).toBe('a\\+b');
    expect(escapeForRegex('a?b')).toBe('a\\?b');
  });

  it('returns same string when no special chars', () => {
    expect(escapeForRegex('hello')).toBe('hello');
    expect(escapeForRegex('role-name')).toBe('role-name');
  });
});
