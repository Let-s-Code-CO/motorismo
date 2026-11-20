/**
 * callAction — every call from a screen to a Server Action goes through it (spec 006, CA-10).
 *
 * When the network drops just as something is sent, the browser rejects the request with a
 * TypeError. Left alone, that error would reach an error boundary and unmount the form, losing
 * what the person typed. callAction catches only that case: it turns the app offline (so the
 * "Sin conexión" notice shows) and returns null, which the screen reads as "nothing happened": no
 * success is reported and the form stays as it was (RN-01: nothing is queued to send later).
 *
 * Guards: the result passes through untouched; each browser's wording of a network failure
 * counts (Chrome, Safari, Firefox); any other error is not swallowed.
 */
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { markOffline } from '@web/modules/pwa/utils/connection.lib';

vi.mock('@web/modules/pwa/utils/connection.lib', () => ({ markOffline: vi.fn() }));

describe('callAction', () => {
  afterEach(() => vi.clearAllMocks());

  it("returns the action's result untouched when it reaches the server", async () => {
    const result = { ok: false, error: 'email_taken' };

    await expect(callAction(async () => result)).resolves.toBe(result);
    expect(markOffline).not.toHaveBeenCalled();
  });

  it.each([
    ['Chrome', 'Failed to fetch'],
    ['Safari', 'Load failed'],
    ['Firefox', 'NetworkError when attempting to fetch resource.'],
  ])(
    'returns null and turns the app offline when %s cannot reach the server (CA-10)',
    async (_, message) => {
      await expect(
        callAction(async () => {
          throw new TypeError(message);
        })
      ).resolves.toBeNull();
      expect(markOffline).toHaveBeenCalledTimes(1);
    }
  );

  it('lets any other error through, without turning the app offline', async () => {
    const bug = new TypeError("Cannot read properties of undefined (reading 'id')");

    await expect(
      callAction(async () => {
        throw bug;
      })
    ).rejects.toBe(bug);
    expect(markOffline).not.toHaveBeenCalled();
  });
});
