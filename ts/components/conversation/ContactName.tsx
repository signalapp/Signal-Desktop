import classNames from 'classnames';
import { CSSProperties } from 'react';

import {
  useIsPrivate,
  useNicknameOrProfileNameOrShortenedPubkey,
} from '../../hooks/useParamSelector';
import { Emojify } from './Emojify';

type Props = {
  pubkey: string;
  name?: string | null;
  profileName?: string | null;
  module?: string;
  boldProfileName?: boolean;
  shouldShowPubkey: boolean;
};

export const ContactName = (props: Props) => {
  const { pubkey, name, profileName, module, boldProfileName, shouldShowPubkey } = props;
  const prefix = module || 'module-contact-name';

  const convoName = useNicknameOrProfileNameOrShortenedPubkey(pubkey);
  const isPrivate = useIsPrivate(pubkey);
  const shouldShowProfile = Boolean(convoName || profileName || name);

  const commonStyles = {
    'min-width': 0,
    'text-overflow': 'ellipsis',
    overflow: 'hidden',
  } as CSSProperties;

  const styles = (
    boldProfileName
      ? {
          fontWeight: 'bold',
          ...commonStyles,
        }
      : commonStyles
  ) as CSSProperties;
  const textProfile = profileName || name || convoName || window.i18n('anonymous');

  return (
    <span
      className={classNames(prefix)}
      dir="auto"
      data-testid={`${prefix}__profile-name`}
      style={{
        textOverflow: 'inherit',
        display: 'flex',
        flexDirection: 'row',
        gap: 'var(--margins-xs)',
      }}
    >
      {shouldShowProfile ? (
        <div style={styles} className={`${prefix}__profile-name`}>
          <Emojify text={textProfile} sizeClass="small" isGroup={!isPrivate} />
        </div>
      ) : null}
      {shouldShowPubkey ? <div className={`${prefix}__profile-number`}>{pubkey}</div> : null}
    </span>
  );
};
