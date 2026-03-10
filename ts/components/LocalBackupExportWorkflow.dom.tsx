// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ReactNode } from 'react';

import {
  LocalExportErrors,
  LocalBackupExportSteps,
} from '../types/LocalExport.std.js';
import { AxoDialog } from '../axo/AxoDialog.dom.js';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.js';

import type { LocalBackupExportWorkflowType } from '../types/LocalExport.std.js';
import type { LocalizerType } from '../types/I18N.std.js';
import { formatFileSize } from '../util/formatFileSize.std.js';
import { ProgressBar } from './ProgressBar.dom.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { tw } from '../axo/tw.dom.js';
import { AxoSymbol } from '../axo/AxoSymbol.dom.js';
import type { AxoSymbolIconName } from '../axo/_internal/AxoSymbolDefs.generated.std.js';

export type PropsType = {
  cancelWorkflow: () => void;
  clearWorkflow: () => void;
  i18n: LocalizerType;
  openFileInFolder: (path: string) => void;
  osName: 'linux' | 'macos' | 'windows' | undefined;
  workflow: LocalBackupExportWorkflowType;
};

export function LocalBackupExportWorkflow({
  cancelWorkflow,
  clearWorkflow,
  i18n,
  openFileInFolder,
  osName,
  workflow,
}: PropsType): React.JSX.Element {
  const { step } = workflow;

  if (
    step === LocalBackupExportSteps.ExportingMessages ||
    step === LocalBackupExportSteps.ExportingAttachments
  ) {
    const progress =
      step === LocalBackupExportSteps.ExportingAttachments
        ? workflow.progress
        : undefined;

    let progressElements;
    if (progress) {
      const fractionComplete =
        progress.totalBytes > 0
          ? progress.currentBytes / progress.totalBytes
          : 0;

      progressElements = (
        <>
          <div className={tw('mb-[17px]')}>
            <ProgressBar
              fractionComplete={fractionComplete}
              isRTL={i18n.getLocaleDirection() === 'rtl'}
            />
          </div>
          <div className={tw('mb-1.5 text-center type-body-small font-[600]')}>
            {i18n('icu:PlaintextExport--ProgressDialog--Progress', {
              currentBytes: formatFileSize(progress.currentBytes),
              totalBytes: formatFileSize(progress.totalBytes),
              percentage: fractionComplete,
            })}
          </div>
        </>
      );
    } else {
      progressElements = (
        <div className={tw('mb-[17px]')}>
          <ProgressBar
            fractionComplete={null}
            isRTL={i18n.getLocaleDirection() === 'rtl'}
          />
        </div>
      );
    }

    return (
      <AxoDialog.Root open onOpenChange={cancelWorkflow}>
        <AxoDialog.Content size="md" escape="cancel-is-destructive">
          <AxoDialog.Header>
            <AxoDialog.Title>
              <div className={tw('pt-[10px]')}>
                {i18n('icu:LocalBackupExport--ProgressDialog--Header')}
              </div>
            </AxoDialog.Title>
          </AxoDialog.Header>
          <AxoDialog.Body padding="normal">
            <div className={tw('mx-auto my-[29px] w-[331px]')}>
              {progressElements}
              <div
                className={tw(
                  'text-center type-body-small text-label-secondary'
                )}
              >
                {i18n('icu:PlaintextExport--ProgressDialog--TimeWarning')}
              </div>
            </div>
          </AxoDialog.Body>
          <AxoDialog.Footer>
            <div
              className={tw(
                'mx-auto',
                'flex flex-wrap',
                'max-w-full',
                'items-center gap-x-2 gap-y-3'
              )}
            >
              <AxoDialog.Action variant="secondary" onClick={cancelWorkflow}>
                {i18n('icu:cancel')}
              </AxoDialog.Action>
            </div>
          </AxoDialog.Footer>
        </AxoDialog.Content>
      </AxoDialog.Root>
    );
  }

  if (step === LocalBackupExportSteps.Complete) {
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
      <AxoAlertDialog.Root open onOpenChange={clearWorkflow}>
        <AxoAlertDialog.Content escape="cancel-is-noop">
          <AxoAlertDialog.Body>
            <div className={tw('flex flex-col items-center')}>
              <img
                src="images/desktop-and-phone.svg"
                className={tw('my-4')}
                height="61"
                width="90"
                alt=""
              />
              <AxoAlertDialog.Title>
                <div className={tw('mb-3 type-title-medium')}>
                  {i18n('icu:LocalBackupExport--CompleteDialog--Header')}
                </div>
              </AxoAlertDialog.Title>
            </div>
            <AxoAlertDialog.Description>
              <div className={tw('mb-5 flex flex-col gap-5')}>
                {i18n(
                  'icu:LocalBackupExport--CompleteDialog--RestoreInstructionsHeader'
                )}
                <ol className={tw('flex flex-col gap-5')}>
                  <ListItemWithIcon
                    iconName="sort-vertical"
                    content={i18n(
                      'icu:LocalBackupExport--CompleteDialog--RestoreInstructionsTransfer'
                    )}
                  />
                  <ListItemWithIcon
                    iconName="device-phone"
                    content={i18n(
                      'icu:LocalBackupExport--CompleteDialog--RestoreInstructionsInstall'
                    )}
                  />
                  <ListItemWithIcon
                    iconName="folder"
                    content={i18n(
                      'icu:LocalBackupExport--CompleteDialog--RestoreInstructionsRestore'
                    )}
                  />
                </ol>
              </div>
            </AxoAlertDialog.Description>
          </AxoAlertDialog.Body>
          <AxoAlertDialog.Footer>
            <AxoAlertDialog.Action
              variant="secondary"
              onClick={() => {
                openFileInFolder(workflow.localBackupFolder);
                clearWorkflow();
              }}
            >
              {showInFolderText}
            </AxoAlertDialog.Action>
            <AxoAlertDialog.Action variant="primary" onClick={clearWorkflow}>
              {i18n('icu:ok')}
            </AxoAlertDialog.Action>
          </AxoAlertDialog.Footer>
        </AxoAlertDialog.Content>
      </AxoAlertDialog.Root>
    );
  }

  if (step === LocalBackupExportSteps.Error) {
    const { type } = workflow.errorDetails;
    let title;
    let detail;

    if (type === LocalExportErrors.General) {
      title = i18n('icu:PlaintextExport--Error--General--Title');
      detail = i18n('icu:PlaintextExport--Error--General--Description');
    } else if (type === LocalExportErrors.NotEnoughStorage) {
      title = i18n('icu:PlaintextExport--Error--NotEnoughStorage--Title');
      detail = i18n('icu:PlaintextExport--Error--NotEnoughStorage--Detail', {
        bytes: formatFileSize(workflow.errorDetails.bytesNeeded),
      });
    } else if (type === LocalExportErrors.RanOutOfStorage) {
      title = i18n('icu:PlaintextExport--Error--RanOutOfStorage--Title');
      detail = i18n('icu:PlaintextExport--Error--RanOutOfStorage--Detail', {
        bytes: formatFileSize(workflow.errorDetails.bytesNeeded),
      });
    } else if (type === LocalExportErrors.StoragePermissions) {
      title = i18n('icu:PlaintextExport--Error--DiskPermssions--Title');
      detail = i18n('icu:PlaintextExport--Error--DiskPermssions--Detail');
    } else {
      throw missingCaseError(type);
    }

    return (
      <AxoAlertDialog.Root open onOpenChange={clearWorkflow}>
        <AxoAlertDialog.Content escape="cancel-is-destructive">
          <AxoAlertDialog.Body>
            <AxoAlertDialog.Title>{title}</AxoAlertDialog.Title>
            <AxoAlertDialog.Description>{detail}</AxoAlertDialog.Description>
          </AxoAlertDialog.Body>
          <AxoAlertDialog.Footer>
            <AxoAlertDialog.Action variant="primary" onClick={clearWorkflow}>
              {i18n('icu:ok')}
            </AxoAlertDialog.Action>
          </AxoAlertDialog.Footer>
        </AxoAlertDialog.Content>
      </AxoAlertDialog.Root>
    );
  }

  throw missingCaseError(step);
}

function ListItemWithIcon({
  iconName,
  content,
}: {
  iconName: AxoSymbolIconName;
  content: ReactNode;
}): ReactNode {
  return (
    <li className={tw('flex items-center gap-2')}>
      <div
        className={tw(
          'flex size-8 shrink-0 items-center justify-center rounded-full bg-fill-secondary'
        )}
      >
        <AxoSymbol.Icon size={20} symbol={iconName} label={null} />
      </div>
      <div className={tw('text-start')}>{content}</div>
    </li>
  );
}
