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
import { noop } from 'lodash';
import classNames from 'classnames';

import type { LocalizerType } from '../types/I18N';
import {
  FlowingSettingsControl as FlowingControl,
  SettingsRow,
} from './PreferencesUtil';
import { Button, ButtonSize, ButtonVariant } from './Button';
import {
  getOSAuthErrorString,
  SIGNAL_BACKUPS_LEARN_MORE_URL,
} from './PreferencesBackups';
import { I18n } from './I18n';
import type { PreferencesBackupPage } from '../types/PreferencesBackupPage';
import { Page } from './Preferences';
import { ToastType } from '../types/Toast';
import type { ShowToastAction } from '../state/ducks/toast';
import { Modal } from './Modal';
import { strictAssert } from '../util/assert';
import type {
  PromptOSAuthReasonType,
  PromptOSAuthResultType,
} from '../util/os/promptOSAuthMain';
import { ConfirmationDialog } from './ConfirmationDialog';

export function PreferencesLocalBackups({
  accountEntropyPool,
  backupKeyViewed,
  i18n,
  localBackupFolder,
  onBackupKeyViewedChange,
  page,
  pickLocalBackupFolder,
  promptOSAuth,
  setPage,
  showToast,
}: {
  accountEntropyPool: string | undefined;
  backupKeyViewed: boolean;
  i18n: LocalizerType;
  localBackupFolder: string | undefined;
  onBackupKeyViewedChange: (keyViewed: boolean) => void;
  page: PreferencesBackupPage;
  pickLocalBackupFolder: () => Promise<string | undefined>;
  promptOSAuth: (
    reason: PromptOSAuthReasonType
  ) => Promise<PromptOSAuthResultType>;
  setPage: (page: PreferencesBackupPage) => void;
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

  const isReferencingBackupKey = page === Page.LocalBackupsKeyReference;
  if (!backupKeyViewed || isReferencingBackupKey) {
    strictAssert(accountEntropyPool, 'AEP is required for backup key viewer');

    return (
      <LocalBackupsBackupKeyViewer
        accountEntropyPool={accountEntropyPool}
        i18n={i18n}
        isReferencing={isReferencingBackupKey}
        onBackupKeyViewed={() => {
          if (backupKeyViewed) {
            setPage(Page.LocalBackups);
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
            <Button
              onClick={pickLocalBackupFolder}
              variant={ButtonVariant.Secondary}
            >
              {i18n('icu:Preferences__local-backups-folder__change')}
            </Button>
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
            <Button
              className="Preferences--BackupsAuthButton"
              disabled={isAuthPending}
              onClick={async () => {
                setAuthError(undefined);

                try {
                  setIsAuthPending(true);
                  const result = await promptOSAuth('view-aep');
                  if (result === 'success' || result === 'unsupported') {
                    setPage(Page.LocalBackupsKeyReference);
                  } else {
                    setAuthError(result);
                  }
                } finally {
                  setIsAuthPending(false);
                }
              }}
              variant={ButtonVariant.Secondary}
            >
              {i18n('icu:Preferences__view-key')}
            </Button>
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
        <Button onClick={pickLocalBackupFolder} variant={ButtonVariant.Primary}>
          {i18n('icu:Preferences__button--choose-folder')}
        </Button>
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
        <Button
          className="Preferences--LocalBackupsSetupScreenFooterButton"
          onClick={() => setStep('confirm')}
          variant={ButtonVariant.Primary}
        >
          {i18n('icu:Preferences--local-backups-setup-next')}
        </Button>
      );
    } else {
      footerRight = (
        <Button
          className="Preferences--LocalBackupsSetupScreenFooterButton"
          onClick={onBackupKeyViewed}
          variant={ButtonVariant.Primary}
        >
          {i18n('icu:Preferences--local-backups-view-backup-key-done')}
        </Button>
      );
    }
  } else {
    title = i18n('icu:Preferences--local-backups-confirm-backup-key');
    description = i18n(
      'icu:Preferences--local-backups-confirm-backup-key-description'
    );
    footerLeft = (
      <button
        className="Preferences--LocalBackupsSetupScreenFooterSeeKeyButton"
        onClick={() => setStep('view')}
        type="button"
      >
        {i18n('icu:Preferences--local-backups-see-backup-key-again')}
      </button>
    );
    footerRight = (
      <Button
        className="Preferences--LocalBackupsSetupScreenFooterButton"
        disabled={!isBackupKeyConfirmed}
        onClick={() => setStep('caution')}
        variant={ButtonVariant.Primary}
      >
        {i18n('icu:Preferences--local-backups-setup-next')}
      </Button>
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
            <Button
              className="Preferences--LocalBackupsConfirmKeyModalButton"
              onClick={onBackupKeyViewed}
            >
              {i18n(
                'icu:Preferences__local-backups-confirm-key-modal-continue'
              )}
            </Button>
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
            <Button
              className="Preferences--LocalBackupsSetupScreenCopyButton"
              onClick={onCopyBackupKey}
              size={ButtonSize.Small}
              variant={ButtonVariant.Secondary}
            >
              {i18n('icu:Preferences__local-backups-copy-key')}
            </Button>
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
