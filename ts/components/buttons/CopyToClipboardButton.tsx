import { isEmpty } from 'lodash';
import { useState } from 'react';
import useCopyToClipboard from 'react-use/lib/useCopyToClipboard';
import { useHotkey } from '../../hooks/useHotkey';
import { ToastUtils } from '../../session/utils';
import { SessionButton, SessionButtonProps } from '../basic/SessionButton';
import { SessionIconButton } from '../icon';
import { SessionIconButtonProps } from '../icon/SessionIconButton';

type CopyProps = {
  copyContent?: string;
  onCopyComplete?: (copiedValue: string | undefined) => void;
  hotkey?: boolean;
};

type CopyToClipboardButtonProps = Omit<SessionButtonProps, 'children' | 'onClick'> & CopyProps;

export const CopyToClipboardButton = (props: CopyToClipboardButtonProps) => {
  const { copyContent, onCopyComplete, hotkey = false, text } = props;
  const [copied, setCopied] = useState(false);

  const [{ value }, copyToClipboard] = useCopyToClipboard();

  const onClick = () => {
    try {
      if (!copyContent && !text) {
        throw Error('Nothing to copy!');
      }

      if (copyContent) {
        copyToClipboard(copyContent);
      } else if (text) {
        copyToClipboard(text);
      }

      ToastUtils.pushCopiedToClipBoard();
      setCopied(true);
      if (onCopyComplete) {
        onCopyComplete(value);
      }
    } catch (err) {
      window.log.error('CopyToClipboard:', err);
    }
  };

  useHotkey('c', onClick, !hotkey);

  return (
    <SessionButton
      aria-label={'copy to clipboard button'}
      {...props}
      text={
        !isEmpty(text)
          ? text
          : copied
            ? window.i18n('copiedToClipboard')
            : window.i18n('editMenuCopy')
      }
      onClick={onClick}
    />
  );
};

type CopyToClipboardIconProps = Omit<SessionIconButtonProps, 'children' | 'onClick' | 'iconType'> &
  CopyProps;

export const CopyToClipboardIcon = (props: CopyToClipboardIconProps & { copyContent: string }) => {
  const { copyContent, onCopyComplete, hotkey = false } = props;
  const [{ value }, copyToClipboard] = useCopyToClipboard();

  const onClick = () => {
    copyToClipboard(copyContent);
    ToastUtils.pushCopiedToClipBoard();
    if (onCopyComplete) {
      onCopyComplete(value);
    }
  };

  useHotkey('c', onClick, !hotkey);

  return (
    <SessionIconButton
      aria-label={'copy to clipboard icon button'}
      padding="0"
      margin="0"
      {...props}
      iconType={'copy'}
      onClick={onClick}
    />
  );
};
