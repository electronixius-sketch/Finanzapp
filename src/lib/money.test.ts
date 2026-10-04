import { describe, expect, it } from 'vitest';
import { parseAmount } from './money';

describe('parseAmount', () => {
  it.each([
    ['12,50', 1250],
    ['-12,50', -1250],
    ['1.234,56', 123456],
    ['-1.234,56 €', -123456],
    ['1,234.56', 123456],
    ['12.5', 1250],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['12,50-', -1250],
    ['−3,20', -320],
    ['+7', 700],
    ['EUR 9,99', 999],
    ['0,10', 10],
  ])('%s → %d', (input, cents) => {
    expect(parseAmount(input)).toBe(cents);
  });

  it.each(['', 'abc', '1,2,3', '12.34.5'])('rejects %j', (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});
