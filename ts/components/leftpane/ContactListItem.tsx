import classNames from 'classnames';
import { useConversationUsername, useIsMe, useIsPrivate } from '../../hooks/useParamSelector';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { Emojify } from '../conversation/Emojify';

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
  const isGroup = !useIsPrivate(pubkey);

  const title = name || pubkey;
  const displayName = isMe ? window.i18n('you') : title;

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
          <Emojify text={displayName} sizeClass="small" isGroup={isGroup} />
        </div>
      </div>
    </div>
  );
};
