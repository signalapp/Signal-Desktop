import React from 'react';
import { ConversationType } from '../state/ducks/conversations';
import { LocalizerType } from '../types/Util';
import { getPlaceholder } from '../util/safetyNumber';
import { Intl } from './Intl';

type SafetyNumberViewerProps = {
  contact?: ConversationType;
  generateSafetyNumber: (contact: ConversationType) => void;
  i18n: LocalizerType;
  onClose?: () => void;
  safetyNumber: string;
  safetyNumberChanged?: boolean;
  toggleVerified: (contact: ConversationType) => void;
  verificationDisabled: boolean;
};

export const SafetyNumberViewer = ({
  contact,
  generateSafetyNumber,
  i18n,
  onClose,
  safetyNumber,
  safetyNumberChanged,
  toggleVerified,
  verificationDisabled,
}: SafetyNumberViewerProps): JSX.Element | null => {
  if (!contact) {
    return null;
  }

  React.useEffect(() => {
    generateSafetyNumber(contact);
  }, [safetyNumber]);

  const showNumber = Boolean(contact.name || contact.profileName);
  const numberFragment = showNumber ? ` · ${contact.phoneNumber}` : '';
  const name = `${contact.title}${numberFragment}`;
  const boldName = (
    <span className="module-safety-number__bold-name">{name}</span>
  );

  const isVerified = contact.isVerified;
  const verifiedStatusKey = isVerified ? 'isVerified' : 'isNotVerified';
  const safetyNumberChangedKey = safetyNumberChanged
    ? 'changedRightAfterVerify'
    : 'yourSafetyNumberWith';
  const verifyButtonText = isVerified ? i18n('unverify') : i18n('verify');

  return (
    <div className="module-safety-number">
      {onClose && (
        <div className="module-safety-number__close-button">
          <button onClick={onClose} tabIndex={0}>
            <span />
          </button>
        </div>
      )}
      <div className="module-safety-number__verification-label">
        <Intl
          i18n={i18n}
          id={safetyNumberChangedKey}
          components={{
            name1: boldName,
            name2: boldName,
          }}
        />
      </div>
      <div className="module-safety-number__number">
        {safetyNumber || getPlaceholder()}
      </div>
      <Intl i18n={i18n} id="verifyHelp" components={[boldName]} />
      <div className="module-safety-number__verification-status">
        {isVerified ? (
          <span className="module-safety-number__icon--verified" />
        ) : (
          <span className="module-safety-number__icon--shield" />
        )}
        <Intl i18n={i18n} id={verifiedStatusKey} components={[boldName]} />
      </div>
      <div className="module-safety-number__verify-container">
        <button
          className="module-safety-number__button--verify"
          disabled={verificationDisabled}
          onClick={() => {
            toggleVerified(contact);
          }}
          tabIndex={0}
        >
          {verifyButtonText}
        </button>
      </div>
    </div>
  );
};
