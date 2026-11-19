import { Router } from 'express';
import { loginAdmin, loginStudent, logoutUser } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const authRoutes = Router();
authRoutes.post('/user/login', loginStudent);
authRoutes.post('/admin/login', loginAdmin);
authRoutes.post('/logout', requireAuth, logoutUser);