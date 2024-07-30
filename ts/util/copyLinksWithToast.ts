// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ToastType } from '../types/Toast';

export async function copyGroupLink(groupLink: string): Promise<void> {
  await window.navigator.clipboard.writeText(groupLink);
  window.reduxActions.toast.showToast({ toastType: ToastType.GroupLinkCopied });
}

export async function copyCallLink(callLink: string): Promise<void> {
  await window.navigator.clipboard.writeText(callLink);
  window.reduxActions.toast.showToast({ toastType: ToastType.CopiedCallLink });
}
