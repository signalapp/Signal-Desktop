# Copyright 2023 Signal Messenger, LLC
# SPDX-License-Identifier: AGPL-3.0-only

!include WinVer.nsh
!include SignalStrings.nsh

ManifestDPIAware true

!macro preInit
  Var /Global OLD_SIGNAL_VERSION

  # Check minimum OS version
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONEXCLAMATION "$(signalMinWinVersionErr)"
    DetailPrint `Windows version check failed`
    Abort
  ${EndIf}

  # If previously installed
  ReadRegStr $OLD_SIGNAL_VERSION SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" \
      "DisplayVersion"
  StrCmp $OLD_SIGNAL_VERSION "" end_semver_check

  # Check that we are not overwriting newer version of the app.
  ${StdUtils.ScanStr3} $R0 $R1 $R2 "%d.%d.%d" $OLD_SIGNAL_VERSION 0 0 0
  ${StdUtils.ScanStr3} $R3 $R4 $R5 "%d.%d.%d" ${VERSION} 0 0 0

  # Compare major number
  IntCmp $R0 $R3 same_major end_semver_check downgrade

  # Compare minor number
  same_major:
    IntCmp $R1 $R4 same_minor end_semver_check downgrade

  # Compare patch number
  same_minor:
    IntCmp $R2 $R5 end_semver_check end_semver_check downgrade

  # Detected downgrade - show message box
  downgrade:
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
        "$(signalMinAppVersionErr)" /SD IDCANCEL IDOK end_semver_check
    DetailPrint `SemVer check failed`
    Abort

  end_semver_check:
!macroend

!macro customInstall
  ${If} ${Silent}
  ${AndIf} ${isUpdated}
    # Copied from app-builder-lib templates/nsis/common.nsh:

    # "otherwise app window will be in background"
    HideWindow

    # Signal modification: '--start-in-tray' added
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" \
        "--updated --start-in-tray"
  ${EndIf}
!macroend
