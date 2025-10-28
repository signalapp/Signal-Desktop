// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ChangeEvent } from 'react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import lodash from 'lodash';
import classNames from 'classnames';

import type { LocalizerType } from '../types/I18N.std.js';
import {
  FlowingSettingsControl as FlowingControl,
  SettingsRow,
} from './PreferencesUtil.dom.js';
import { ButtonVariant } from './Button.dom.js';
import {
  getOSAuthErrorString,
  SIGNAL_BACKUPS_LEARN_MORE_URL,
} from './PreferencesBackups.dom.js';
import { I18n } from './I18n.dom.js';
import type { SettingsLocation } from '../types/Nav.std.js';
import { SettingsPage } from '../types/Nav.std.js';
import { ToastType } from '../types/Toast.dom.js';
import type { ShowToastAction } from '../state/ducks/toast.preload.js';
import { Modal } from './Modal.dom.js';
import { strictAssert } from '../util/assert.std.js';
import type {
  PromptOSAuthReasonType,
  PromptOSAuthResultType,
} from '../util/os/promptOSAuthMain.main.js';
import { ConfirmationDialog } from './ConfirmationDialog.dom.js';
import { AxoButton } from '../axo/AxoButton.dom.js';

const { noop } = lodash;

export function PreferencesLocalBackups({
  accountEntropyPool,
  backupKeyViewed,
  i18n,
  localBackupFolder,
  onBackupKeyViewedChange,
  settingsLocation,
  pickLocalBackupFolder,
  promptOSAuth,
  setSettingsLocation,
  showToast,
}: {
  accountEntropyPool: string | undefined;
  backupKeyViewed: boolean;
  i18n: LocalizerType;
  localBackupFolder: string | undefined;
  onBackupKeyViewedChange: (keyViewed: boolean) => void;
  settingsLocation: SettingsLocation;
  pickLocalBackupFolder: () => Promise<string | undefined>;
  promptOSAuth: (
    reason: PromptOSAuthReasonType
  ) => Promise<PromptOSAuthResultType>;
  setSettingsLocation: (settingsLocation: SettingsLocation) => void;
  showToast: ShowToastAction;
}): JSX.Element {
  const [authError, setAuthError] =
    React.useState<Omit<PromptOSAuthResultType, 'success'>>();
  const [isAuthPending, setIsAuthPending] = useState<boolean>(false);

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
  if (!backupKeyViewed || isReferencingBackupKey) {
    strictAssert(accountEntropyPool, 'AEP is required for backup key viewer');

    return (
      <LocalBackupsBackupKeyViewer
        accountEntropyPool={accountEntropyPool}
        i18n={i18n}
        isReferencing={isReferencingBackupKey}
        onBackupKeyViewed={() => {
          if (backupKeyViewed) {
            setSettingsLocation({
              page: SettingsPage.LocalBackups,
            });
          } else {
            onBackupKeyViewedChange(true);
          }
        }}
        showToast={showToast}
      />
    );
  }

  const learnMoreLink = (parts: Array<string | JSX.Element>) => (
    <a href={SIGNAL_BACKUPS_LEARN_MORE_URL} rel="noreferrer" target="_blank">
      {parts}
    </a>
  );

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
              size="large"
              onClick={pickLocalBackupFolder}
            >
              {i18n('icu:Preferences__local-backups-folder__change')}
            </AxoButton.Root>
          </div>
        </FlowingControl>
        <FlowingControl>
          <div className="Preferences__two-thirds-flow">
            <label>
              {i18n('icu:Preferences__backup-key')}
              <div className="Preferences__description">
                {i18n('icu:Preferences__backup-key-description')}
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
              size="large"
              disabled={isAuthPending}
              experimentalSpinner={
                isAuthPending ? { 'aria-label': i18n('icu:loading') } : null
              }
              onClick={async () => {
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
              }}
            >
              {i18n('icu:Preferences__view-key')}
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

      {authError && (
        <ConfirmationDialog
          i18n={i18n}
          dialogName="PreferencesLocalBackups--ErrorDialog"
          onClose={() => setAuthError(undefined)}
          cancelButtonVariant={ButtonVariant.Secondary}
          cancelText={i18n('icu:ok')}
        >
          {getOSAuthErrorString(authError) ?? i18n('icu:error')}
        </ConfirmationDialog>
      )}
    </>
  );
}

function LocalBackupsSetupFolderPicker({
  i18n,
  pickLocalBackupFolder,
}: {
  i18n: LocalizerType;
  pickLocalBackupFolder: () => Promise<string | undefined>;
}): JSX.Element {
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
          size="large"
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
  accountEntropyPool,
  i18n,
  isReferencing,
  onBackupKeyViewed,
  showToast,
}: {
  accountEntropyPool: string;
  i18n: LocalizerType;
  isReferencing: boolean;
  onBackupKeyViewed: () => void;
  showToast: ShowToastAction;
}): JSX.Element {
  const [isBackupKeyConfirmed, setIsBackupKeyConfirmed] =
    useState<boolean>(false);
  const [step, setStep] = useState<BackupKeyStep>(
    isReferencing ? 'reference' : 'view'
  );
  const isStepViewOrReference = step === 'view' || step === 'reference';

  const backupKey = useMemo(() => {
    return accountEntropyPool
      .replace(/\s/g, '')
      .replace(/.{4}(?=.)/g, '$& ')
      .toUpperCase();
  }, [accountEntropyPool]);

  const onCopyBackupKey = useCallback(
    async function handleCopyBackupKey(e: React.MouseEvent) {
      e.preventDefault();
      await window.navigator.clipboard.writeText(backupKey);
      showToast({ toastType: ToastType.CopiedBackupKey });
    },
    [backupKey, showToast]
  );

  const learnMoreLink = (parts: Array<string | JSX.Element>) => (
    <a href={SIGNAL_BACKUPS_LEARN_MORE_URL} rel="noreferrer" target="_blank">
      {parts}
    </a>
  );

  let title: string;
  let description: JSX.Element | string;
  let footerLeft: JSX.Element | undefined;
  let footerRight: JSX.Element;
  if (isStepViewOrReference) {
    title = i18n('icu:Preferences--local-backups-record-backup-key');
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
          size="large"
          onClick={() => setStep('confirm')}
        >
          {i18n('icu:Preferences--local-backups-setup-next')}
        </AxoButton.Root>
      );
    } else {
      footerRight = (
        <AxoButton.Root
          variant="primary"
          size="large"
          onClick={onBackupKeyViewed}
        >
          {i18n('icu:Preferences--local-backups-view-backup-key-done')}
        </AxoButton.Root>
      );
    }
  } else {
    title = i18n('icu:Preferences--local-backups-confirm-backup-key');
    description = i18n(
      'icu:Preferences--local-backups-confirm-backup-key-description'
    );
    footerLeft = (
      <AxoButton.Root
        variant="borderless-primary"
        size="large"
        onClick={() => setStep('view')}
      >
        {i18n('icu:Preferences--local-backups-see-backup-key-again')}
      </AxoButton.Root>
    );
    footerRight = (
      <AxoButton.Root
        variant="primary"
        size="large"
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
              size="large"
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
            backupKey={backupKey}
            i18n={i18n}
            onValidate={(isValid: boolean) => setIsBackupKeyConfirmed(isValid)}
            isStepViewOrReference={isStepViewOrReference}
          />
        </div>
        {isStepViewOrReference && (
          <div className="Preferences--LocalBackupsSetupScreenPaneContent">
            <AxoButton.Root
              variant="secondary"
              size="small"
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
}): JSX.Element {
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
      aria-label={i18n('icu:Preferences--local-backups-backup-key-text-box')}
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
