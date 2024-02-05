// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function removeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}
