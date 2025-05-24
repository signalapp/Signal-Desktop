// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback } from 'react';
import type { LocalizerType } from '../types/I18N';
import { toLogFormat } from '../types/errors';
import { formatFileSize } from '../util/formatFileSize';
import { SECOND } from '../util/durations';
import type { ValidationResultType as BackupValidationResultType } from '../services/backups';
import { SettingsRow, SettingsControl } from './PreferencesUtil';
import { Button, ButtonVariant } from './Button';
import { Spinner } from './Spinner';

export function PreferencesInternal({
  i18n,
  exportLocalBackup: doExportLocalBackup,
  validateBackup: doValidateBackup,
}: {
  i18n: LocalizerType;
  exportLocalBackup: () => Promise<BackupValidationResultType>;
  validateBackup: () => Promise<BackupValidationResultType>;
}): JSX.Element {
  const [isExportPending, setIsExportPending] = useState(false);
  const [exportResult, setExportResult] = useState<
    BackupValidationResultType | undefined
  >();

  const [isValidationPending, setIsValidationPending] = useState(false);
  const [validationResult, setValidationResult] = useState<
    BackupValidationResultType | undefined
  >();

  const validateBackup = useCallback(async () => {
    setIsValidationPending(true);
    setValidationResult(undefined);
    try {
      setValidationResult(await doValidateBackup());
    } catch (error) {
      setValidationResult({ error: toLogFormat(error) });
    } finally {
      setIsValidationPending(false);
    }
  }, [doValidateBackup]);

  const renderValidationResult = useCallback(
    (
      backupResult: BackupValidationResultType | undefined
    ): JSX.Element | undefined => {
      if (backupResult == null) {
        return;
      }

      if ('result' in backupResult) {
        const {
          result: { totalBytes, stats, duration },
        } = backupResult;

        let snapshotDirEl: JSX.Element | undefined;
        if ('snapshotDir' in backupResult.result) {
          snapshotDirEl = (
            <p>
              Backup path:
              <pre>
                <code>{backupResult.result.snapshotDir}</code>
              </pre>
            </p>
          );
        }

        return (
          <div className="Preferences--internal--validate-backup--result">
            {snapshotDirEl}
            <p>Main file size: {formatFileSize(totalBytes)}</p>
            <p>Duration: {Math.round(duration / SECOND)}s</p>
            <pre>
              <code>{JSON.stringify(stats, null, 2)}</code>
            </pre>
          </div>
        );
      }

      const { error } = backupResult;

      return (
        <div className="Preferences--internal--validate-backup--error">
          <pre>
            <code>{error}</code>
          </pre>
        </div>
      );
    },
    []
  );

  const exportLocalBackup = useCallback(async () => {
    setIsExportPending(true);
    setExportResult(undefined);
    try {
      setExportResult(await doExportLocalBackup());
    } catch (error) {
      setExportResult({ error: toLogFormat(error) });
    } finally {
      setIsExportPending(false);
    }
  }, [doExportLocalBackup]);

  return (
    <>
      <SettingsRow
        className="Preferences--internal--backups"
        title={i18n('icu:Preferences__button--backups')}
      >
        <SettingsControl
          left={i18n('icu:Preferences__internal__validate-backup--description')}
          right={
            <Button
              variant={ButtonVariant.Secondary}
              onClick={validateBackup}
              disabled={isValidationPending}
            >
              {isValidationPending ? (
                <Spinner size="22px" svgSize="small" />
              ) : (
                i18n('icu:Preferences__internal__validate-backup')
              )}
            </Button>
          }
        />

        {renderValidationResult(validationResult)}
      </SettingsRow>

      <SettingsRow
        className="Preferences--internal--backups"
        title={i18n('icu:Preferences__internal__local-backups')}
      >
        <SettingsControl
          left={i18n(
            'icu:Preferences__internal__export-local-backup--description'
          )}
          right={
            <Button
              variant={ButtonVariant.Secondary}
              onClick={exportLocalBackup}
              disabled={isExportPending}
            >
              {isExportPending ? (
                <Spinner size="22px" svgSize="small" />
              ) : (
                i18n('icu:Preferences__internal__export-local-backup')
              )}
            </Button>
          }
        />

        {renderValidationResult(exportResult)}
      </SettingsRow>
    </>
  );
}
