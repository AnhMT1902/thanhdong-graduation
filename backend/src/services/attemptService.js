import { pool, transaction, camel } from '../db.js';
import { assert, id } from '../security.js';
import { grade, publicQuestions } from '../scoring.js';
import { paginate } from '../validation.js';
import { listRecords } from '../listing.js';

const visible = `(a.target_type='student' AND EXISTS(SELECT 1 FROM assignment_students ats WHERE ats.assignment_id=a.id AND ats.student_id=$1)) OR (a.target_type='class' AND EXISTS(SELECT 1 FROM assignment_classes ac JOIN users u ON u.class_id=ac.class_id WHERE ac.assignment_id=a.id AND u.id=$1))`;

export async function finish(client, attempt) {
  if (attempt.status === 'submitted') return attempt;
  const answers = (await client.query('SELECT * FROM attempt_answers WHERE attempt_id=$1', [attempt.id])).rows;
  const result = grade(attempt.snapshot, answers);
  return (await client.query(`UPDATE attempts SET status='submitted',submitted_at=LEAST(now(),expires_at),score=$2,correct_count=$3,wrong_count=$4,unanswered_count=$5 WHERE id=$1 RETURNING *`, [attempt.id, result.score, result.correctCount, result.wrongCount, result.unansweredCount])).rows[0];
}

export async function expireAttempts(userId) {
  await transaction(async client => {
    const query = userId ? 'SELECT * FROM attempts WHERE status=\'in_progress\' AND expires_at<=now() AND user_id=$1 FOR UPDATE' : 'SELECT * FROM attempts WHERE status=\'in_progress\' AND expires_at<=now() FOR UPDATE SKIP LOCKED';
    const rows = (await client.query(query, userId ? [userId] : [])).rows;
    for (const attempt of rows) await finish(client, attempt);
  });
}

export function summary(row) {
  const value = camel(row);
  delete value.snapshot;
  value.score = row.score === null ? null : Number(row.score);
  value.questionCount = row.snapshot.questions.length;
  value.progressPercent = Math.round(Number(row.answer_count ?? ((row.correct_count || 0) + (row.wrong_count || 0))) / value.questionCount * 100);
  value.timeUsedSeconds = Math.max(0, Math.floor((new Date(row.submitted_at || Math.min(Date.now(), new Date(row.expires_at).getTime())) - new Date(row.started_at)) / 1000));
  return value;
}

export async function activeAttempt(userId) {
  await expireAttempts(userId);
  const result = await pool.query('SELECT * FROM attempts WHERE user_id=$1 AND status=\'in_progress\'', [userId]);
  return result.rowCount ? summary(result.rows[0]) : null;
}

export async function assignmentsFor(userId, query = {}) {
  await expireAttempts(userId);
  const rows = (await pool.query(`SELECT a.*,q.title,q.status AS quiz_status,q.duration_minutes,s.id AS subject_id,s.name AS subject_name,u.full_name AS teacher_name,(SELECT count(*)::int FROM quiz_questions qq WHERE qq.quiz_id=q.id) AS question_count,
    COALESCE((SELECT string_agg(c.name,', ' ORDER BY c.name) FROM assignment_classes ac JOIN classes c ON c.id=ac.class_id WHERE ac.assignment_id=a.id),(SELECT string_agg(us.full_name,', ' ORDER BY us.full_name) FROM assignment_students ats JOIN users us ON us.id=ats.student_id WHERE ats.assignment_id=a.id),'') AS target_labels
    FROM assignments a JOIN quizzes q ON q.id=a.quiz_id JOIN subjects s ON s.id=q.subject_id JOIN users u ON u.id=a.created_by WHERE a.status='active' AND (${visible}) ORDER BY a.due_at,a.id`, [userId])).rows;
  const attempts = (await pool.query('SELECT at.*,(SELECT count(*)::int FROM attempt_answers aa WHERE aa.attempt_id=at.id AND cardinality(aa.selected_option_ids)>0) AS answer_count FROM attempts at WHERE user_id=$1 ORDER BY started_at DESC,id', [userId])).rows;
  const active = attempts.find(attempt => attempt.status === 'in_progress');
  let items = rows.map(row => {
    const own = attempts.filter(attempt => attempt.assignment_id === row.id).map(summary);
    const completed = own.filter(attempt => attempt.status === 'submitted').sort((first, second) => second.score - first.score);
    const ongoing = own.find(attempt => attempt.status === 'in_progress');
    const future = new Date(row.open_at).getTime() > Date.now();
    const overdue = new Date(row.due_at).getTime() <= Date.now();
    const state = ongoing ? 'in_progress' : overdue ? 'overdue' : row.quiz_status !== 'published' ? 'closed' : future ? 'upcoming' : active && active.assignment_id !== row.id ? 'locked' : completed.length ? 'submitted' : 'not_started';
    return { ...camel(row), state, attempts: own, bestAttempt: completed[0] || null, activeAttempt: ongoing || null, canStart: row.quiz_status === 'published' && !future && !overdue && !active && own.length < row.max_attempts, attemptsRemaining: Math.max(0, row.max_attempts - own.length) };
  });
  if (query.q) items = items.filter(item => `${item.title} ${item.subjectName}`.toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.subjectId) items = items.filter(item => item.subjectId === query.subjectId);
  if (query.status) items = items.filter(item => item.state === query.status);
  if (query.sort === 'title') items.sort((first, second) => first.title.localeCompare(second.title, 'vi'));
  if (query.sort === 'latest') items.sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
  return paginate(listRecords(items, { sort: query.sort }), query);
}

export async function historyFor(userId, assignmentId) {
  await expireAttempts(userId);
  const permitted = await pool.query(`SELECT a.id FROM assignments a WHERE a.id=$2 AND ((${visible}) OR EXISTS(SELECT 1 FROM attempts at WHERE at.assignment_id=a.id AND at.user_id=$1))`, [userId, assignmentId]);
  assert(permitted.rowCount, 404, 'Không tìm thấy bài được giao');
  const result = await pool.query('SELECT at.*,(SELECT count(*)::int FROM attempt_answers aa WHERE aa.attempt_id=at.id AND cardinality(aa.selected_option_ids)>0) AS answer_count FROM attempts at WHERE user_id=$1 AND assignment_id=$2 ORDER BY attempt_number DESC', [userId, assignmentId]);
  return result.rows.map(summary);
}

export async function startAttempt(userId, assignmentId) {
  await expireAttempts(userId);
  return transaction(async client => {
    const student = (await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [userId])).rows[0];
    assert(student.status === 'active' && student.role === 'student', 403, 'Tài khoản học sinh không còn hoạt động');
    const assignmentResult = await client.query(`SELECT a.*,q.title,q.duration_minutes,q.subject_id,q.status AS quiz_status,s.name AS subject_name,u.full_name AS teacher_name FROM assignments a JOIN quizzes q ON q.id=a.quiz_id JOIN subjects s ON s.id=q.subject_id JOIN users u ON u.id=a.created_by WHERE a.id=$2 AND (${visible}) FOR SHARE OF a,q`, [userId, assignmentId]);
    assert(assignmentResult.rowCount, 404, 'Không tìm thấy bài được giao');
    const assignment = assignmentResult.rows[0];
    assert(assignment.status === 'active' && assignment.quiz_status === 'published', 409, 'Bài không còn mở để bắt đầu');
    assert(new Date(assignment.open_at) <= new Date() && new Date(assignment.due_at) > new Date(), 409, 'Bài chưa mở hoặc đã hết hạn');
    const active = await client.query("SELECT id,assignment_id FROM attempts WHERE user_id=$1 AND status='in_progress'", [userId]);
    if (active.rowCount && active.rows[0].assignment_id === assignmentId) return { id: active.rows[0].id, resumed: true };
    assert(!active.rowCount, 409, 'Bạn đang làm bài khác. Hãy nộp hoặc tiếp tục bài đang làm');
    const count = (await client.query('SELECT count(*)::int AS count FROM attempts WHERE user_id=$1 AND assignment_id=$2', [userId, assignmentId])).rows[0].count;
    assert(count < assignment.max_attempts, 409, 'Đã hết số lượt làm bài');
    const questions = (await client.query(`SELECT q.*,qq.points,COALESCE(jsonb_agg(jsonb_build_object('id',o.id,'content',o.content,'isCorrect',o.is_correct) ORDER BY o.sort_order),'[]') AS options FROM quiz_questions qq JOIN questions q ON q.id=qq.question_id JOIN answer_options o ON o.question_id=q.id WHERE qq.quiz_id=$1 GROUP BY q.id,qq.points,qq.sort_order ORDER BY qq.sort_order`, [assignment.quiz_id])).rows.map(question => ({ id: question.id, content: question.content, type: question.type, explanation: question.explanation, points: Number(question.points), options: question.options }));
    assert(questions.length, 409, 'Đề chưa có câu hỏi');
    const studentClass = student.class_id ? (await client.query('SELECT name FROM classes WHERE id=$1', [student.class_id])).rows[0] : null;
    const snapshot = { title: assignment.title, subjectName: assignment.subject_name, teacherName: assignment.teacher_name, durationMinutes: assignment.duration_minutes, showAnswersAfterSubmit: assignment.show_answers_after_submit, classId: student.class_id, className: studentClass?.name || '', questions };
    const attemptId = id();
    const expires = new Date(Math.min(Date.now() + assignment.duration_minutes * 60000, new Date(assignment.due_at).getTime()));
    await client.query(`INSERT INTO attempts(id,assignment_id,user_id,quiz_id,attempt_number,status,expires_at,snapshot) VALUES($1,$2,$3,$4,$5,'in_progress',$6,$7)`, [attemptId, assignmentId, userId, assignment.quiz_id, count + 1, expires, snapshot]);
    return { id: attemptId, resumed: false };
  });
}

export async function attemptFor(userId, attemptId, resultOnly = false) {
  await expireAttempts(userId);
  const result = await pool.query('SELECT * FROM attempts WHERE id=$1 AND user_id=$2', [attemptId, userId]);
  assert(result.rowCount, 404, 'Không tìm thấy lượt làm bài');
  const attempt = result.rows[0];
  if (resultOnly) assert(attempt.status === 'submitted', 409, 'Bài chưa nộp');
  const answers = (await pool.query('SELECT * FROM attempt_answers WHERE attempt_id=$1', [attemptId])).rows.map(camel);
  const showAnswers = attempt.status === 'submitted' && attempt.snapshot.showAnswersAfterSubmit;
  const questions = publicQuestions(attempt.snapshot, showAnswers);
  return { ...summary(attempt), title: attempt.snapshot.title, subjectName: attempt.snapshot.subjectName, teacherName: attempt.snapshot.teacherName, showAnswers, questions, answers, progressPercent: Math.round(answers.filter(answer => answer.selectedOptionIds.length).length / questions.length * 100), serverTime: new Date().toISOString() };
}

export async function saveAnswer(userId, attemptId, answer) {
  const result = await transaction(async client => {
    const found = await client.query('SELECT * FROM attempts WHERE id=$1 AND user_id=$2 FOR UPDATE', [attemptId, userId]);
    assert(found.rowCount, 404, 'Không tìm thấy lượt làm bài');
    const attempt = found.rows[0];
    assert(attempt.status === 'in_progress', 409, 'Lượt đã nộp không được sửa');
    if (new Date(attempt.expires_at) <= new Date()) { await finish(client, attempt); return { expired: true }; }
    const question = attempt.snapshot.questions.find(question => question.id === answer.questionId);
    assert(question && answer.selectedOptionIds.every(optionId => question.options.some(option => option.id === optionId)), 400, 'Câu hỏi hoặc đáp án không thuộc lượt làm');
    await client.query('INSERT INTO attempt_answers(attempt_id,question_id,selected_option_ids,flagged) VALUES($1,$2,$3,$4) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_option_ids=$3,flagged=$4,answered_at=now()', [attemptId, answer.questionId, answer.selectedOptionIds, answer.flagged]);
    return { saved: true };
  });
  assert(!result.expired, 409, 'Đã hết thời gian; bài được tự động nộp');
  return result;
}

export async function submitAttempt(userId, attemptId) {
  await transaction(async client => {
    const found = await client.query('SELECT * FROM attempts WHERE id=$1 AND user_id=$2 FOR UPDATE', [attemptId, userId]);
    assert(found.rowCount, 404, 'Không tìm thấy lượt làm bài');
    await finish(client, found.rows[0]);
  });
  return attemptFor(userId, attemptId, true);
}

export async function resultsFor(userId, query = {}) {
  await expireAttempts(userId);
  const rows = (await pool.query(`SELECT at.*,q.subject_id FROM attempts at JOIN quizzes q ON q.id=at.quiz_id WHERE at.user_id=$1 AND at.status='submitted' ORDER BY submitted_at DESC,at.id`, [userId])).rows;
  let items = rows.map(row => ({ ...summary(row), title: row.snapshot.title, subjectName: row.snapshot.subjectName }));
  if (query.q) items = items.filter(item => item.title.toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.subjectId) items = items.filter(item => item.subjectId === query.subjectId);
  if (query.result === 'pass') items = items.filter(item => item.score >= 5);
  if (query.result === 'fail') items = items.filter(item => item.score < 5);
  if (query.sort === 'score') items.sort((first, second) => second.score - first.score);
  if (query.sort === 'title') items.sort((first, second) => first.title.localeCompare(second.title, 'vi'));
  return paginate(items, query);
}
