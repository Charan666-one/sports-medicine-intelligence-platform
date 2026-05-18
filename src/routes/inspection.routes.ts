import { Router } from 'express';
import { InspectionController } from '../controllers/inspection.controller.js';

const router = Router();

router.get('/athlete/:athleteId', InspectionController.getAthleteInspections);
router.post('/', InspectionController.createInspection);
router.patch('/:id', InspectionController.updateInspection);

export default router;
