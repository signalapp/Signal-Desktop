// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import {
  PlaintextExportErrors,
  PlaintextExportSteps,
} from '../types/Backups.std.js';
import { AxoDialog } from '../axo/AxoDialog.dom.js';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.js';

import type { PlaintextExportWorkflowType } from '../types/Backups.std.js';
import type { LocalizerType } from '../types/I18N.std.js';
import { AxoCheckbox } from '../axo/AxoCheckbox.dom.js';
import { formatFileSize } from '../util/formatFileSize.std.js';
import { ProgressBar } from './ProgressBar.dom.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { tw } from '../axo/tw.dom.js';
import { I18n } from './I18n.dom.js';

export type PropsType = {
  cancelWorkflow: () => unknown;
  clearWorkflow: () => unknown;
  i18n: LocalizerType;
  openFileInFolder: (path: string) => unknown;
  osName: 'linux' | 'macos' | 'windows' | undefined;
  verifyWithOSForExport: (includeMedia: boolean) => unknown;
  workflow: PlaintextExportWorkflowType;
};

function Bold(parts: Array<string | JSX.Element>) {
  return <b>{parts}</b>;
}
function Secondary(parts: Array<string | JSX.Element>) {
  return <span className={tw('text-label-secondary')}>{parts}</span>;
}

export function PlaintextExportWorkflow({
  cancelWorkflow,
  clearWorkflow,
  i18n,
  openFileInFolder,
  osName,
  verifyWithOSForExport,
  workflow,
}: PropsType): JSX.Element {
  const [includeMedia, setIncludeMedia] = React.useState(true);
  const { step } = workflow;

  if (
    step === PlaintextExportSteps.ConfirmingExport ||
    step === PlaintextExportSteps.ConfirmingWithOS ||
    step === PlaintextExportSteps.ChoosingLocation
  ) {
    const shouldShowSpinner = step !== PlaintextExportSteps.ConfirmingExport;

    return (
      <AxoDialog.Root open onOpenChange={clearWorkflow}>
        <AxoDialog.Content size="md" escape="cancel-is-destructive">
          <AxoDialog.Header>
            <AxoDialog.Title>
              <div className={tw('pt-[10px]')}>
                {i18n('icu:PlaintextExport--Confirmation--Header')}
              </div>
            </AxoDialog.Title>
          </AxoDialog.Header>
          <AxoDialog.Body padding="normal">
            <div className={tw('px-[13px]')}>
              <div className={tw('text-label-secondary')}>
                <I18n
                  i18n={i18n}
                  id="icu:PlaintextExport--Confirmation--Description"
                  components={{
                    bold: Bold,
                  }}
                />
              </div>
              <label
                className={tw('mt-2 flex items-center py-[10px] ps-4')}
                htmlFor="includeMediaCheckbox"
              >
                <AxoCheckbox.Root
                  id="includeMediaCheckbox"
                  variant="square"
                  disabled={shouldShowSpinner}
                  checked={includeMedia}
                  onCheckedChange={value => setIncludeMedia(value)}
                />
                <div className={tw('ps-2')}>
                  <I18n
                    i18n={i18n}
                    id="icu:PlaintextExport--Confirmation--IncludeMedia"
                    components={{
                      secondary: Secondary,
                    }}
                  />
                </div>
              </label>
            </div>
          </AxoDialog.Body>
          <AxoDialog.Footer>
            <AxoDialog.Actions>
              <AxoDialog.Action variant="secondary" onClick={clearWorkflow}>
                {i18n('icu:cancel')}
              </AxoDialog.Action>
              <AxoDialog.Action
                variant="primary"
                experimentalSpinner={
                  shouldShowSpinner
                    ? {
                        'aria-label': i18n(
                          'icu:PlaintextExport--Confirmation--WaitingLabel'
                        ),
                      }
                    : null
                }
                onClick={() => verifyWithOSForExport(includeMedia)}
              >
                {i18n('icu:PlaintextExport--Confirmation--ContinueButton')}
              </AxoDialog.Action>
            </AxoDialog.Actions>
          </AxoDialog.Footer>
        </AxoDialog.Content>
      </AxoDialog.Root>
    );
  }
  if (
    step === PlaintextExportSteps.ExportingMessages ||
    step === PlaintextExportSteps.ExportingAttachments
  ) {
    const progress =
      step === PlaintextExportSteps.ExportingAttachments
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
                {i18n('icu:PlaintextExport--ProgressDialog--Header')}
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
                // Unlike AxoDialog.Actions, we want these buttons centered
                'mx-auto',
                // Everything else is copied from AxoDialog.Action
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
  if (step === PlaintextExportSteps.Complete) {
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
            <AxoAlertDialog.Title>
              {i18n('icu:PlaintextExport--CompleteDialog--Header')}
            </AxoAlertDialog.Title>
            <AxoAlertDialog.Description>
              <I18n
                i18n={i18n}
                id="icu:PlaintextExport--CompleteDialog--Description"
                components={{
                  bold: Bold,
                }}
              />
            </AxoAlertDialog.Description>
          </AxoAlertDialog.Body>
          <AxoAlertDialog.Footer>
            <AxoAlertDialog.Action
              variant="secondary"
              onClick={() => {
                openFileInFolder(workflow.exportPath);
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
  if (step === PlaintextExportSteps.Error) {
    const { type } = workflow.errorDetails;
    let title;
    let detail;

    if (type === PlaintextExportErrors.General) {
      title = i18n('icu:PlaintextExport--Error--General--Title');
      detail = i18n('icu:PlaintextExport--Error--General--Description');
    } else if (type === PlaintextExportErrors.NotEnoughStorage) {
      title = i18n('icu:PlaintextExport--Error--NotEnoughStorage--Title');
      detail = i18n('icu:PlaintextExport--Error--NotEnoughStorage--Detail', {
        bytes: formatFileSize(workflow.errorDetails.bytesNeeded),
      });
    } else if (type === PlaintextExportErrors.RanOutOfStorage) {
      title = i18n('icu:PlaintextExport--Error--RanOutOfStorage--Title');
      detail = i18n('icu:PlaintextExport--Error--RanOutOfStorage--Detail', {
        bytes: formatFileSize(workflow.errorDetails.bytesNeeded),
      });
    } else if (type === PlaintextExportErrors.StoragePermissions) {
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
