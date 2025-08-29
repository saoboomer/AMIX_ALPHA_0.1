import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { loginLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Public routes
router.post('/signup', authController.signup);
router.post('/login', loginLimiter, authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password/:token', authController.resetPassword);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerificationEmail);

// Protected routes - require authentication
router.use(authController.protect);

router.get('/logout', authController.logout);
router.patch('/update-password', authController.updatePassword);
router.post('/setup-2fa', authController.setup2FA);
router.post('/verify-2fa', authController.verify2FA);
router.post('/disable-2fa', authController.disable2FA);

// Admin routes
router.use(authController.restrictTo('admin'));
// Add admin-only auth routes here if needed

export default router;
