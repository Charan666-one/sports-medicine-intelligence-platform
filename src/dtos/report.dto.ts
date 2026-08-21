import { z } from 'zod';

export const createReportSchema = z.object({
  type: z.enum(['BLOOD', 'URINE', 'BIOLOGICAL_PASSPORT', 'WEARABLE_LOG']),
  athleteId: z.string().min(1, 'athleteId is required'),
  description: z.string().max(2000).optional(),
});

export type CreateReportDto = z.infer<typeof createReportSchema>;
