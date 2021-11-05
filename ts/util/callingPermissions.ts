// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export async function requestCameraPermissions(): Promise<boolean> {
  if (!(await window.getMediaCameraPermissions())) {
    await window.showPermissionsPopup(true, true);

    // Check the setting again (from the source of truth).
    return window.getMediaCameraPermissions();
  }

  return true;
}
