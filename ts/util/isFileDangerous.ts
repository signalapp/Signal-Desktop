// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

const DANGEROUS_FILE_TYPES =
  /\.(ADE|ADP|APK|BAT|CAB|CHM|CMD|COM|CPL|DIAGCAB|DLL|DMG|EXE|HTA|INF|INS|ISP|JAR|JS|JSE|LIB|LNK|MDE|MHT|MSC|MSI|MSP|MST|NSH|PIF|PS1|PSC1|PSM1|PSRC|REG|SCR|SCT|SETTINGCONTENT-MS|SHB|SYS|VB|VBE|VBS|VXD|WSC|WSF|WSH)\.?$/i;

export async function isFileDangerous(fileName: string): Promise<boolean> {
  
  const allowAnyFileType = await ipcRenderer.invoke("settings:get:allowAnyFileType");

  if (allowAnyFileType) return false;

  return DANGEROUS_FILE_TYPES.test(fileName);
}
