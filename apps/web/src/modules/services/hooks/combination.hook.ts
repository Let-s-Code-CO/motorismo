import { useTranslations } from 'next-intl';

import type { Unavailable } from '@web/modules/services/utils/service-combination.utils';

/**
 * Why a service cannot be chosen, in words (spec 024, CA-23 to CA-25): «Incluido en Premium», «Ya hay
 * un paquete: Premium» or «Se cruza con Premium».
 */
const useUnavailableReason = () => {
  const t = useTranslations('services.combination');
  return (unavailable: Unavailable | undefined) =>
    unavailable ? t(unavailable.reason, { name: unavailable.by }) : undefined;
};

export default useUnavailableReason;
