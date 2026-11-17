// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState } from 'react';

import type { ReactNode } from 'react';

import { I18n } from '../../I18n.dom.tsx';
import { tw } from '../../../axo/tw.dom.tsx';
import { formatDateLong } from '../../../util/formatTimestamp.dom.ts';
import { isNumber } from 'lodash';
import { AxoBaseItem } from '../../../axo/items/_AxoBaseItem.dom.tsx';
import { AxoButton } from '../../../axo/AxoButton.dom.tsx';
import { AxoContactList } from '../../../axo/items/AxoContactList.dom.tsx';
import { AxoDialog } from '../../../axo/dialogs/AxoDialog.dom.tsx';
import { AxoDropdownMenu } from '../../../axo/menus/AxoDropdownMenu.dom.tsx';
import { AxoList } from '../../../axo/items/AxoList.dom.tsx';
import { AxoPanel } from '../../../axo/AxoPanel.dom.tsx';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.tsx';
import { AxoTextField } from '../../../axo/fields/AxoTextField.dom.tsx';
import {
  LinkDeviceWorkflowStage,
  LinkedDeviceCapabilities,
} from '../../../types/LinkedDevices.std.ts';
import { ProgressBar } from '../../ProgressBar.dom.tsx';
import { missingCaseError } from '../../../util/missingCaseError.std.ts';
import { fromBase64 } from '../../../Bytes.std.ts';
import { AxoAlertDialog } from '../../../axo/dialogs/AxoAlertDialog.dom.tsx';
import { createLogger } from '../../../logging/log.std.ts';

import type { LocalizerType } from '../../../types/I18N.std.ts';
import type { ActionCreator } from '../../../state/types.std.ts';
import type {
  ChoosingTransferMessagesStage,
  LinkDeviceWorkflow,
  ScanningQRCodeStage,
  TransferMessagesLinkingProgress,
} from '../../../types/LinkedDevices.std.ts';
import type { ThemeType } from '../../../types/Util.std.ts';
import type {
  cancelLinking as doCancelLinking,
  moveToChoosingTransferMessages as doMoveToChoosingTransferMessages,
  refreshDevices as doRefreshDevices,
  removeDevice as doRemoveDevice,
  renameDevice as doRenameDevice,
  sendInfoForLink as doSendInfoForLink,
  startLinking as doStartLinking,
} from '../../../state/ducks/linkedDevices.preload.ts';
import type { LinkedDevice } from '../../../sql/Interface.std.ts';
import { AxoCheckbox } from '../../../axo/AxoCheckbox.dom.tsx';

const log = createLogger('PreferencesLinkedDevicesPage');

const DEVICE_NAME_MAX_BYTES = 225;
const DEVICE_NAME_MAX_GRAPHEMES = 50;

export type Props = Readonly<{
  cancelLinking: ActionCreator<typeof doCancelLinking>;
  devices: ReadonlyArray<LinkedDevice> | undefined;
  i18n: LocalizerType;
  moveToChoosingTransferMessages: ActionCreator<
    typeof doMoveToChoosingTransferMessages
  >;
  refreshDevices: ActionCreator<typeof doRefreshDevices>;
  removeDevice: ActionCreator<typeof doRemoveDevice>;
  renameDevice: ActionCreator<typeof doRenameDevice>;
  sendInfoForLink: ActionCreator<typeof doSendInfoForLink>;
  startLinking: ActionCreator<typeof doStartLinking>;
  theme: ThemeType;
  workflow: LinkDeviceWorkflow | undefined;
}>;

type DeviceInfo = { id: number; name: string | null };

export function PreferencesLinkedDevicesPage({
  cancelLinking,
  devices,
  i18n,
  moveToChoosingTransferMessages,
  refreshDevices,
  removeDevice,
  renameDevice,
  sendInfoForLink,
  startLinking,
  theme,
  workflow,
}: Props): ReactNode {
  const [shouldShowLearnMoreDialog, setShouldShowLearnMoreDialog] =
    useState(false);
  const [shouldShowEditDeviceNameDialog, setShouldShowEditDeviceNameDialog] =
    useState<DeviceInfo | undefined>(undefined);
  const [
    shouldShowConfirmingUnlinkDialog,
    setShouldShowConfirmingUnlinkDialog,
  ] = useState<DeviceInfo | undefined>(undefined);

  const disabled = Boolean(workflow);
  let pending = false;

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  let workflowDialog: ReactNode | undefined;
  if (workflow) {
    const { stage } = workflow;

    if (stage === LinkDeviceWorkflowStage.ConfirmingWithOS) {
      // no dialog; OS should be showing it
      pending = true;
    } else if (stage === LinkDeviceWorkflowStage.ScanningQRCode) {
      workflowDialog = (
        <ScanQRCodeDialog
          i18n={i18n}
          cancelLinking={cancelLinking}
          sendInfoForLink={sendInfoForLink}
          moveToChoosingTransferMessages={moveToChoosingTransferMessages}
          workflow={workflow}
        />
      );
    } else if (stage === LinkDeviceWorkflowStage.ChoosingTransferMessages) {
      workflowDialog = (
        <ChooseTransferMessagesDialog
          i18n={i18n}
          workflow={workflow}
          cancelLinking={cancelLinking}
          sendInfoForLink={sendInfoForLink}
        />
      );
    } else if (stage === LinkDeviceWorkflowStage.SendingProvisioningMessage) {
      if (workflow.willTransferMessages) {
        workflowDialog = (
          <TransferringMessagesProgressDialog
            abortController={workflow.abortController}
            cancelLinking={cancelLinking}
            i18n={i18n}
            progress={undefined}
          />
        );
      } else {
        workflowDialog = (
          <LinkingDeviceProgressDialog
            abortController={workflow.abortController}
            cancelLinking={cancelLinking}
            i18n={i18n}
          />
        );
        pending = true;
      }
    } else if (stage === LinkDeviceWorkflowStage.WaitingForLinkComplete) {
      if (workflow.transferMessagesData) {
        workflowDialog = (
          <TransferringMessagesProgressDialog
            abortController={workflow.abortController}
            cancelLinking={cancelLinking}
            i18n={i18n}
            progress={undefined}
          />
        );
      } else {
        workflowDialog = (
          <LinkingDeviceProgressDialog
            abortController={workflow.abortController}
            cancelLinking={cancelLinking}
            i18n={i18n}
          />
        );
        pending = true;
      }
    } else if (stage === LinkDeviceWorkflowStage.TransferringMessages) {
      const { error } = workflow;

      if (error) {
        if (error === 'not-enough-space') {
          workflowDialog = (
            <NotEnoughSpaceErrorDialog
              cancelLinking={cancelLinking}
              i18n={i18n}
            />
          );
        } else if (error === 'failed-to-make-backup') {
          workflowDialog = <FailedToMakeBackupErrorDialog i18n={i18n} />;
        } else if (error === 'failed-to-upload') {
          workflowDialog = <FailedToUploadErrorDialog i18n={i18n} />;
        } else {
          throw missingCaseError(error);
        }
      } else {
        workflowDialog = (
          <TransferringMessagesProgressDialog
            abortController={workflow.abortController}
            cancelLinking={cancelLinking}
            i18n={i18n}
            progress={workflow.progress}
          />
        );
      }
    } else if (stage === LinkDeviceWorkflowStage.Error) {
      workflowDialog = <GenericErrorDialog i18n={i18n} />;
    } else {
      throw missingCaseError(stage);
    }
  }

  const pageContents = (
    <>
      <AxoList.Group>
        <AxoList.Body>
          <div className={tw('flex flex-col items-center p-5')}>
            <img src={`images/linked-devices--${theme}.svg`} alt="" />
            <div className={tw('mt-3 mb-4 max-w-78')}>
              <I18n
                i18n={i18n}
                id="icu:Preferences--LinkedDevices--description"
                components={{
                  learnMore: parts => {
                    return (
                      <button
                        className={tw('text-accent')}
                        type="button"
                        onClick={() => setShouldShowLearnMoreDialog(true)}
                      >
                        {parts}
                      </button>
                    );
                  },
                }}
              />
            </div>
            <AxoButton.Root
              variant="strong-primary"
              width="fit"
              size="lg"
              disabled={disabled}
              pending={pending}
              onClick={() => startLinking()}
            >
              {i18n('icu:Preferences--LinkedDevices--button')}
            </AxoButton.Root>
          </div>
        </AxoList.Body>
      </AxoList.Group>
      {devices && devices.length > 0 ? (
        <>
          <div className={tw('h-4')} />
          <AxoList.Root>
            <AxoList.Header>
              <AxoList.Label>
                {i18n('icu:Preferences--LinkedDevices--DeviceList--title')}
              </AxoList.Label>
            </AxoList.Header>
            <AxoList.Group>
              <AxoList.Root>
                <AxoList.Body>
                  <AxoBaseItem.Group spacing="sm">
                    {devices.map(device => (
                      <AxoContactList.Item
                        key={device.id}
                        avatar={
                          <AxoSymbol.Icon
                            size={18}
                            symbol="device-phone-laptop"
                            label={null}
                          />
                        }
                        title={
                          device.name ||
                          i18n(
                            'icu:Preferences--LinkedDevices--DeviceList--defaultName'
                          )
                        }
                        description={
                          <div>
                            {device.createdAt ? (
                              <div>
                                {i18n(
                                  'icu:Preferences--LinkedDevices--DeviceList--createdAt',
                                  {
                                    date: formatDateLong(device.createdAt),
                                  }
                                )}
                              </div>
                            ) : undefined}
                            <div>
                              {i18n(
                                'icu:Preferences--LinkedDevices--DeviceList--lastSeenAt',
                                {
                                  date: formatDateLong(device.lastSeenAt),
                                }
                              )}
                            </div>
                          </div>
                        }
                        allowDescriptionOverflow
                        accessory={
                          <AxoDropdownMenu.Root>
                            <AxoDropdownMenu.Trigger>
                              <AxoButton.Root
                                variant="implied-secondary"
                                size="md"
                              >
                                <AxoSymbol.Icon
                                  symbol="more"
                                  size={20}
                                  label={i18n(
                                    'icu:Preferences--LinkedDevices--DeviceList--openMenu'
                                  )}
                                />
                              </AxoButton.Root>
                            </AxoDropdownMenu.Trigger>
                            <AxoDropdownMenu.Content>
                              <AxoDropdownMenu.Item
                                symbol="pencil"
                                onSelect={() => {
                                  setShouldShowEditDeviceNameDialog({
                                    id: device.id,
                                    name: device.name,
                                  });
                                }}
                              >
                                {i18n(
                                  'icu:Preferences--LinkedDevices--DeviceList--Menu--rename'
                                )}
                              </AxoDropdownMenu.Item>
                              <AxoDropdownMenu.Item
                                symbol="link-broken"
                                onSelect={() => {
                                  setShouldShowConfirmingUnlinkDialog({
                                    id: device.id,
                                    name: device.name,
                                  });
                                }}
                              >
                                {i18n(
                                  'icu:Preferences--LinkedDevices--DeviceList--Menu--unlink'
                                )}
                              </AxoDropdownMenu.Item>
                            </AxoDropdownMenu.Content>
                          </AxoDropdownMenu.Root>
                        }
                      />
                    ))}
                  </AxoBaseItem.Group>
                </AxoList.Body>
              </AxoList.Root>
            </AxoList.Group>
            <AxoList.Footer>
              <AxoList.FooterDescription>
                <div className={tw('text-center')}>
                  <AxoSymbol.InlineGlyph symbol="lock" label={null} />{' '}
                  {i18n('icu:Preferences--LinkedDevices--DeviceList--footer')}
                </div>
              </AxoList.FooterDescription>
            </AxoList.Footer>
          </AxoList.Root>
        </>
      ) : undefined}
    </>
  );

  return (
    <>
      <AxoPanel.Root>
        <AxoPanel.Header>
          <AxoPanel.Label>
            {i18n('icu:Preferences--LinkedDevices--title')}
          </AxoPanel.Label>
        </AxoPanel.Header>
        <AxoPanel.Content>{pageContents}</AxoPanel.Content>
      </AxoPanel.Root>
      {workflowDialog}
      <LearnMoreDialog
        i18n={i18n}
        isOpen={shouldShowLearnMoreDialog}
        setClosed={() => setShouldShowLearnMoreDialog(false)}
        theme={theme}
      />
      <EditDeviceNameDialog
        deviceId={shouldShowEditDeviceNameDialog?.id}
        deviceName={shouldShowEditDeviceNameDialog?.name ?? null}
        i18n={i18n}
        key={shouldShowEditDeviceNameDialog?.id}
        renameDevice={renameDevice}
        setClosed={() => setShouldShowEditDeviceNameDialog(undefined)}
      />
      <ConfirmUnlinkDialog
        deviceId={shouldShowConfirmingUnlinkDialog?.id}
        deviceName={shouldShowConfirmingUnlinkDialog?.name ?? null}
        i18n={i18n}
        removeDevice={removeDevice}
        setClosed={() => setShouldShowConfirmingUnlinkDialog(undefined)}
      />
    </>
  );
}

function ScanQRCodeDialog({
  i18n,
  cancelLinking,
  moveToChoosingTransferMessages,
  sendInfoForLink,
  workflow,
}: {
  i18n: LocalizerType;
  cancelLinking: ActionCreator<typeof doCancelLinking>;
  moveToChoosingTransferMessages: ActionCreator<
    typeof doMoveToChoosingTransferMessages
  >;
  sendInfoForLink: ActionCreator<typeof doSendInfoForLink>;
  workflow: ScanningQRCodeStage;
}): ReactNode {
  const [url, setURL] = useState('');
  const [shouldShowQRCodeErrorDialog, setShouldShowQRCodeErrorDialog] =
    useState(false);

  const processURL = useCallback(
    (targetURL: string) => {
      const logId = 'ScanQRCodeDialog';
      const data = URL.parse(targetURL);

      if (data?.protocol !== 'sgnl:') {
        log.warn(`${logId}: Expected protocol 'sgnl:', got ${data?.protocol}`);
        setShouldShowQRCodeErrorDialog(true);
        return;
      }
      if (data?.host !== 'linkdevice') {
        log.warn(`${logId}: Expected host 'linkdevice', got ${data?.host}`);
        setShouldShowQRCodeErrorDialog(true);
        return;
      }

      const address = data?.searchParams.get('uuid');
      const publicKeyBase64 = data?.searchParams.get('pub_key');
      const capabilitiesString = data?.searchParams.get('capabilities');

      if (!address) {
        log.warn(`${logId}: uuid field not provided`);
        setShouldShowQRCodeErrorDialog(true);
        return;
      }
      if (!publicKeyBase64) {
        log.warn(`${logId}: pub_key field not provided`);
        setShouldShowQRCodeErrorDialog(true);
        return;
      }
      if (!capabilitiesString) {
        log.warn(`${logId}: capabilities field not provided`);
        setShouldShowQRCodeErrorDialog(true);
        return;
      }

      const capabilities = capabilitiesString.split(',').filter(item => {
        return (
          item === LinkedDeviceCapabilities.backup5 ||
          item === LinkedDeviceCapabilities.nopni ||
          item === LinkedDeviceCapabilities.nopni2
        );
      });
      const candidateDeviceInfo = {
        address,
        publicKey: fromBase64(publicKeyBase64),
        capabilities,
      };

      // If client doesn't support backups, then we don't show choice UI to user
      if (!capabilities.includes(LinkedDeviceCapabilities.backup5)) {
        sendInfoForLink({
          willTransferMessages: false,
          candidateDeviceInfo,
          workflow,
        });

        return;
      }

      moveToChoosingTransferMessages({
        candidateDeviceInfo,
        workflow,
      });
    },
    [
      moveToChoosingTransferMessages,
      sendInfoForLink,
      setShouldShowQRCodeErrorDialog,
      workflow,
    ]
  );

  return (
    <AxoDialog.Root
      open
      onOpenChange={open => {
        if (!open) {
          cancelLinking();
        }
      }}
    >
      <AxoDialog.Content size="lg" escape="cancel-is-destructive">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:Preferences--LinkedDevices--ScanQRCodeDialog--title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div
            className={tw(
              'flex size-full flex-col items-center overflow-hidden'
            )}
          >
            <div className={tw('mt-2 mb-7 text-center type-body-small')}>
              {i18n(
                'icu:Preferences--LinkedDevices--ScanQRCodeDialog--description'
              )}
            </div>
            <div
              className={tw(
                'h-119.5 max-h-full w-131.5 max-w-full shrink grow rounded-3xl bg-surface-primary'
              )}
            >
              <div>TODO: This is where the camera would display.</div>
              <br />
              <div>
                TODO: For now, manually enter the sgnl:// URL, then press Enter.
              </div>
              <br />
              <form
                className={tw('max-w-full')}
                onSubmit={event => {
                  event.preventDefault();
                  processURL(url);
                }}
              >
                <AxoTextField.Root
                  maxBytes={512}
                  maxGraphemes={512}
                  onValueChange={newURL => setURL(newURL)}
                  value={url}
                >
                  <AxoTextField.Input autoFocus placeholder="TODO: Enter URL" />
                </AxoTextField.Root>
              </form>
            </div>
          </div>
          <AxoAlertDialog.Root
            open={shouldShowQRCodeErrorDialog}
            onOpenChange={open => {
              if (!open) {
                setShouldShowQRCodeErrorDialog(false);
              }
            }}
          >
            <AxoAlertDialog.Content escape="cancel-is-noop">
              <AxoAlertDialog.Body>
                <AxoAlertDialog.Title>
                  {i18n(
                    'icu:Preferences--LinkedDevices--ScanQRCodeDialog--ErrorDialog--title'
                  )}
                </AxoAlertDialog.Title>
                <AxoAlertDialog.Description>
                  {i18n(
                    'icu:Preferences--LinkedDevices--ScanQRCodeDialog--ErrorDialog--description'
                  )}
                </AxoAlertDialog.Description>
              </AxoAlertDialog.Body>
              <AxoAlertDialog.Footer>
                <AxoAlertDialog.Action
                  variant="subtle-secondary"
                  onClick={() => cancelLinking()}
                >
                  {i18n('icu:cancel')}
                </AxoAlertDialog.Action>

                <AxoAlertDialog.Action
                  variant="strong-primary"
                  onClick={() => setShouldShowQRCodeErrorDialog(false)}
                >
                  {i18n(
                    'icu:Preferences--LinkedDevices--ScanQRCodeDialog--ErrorDialog--retry-button'
                  )}
                </AxoAlertDialog.Action>
              </AxoAlertDialog.Footer>
            </AxoAlertDialog.Content>
          </AxoAlertDialog.Root>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function GenericErrorDialog({ i18n }: { i18n: LocalizerType }): ReactNode {
  return (
    <AxoDialog.Root open>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:Preferences--LinkedDevices--GenericErrorDialog--title')}
          </AxoDialog.Title>
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            <div className={tw('mb-2')}>
              {i18n(
                'icu:Preferences--LinkedDevices--GenericErrorDialog--description'
              )}
            </div>
          </AxoDialog.Description>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions width="fill" forceAlwaysBreakToSeparateLines>
            <AxoDialog.Action variant="strong-primary" onClick={() => null}>
              {i18n(
                'icu:Preferences--LinkedDevices--GenericErrorDialog--retry'
              )}
            </AxoDialog.Action>
            <AxoDialog.Action variant="subtle-secondary" onClick={() => null}>
              {i18n(
                'icu:Preferences--LinkedDevices--GenericErrorDialog--learn-more'
              )}
            </AxoDialog.Action>
            <AxoDialog.Action variant="subtle-secondary" onClick={() => null}>
              {i18n(
                'icu:Preferences--LinkedDevices--GenericErrorDialog--contact-support'
              )}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
function NotEnoughSpaceErrorDialog({
  cancelLinking,
  i18n,
}: {
  cancelLinking: ActionCreator<typeof doCancelLinking>;
  i18n: LocalizerType;
}): ReactNode {
  return (
    <AxoDialog.Root open>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n(
              'icu:Preferences--LinkedDevices--NotEnoughSpaceDialog--title'
            )}
          </AxoDialog.Title>
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            <div className={tw('mb-2')}>
              {i18n(
                'icu:Preferences--LinkedDevices--NotEnoughSpaceDialog--description'
              )}
            </div>
          </AxoDialog.Description>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions width="fill" forceAlwaysBreakToSeparateLines>
            <AxoDialog.Action variant="strong-primary" onClick={cancelLinking}>
              {i18n('icu:ok')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
function FailedToMakeBackupErrorDialog({
  i18n,
}: {
  i18n: LocalizerType;
}): ReactNode {
  return (
    <AxoDialog.Root open>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n(
              'icu:Preferences--LinkedDevices--FailedToMakeBackupDialog--title'
            )}
          </AxoDialog.Title>
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            <div className={tw('mb-2')}>
              {i18n(
                'icu:Preferences--LinkedDevices--FailedToMakeBackupDialog--description'
              )}
            </div>
          </AxoDialog.Description>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions width="fill" forceAlwaysBreakToSeparateLines>
            <AxoDialog.Action variant="strong-primary" onClick={() => null}>
              {i18n(
                'icu:Preferences--LinkedDevices--FailedToMakeBackupDialog--continue'
              )}
            </AxoDialog.Action>
            <AxoDialog.Action variant="subtle-secondary" onClick={() => null}>
              {i18n(
                'icu:Preferences--LinkedDevices--FailedToMakeBackupDialog--learn-more'
              )}
            </AxoDialog.Action>
            <AxoDialog.Action variant="subtle-secondary" onClick={() => null}>
              {i18n(
                'icu:Preferences--LinkedDevices--FailedToMakeBackupDialog--contact-support'
              )}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
function FailedToUploadErrorDialog({
  i18n,
}: {
  i18n: LocalizerType;
}): ReactNode {
  return (
    <AxoDialog.Root open>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:Preferences--LinkedDevices--FailedToUploadError--title')}
          </AxoDialog.Title>
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            <div className={tw('mb-2')}>
              {i18n(
                'icu:Preferences--LinkedDevices--FailedToUploadError--description'
              )}
            </div>
          </AxoDialog.Description>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions width="fill" forceAlwaysBreakToSeparateLines>
            <AxoDialog.Action variant="strong-primary" onClick={() => null}>
              {i18n(
                'icu:Preferences--LinkedDevices--FailedToUploadError--retry'
              )}
            </AxoDialog.Action>
            <AxoDialog.Action variant="subtle-secondary" onClick={() => null}>
              {i18n(
                'icu:Preferences--LinkedDevices--FailedToUploadError--continue-no-transfer'
              )}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

/** @testexport */
export function ContactSupportDialog({
  i18n,
}: {
  i18n: LocalizerType;
}): ReactNode {
  const [includeDebugLog, setIncludeDebugLog] = useState(true);

  return (
    <AxoDialog.Root open>
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n(
              'icu:Preferences--LinkedDevices--ContactSupportDialog--title'
            )}
          </AxoDialog.Title>
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            {i18n(
              'icu:Preferences--LinkedDevices--ContactSupportDialog--description'
            )}
          </AxoDialog.Description>
          <div className={tw('mt-5 mb-7 flex items-center')}>
            <div className={tw('me-2')}>
              <AxoCheckbox.Root
                checked={includeDebugLog}
                onCheckedChange={checked => setIncludeDebugLog(checked)}
                variant="round"
              />
            </div>
            <div className={tw('grow')}>
              {i18n(
                'icu:Preferences--LinkedDevices--ContactSupportDialog--include-log-checkbox'
              )}
            </div>
            <div>
              <AxoButton.Root
                variant="subtle-secondary"
                size="md"
                onClick={() => null}
              >
                {i18n(
                  'icu:Preferences--LinkedDevices--ContactSupportDialog--view'
                )}
              </AxoButton.Root>
            </div>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="subtle-secondary" onClick={() => null}>
              {i18n(
                'icu:Preferences--LinkedDevices--ContactSupportDialog--no-thanks'
              )}
            </AxoDialog.Action>
            <AxoDialog.Action variant="strong-primary" onClick={() => null}>
              <AxoSymbol.InlineGlyph symbol="open" label={null} />{' '}
              {i18n(
                'icu:Preferences--LinkedDevices--ContactSupportDialog--contact-support'
              )}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function ChooseTransferMessagesDialog({
  cancelLinking,
  i18n,
  sendInfoForLink,
  workflow,
}: {
  cancelLinking: ActionCreator<typeof doCancelLinking>;
  i18n: LocalizerType;
  sendInfoForLink: ActionCreator<typeof doSendInfoForLink>;
  workflow: ChoosingTransferMessagesStage;
}): ReactNode {
  return (
    <AxoDialog.Root
      open
      onOpenChange={open => {
        if (!open) {
          cancelLinking();
        }
      }}
    >
      <AxoDialog.Content size="md" escape="cancel-is-destructive">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n(
              'icu:Preferences--LinkedDevices--ChooseTransferMessageDialog--title'
            )}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('h-4')} />
          <AxoContactList.Root>
            <AxoContactList.Item
              key="transfer-messages"
              avatar={
                <div
                  className={tw(
                    'flex size-9 flex-col items-center justify-center rounded-full',
                    'bg-accent-tint text-(--axo-color-legacy-official-chat-badge-text)'
                  )}
                >
                  <AxoSymbol.Icon
                    size={18}
                    symbol="message-check"
                    label={null}
                  />
                </div>
              }
              title={i18n(
                'icu:Preferences--LinkedDevices--ChooseTransferMessageDialog--linkNSync--title'
              )}
              description={
                <div>
                  {i18n(
                    'icu:Preferences--LinkedDevices--ChooseTransferMessageDialog--linkNSync--description'
                  )}
                </div>
              }
              allowDescriptionOverflow
              onClick={() => {
                sendInfoForLink({
                  willTransferMessages: true,
                  candidateDeviceInfo: workflow.candidateDeviceInfo,
                  workflow,
                });
              }}
            />
          </AxoContactList.Root>
          <div className={tw('h-4')} />
          <AxoContactList.Root>
            <AxoContactList.Item
              key="do-not-transfer"
              avatar={
                <div
                  className={tw(
                    'flex size-9 flex-col items-center justify-center rounded-full',
                    'bg-accent-tint text-(--axo-color-legacy-official-chat-badge-text)'
                  )}
                >
                  <AxoSymbol.Icon
                    size={18}
                    symbol="message-check"
                    label={null}
                  />
                </div>
              }
              title={i18n(
                'icu:Preferences--LinkedDevices--ChooseTransferMessageDialog--doNotTransfer--title'
              )}
              description={
                <div>
                  {i18n(
                    'icu:Preferences--LinkedDevices--ChooseTransferMessageDialog--doNotTransfer--description'
                  )}
                </div>
              }
              allowDescriptionOverflow
              onClick={() => {
                sendInfoForLink({
                  willTransferMessages: false,
                  candidateDeviceInfo: workflow.candidateDeviceInfo,
                  workflow,
                });
              }}
            />
          </AxoContactList.Root>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

// TODO: it might be a good idea to pop a confirmation dialog if the user clicks cancel here
function TransferringMessagesProgressDialog({
  abortController,
  cancelLinking,
  i18n,
  progress,
}: {
  abortController: AbortController;
  cancelLinking: ActionCreator<typeof doCancelLinking>;
  i18n: LocalizerType;
  progress: TransferMessagesLinkingProgress;
}): ReactNode {
  let progressElements;
  if (progress) {
    const fractionComplete =
      progress.totalBytes > 0 ? progress.currentBytes / progress.totalBytes : 0;

    progressElements = (
      <>
        <div className={tw('mx-auto mb-4 w-82.5')}>
          <ProgressBar
            fractionComplete={fractionComplete}
            isRTL={i18n.getLocaleDirection() === 'rtl'}
          />
        </div>
        <div
          className={tw(
            'mb-1.5 text-center type-body-small font-semibold text-primary'
          )}
        >
          {i18n(
            'icu:Preferences--LinkedDevices--TransferringMessagesDialog--progress',
            {
              percentage: fractionComplete,
            }
          )}
        </div>
      </>
    );
  } else {
    progressElements = (
      <div className={tw('mx-auto mb-4 w-82.5')}>
        <ProgressBar
          fractionComplete={null}
          isRTL={i18n.getLocaleDirection() === 'rtl'}
        />
      </div>
    );
  }

  return (
    <AxoDialog.Root open>
      <AxoDialog.Content size="md" escape="cancel-is-destructive">
        <AxoDialog.Body>
          <div className={tw('text-center')}>
            <AxoDialog.Title>
              <div className={tw('mb-9 type-title-small')}>
                {i18n(
                  'icu:Preferences--LinkedDevices--TransferringMessagesDialog--title'
                )}
              </div>
            </AxoDialog.Title>
            <div className={tw('mt-6 mb-8')}>
              {progressElements}
              <AxoDialog.Description>
                <p className={tw('type-body-small text-secondary')}>
                  {i18n(
                    'icu:Preferences--LinkedDevices--TransferringMessagesDialog--do-not-close'
                  )}
                </p>
              </AxoDialog.Description>
            </div>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="subtle-secondary"
              onClick={() => {
                abortController.abort();
                cancelLinking();
              }}
            >
              {i18n('icu:cancel')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function LinkingDeviceProgressDialog({
  abortController,
  cancelLinking,
  i18n,
}: {
  abortController: AbortController;
  cancelLinking: ActionCreator<typeof doCancelLinking>;
  i18n: LocalizerType;
}): ReactNode {
  const [shouldShowProgress, setShouldShowProgress] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setShouldShowProgress(true);
    }, 300);
  }, [setShouldShowProgress]);

  return (
    <AxoDialog.Root open>
      <AxoDialog.Content size="md" escape="cancel-is-destructive">
        <AxoDialog.Body>
          <div className={tw('text-center')}>
            <AxoDialog.Title>
              <div className={tw('mb-9 type-title-small')}>
                {i18n(
                  'icu:Preferences--LinkedDevices--LinkingDeviceDialog--title'
                )}
              </div>
            </AxoDialog.Title>
            <div className={tw('mt-6 mb-8')}>
              {shouldShowProgress && (
                <div className={tw('mx-auto mb-4 w-82.5')}>
                  <ProgressBar
                    fractionComplete={null}
                    isRTL={i18n.getLocaleDirection() === 'rtl'}
                  />
                </div>
              )}
              <AxoDialog.Description>
                <p className={tw('type-body-small text-secondary')}>
                  {i18n(
                    'icu:Preferences--LinkedDevices--LinkingDeviceDialog--progress'
                  )}
                </p>
              </AxoDialog.Description>
            </div>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="subtle-secondary"
              onClick={() => {
                abortController.abort();
                cancelLinking();
              }}
            >
              {i18n('icu:cancel')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function EditDeviceNameDialog({
  i18n,
  deviceId,
  deviceName,
  setClosed,
  renameDevice,
}: {
  i18n: LocalizerType;
  deviceId: number | undefined;
  deviceName: string | null;
  setClosed: () => unknown;
  renameDevice: ActionCreator<typeof doRenameDevice>;
}): ReactNode {
  const [name, setName] = useState(
    deviceName ??
      i18n('icu:Preferences--LinkedDevices--DeviceList--defaultName')
  );
  const disabled = name === deviceName || !name;

  return (
    <AxoDialog.Root
      open={isNumber(deviceId)}
      onOpenChange={newIsOpen => {
        if (!newIsOpen) {
          setClosed();
        }
      }}
    >
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n(
              'icu:Preferences--LinkedDevices--EditDeviceNameDialog--title'
            )}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('mt-3 mb-8')}>
            <AxoTextField.Root
              maxBytes={DEVICE_NAME_MAX_BYTES}
              maxGraphemes={DEVICE_NAME_MAX_GRAPHEMES}
              onValueChange={newName => setName(newName)}
              value={name}
            >
              <AxoTextField.Input
                autoFocus
                autoComplete="new-password"
                placeholder={i18n(
                  'icu:StandaloneRegistration--CreatePIN--confirming--placeholder'
                )}
              />
            </AxoTextField.Root>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="subtle-secondary" onClick={setClosed}>
              {i18n('icu:cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              disabled={disabled}
              variant="strong-primary"
              onClick={() => {
                if (!isNumber(deviceId)) {
                  throw new Error(
                    'EditDeviceNameDialog: deviceId is not a number!'
                  );
                }
                if (name.length === 0) {
                  throw new Error(
                    'EditDeviceNameDialog: name was not provided!'
                  );
                }

                renameDevice(deviceId, name);
                setClosed();
              }}
            >
              {i18n('icu:done')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function ConfirmUnlinkDialog({
  deviceId,
  deviceName,
  i18n,
  removeDevice,
  setClosed,
}: {
  deviceId: number | undefined;
  deviceName: string | null;
  i18n: LocalizerType;
  removeDevice: ActionCreator<typeof doRemoveDevice>;
  setClosed: () => unknown;
}): ReactNode {
  return (
    <AxoDialog.Root
      open={isNumber(deviceId)}
      onOpenChange={newIsOpen => {
        if (!newIsOpen) {
          setClosed();
        }
      }}
    >
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n(
              'icu:Preferences--LinkedDevices--ConfirmUnlinkDialog--title',
              {
                name:
                  deviceName ??
                  i18n(
                    'icu:Preferences--LinkedDevices--DeviceList--defaultName'
                  ),
              }
            )}
          </AxoDialog.Title>
        </AxoDialog.Header>
        <AxoDialog.Body>
          {i18n(
            'icu:Preferences--LinkedDevices--ConfirmUnlinkDialog--description'
          )}
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions width="fill">
            <AxoDialog.Action variant="subtle-secondary" onClick={setClosed}>
              {i18n('icu:cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="subtle-destructive"
              onClick={() => {
                if (!isNumber(deviceId)) {
                  throw new Error(
                    'ConfirmUnlinkDialog: deviceId is not a number!'
                  );
                }

                removeDevice(deviceId, deviceName);
                setClosed();
              }}
            >
              {i18n(
                'icu:Preferences--LinkedDevices--ConfirmUnlinkDialog--unlinkButton'
              )}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function LearnMoreDialog({
  i18n,
  isOpen,
  setClosed,
  theme,
}: {
  i18n: LocalizerType;
  isOpen: boolean;
  setClosed: () => unknown;
  theme: ThemeType;
}): ReactNode {
  return (
    <AxoDialog.Root
      open={isOpen}
      onOpenChange={newIsOpen => {
        if (!newIsOpen) {
          setClosed();
        }
      }}
    >
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header floating>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('flex flex-col items-center')}>
            <img src={`images/linked-devices--about--${theme}.svg`} alt="" />
            <div className={tw('mb-6 type-title-medium text-primary')}>
              {i18n('icu:Preferences--LinkedDevices--LearnMoreDialog--title')}
            </div>
            <div className={tw('text-primary')}>
              <div className={tw('mb-6 flex')}>
                <div>
                  <AxoSymbol.Icon size={20} symbol="lock" label={null} />
                </div>
                <div className={tw('ms-3.5')}>
                  {i18n(
                    'icu:Preferences--LinkedDevices--LearnMoreDialog--bullet1'
                  )}
                </div>
              </div>
              <div className={tw('mb-6 flex')}>
                <div>
                  <AxoSymbol.Icon size={20} symbol="message" label={null} />
                </div>
                <div className={tw('ms-3.5')}>
                  {i18n(
                    'icu:Preferences--LinkedDevices--LearnMoreDialog--bullet2'
                  )}
                </div>
              </div>
              <div className={tw('flex')}>
                <div>
                  <AxoSymbol.Icon size={20} symbol="download" label={null} />
                </div>
                <div className={tw('ms-3.5')}>
                  <I18n
                    i18n={i18n}
                    id="icu:Preferences--LinkedDevices--LearnMoreDialog--bullet3"
                    components={{
                      linkToSignal: parts => {
                        return (
                          <a
                            className={tw('no-underline')}
                            href="https://signal.org/download"
                          >
                            {parts}
                          </a>
                        );
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
