import React, { useEffect, useState } from 'react';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { Avatar, AvatarSize } from '../Avatar';
import { darkTheme, lightTheme } from '../../state/ducks/SessionTheme';
import { SessionToastContainer } from './SessionToastContainer';
import { ConversationController } from '../../session/conversations';
import { UserUtils } from '../../session/utils';
import { syncConfigurationIfNeeded } from '../../session/utils/syncUtils';
import { DAYS, MINUTES, SECONDS } from '../../session/utils/Number';
import {
  generateAttachmentKeyIfEmpty,
  getItemById,
  hasSyncedInitialConfigurationItem,
  removeItemById,
} from '../../data/data';
import { OnionPaths } from '../../session/onions';
import { getMessageQueue } from '../../session/sending';
import { clearSessionsAndPreKeys } from '../../util/accountManager';
import { useDispatch, useSelector } from 'react-redux';
import { getOurNumber } from '../../state/selectors/user';
import {
  getOurPrimaryConversation,
  getUnreadMessageCount,
} from '../../state/selectors/conversations';
import { getTheme } from '../../state/selectors/theme';
import { applyTheme } from '../../state/ducks/theme';
import { getFocusedSection } from '../../state/selectors/section';
import { useInterval } from '../../hooks/useInterval';
import { clearSearch } from '../../state/ducks/search';
import { showLeftPaneSection } from '../../state/ducks/section';
import { cleanUpOldDecryptedMedias } from '../../session/crypto/DecryptedAttachmentsManager';
import { useTimeoutFn } from 'react-use';
import { getSodium } from '../../session/crypto';
// tslint:disable-next-line: no-import-side-effect no-submodule-imports

export enum SectionType {
  Profile,
  Message,
  Contact,
  Channel,
  Settings,
  Moon,
}

const Section = (props: { type: SectionType; avatarPath?: string }) => {
  const ourNumber = useSelector(getOurNumber);
  const unreadMessageCount = useSelector(getUnreadMessageCount);
  const theme = useSelector(getTheme);
  const dispatch = useDispatch();
  const { type, avatarPath } = props;

  const focusedSection = useSelector(getFocusedSection);
  const isSelected = focusedSection === props.type;

  const handleClick = () => {
    /* tslint:disable:no-void-expression */
    if (type === SectionType.Profile) {
      window.showEditProfileDialog();
    } else if (type === SectionType.Moon) {
      const themeFromSettings = window.Events.getThemeSetting();
      const updatedTheme = themeFromSettings === 'dark' ? 'light' : 'dark';
      window.setTheme(updatedTheme);

      const newThemeObject = updatedTheme === 'dark' ? darkTheme : lightTheme;
      dispatch(applyTheme(newThemeObject));
    } else {
      dispatch(clearSearch());
      dispatch(showLeftPaneSection(type));
    }
  };

  if (type === SectionType.Profile) {
    const conversation = ConversationController.getInstance().get(ourNumber);

    const profile = conversation?.getLokiProfile();
    const userName = (profile && profile.displayName) || ourNumber;
    return (
      <Avatar
        avatarPath={avatarPath}
        size={AvatarSize.XS}
        onAvatarClick={handleClick}
        name={userName}
        pubkey={ourNumber}
      />
    );
  }

  let iconType: SessionIconType;
  switch (type) {
    case SectionType.Message:
      iconType = SessionIconType.ChatBubble;
      break;
    case SectionType.Contact:
      iconType = SessionIconType.Users;
      break;
    case SectionType.Settings:
      iconType = SessionIconType.Gear;
      break;
    case SectionType.Moon:
      iconType = SessionIconType.Moon;
      break;

    default:
      iconType = SessionIconType.Moon;
  }

  const unreadToShow =
    type === SectionType.Message ? unreadMessageCount : undefined;

  return (
    <SessionIconButton
      iconSize={SessionIconSize.Medium}
      iconType={iconType}
      notificationCount={unreadToShow}
      onClick={handleClick}
      isSelected={isSelected}
      theme={theme}
    />
  );
};

const showResetSessionIDDialogIfNeeded = async () => {
  const userED25519KeyPairHex = await UserUtils.getUserED25519KeyPair();
  if (userED25519KeyPairHex) {
    return;
  }

  window.showResetSessionIdDialog();
};

const cleanUpMediasInterval = MINUTES * 30;

/**
 * ActionsPanel is the far left banner (not the left pane).
 * The panel with buttons to switch between the message/contact/settings/theme views
 */
export const ActionsPanel = () => {
  const dispatch = useDispatch();
  const [startCleanUpMedia, setStartCleanUpMedia] = useState(false);

  const ourPrimaryConversation = useSelector(getOurPrimaryConversation);

  // this maxi useEffect is called only once: when the component is mounted.
  // For the action panel, it means this is called only one per app start/with a user loggedin
  useEffect(() => {
    void window.setClockParams();
    if (
      window.lokiFeatureFlags.useOnionRequests ||
      window.lokiFeatureFlags.useFileOnionRequests
    ) {
      // Initialize paths for onion requests
      void OnionPaths.getInstance().buildNewOnionPaths();
    }

    // init the messageQueue. In the constructor, we had all not send messages
    // this call does nothing except calling the constructor, which will continue sending message in the pipeline
    void getMessageQueue().processAllPending();

    const theme = window.Events.getThemeSetting();
    window.setTheme(theme);

    const newThemeObject = theme === 'dark' ? darkTheme : lightTheme;
    dispatch(applyTheme(newThemeObject));

    void showResetSessionIDDialogIfNeeded();
    // remove existing prekeys, sign prekeys and sessions
    void clearSessionsAndPreKeys();
    // we consider people had the time to upgrade, so remove this id from the db
    // it was used to display a dialog when we added the light mode auto-enabled
    void removeItemById('hasSeenLightModeDialog');

    // Do this only if we created a new Session ID, or if we already received the initial configuration message

    const syncConfiguration = async () => {
      const didWeHandleAConfigurationMessageAlready =
        (await getItemById(hasSyncedInitialConfigurationItem))?.value || false;
      if (didWeHandleAConfigurationMessageAlready) {
        await syncConfigurationIfNeeded();
      }
    };
    void generateAttachmentKeyIfEmpty();
    // trigger a sync message if needed for our other devices
    void syncConfiguration();
  }, []);

  // wait for cleanUpMediasInterval and then start cleaning up medias
  // this would be way easier to just be able to not trigger a call with the setInterval
  useEffect(() => {
    const timeout = global.setTimeout(
      () => setStartCleanUpMedia(true),
      cleanUpMediasInterval
    );

    return () => global.clearTimeout(timeout);
  }, []);

  useInterval(
    () => {
      cleanUpOldDecryptedMedias();
    },
    startCleanUpMedia ? cleanUpMediasInterval : null
  );

  if (!ourPrimaryConversation) {
    window.log.warn('ActionsPanel: ourPrimaryConversation is not set');
    return <></>;
  }

  useInterval(() => {
    void syncConfigurationIfNeeded();
  }, DAYS * 2);

  return (
    <div className="module-left-pane__sections-container">
      <Section
        type={SectionType.Profile}
        avatarPath={ourPrimaryConversation.avatarPath}
      />
      <Section type={SectionType.Message} />
      <Section type={SectionType.Contact} />
      <Section type={SectionType.Settings} />

      <SessionToastContainer />
      <Section type={SectionType.Moon} />
    </div>
  );
};
