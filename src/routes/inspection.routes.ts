import { Router } from 'express';
import { InspectionController } from '../controllers/inspection.controller.js';
import { validate } from '../middlewares/validator.js';
import { createInspectionSchema } from '../dtos/inspection.dto.js';

const router = Router();

router.get('/athlete/:athleteId', InspectionController.getAthleteInspections);
router.post('/', validate(createInspectionSchema), InspectionController.createInspection);
router.patch('/:id', InspectionController.updateInspection);

export default router;
