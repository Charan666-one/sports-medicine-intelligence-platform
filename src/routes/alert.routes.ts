import { Router } from 'express';
import * as alertController from '../controllers/alert.controller.js';

const router = Router();

router.get('/', alertController.getAlerts);
router.patch('/:id/resolve', alertController.resolveAlert);
router.patch('/:id/escalate', alertController.escalateAlert);

export default router;
