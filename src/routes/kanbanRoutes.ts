import { Router } from 'express';
import {
  createSprint,
  getSprints,
  completeSprint,
  createTask,
  getTasks,
  updateTask,
  deleteTask,
} from '../controllers/kanbanController';
import { protect } from '../middleware/auth';

const router = Router();

// Protect all routes under /api/kanban
router.use(protect);

// Sprint Routes
router.post('/sprints', createSprint);
router.get('/sprints', getSprints);
router.patch('/sprints/:id/complete', completeSprint);

// Task Routes
router.post('/tasks', createTask);
router.get('/tasks', getTasks);
router.put('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);

export default router;
