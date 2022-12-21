// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';

import type { Props as MessageDetailProps } from '../../components/conversation/MessageDetail';
import { MessageDetail } from '../../components/conversation/MessageDetail';

import { mapDispatchToProps } from '../actions';
import type { StateType } from '../reducer';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { getIntl, getInteractionMode, getTheme } from '../selectors/user';
import { renderAudioAttachment } from './renderAudioAttachment';
import { getContactNameColorSelector } from '../selectors/conversations';
import type { MinimalPropsForMessageDetails } from '../../models/messages';

export { Contact } from '../../components/conversation/MessageDetail';
export type PropsWithExtraFunctions = MinimalPropsForMessageDetails &
  Pick<
    MessageDetailProps,
    | 'contactNameColor'
    | 'getPreferredBadge'
    | 'i18n'
    | 'interactionMode'
    | 'renderAudioAttachment'
    | 'theme'
  >;

const mapStateToProps = (
  state: StateType,
  props: MinimalPropsForMessageDetails
): PropsWithExtraFunctions => {
  const { contacts, errors, message, receivedAt, sentAt } = props;

  const contactNameColor =
    message.conversationType === 'group'
      ? getContactNameColorSelector(state)(
          message.conversationId,
          message.author.id
        )
      : undefined;

  const getPreferredBadge = getPreferredBadgeSelector(state);

  return {
    contacts,
    contactNameColor,
    errors,
    message,
    receivedAt,
    sentAt,

    getPreferredBadge,
    i18n: getIntl(state),
    interactionMode: getInteractionMode(state),
    theme: getTheme(state),

    renderAudioAttachment,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartMessageDetail = smart(MessageDetail);
