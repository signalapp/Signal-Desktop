import React from 'react';
import classNames from 'classnames';

import { Avatar, AvatarSize } from './Avatar';
import { Emojify } from './conversation/Emojify';
import { useConversationUsername, useIsMe } from '../hooks/useParamSelector';

type Props = {
  pubkey: string;
  onClick?: () => void;
};

const AvatarItem = (props: { pubkey: string }) => {
  const { pubkey } = props;

  return <Avatar size={AvatarSize.S} pubkey={pubkey} />;
};

export const ContactListItem = (props: Props) => {
  const { onClick, pubkey } = props;

  const name = useConversationUsername(pubkey);
  const isMe = useIsMe(pubkey);

  const title = name ? name : pubkey;
  const displayName = isMe ? window.i18n('me') : title;

  return (
    <div
      role="button"
      onClick={onClick}
      className={classNames(
        'module-contact-list-item',
        onClick ? 'module-contact-list-item--with-click-handler' : null
      )}
    >
      <AvatarItem pubkey={pubkey} />
      <div className="module-contact-list-item__text">
        <div className="module-contact-list-item__text__name">
          <Emojify text={displayName} />
        </div>
      </div>
    </div>
  );
};
