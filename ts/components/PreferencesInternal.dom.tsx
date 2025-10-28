// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback, useRef } from 'react';
import classNames from 'classnames';
import { v4 as uuid } from 'uuid';

import type { RowType } from '@signalapp/sqlcipher';
import type { LocalizerType } from '../types/I18N.std.js';
import { toLogFormat } from '../types/errors.std.js';
import { formatFileSize } from '../util/formatFileSize.std.js';
import { SECOND } from '../util/durations/index.std.js';
import type { ValidationResultType as BackupValidationResultType } from '../services/backups/index.preload.js';
import { SettingsRow, FlowingSettingsControl } from './PreferencesUtil.dom.js';
import type { MessageCountBySchemaVersionType } from '../sql/Interface.std.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import type { DonationReceipt } from '../types/Donations.std.js';
import { createLogger } from '../logging/log.std.js';
import { isStagingServer } from '../util/isStagingServer.dom.js';
import { getHumanDonationAmount } from '../util/currency.dom.js';
import { AutoSizeTextArea } from './AutoSizeTextArea.dom.js';
import { AxoButton } from '../axo/AxoButton.dom.js';

const log = createLogger('PreferencesInternal');

export function PreferencesInternal({
  i18n,
  exportLocalBackup: doExportLocalBackup,
  validateBackup: doValidateBackup,
  getMessageCountBySchemaVersion,
  getMessageSampleForSchemaVersion,
  donationReceipts,
  internalAddDonationReceipt,
  saveAttachmentToDisk,
  generateDonationReceiptBlob,
  __dangerouslyRunAbitraryReadOnlySqlQuery,
}: {
  i18n: LocalizerType;
  exportLocalBackup: () => Promise<BackupValidationResultType>;
  validateBackup: () => Promise<BackupValidationResultType>;
  getMessageCountBySchemaVersion: () => Promise<MessageCountBySchemaVersionType>;
  getMessageSampleForSchemaVersion: (
    version: number
  ) => Promise<Array<MessageAttributesType>>;
  donationReceipts: ReadonlyArray<DonationReceipt>;
  internalAddDonationReceipt: (receipt: DonationReceipt) => void;
  saveAttachmentToDisk: (options: {
    data: Uint8Array;
    name: string;
    baseDir?: string | undefined;
  }) => Promise<{ fullPath: string; name: string } | null>;
  generateDonationReceiptBlob: (
    receipt: DonationReceipt,
    i18n: LocalizerType
  ) => Promise<Blob>;
  __dangerouslyRunAbitraryReadOnlySqlQuery: (
    readonlySqlQuery: string
  ) => Promise<ReadonlyArray<RowType<object>>>;
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

  const [readOnlySqlInput, setReadOnlySqlInput] = useState('');
  const [readOnlySqlResults, setReadOnlySqlResults] = useState<ReadonlyArray<
    RowType<object>
  > | null>(null);

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

  // Donation receipt states
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  const handleAddTestReceipt = useCallback(async () => {
    const testReceipt: DonationReceipt = {
      id: uuid(),
      currencyType: 'USD',
      paymentAmount: Math.floor(Math.random() * 10000) + 100, // Random amount between $1 and $100 (in cents)
      timestamp: Date.now(),
    };

    try {
      await internalAddDonationReceipt(testReceipt);
    } catch (error) {
      log.error('Error adding test receipt:', toLogFormat(error));
    }
  }, [internalAddDonationReceipt]);

  const handleGenerateReceipt = useCallback(
    async (receipt: DonationReceipt) => {
      setIsGeneratingReceipt(true);
      try {
        const blob = await generateDonationReceiptBlob(receipt, i18n);
        const buffer = await blob.arrayBuffer();

        const result = await saveAttachmentToDisk({
          name: `Signal_Receipt_${new Date(receipt.timestamp).toISOString().split('T')[0]}.png`,
          data: new Uint8Array(buffer),
        });

        if (result) {
          log.info('Receipt saved to:', result.fullPath);
        }
      } catch (error) {
        log.error('Error generating receipt:', toLogFormat(error));
      } finally {
        setIsGeneratingReceipt(false);
      }
    },
    [i18n, saveAttachmentToDisk, generateDonationReceiptBlob]
  );

  const handleReadonlySqlInputChange = useCallback(
    (newReadonlySqlInput: string) => {
      setReadOnlySqlInput(newReadonlySqlInput);
    },
    []
  );

  const prevAbortControlerRef = useRef<AbortController | null>(null);

  const handleReadOnlySqlInputSubmit = useCallback(async () => {
    const controller = new AbortController();
    const { signal } = controller;

    prevAbortControlerRef.current?.abort();
    prevAbortControlerRef.current = controller;

    setReadOnlySqlResults(null);

    const result =
      await __dangerouslyRunAbitraryReadOnlySqlQuery(readOnlySqlInput);

    if (signal.aborted) {
      return;
    }

    setReadOnlySqlResults(result);
  }, [readOnlySqlInput, __dangerouslyRunAbitraryReadOnlySqlQuery]);

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
            <AxoButton.Root
              variant="secondary"
              size="large"
              onClick={validateBackup}
              disabled={isValidationPending}
              experimentalSpinner={
                isValidationPending
                  ? { 'aria-label': i18n('icu:loading') }
                  : null
              }
            >
              {i18n('icu:Preferences__internal__validate-backup')}
            </AxoButton.Root>
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
            <AxoButton.Root
              variant="secondary"
              size="large"
              onClick={exportLocalBackup}
              disabled={isExportPending}
              experimentalSpinner={
                isExportPending ? { 'aria-label': i18n('icu:loading') } : null
              }
            >
              {i18n('icu:Preferences__internal__export-local-backup')}
            </AxoButton.Root>
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
            <AxoButton.Root
              variant="secondary"
              size="large"
              onClick={async () => {
                setMessageCountBySchemaVersion(
                  await getMessageCountBySchemaVersion()
                );
                setMessageSampleForVersions({});
              }}
              disabled={isExportPending}
            >
              Fetch data
            </AxoButton.Root>
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

      {isStagingServer() && (
        <SettingsRow
          className="Preferences--internal--donation-receipts"
          title="Donation Receipts Testing"
        >
          <FlowingSettingsControl>
            <div className="Preferences__two-thirds-flow">
              Test donation receipt generation functionality
            </div>
            <div
              className={classNames(
                'Preferences__flow-button',
                'Preferences__one-third-flow',
                'Preferences__one-third-flow--align-right'
              )}
            >
              <AxoButton.Root
                variant="secondary"
                size="large"
                onClick={handleAddTestReceipt}
              >
                Add Test Receipt
              </AxoButton.Root>
            </div>
          </FlowingSettingsControl>

          {donationReceipts.length > 0 ? (
            <div className="Preferences--internal--result">
              <h4>Receipts ({donationReceipts.length})</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>
                      Amount
                    </th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>
                      Last 4
                    </th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>ID</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {donationReceipts.map(receipt => (
                    <tr
                      key={receipt.id}
                      style={{ borderBottom: '1px solid #eee' }}
                    >
                      <td style={{ padding: '8px' }}>
                        {new Date(receipt.timestamp).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '8px' }}>
                        {getHumanDonationAmount(receipt)} {receipt.currencyType}
                      </td>
                      <td
                        style={{
                          padding: '8px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {receipt.id.substring(0, 8)}...
                      </td>
                      <td style={{ padding: '8px' }}>
                        <AxoButton.Root
                          variant="secondary"
                          size="large"
                          onClick={() => handleGenerateReceipt(receipt)}
                          disabled={isGeneratingReceipt}
                          experimentalSpinner={
                            isGeneratingReceipt
                              ? { 'aria-label': i18n('icu:loading') }
                              : null
                          }
                        >
                          Download
                        </AxoButton.Root>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="Preferences--internal--result">
              <p style={{ color: '#666' }}>
                No receipts found. Add some test receipts above.
              </p>
            </div>
          )}
        </SettingsRow>
      )}

      <SettingsRow title="Readonly SQL Playground">
        <FlowingSettingsControl>
          <AutoSizeTextArea
            i18n={i18n}
            value={readOnlySqlInput}
            onChange={handleReadonlySqlInputChange}
            placeholder="SELECT * FROM items"
            moduleClassName="Preferences__ReadonlySqlPlayground__Textarea"
          />
          <AxoButton.Root
            variant="destructive"
            size="large"
            onClick={handleReadOnlySqlInputSubmit}
          >
            Run Query
          </AxoButton.Root>
          {readOnlySqlResults != null && (
            <AutoSizeTextArea
              i18n={i18n}
              value={JSON.stringify(readOnlySqlResults, null, 2)}
              onChange={() => null}
              readOnly
              placeholder=""
              moduleClassName="Preferences__ReadonlySqlPlayground__Textarea"
            />
          )}
        </FlowingSettingsControl>
      </SettingsRow>
    </div>
  );
}
