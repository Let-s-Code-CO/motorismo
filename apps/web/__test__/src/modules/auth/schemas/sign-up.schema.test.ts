/**
 * signUpSchema — the customer sign-up form (spec 004, HU-01).
 *
 * Guards CA-06: name required (≤ 120 characters, like the database), valid email (normalised:
 * trimmed, lowercase), phone optional but a Colombian mobile if given (RN-03, stored as 10 digits),
 * password of at least 8 characters (RN-05), and the data-processing consent is mandatory (RN-04).
 * Errors are message KEYS under `auth.validation`.
 */
import { signUpSchema } from '@web/modules/auth/schemas/sign-up.schema';

const issuesOf = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => (result.error?.issues ?? []).map(({ path, message }) => [path.join('.'), message]);

const build = (overrides: Record<string, unknown> = {}) => ({
  full_name: 'Camila Cliente',
  email: 'camila@correo.test',
  phone: '',
  password: '12345678',
  data_consent: true,
  ...overrides,
});

describe('signUpSchema', () => {
  it('accepts a complete sign-up, normalising email and phone', () => {
    expect(
      signUpSchema.parse(
        build({ full_name: '  Camila  ', email: ' Camila@Correo.TEST ', phone: '+57 300 123 4567' })
      )
    ).toEqual({
      full_name: 'Camila',
      email: 'camila@correo.test',
      phone: '3001234567',
      password: '12345678',
      data_consent: true,
    });
  });

  it('treats an empty phone as no phone (it is optional)', () => {
    expect(signUpSchema.parse(build({ phone: '   ' })).phone).toBeUndefined();
  });

  it('accepts a password of exactly 8 characters (RN-05 boundary)', () => {
    expect(signUpSchema.safeParse(build({ password: '12345678' })).success).toBe(true);
  });

  it('accepts a name of exactly 120 characters and rejects 121', () => {
    expect(signUpSchema.safeParse(build({ full_name: 'a'.repeat(120) })).success).toBe(true);
    expect(issuesOf(signUpSchema.safeParse(build({ full_name: 'a'.repeat(121) })))).toEqual([
      ['full_name', 'fullNameTooLong'],
    ]);
  });

  it('reports every invalid field with its own message (CA-06)', () => {
    expect(
      issuesOf(
        signUpSchema.safeParse(
          build({
            full_name: ' ',
            email: 'camila',
            phone: '12345',
            password: '1234567',
            data_consent: false,
          })
        )
      )
    ).toEqual([
      ['full_name', 'fullNameRequired'],
      ['email', 'emailInvalid'],
      ['phone', 'phoneInvalid'],
      ['password', 'passwordTooShort'],
      ['data_consent', 'consentRequired'],
    ]);
  });

  it('requires the consent to be explicitly given (RN-04)', () => {
    expect(issuesOf(signUpSchema.safeParse(build({ data_consent: undefined })))).toEqual([
      ['data_consent', 'consentRequired'],
    ]);
  });
});
