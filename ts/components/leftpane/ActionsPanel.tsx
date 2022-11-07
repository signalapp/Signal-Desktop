import React, { useEffect, useState } from 'react';
import { getConversationController } from '../../session/conversations';
import { syncConfigurationIfNeeded } from '../../session/utils/syncUtils';

import {
  Data,
  hasSyncedInitialConfigurationItem,
  lastAvatarUploadTimestamp,
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
import { getFocusedSection } from '../../state/selectors/section';
import { clearSearch } from '../../state/ducks/search';
import { resetOverlayMode, SectionType, showLeftPaneSection } from '../../state/ducks/section';

import { cleanUpOldDecryptedMedias } from '../../session/crypto/DecryptedAttachmentsManager';

import { DURATION } from '../../session/constants';

import { editProfileModal, onionPathModal } from '../../state/ducks/modalDialog';
import { uploadOurAvatar } from '../../interactions/conversationInteractions';
import { debounce, isEmpty, isString } from 'lodash';

// tslint:disable-next-line: no-import-side-effect no-submodule-imports

import { ActionPanelOnionStatusLight } from '../dialog/OnionStatusPathDialog';
import { loadDefaultRooms } from '../../session/apis/open_group_api/opengroupV2/ApiUtil';
import { getOpenGroupManager } from '../../session/apis/open_group_api/opengroupV2/OpenGroupManagerV2';
import { getSwarmPollingInstance } from '../../session/apis/snode_api';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { SessionIconButton } from '../icon';
import { LeftPaneSectionContainer } from './LeftPaneSectionContainer';
import { ipcRenderer } from 'electron';
import { UserUtils } from '../../session/utils';

import { getLatestReleaseFromFileServer } from '../../session/apis/file_server_api/FileServerApi';
import { switchThemeTo } from '../../themes/switchTheme';
import { ThemeStateType } from '../../themes/constants/colors';
import { isDarkTheme } from '../../state/selectors/theme';
import { forceRefreshRandomSnodePool } from '../../session/apis/snode_api/snodePool';

const Section = (props: { type: SectionType }) => {
  const ourNumber = useSelector(getOurNumber);
  const unreadMessageCount = useSelector(getUnreadMessageCount);
  const dispatch = useDispatch();
  const { type } = props;

  const isDarkMode = useSelector(isDarkTheme);
  const focusedSection = useSelector(getFocusedSection);
  const isSelected = focusedSection === props.type;

  const handleClick = async () => {
    /* tslint:disable:no-void-expression */
    if (type === SectionType.Profile) {
      dispatch(editProfileModal({}));
    } else if (type === SectionType.ColorMode) {
      const currentTheme = String(window.Events.getThemeSetting());
      const newTheme = (isDarkMode
        ? currentTheme.replace('dark', 'light')
        : currentTheme.replace('light', 'dark')) as ThemeStateType;

      // We want to persist the primary color when using the color mode button
      await switchThemeTo({
        theme: newTheme,
        mainWindow: true,
        usePrimaryColor: true,
        dispatch,
      });
    } else if (type === SectionType.PathIndicator) {
      // Show Path Indicator Modal
      dispatch(onionPathModal({}));
    } else {
      // message section
      dispatch(clearSearch());
      dispatch(showLeftPaneSection(type));
      dispatch(resetOverlayMode());
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
    case SectionType.ColorMode:
    default:
      return (
        <SessionIconButton
          iconSize="medium"
          iconType={isDarkMode ? 'moon' : 'sun'}
          dataTestId="theme-section"
          onClick={handleClick}
          isSelected={isSelected}
        />
      );
  }
};

const cleanUpMediasInterval = DURATION.MINUTES * 60;

// every 1 minute we fetch from the fileserver to check for a new release
// * if there is none, no request to github are made.
// * if there is a version on the fileserver more recent than our current, we fetch github to get the UpdateInfos and trigger an update as usual (asking user via dialog)
const fetchReleaseFromFileServerInterval = 1000 * 60; // try to fetch the latest release from the fileserver every minute

const setupTheme = async () => {
  const theme = window.Events.getThemeSetting();
  // We don't want to reset the primary color on startup
  await switchThemeTo({
    theme,
    mainWindow: true,
    usePrimaryColor: true,
    dispatch: window?.inboxStore?.dispatch || undefined,
  });
};

// Do this only if we created a new Session ID, or if we already received the initial configuration message
const triggerSyncIfNeeded = async () => {
  await getConversationController()
    .get(UserUtils.getOurPubKeyStrFromCache())
    .setDidApproveMe(true, true);
  await getConversationController()
    .get(UserUtils.getOurPubKeyStrFromCache())
    .setIsApproved(true, true);
  const didWeHandleAConfigurationMessageAlready =
    (await Data.getItemById(hasSyncedInitialConfigurationItem))?.value || false;
  if (didWeHandleAConfigurationMessageAlready) {
    await syncConfigurationIfNeeded();
  }
};

const triggerAvatarReUploadIfNeeded = async () => {
  const lastTimeStampAvatarUpload = (await Data.getItemById(lastAvatarUploadTimestamp))?.value || 0;

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
  // this generates the key to encrypt attachments locally
  void Data.generateAttachmentKeyIfEmpty();

  /* Postpone a little bit of the polling of sogs messages to let the swarm messages come in first. */
  global.setTimeout(() => {
    void getOpenGroupManager().startPolling();
  }, 5000);

  // trigger a sync message if needed for our other devices
  void triggerSyncIfNeeded();
  void getSwarmPollingInstance().start();

  void loadDefaultRooms();

  debounce(triggerAvatarReUploadIfNeeded, 200);
};

async function fetchReleaseFromFSAndUpdateMain() {
  try {
    window.log.info('[updater] about to fetchReleaseFromFSAndUpdateMain');

    const latest = await getLatestReleaseFromFileServer();
    window.log.info('[updater] fetched latest release from fileserver: ', latest);

    if (isString(latest) && !isEmpty(latest)) {
      ipcRenderer.send('set-release-from-file-server', latest);
      window.readyForUpdates();
    }
  } catch (e) {
    window.log.warn(e);
  }
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
      <LeftPaneSectionContainer data-testid="leftpane-section-container">
        <Section type={SectionType.Profile} />
        <Section type={SectionType.Message} />
        <Section type={SectionType.Settings} />

        <Section type={SectionType.PathIndicator} />
        <Section type={SectionType.ColorMode} />
      </LeftPaneSectionContainer>
    </>
  );
};
