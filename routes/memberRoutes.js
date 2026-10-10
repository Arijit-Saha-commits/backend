import express from 'express';
import {
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
} from '../controllers/memberController.js';

const router = express.Router();

router.route('/').get(getAllMembers).post(createMember);
router.route('/:id').get(getMemberById).put(updateMember).delete(deleteMember);

export default router;
