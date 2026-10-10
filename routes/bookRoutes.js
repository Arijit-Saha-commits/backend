import express from 'express';
import {
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  getCategories,
} from '../controllers/bookController.js';

const router = express.Router();

router.route('/categories').get(getCategories);
router.route('/').get(getAllBooks).post(createBook);
router.route('/:id').get(getBookById).put(updateBook).delete(deleteBook);

export default router;
