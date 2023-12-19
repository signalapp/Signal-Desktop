// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Locator } from 'playwright';

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

export async function type(input: Locator, text: string): Promise<void> {
  let currentValue = '';

  try {
    currentValue = await input.inputValue();
  } catch (e) {
    // if input is actually not an input (e.g. contenteditable)
    currentValue = (await input.textContent()) ?? '';
  }

  // Type with a reasonably human delay
  await input.type(text, { delay: 100 });

  // Wait to ensure that the input (and react state controlling it) has actually
  // updated with the right value
  await input.locator(`:text("${currentValue}${text}")`).waitFor();
}
