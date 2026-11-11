import { Router } from 'express';
import { AccountController } from '../controllers/account.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { openAccountSchema } from '../schemas';

const router = Router();

router.use(authMiddleware);

router.get('/my', AccountController.getMyAccounts);
router.post('/open', validate(openAccountSchema), AccountController.createAccount);
router.get('/:id', AccountController.getAccountById);
router.get('/:id/transactions', AccountController.getAccountTransactions);

export default router;

