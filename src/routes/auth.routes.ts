import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.js';

const router = Router();

router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.get('/me', protect, AuthController.me);

export default router;
