import { Router } from 'express';
import { TransferController } from '../controllers/transfer.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { sensitiveLimiter } from '../middlewares/rateLimiter.middleware';
import { transferSchema, depositSchema } from '../schemas';

const router = Router();

router.use(authMiddleware);

router.post('/', sensitiveLimiter, validate(transferSchema), TransferController.transfer);
router.post('/deposit', sensitiveLimiter, validate(depositSchema), TransferController.deposit);
router.get('/proof/:reference', TransferController.getProof);

export default router;

