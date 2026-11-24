import { z } from 'zod';

const MAX = 1000;

/** Text the person writes: trimmed; '' is «nothing». Errors are keys under `dataRights.validation`. */
const text = (required: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, { error: required }).max(MAX, { error: 'tooLong' }));

/** CA-04: what to correct, required. */
export const correctionSchema = z.object({ description: text('descriptionRequired') });

/** CA-05: an erasure, with an optional reason (null when blank). */
export const erasureSchema = z.object({
  reason: z
    .string()
    .optional()
    .transform((value) => value?.trim() || null)
    .pipe(z.string().max(MAX, { error: 'tooLong' }).nullable()),
});

/** CA-11, CA-14: the answer to a request, or the reason to reject it. */
export const answerSchema = z.object({ response: text('responseRequired') });

/** CA-11: a customer's new email. */
export const emailSchema = z.object({
  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.email({ error: 'emailInvalid' })),
});

/** CA-16: a request the admin registers for a customer. */
export const registerSchema = z.object({
  kind: z.enum(['inquiry', 'correction', 'erasure'], { error: 'kindRequired' }),
  channel: z.enum(['counter', 'instagram'], { error: 'channelRequired' }),
  description: text('registerDescriptionRequired'),
});

/** RN-03: business days to answer: an inquiry, 10; a correction or an erasure (claims), 15. */
export const deadlineDays = (kind: 'inquiry' | 'correction' | 'erasure') =>
  kind === 'inquiry' ? 10 : 15;

export type CorrectionInput = z.input<typeof correctionSchema>;
export type ErasureInput = z.input<typeof erasureSchema>;
export type AnswerInput = z.input<typeof answerSchema>;
export type EmailInput = z.input<typeof emailSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
