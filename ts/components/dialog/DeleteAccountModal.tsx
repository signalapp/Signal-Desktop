import React, { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { ed25519Str } from '../../session/onions/onionPath';
import { forceNetworkDeletion } from '../../session/apis/snode_api/SNodeAPI';
import { forceSyncConfigurationNowIfNeeded } from '../../session/utils/syncUtils';
import { updateConfirmModal, updateDeleteAccountModal } from '../../state/ducks/modalDialog';
import { SpacerLG } from '../basic/Text';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';
import { SessionHtmlRenderer } from '../basic/SessionHTMLRenderer';
import { SessionSpinner } from '../basic/SessionSpinner';
import { SessionWrapperModal } from '../SessionWrapperModal';

import * as Data from '../../data/data';
import { deleteAllLogs } from '../../node/logs';

const deleteDbLocally = async () => {
  window?.log?.info('last message sent successfully. Deleting everything');
  window.persistStore?.purge();
  await deleteAllLogs();
  await Data.removeAll();
  await Data.close();
  await Data.removeDB();
  await Data.removeOtherData();
  window.localStorage.setItem('restart-reason', 'delete-account');
};

async function sendConfigMessageAndDeleteEverything() {
  try {
    // DELETE LOCAL DATA ONLY, NOTHING ON NETWORK
    window?.log?.info('DeleteAccount => Sending a last SyncConfiguration');

    // be sure to wait for the message being effectively sent. Otherwise we won't be able to encrypt it for our devices !
    await forceSyncConfigurationNowIfNeeded(true);
    window?.log?.info('Last configuration message sent!');
    await deleteDbLocally();
    window.restart();
  } catch (error) {
    // if an error happened, it's not related to the delete everything on network logic as this is handled above.
    // this could be a last sync configuration message not being sent.
    // in all case, we delete everything, and restart
    window?.log?.error(
      'Something went wrong deleting all data:',
      error && error.stack ? error.stack : error
    );
    try {
      await deleteDbLocally();
    } catch (e) {
      window?.log?.error(e);
    } finally {
      window.restart();
    }
  }
}

async function deleteEverythingAndNetworkData() {
  try {
    // DELETE EVERYTHING ON NETWORK, AND THEN STUFF LOCALLY STORED
    // a bit of duplicate code below, but it's easier to follow every case like that (helped with returns)

    // send deletion message to the network
    const potentiallyMaliciousSnodes = await forceNetworkDeletion();
    if (potentiallyMaliciousSnodes === null) {
      window?.log?.warn('DeleteAccount => forceNetworkDeletion failed');

      // close this dialog
      window.inboxStore?.dispatch(updateDeleteAccountModal(null));
      window.inboxStore?.dispatch(
        updateConfirmModal({
          title: window.i18n('dialogClearAllDataDeletionFailedTitle'),
          message: window.i18n('dialogClearAllDataDeletionFailedDesc'),
          okTheme: SessionButtonColor.Danger,
          okText: window.i18n('deviceOnly'),
          onClickOk: async () => {
            await deleteDbLocally();
            window.restart();
          },
        })
      );
      return;
    }

    if (potentiallyMaliciousSnodes.length > 0) {
      const snodeStr = potentiallyMaliciousSnodes.map(ed25519Str);
      window?.log?.warn(
        'DeleteAccount => forceNetworkDeletion Got some potentially malicious snodes',
        snodeStr
      );
      // close this dialog
      window.inboxStore?.dispatch(updateDeleteAccountModal(null));
      // open a new confirm dialog to ask user what to do
      window.inboxStore?.dispatch(
        updateConfirmModal({
          title: window.i18n('dialogClearAllDataDeletionFailedTitle'),
          message: window.i18n('dialogClearAllDataDeletionFailedMultiple', [
            potentiallyMaliciousSnodes.join(', '),
          ]),
          messageSub: window.i18n('dialogClearAllDataDeletionFailedTitleQuestion'),
          okTheme: SessionButtonColor.Danger,
          okText: window.i18n('deviceOnly'),
          onClickOk: async () => {
            await deleteDbLocally();
            window.restart();
          },
        })
      );
      return;
    }

    // We removed everything on the network successfully (no malicious node!). Now delete the stuff we got locally
    // without sending a last configuration message (otherwise this one will still be on the network)
    await deleteDbLocally();
    window.restart();
  } catch (error) {
    // if an error happened, it's not related to the delete everything on network logic as this is handled above.
    // this could be a last sync configuration message not being sent.
    // in all case, we delete everything, and restart
    window?.log?.error(
      'Something went wrong deleting all data:',
      error && error.stack ? error.stack : error
    );
    try {
      await deleteDbLocally();
    } catch (e) {
      window?.log?.error(e);
    }
    window.restart();
  }
}

export const DeleteAccountModal = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDeviceOnly, setDeleteDeviceOnly] = useState(false);
  const [deleteEverythingWithNetwork, setDeleteEverythingWithNetwork] = useState(false);

  const dispatch = useDispatch();

  const onDeleteEverythingLocallyOnly = async () => {
    if (!isLoading) {
      setIsLoading(true);
      try {
        window.log.warn('Deleting everything on device but keeping network data');

        await sendConfigMessageAndDeleteEverything();
      } catch (e) {
        window.log.warn(e);
      } finally {
        setIsLoading(false);
      }
    }
  };
  const onDeleteEverythingAndNetworkData = async () => {
    if (!isLoading) {
      setIsLoading(true);
      try {
        window.log.warn('Deleting everything including network data');
        await deleteEverythingAndNetworkData();
      } catch (e) {
        window.log.warn(e);
      } finally {
        setIsLoading(false);
      }
    }
  };

  /**
   * Performs specified on close action then removes the modal.
   */
  const onClickCancelHandler = useCallback(() => {
    dispatch(updateDeleteAccountModal(null));
  }, []);

  return (
    <SessionWrapperModal
      title={window.i18n('clearAllData')}
      onClose={onClickCancelHandler}
      showExitIcon={true}
    >
      <SpacerLG />

      <div className="session-modal__centered">
        <SessionHtmlRenderer
          tag="span"
          className="session-confirm-main-message"
          html={window.i18n('deleteAccountWarning')}
        />
        <SessionHtmlRenderer
          tag="span"
          className="session-confirm-main-message"
          html={window.i18n('dialogClearAllDataDeletionQuestion')}
        />
        <SpacerLG />
        <div className="session-modal__button-group">
          <SessionButton
            text={window.i18n('entireAccount')}
            buttonColor={SessionButtonColor.Danger}
            onClick={() => {
              setDeleteEverythingWithNetwork(true);
            }}
            disabled={deleteEverythingWithNetwork || deleteDeviceOnly}
          />

          <SessionButton
            text={window.i18n('deviceOnly')}
            buttonColor={SessionButtonColor.Primary}
            onClick={() => {
              setDeleteDeviceOnly(true);
            }}
            disabled={deleteEverythingWithNetwork || deleteDeviceOnly}
          />
        </div>
        <SpacerLG />

        {deleteEverythingWithNetwork && (
          <SessionHtmlRenderer
            tag="span"
            className="session-confirm-main-message"
            html={window.i18n('areYouSureDeleteEntireAccount')}
          />
        )}

        {deleteDeviceOnly && (
          <SessionHtmlRenderer
            tag="span"
            className="session-confirm-main-message"
            html={window.i18n('areYouSureDeleteDeviceOnly')}
          />
        )}
        <SpacerLG />

        {(deleteDeviceOnly || deleteEverythingWithNetwork) && (
          <div className="session-modal__button-group">
            <SessionButton
              text={window.i18n('iAmSure')}
              buttonColor={SessionButtonColor.Danger}
              onClick={() => {
                if (deleteDeviceOnly) {
                  void onDeleteEverythingLocallyOnly();
                } else if (deleteEverythingWithNetwork) {
                  void onDeleteEverythingAndNetworkData();
                }
              }}
              disabled={isLoading}
            />

            <SessionButton
              text={window.i18n('cancel')}
              buttonColor={SessionButtonColor.Primary}
              onClick={() => {
                dispatch(updateDeleteAccountModal(null));
              }}
              disabled={isLoading}
            />
          </div>
        )}

        <SessionSpinner loading={isLoading} />
      </div>
    </SessionWrapperModal>
  );
};
