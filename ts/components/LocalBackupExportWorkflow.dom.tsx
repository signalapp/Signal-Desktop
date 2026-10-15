// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type ReactNode, type JSX } from 'react';

import {
  LocalExportErrors,
  LocalBackupExportSteps,
} from '../types/LocalExport.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.tsx';

import type { LocalBackupExportWorkflowType } from '../types/LocalExport.std.ts';
import type { LocalizerType } from '../types/I18N.std.ts';
import { formatFileSize } from '../util/formatFileSize.std.ts';
import { ProgressBar } from './ProgressBar.dom.tsx';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import { tw } from '../axo/tw.dom.tsx';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';

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
}: PropsType): JSX.Element {
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
          <div className={tw('mb-4')}>
            <ProgressBar
              fractionComplete={fractionComplete}
              isRTL={i18n.getLocaleDirection() === 'rtl'}
            />
          </div>
          <div
            className={tw('mb-1.5 type-body-small font-semibold text-primary')}
          >
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
        <div className={tw('mb-4')}>
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
          <AxoDialog.Body>
            <AxoDialog.Title>
              {i18n('icu:LocalBackupExport--ProgressDialog--Header')}
            </AxoDialog.Title>

            <div className={tw('my-6')}>
              {progressElements}
              <AxoDialog.Description>
                <p className={tw('type-body-small')}>
                  {i18n('icu:PlaintextExport--ProgressDialog--TimeWarning')}
                </p>
              </AxoDialog.Description>
            </div>
          </AxoDialog.Body>
          <AxoDialog.Footer>
            <AxoDialog.Actions width="fill">
              <AxoDialog.Action
                variant="subtle-secondary"
                onClick={cancelWorkflow}
              >
                {i18n('icu:cancel')}
              </AxoDialog.Action>
            </AxoDialog.Actions>
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
      <AxoDialog.Root open onOpenChange={clearWorkflow}>
        <AxoDialog.Content size="sm" escape="cancel-is-noop">
          <AxoDialog.Body>
            <div className={tw('mb-2.5 flex justify-center')}>
              <img
                src="images/desktop-and-phone.svg"
                height={92}
                width={138}
                alt=""
                className={tw('max-w-22.5')}
              />
            </div>
            <AxoDialog.Title>
              {i18n('icu:LocalBackupExport--CompleteDialog--Header')}
            </AxoDialog.Title>
            <AxoDialog.Description>
              <div className={tw('flex flex-col gap-5 text-primary')}>
                <p>
                  {i18n(
                    'icu:LocalBackupExport--CompleteDialog--RestoreInstructionsHeader'
                  )}
                </p>
                <ol className={tw('flex flex-col gap-5')}>
                  <ListItemWithIcon
                    iconName="arrow-up-down"
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
            </AxoDialog.Description>
          </AxoDialog.Body>
          <AxoDialog.Footer>
            <AxoDialog.Actions width="fill">
              <AxoDialog.Action
                variant="subtle-secondary"
                onClick={() => {
                  openFileInFolder(workflow.localBackupFolder);
                  clearWorkflow();
                }}
              >
                {showInFolderText}
              </AxoDialog.Action>
              <AxoDialog.Action
                variant="strong-primary"
                onClick={clearWorkflow}
              >
                {i18n('icu:ok')}
              </AxoDialog.Action>
            </AxoDialog.Actions>
          </AxoDialog.Footer>
        </AxoDialog.Content>
      </AxoDialog.Root>
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
            <AxoAlertDialog.Ok />
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
  iconName: AxoSymbol.Name;
  content: ReactNode;
}): ReactNode {
  return (
    <li className={tw('flex items-center gap-2')}>
      <div
        className={tw(
          'flex size-8 shrink-0 items-center justify-center rounded-full bg-primary'
        )}
      >
        <AxoSymbol.Icon size={20} symbol={iconName} label={null} />
      </div>
      <div className={tw('text-start')}>{content}</div>
    </li>
  );
}
