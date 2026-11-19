/**
 * Login and set-password schemas (spec 002).
 *
 * Errors are message KEYS (translated in the form). Guards RN-04: passwords have at least 8
 * characters, and the confirmation must match so a typo cannot lock the user out.
 */
import { forgotPasswordSchema } from '@web/modules/auth/schemas/forgot-password.schema';
import { loginSchema } from '@web/modules/auth/schemas/login.schema';
import { setPasswordSchema } from '@web/modules/auth/schemas/set-password.schema';

const issuesOf = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => (result.error?.issues ?? []).map(({ path, message }) => [path.join('.'), message]);

describe('loginSchema', () => {
  it('accepts an email and a password, normalising the email (trimmed, lowercase)', () => {
    expect(loginSchema.parse({ email: '  Ana@Motorismo.TEST ', password: 'x' })).toEqual({
      email: 'ana@motorismo.test',
      password: 'x',
    });
  });

  it('rejects an invalid email and an empty password', () => {
    expect(issuesOf(loginSchema.safeParse({ email: 'ana', password: '' }))).toEqual([
      ['email', 'emailInvalid'],
      ['password', 'passwordRequired'],
    ]);
  });
});

describe('setPasswordSchema', () => {
  it('accepts a password of exactly 8 characters confirmed correctly (RN-04 boundary)', () => {
    expect(setPasswordSchema.safeParse({ password: '12345678', confirm: '12345678' }).success).toBe(
      true
    );
  });

  it('rejects a password of 7 characters (RN-04)', () => {
    expect(
      issuesOf(setPasswordSchema.safeParse({ password: '1234567', confirm: '1234567' }))
    ).toEqual([['password', 'passwordTooShort']]);
  });

  it('rejects a confirmation that does not match, on the confirmation field', () => {
    expect(
      issuesOf(setPasswordSchema.safeParse({ password: '12345678', confirm: '12345679' }))
    ).toEqual([['confirm', 'passwordsDoNotMatch']]);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts and normalises an email', () => {
    expect(forgotPasswordSchema.parse({ email: ' Ana@Motorismo.TEST ' })).toEqual({
      email: 'ana@motorismo.test',
    });
  });

  it('rejects an invalid email', () => {
    expect(issuesOf(forgotPasswordSchema.safeParse({ email: 'ana@' }))).toEqual([
      ['email', 'emailInvalid'],
    ]);
  });
});
