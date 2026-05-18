import { z } from 'zod';

/**
 * DTOs (Data Transfer Objects) for Athlete operations.
 * Using Zod for runtime validation and type inference.
 */

export const createAthleteSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  dateOfBirth: z.string().transform((str) => new Date(str)),
  gender: z.enum(['Male', 'Female', 'Other']),
  nationality: z.string().min(2),
  sport: z.string().min(2),
});

export type CreateAthleteDto = z.infer<typeof createAthleteSchema>;

export const updateAthleteSchema = createAthleteSchema.partial().extend({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'RETIRED', 'UNDER_INVESTIGATION']).optional(),
  riskScore: z.number().min(0).max(100).optional(),
});

export type UpdateAthleteDto = z.infer<typeof updateAthleteSchema>;
