// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactElement, useState } from 'react';

import { ReplacementValuesType } from '../../types/I18N';
import { FullJSXType, Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';
import { AddNewLines } from './AddNewLines';
import { Button, ButtonSize, ButtonVariant } from '../Button';

import { GroupV2ChangeType, GroupV2DescriptionChangeType } from '../../groups';

import { renderChange, SmartContactRendererType } from '../../groupChange';
import { Modal } from '../Modal';

import { AccessControlClass, MemberClass } from '../../textsecure.d';

export type PropsDataType = {
  groupName?: string;
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

export function GroupV2Change(props: PropsType): ReactElement {
  const {
    AccessControlEnum,
    change,
    groupName,
    i18n,
    ourConversationId,
    renderContact,
    RoleEnum,
  } = props;

  const [
    isGroupDescriptionDialogOpen,
    setIsGroupDescriptionDialogOpen,
  ] = useState<boolean>(false);

  const groupDescriptionChange = change.details.find(
    (item): item is GroupV2DescriptionChangeType =>
      Boolean(item.type === 'description' && item.description)
  );

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
      {groupDescriptionChange ? (
        <div className="module-group-v2-change--button-container">
          <Button
            size={ButtonSize.Small}
            variant={ButtonVariant.SecondaryAffirmative}
            onClick={() => setIsGroupDescriptionDialogOpen(true)}
          >
            {i18n('view')}
          </Button>
        </div>
      ) : null}
      {groupDescriptionChange && isGroupDescriptionDialogOpen ? (
        <Modal
          hasXButton
          i18n={i18n}
          title={groupName}
          onClose={() => setIsGroupDescriptionDialogOpen(false)}
        >
          <AddNewLines text={groupDescriptionChange.description} />
        </Modal>
      ) : null}
    </div>
  );
}
