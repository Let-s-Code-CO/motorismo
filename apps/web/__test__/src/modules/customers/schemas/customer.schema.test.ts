/**
 * Customer schemas (spec 004).
 *
 * newCustomerSchema — staff register a customer at the counter (HU-06): name required, email and
 * phone optional but at least one of them (RN-02), each valid if given, and the customer's consent
 * must be confirmed (RN-04, CA-25). editCustomerSchema — the same without the consent (CA-27).
 *
 * myProfileSchema — what a customer may change about themselves (HU-03): name (required,
 * ≤ 120 characters) and an optional Colombian mobile (RN-03), stored as 10 digits; an empty phone
 * removes it. The email is not part of it (RN-10). Errors are message KEYS under
 * `customers.validation`.
 */
import {
  editCustomerSchema,
  myProfileSchema,
  newCustomerSchema,
} from '@web/modules/customers/schemas/customer.schema';

const issuesOf = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => (result.error?.issues ?? []).map(({ path, message }) => [path.join('.'), message]);

describe('myProfileSchema', () => {
  it('accepts a name and a phone, trimming the name and normalising the phone (CA-13)', () => {
    expect(
      myProfileSchema.parse({ full_name: '  José Pérez ', phone: '+57 311 222 3344' })
    ).toEqual({
      full_name: 'José Pérez',
      phone: '3112223344',
    });
  });

  it('turns an empty phone into null, so saving removes it', () => {
    expect(myProfileSchema.parse({ full_name: 'José', phone: ' ' })).toEqual({
      full_name: 'José',
      phone: null,
    });
  });

  it('rejects an empty name and an invalid phone, each on its field (CA-14)', () => {
    expect(issuesOf(myProfileSchema.safeParse({ full_name: '', phone: '6012345678' }))).toEqual([
      ['full_name', 'fullNameRequired'],
      ['phone', 'phoneInvalid'],
    ]);
  });

  it('accepts what the form already normalised (null = no phone), as the server receives it', () => {
    expect(myProfileSchema.parse({ full_name: 'José', phone: null })).toEqual({
      full_name: 'José',
      phone: null,
    });
  });

  it('ignores any email sent along: the customer cannot change it (RN-10)', () => {
    expect(
      myProfileSchema.parse({ full_name: 'José', phone: '', email: 'otro@correo.test' })
    ).not.toHaveProperty('email');
  });
});

describe('newCustomerSchema', () => {
  const build = (overrides: Record<string, unknown> = {}) => ({
    full_name: 'Marta Mostrador',
    email: '',
    phone: '312 000 1111',
    data_consent: true,
    ...overrides,
  });

  it('accepts a name and a phone only, without email (CA-24, RN-02)', () => {
    expect(newCustomerSchema.parse(build())).toEqual({
      full_name: 'Marta Mostrador',
      email: null,
      phone: '3120001111',
      data_consent: true,
    });
  });

  it('accepts an email only, normalised (trimmed, lowercase)', () => {
    expect(
      newCustomerSchema.parse(build({ email: ' Marta@Correo.TEST ', phone: '' }))
    ).toMatchObject({ email: 'marta@correo.test', phone: null });
  });

  it('accepts what the form already normalised (null email), as the server receives it (CA-24)', () => {
    expect(newCustomerSchema.parse(build({ email: null, phone: '3120001111' }))).toMatchObject({
      email: null,
      phone: '3120001111',
    });
  });

  it('requires at least an email or a phone (RN-02, CA-25)', () => {
    expect(issuesOf(newCustomerSchema.safeParse(build({ email: ' ', phone: '' })))).toEqual([
      ['email', 'contactRequired'],
    ]);
  });

  it('reports every invalid field, consent included (CA-25)', () => {
    expect(
      issuesOf(
        newCustomerSchema.safeParse(
          build({ full_name: '', email: 'marta', phone: '123', data_consent: false })
        )
      )
    ).toEqual([
      ['full_name', 'fullNameRequired'],
      ['email', 'emailInvalid'],
      ['phone', 'phoneInvalid'],
      ['data_consent', 'consentRequired'],
    ]);
  });
});

describe('editCustomerSchema', () => {
  it('accepts the contact data without asking for consent again (CA-27)', () => {
    expect(
      editCustomerSchema.parse({ full_name: 'Marta M.', email: 'marta@correo.test', phone: '' })
    ).toEqual({ full_name: 'Marta M.', email: 'marta@correo.test', phone: null });
  });

  it('still requires an email or a phone (RN-02)', () => {
    expect(
      issuesOf(editCustomerSchema.safeParse({ full_name: 'Marta', email: '', phone: '' }))
    ).toEqual([['email', 'contactRequired']]);
  });
});
