/**
 * inviteUserSchema — what an admin must provide to invite someone (spec 002, CA-13).
 *
 * Name (1–120 characters after trimming, mirroring the database check), a valid email (stored
 * lowercase: emails are unique regardless of case, RN-02) and one of the two roles (RF-02).
 */
import { inviteUserSchema } from '@web/modules/users/schemas/invite-user.schema';

const issuesOf = (input: unknown) =>
  (inviteUserSchema.safeParse(input).error?.issues ?? []).map(({ path, message }) => [
    path.join('.'),
    message,
  ]);

const valid = { full_name: 'Óscar Operador', email: 'oscar@motorismo.test', role: 'operator' };

describe('inviteUserSchema', () => {
  it('accepts a valid invitation and normalises name and email', () => {
    expect(
      inviteUserSchema.parse({
        ...valid,
        full_name: '  Óscar Operador ',
        email: ' Oscar@Motorismo.TEST ',
      })
    ).toEqual({ full_name: 'Óscar Operador', email: 'oscar@motorismo.test', role: 'operator' });
  });

  it.each(['operator', 'admin'])('accepts the %s role', (role) => {
    expect(inviteUserSchema.safeParse({ ...valid, role }).success).toBe(true);
  });

  it('reports every missing field at once, each on its own field (CA-13)', () => {
    expect(issuesOf({ full_name: '', email: '', role: undefined })).toEqual([
      ['full_name', 'fullNameRequired'],
      ['email', 'emailInvalid'],
      ['role', 'roleRequired'],
    ]);
  });

  it('treats a name made only of spaces as missing', () => {
    expect(issuesOf({ ...valid, full_name: '   ' })).toEqual([['full_name', 'fullNameRequired']]);
  });

  it('accepts 120 characters and rejects 121 (same limit as the database)', () => {
    expect(issuesOf({ ...valid, full_name: 'a'.repeat(120) })).toEqual([]);
    expect(issuesOf({ ...valid, full_name: 'a'.repeat(121) })).toEqual([
      ['full_name', 'fullNameTooLong'],
    ]);
  });

  it('rejects an email without a valid format (CA-13)', () => {
    expect(issuesOf({ ...valid, email: 'oscar@' })).toEqual([['email', 'emailInvalid']]);
  });

  it('rejects an unknown role', () => {
    expect(issuesOf({ ...valid, role: 'boss' })).toEqual([['role', 'roleRequired']]);
  });
});
