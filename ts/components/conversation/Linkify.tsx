import React from 'react';

import LinkifyIt from 'linkify-it';

import { RenderTextCallbackType } from '../../types/Util';
import { isLinkSneaky } from '../../../js/modules/link_previews';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { shell } from 'electron';
import { MessageInteraction } from '../../interactions';
import { useDispatch } from 'react-redux';

const linkify = LinkifyIt();

type Props = {
  text: string;
  /** Allows you to customize now non-links are rendered. Simplest is just a <span>. */
  renderNonLink?: RenderTextCallbackType;
  isGroup: boolean;
};

const SUPPORTED_PROTOCOLS = /^(http|https):/i;

const defaultRenderNonLink = ({ text }: { text: string }) => <>{text}</>;

export const Linkify = (props: Props): JSX.Element => {
  const { text, isGroup, renderNonLink } = props;
  const results: Array<any> = [];
  let count = 1;
  const dispatch = useDispatch();
  const matchData = linkify.match(text) || [];
  let last = 0;
  // disable click on <a> elements so clicking a message containing a link doesn't
  // select the message.The link will still be opened in the browser.
  const handleClick = (e: any) => {
    e.preventDefault();
    e.stopPropagation();

    const url = e.target.href;

    const openLink = () => {
      void shell.openExternal(url);
    };

    dispatch(
      updateConfirmModal({
        title: window.i18n('linkVisitWarningTitle'),
        message: window.i18n('linkVisitWarningMessage', url),
        okText: window.i18n('open'),
        cancelText: window.i18n('editMenuCopy'),
        showExitIcon: true,
        onClickOk: openLink,
        onClickClose: () => {
          dispatch(updateConfirmModal(null));
        },

        onClickCancel: () => {
          MessageInteraction.copyBodyToClipboard(url);
        },
      })
    );
  };

  const renderWith = renderNonLink || defaultRenderNonLink;

  if (matchData.length === 0) {
    return renderWith({ text, key: 0, isGroup });
  }

  matchData.forEach((match: { index: number; url: string; lastIndex: number; text: string }) => {
    if (last < match.index) {
      const textWithNoLink = text.slice(last, match.index);
      results.push(renderWith({ text: textWithNoLink, isGroup, key: count++ }));
    }

    const { url, text: originalText } = match;
    const isLink = SUPPORTED_PROTOCOLS.test(url) && !isLinkSneaky(url);
    if (isLink) {
      results.push(
        <a key={count++} href={url} onClick={handleClick}>
          {originalText}
        </a>
      );
    } else {
      results.push(renderWith({ text: originalText, isGroup, key: count++ }));
    }

    last = match.lastIndex;
  });

  if (last < text.length) {
    results.push(renderWith({ text: text.slice(last), isGroup, key: count++ }));
  }

  return <>{results}</>;
};
