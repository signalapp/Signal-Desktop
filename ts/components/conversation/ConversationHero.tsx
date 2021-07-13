// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef, useState } from 'react';
import Measure from 'react-measure';
import { Avatar, AvatarBlur, Props as AvatarProps } from '../Avatar';
import { ContactName } from './ContactName';
import { About } from './About';
import { GroupDescription } from './GroupDescription';
import { SharedGroupNames } from '../SharedGroupNames';
import { LocalizerType } from '../../types/Util';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { Button, ButtonSize, ButtonVariant } from '../Button';
import { assert } from '../../util/assert';
import { shouldBlurAvatar } from '../../util/shouldBlurAvatar';

export type Props = {
  about?: string;
  acceptedMessageRequest?: boolean;
  groupDescription?: string;
  i18n: LocalizerType;
  isMe: boolean;
  membersCount?: number;
  onHeightChange?: () => unknown;
  phoneNumber?: string;
  sharedGroupNames?: Array<string>;
  unblurAvatar: () => void;
  unblurredAvatarPath?: string;
  updateSharedGroups: () => unknown;
} & Omit<AvatarProps, 'onClick' | 'size' | 'noteToSelf'>;

const renderMembershipRow = ({
  acceptedMessageRequest,
  conversationType,
  i18n,
  isMe,
  onClickMessageRequestWarning,
  phoneNumber,
  sharedGroupNames,
}: Pick<
  Props,
  | 'acceptedMessageRequest'
  | 'conversationType'
  | 'i18n'
  | 'isMe'
  | 'phoneNumber'
> &
  Required<Pick<Props, 'sharedGroupNames'>> & {
    onClickMessageRequestWarning: () => void;
  }) => {
  const className = 'module-conversation-hero__membership';

  if (conversationType !== 'direct') {
    return null;
  }

  if (isMe) {
    return <div className={className}>{i18n('noteToSelfHero')}</div>;
  }

  if (sharedGroupNames.length > 0) {
    return (
      <div className={className}>
        <SharedGroupNames
          i18n={i18n}
          nameClassName={`${className}__name`}
          sharedGroupNames={sharedGroupNames}
        />
      </div>
    );
  }
  if (acceptedMessageRequest) {
    if (phoneNumber) {
      return null;
    }
    return <div className={className}>{i18n('no-groups-in-common')}</div>;
  }

  return (
    <div className="module-conversation-hero__message-request-warning">
      <div className="module-conversation-hero__message-request-warning__message">
        {i18n('no-groups-in-common-warning')}
      </div>
      <Button
        onClick={onClickMessageRequestWarning}
        size={ButtonSize.Small}
        variant={ButtonVariant.SecondaryAffirmative}
      >
        {i18n('MessageRequestWarning__learn-more')}
      </Button>
    </div>
  );
};

export const ConversationHero = ({
  i18n,
  about,
  acceptedMessageRequest,
  avatarPath,
  color,
  conversationType,
  groupDescription,
  isMe,
  membersCount,
  sharedGroupNames = [],
  name,
  phoneNumber,
  profileName,
  title,
  onHeightChange,
  unblurAvatar,
  unblurredAvatarPath,
  updateSharedGroups,
}: Props): JSX.Element => {
  const firstRenderRef = useRef(true);

  const previousHeightRef = useRef<undefined | number>();
  const [height, setHeight] = useState<undefined | number>();

  const [
    isShowingMessageRequestWarning,
    setIsShowingMessageRequestWarning,
  ] = useState(false);
  const closeMessageRequestWarning = () => {
    setIsShowingMessageRequestWarning(false);
  };

  useEffect(() => {
    // Kick off the expensive hydration of the current sharedGroupNames
    updateSharedGroups();
  }, [updateSharedGroups]);

  useEffect(() => {
    firstRenderRef.current = false;
  }, []);

  useEffect(() => {
    // We only want to kick off a "height change" when the height goes from number to
    //   number. We DON'T want to do it when we measure the height for the first time, as
    //   this will cause a re-render loop.
    const previousHeight = previousHeightRef.current;
    if (previousHeight && height && previousHeight !== height) {
      onHeightChange?.();
    }
  }, [height, onHeightChange]);

  useEffect(() => {
    previousHeightRef.current = height;
  }, [height]);

  let avatarBlur: AvatarBlur;
  let avatarOnClick: undefined | (() => void);
  if (
    shouldBlurAvatar({
      acceptedMessageRequest,
      avatarPath,
      isMe,
      sharedGroupNames,
      unblurredAvatarPath,
    })
  ) {
    avatarBlur = AvatarBlur.BlurPictureWithClickToView;
    avatarOnClick = unblurAvatar;
  } else {
    avatarBlur = AvatarBlur.NoBlur;
  }

  const phoneNumberOnly = Boolean(
    !name && !profileName && conversationType === 'direct'
  );

  /* eslint-disable no-nested-ternary */
  return (
    <>
      <Measure
        bounds
        onResize={({ bounds }) => {
          assert(bounds, 'We should be measuring the bounds');
          setHeight(bounds.height);
        }}
      >
        {({ measureRef }) => (
          <div className="module-conversation-hero" ref={measureRef}>
            <Avatar
              acceptedMessageRequest={acceptedMessageRequest}
              avatarPath={avatarPath}
              blur={avatarBlur}
              className="module-conversation-hero__avatar"
              color={color}
              conversationType={conversationType}
              i18n={i18n}
              isMe={isMe}
              name={name}
              noteToSelf={isMe}
              onClick={avatarOnClick}
              profileName={profileName}
              sharedGroupNames={sharedGroupNames}
              size={112}
              title={title}
            />
            <h1 className="module-conversation-hero__profile-name">
              {isMe ? (
                i18n('noteToSelf')
              ) : (
                <ContactName
                  title={title}
                  name={name}
                  profileName={profileName}
                  phoneNumber={phoneNumber}
                  i18n={i18n}
                />
              )}
            </h1>
            {about && !isMe && (
              <div className="module-about__container">
                <About text={about} />
              </div>
            )}
            {!isMe ? (
              <div className="module-conversation-hero__with">
                {groupDescription ? (
                  <GroupDescription
                    i18n={i18n}
                    title={title}
                    text={groupDescription}
                  />
                ) : membersCount === 1 ? (
                  i18n('ConversationHero--members-1')
                ) : membersCount !== undefined ? (
                  i18n('ConversationHero--members', [`${membersCount}`])
                ) : phoneNumberOnly ? null : (
                  phoneNumber
                )}
              </div>
            ) : null}
            {renderMembershipRow({
              acceptedMessageRequest,
              conversationType,
              i18n,
              isMe,
              onClickMessageRequestWarning() {
                setIsShowingMessageRequestWarning(true);
              },
              phoneNumber,
              sharedGroupNames,
            })}
          </div>
        )}
      </Measure>
      {isShowingMessageRequestWarning && (
        <ConfirmationDialog
          i18n={i18n}
          onClose={closeMessageRequestWarning}
          actions={[
            {
              text: i18n('MessageRequestWarning__dialog__learn-even-more'),
              action: () => {
                window.location.href =
                  'https://support.signal.org/hc/articles/360007459591';
                closeMessageRequestWarning();
              },
            },
          ]}
        >
          {i18n('MessageRequestWarning__dialog__details')}
        </ConfirmationDialog>
      )}
    </>
  );
  /* eslint-enable no-nested-ternary */
};
