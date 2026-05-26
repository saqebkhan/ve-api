import { Router } from 'express';
import {
  sendInvite,
  verifyInviteToken,
  onboardMember,
  getTeamMembers,
  removeMember,
  revokeInvite,
} from '../controllers/inviteController';
import { protect } from '../middleware/auth';

const router = Router();

// Public routes for onboarding
router.get('/invite/verify', verifyInviteToken);
router.post('/invite/onboard', onboardMember);

// Protected routes (require session)
router.use(protect);

router.post('/invite', sendInvite);
router.get('/members', getTeamMembers);
router.delete('/members/:id', removeMember);
router.delete('/invite/:id', revokeInvite);

export default router;
