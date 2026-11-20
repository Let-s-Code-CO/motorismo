/**
 * ConfirmDialog — asks before an action that changes what others see (spec 007, CA-12: disabling
 * a service or an employee asks first).
 *
 * Guards: it shows the question and its consequence; «Cancelar» closes without acting; the
 * confirming button runs the action and is drawn as destructive (solid red, CLAUDE.md rule).
 */
import { fireEvent, screen } from '@testing-library/react';

import ConfirmDialog from '@web/modules/core/components/confirm-dialog.component';

import { renderWithProviders } from '@tests/test-utils/render';

const renderDialog = () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  renderWithProviders(
    <ConfirmDialog
      isOpen
      title="¿Desactivar «Polichado»?"
      description="Dejará de ofrecerse en las órdenes nuevas."
      confirmLabel="Desactivar"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
  return { onConfirm, onCancel };
};

describe('ConfirmDialog', () => {
  it('asks the question and explains the consequence', async () => {
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: /¿Desactivar «Polichado»?/ });
    expect(dialog).toHaveTextContent('Dejará de ofrecerse en las órdenes nuevas.');
  });

  it('runs the action only when confirmed, with a destructive button', async () => {
    const { onConfirm, onCancel } = renderDialog();

    const confirm = await screen.findByRole('button', { name: 'Desactivar' });
    expect(confirm).toHaveClass('bg-danger-600');
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('«Cancelar» closes without acting', async () => {
    const { onConfirm, onCancel } = renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
