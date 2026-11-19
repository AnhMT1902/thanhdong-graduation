import { Router } from 'express';
import { currentUser } from '../controllers/authController.js';

export const meRoutes = Router();
meRoutes.get('/me', currentUser);