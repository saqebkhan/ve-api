import { Router } from 'express';
import { getActivityLogs } from '../controllers/activityController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.get('/logs', getActivityLogs);

export default router;
