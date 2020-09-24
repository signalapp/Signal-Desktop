import React from 'react';
import Tooltip from 'react-tooltip-lite';

import { LocalizerType } from '../types/Util';

type PropsType = {
  i18n: LocalizerType;
};

export const InContactsIcon = (props: PropsType): JSX.Element => {
  const { i18n } = props;

  /* eslint-disable jsx-a11y/no-noninteractive-tabindex */
  return (
    <Tooltip
      tagName="span"
      direction="bottom"
      className="module-in-contacts-icon__tooltip"
      arrowSize={8}
      content={i18n('contactInAddressBook')}
      distance={13}
      hoverDelay={0}
    >
      <span
        tabIndex={0}
        role="img"
        aria-label={i18n('contactInAddressBook')}
        className="module-in-contacts-icon__icon"
      />
    </Tooltip>
  );
  /* eslint-enable jsx-a11y/no-noninteractive-tabindex */
};
