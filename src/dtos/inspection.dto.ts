import { z } from 'zod';

export const createInspectionSchema = z.object({
  athleteId: z.string().min(1, 'athleteId is required'),
  title: z.string().min(2, 'title is required'),
  description: z.string().max(5000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  assignedTo: z.string().optional(),
});

export type CreateInspectionDto = z.infer<typeof createInspectionSchema>;
