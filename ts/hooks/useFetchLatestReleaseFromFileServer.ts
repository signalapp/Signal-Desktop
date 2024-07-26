import { useSelector } from 'react-redux';
import useInterval from 'react-use/lib/useInterval';
import { getOurPrimaryConversation } from '../state/selectors/conversations';
import { fetchLatestRelease } from '../session/fetch_latest_release';

export function useFetchLatestReleaseFromFileServer() {
  const ourPrimaryConversation = useSelector(getOurPrimaryConversation);

  useInterval(() => {
    if (!ourPrimaryConversation) {
      return;
    }
    void fetchLatestRelease.fetchReleaseFromFSAndUpdateMain();
  }, fetchLatestRelease.fetchReleaseFromFileServerInterval);
}
