// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export async function requestMicrophonePermissions(
  forCalling: boolean
): Promise<boolean> {
  const microphonePermission = await window.getMediaPermissions();
  if (!microphonePermission) {
    await window.showPermissionsPopup(forCalling, false);

    // Check the setting again (from the source of truth).
    return window.getMediaPermissions();
  }

  return true;
}
