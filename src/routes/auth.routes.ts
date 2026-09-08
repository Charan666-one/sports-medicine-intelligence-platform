import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.js';

const router = Router();

router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.post('/mfa/challenge', authLimiter, AuthController.mfaChallenge);
router.post('/refresh', authLimiter, AuthController.refresh);
router.post('/logout', AuthController.logout);
router.get('/me', protect, AuthController.me);

router.post('/mfa/setup', protect, AuthController.mfaSetup);
router.post('/mfa/enable', protect, AuthController.mfaEnable);
router.post('/mfa/disable', protect, AuthController.mfaDisable);

export default router;
