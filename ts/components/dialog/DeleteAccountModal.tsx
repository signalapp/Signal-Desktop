import React, { useCallback, useState } from 'react';
import { ed25519Str } from '../../session/onions/onionPath';
import {
  forceNetworkDeletion,
  forceSyncConfigurationNowIfNeeded,
} from '../../session/utils/syncUtils';
import { updateConfirmModal, updateDeleteAccountModal } from '../../state/ducks/modalDialog';
import { SpacerLG } from '../basic/Text';
import { SessionButton, SessionButtonColor } from '../session/SessionButton';
import { SessionHtmlRenderer } from '../session/SessionHTMLRenderer';
import { SessionSpinner } from '../session/SessionSpinner';
import { SessionWrapperModal } from '../session/SessionWrapperModal';

const deleteDbLocally = async () => {
  window?.log?.info('configuration message sent successfully. Deleting everything');
  await window.Signal.Logs.deleteAll();
  await window.Signal.Data.removeAll();
  await window.Signal.Data.close();
  await window.Signal.Data.removeDB();
  await window.Signal.Data.removeOtherData();
  // 'unlink' => toast will be shown on app restart
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

      window.inboxStore?.dispatch(
        updateConfirmModal({
          title: window.i18n('dialogClearAllDataDeletionFailedTitle'),
          message: window.i18n('dialogClearAllDataDeletionFailedDesc'),
          okTheme: SessionButtonColor.Danger,
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
      window.inboxStore?.dispatch(
        updateConfirmModal({
          title: window.i18n('dialogClearAllDataDeletionFailedTitle'),
          message: window.i18n('dialogClearAllDataDeletionFailedMultiple', snodeStr),
          okTheme: SessionButtonColor.Danger,
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

  const onDeleteEverythingLocallyOnly = async () => {
    setIsLoading(true);
    try {
      window.log.warn('Deleting everything excluding network data');

      await sendConfigMessageAndDeleteEverything();
    } catch (e) {
      window.log.warn(e);
    } finally {
      setIsLoading(false);
    }

    dispatch(updateConfirmModal(null));
  };
  const onDeleteEverythingAndNetworkData = async () => {
    setIsLoading(true);
    try {
      window.log.warn('Deleting everything including network data');
      await deleteEverythingAndNetworkData();
    } catch (e) {
      window.log.warn(e);
    } finally {
      setIsLoading(false);
    }

    dispatch(updateConfirmModal(null));
  };

  /**
   * Performs specified on close action then removes the modal.
   */
  const onClickCancelHandler = useCallback(() => {
    window.inboxStore?.dispatch(updateDeleteAccountModal(null));
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
            onClick={onDeleteEverythingAndNetworkData}
            disabled={isLoading}
          />

          <SessionButton
            text={window.i18n('deviceOnly')}
            buttonColor={SessionButtonColor.Danger}
            onClick={onDeleteEverythingLocallyOnly}
            disabled={isLoading}
          />
        </div>

        <SessionSpinner loading={isLoading} />
      </div>
    </SessionWrapperModal>
  );
};
function dispatch(arg0: {
  payload: import('../../state/ducks/modalDialog').ConfirmModalState;
  type: string;
}) {
  throw new Error('Function not implemented.');
}
