import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/lib/api';
import { describeError } from '../src/lib/errorReport';

describe('describeError', () => {
  it('skips expected API failures', () => {
    expect(describeError('rejection', new ApiError('unreachable', 0))).toBeUndefined();
  });

  it('keeps the error, not more', () => {
    const report = describeError('error', new TypeError('x is undefined'))!;
    expect(report.message).toBe('TypeError: x is undefined');
    expect(report.kind).toBe('error');
    expect(Object.keys(report).sort()).toEqual(['kind', 'message', 'platform', 'route', 'stack']);
  });

  it('accepts thrown strings and trims long messages', () => {
    expect(describeError('rejection', 'boom')!.message).toBe('boom');
    expect(describeError('error', 'x'.repeat(2000))!.message).toHaveLength(500);
  });
});
