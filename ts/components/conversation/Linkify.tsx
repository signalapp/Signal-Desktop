// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import LinkifyIt from 'linkify-it';

import type { RenderTextCallbackType } from '../../types/Util';
import { isLinkSneaky, shouldLinkifyMessage } from '../../types/LinkPreview';
import { splitByEmoji } from '../../util/emoji';
import { missingCaseError } from '../../util/missingCaseError';

export const linkify = new LinkifyIt()
  // This is all TLDs in place in 2010, according to [IANA's root zone database][0]
  //   except for those domains marked as [a test domain][1].
  //
  // Note that this only applies to "fuzzy" matches (`example.com`), not matches with
  //   protocols (`https://example.com`). See [this GitHub comment][2] for more.
  //
  // [0]: https://www.iana.org/domains/root/db
  // [1]: https://www.iana.org/domains/reserved
  // [2]: https://github.com/signalapp/Signal-Desktop/issues/4538#issuecomment-748368590
  .tlds([
    'ac',
    'ad',
    'ae',
    'aero',
    'af',
    'ag',
    'ai',
    'al',
    'am',
    'an',
    'ao',
    'aq',
    'ar',
    'arpa',
    'as',
    'asia',
    'at',
    'au',
    'aw',
    'ax',
    'az',
    'ba',
    'bb',
    'bd',
    'be',
    'bf',
    'bg',
    'bh',
    'bi',
    'biz',
    'bj',
    'bl',
    'bm',
    'bn',
    'bo',
    'bq',
    'br',
    'bs',
    'bt',
    'bv',
    'bw',
    'by',
    'bz',
    'ca',
    'cat',
    'cc',
    'cd',
    'cf',
    'cg',
    'ch',
    'ci',
    'ck',
    'cl',
    'cm',
    'cn',
    'co',
    'com',
    'coop',
    'cr',
    'cu',
    'cv',
    'cw',
    'cx',
    'cy',
    'cz',
    'de',
    'dj',
    'dk',
    'dm',
    'do',
    'dz',
    'ec',
    'edu',
    'ee',
    'eg',
    'er',
    'es',
    'et',
    'eu',
    'fi',
    'fj',
    'fk',
    'fm',
    'fo',
    'fr',
    'ga',
    'gb',
    'gd',
    'ge',
    'gf',
    'gg',
    'gh',
    'gi',
    'gl',
    'gm',
    'gn',
    'gov',
    'gp',
    'gq',
    'gr',
    'gs',
    'gt',
    'gu',
    'gw',
    'gy',
    'hk',
    'hm',
    'hn',
    'hr',
    'ht',
    'hu',
    'id',
    'ie',
    'il',
    'im',
    'in',
    'info',
    'int',
    'io',
    'iq',
    'ir',
    'is',
    'it',
    'je',
    'jm',
    'jo',
    'jobs',
    'jp',
    'ke',
    'kg',
    'kh',
    'ki',
    'km',
    'kn',
    'kp',
    'kr',
    'kw',
    'ky',
    'kz',
    'la',
    'lb',
    'lc',
    'li',
    'lk',
    'lr',
    'ls',
    'lt',
    'lu',
    'lv',
    'ly',
    'ma',
    'mc',
    'md',
    'me',
    'mf',
    'mg',
    'mh',
    'mil',
    'mk',
    'ml',
    'mm',
    'mn',
    'mo',
    'mobi',
    'mp',
    'mq',
    'mr',
    'ms',
    'mt',
    'mu',
    'museum',
    'mv',
    'mw',
    'mx',
    'my',
    'mz',
    'na',
    'name',
    'nc',
    'ne',
    'net',
    'nf',
    'ng',
    'ni',
    'nl',
    'no',
    'np',
    'nr',
    'nu',
    'nz',
    'om',
    'org',
    'pa',
    'pe',
    'pf',
    'pg',
    'ph',
    'pk',
    'pl',
    'pm',
    'pn',
    'pr',
    'pro',
    'ps',
    'pt',
    'pw',
    'py',
    'qa',
    're',
    'ro',
    'rs',
    'ru',
    'rw',
    'sa',
    'sb',
    'sc',
    'sd',
    'se',
    'sg',
    'sh',
    'si',
    'sj',
    'sk',
    'sl',
    'sm',
    'sn',
    'so',
    'sr',
    'st',
    'su',
    'sv',
    'sx',
    'sy',
    'sz',
    'tc',
    'td',
    'tel',
    'tf',
    'tg',
    'th',
    'tj',
    'tk',
    'tl',
    'tm',
    'tn',
    'to',
    'tp',
    'tr',
    'travel',
    'tt',
    'tv',
    'tw',
    'tz',
    'ua',
    'ug',
    'uk',
    'um',
    'us',
    'uy',
    'uz',
    'va',
    'vc',
    've',
    'vg',
    'vi',
    'vn',
    'vu',
    'wf',
    'ws',
    '中国',
    '中國',
    'ලංකා',
    '香港',
    '台湾',
    '台灣',
    'امارات',
    'الاردن',
    'السعودية',
    'ไทย',
    'рф',
    'تونس',
    'مصر',
    'قطر',
    'இலங்கை',
    'فلسطين',
    'ye',
    'yt',
    'za',
    'zm',
    'zw',
  ]);

export type Props = {
  text: string;
  /** Allows you to customize how non-links are rendered. Simplest is just a <span>. */
  renderNonLink?: RenderTextCallbackType;
};

export const SUPPORTED_PROTOCOLS = /^(http|https):/i;

const defaultRenderNonLink: RenderTextCallbackType = ({ text }) => text;

export function Linkify(props: Props): JSX.Element {
  const { text, renderNonLink = defaultRenderNonLink } = props;

  if (!shouldLinkifyMessage(text)) {
    return <>{renderNonLink({ text, key: 1 })}</>;
  }

  const chunkData: Array<{
    chunk: string;
    matchData: ReadonlyArray<LinkifyIt.Match>;
  }> = splitByEmoji(text).map(({ type, value: chunk }) => {
    if (type === 'text') {
      return { chunk, matchData: linkify.match(chunk) || [] };
    }

    if (type === 'emoji') {
      return { chunk, matchData: [] };
    }

    throw missingCaseError(type);
  });

  const results: Array<JSX.Element | string> = [];
  let count = 1;

  chunkData.forEach(({ chunk, matchData }) => {
    if (matchData.length === 0) {
      count += 1;
      results.push(renderNonLink({ text: chunk, key: count }));
      return;
    }

    let chunkLastIndex = 0;
    matchData.forEach(match => {
      if (chunkLastIndex < match.index) {
        const textWithNoLink = chunk.slice(chunkLastIndex, match.index);
        count += 1;
        results.push(renderNonLink({ text: textWithNoLink, key: count }));
      }

      const { url, text: originalText } = match;
      count += 1;
      if (SUPPORTED_PROTOCOLS.test(url) && !isLinkSneaky(url)) {
        results.push(
          <a key={count} href={url}>
            {originalText}
          </a>
        );
      } else {
        results.push(renderNonLink({ text: originalText, key: count }));
      }

      chunkLastIndex = match.lastIndex;
    });

    if (chunkLastIndex < chunk.length) {
      count += 1;
      results.push(
        renderNonLink({
          text: chunk.slice(chunkLastIndex),
          key: count,
        })
      );
    }
  });

  return <>{results}</>;
}
