import { Router } from 'express';
import { activeAttemptForUser, assignmentHistory, createAttempt, dashboard, getAttempt, getResult, listAssignments, listResults, profile, saveAttemptAnswer, submitUserAttempt, updateUserProfile } from '../controllers/userController.js';

export const userRoutes = Router();
userRoutes.get('/dashboard', dashboard);
userRoutes.get('/assignments', listAssignments);
userRoutes.get('/assignments/:id/history', assignmentHistory);
userRoutes.post('/assignments/:id/attempts', createAttempt);
userRoutes.get('/attempts/active', activeAttemptForUser);
userRoutes.get('/attempts/:id', getAttempt);
userRoutes.patch('/attempts/:id/answers', saveAttemptAnswer);
userRoutes.post('/attempts/:id/submit', submitUserAttempt);
userRoutes.get('/results', listResults);
userRoutes.get('/results/:id', getResult);
userRoutes.get('/profile', profile);
userRoutes.patch('/profile', updateUserProfile);