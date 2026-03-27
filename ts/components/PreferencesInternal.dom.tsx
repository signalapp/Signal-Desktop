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
import type { StorageAccessType } from '../types/StorageKeys.std.js';
import { createLogger } from '../logging/log.std.js';
import { isStagingServer } from '../util/isStagingServer.dom.js';
import { getHumanDonationAmount } from '../util/currency.dom.js';
import { AutoSizeTextArea } from './AutoSizeTextArea.dom.js';
import { AxoButton } from '../axo/AxoButton.dom.js';
import { AxoSwitch } from '../axo/AxoSwitch.dom.js';
import type { VisibleRemoteMegaphoneType } from '../types/Megaphone.std.js';
import { internalGetTestMegaphone } from '../util/getTestMegaphone.std.js';

const log = createLogger('PreferencesInternal');

export function PreferencesInternal({
  i18n,
  validateBackup: doValidateBackup,
  getMessageCountBySchemaVersion,
  getMessageSampleForSchemaVersion,
  donationReceipts,
  internalAddDonationReceipt,
  saveAttachmentToDisk,
  generateDonationReceiptBlob,
  addVisibleMegaphone,
  internalDeleteAllMegaphones,
  __dangerouslyRunAbitraryReadOnlySqlQuery,
  cqsTestMode,
  setCqsTestMode,

  dredDuration,
  setDredDuration,
  isDirectVp9Enabled,
  setIsDirectVp9Enabled,
  directMaxBitrate,
  setDirectMaxBitrate,
  isGroupVp9Enabled,
  setIsGroupVp9Enabled,
  groupMaxBitrate,
  setGroupMaxBitrate,
  sfuUrl,
  setSfuUrl,
  forceKeyTransparencyCheck,
  keyTransparencySelfHealth,
}: {
  i18n: LocalizerType;
  validateBackup: () => Promise<BackupValidationResultType>;
  getMessageCountBySchemaVersion: () => Promise<MessageCountBySchemaVersionType>;
  getMessageSampleForSchemaVersion: (
    version: number
  ) => Promise<Array<MessageAttributesType>>;
  donationReceipts: ReadonlyArray<DonationReceipt>;
  internalAddDonationReceipt: (receipt: DonationReceipt) => void;
  saveAttachmentToDisk: (options: {
    data: Uint8Array<ArrayBuffer>;
    name: string;
    baseDir?: string | undefined;
  }) => Promise<{ fullPath: string; name: string } | null>;
  generateDonationReceiptBlob: (
    receipt: DonationReceipt,
    i18n: LocalizerType
  ) => Promise<Blob>;
  addVisibleMegaphone: (megaphone: VisibleRemoteMegaphoneType) => void;
  internalDeleteAllMegaphones: () => Promise<number>;
  __dangerouslyRunAbitraryReadOnlySqlQuery: (
    readonlySqlQuery: string
  ) => Promise<ReadonlyArray<RowType<object>>>;
  cqsTestMode: boolean;
  setCqsTestMode: (value: boolean) => void;
  dredDuration: number | undefined;
  setDredDuration: (value: number | undefined) => void;
  isDirectVp9Enabled: boolean | undefined;
  setIsDirectVp9Enabled: (value: boolean | undefined) => void;
  directMaxBitrate: number | undefined;
  setDirectMaxBitrate: (value: number | undefined) => void;
  isGroupVp9Enabled: boolean | undefined;
  setIsGroupVp9Enabled: (value: boolean | undefined) => void;
  groupMaxBitrate: number | undefined;
  setGroupMaxBitrate: (value: number | undefined) => void;
  sfuUrl: string | undefined;
  setSfuUrl: (value: string | undefined) => void;
  forceKeyTransparencyCheck: () => Promise<void>;
  keyTransparencySelfHealth: StorageAccessType['keyTransparencySelfHealth'];
}): React.JSX.Element {
  const [messageCountBySchemaVersion, setMessageCountBySchemaVersion] =
    useState<MessageCountBySchemaVersionType>();
  const [messageSampleForVersions, setMessageSampleForVersions] = useState<{
    [schemaVersion: number]: Array<MessageAttributesType>;
  }>();

  const [isValidationPending, setIsValidationPending] = useState(false);
  const [validationResult, setValidationResult] = useState<
    BackupValidationResultType | undefined
  >();

  const [showMegaphoneResult, setShowMegaphoneResult] = useState<
    string | undefined
  >();
  const [deleteAllMegaphonesResult, setDeleteAllMegaphonesResult] = useState<
    number | undefined
  >();

  const [readOnlySqlInput, setReadOnlySqlInput] = useState('');
  const [readOnlySqlResults, setReadOnlySqlResults] = useState<ReadonlyArray<
    RowType<object>
  > | null>(null);

  const stripAndParseString = (input: string): number | undefined => {
    const stripped = input.replace(/\D/g, '');
    return stripped.length !== 0 ? parseInt(stripped, 10) : undefined;
  };

  const handleDredDurationUpdate = useCallback(
    (input: string) => {
      const parsed = stripAndParseString(input);
      if (parsed) {
        setDredDuration(Math.min(100, parsed));
      } else {
        setDredDuration(undefined);
      }
    },
    [setDredDuration]
  );
  const handleDirectMaxBitrateUpdate = useCallback(
    (input: string) => {
      setDirectMaxBitrate(stripAndParseString(input));
    },
    [setDirectMaxBitrate]
  );
  const handleGroupMaxBitrateUpdate = useCallback(
    (input: string) => {
      setGroupMaxBitrate(stripAndParseString(input));
    },
    [setGroupMaxBitrate]
  );
  const handleSfuUrlUpdate = useCallback(
    (input: string) => {
      const url = input.trim();
      setSfuUrl(url.length !== 0 ? url : undefined);
    },
    [setSfuUrl]
  );
  const handleResetCallingOverrides = useCallback(() => {
    setDredDuration(undefined);
    setIsDirectVp9Enabled(undefined);
    setDirectMaxBitrate(undefined);
    setIsGroupVp9Enabled(undefined);
    setGroupMaxBitrate(undefined);
    setSfuUrl(undefined);
  }, [
    setDredDuration,
    setIsDirectVp9Enabled,
    setDirectMaxBitrate,
    setIsGroupVp9Enabled,
    setGroupMaxBitrate,
    setSfuUrl,
  ]);

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
    ): React.JSX.Element | undefined => {
      if (backupResult == null) {
        return;
      }

      if ('result' in backupResult) {
        const {
          result: { totalBytes, stats, duration },
        } = backupResult;

        let snapshotDirEl: React.JSX.Element | undefined;
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

  // Key Transparancy

  const [isKeyTransparencyRunning, setIsKeyTransparencyRunning] =
    useState(false);

  const handleKeyTransparencyCheck = useCallback(async () => {
    setIsKeyTransparencyRunning(true);
    try {
      await forceKeyTransparencyCheck();
    } finally {
      setIsKeyTransparencyRunning(false);
    }
  }, [forceKeyTransparencyCheck]);

  let keyTransparencySymbol: undefined | 'check-circle-fill' | 'error-fill';
  if (keyTransparencySelfHealth == null) {
    keyTransparencySymbol = undefined;
  } else if (keyTransparencySelfHealth === 'ok') {
    keyTransparencySymbol = 'check-circle-fill';
  } else if (keyTransparencySelfHealth === 'fail') {
    keyTransparencySymbol = 'error-fill';
  } else if (keyTransparencySelfHealth === 'intermittent') {
    keyTransparencySymbol = 'error-fill';
  }

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
              size="lg"
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
              size="lg"
              onClick={async () => {
                setMessageCountBySchemaVersion(
                  await getMessageCountBySchemaVersion()
                );
                setMessageSampleForVersions({});
              }}
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
                size="lg"
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
                          size="lg"
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

      <SettingsRow title="Call Quality Survey Testing">
        <FlowingSettingsControl>
          <div className="Preferences__two-thirds-flow">
            CQS testing: disable cooldown and always show for calls under 30s
          </div>
          <div className="Preferences__one-third-flow Preferences__one-third-flow--justify-end">
            <AxoSwitch.Root
              checked={cqsTestMode}
              onCheckedChange={setCqsTestMode}
            />
          </div>
        </FlowingSettingsControl>
      </SettingsRow>

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
            size="lg"
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

      <SettingsRow title="Megaphones">
        <FlowingSettingsControl>
          <div className="Preferences__two-thirds-flow">
            Show a test megaphone in memory. Disappears on restart.
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
              size="lg"
              onClick={async () => {
                const megaphone = internalGetTestMegaphone();
                addVisibleMegaphone(megaphone);
                setShowMegaphoneResult(
                  `Megaphone shown. Go to Chats tab to view.\n${JSON.stringify(megaphone, null, 2)}`
                );
              }}
            >
              Show megaphone
            </AxoButton.Root>
          </div>
          {showMegaphoneResult != null && (
            <AutoSizeTextArea
              i18n={i18n}
              value={showMegaphoneResult}
              onChange={() => null}
              readOnly
              placeholder=""
              moduleClassName="Preferences__ReadonlySqlPlayground__Textarea"
            />
          )}
        </FlowingSettingsControl>
        <FlowingSettingsControl>
          <div className="Preferences__two-thirds-flow">
            Delete local records of remote megaphones
          </div>
          <div
            className={classNames(
              'Preferences__flow-button',
              'Preferences__one-third-flow',
              'Preferences__one-third-flow--align-right'
            )}
          >
            <AxoButton.Root
              variant="destructive"
              size="lg"
              onClick={async () => {
                const result = await internalDeleteAllMegaphones();
                setDeleteAllMegaphonesResult(result);
              }}
            >
              Delete
            </AxoButton.Root>
          </div>
        </FlowingSettingsControl>
        {deleteAllMegaphonesResult != null && (
          <AutoSizeTextArea
            i18n={i18n}
            value={`Deleted: ${deleteAllMegaphonesResult}`}
            onChange={() => null}
            readOnly
            placeholder=""
            moduleClassName="Preferences__ReadonlySqlPlayground__Textarea"
          />
        )}
      </SettingsRow>
      <SettingsRow title="Calling General">
        <FlowingSettingsControl>
          <div className="Preferences__two-thirds-flow">
            Clear custom calling preferences
          </div>
          <div className="Preferences__one-third-flow Preferences__one-third-flow--justify-end">
            <AxoButton.Root
              variant="destructive"
              size="lg"
              onClick={handleResetCallingOverrides}
            >
              Clear
            </AxoButton.Root>
          </div>
        </FlowingSettingsControl>
        <FlowingSettingsControl>
          <div className="Preferences__two-thirds-flow">
            DRED Duration (0 - 100)
          </div>
          <div className="Preferences__one-third-flow Preferences__one-third-flow--justify-end">
            <AutoSizeTextArea
              i18n={i18n}
              value={dredDuration?.toString(10)}
              onChange={handleDredDurationUpdate}
              placeholder="0 - 100"
              moduleClassName="Preferences__ReadonlySqlPlayground__Textarea"
            />
          </div>
        </FlowingSettingsControl>
      </SettingsRow>
      <SettingsRow title="Direct Calls">
        <FlowingSettingsControl>
          <div className="Preferences__two-thirds-flow">Enable VP9</div>
          <div className="Preferences__one-third-flow Preferences__one-third-flow--justify-end">
            <AxoSwitch.Root
              checked={isDirectVp9Enabled ?? true}
              onCheckedChange={setIsDirectVp9Enabled}
            />
          </div>
        </FlowingSettingsControl>
        <FlowingSettingsControl>
          <div className="Preferences__two-thirds-flow">Max bitrate</div>
          <div className="Preferences__one-third-flow Preferences__one-third-flow--justify-end">
            <AutoSizeTextArea
              i18n={i18n}
              value={directMaxBitrate?.toString(10)}
              onChange={handleDirectMaxBitrateUpdate}
              placeholder="Default"
              moduleClassName="Preferences__ReadonlySqlPlayground__Textarea"
            />
          </div>
        </FlowingSettingsControl>
      </SettingsRow>
      <SettingsRow title="Group/Adhoc Calls">
        <FlowingSettingsControl>
          <div className="Preferences__two-thirds-flow">Enable VP9</div>
          <div className="Preferences__one-third-flow Preferences__one-third-flow--justify-end">
            <AxoSwitch.Root
              checked={isGroupVp9Enabled ?? false}
              onCheckedChange={setIsGroupVp9Enabled}
            />
          </div>
        </FlowingSettingsControl>
        <FlowingSettingsControl>
          <div className="Preferences__two-thirds-flow">Max bitrate</div>
          <div className="Preferences__one-third-flow Preferences__one-third-flow--justify-end">
            <AutoSizeTextArea
              i18n={i18n}
              value={groupMaxBitrate?.toString(10)}
              onChange={handleGroupMaxBitrateUpdate}
              placeholder="Default"
              moduleClassName="Preferences__ReadonlySqlPlayground__Textarea"
            />
          </div>
        </FlowingSettingsControl>
        <FlowingSettingsControl>
          <div className="Preferences__one-third-flow">SFU URL</div>
          <div className="Preferences__two-thirds-flow Preferences__two-thirds-flow--justify-end">
            <AutoSizeTextArea
              i18n={i18n}
              value={sfuUrl}
              onChange={handleSfuUrlUpdate}
              placeholder="https://sfu.voip.signal.org"
              moduleClassName="Preferences__ReadonlySqlPlayground__Textarea"
            />
          </div>
        </FlowingSettingsControl>
      </SettingsRow>
      <SettingsRow title="Key Transparency">
        <FlowingSettingsControl>
          <div className="Preferences__two-thirds-flow">Force Self Check</div>
          <div className="Preferences__one-third-flow Preferences__one-third-flow--justify-end">
            <AxoButton.Root
              symbol={keyTransparencySymbol}
              variant="secondary"
              size="lg"
              onClick={handleKeyTransparencyCheck}
              experimentalSpinner={
                isKeyTransparencyRunning
                  ? { 'aria-label': i18n('icu:loading') }
                  : null
              }
            >
              Check
            </AxoButton.Root>
          </div>
        </FlowingSettingsControl>
      </SettingsRow>
    </div>
  );
}
