// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';
import { LocalizerType } from '../types/Util';
import { ConversationType } from '../state/ducks/conversations';
import { Avatar } from './Avatar';

export type ActionSpec = {
  text: string;
  action: () => unknown;
  style?: 'affirmative' | 'negative';
};

type CallbackType = () => unknown;

export type DataPropsType = {
  readonly droppedMembers: Array<ConversationType>;
  readonly hasMigrated: boolean;
  readonly invitedMembers: Array<ConversationType>;
  readonly learnMore: CallbackType;
  readonly migrate: CallbackType;
  readonly onClose: CallbackType;
};

export type HousekeepingPropsType = {
  readonly i18n: LocalizerType;
};

export type PropsType = DataPropsType & HousekeepingPropsType;

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

export const GroupV1MigrationDialog = React.memo((props: PropsType) => {
  const {
    droppedMembers,
    hasMigrated,
    i18n,
    invitedMembers,
    learnMore,
    migrate,
    onClose,
  } = props;

  const title = hasMigrated
    ? i18n('GroupV1--Migration--info--title')
    : i18n('GroupV1--Migration--migrate--title');
  const keepHistory = hasMigrated
    ? i18n('GroupV1--Migration--info--keep-history')
    : i18n('GroupV1--Migration--migrate--keep-history');
  const migrationKey = hasMigrated ? 'after' : 'before';
  const droppedMembersKey = `GroupV1--Migration--info--removed--${migrationKey}`;

  return (
    <div className="module-group-v2-migration-dialog">
      <button
        aria-label={i18n('close')}
        type="button"
        className="module-group-v2-migration-dialog__close-button"
        onClick={onClose}
      />
      <div className="module-group-v2-migration-dialog__title">{title}</div>
      <div className="module-group-v2-migration-dialog__scrollable">
        <div className="module-group-v2-migration-dialog__item">
          <div className="module-group-v2-migration-dialog__item__bullet" />
          <div className="module-group-v2-migration-dialog__item__content">
            {i18n('GroupV1--Migration--info--summary')}
          </div>
        </div>
        <div className="module-group-v2-migration-dialog__item">
          <div className="module-group-v2-migration-dialog__item__bullet" />
          <div className="module-group-v2-migration-dialog__item__content">
            {keepHistory}
          </div>
        </div>
        {renderMembers(
          invitedMembers,
          'GroupV1--Migration--info--invited',
          i18n
        )}
        {renderMembers(droppedMembers, droppedMembersKey, i18n)}
      </div>
      {renderButtons(hasMigrated, onClose, learnMore, migrate, i18n)}
    </div>
  );
});

function renderButtons(
  hasMigrated: boolean,
  onClose: CallbackType,
  learnMore: CallbackType,
  migrate: CallbackType,
  i18n: LocalizerType
) {
  if (hasMigrated) {
    return (
      <div
        className={classNames(
          'module-group-v2-migration-dialog__buttons',
          'module-group-v2-migration-dialog__buttons--narrow'
        )}
      >
        <button
          className="module-group-v2-migration-dialog__button"
          ref={focusRef}
          type="button"
          onClick={onClose}
        >
          {i18n('Confirmation--confirm')}
        </button>
      </div>
    );
  }

  return (
    <div className="module-group-v2-migration-dialog__buttons">
      <button
        className={classNames(
          'module-group-v2-migration-dialog__button',
          'module-group-v2-migration-dialog__button--secondary'
        )}
        type="button"
        onClick={learnMore}
      >
        {i18n('GroupV1--Migration--learn-more')}
      </button>
      <button
        className="module-group-v2-migration-dialog__button"
        ref={focusRef}
        type="button"
        onClick={migrate}
      >
        {i18n('GroupV1--Migration--migrate')}
      </button>
    </div>
  );
}

function renderMembers(
  members: Array<ConversationType>,
  prefix: string,
  i18n: LocalizerType
): React.ReactElement | null {
  if (!members.length) {
    return null;
  }

  const postfix = members.length === 1 ? '--one' : '--many';
  const key = `${prefix}${postfix}`;

  return (
    <div className="module-group-v2-migration-dialog__item">
      <div className="module-group-v2-migration-dialog__item__bullet" />
      <div className="module-group-v2-migration-dialog__item__content">
        <div>{i18n(key)}</div>
        {members.map(member => (
          <div
            key={member.id}
            className="module-group-v2-migration-dialog__member"
          >
            <Avatar
              {...member}
              conversationType={member.type}
              size={28}
              i18n={i18n}
            />{' '}
            <span className="module-group-v2-migration-dialog__member__name">
              {member.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
