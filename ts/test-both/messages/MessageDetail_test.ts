import { assert } from 'chai';
import { formatDateTimeLong } from '../../util/timestamp';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

describe('switch between time formats, 12h and 24h', () => {
  const i18nMock = setupI18n('en', enMessages);
  const rawTimestamp = 1685329504961;
  it('should return 12h format', () => {
    assert.equal(
      formatDateTimeLong(i18nMock, rawTimestamp, true),
      'Yesterday 10:05 PM'
    );
  });

  it('should return 24h format', () => {
    assert.equal(
      formatDateTimeLong(i18nMock, rawTimestamp, false),
      new Date(rawTimestamp)
        .toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: false,
        })
        .split(', ')[2]
    );
  });
});
