// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Delta from 'quill-delta';
import type { RefObject } from 'react';
import type { MemberRepository } from '../memberRepository';

export const matchMention =
  (memberRepositoryRef: RefObject<MemberRepository>) =>
  (node: HTMLElement, delta: Delta): Delta => {
    const memberRepository = memberRepositoryRef.current;

    if (memberRepository) {
      const { title } = node.dataset;

      if (node.classList.contains('MessageBody__at-mention')) {
        const { id } = node.dataset;
        const conversation = memberRepository.getMemberById(id);

        if (conversation && conversation.uuid) {
          return new Delta().insert({
            mention: {
              title,
              uuid: conversation.uuid,
            },
          });
        }

        return new Delta().insert(`@${title}`);
      }

      if (node.classList.contains('mention-blot')) {
        const { uuid } = node.dataset;
        const conversation = memberRepository.getMemberByUuid(uuid);

        if (conversation && conversation.uuid) {
          return new Delta().insert({
            mention: {
              title: title || conversation.title,
              uuid: conversation.uuid,
            },
          });
        }

        return new Delta().insert(`@${title}`);
      }
    }

    return delta;
  };
