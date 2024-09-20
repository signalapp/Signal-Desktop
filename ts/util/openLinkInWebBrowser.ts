// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isValidLink } from '../types/LinkPreview';

export function openLinkInWebBrowser(url: string): void {
  if (!isValidLink(url)) {
    return;
  }
  window.location.href = url;
}
