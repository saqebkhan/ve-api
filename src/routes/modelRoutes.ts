import { Router } from 'express';
import {
  uploadModelImage,
  getModelImages,
  deleteModelImage,
  createModelGroup,
  getModelGroups,
  deleteModelGroup,
  assignImageToGroup,
} from '../controllers/modelController';
import { protect } from '../middleware/auth';

const router = Router();

// Protect all routes under /api/models
router.use(protect);

// Group routes
router.post('/groups', createModelGroup);
router.get('/groups', getModelGroups);
router.delete('/groups/:id', deleteModelGroup);

// Image routes
router.post('/', uploadModelImage);
router.get('/', getModelImages);
router.delete('/:id', deleteModelImage);
router.patch('/:id/group', assignImageToGroup);

export default router;
