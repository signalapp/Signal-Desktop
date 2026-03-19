// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type DeletedMatch = RegExpMatchArray & { 1: string };
export const DELETED_REGEXP = /\(\s*deleted\s+(\d{2,4}\/\d{2}\/\d{2,4})\s*\)/i;
