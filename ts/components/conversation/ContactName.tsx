import React from 'react';

import { Emojify } from './Emojify';
import { LocalizerType } from '../../types/Util';

export interface Props {
  title: string;
  phoneNumber?: string;
  name?: string;
  profileName?: string;
  module?: string;
  i18n: LocalizerType;
}

export class ContactName extends React.Component<Props> {
  public render() {
    const { module, title } = this.props;
    const prefix = module ? module : 'module-contact-name';

    return (
      <span className={prefix} dir="auto">
        <Emojify text={title || ''} />
      </span>
    );
  }
}
