'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Alert, Button } from '@heroui/react';
import { Pencil, UserCheck, UserX } from 'lucide-react';

import { setCustomerDisabled } from '@web/modules/customers/actions/customers.actions';
import CustomerForm from '@web/modules/customers/components/organisms/customer-form.component';
import type { CustomersErrorKey } from '@web/modules/customers/utils/customers-errors.utils';

type CustomerManageProps = {
  customer: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    user_id: string | null;
    disabled_at: string | null;
  };
  /** Only an admin disables or reactivates (RN-09, CA-31). */
  isAdmin: boolean;
};

type Notice = { tone: 'success'; text: string } | { tone: 'danger'; error: CustomersErrorKey };

const CARD = 'rounded-large border border-divider bg-content1 p-5 shadow-small';

/**
 * What staff can do on a customer record (spec 004): edit the data (CA-27) and, for an admin
 * only, disable or reactivate the customer (CA-29, CA-30, CA-31).
 */
const CustomerManage = ({ customer, isAdmin }: CustomerManageProps) => {
  const t = useTranslations('customers');
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const [isPending, startTransition] = useTransition();
  const isDisabled = customer.disabled_at !== null;

  const toggleAccess = () =>
    startTransition(async () => {
      const result = await setCustomerDisabled({ id: customer.id, disabled: !isDisabled });
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

      <section className={CARD}>
        {isEditing ? (
          <CustomerForm
            mode="edit"
            customerId={customer.id}
            defaults={customer}
            emailLocked={customer.user_id !== null}
            onCancel={() => setIsEditing(false)}
            onSaved={() => {
              setIsEditing(false);
              setNotice({ tone: 'success', text: t('updated') });
              router.refresh();
            }}
          />
        ) : (
          <Button
            variant="flat"
            startContent={<Pencil aria-hidden className="size-4" />}
            onPress={() => {
              setNotice(undefined);
              setIsEditing(true);
            }}
          >
            {t('detail.edit')}
          </Button>
        )}
      </section>

      {isAdmin && (
        <section className={`${CARD} flex flex-wrap items-center justify-between gap-4`}>
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold">{t('detail.accessTitle')}</h2>
            <p className="text-sm text-default-500">{t('detail.accessText')}</p>
          </div>
          <Button
            // Neutral, not red: semantic colours are for statuses only (and keep AA contrast).
            color={isDisabled ? 'primary' : 'default'}
            variant={isDisabled ? 'solid' : 'bordered'}
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
      )}
    </div>
  );
};

export default CustomerManage;
