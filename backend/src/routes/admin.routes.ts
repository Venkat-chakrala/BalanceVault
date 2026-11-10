import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { userStatusUpdateSchema } from '../schemas';

const router = Router();

router.use(authMiddleware);

// Admin-only user management
router.get('/users', requireRole(['ADMIN']), AdminController.getUsers);
router.patch('/users/:id', requireRole(['ADMIN']), validate(userStatusUpdateSchema), AdminController.updateUser);

// Admin and Auditor accessible operations
router.get('/ledger/verify', requireRole(['ADMIN', 'AUDITOR']), AdminController.verifyLedger);
router.get('/audit-trail', requireRole(['ADMIN', 'AUDITOR']), AdminController.getAuditTrail);
router.get('/stats', requireRole(['ADMIN', 'AUDITOR']), AdminController.getSystemStats);

export default router;
