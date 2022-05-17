import React from 'react';
import classNames from 'classnames';

import { Emojify } from './Emojify';
import { useConversationUsernameOrShorten, useIsPrivate } from '../../hooks/useParamSelector';

type Props = {
  pubkey: string;
  name?: string | null;
  profileName?: string | null;
  module?: string;
  boldProfileName?: Boolean;
  compact?: Boolean;
  shouldShowPubkey: Boolean;
};

export const ContactName = (props: Props) => {
  const { pubkey, name, profileName, module, boldProfileName, compact, shouldShowPubkey } = props;
  const prefix = module ? module : 'module-contact-name';

  const convoName = useConversationUsernameOrShorten(pubkey);
  const isPrivate = useIsPrivate(pubkey);
  const shouldShowProfile = Boolean(convoName || profileName || name);
  const styles = (boldProfileName
    ? {
        fontWeight: 'bold',
      }
    : {}) as React.CSSProperties;
  const textProfile = profileName || name || convoName || window.i18n('anonymous');

  return (
    <span
      className={classNames(prefix, compact && 'compact')}
      dir="auto"
      data-testid={`${prefix}__profile-name`}
    >
      {shouldShowProfile ? (
        <span style={styles as any} className={`${prefix}__profile-name`}>
          <Emojify text={textProfile} sizeClass="small" isGroup={!isPrivate} />
        </span>
      ) : null}
      {shouldShowProfile ? ' ' : null}
      {shouldShowPubkey ? <span className={`${prefix}__profile-number`}>{pubkey}</span> : null}
    </span>
  );
};
