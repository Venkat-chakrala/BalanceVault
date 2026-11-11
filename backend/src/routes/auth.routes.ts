import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { sensitiveLimiter } from '../middlewares/rateLimiter.middleware';
import { loginSchema, registerSchema, kycSubmitSchema, updateProfileSchema } from '../schemas';

const router = Router();

router.post('/register', sensitiveLimiter, validate(registerSchema), AuthController.register);
router.post('/login', sensitiveLimiter, validate(loginSchema), AuthController.login);
router.post('/logout', authMiddleware, AuthController.logout);
router.get('/me', authMiddleware, AuthController.getMe);
router.patch('/profile', authMiddleware, validate(updateProfileSchema), AuthController.updateProfile);
router.post('/kyc/submit', authMiddleware, validate(kycSubmitSchema), AuthController.submitKyc);

export default router;

