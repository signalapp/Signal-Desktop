import * as React from 'react';

import { ReplacementValuesType } from '../../types/I18N';
import { FullJSXType, Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';

import { GroupV2ChangeType } from '../../groups';

import { renderChange, SmartContactRendererType } from '../../groupChange';

import { AccessControlClass, MemberClass } from '../../textsecure.d';

export type PropsDataType = {
  ourConversationId: string;
  change: GroupV2ChangeType;
  AccessControlEnum: typeof AccessControlClass.AccessRequired;
  RoleEnum: typeof MemberClass.Role;
};

export type PropsHousekeepingType = {
  i18n: LocalizerType;
  renderContact: SmartContactRendererType;
};

export type PropsType = PropsDataType & PropsHousekeepingType;

function renderStringToIntl(
  id: string,
  i18n: LocalizerType,
  components?: Array<FullJSXType> | ReplacementValuesType<FullJSXType>
): FullJSXType {
  return <Intl id={id} i18n={i18n} components={components} />;
}

export function GroupV2Change(props: PropsType): React.ReactElement {
  const {
    AccessControlEnum,
    change,
    i18n,
    ourConversationId,
    renderContact,
    RoleEnum,
  } = props;

  return (
    <div className="module-group-v2-change">
      <div className="module-group-v2-change--icon" />
      {renderChange(change, {
        AccessControlEnum,
        i18n,
        ourConversationId,
        renderContact,
        renderString: renderStringToIntl,
        RoleEnum,
      }).map((item: FullJSXType, index: number) => (
        // Difficult to find a unique key for this type
        // eslint-disable-next-line react/no-array-index-key
        <div key={index}>{item}</div>
      ))}
    </div>
  );
}
