export async function requestCameraPermissions(): Promise<boolean> {
  if (!(await window.getMediaCameraPermissions())) {
    await window.showCallingPermissionsPopup(true);

    // Check the setting again (from the source of truth).
    return window.getMediaCameraPermissions();
  }

  return true;
}
