import { Router } from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  patchStock,
  getFilterOptions,
} from '../controllers/inventoryController';
import { protect } from '../middleware/auth';

const router = Router();

// All inventory routes are protected
router.use(protect);

// NOTE: /filter-options must be before /:id to avoid route conflict
router.get('/filter-options', getFilterOptions);

router.route('/').get(getProducts).post(createProduct);
router.route('/:id').get(getProduct).put(updateProduct).delete(deleteProduct);
router.patch('/:id/stock', patchStock);

export default router;
