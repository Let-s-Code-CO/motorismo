'use client';

import { useId, useState } from 'react';

import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Alert, Button, Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react';
import { Archive, ChevronDown, Pencil, Plus } from 'lucide-react';

import type { VehicleView } from '@web/modules/vehicles/api/vehicles.server';
import VehicleSummary, {
  vehicleName,
} from '@web/modules/vehicles/components/molecules/vehicle-summary.component';
import RetireVehicleModal from '@web/modules/vehicles/components/organisms/retire-vehicle-modal.component';
import VehicleForm from '@web/modules/vehicles/components/organisms/vehicle-form.component';
import type { VehiclesAudience } from '@web/modules/vehicles/types/vehicles.types';

type VehiclesSectionProps = {
  customerId: string;
  /** Staff on a customer record, or the customer in "Mi perfil" (texts in second person). */
  audience: VehiclesAudience;
  /** Active vehicles, newest first (CA-04). */
  vehicles: VehicleView[];
  /** Retired vehicles, shown to staff only (RF-06). */
  retired: VehicleView[];
  /** The customer is disabled: their vehicles are read-only (spec assumption). */
  readOnly: boolean;
};

/** What the form dialog is doing: adding a vehicle, or correcting one. */
type Editing = { mode: 'add' } | { mode: 'edit'; vehicle: VehicleView } | null;

/**
 * The vehicles of a customer (spec 005): on the customer record for staff (CA-01) and as "Mis
 * vehículos" in "Mi perfil" (CA-23). Lists the active vehicles, adds, corrects (CA-20) and retires
 * them (CA-21); staff also see the retired ones apart, without actions (CA-22, RF-06).
 */
const VehiclesSection = ({
  customerId,
  audience,
  vehicles,
  retired,
  readOnly,
}: VehiclesSectionProps) => {
  const t = useTranslations('vehicles');
  const format = useFormatter();
  const router = useRouter();
  const titleId = useId();
  const retiredId = useId();
  const [editing, setEditing] = useState<Editing>(null);
  const [retiring, setRetiring] = useState<{ id: string; name: string } | null>(null);
  const [showRetired, setShowRetired] = useState(false);
  const [notice, setNotice] = useState<string>();
  const isOwn = audience === 'customer';

  const done = (message: string) => {
    setNotice(message);
    router.refresh();
  };

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-large border border-divider bg-content1 p-5 shadow-small"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-base font-semibold tracking-tight">
            {isOwn ? t('section.titleOwn') : t('section.title')}
          </h2>
          <p className="text-sm text-default-500">
            {isOwn ? t('section.descriptionOwn') : t('section.description')}
          </p>
        </div>
        {!readOnly && (
          <Button
            color="primary"
            className="font-medium"
            startContent={<Plus aria-hidden className="size-4" />}
            onPress={() => {
              setNotice(undefined);
              setEditing({ mode: 'add' });
            }}
          >
            {t('section.add')}
          </Button>
        )}
      </div>

      {notice && <Alert color="success" variant="faded" title={notice} />}
      {readOnly && <p className="text-sm text-default-500">{t('section.readOnly')}</p>}

      {vehicles.length === 0 ? (
        <p className="rounded-medium border border-dashed border-default-300 p-4 text-center text-sm text-default-500">
          {isOwn ? t('section.emptyOwn') : t('section.empty')}
        </p>
      ) : (
        <ul aria-labelledby={titleId} className="flex flex-col divide-y divide-divider">
          {vehicles.map((vehicle) => {
            const name = vehicleName(vehicle);
            return (
              <li
                key={vehicle.id}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <VehicleSummary vehicle={vehicle} />
                </div>
                {!readOnly && (
                  <div className="flex shrink-0 gap-1 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="light"
                      aria-label={t('section.editLabel', { vehicle: name })}
                      startContent={<Pencil aria-hidden className="size-3.5" />}
                      onPress={() => {
                        setNotice(undefined);
                        setEditing({ mode: 'edit', vehicle });
                      }}
                    >
                      {t('section.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      // Destructive, but a secondary action in a list: red text and icon, no red
                      // background. danger-600 keeps AA contrast on white (6.1:1).
                      className="text-danger-600 data-[hover=true]:bg-danger-50"
                      aria-label={t('section.retireLabel', { vehicle: name })}
                      startContent={<Archive aria-hidden className="size-3.5" />}
                      onPress={() => {
                        setNotice(undefined);
                        setRetiring({ id: vehicle.id, name });
                      }}
                    >
                      {t('section.retire')}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!isOwn && retired.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-divider pt-3">
          <Button
            variant="light"
            size="sm"
            className="w-max text-default-600"
            aria-expanded={showRetired}
            aria-controls={retiredId}
            endContent={
              <ChevronDown
                aria-hidden
                className={`size-4 transition-transform ${showRetired ? 'rotate-180' : ''}`}
              />
            }
            onPress={() => setShowRetired((shown) => !shown)}
          >
            {t('section.retiredTitle', { count: retired.length })}
          </Button>
          {showRetired && (
            <ul
              id={retiredId}
              aria-label={t('section.retiredTitle', { count: retired.length })}
              className="flex flex-col divide-y divide-divider"
            >
              {retired.map((vehicle) => (
                <li key={vehicle.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <VehicleSummary vehicle={vehicle} />
                  <span className="pl-13 text-xs text-default-500">
                    {t('section.retiredOn', {
                      date: format.dateTime(new Date(vehicle.retired_at ?? ''), {
                        dateStyle: 'long',
                      }),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal
        isOpen={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        size="xl"
        // The form's drop-downs are drawn inside the modal (accessibility); "outside" scrolls the
        // whole overlay instead of the card, so an open list can extend past the card unclipped.
        scrollBehavior="outside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                {editing?.mode === 'edit' ? t('form.titleEdit') : t('form.titleNew')}
              </ModalHeader>
              <ModalBody className="pb-6">
                <VehicleForm
                  customerId={customerId}
                  vehicle={editing?.mode === 'edit' ? editing.vehicle : undefined}
                  onCancel={onClose}
                  onSaved={() => {
                    const wasEditing = editing?.mode === 'edit';
                    onClose();
                    done(wasEditing ? t('section.updated') : t('section.added'));
                  }}
                />
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      <RetireVehicleModal
        vehicle={retiring}
        audience={audience}
        onClose={() => setRetiring(null)}
        onRetired={() => {
          setRetiring(null);
          done(t('section.retiredNotice'));
        }}
      />
    </section>
  );
};

export default VehiclesSection;
