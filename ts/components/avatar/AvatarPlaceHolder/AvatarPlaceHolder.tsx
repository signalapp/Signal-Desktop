import { useEffect, useState } from 'react';
import { getSodiumRenderer } from '../../../session/crypto';
import { allowOnlyOneAtATime } from '../../../session/utils/Promise';
import { toHex } from '../../../session/utils/String';
import { COLORS } from '../../../themes/constants/colors';
import { getInitials } from '../../../util/getInitials';
import { MemberAvatarPlaceHolder } from '../../icon/MemberAvatarPlaceHolder';

type Props = {
  diameter: number;
  name: string;
  pubkey: string;
  dataTestId?: string;
};

/** NOTE we use libsodium instead of crypto.subtle.digest because node:crypto.subtle.digest does not work the same way and we need to unit test this component */
const sha512FromPubkeyOneAtAtime = async (pubkey: string) => {
  return allowOnlyOneAtATime(`sha512FromPubkey-${pubkey}`, async () => {
    const sodium = await getSodiumRenderer();
    const buf = sodium.crypto_hash_sha512(pubkey);
    return toHex(buf);
  });
};

// do not do this on every avatar, just cache the values so we can reuse them across the app
// key is the pubkey, value is the hash
const cachedHashes = new Map<string, number>();

const avatarPlaceholderColors: Array<string> = Object.values(COLORS.PRIMARY);

function useHashBasedOnPubkey(pubkey: string) {
  const [hash, setHash] = useState<number | undefined>(undefined);
  const [loading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const cachedHash = cachedHashes.get(pubkey);

    if (cachedHash) {
      setHash(cachedHash);
      setIsLoading(false);
      return undefined;
    }
    setIsLoading(true);
    let isInProgress = true;

    if (!pubkey) {
      if (isInProgress) {
        setIsLoading(false);

        setHash(undefined);
      }
      return undefined;
    }

    // eslint-disable-next-line more/no-then
    void sha512FromPubkeyOneAtAtime(pubkey).then(sha => {
      if (isInProgress) {
        setIsLoading(false);
        // Generate the seed simulate the .hashCode as Java
        if (sha) {
          const hashed = parseInt(sha.substring(0, 12), 16) || 0;
          setHash(hashed);
          cachedHashes.set(pubkey, hashed);

          return;
        }
        setHash(undefined);
      }
    });
    return () => {
      isInProgress = false;
    };
  }, [pubkey]);

  return { loading, hash };
}

export const AvatarPlaceHolder = (props: Props) => {
  const { pubkey, diameter, name, dataTestId } = props;

  const { hash, loading } = useHashBasedOnPubkey(pubkey);

  const diameterWithoutBorder = diameter - 2;
  const viewBox = `0 0 ${diameter} ${diameter}`;
  const r = diameter / 2;
  const rWithoutBorder = diameterWithoutBorder / 2;

  if (loading || !hash) {
    // return avatar placeholder circle
    return <MemberAvatarPlaceHolder dataTestId={dataTestId} />;
  }

  const initials = getInitials(name);

  const fontSize = Math.floor(initials.length > 1 ? diameter * 0.4 : diameter * 0.5);

  const bgColorIndex = hash % avatarPlaceholderColors.length;

  const bgColor = avatarPlaceholderColors[bgColorIndex];

  return (
    <svg viewBox={viewBox} data-testid={dataTestId}>
      <g id="UrTavla">
        <circle
          cx={r}
          cy={r}
          r={rWithoutBorder}
          fill={bgColor}
          shapeRendering="geometricPrecision"
          stroke={'var(--avatar-border-color)'}
          strokeWidth="1"
        />
        <text
          fontSize={fontSize}
          x="50%"
          y="50%"
          fill="var(--white-color)"
          textAnchor="middle"
          stroke="var(--white-color)"
          strokeWidth={1}
          alignmentBaseline="central"
          height={fontSize}
        >
          {initials}
        </text>
      </g>
    </svg>
  );
};
