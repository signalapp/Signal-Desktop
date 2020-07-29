import React from 'react';

import { LocalizerType } from '../../types/Util';
import { Emojify } from './Emojify';

export interface PropsType {
  i18n: LocalizerType;
  title: string;
  module?: string;
  name?: string;
  phoneNumber?: string;
  profileName?: string;
}

export class ContactName extends React.Component<PropsType> {
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
