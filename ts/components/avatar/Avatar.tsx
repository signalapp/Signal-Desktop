import classNames from 'classnames';
import { isEqual } from 'lodash';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { useDisableDrag } from '../../hooks/useDisableDrag';
import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';
import {
  useAvatarPath,
  useConversationUsername,
  useIsClosedGroup,
} from '../../hooks/useParamSelector';
import { isMessageSelectionMode } from '../../state/selectors/conversations';
import { SessionIcon } from '../icon';
import { AvatarPlaceHolder } from './AvatarPlaceHolder/AvatarPlaceHolder';
import { ClosedGroupAvatar } from './AvatarPlaceHolder/ClosedGroupAvatar';

export enum AvatarSize {
  XS = 28,
  S = 36,
  M = 48,
  L = 64,
  XL = 80,
  HUGE = 300,
}

type Props = {
  forcedAvatarPath?: string | null;
  forcedName?: string;
  pubkey: string;
  size: AvatarSize;
  base64Data?: string; // if this is not empty, it will be used to render the avatar with base64 encoded data
  onAvatarClick?: () => void;
  dataTestId?: string;
};

const Identicon = (props: Pick<Props, 'forcedName' | 'pubkey' | 'size'>) => {
  const { size, forcedName, pubkey } = props;
  const displayName = useConversationUsername(pubkey);
  const userName = forcedName || displayName || '0';

  return <AvatarPlaceHolder diameter={size} name={userName} pubkey={pubkey} />;
};

const CrownWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  bottom: 11%;
  right: 11%;
  height: 18px;
  width: 18px;
  transform: translate(20%, 20%); // getting over 23% creates a glitch
  color: #f7c347;
  background: var(--background-primary-color);
  border-radius: 50%;
`;

export const CrownIcon = () => {
  return (
    <CrownWrapper>
      <SessionIcon iconSize={'small'} iconType="crown" iconPadding="1px 0 0 0 " />
    </CrownWrapper>
  );
};

const NoImage = React.memo(
  (
    props: Pick<Props, 'forcedName' | 'size' | 'pubkey' | 'onAvatarClick'> & {
      isClosedGroup: boolean;
    }
  ) => {
    const { forcedName, size, pubkey, isClosedGroup, onAvatarClick } = props;
    // if no image but we have conversations set for the group, renders group members avatars
    if (pubkey && isClosedGroup) {
      return <ClosedGroupAvatar size={size} convoId={pubkey} onAvatarClick={onAvatarClick} />;
    }

    return <Identicon size={size} forcedName={forcedName} pubkey={pubkey} />;
  }
);

const AvatarImage = (
  props: Pick<Props, 'base64Data' | 'dataTestId'> & {
    avatarPath?: string;
    name?: string; // display name, profileName or pubkey, whatever is set first
    imageBroken: boolean;
    handleImageError: () => any;
  }
) => {
  const { avatarPath, base64Data, imageBroken, dataTestId, handleImageError } = props;

  const disableDrag = useDisableDrag();

  if ((!avatarPath && !base64Data) || imageBroken) {
    return null;
  }
  const dataToDisplay = base64Data ? `data:image/jpeg;base64,${base64Data}` : avatarPath;

  return (
    <img
      onError={handleImageError}
      onDragStart={disableDrag}
      src={dataToDisplay}
      data-testid={dataTestId}
    />
  );
};

const AvatarInner = (props: Props) => {
  const { base64Data, size, pubkey, forcedAvatarPath, forcedName, dataTestId, onAvatarClick } =
    props;
  const [imageBroken, setImageBroken] = useState(false);

  const isSelectingMessages = useSelector(isMessageSelectionMode);

  const isClosedGroup = useIsClosedGroup(pubkey);
  const avatarPath = useAvatarPath(pubkey);
  const name = useConversationUsername(pubkey);
  // contentType is not important
  const { urlToLoad } = useEncryptedFileFetch(forcedAvatarPath || avatarPath || '', '', true);
  const handleImageError = () => {
    window.log.warn(
      'Avatar: Image failed to load; failing over to placeholder',
      urlToLoad,
      forcedAvatarPath || avatarPath
    );
    setImageBroken(true);
  };

  const hasImage = (base64Data || urlToLoad) && !imageBroken && !isClosedGroup;

  const isClickable = !!onAvatarClick;
  return (
    <div
      className={classNames(
        'module-avatar',
        `module-avatar--${size}`,
        hasImage ? 'module-avatar--with-image' : 'module-avatar--no-image',
        isClickable && 'module-avatar-clickable'
      )}
      onClick={e => {
        if (isSelectingMessages) {
          // we could toggle the selection of this message,
          // but this just disable opening the new Conversation dialog with that user while selecting messages
          return;
        }
        if (props.onAvatarClick) {
          e.stopPropagation();
          e.preventDefault();
          props.onAvatarClick?.();
        }
      }}
      role="button"
      data-testid={dataTestId}
    >
      {hasImage ? (
        <AvatarImage
          avatarPath={urlToLoad}
          base64Data={base64Data}
          imageBroken={imageBroken}
          name={forcedName || name}
          handleImageError={handleImageError}
          dataTestId={dataTestId ? `img-${dataTestId}` : undefined}
        />
      ) : (
        <NoImage
          pubkey={pubkey}
          isClosedGroup={isClosedGroup}
          size={size}
          forcedName={forcedName}
          onAvatarClick={onAvatarClick}
        />
      )}
    </div>
  );
};

export const Avatar = React.memo(AvatarInner, isEqual);
