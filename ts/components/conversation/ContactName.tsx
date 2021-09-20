import React from 'react';
import classNames from 'classnames';

import { Emojify } from './Emojify';

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

  const shouldShowProfile = Boolean(profileName || name);
  const styles = (boldProfileName
    ? {
        fontWeight: 'bold',
      }
    : {}) as React.CSSProperties;
  const textProfile = profileName || name || window.i18n('anonymous');
  const profileElement = shouldShowProfile ? (
    <span style={styles as any} className={`${prefix}__profile-name`}>
      <Emojify text={textProfile} />
    </span>
  ) : null;

  const pubKeyElement = shouldShowPubkey ? (
    <span className={`${prefix}__profile-number`}>
      <Emojify text={pubkey} />
    </span>
  ) : null;

  return (
    <span className={classNames(prefix, compact && 'compact')} dir="auto">
      {profileElement}
      {shouldShowProfile ? ' ' : null}
      {pubKeyElement}
    </span>
  );
};
