import React, { Dispatch, useEffect, useState } from 'react';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { Avatar, AvatarSize } from '../Avatar';
import { darkTheme, lightTheme } from '../../state/ducks/SessionTheme';
import { SessionToastContainer } from './SessionToastContainer';
import { ConversationController } from '../../session/conversations';
import { UserUtils } from '../../session/utils';
import { syncConfigurationIfNeeded } from '../../session/utils/syncUtils';
import { DAYS, MINUTES } from '../../session/utils/Number';
import fse from 'fs-extra';

import {
  createOrUpdateItem,
  generateAttachmentKeyIfEmpty,
  getItemById,
  hasSyncedInitialConfigurationItem,
  lastAvatarUploadTimestamp,
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

import {
  cleanUpOldDecryptedMedias,
  getDecryptedMediaUrl,
} from '../../session/crypto/DecryptedAttachmentsManager';
import { OpenGroupManagerV2 } from '../../opengroup/opengroupV2/OpenGroupManagerV2';
import { loadDefaultRooms } from '../../opengroup/opengroupV2/ApiUtil';
import { forceRefreshRandomSnodePool } from '../../session/snode_api/snodePool';
import { SwarmPolling } from '../../session/snode_api/swarmPolling';
import { IMAGE_JPEG } from '../../types/MIME';
import { FSv2 } from '../../fileserver';
import { stringToArrayBuffer } from '../../session/utils/String';
import { debounce } from 'underscore';
// tslint:disable-next-line: no-import-side-effect no-submodule-imports

export enum SectionType {
  Profile,
  Message,
  Contact,
  Channel,
  Settings,
  Moon,
}

const showUnstableAttachmentsDialogIfNeeded = async () => {
  const alreadyShown = (await getItemById('showUnstableAttachmentsDialog'))?.value;

  if (!alreadyShown) {
    window.confirmationDialog({
      title: 'File server update',
      message:
        "We're upgrading the way files are stored. File transfer may be unstable for the next 24-48 hours.",
    });

    await createOrUpdateItem({ id: 'showUnstableAttachmentsDialog', value: true });
  }
};

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

  const unreadToShow = type === SectionType.Message ? unreadMessageCount : undefined;

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

const setupTheme = (dispatch: Dispatch<any>) => {
  const theme = window.Events.getThemeSetting();
  window.setTheme(theme);

  const newThemeObject = theme === 'dark' ? darkTheme : lightTheme;
  dispatch(applyTheme(newThemeObject));
};

// Do this only if we created a new Session ID, or if we already received the initial configuration message
const triggerSyncIfNeeded = async () => {
  const didWeHandleAConfigurationMessageAlready =
    (await getItemById(hasSyncedInitialConfigurationItem))?.value || false;
  if (didWeHandleAConfigurationMessageAlready) {
    await syncConfigurationIfNeeded();
  }
};

const triggerAvatarReUploadIfNeeded = async () => {
  const lastTimeStampAvatarUpload = (await getItemById(lastAvatarUploadTimestamp))?.value || 0;

  if (Date.now() - lastTimeStampAvatarUpload > 14 * DAYS) {
    window.log.info('Reuploading avatar...');
    // reupload the avatar
    const ourConvo = await ConversationController.getInstance().get(
      UserUtils.getOurPubKeyStrFromCache()
    );
    if (!ourConvo) {
      window.log.warn('ourConvo not found... This is not a valid case');
      return;
    }
    const profileKey = window.textsecure.storage.get('profileKey');
    if (!profileKey) {
      window.log.warn('our profileKey not found... This is not a valid case');
      return;
    }

    const currentAttachmentPath = ourConvo.getAvatarPath();

    if (!currentAttachmentPath) {
      window.log.warn('No attachment currently set for our convo.. Nothing to do.');
      return;
    }

    const decryptedAvatarUrl = await getDecryptedMediaUrl(currentAttachmentPath, IMAGE_JPEG);

    if (!decryptedAvatarUrl) {
      window.log.warn('Could not decrypt avatar stored locally..');
      return;
    }
    const response = await fetch(decryptedAvatarUrl);
    const blob = await response.blob();
    const decryptedAvatarData = await blob.arrayBuffer();

    if (!decryptedAvatarData?.byteLength) {
      window.log.warn('Could not read blob of avatar locally..');
      return;
    }

    const encryptedData = await window.textsecure.crypto.encryptProfile(
      decryptedAvatarData,
      profileKey
    );

    const avatarPointer = await FSv2.uploadFileToFsV2(encryptedData);
    let fileUrl;
    if (!avatarPointer) {
      window.log.warn('failed to reupload avatar to fsv2');
      return;
    }
    ({ fileUrl } = avatarPointer);

    ourConvo.set('avatarPointer', fileUrl);

    // this encrypts and save the new avatar and returns a new attachment path
    const upgraded = await window.Signal.Migrations.processNewAttachment({
      isRaw: true,
      data: decryptedAvatarData,
      url: fileUrl,
    });
    const newAvatarPath = upgraded.path;
    // Replace our temporary image with the attachment pointer from the server:
    ourConvo.set('avatar', null);
    const existingHash = ourConvo.get('avatarHash');
    const displayName = ourConvo.get('profileName');
    // this commits already
    await ourConvo.setLokiProfile({ avatar: newAvatarPath, displayName, avatarHash: existingHash });
    const newTimestampReupload = Date.now();
    await createOrUpdateItem({ id: lastAvatarUploadTimestamp, value: newTimestampReupload });
    window.log.info(
      `Reuploading avatar finished at ${newTimestampReupload}, newAttachmentPointer ${fileUrl}`
    );
  }
};

/**
 * This function is called only once: on app startup with a logged in user
 */
const doAppStartUp = (dispatch: Dispatch<any>) => {
  if (window.lokiFeatureFlags.useOnionRequests || window.lokiFeatureFlags.useFileOnionRequests) {
    // Initialize paths for onion requests
    void OnionPaths.getInstance().buildNewOnionPaths();
  }

  void showUnstableAttachmentsDialogIfNeeded();
  // init the messageQueue. In the constructor, we add all not send messages
  // this call does nothing except calling the constructor, which will continue sending message in the pipeline
  void getMessageQueue().processAllPending();
  void setupTheme(dispatch);

  // keep that one to make sure our users upgrade to new sessionIDS
  void showResetSessionIDDialogIfNeeded();
  // remove existing prekeys, sign prekeys and sessions
  // FIXME audric, make this in a migration so we can remove this line
  void clearSessionsAndPreKeys();

  // this generates the key to encrypt attachments locally
  void generateAttachmentKeyIfEmpty();
  void OpenGroupManagerV2.getInstance().startPolling();
  // trigger a sync message if needed for our other devices

  void triggerSyncIfNeeded();

  void loadDefaultRooms();

  debounce(triggerAvatarReUploadIfNeeded, 200);

  // TODO: Investigate the case where we reconnect
  const ourKey = UserUtils.getOurPubKeyStrFromCache();
  SwarmPolling.getInstance().addPubkey(ourKey);
  SwarmPolling.getInstance().start();
};

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
    void doAppStartUp(dispatch);
  }, []);

  // wait for cleanUpMediasInterval and then start cleaning up medias
  // this would be way easier to just be able to not trigger a call with the setInterval
  useEffect(() => {
    const timeout = global.setTimeout(() => setStartCleanUpMedia(true), cleanUpMediasInterval);

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

  useInterval(() => {
    void forceRefreshRandomSnodePool();
  }, DAYS * 1);

  useInterval(() => {
    // this won't be run every days, but if the app stays open for more than 10 days
    void triggerAvatarReUploadIfNeeded();
  }, DAYS * 1);

  return (
    <div className="module-left-pane__sections-container">
      <Section type={SectionType.Profile} avatarPath={ourPrimaryConversation.avatarPath} />
      <Section type={SectionType.Message} />
      <Section type={SectionType.Contact} />
      <Section type={SectionType.Settings} />

      <SessionToastContainer />
      <Section type={SectionType.Moon} />
    </div>
  );
};
