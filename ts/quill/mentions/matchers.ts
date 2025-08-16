// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Delta } from '@signalapp/quill-cjs';
import type { RefObject } from 'react';

import { assertDev } from '../../util/assert';
import { isAciString } from '../../util/isAciString';
import type { MemberRepository } from '../memberRepository';
import type { Matcher } from '../util';

export const matchMention: (
  memberRepositoryRef: RefObject<MemberRepository>
) => Matcher =
  (memberRepositoryRef: RefObject<MemberRepository>) =>
  (node, delta, _scroll, attributes): Delta => {
    const memberRepository = memberRepositoryRef.current;

    if (memberRepository) {
      const { title } = node.dataset;

      if (node.classList.contains('MessageBody__at-mention')) {
        const { id } = node.dataset;
        const member = memberRepository.getMemberById(id);

        if (member && member.aci) {
          const { aci } = member;
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
        const member = memberRepository.getMemberByAci(aci);

        if (member && member.aci) {
          assertDev(member.aci === aci, 'Mentioned member has no ACI');
          return new Delta().insert(
            {
              mention: {
                title: title || member.title,
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
