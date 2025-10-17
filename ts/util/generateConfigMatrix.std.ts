// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Only for tests. Use this to generate multiple test cases for a config matrix.
//
// Example:
//
//   generateConfigMatrix({
//     contacts: [20, 30],
//     hasNotification: [false, true],
//   });
//
// Outputs:
//
//   [
//     { contacts: 20, hasNotification: false },
//     { contacts: 30, hasNotification: false },
//     { contacts: 20, hasNotification: true },
//     { contacts: 30, hasNotification: true },
//   ]
export function generateConfigMatrix<Config>(combinations: {
  [K in keyof Config]: ReadonlyArray<Config[K]>;
}): ReadonlyArray<Config> {
  let result = [{} as Record<string, unknown>];

  const entries = [...Object.entries(combinations)] as Array<
    [string, ReadonlyArray<unknown>]
  >;
  if (
    entries.length === 0 ||
    entries.every(([, values]) => values.length === 0)
  ) {
    return [];
  }

  for (const [key, values] of entries) {
    result = values
      // Make a copy of each existing result for each value
      // eslint-disable-next-line no-loop-func
      .map(value =>
        result.map(config => ({
          ...config,
          [key]: value,
        }))
      )
      .flat();
  }

  return result as ReadonlyArray<Config>;
}
