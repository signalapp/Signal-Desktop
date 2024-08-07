import { debounce } from 'lodash';
import { useEffect, useRef, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import useInterval from 'react-use/lib/useInterval';
import useTimeoutFn from 'react-use/lib/useTimeoutFn';

import { Data } from '../../data/data';
import { getConversationController } from '../../session/conversations';
import { getMessageQueue } from '../../session/sending';
import { syncConfigurationIfNeeded } from '../../session/utils/sync/syncUtils';

import { clearSearch } from '../../state/ducks/search';
import { resetLeftOverlayMode, SectionType, showLeftPaneSection } from '../../state/ducks/section';
import {
  getGlobalUnreadMessageCount,
  getOurPrimaryConversation,
} from '../../state/selectors/conversations';
import { getFocusedSection } from '../../state/selectors/section';
import { getOurNumber } from '../../state/selectors/user';

import { cleanUpOldDecryptedMedias } from '../../session/crypto/DecryptedAttachmentsManager';

import { DURATION } from '../../session/constants';

import { uploadOurAvatar } from '../../interactions/conversationInteractions';
import { editProfileModal, onionPathModal } from '../../state/ducks/modalDialog';

import { loadDefaultRooms } from '../../session/apis/open_group_api/opengroupV2/ApiUtil';
import { getOpenGroupManager } from '../../session/apis/open_group_api/opengroupV2/OpenGroupManagerV2';
import { getSwarmPollingInstance } from '../../session/apis/snode_api';
import { UserUtils } from '../../session/utils';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { ActionPanelOnionStatusLight } from '../dialog/OnionStatusPathDialog';
import { SessionIconButton } from '../icon/SessionIconButton';
import { LeftPaneSectionContainer } from './LeftPaneSectionContainer';

import { SettingsKey } from '../../data/settings-key';
import { useFetchLatestReleaseFromFileServer } from '../../hooks/useFetchLatestReleaseFromFileServer';
import {
  forceRefreshRandomSnodePool,
  getFreshSwarmFor,
} from '../../session/apis/snode_api/snodePool';
import { ConfigurationSync } from '../../session/utils/job_runners/jobs/ConfigurationSyncJob';
import { useIsDarkTheme } from '../../state/selectors/theme';
import { switchThemeTo } from '../../themes/switchTheme';
import { ReleasedFeatures } from '../../util/releaseFeature';
import { getOppositeTheme } from '../../util/theme';
import { SessionNotificationCount } from '../icon/SessionNotificationCount';
import { useHotkey } from '../../hooks/useHotkey';
import { getIsModalVisble } from '../../state/selectors/modal';

const Section = (props: { type: SectionType }) => {
  const ourNumber = useSelector(getOurNumber);
  const globalUnreadMessageCount = useSelector(getGlobalUnreadMessageCount);
  const dispatch = useDispatch();
  const { type } = props;

  const isModalVisible = useSelector(getIsModalVisble);
  const isDarkTheme = useIsDarkTheme();
  const focusedSection = useSelector(getFocusedSection);
  const isSelected = focusedSection === props.type;

  const handleClick = () => {
    if (type === SectionType.Profile) {
      dispatch(editProfileModal({}));
    } else if (type === SectionType.ColorMode) {
      const currentTheme = window.Events.getThemeSetting();
      const newTheme = getOppositeTheme(currentTheme);
      // We want to persist the primary color when using the color mode button
      void switchThemeTo({
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
      dispatch(resetLeftOverlayMode());
    }
  };

  const settingsIconRef = useRef<HTMLButtonElement>(null);

  useHotkey('Escape', () => {
    if (type === SectionType.Settings && !isModalVisible) {
      settingsIconRef.current?.blur();
      dispatch(clearSearch());
      dispatch(showLeftPaneSection(SectionType.Message));
      dispatch(resetLeftOverlayMode());
    }
  });

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

  const unreadToShow = type === SectionType.Message ? globalUnreadMessageCount : undefined;

  switch (type) {
    case SectionType.Message:
      return (
        <SessionIconButton
          iconSize="medium"
          dataTestId="message-section"
          iconType={'chatBubble'}
          onClick={handleClick}
          isSelected={isSelected}
        >
          {Boolean(unreadToShow) && <SessionNotificationCount count={unreadToShow} />}
        </SessionIconButton>
      );
    case SectionType.Settings:
      return (
        <SessionIconButton
          iconSize="medium"
          dataTestId="settings-section"
          iconType={'gear'}
          onClick={handleClick}
          isSelected={isSelected}
          ref={settingsIconRef}
        />
      );
    case SectionType.PathIndicator:
      return (
        <ActionPanelOnionStatusLight
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
          iconType={isDarkTheme ? 'moon' : 'sun'}
          dataTestId="theme-section"
          onClick={handleClick}
          isSelected={isSelected}
        />
      );
  }
};

const cleanUpMediasInterval = DURATION.MINUTES * 60;

// Do this only if we created a new account id, or if we already received the initial configuration message
const triggerSyncIfNeeded = async () => {
  const us = UserUtils.getOurPubKeyStrFromCache();
  await getConversationController().get(us).setDidApproveMe(true, true);
  await getConversationController().get(us).setIsApproved(true, true);
  const didWeHandleAConfigurationMessageAlready =
    (await Data.getItemById(SettingsKey.hasSyncedInitialConfigurationItem))?.value || false;
  if (didWeHandleAConfigurationMessageAlready) {
    await syncConfigurationIfNeeded();
  }
};

const triggerAvatarReUploadIfNeeded = async () => {
  const lastTimeStampAvatarUpload =
    (await Data.getItemById(SettingsKey.lastAvatarUploadTimestamp))?.value || 0;

  if (Date.now() - lastTimeStampAvatarUpload > DURATION.DAYS * 14) {
    window.log.info('Reuploading avatar...');
    // reupload the avatar
    await uploadOurAvatar();
  }
};

/**
 * This function is called only once: on app startup with a logged in user
 */
const doAppStartUp = async () => {
  // this generates the key to encrypt attachments locally
  await Data.generateAttachmentKeyIfEmpty();

  // Feature Checks
  await ReleasedFeatures.checkIsDisappearMessageV2FeatureReleased();

  // trigger a sync message if needed for our other devices
  void triggerSyncIfNeeded();
  void getSwarmPollingInstance().start();
  void loadDefaultRooms();
  void getFreshSwarmFor(UserUtils.getOurPubKeyStrFromCache()); // refresh our swarm on start to speed up the first message fetching event

  // TODOLATER make this a job of the JobRunner
  debounce(triggerAvatarReUploadIfNeeded, 200);

  /* Postpone a little bit of the polling of sogs messages to let the swarm messages come in first. */
  global.setTimeout(() => {
    void getOpenGroupManager().startPolling();
  }, 10000);

  global.setTimeout(() => {
    // init the messageQueue. In the constructor, we add all not send messages
    // this call does nothing except calling the constructor, which will continue sending message in the pipeline
    void getMessageQueue().processAllPending();
  }, 3000);

  global.setTimeout(() => {
    // Schedule a confSyncJob in some time to let anything incoming from the network be applied and see if there is a push needed
    void ConfigurationSync.queueNewJobIfNeeded();
  }, 20000);
};

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

  useFetchLatestReleaseFromFileServer();

  useInterval(() => {
    if (!ourPrimaryConversation) {
      return;
    }
    void syncConfigurationIfNeeded();
  }, DURATION.DAYS * 2);

  useInterval(() => {
    if (!ourPrimaryConversation) {
      return;
    }
    // trigger an updates from the snodes every hour

    void forceRefreshRandomSnodePool();
  }, DURATION.HOURS * 1);

  useTimeoutFn(() => {
    if (!ourPrimaryConversation) {
      return;
    }
    // trigger an updates from the snodes after 5 minutes, once
    void forceRefreshRandomSnodePool();
  }, DURATION.MINUTES * 5);

  useInterval(() => {
    if (!ourPrimaryConversation) {
      return;
    }
    // this won't be run every days, but if the app stays open for more than 10 days
    void triggerAvatarReUploadIfNeeded();
  }, DURATION.DAYS * 1);

  if (!ourPrimaryConversation) {
    window?.log?.warn('ActionsPanel: ourPrimaryConversation is not set');
    return null;
  }
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
