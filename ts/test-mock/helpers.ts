// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { Locator, Page } from 'playwright';
import { expect } from 'playwright/test';

export function bufferToUuid(buffer: Buffer): string {
  const hex = buffer.toString('hex');

  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20),
  ].join('-');
}

export async function typeIntoInput(
  input: Locator,
  text: string
): Promise<void> {
  let currentValue = '';
  let isInputElement = true;

  try {
    currentValue = await input.inputValue();
  } catch (e) {
    isInputElement = false;
    // if input is actually not an input (e.g. contenteditable)
    currentValue = (await input.textContent()) ?? '';
  }

  const newValue = `${currentValue}${text}`;

  await input.fill(newValue);

  // Wait to ensure that the input (and react state controlling it) has actually
  // updated with the right value
  if (isInputElement) {
    await expect(input).toHaveValue(newValue);
  } else {
    await input.locator(`:text("${newValue}")`).waitFor();
  }
}

export async function expectItemsWithText(
  items: Locator,
  expected: ReadonlyArray<string | RegExp>
): Promise<void> {
  // Wait for each message to appear in case they're not all there yet
  for (const [index, message] of expected.entries()) {
    const nth = items.nth(index);
    // eslint-disable-next-line no-await-in-loop
    await nth.waitFor();
    // eslint-disable-next-line no-await-in-loop
    const text = await nth.innerText();
    const log = `Expect item at index ${index} to match`;
    if (typeof message === 'string') {
      assert.strictEqual(text, message, log);
    } else {
      assert.match(text, message, log);
    }
  }

  const innerTexts = await items.allInnerTexts();
  assert.deepEqual(
    innerTexts.length,
    expected.length,
    `Expect correct number of items\nActual:\n${innerTexts
      .map(text => `  - "${text}"\n`)
      .join('')}\nExpected:\n${expected
      .map(text => `  - ${text.toString()}\n`)
      .join('')}`
  );
}

export async function expectSystemMessages(
  context: Page | Locator,
  expected: ReadonlyArray<string | RegExp>
): Promise<void> {
  await expectItemsWithText(
    context.locator('.SystemMessage__contents'),
    expected
  );
}
