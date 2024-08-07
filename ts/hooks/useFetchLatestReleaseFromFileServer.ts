import { isEmpty } from 'lodash';
import { useSelector } from 'react-redux';
import useInterval from 'react-use/lib/useInterval';
import { fetchLatestRelease } from '../session/fetch_latest_release';
import { UserUtils } from '../session/utils';
import { getOurPrimaryConversation } from '../state/selectors/conversations';

export function useFetchLatestReleaseFromFileServer() {
  const ourPrimaryConversation = useSelector(getOurPrimaryConversation);

  useInterval(async () => {
    if (!ourPrimaryConversation) {
      return;
    }
    const userEd25519SecretKey = (await UserUtils.getUserED25519KeyPairBytes())?.privKeyBytes;
    if (userEd25519SecretKey && !isEmpty(userEd25519SecretKey)) {
      void fetchLatestRelease.fetchReleaseFromFSAndUpdateMain(userEd25519SecretKey);
    }
  }, fetchLatestRelease.fetchReleaseFromFileServerInterval);
}
