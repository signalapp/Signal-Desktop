import { isEmpty } from 'lodash';
import { useState } from 'react';
import { useCopyToClipboard } from 'react-use';
import { ToastUtils } from '../../session/utils';
import { SessionButton, SessionButtonProps } from '../basic/SessionButton';

type Props = Omit<SessionButtonProps, 'children' | 'onClick'> & {
  copyContent: string;
  onCopyComplete?: (copiedValue: string | undefined) => void;
  className?: string;
};

export const CopyToClipboardButton = (props: Props) => {
  const { className, copyContent, onCopyComplete, text } = props;
  const [copied, setCopied] = useState(false);

  const [{ value }, copyToClipboard] = useCopyToClipboard();

  return (
    <SessionButton
      {...props}
      className={className}
      text={
        !isEmpty(text)
          ? text
          : copied
            ? window.i18n('copiedToClipboard')
            : window.i18n('editMenuCopy')
      }
      onClick={() => {
        copyToClipboard(copyContent);
        ToastUtils.pushCopiedToClipBoard();
        setCopied(true);
        if (onCopyComplete) {
          onCopyComplete(value);
        }
      }}
    />
  );
};
