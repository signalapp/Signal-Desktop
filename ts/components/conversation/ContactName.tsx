import React from 'react';
import classNames from 'classnames';

import { Emojify } from './Emojify';
import { LocalizerType } from '../../types/Util';

interface Props {
  phoneNumber: string;
  name?: string;
  profileName?: string;
  i18n: LocalizerType;
  module?: string;
  boldProfileName?: Boolean;
  compact?: Boolean;
  shouldShowPubkey: Boolean;
}

export class ContactName extends React.Component<Props> {
  public render() {
    const {
      phoneNumber,
      name,
      profileName,
      i18n,
      module,
      boldProfileName,
      compact,
      shouldShowPubkey,
    } = this.props;
    const prefix = module ? module : 'module-contact-name';

    const title = name ? name : phoneNumber;
    const shouldShowProfile = Boolean(profileName || name);
    const styles = (boldProfileName
      ? {
          fontWeight: 'bold',
        }
      : {}) as React.CSSProperties;
    const textProfile = profileName || name || '';
    const profileElement = shouldShowProfile ? (
      <span style={styles} className={`${prefix}__profile-name`}>
        <Emojify text={textProfile} i18n={i18n} />
      </span>
    ) : null;

    const pubKeyElement = shouldShowPubkey ? (
      <span className={`${prefix}__profile-number`}>
        <Emojify text={title} i18n={i18n} />
      </span>
    ) : null;

    return (
      <span className={classNames(prefix, compact && 'compact')} dir="auto">
        {profileElement}
        {shouldShowProfile ? ' ' : null}
        {pubKeyElement}
      </span>
    );
  }
}
