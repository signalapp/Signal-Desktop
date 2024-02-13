import classNames from 'classnames';
import { CSSProperties } from 'styled-components';

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
  compact?: boolean;
  shouldShowPubkey: boolean;
};

export const ContactName = (props: Props) => {
  const { pubkey, name, profileName, module, boldProfileName, compact, shouldShowPubkey } = props;
  const prefix = module || 'module-contact-name';

  const convoName = useNicknameOrProfileNameOrShortenedPubkey(pubkey);
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
      style={{ textOverflow: 'inherit' }}
    >
      {shouldShowProfile ? (
        <span style={styles as CSSProperties} className={`${prefix}__profile-name`}>
          <Emojify text={textProfile} sizeClass="small" isGroup={!isPrivate} />
        </span>
      ) : null}
      {shouldShowProfile ? ' ' : null}
      {shouldShowPubkey ? <span className={`${prefix}__profile-number`}>{pubkey}</span> : null}
    </span>
  );
};
