import React from 'react';
import { ConversationType } from '../state/ducks/conversations';
import { LocalizerType } from '../types/Util';
import { getPlaceholder } from '../util/safetyNumber';

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

  const name = contact.title;
  const isVerified = contact.isVerified;
  const verifiedStatus = isVerified
    ? i18n('isVerified', [name])
    : i18n('isNotVerified', [name]);
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
        {safetyNumberChanged
          ? i18n('changedRightAfterVerify', [name, name])
          : i18n('yourSafetyNumberWith', [name])}
      </div>
      <div className="module-safety-number__number">
        {safetyNumber || getPlaceholder()}
      </div>
      {i18n('verifyHelp', [name])}
      <div className="module-safety-number__verification-status">
        {isVerified ? (
          <span className="module-safety-number__icon--verified" />
        ) : (
          <span className="module-safety-number__icon--shield" />
        )}
        {verifiedStatus}
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
