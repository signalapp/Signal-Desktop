// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export async function requestMicrophonePermissions(): Promise<boolean> {
  const microphonePermission = await window.getMediaPermissions();
  if (!microphonePermission) {
    await window.showCallingPermissionsPopup(false);

    // Check the setting again (from the source of truth).
    return window.getMediaPermissions();
  }

  return true;
}
