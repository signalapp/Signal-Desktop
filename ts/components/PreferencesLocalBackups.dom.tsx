// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ChangeEvent, JSX } from 'react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import lodash from 'lodash';
import classNames from 'classnames';

import type { LocalizerType } from '../types/I18N.std.ts';
import {
  FlowingSettingsControl as FlowingControl,
  SettingsRow,
} from './PreferencesUtil.dom.tsx';
import { SIGNAL_BACKUPS_LEARN_MORE_URL } from './PreferencesBackups.dom.tsx';
import { I18n } from './I18n.dom.tsx';
import type { SettingsLocation } from '../types/Nav.std.ts';
import { SettingsPage } from '../types/Nav.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import type { ShowToastAction } from '../state/ducks/toast.preload.ts';
import { Modal } from './Modal.dom.tsx';
import type {
  PromptOSAuthReasonType,
  PromptOSAuthResultType,
} from '../util/os/promptOSAuthMain.main.ts';
import { AxoButton } from '../axo/AxoButton.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { AxoCheckbox } from '../axo/AxoCheckbox.dom.tsx';
import { SECOND } from '../util/durations/constants.std.ts';
import { formatTimestamp } from '../util/formatTimestamp.dom.ts';
import type { LocalBackupExportMetadata } from '../types/LocalExport.std.ts';
import { tw } from '../axo/tw.dom.tsx';
import { createLogger } from '../logging/log.std.ts';
import { toLogFormat } from '../types/errors.std.ts';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.tsx';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';

const { noop } = lodash;
const log = createLogger('PreferencesLocalBackups');

export function PreferencesLocalBackups({
  backupKey,
  backupKeyHash,
  disableLocalBackups,
  i18n,
  lastLocalBackup,
  localBackupFolder,
  openFileInFolder,
  osName,
  onBackupKeyViewed,
  settingsLocation,
  pickLocalBackupFolder,
  previouslyViewedBackupKeyHash,
  promptOSAuth,
  setSettingsLocation,
  showToast,
  startLocalBackupExport,
}: {
  backupKey: string;
  backupKeyHash: string;
  disableLocalBackups: ({
    deleteExistingBackups,
  }: {
    deleteExistingBackups: boolean;
  }) => Promise<void>;
  i18n: LocalizerType;
  lastLocalBackup: LocalBackupExportMetadata | undefined;
  localBackupFolder: string | undefined;
  onBackupKeyViewed: ({ backupKeyHash }: { backupKeyHash: string }) => void;
  openFileInFolder: (path: string) => void;
  osName: 'linux' | 'macos' | 'windows' | undefined;
  settingsLocation: SettingsLocation;
  pickLocalBackupFolder: () => Promise<string | undefined>;
  previouslyViewedBackupKeyHash: string | undefined;
  promptOSAuth: (
    reason: PromptOSAuthReasonType
  ) => Promise<PromptOSAuthResultType>;
  setSettingsLocation: (settingsLocation: SettingsLocation) => void;
  showToast: ShowToastAction;
  startLocalBackupExport: () => void;
}): React.JSX.Element | null {
  const [authError, setAuthError] =
    React.useState<Omit<PromptOSAuthResultType, 'success'>>();
  const [isAuthPending, setIsAuthPending] = useState<boolean>(false);
  const [isDisablePending, setIsDisablePending] = useState<boolean>(false);
  const [isShowingBackupKeyChangedModal, setIsShowingBackupKeyChangedModal] =
    useState<boolean>(false);

  if (!localBackupFolder) {
    return (
      <LocalBackupsSetupFolderPicker
        i18n={i18n}
        pickLocalBackupFolder={pickLocalBackupFolder}
      />
    );
  }

  const isReferencingBackupKey =
    settingsLocation.page === SettingsPage.LocalBackupsKeyReference;
  if (!previouslyViewedBackupKeyHash || isReferencingBackupKey) {
    return (
      <LocalBackupsBackupKeyViewer
        backupKey={backupKey}
        i18n={i18n}
        isReferencing={
          isReferencingBackupKey &&
          previouslyViewedBackupKeyHash === backupKeyHash
        }
        onBackupKeyViewed={() => {
          onBackupKeyViewed({ backupKeyHash });
          setSettingsLocation({
            page: SettingsPage.LocalBackups,
          });
        }}
        showToast={showToast}
      />
    );
  }

  async function showKeyReferenceWithAuth() {
    setAuthError(undefined);

    try {
      setIsAuthPending(true);
      const result = await promptOSAuth('view-aep');
      if (result === 'success' || result === 'unsupported') {
        setSettingsLocation({
          page: SettingsPage.LocalBackupsKeyReference,
        });
      } else {
        setAuthError(result);
      }
    } finally {
      setIsAuthPending(false);
    }
  }

  const learnMoreLink = (parts: Array<string | React.JSX.Element>) => (
    <a href={SIGNAL_BACKUPS_LEARN_MORE_URL} rel="noreferrer" target="_blank">
      {parts}
    </a>
  );

  const lastBackupText = lastLocalBackup
    ? formatTimestamp(lastLocalBackup.timestamp, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : i18n('icu:Preferences__local-backups-last-backup-never');

  let showInFolderText = i18n(
    'icu:PlaintextExport--CompleteDialog--ShowFiles--Windows'
  );
  if (osName === 'macos') {
    showInFolderText = i18n(
      'icu:PlaintextExport--CompleteDialog--ShowFiles--Mac'
    );
  } else if (osName === 'linux') {
    showInFolderText = i18n(
      'icu:PlaintextExport--CompleteDialog--ShowFiles--Linux'
    );
  }
  return (
    <>
      <div className="Preferences__padding">
        <div className="Preferences__description Preferences__description--medium">
          {i18n('icu:Preferences__local-backups-section__description')}
        </div>
      </div>
      <SettingsRow className="Preferences--BackupsRow">
        <FlowingControl>
          <div className="Preferences__two-thirds-flow">
            <label>
              {i18n('icu:Preferences__local-backups-last-backup')}
              <div className="Preferences__description">{lastBackupText}</div>
            </label>
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
                if (
                  !previouslyViewedBackupKeyHash ||
                  previouslyViewedBackupKeyHash !== backupKeyHash
                ) {
                  setIsShowingBackupKeyChangedModal(true);
                } else {
                  startLocalBackupExport();
                }
              }}
            >
              {i18n('icu:Preferences__local-backups-backup-now')}
            </AxoButton.Root>
          </div>
        </FlowingControl>
        <FlowingControl>
          <div className="Preferences__two-thirds-flow">
            <label>
              {i18n('icu:Preferences__local-backups-folder')}
              <div className="Preferences__description">
                {localBackupFolder}
              </div>
            </label>
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
              onClick={() => openFileInFolder(localBackupFolder)}
            >
              {showInFolderText}
            </AxoButton.Root>
          </div>
        </FlowingControl>
        <FlowingControl>
          <div className="Preferences__two-thirds-flow">
            <label>
              {i18n('icu:Preferences__recovery-key')}
              <div className="Preferences__description">
                {i18n('icu:Preferences__recovery-key-description')}
              </div>
            </label>
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
              disabled={isAuthPending}
              experimentalSpinner={
                isAuthPending ? { 'aria-label': i18n('icu:loading') } : null
              }
              onClick={async () => {
                if (
                  !previouslyViewedBackupKeyHash ||
                  previouslyViewedBackupKeyHash !== backupKeyHash
                ) {
                  setIsShowingBackupKeyChangedModal(true);
                } else {
                  await showKeyReferenceWithAuth();
                }
              }}
            >
              {i18n('icu:Preferences__view-key')}
            </AxoButton.Root>
          </div>
        </FlowingControl>
        <FlowingControl>
          <div className="Preferences__two-thirds-flow">
            <label>{i18n('icu:Preferences__local-backups-turn-off')}</label>
          </div>
          <div
            className={classNames(
              'Preferences__flow-button',
              'Preferences__one-third-flow',
              'Preferences__one-third-flow--align-right'
            )}
          >
            <AxoButton.Root
              variant="subtle-destructive"
              size="lg"
              onClick={() => {
                setIsDisablePending(true);
              }}
            >
              {i18n('icu:Preferences__local-backups-turn-off-action')}
            </AxoButton.Root>
          </div>
        </FlowingControl>
      </SettingsRow>
      <SettingsRow className="Preferences--BackupsRow">
        <div className="Preferences__padding">
          <div className="Preferences__description Preferences__description--medium">
            <I18n
              id="icu:Preferences--local-backups-restore-info"
              i18n={i18n}
              components={{
                learnMoreLink,
              }}
            />
          </div>
        </div>
      </SettingsRow>

      {isDisablePending ? (
        <DisableLocalBackupsDialog
          i18n={i18n}
          disableLocalBackups={disableLocalBackups}
          onCancel={() => setIsDisablePending(false)}
          onComplete={() => {
            setIsDisablePending(false);
            setSettingsLocation({ page: SettingsPage.Backups });
          }}
          onError={() => {
            showToast({
              toastType: ToastType.Error,
            });
            setIsDisablePending(false);
            setSettingsLocation({ page: SettingsPage.Backups });
          }}
        />
      ) : null}

      {authError ? (
        <AxoAlertDialog.Root
          open
          onOpenChange={open => {
            if (!open) {
              setAuthError(undefined);
            }
          }}
        >
          <AxoAlertDialog.Content escape="cancel-is-noop">
            <AxoAlertDialog.Body>
              <AxoAlertDialog.Description>
                {getOSAuthErrorString(i18n, authError) ?? i18n('icu:error')}
              </AxoAlertDialog.Description>
            </AxoAlertDialog.Body>
            <AxoAlertDialog.Footer>
              <AxoAlertDialog.Cancel>{i18n('icu:ok')}</AxoAlertDialog.Cancel>
            </AxoAlertDialog.Footer>
          </AxoAlertDialog.Content>
        </AxoAlertDialog.Root>
      ) : null}

      {isShowingBackupKeyChangedModal ? (
        <AxoAlertDialog.Root
          open
          onOpenChange={open => {
            if (!open) {
              setIsShowingBackupKeyChangedModal(false);
            }
          }}
        >
          <div className={tw('p-4')}>
            <AxoAlertDialog.Content escape="cancel-is-noop">
              <AxoAlertDialog.Body>
                <div className={tw('my-3 flex flex-col items-center')}>
                  <LocalBackupSetupIcon symbol="key" />
                  <AxoAlertDialog.Title>
                    <div className={tw('mt-3 type-title-medium')}>
                      {i18n('icu:Preferences__recovery-key-updated__title')}
                    </div>
                  </AxoAlertDialog.Title>
                </div>
                <AxoAlertDialog.Description>
                  <div className={tw('mb-3')}>
                    {i18n('icu:Preferences__recovery-key-updated__description')}
                  </div>
                </AxoAlertDialog.Description>
              </AxoAlertDialog.Body>
              <AxoAlertDialog.Footer>
                <AxoAlertDialog.Cancel>
                  {i18n('icu:cancel')}
                </AxoAlertDialog.Cancel>
                <AxoAlertDialog.Action
                  variant="primary"
                  onClick={showKeyReferenceWithAuth}
                >
                  {i18n('icu:Preferences__recovery-key-updated__view-key')}
                </AxoAlertDialog.Action>
              </AxoAlertDialog.Footer>
            </AxoAlertDialog.Content>
          </div>
        </AxoAlertDialog.Root>
      ) : null}
    </>
  );
}

function DisableLocalBackupsDialog({
  i18n,
  disableLocalBackups,
  onComplete,
  onCancel,
  onError,
}: {
  i18n: LocalizerType;
  disableLocalBackups: ({
    deleteExistingBackups,
  }: {
    deleteExistingBackups: boolean;
  }) => Promise<void>;
  onComplete: () => void;
  onCancel: () => void;
  onError: (e: unknown) => void;
}) {
  const [isPending, setIsPending] = useState<boolean>(false);

  const [deleteExistingBackups, setDeleteExistingBackups] =
    useState<boolean>(true);

  const handleDisableLocalBackups = useCallback(async () => {
    if (isPending) {
      return;
    }

    try {
      setIsPending(true);
      await disableLocalBackups({ deleteExistingBackups });
      onComplete();
    } catch (e) {
      log.error(
        'Error when disabling local backups',
        { deleteExistingBackups },
        toLogFormat(e)
      );
      onError(e);
    } finally {
      setIsPending(false);
    }
  }, [
    isPending,
    deleteExistingBackups,
    onComplete,
    onError,
    disableLocalBackups,
  ]);

  return (
    <AxoDialog.Root
      open
      onOpenChange={(open: boolean) => {
        if (isPending) {
          return;
        }

        if (!open) {
          onCancel();
        }
      }}
    >
      <AxoDialog.Content
        size="md"
        escape={isPending ? 'cancel-is-destructive' : 'cancel-is-noop'}
      >
        <div className={tw('p-2')}>
          <AxoDialog.Header>
            <AxoDialog.Title>
              {i18n('icu:Preferences__local-backups-turn-off')}
            </AxoDialog.Title>
          </AxoDialog.Header>
          <AxoDialog.Body padding="normal">
            <AxoDialog.Description>
              <div className={tw('mb-2 text-label-secondary')}>
                {i18n('icu:Preferences__local-backups-turn-off-confirmation')}
              </div>
            </AxoDialog.Description>

            <label
              className={tw('flex items-center gap-3 px-4 py-2.5')}
              htmlFor="deleteLocalBackupsCheckbox"
            >
              <AxoCheckbox.Root
                id="deleteLocalBackupsCheckbox"
                variant="square"
                checked={deleteExistingBackups}
                disabled={isPending}
                onCheckedChange={setDeleteExistingBackups}
              />
              {i18n('icu:Preferences__local-backups-turn-off-delete')}
            </label>
          </AxoDialog.Body>
          <AxoDialog.Footer>
            <AxoDialog.Actions>
              <AxoDialog.Action
                variant="secondary"
                onClick={onCancel}
                disabled={isPending}
              >
                {i18n('icu:cancel')}
              </AxoDialog.Action>
              <AxoDialog.Action
                variant="destructive"
                experimentalSpinner={
                  isPending ? { 'aria-label': i18n('icu:loading') } : null
                }
                onClick={handleDisableLocalBackups}
              >
                {i18n('icu:Preferences__local-backups-turn-off-action')}
              </AxoDialog.Action>
            </AxoDialog.Actions>
          </AxoDialog.Footer>
        </div>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function LocalBackupsSetupFolderPicker({
  i18n,
  pickLocalBackupFolder,
}: {
  i18n: LocalizerType;
  pickLocalBackupFolder: () => Promise<string | undefined>;
}): React.JSX.Element {
  return (
    <div className="Preferences--LocalBackupsSetupScreen Preferences__padding">
      <div className="Preferences--LocalBackupsSetupScreenPaneContent">
        <div className="Preferences--LocalBackupsSetupIcon Preferences--LocalBackupsSetupIcon-folder" />
        <legend className="Preferences--LocalBackupsSetupScreenHeader">
          {i18n('icu:Preferences--local-backups-setup-folder')}
        </legend>
        <div className="Preferences--LocalBackupsSetupScreenBody Preferences--LocalBackupsSetupScreenBody--folder">
          {i18n('icu:Preferences--local-backups-setup-folder-description')}
        </div>
        <AxoButton.Root
          variant="primary"
          size="lg"
          onClick={pickLocalBackupFolder}
        >
          {i18n('icu:Preferences__button--choose-folder')}
        </AxoButton.Root>
      </div>
    </div>
  );
}

type BackupKeyStep = 'view' | 'confirm' | 'caution' | 'reference';

function LocalBackupsBackupKeyViewer({
  backupKey,
  i18n,
  isReferencing,
  onBackupKeyViewed,
  showToast,
}: {
  backupKey: string;
  i18n: LocalizerType;
  isReferencing: boolean;
  onBackupKeyViewed: () => void;
  showToast: ShowToastAction;
}): React.JSX.Element {
  const [isBackupKeyConfirmed, setIsBackupKeyConfirmed] =
    useState<boolean>(false);
  const [step, setStep] = useState<BackupKeyStep>(
    isReferencing ? 'reference' : 'view'
  );
  const isStepViewOrReference = step === 'view' || step === 'reference';

  const backupKeyForDisplay = useMemo(() => {
    return backupKey
      .replace(/\s/g, '')
      .replace(/.{4}(?=.)/g, '$& ')
      .toUpperCase();
  }, [backupKey]);

  const onCopyBackupKey = useCallback(
    async function handleCopyBackupKey(e: React.MouseEvent) {
      e.preventDefault();
      window.SignalClipboard.copyTextTemporarily(
        backupKeyForDisplay,
        45 * SECOND
      );
      showToast({ toastType: ToastType.CopiedBackupKey });
    },
    [backupKeyForDisplay, showToast]
  );

  const learnMoreLink = (parts: Array<string | React.JSX.Element>) => (
    <a href={SIGNAL_BACKUPS_LEARN_MORE_URL} rel="noreferrer" target="_blank">
      {parts}
    </a>
  );

  let title: string;
  let description: React.JSX.Element | string;
  let footerLeft: React.JSX.Element | undefined;
  let footerRight: React.JSX.Element;
  if (isStepViewOrReference) {
    title = i18n('icu:Preferences--local-backups-record-recovery-key');
    description = (
      <I18n
        id="icu:Preferences--local-backups-record-backup-key-description"
        i18n={i18n}
        components={{
          learnMoreLink,
        }}
      />
    );
    if (step === 'view') {
      footerRight = (
        <AxoButton.Root
          variant="primary"
          size="lg"
          onClick={() => setStep('confirm')}
        >
          {i18n('icu:Preferences--local-backups-setup-next')}
        </AxoButton.Root>
      );
    } else {
      footerRight = (
        <AxoButton.Root variant="primary" size="lg" onClick={onBackupKeyViewed}>
          {i18n('icu:Preferences--local-backups-view-backup-key-done')}
        </AxoButton.Root>
      );
    }
  } else {
    title = i18n('icu:Preferences--local-backups-confirm-recovery-key');
    description = i18n(
      'icu:Preferences--local-backups-confirm-recovery-key-description'
    );
    footerLeft = (
      <AxoButton.Root
        variant="borderless-primary"
        size="lg"
        onClick={() => setStep('view')}
      >
        {i18n('icu:Preferences--local-backups-see-backup-key-again')}
      </AxoButton.Root>
    );
    footerRight = (
      <AxoButton.Root
        variant="primary"
        size="lg"
        disabled={!isBackupKeyConfirmed}
        onClick={() => setStep('caution')}
      >
        {i18n('icu:Preferences--local-backups-setup-next')}
      </AxoButton.Root>
    );
  }

  return (
    <div className="Preferences--LocalBackupsSetupScreen Preferences__settings-pane-content--with-footer Preferences__padding">
      {step === 'caution' && (
        <Modal
          i18n={i18n}
          modalName="CallingAdhocCallInfo.UnknownContactInfo"
          moduleClassName="Preferences--LocalBackupsConfirmKeyModal"
          modalFooter={
            <AxoButton.Root
              variant="primary"
              size="lg"
              onClick={onBackupKeyViewed}
            >
              {i18n(
                'icu:Preferences__local-backups-confirm-key-modal-continue'
              )}
            </AxoButton.Root>
          }
          onClose={() => setStep('confirm')}
          padded={false}
        >
          <div className="Preferences--LocalBackupsSetupIcon Preferences--LocalBackupsSetupIcon-key" />
          <legend className="Preferences--LocalBackupsConfirmKeyModalTitle">
            {i18n('icu:Preferences__local-backups-confirm-key-modal-title')}
          </legend>
          <div className="Preferences--LocalBackupsConfirmKeyModalBody">
            {i18n('icu:Preferences__local-backups-confirm-key-modal-body')}
          </div>
        </Modal>
      )}
      <div className="Preferences--LocalBackupsSetupScreenPane Preferences--LocalBackupsSetupScreenPane-top">
        <div className="Preferences--LocalBackupsSetupScreenPaneContent">
          <div className="Preferences--LocalBackupsSetupIcon Preferences--LocalBackupsSetupIcon-lock" />
          <legend className="Preferences--LocalBackupsSetupScreenHeader">
            {title}
          </legend>
          <div className="Preferences--LocalBackupsSetupScreenBody">
            {description}
          </div>
        </div>
      </div>
      <div className="Preferences--LocalBackupsSetupScreenPane">
        <div className="Preferences--LocalBackupsSetupScreenPaneContent">
          <LocalBackupsBackupKeyTextarea
            backupKey={backupKeyForDisplay}
            i18n={i18n}
            onValidate={(isValid: boolean) => setIsBackupKeyConfirmed(isValid)}
            isStepViewOrReference={isStepViewOrReference}
          />
        </div>
        {isStepViewOrReference && (
          <div className="Preferences--LocalBackupsSetupScreenPaneContent">
            <AxoButton.Root
              variant="secondary"
              size="sm"
              symbol="copy"
              onClick={onCopyBackupKey}
            >
              {i18n('icu:Preferences__local-backups-copy-key')}
            </AxoButton.Root>
          </div>
        )}
      </div>
      <div className="Preferences--LocalBackupsSetupScreenPane Preferences--LocalBackupsSetupScreenPane-footer">
        <div className="Preferences--LocalBackupsSetupScreenFooterSection">
          {footerLeft}
        </div>
        <div className="Preferences--LocalBackupsSetupScreenFooterSection Preferences--LocalBackupsSetupScreenFooterSection-right">
          {footerRight}
        </div>
      </div>
    </div>
  );
}

function LocalBackupsBackupKeyTextarea({
  backupKey,
  i18n,
  onValidate,
  isStepViewOrReference,
}: {
  backupKey: string;
  i18n: LocalizerType;
  onValidate: (isValid: boolean) => void;
  isStepViewOrReference: boolean;
}): React.JSX.Element {
  const backupKeyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [backupKeyInput, setBackupKeyInput] = useState<string>('');

  useEffect(() => {
    if (backupKeyTextareaRef.current) {
      backupKeyTextareaRef.current.focus();
    }
  }, [backupKeyTextareaRef, isStepViewOrReference]);

  const backupKeyNoSpaces = React.useMemo(() => {
    return backupKey.replace(/\s/g, '');
  }, [backupKey]);

  const handleTextareaChange = useCallback(
    (ev: ChangeEvent<HTMLTextAreaElement>) => {
      const { value } = ev.target;
      const valueUppercaseNoSpaces = value.replace(/\s/g, '').toUpperCase();
      const valueForUI = valueUppercaseNoSpaces.replace(/.{4}(?=.)/g, '$& ');
      setBackupKeyInput(valueForUI);
      onValidate(valueUppercaseNoSpaces === backupKeyNoSpaces);
    },
    [backupKeyNoSpaces, onValidate]
  );

  return (
    <textarea
      aria-label={i18n('icu:Preferences--local-backups-recovery-key-text-box')}
      className="Preferences--LocalBackupsBackupKey"
      cols={20}
      dir="ltr"
      rows={4}
      maxLength={79}
      onChange={isStepViewOrReference ? noop : handleTextareaChange}
      placeholder={i18n('icu:Preferences--local-backups-enter-backup-key')}
      readOnly={isStepViewOrReference}
      ref={backupKeyTextareaRef}
      spellCheck="false"
      value={isStepViewOrReference ? backupKey : backupKeyInput}
    />
  );
}

function getOSAuthErrorString(
  i18n: LocalizerType,
  authError: Omit<PromptOSAuthResultType, 'success'> | undefined
): string | undefined {
  if (!authError) {
    return undefined;
  }

  // TODO: DESKTOP-8895
  if (authError === 'unauthorized') {
    return i18n('icu:Preferences__local-backups-auth-error--unauthorized');
  }

  if (authError === 'unauthorized-no-windows-ucv') {
    return i18n(
      'icu:Preferences__local-backups-auth-error--unauthorized-no-windows-ucv'
    );
  }

  return i18n('icu:Preferences__local-backups-auth-error--unavailable');
}

function LocalBackupSetupIcon(props: { symbol: 'key' | 'lock' }): JSX.Element {
  return (
    <div
      className={tw(
        // eslint-disable-next-line better-tailwindcss/no-restricted-classes
        'inline-flex size-16 items-center justify-center rounded-full bg-[#D2DFFB] text-[#3B45FD]'
      )}
    >
      <AxoSymbol.Icon symbol={props.symbol} size={36} label={null} />
    </div>
  );
}
