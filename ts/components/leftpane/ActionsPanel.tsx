import React, { useEffect, useState } from 'react';
import { getConversationController } from '../../session/conversations';
import { syncConfigurationIfNeeded } from '../../session/utils/syncUtils';

import {
  generateAttachmentKeyIfEmpty,
  getAllOpenGroupV1Conversations,
  getItemById,
  hasSyncedInitialConfigurationItem,
  lastAvatarUploadTimestamp,
  removeConversation,
} from '../../data/data';
import { getMessageQueue } from '../../session/sending';
import { useDispatch, useSelector } from 'react-redux';
// tslint:disable: no-submodule-imports
import useInterval from 'react-use/lib/useInterval';
import useTimeoutFn from 'react-use/lib/useTimeoutFn';

import { getOurNumber } from '../../state/selectors/user';
import {
  getOurPrimaryConversation,
  getUnreadMessageCount,
} from '../../state/selectors/conversations';
import { applyTheme } from '../../state/ducks/theme';
import { getFocusedSection } from '../../state/selectors/section';
import { clearSearch } from '../../state/ducks/search';
import { SectionType, setOverlayMode, showLeftPaneSection } from '../../state/ducks/section';

import { cleanUpOldDecryptedMedias } from '../../session/crypto/DecryptedAttachmentsManager';

import { DURATION } from '../../session/constants';
import { conversationChanged, conversationRemoved } from '../../state/ducks/conversations';
import {
  editProfileModal,
  onionPathModal,
  updateConfirmModal,
} from '../../state/ducks/modalDialog';
import { uploadOurAvatar } from '../../interactions/conversationInteractions';
import { ModalContainer } from '../dialog/ModalContainer';
import { debounce, isEmpty, isString } from 'lodash';

// tslint:disable-next-line: no-import-side-effect no-submodule-imports

import { ActionPanelOnionStatusLight } from '../dialog/OnionStatusPathDialog';
import { switchHtmlToDarkTheme, switchHtmlToLightTheme } from '../../state/ducks/SessionTheme';
import { loadDefaultRooms } from '../../session/apis/open_group_api/opengroupV2/ApiUtil';
import { getOpenGroupManager } from '../../session/apis/open_group_api/opengroupV2/OpenGroupManagerV2';
import { getSwarmPollingInstance } from '../../session/apis/snode_api';
import { forceRefreshRandomSnodePool } from '../../session/apis/snode_api/snodePool';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { CallInFullScreenContainer } from '../calling/CallInFullScreenContainer';
import { DraggableCallContainer } from '../calling/DraggableCallContainer';
import { IncomingCallDialog } from '../calling/IncomingCallDialog';
import { SessionIconButton } from '../icon';
import { SessionToastContainer } from '../SessionToastContainer';
import { LeftPaneSectionContainer } from './LeftPaneSectionContainer';
import { getLatestDesktopReleaseFileToFsV2 } from '../../session/apis/file_server_api/FileServerApiV2';
import { ipcRenderer } from 'electron';
import { UserUtils } from '../../session/utils';

import { Storage } from '../../util/storage';
import { SettingsKey } from '../../data/settings-key';

const Section = (props: { type: SectionType }) => {
  const ourNumber = useSelector(getOurNumber);
  const unreadMessageCount = useSelector(getUnreadMessageCount);
  const dispatch = useDispatch();
  const { type } = props;

  const focusedSection = useSelector(getFocusedSection);
  const isSelected = focusedSection === props.type;

  const handleClick = () => {
    /* tslint:disable:no-void-expression */
    if (type === SectionType.Profile) {
      dispatch(editProfileModal({}));
    } else if (type === SectionType.Moon) {
      const themeFromSettings = window.Events.getThemeSetting();
      const updatedTheme = themeFromSettings === 'dark' ? 'light' : 'dark';
      window.setTheme(updatedTheme);
      if (updatedTheme === 'dark') {
        switchHtmlToDarkTheme();
      } else {
        switchHtmlToLightTheme();
      }

      const newThemeObject = updatedTheme === 'dark' ? 'dark' : 'light';
      dispatch(applyTheme(newThemeObject));
    } else if (type === SectionType.PathIndicator) {
      // Show Path Indicator Modal
      dispatch(onionPathModal({}));
    } else {
      // message section
      dispatch(clearSearch());
      dispatch(showLeftPaneSection(type));
      dispatch(setOverlayMode(undefined));
    }
  };

  if (type === SectionType.Profile) {
    return (
      <Avatar
        size={AvatarSize.XS}
        onAvatarClick={handleClick}
        pubkey={ourNumber}
        dataTestId="leftpane-primary-avatar"
      />
    );
  }

  const unreadToShow = type === SectionType.Message ? unreadMessageCount : undefined;

  switch (type) {
    case SectionType.Message:
      return (
        <SessionIconButton
          iconSize="medium"
          dataTestId="message-section"
          iconType={'chatBubble'}
          iconColor={undefined}
          notificationCount={unreadToShow}
          onClick={handleClick}
          isSelected={isSelected}
        />
      );
    case SectionType.Contact:
      return (
        <SessionIconButton
          iconSize="medium"
          dataTestId="contact-section"
          iconType={'users'}
          iconColor={undefined}
          notificationCount={unreadToShow}
          onClick={handleClick}
          isSelected={isSelected}
        />
      );
    case SectionType.Settings:
      return (
        <SessionIconButton
          iconSize="medium"
          dataTestId="settings-section"
          iconType={'gear'}
          iconColor={undefined}
          notificationCount={unreadToShow}
          onClick={handleClick}
          isSelected={isSelected}
        />
      );
    case SectionType.PathIndicator:
      return (
        <ActionPanelOnionStatusLight
          dataTestId="onion-status-section"
          handleClick={handleClick}
          isSelected={isSelected}
          id={'onion-path-indicator-led-id'}
        />
      );
    default:
      return (
        <SessionIconButton
          iconSize="medium"
          iconType={'moon'}
          dataTestId="theme-section"
          iconColor={undefined}
          notificationCount={unreadToShow}
          onClick={handleClick}
          isSelected={isSelected}
        />
      );
  }
};

const cleanUpMediasInterval = DURATION.MINUTES * 60;

// every 10 minutes we fetch from the fileserver to check for a new release
// * if there is none, no request to github are made.
// * if there is a version on the fileserver more recent than our current, we fetch github to get the UpdateInfos and trigger an update as usual (asking user via dialog)
const fetchReleaseFromFileServerInterval = 1000 * 60; // try to fetch the latest release from the fileserver every minute

const setupTheme = () => {
  const theme = window.Events.getThemeSetting();
  window.setTheme(theme);
  if (theme === 'dark') {
    switchHtmlToDarkTheme();
  } else {
    switchHtmlToLightTheme();
  }
  const newThemeObject = theme === 'dark' ? 'dark' : 'light';
  window?.inboxStore?.dispatch(applyTheme(newThemeObject));
};

// Do this only if we created a new Session ID, or if we already received the initial configuration message
const triggerSyncIfNeeded = async () => {
  await getConversationController()
    .get(UserUtils.getOurPubKeyStrFromCache())
    .setDidApproveMe(true, true);
  const didWeHandleAConfigurationMessageAlready =
    (await getItemById(hasSyncedInitialConfigurationItem))?.value || false;
  if (didWeHandleAConfigurationMessageAlready) {
    await syncConfigurationIfNeeded();
  }
};

const removeAllV1OpenGroups = async () => {
  const allV1Convos = (await getAllOpenGroupV1Conversations()).models || [];
  // do not remove messages of opengroupv1 for now. We have to find a way of doing it without making the whole app extremely slow
  // tslint:disable-next-line: prefer-for-of
  for (let index = 0; index < allV1Convos.length; index++) {
    const v1Convo = allV1Convos[index];
    try {
      await removeConversation(v1Convo.id);
      window.log.info(`deleting v1convo : ${v1Convo.id}`);
      getConversationController().unsafeDelete(v1Convo);
      if (window.inboxStore) {
        window.inboxStore?.dispatch(conversationRemoved(v1Convo.id));
        window.inboxStore?.dispatch(
          conversationChanged({ id: v1Convo.id, data: v1Convo.getConversationModelProps() })
        );
      }
    } catch (e) {
      window.log.warn(`failed to delete opengroupv1 ${v1Convo.id}`, e);
    }
  }
};

const triggerAvatarReUploadIfNeeded = async () => {
  const lastTimeStampAvatarUpload = (await getItemById(lastAvatarUploadTimestamp))?.value || 0;

  if (Date.now() - lastTimeStampAvatarUpload > DURATION.DAYS * 14) {
    window.log.info('Reuploading avatar...');
    // reupload the avatar
    await uploadOurAvatar();
  }
};

/**
 * This function is called only once: on app startup with a logged in user
 */
const doAppStartUp = () => {
  // init the messageQueue. In the constructor, we add all not send messages
  // this call does nothing except calling the constructor, which will continue sending message in the pipeline
  void getMessageQueue().processAllPending();

  void setupTheme();

  // keep that one to make sure our users upgrade to new sessionIDS
  void removeAllV1OpenGroups();

  // this generates the key to encrypt attachments locally
  void generateAttachmentKeyIfEmpty();
  void getOpenGroupManager().startPolling();
  // trigger a sync message if needed for our other devices

  void triggerSyncIfNeeded();
  void getSwarmPollingInstance().start();

  void loadDefaultRooms();

  debounce(triggerAvatarReUploadIfNeeded, 200);

  void askEnablingOpengroupPruningIfNeeded();
};

const CallContainer = () => {
  return (
    <>
      <DraggableCallContainer />
      <IncomingCallDialog />
      <CallInFullScreenContainer />
    </>
  );
};

async function fetchReleaseFromFSAndUpdateMain() {
  try {
    window.log.info('[updater] about to fetchReleaseFromFSAndUpdateMain');

    const latest = await getLatestDesktopReleaseFileToFsV2();
    window.log.info('[updater] fetched latest release from fsv2: ', latest);

    if (isString(latest) && !isEmpty(latest)) {
      ipcRenderer.send('set-release-from-file-server', latest);
      window.readyForUpdates();
    }
  } catch (e) {
    window.log.warn(e);
  }
}

async function askEnablingOpengroupPruningIfNeeded() {
  if (Storage.get(SettingsKey.settingsOpengroupPruning) === undefined) {
    const setSettingsAndCloseDialog = async (valueToSetPruningTo: boolean) => {
      window.setSettingValue(SettingsKey.settingsOpengroupPruning, valueToSetPruningTo);
      await window.setOpengroupPruning(valueToSetPruningTo);
      window.inboxStore?.dispatch(updateConfirmModal(null));
    };
    window.inboxStore?.dispatch(
      updateConfirmModal({
        onClickOk: async () => {
          await setSettingsAndCloseDialog(true);
        },
        onClickClose: async () => {
          await setSettingsAndCloseDialog(false);
        },
        onClickCancel: async () => {
          await setSettingsAndCloseDialog(false);
        },
        title: window.i18n('pruningOpengroupDialogTitle'),
        message: window.i18n('pruningOpengroupDialogMessage'),
        messageSub: window.i18n('pruningOpengroupDialogSubMessage'),
        okText: window.i18n('enable'),
        cancelText: window.i18n('keepDisabled'),
      })
    );
    return;
  }
  // otherwise nothing to do. the settings is already on or off, but as expected by the user
}

/**
 * ActionsPanel is the far left banner (not the left pane).
 * The panel with buttons to switch between the message/contact/settings/theme views
 */
export const ActionsPanel = () => {
  const [startCleanUpMedia, setStartCleanUpMedia] = useState(false);
  const ourPrimaryConversation = useSelector(getOurPrimaryConversation);

  // this maxi useEffect is called only once: when the component is mounted.
  // For the action panel, it means this is called only one per app start/with a user loggedin
  useEffect(() => {
    void doAppStartUp();
  }, []);

  // wait for cleanUpMediasInterval and then start cleaning up medias
  // this would be way easier to just be able to not trigger a call with the setInterval
  useEffect(() => {
    const timeout = setTimeout(() => setStartCleanUpMedia(true), cleanUpMediasInterval);

    return () => clearTimeout(timeout);
  }, []);

  useInterval(cleanUpOldDecryptedMedias, startCleanUpMedia ? cleanUpMediasInterval : null);

  useInterval(() => {
    void fetchReleaseFromFSAndUpdateMain();
  }, fetchReleaseFromFileServerInterval);

  if (!ourPrimaryConversation) {
    window?.log?.warn('ActionsPanel: ourPrimaryConversation is not set');
    return null;
  }

  useInterval(() => {
    void syncConfigurationIfNeeded();
  }, DURATION.DAYS * 2);

  useInterval(() => {
    // trigger an updates from the snodes every hour

    void forceRefreshRandomSnodePool();
  }, DURATION.HOURS * 1);

  useTimeoutFn(() => {
    // trigger an updates from the snodes after 5 minutes, once
    void forceRefreshRandomSnodePool();
  }, DURATION.MINUTES * 5);

  useInterval(() => {
    // this won't be run every days, but if the app stays open for more than 10 days
    void triggerAvatarReUploadIfNeeded();
  }, DURATION.DAYS * 1);

  return (
    <>
      <ModalContainer />

      <CallContainer />
      <LeftPaneSectionContainer data-testid="leftpane-section-container">
        <Section type={SectionType.Profile} />
        <Section type={SectionType.Message} />
        <Section type={SectionType.Contact} />
        <Section type={SectionType.Settings} />

        <SessionToastContainer />

        <Section type={SectionType.PathIndicator} />
        <Section type={SectionType.Moon} />
      </LeftPaneSectionContainer>
    </>
  );
};
