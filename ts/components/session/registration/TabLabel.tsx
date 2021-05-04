import classNames from 'classnames';
import React from 'react';

export enum TabType {
  SignUp,
  SignIn,
}

export const TabLabel = ({
  isSelected,
  onSelect,
  type,
}: {
  isSelected: boolean;
  onSelect?: (event: TabType) => void;
  type: TabType;
}) => {
  const handleClick = onSelect
    ? () => {
        onSelect(type);
      }
    : undefined;

  const label = type === TabType.SignUp ? window.i18n('createAccount') : window.i18n('signIn');

  return (
    <div
      className={classNames(
        'session-registration__tab',
        isSelected ? 'session-registration__tab--active' : null
      )}
      onClick={handleClick}
      role="tab"
    >
      {label}
    </div>
  );
};
