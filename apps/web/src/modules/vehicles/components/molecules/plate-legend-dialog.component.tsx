'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react';

import { notify } from '@web/modules/core/lib/toast.lib';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { setPlateLegend } from '@web/modules/vehicles/actions/plate-cities.actions';
import PlateLabel from '@web/modules/vehicles/components/atoms/plate-label.component';
import { PLATE_SAMPLE } from '@web/modules/vehicles/constants/vehicle-options.constants';
import {
  PLATE_LEGEND_MAX,
  plateLegendSchema,
} from '@web/modules/vehicles/schemas/plate-legend.schema';
import type { PlateCity } from '@web/modules/vehicles/types/vehicles.types';
import type { PlateCitiesErrorKey } from '@web/modules/vehicles/utils/plate-cities-errors.utils';

type PlateLegendDialogProps = { city: PlateCity; onClose: () => void };

/**
 * The admin writes how a city's name reads on its plates (spec 023, CA-10): a sample plate shows the
 * legend as it is typed, in capitals. A legend that does not fit is refused by the field (RN-05); a
 * refusal of the database stays in the dialog (spec 013). Saved or cleared, a floating notice says it.
 */
const PlateLegendDialog = ({ city, onClose }: PlateLegendDialogProps) => {
  const t = useTranslations('vehicles.plateCities');
  const router = useRouter();
  const [legend, setLegend] = useState(city.plate_legend ?? '');
  const [fieldError, setFieldError] = useState<string>();
  const [serverError, setServerError] = useState<PlateCitiesErrorKey>();
  const [isPending, startTransition] = useTransition();
  const preview = legend.trim().toLocaleUpperCase('es-CO') || null;

  const send = (value: string) => {
    const parsed = plateLegendSchema.safeParse({ code: city.code, legend: value });
    if (!parsed.success) {
      setFieldError(t(`validation.${parsed.error.issues[0]?.message ?? 'legendInvalid'}`));
      return;
    }
    startTransition(async () => {
      // Through callAction: with no network, nothing happens (spec 006, CA-10).
      const result = await callAction(() => setPlateLegend({ code: city.code, legend: value }));
      if (!result) return;
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      onClose();
      notify({ tone: 'success', text: t(parsed.data.legend ? 'dialog.saved' : 'dialog.cleared') });
      router.refresh();
    });
  };

  return (
    <Modal
      isOpen
      onOpenChange={(isOpen) => !isOpen && onClose()}
      placement="center"
      scrollBehavior="outside"
    >
      <ModalContent>
        <ModalHeader>{t('dialog.title', { city: city.name })}</ModalHeader>
        <ModalBody className="gap-5">
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm text-default-500">{t('dialog.preview')}</span>
            <PlateLabel plate={PLATE_SAMPLE} city={city.name} legend={preview} />
          </div>
          <Input
            label={t('dialog.label')}
            labelPlacement="outside"
            placeholder=" "
            variant="bordered"
            description={t('dialog.hint', { max: PLATE_LEGEND_MAX })}
            value={legend}
            onValueChange={(value) => {
              setLegend(value);
              setFieldError(undefined);
              setServerError(undefined);
            }}
            onKeyDown={(event) => event.key === 'Enter' && send(legend)}
            classNames={{ input: 'uppercase' }}
            autoCapitalize="characters"
            autoComplete="off"
            isInvalid={!!fieldError}
            errorMessage={fieldError}
            autoFocus
          />
        </ModalBody>
        <ModalFooter className="flex-col items-stretch gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            {city.plate_legend && (
              <Button variant="light" className="mr-auto" onPress={() => send('')}>
                {t('dialog.clear')}
              </Button>
            )}
            <Button variant="light" onPress={onClose}>
              {t('dialog.cancel')}
            </Button>
            <Button
              color="primary"
              className="font-medium"
              isLoading={isPending}
              onPress={() => send(legend)}
            >
              {t('dialog.save')}
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
  );
};

export default PlateLegendDialog;
