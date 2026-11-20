'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Alert, Button } from '@heroui/react';
import { UserCheck, UserX } from 'lucide-react';

import { setCustomerDisabled } from '@web/modules/customers/actions/customers.actions';
import type { CustomersErrorKey } from '@web/modules/customers/utils/customers-errors.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';

type CustomerManageProps = {
  customer: {
    id: string;
    disabled_at: string | null;
  };
};

type Notice = { tone: 'success'; text: string } | { tone: 'danger'; error: CustomersErrorKey };

const CARD = 'rounded-large border border-divider bg-content1 p-5 shadow-small';

/**
 * Access to a customer's account (spec 004): staff — operator or admin — disable or reactivate the
 * customer (RN-09, CA-29, CA-30); the record is staff-only. Editing lives in the contact card (CA-27).
 */
const CustomerManage = ({ customer }: CustomerManageProps) => {
  const t = useTranslations('customers');
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>();
  const [isPending, startTransition] = useTransition();
  const isDisabled = customer.disabled_at !== null;

  const toggleAccess = () =>
    startTransition(async () => {
      const result = await callAction(() =>
        setCustomerDisabled({ id: customer.id, disabled: !isDisabled })
      );
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      setNotice(
        result.ok
          ? { tone: 'success', text: isDisabled ? t('reactivated') : t('disabledNotice') }
          : { tone: 'danger', error: result.error }
      );
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <Alert
          color={notice.tone}
          variant="faded"
          title={notice.tone === 'success' ? notice.text : t(`errors.${notice.error}`)}
        />
      )}

      <section className={`${CARD} flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{t('detail.accessTitle')}</h2>
          <p className="text-sm text-default-500">{t('detail.accessText')}</p>
        </div>
        <Button
          // Disabling is destructive, so it is a strong red call to action. danger-600, not the
          // default danger-500: white text on it keeps AA contrast (6.1:1 against 4.1:1).
          color={isDisabled ? 'primary' : 'danger'}
          variant="solid"
          className={
            isDisabled ? 'font-medium' : 'bg-danger-600 font-medium data-[hover=true]:bg-danger-700'
          }
          isLoading={isPending}
          startContent={
            isPending ? null : isDisabled ? (
              <UserCheck aria-hidden className="size-4" />
            ) : (
              <UserX aria-hidden className="size-4" />
            )
          }
          onPress={toggleAccess}
        >
          {isDisabled ? t('detail.reactivate') : t('detail.disable')}
        </Button>
      </section>
    </div>
  );
};

export default CustomerManage;
