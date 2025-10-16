// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { systemPreferences } from 'electron';
import { exec } from 'node:child_process';
import {
  checkAvailability as checkAvailabilityWindowsUcv,
  requestVerification as requestVerificationWindowsUcv,
} from '@signalapp/windows-ucv';

import { createLogger } from '../../logging/log.std.js';
import OS from './osMain.node.js';
import { missingCaseError } from '../missingCaseError.std.js';

const log = createLogger('promptOSAuthMain');

export type PromptOSAuthReasonType = 'enable-backups' | 'view-aep';

export type PromptOSAuthResultType =
  | 'error'
  | 'success'
  | 'unauthorized'
  | 'unauthorized-no-windows-ucv'
  | 'unsupported';

/**
 * Use an OS API to request the user to authenticate themselves as a security check
 * before viewing sensitive account credentials.
 * Return values: 'success' indicates successful authentication.
 * 'unauthorized' indicates authentication is possible, but failed or was canceled.
 * 'unauthorized-no-windows-ucv' indicates the Windows API was not available or not setup.
 * Because this is the default case on Windows without Windows Hello enabled,
 * this response should be treated as an auth failure, and not bypassed.
 * 'unsupported' indicates the OS is not supported. Authentication can be skipped
 * or user asked to use a fallback method (e.g. using the primary mobile device).
 */
export async function promptOSAuth({
  reason,
  localeString,
}: {
  reason: PromptOSAuthReasonType;
  localeString: string | undefined;
}): Promise<PromptOSAuthResultType> {
  if (OS.isWindows()) {
    return promptOSAuthWindows(localeString ?? '');
  }

  if (OS.isMacOS()) {
    return promptOSAuthMacOS(localeString ?? '');
  }

  if (OS.isLinux()) {
    return promptOSAuthLinux(reason);
  }

  return 'unsupported';
}

async function promptOSAuthMacOS(
  text: string
): Promise<PromptOSAuthResultType> {
  try {
    await systemPreferences.promptTouchID(text);
    return 'success';
  } catch {
    return 'unauthorized';
  }
}

async function promptOSAuthWindows(
  text: string
): Promise<PromptOSAuthResultType> {
  // For Windows a verification device is required for the UserConsentVerifier API.
  // If unavailable, then the UI must fail and require the user to setup verification.
  const availability = await checkAvailabilityWindowsUcv();
  log.info(`Windows UCV availability=${availability}`);
  if (availability !== 'available') {
    return 'unauthorized-no-windows-ucv';
  }

  const result = await requestVerificationWindowsUcv(text);
  if (result === 'verified') {
    return 'success';
  }

  return 'unauthorized';
}

async function promptOSAuthLinux(
  reason: PromptOSAuthReasonType
): Promise<PromptOSAuthResultType> {
  const isAvailable = await isPromptOSAuthAvailableLinux();
  if (!isAvailable) {
    return 'unsupported';
  }

  // Avoid string interpolation in exec() command
  let command: string;
  if (reason === 'enable-backups') {
    command =
      'pkcheck -u --process $$ --action-id org.signalapp.enable-backups';
  } else if (reason === 'view-aep') {
    command = 'pkcheck -u --process $$ --action-id org.signalapp.view-aep';
  } else {
    throw missingCaseError(reason);
  }

  return new Promise(resolve => {
    exec(command).on('exit', code => {
      if (code === 0) {
        resolve('success');
      } else if (code === 3) {
        resolve('unauthorized');
      } else {
        resolve('error');
      }
    });
  });
}

async function isPromptOSAuthAvailableLinux(): Promise<boolean> {
  return new Promise((resolve, _reject) => {
    exec('command -v pkcheck').on('exit', code => {
      resolve(code === 0);
    });
  });
}
