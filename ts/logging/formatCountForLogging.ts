// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const formatCountForLogging = (count: number): string => {
  if (count === 0 || Number.isNaN(count)) {
    return String(count);
  }

  return `at least ${10 ** Math.floor(Math.log10(count))}`;
};
