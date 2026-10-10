import express from 'express';
import {
  issueBook,
  returnBook,
  getAllTransactions,
  getOverdueTransactions,
} from '../controllers/transactionController.js';

const router = express.Router();

router.get('/overdue', getOverdueTransactions);
router.post('/issue', issueBook);
router.post('/return/:id', returnBook);
router.get('/', getAllTransactions);

export default router;
