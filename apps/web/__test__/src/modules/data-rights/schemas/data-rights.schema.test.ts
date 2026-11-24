/**
 * data-rights.schema — what a customer and the admin write about a data request (spec 017),
 * checked before anything is sent. Errors are message keys under `dataRights.validation`.
 *
 * Guards:
 * - CA-04: a correction says what to correct (blank is nothing); at most 1000 characters.
 * - CA-05: an erasure's reason is optional (blank is null).
 * - CA-11 / CA-14: attending or rejecting needs an answer.
 * - CA-11: a new email is lower case, without spaces, and valid.
 * - CA-16: the admin registers a kind, a channel (counter or Instagram) and what was asked.
 * - RN-03: an inquiry has 10 business days; a correction or an erasure, 15.
 */
import {
  answerSchema,
  correctionSchema,
  deadlineDays,
  emailSchema,
  erasureSchema,
  registerSchema,
} from '@web/modules/data-rights/schemas/data-rights.schema';

const issuesOf = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) =>
  result.success
    ? {}
    : Object.fromEntries(
        result.error!.issues.map((issue) => [issue.path.join('.'), issue.message])
      );

describe('correctionSchema', () => {
  it('keeps what to correct, trimmed (CA-04)', () => {
    expect(correctionSchema.parse({ description: '  Mi correo es otro ' })).toEqual({
      description: 'Mi correo es otro',
    });
  });

  it.each([[''], ['   ']])('asks what to correct when it is «%s» (CA-04)', (description) => {
    expect(issuesOf(correctionSchema.safeParse({ description }))).toEqual({
      description: 'descriptionRequired',
    });
  });

  it('refuses more than 1000 characters', () => {
    expect(issuesOf(correctionSchema.safeParse({ description: 'x'.repeat(1001) }))).toEqual({
      description: 'tooLong',
    });
  });
});

describe('erasureSchema', () => {
  it('keeps a reason, trimmed (CA-05)', () => {
    expect(erasureSchema.parse({ reason: ' Ya no uso el servicio ' })).toEqual({
      reason: 'Ya no uso el servicio',
    });
  });

  it.each([[''], ['  '], [undefined]])(
    'reads a missing reason («%s») as none: it is optional (CA-05)',
    (reason) => {
      expect(erasureSchema.parse({ reason })).toEqual({ reason: null });
    }
  );
});

describe('answerSchema', () => {
  it('needs an answer or a reason (CA-11, CA-14)', () => {
    expect(issuesOf(answerSchema.safeParse({ response: ' ' }))).toEqual({
      response: 'responseRequired',
    });
    expect(answerSchema.parse({ response: ' Listo ' })).toEqual({ response: 'Listo' });
  });
});

describe('emailSchema', () => {
  it('keeps the email lower case, without spaces (CA-11)', () => {
    expect(emailSchema.parse({ email: ' Camila.Nueva@Correo.Test ' })).toEqual({
      email: 'camila.nueva@correo.test',
    });
  });

  it('refuses what is not an email (CA-11)', () => {
    expect(issuesOf(emailSchema.safeParse({ email: 'camila' }))).toEqual({ email: 'emailInvalid' });
  });
});

describe('registerSchema', () => {
  it('keeps the kind, the channel and what was asked (CA-16)', () => {
    expect(
      registerSchema.parse({ kind: 'inquiry', channel: 'counter', description: ' Sus datos ' })
    ).toEqual({ kind: 'inquiry', channel: 'counter', description: 'Sus datos' });
  });

  it('reports every missing field at once (CA-16)', () => {
    expect(issuesOf(registerSchema.safeParse({ kind: '', channel: '', description: '' }))).toEqual({
      kind: 'kindRequired',
      channel: 'channelRequired',
      description: 'registerDescriptionRequired',
    });
  });

  it('never registers a request as if it came from the app: that is the customer’s (CA-16)', () => {
    expect(
      issuesOf(registerSchema.safeParse({ kind: 'inquiry', channel: 'app', description: 'x' }))
    ).toEqual({ channel: 'channelRequired' });
  });
});

describe('deadlineDays', () => {
  it('gives an inquiry 10 business days and a claim 15 (RN-03)', () => {
    expect(deadlineDays('inquiry')).toBe(10);
    expect(deadlineDays('correction')).toBe(15);
    expect(deadlineDays('erasure')).toBe(15);
  });
});
