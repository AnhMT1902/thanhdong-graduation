import { parse, profileSchema, answerSchema, validId } from '../validation.js';
import { assignmentsFor, activeAttempt, historyFor, startAttempt, attemptFor, saveAnswer, submitAttempt, resultsFor } from '../services/attemptService.js';
import { cookieOptions } from '../config/auth.js';
import { updateProfile } from '../services/authService.js';

export async function dashboard(request, response) {
  const assignments = await assignmentsFor(request.user.id, { pageSize: 50 });
  const results = await resultsFor(request.user.id, { pageSize: 5 });
  response.json({ user: request.user, assignmentCount: assignments.total, submittedCount: results.total, assignments: assignments.items, results: results.items, activeAttempt: await activeAttempt(request.user.id) });
}
export async function listAssignments(request, response) { response.json(await assignmentsFor(request.user.id, request.query)); }
export async function assignmentHistory(request, response) { response.json(await historyFor(request.user.id, validId(request.params.id))); }
export async function createAttempt(request, response) { response.status(201).json(await startAttempt(request.user.id, validId(request.params.id))); }
export async function activeAttemptForUser(request, response) { response.json(await activeAttempt(request.user.id)); }
export async function getAttempt(request, response) { response.json(await attemptFor(request.user.id, validId(request.params.id))); }
export async function saveAttemptAnswer(request, response) { response.json(await saveAnswer(request.user.id, validId(request.params.id), parse(answerSchema, request.body))); }
export async function submitUserAttempt(request, response) { response.json(await submitAttempt(request.user.id, validId(request.params.id))); }
export async function listResults(request, response) { response.json(await resultsFor(request.user.id, request.query)); }
export async function getResult(request, response) { response.json(await attemptFor(request.user.id, validId(request.params.id), true)); }
export function profile(request, response) { response.json(request.user); }

export async function updateUserProfile(request, response) {
  const value = parse(profileSchema, request.body);
  await updateProfile({ userId: request.user.id, value });
  if (value.newPassword) response.clearCookie('quizify_session', cookieOptions);
  response.json({ updated: true, requiresLogin: !!value.newPassword });
}