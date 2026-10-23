// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useMemo, type ReactNode } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import type { DonationReceipt } from '../types/Donations.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { AxoBrand } from '../axo/AxoBrand.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { getDateTimeFormatter } from '../util/formatTimestamp.dom.ts';
import {
  getHumanDonationAmount,
  toHumanCurrencyString,
} from '../util/currency.dom.ts';
import { AxoList } from '../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../axo/items/AxoItem.dom.tsx';
import { AxoTextItem } from '../axo/items/AxoTextItem.dom.tsx';

export type DonationsReceiptDetailsDialogProps = Readonly<{
  i18n: LocalizerType;
  receipt: DonationReceipt;
  downloading: boolean;
  onDownload: () => void;
  onClose: () => void;
}>;

export function DonationsReceiptDetailsDialog(
  props: DonationsReceiptDetailsDialogProps
): ReactNode {
  const { i18n, receipt, onClose } = props;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose]
  );

  const amount = useMemo(() => {
    return toHumanCurrencyString({
      amount: getHumanDonationAmount(receipt),
      currency: receipt.currencyType,
    });
  }, [receipt]);

  const datePaid = useMemo(() => {
    const dateFormatter = getDateTimeFormatter({
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return dateFormatter.format(new Date(receipt.timestamp));
  }, [receipt.timestamp]);

  return (
    <AxoDialog.Root open onOpenChange={handleOpenChange}>
      <AxoDialog.Content
        size="sm"
        escape="cancel-is-noop"
        disableMissingAriaDescriptionWarning
      >
        <AxoDialog.Header floating>
          <AxoDialog.Title>
            {i18n('icu:DonationReceipt__title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body padding="md">
          <div className={tw('mt-2 flex justify-center')}>
            <AxoBrand.LogoAndWordMark maxWidth={100} />
          </div>
          <p
            className={tw(
              'my-5 text-center text-primary',
              'text-[40px] leading-none',
              'select-text'
            )}
          >
            {amount}
          </p>
          <AxoList.Group>
            <AxoList.Body>
              <AxoItem.Group>
                <AxoTextItem.Root
                  label={i18n(
                    'icu:PreferencesDonations__ReceiptModal--type-label'
                  )}
                  value={i18n('icu:DonationReceipt__type-value--one-time')}
                />
                <AxoTextItem.Root
                  label={i18n(
                    'icu:PreferencesDonations__ReceiptModal--date-paid-label'
                  )}
                  value={
                    <span
                      className={tw('-m-2.5 inline-block p-2.5 select-text')}
                    >
                      {datePaid}
                    </span>
                  }
                />
              </AxoItem.Group>
            </AxoList.Body>
          </AxoList.Group>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="strong-primary"
              pending={props.downloading}
              onClick={props.onDownload}
            >
              {i18n('icu:PreferencesDonations__ReceiptModal--download')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
