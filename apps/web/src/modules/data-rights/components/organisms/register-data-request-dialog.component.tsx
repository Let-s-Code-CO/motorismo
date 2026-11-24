'use client';

import { useRef, useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Radio,
  RadioGroup,
  Textarea,
} from '@heroui/react';
import { ShieldCheck } from 'lucide-react';

import { notify } from '@web/modules/core/lib/toast.lib';
import { registerDataRequest } from '@web/modules/data-rights/actions/data-rights.actions';
import { deadlineDays, registerSchema } from '@web/modules/data-rights/schemas/data-rights.schema';
import type { DataRightsErrorKey } from '@web/modules/data-rights/utils/data-rights-errors.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';

type RegisterDataRequestDialogProps = { customerId: string };

type Kind = 'inquiry' | 'correction' | 'erasure';
type Channel = 'counter' | 'instagram';

/**
 * The admin registers a data request a customer made at the counter or by Instagram (spec 017,
 * CA-16): what they asked (inquiry, correction or erasure), where it came from and what they said,
 * with the deadline it will have (RN-03).
 */
const RegisterDataRequestDialog = ({ customerId }: RegisterDataRequestDialogProps) => {
  const t = useTranslations('dataRights');
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('inquiry');
  const [channel, setChannel] = useState<Channel>('counter');
  const [description, setDescription] = useState('');
  const [descriptionError, setDescriptionError] = useState<string>();
  const [serverError, setServerError] = useState<DataRightsErrorKey>();
  const [isPending, startTransition] = useTransition();
  const opener = useRef<HTMLButtonElement>(null);

  const open = () => {
    setKind('inquiry');
    setChannel('counter');
    setDescription('');
    setDescriptionError(undefined);
    setServerError(undefined);
    setIsOpen(true);
  };

  const submit = () => {
    const parsed = registerSchema.safeParse({ kind, channel, description });
    if (!parsed.success) {
      const issue = parsed.error.issues.find((candidate) => candidate.path[0] === 'description');
      if (issue) setDescriptionError(t(`validation.${issue.message}`));
      return;
    }
    startTransition(async () => {
      const result = await callAction(() =>
        registerDataRequest({ customerId, kind, channel, description })
      );
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setIsOpen(false);
      notify({ tone: 'success', text: t('register.registered') });
      router.refresh();
    });
  };

  return (
    <>
      <Button
        ref={opener}
        variant="bordered"
        className="w-max font-medium"
        startContent={<ShieldCheck aria-hidden className="size-4" />}
        onPress={open}
      >
        {t('register.button')}
      </Button>
      <Modal
        isOpen={isOpen}
        onOpenChange={(isOpenNow) => !isOpenNow && setIsOpen(false)}
        placement="center"
        scrollBehavior="outside"
      >
        <ModalContent>
          <ModalHeader>{t('register.title')}</ModalHeader>
          <ModalBody className="gap-5">
            <RadioGroup
              label={t('register.kind')}
              value={kind}
              onValueChange={(value) => setKind(value as Kind)}
              description={t('register.deadline', { days: deadlineDays(kind) })}
            >
              {(['inquiry', 'correction', 'erasure'] as const).map((value) => (
                <Radio key={value} value={value}>
                  {t(`kinds.${value}`)}
                </Radio>
              ))}
            </RadioGroup>
            <RadioGroup
              label={t('register.channel')}
              orientation="horizontal"
              value={channel}
              onValueChange={(value) => setChannel(value as Channel)}
            >
              {(['counter', 'instagram'] as const).map((value) => (
                <Radio key={value} value={value}>
                  {t(`channels.${value}`)}
                </Radio>
              ))}
            </RadioGroup>
            <Textarea
              label={t('register.description')}
              placeholder={t('register.descriptionPlaceholder')}
              labelPlacement="outside"
              variant="bordered"
              value={description}
              onValueChange={(value) => {
                setDescription(value);
                setDescriptionError(undefined);
              }}
              isInvalid={!!descriptionError}
              errorMessage={descriptionError}
              maxLength={1000}
            />
          </ModalBody>
          <ModalFooter className="flex-col items-stretch gap-2">
            <div className="flex justify-end gap-2">
              <Button variant="light" onPress={() => setIsOpen(false)}>
                {t('register.cancel')}
              </Button>
              <Button
                color="primary"
                className="font-medium"
                isLoading={isPending}
                onPress={submit}
              >
                {t('register.submit')}
              </Button>
            </div>
            {serverError && (
              <p role="alert" className="text-right text-sm text-danger">
                {t(`errors.${serverError}`)}
              </p>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default RegisterDataRequestDialog;
