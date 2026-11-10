import { Router } from 'express';
import { AccountController } from '../controllers/account.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/my', AccountController.getMyAccounts);
router.post('/open', AccountController.createAccount);
router.get('/:id', AccountController.getAccountById);
router.get('/:id/transactions', AccountController.getAccountTransactions);

export default router;
