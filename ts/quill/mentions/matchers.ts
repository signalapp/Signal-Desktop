// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Delta from 'quill-delta';
import type { RefObject } from 'react';
import type { Matcher, AttributeMap } from 'quill';

import { assertDev } from '../../util/assert';
import { isAciString } from '../../types/ServiceId';
import type { MemberRepository } from '../memberRepository';

export const matchMention: (
  memberRepositoryRef: RefObject<MemberRepository>
) => Matcher =
  (memberRepositoryRef: RefObject<MemberRepository>) =>
  (node: HTMLElement, delta: Delta, attributes: AttributeMap): Delta => {
    const memberRepository = memberRepositoryRef.current;

    if (memberRepository) {
      const { title } = node.dataset;

      if (node.classList.contains('MessageBody__at-mention')) {
        const { id } = node.dataset;
        const conversation = memberRepository.getMemberById(id);

        if (conversation && conversation.serviceId) {
          const { serviceId: aci } = conversation;
          assertDev(isAciString(aci), 'Mentioned conversation has no ACI');
          return new Delta().insert(
            {
              mention: {
                title,
                aci,
              },
            },
            attributes
          );
        }

        return new Delta().insert(`@${title}`, attributes);
      }

      if (node.classList.contains('mention-blot')) {
        const { aci } = node.dataset;
        assertDev(isAciString(aci), 'Mentioned blot has invalid ACI');
        const conversation = memberRepository.getMemberByServiceId(aci);

        if (conversation && conversation.serviceId) {
          assertDev(
            conversation.serviceId === aci,
            'Mentioned conversation has no ACI'
          );
          return new Delta().insert(
            {
              mention: {
                title: title || conversation.title,
                aci,
              },
            },
            attributes
          );
        }

        return new Delta().insert(`@${title}`, attributes);
      }
    }

    return delta;
  };
