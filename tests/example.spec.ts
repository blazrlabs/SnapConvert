import { test, expect } from '@playwright/test';

test('sanity: 1+1 equals 2', async () => {
  expect(1 + 1).toBe(2);
});
