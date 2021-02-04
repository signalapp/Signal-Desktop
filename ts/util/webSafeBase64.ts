// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function toWebSafeBase64(base64: string): string {
  return base64.replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
}

export function fromWebSafeBase64(webSafeBase64: string): string {
  const base64 = webSafeBase64.replace(/_/g, '/').replace(/-/g, '+');

  // Ensure that the character count is a multiple of four, filling in the extra
  //   space needed with '='
  const remainder = base64.length % 4;
  if (remainder === 3) {
    return `${base64}=`;
  }
  if (remainder === 2) {
    return `${base64}==`;
  }
  if (remainder === 1) {
    return `${base64}===`;
  }

  return base64;
}
