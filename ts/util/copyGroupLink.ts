// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { showToast } from './showToast';
import { ToastGroupLinkCopied } from '../components/ToastGroupLinkCopied';

export async function copyGroupLink(groupLink: string): Promise<void> {
  await window.navigator.clipboard.writeText(groupLink);
  showToast(ToastGroupLinkCopied);
}
