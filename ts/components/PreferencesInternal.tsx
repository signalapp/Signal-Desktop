// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback } from 'react';
import classNames from 'classnames';

import type { LocalizerType } from '../types/I18N';
import { toLogFormat } from '../types/errors';
import { formatFileSize } from '../util/formatFileSize';
import { SECOND } from '../util/durations';
import type { ValidationResultType as BackupValidationResultType } from '../services/backups';
import { SettingsRow, FlowingSettingsControl } from './PreferencesUtil';
import { Button, ButtonVariant } from './Button';
import { Spinner } from './Spinner';
import type { MessageCountBySchemaVersionType } from '../sql/Interface';
import type { MessageAttributesType } from '../model-types';

export function PreferencesInternal({
  i18n,
  exportLocalBackup: doExportLocalBackup,
  validateBackup: doValidateBackup,
  getMessageCountBySchemaVersion,
  getMessageSampleForSchemaVersion,
}: {
  i18n: LocalizerType;
  exportLocalBackup: () => Promise<BackupValidationResultType>;
  validateBackup: () => Promise<BackupValidationResultType>;
  getMessageCountBySchemaVersion: () => Promise<MessageCountBySchemaVersionType>;
  getMessageSampleForSchemaVersion: (
    version: number
  ) => Promise<Array<MessageAttributesType>>;
}): JSX.Element {
  const [isExportPending, setIsExportPending] = useState(false);
  const [exportResult, setExportResult] = useState<
    BackupValidationResultType | undefined
  >();

  const [messageCountBySchemaVersion, setMessageCountBySchemaVersion] =
    useState<MessageCountBySchemaVersionType>();
  const [messageSampleForVersions, setMessageSampleForVersions] = useState<{
    [schemaVersion: number]: Array<MessageAttributesType>;
  }>();

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
          <div className="Preferences--internal--result">
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
        <div className="Preferences--internal--error">
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
    <div className="Preferences--internal">
      <SettingsRow
        className="Preferences--internal--backups"
        title={i18n('icu:Preferences__button--backups')}
      >
        <FlowingSettingsControl>
          <div className="Preferences__two-thirds-flow">
            {i18n('icu:Preferences__internal__validate-backup--description')}
          </div>
          <div
            className={classNames(
              'Preferences__flow-button',
              'Preferences__one-third-flow',
              'Preferences__one-third-flow--align-right'
            )}
          >
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
          </div>
        </FlowingSettingsControl>

        {renderValidationResult(validationResult)}
      </SettingsRow>

      <SettingsRow
        className="Preferences--internal--backups"
        title={i18n('icu:Preferences__internal__local-backups')}
      >
        <FlowingSettingsControl>
          <div className="Preferences__two-thirds-flow">
            {i18n(
              'icu:Preferences__internal__export-local-backup--description'
            )}
          </div>
          <div
            className={classNames(
              'Preferences__flow-button',
              'Preferences__one-third-flow',
              'Preferences__one-third-flow--align-right'
            )}
          >
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
          </div>
        </FlowingSettingsControl>

        {renderValidationResult(exportResult)}
      </SettingsRow>

      <SettingsRow
        className="Preferences--internal--message-schemas"
        title="Message schema versions"
      >
        <FlowingSettingsControl>
          <div className="Preferences__two-thirds-flow">
            Check message schema versions
          </div>
          <div
            className={classNames(
              'Preferences__flow-button',
              'Preferences__one-third-flow',
              'Preferences__one-third-flow--align-right'
            )}
          >
            <Button
              variant={ButtonVariant.Secondary}
              onClick={async () => {
                setMessageCountBySchemaVersion(
                  await getMessageCountBySchemaVersion()
                );
                setMessageSampleForVersions({});
              }}
              disabled={isExportPending}
            >
              Fetch data
            </Button>
          </div>
        </FlowingSettingsControl>

        {messageCountBySchemaVersion ? (
          <div className="Preferences--internal--result">
            <pre>
              <table>
                <thead>
                  <tr>
                    <th>Schema version</th>
                    <th># Messages</th>
                  </tr>
                </thead>
                <tbody>
                  {messageCountBySchemaVersion.map(
                    ({ schemaVersion, count }) => {
                      return (
                        <React.Fragment key={schemaVersion}>
                          <tr>
                            <td>{schemaVersion}</td>
                            <td>{count}</td>
                            <td>
                              <button
                                type="button"
                                onClick={async () => {
                                  const sampleMessages =
                                    await getMessageSampleForSchemaVersion(
                                      schemaVersion
                                    );
                                  setMessageSampleForVersions({
                                    [schemaVersion]: sampleMessages,
                                  });
                                }}
                                disabled={isExportPending}
                              >
                                Sample
                              </button>
                            </td>
                          </tr>
                          {messageSampleForVersions?.[schemaVersion] ? (
                            <tr
                              key={`${schemaVersion}_samples`}
                              className="Preferences--internal--subresult"
                            >
                              <td colSpan={3}>
                                <code>
                                  {JSON.stringify(
                                    messageSampleForVersions[schemaVersion],
                                    null,
                                    2
                                  )}
                                </code>
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      );
                    }
                  )}
                </tbody>
              </table>
            </pre>
          </div>
        ) : null}
      </SettingsRow>
    </div>
  );
}
