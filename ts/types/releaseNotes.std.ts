// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type ReleaseNoteCtaId = 'donate';

export function isReleaseNoteCtaId(
  ctaId: string | undefined
): ctaId is ReleaseNoteCtaId {
  return ctaId === 'donate';
}
