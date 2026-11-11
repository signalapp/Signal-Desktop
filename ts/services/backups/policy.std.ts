// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { missingCaseError } from '../../util/missingCaseError.std.ts';
import type { BackupExportOptions } from './types.std.ts';

// These types mirror the definitions in `getBackupContentPolicy`, but the redundancy
// provides some additional security against mistakes
type ExpiringMessagePolicy =
  | {
      type: 'remote' | 'local-encrypted';
      expiringMessages: 'exclude-short-lived';
    }
  | {
      type: 'link-and-sync' | 'cross-client-integration-test';
      expiringMessages: 'include-all';
    }
  | {
      type: 'plaintext-export';
      expiringMessages: 'exclude-all';
    };

type ViewOnceMessagePolicy =
  | {
      type: 'remote' | 'local-encrypted' | 'plaintext-export';
      includeViewOnceAttachments: false;
    }
  | {
      type: 'link-and-sync' | 'cross-client-integration-test';
      includeViewOnceAttachments: true;
    };

type AttachmentTargetPolicy =
  | {
      type: 'remote' | 'link-and-sync' | 'cross-client-integration-test';
      attachmentTarget: 'remote';
    }
  | {
      type: 'plaintext-export';
      attachmentTarget: 'local-plaintext';
    }
  | {
      type: 'local-encrypted';
      attachmentTarget: 'local-encrypted';
    };

export type BackupContentPolicy = ExpiringMessagePolicy &
  ViewOnceMessagePolicy &
  AttachmentTargetPolicy;

export function getBackupContentPolicy(
  options: BackupExportOptions
): BackupContentPolicy {
  const { type } = options;
  switch (type) {
    case 'remote':
      return {
        type,
        expiringMessages: 'exclude-short-lived',
        includeViewOnceAttachments: false,
        attachmentTarget: 'remote',
      };
    case 'link-and-sync':
    case 'cross-client-integration-test':
      return {
        type,
        expiringMessages: 'include-all',
        includeViewOnceAttachments: true,
        attachmentTarget: 'remote',
      };
    case 'local-encrypted':
      return {
        type,
        expiringMessages: 'exclude-short-lived',
        includeViewOnceAttachments: false,
        attachmentTarget: 'local-encrypted',
      };
    case 'plaintext-export':
      return {
        type,
        expiringMessages: 'exclude-all',
        includeViewOnceAttachments: false,
        attachmentTarget: 'local-plaintext',
      };

    default:
      throw missingCaseError(type);
  }
}
