// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ToastType } from './Toast.dom.js';

export class ErrorWithToast extends Error {
  public toastType: ToastType;

  constructor(message: string, toastType: ToastType) {
    super(message);
    this.toastType = toastType;
  }
}
