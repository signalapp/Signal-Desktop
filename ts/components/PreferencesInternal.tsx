// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback } from 'react';
import type { LocalizerType } from '../types/I18N';
import { toLogFormat } from '../types/errors';
import { formatFileSize } from '../util/formatFileSize';
import type { ValidationResultType as BackupValidationResultType } from '../services/backups';
import { SettingsRow, SettingsControl } from './PreferencesUtil';
import { Button, ButtonVariant } from './Button';
import { Spinner } from './Spinner';

export function PreferencesInternal({
  i18n,
  validateBackup: doValidateBackup,
}: {
  i18n: LocalizerType;
  validateBackup: () => Promise<BackupValidationResultType>;
}): JSX.Element {
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

  let validationElem: JSX.Element | undefined;
  if (validationResult != null) {
    if ('result' in validationResult) {
      const {
        result: { totalBytes, stats },
      } = validationResult;

      validationElem = (
        <div className="Preferences--internal--validate-backup--result">
          <p>File size: {formatFileSize(totalBytes)}</p>
          <pre>
            <code>{JSON.stringify(stats, null, 2)}</code>
          </pre>
        </div>
      );
    } else {
      const { error } = validationResult;

      validationElem = (
        <div className="Preferences--internal--validate-backup--error">
          <pre>
            <code>{error}</code>
          </pre>
        </div>
      );
    }
  }

  return (
    <>
      <div className="Preferences__title Preferences__title--internal">
        <div className="Preferences__title--header">
          {i18n('icu:Preferences__button--internal')}
        </div>
      </div>

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

        {validationElem}
      </SettingsRow>
    </>
  );
}
