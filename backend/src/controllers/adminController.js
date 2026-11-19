import { Router } from 'express';
import { pool, transaction, camel } from '../db.js';
import { id, assert, audit, hashPassword } from '../security.js';
import { parse, validId, studentSchema, studentUpdate, classSchema, subjectSchema, questionSchema, quizSchema, assignmentSchema, paginate } from '../validation.js';
import { summary, expireAttempts } from '../services/attemptService.js';
import { listRecords } from '../listing.js';

export const adminController = Router();
const userColumns = 'u.id,u.role,u.full_name,u.email,u.student_code,u.class_id,u.status,u.last_login_at,u.created_at,u.updated_at,c.name AS class_name';

function listing(records, query) {
  return paginate(listRecords(records, query), query);
}

async function requireRecord(client, table, recordId) {
  const result = await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [recordId]);
  assert(result.rowCount, 404, 'Không tìm thấy dữ liệu');
  return result.rows[0];
}

async function validClass(client, classId) {
  if (!classId) return;
  const result = await client.query("SELECT id FROM classes WHERE id=$1 AND status='active'", [classId]);
  assert(result.rowCount, 400, 'Lớp không tồn tại hoặc bị khóa');
}

async function validSubject(client, subjectId) {
  const result = await client.query("SELECT id FROM subjects WHERE id=$1 AND status='active'", [subjectId]);
  assert(result.rowCount, 400, 'Môn học không tồn tại hoặc bị khóa');
}

adminController.get('/profile', (request, response) => response.json(request.user));
adminController.get('/dashboard', async (request, response) => {
  await expireAttempts();
  const stats = (await pool.query(`SELECT (SELECT count(*)::int FROM users WHERE role='student' AND status='active') AS students,(SELECT count(*)::int FROM classes WHERE status='active') AS classes,(SELECT count(*)::int FROM subjects WHERE status='active') AS subjects,(SELECT count(*)::int FROM quizzes) AS quizzes,(SELECT count(*)::int FROM assignments WHERE status='active') AS assignments,(SELECT count(*)::int FROM attempts WHERE status='submitted') AS submitted,(SELECT round(avg(score),2) FROM attempts WHERE status='submitted') AS average_score`)).rows[0];
  response.json(camel(stats));
});
adminController.get('/students', async (request, response) => {
  let items = (await pool.query(`SELECT ${userColumns} FROM users u LEFT JOIN classes c ON c.id=u.class_id WHERE u.role='student' ORDER BY u.created_at DESC,u.id`)).rows.map(camel);
  if (request.query.q) items = items.filter(item => `${item.fullName} ${item.studentCode} ${item.email}`.toLowerCase().includes(String(request.query.q).toLowerCase()));
  response.json(listing(items, request.query));
});
adminController.get('/students/:id', async (request, response) => {
  const result = await pool.query(`SELECT ${userColumns} FROM users u LEFT JOIN classes c ON c.id=u.class_id WHERE u.id=$1 AND u.role='student'`, [validId(request.params.id)]);
  assert(result.rowCount, 404, 'Không tìm thấy học sinh');
  response.json(camel(result.rows[0]));
});
adminController.post('/students', async (request, response) => {
  const value = parse(studentSchema, request.body);
  const recordId = id();
  const passwordHash = await hashPassword(value.password);
  await transaction(async client => {
    await validClass(client, value.classId);
    await client.query("INSERT INTO users(id,role,full_name,email,student_code,password_hash,class_id,status) VALUES($1,'student',$2,$3,$4,$5,$6,$7)", [recordId, value.fullName, value.email, value.studentCode, passwordHash, value.classId || null, value.status]);
    await audit(client, request.user.id, 'student', recordId, 'create', { studentCode: value.studentCode });
  });
  response.status(201).json({ id: recordId });
});
adminController.patch('/students/:id', async (request, response) => {
  const recordId = validId(request.params.id);
  const value = parse(studentUpdate, request.body);
  const passwordHash = value.password ? await hashPassword(value.password) : null;
  await transaction(async client => {
    const existing = await requireRecord(client, 'users', recordId);
    assert(existing.role === 'student', 404, 'Không tìm thấy học sinh');
    const classId = value.classId === undefined ? existing.class_id : value.classId;
    await validClass(client, classId);
    await client.query('UPDATE users SET full_name=$2,email=$3,student_code=$4,password_hash=$5,class_id=$6,status=$7,updated_at=now() WHERE id=$1', [recordId, value.fullName ?? existing.full_name, value.email ?? existing.email, value.studentCode ?? existing.student_code, passwordHash || existing.password_hash, classId, value.status ?? existing.status]);
    if (passwordHash || value.status === 'inactive') await client.query('DELETE FROM sessions WHERE user_id=$1', [recordId]);
    await audit(client, request.user.id, 'student', recordId, 'update', { changedFields: Object.keys(value).filter(key => key !== 'password') });
  });
  response.json({ updated: true });
});
adminController.delete('/students/:id', async (request, response) => {
  const recordId = validId(request.params.id);
  await transaction(async client => {
    const existing = await requireRecord(client, 'users', recordId);
    assert(existing.role === 'student', 404, 'Không tìm thấy học sinh');
    await client.query("UPDATE users SET status='inactive',updated_at=now() WHERE id=$1", [recordId]);
    await client.query('DELETE FROM sessions WHERE user_id=$1', [recordId]);
    await audit(client, request.user.id, 'student', recordId, 'deactivate');
  });
  response.json({ deactivated: true });
});

adminController.get('/classes', async (request, response) => {
  const items = (await pool.query(`SELECT c.*,(SELECT count(*)::int FROM users u WHERE u.class_id=c.id AND u.role='student' AND u.status='active') AS student_count,ARRAY(SELECT cs.subject_id FROM class_subjects cs WHERE cs.class_id=c.id) AS subject_ids FROM classes c ORDER BY c.name,c.id`)).rows.map(camel);
  response.json(listing(items, request.query));
});
adminController.get('/classes/:id', async (request, response) => {
  const recordId = validId(request.params.id);
  const result = await pool.query('SELECT c.*,ARRAY(SELECT subject_id FROM class_subjects WHERE class_id=c.id) AS subject_ids FROM classes c WHERE c.id=$1', [recordId]);
  assert(result.rowCount, 404, 'Không tìm thấy lớp');
  const students = (await pool.query(`SELECT ${userColumns} FROM users u LEFT JOIN classes c ON c.id=u.class_id WHERE u.class_id=$1 AND u.role='student' ORDER BY u.student_code`, [recordId])).rows.map(camel);
  response.json({ ...camel(result.rows[0]), students });
});
for (const method of ['post', 'patch']) {
  adminController[method](method === 'post' ? '/classes' : '/classes/:id', async (request, response) => {
    const value = parse(classSchema, request.body);
    const recordId = method === 'post' ? id() : validId(request.params.id);
    await transaction(async client => {
      if (method === 'patch') await requireRecord(client, 'classes', recordId);
      if (method === 'post') await client.query('INSERT INTO classes(id,code,name,grade,status) VALUES($1,$2,$3,$4,$5)', [recordId, value.code, value.name, value.grade, value.status]);
      else await client.query('UPDATE classes SET code=$2,name=$3,grade=$4,status=$5 WHERE id=$1', [recordId, value.code, value.name, value.grade, value.status]);
      await client.query('DELETE FROM class_subjects WHERE class_id=$1', [recordId]);
      for (const subjectId of new Set(value.subjectIds)) {
        await validSubject(client, subjectId);
        await client.query('INSERT INTO class_subjects(class_id,subject_id) VALUES($1,$2)', [recordId, subjectId]);
      }
      await audit(client, request.user.id, 'class', recordId, method === 'post' ? 'create' : 'update');
    });
    response.status(method === 'post' ? 201 : 200).json({ id: recordId });
  });
}
adminController.post('/classes/:id/students', async (request, response) => {
  const recordId = validId(request.params.id);
  assert(Array.isArray(request.body.studentIds) && request.body.studentIds.length > 0 && request.body.studentIds.length <= 500, 400, 'Chọn học sinh');
  const studentIds = [...new Set(request.body.studentIds.map(validId))].sort();
  await transaction(async client => {
    await validClass(client, recordId);
    for (const studentId of studentIds) {
      const result = await client.query("UPDATE users SET class_id=$2,updated_at=now() WHERE id=$1 AND role='student' AND status='active' RETURNING id", [studentId, recordId]);
      assert(result.rowCount, 400, 'Học sinh không hợp lệ');
    }
    await audit(client, request.user.id, 'class', recordId, 'assign_students', { studentIds });
  });
  response.json({ updated: true });
});
adminController.delete('/classes/:id/students/:studentId', async (request, response) => {
  const classId = validId(request.params.id);
  const studentId = validId(request.params.studentId);
  await transaction(async client => {
    const result = await client.query("UPDATE users SET class_id=NULL,updated_at=now() WHERE id=$1 AND class_id=$2 AND role='student' RETURNING id", [studentId, classId]);
    assert(result.rowCount, 404, 'Học sinh không thuộc lớp');
    await audit(client, request.user.id, 'class', classId, 'remove_student', { studentId });
  });
  response.json({ updated: true });
});
adminController.delete('/classes/:id', async (request, response) => {
  const recordId = validId(request.params.id);
  await transaction(async client => {
    await requireRecord(client, 'classes', recordId);
    await client.query('DELETE FROM classes WHERE id=$1', [recordId]);
    await audit(client, request.user.id, 'class', recordId, 'delete');
  });
  response.json({ deleted: true });
});

adminController.get('/subjects', async (request, response) => response.json(listing((await pool.query('SELECT * FROM subjects ORDER BY name,id')).rows.map(camel), request.query)));
adminController.get('/subjects/:id', async (request, response) => {
  const result = await pool.query('SELECT * FROM subjects WHERE id=$1', [validId(request.params.id)]);
  assert(result.rowCount, 404, 'Không tìm thấy môn');
  response.json(camel(result.rows[0]));
});
for (const method of ['post', 'patch']) {
  adminController[method](method === 'post' ? '/subjects' : '/subjects/:id', async (request, response) => {
    const value = parse(subjectSchema, request.body);
    const recordId = method === 'post' ? id() : validId(request.params.id);
    await transaction(async client => {
      if (method === 'patch') await requireRecord(client, 'subjects', recordId);
      await client.query(method === 'post' ? 'INSERT INTO subjects(id,code,name,grade_scope,status) VALUES($1,$2,$3,$4,$5)' : 'UPDATE subjects SET code=$2,name=$3,grade_scope=$4,status=$5 WHERE id=$1', [recordId, value.code, value.name, value.gradeScope, value.status]);
      await audit(client, request.user.id, 'subject', recordId, method === 'post' ? 'create' : 'update');
    });
    response.status(method === 'post' ? 201 : 200).json({ id: recordId });
  });
}
adminController.delete('/subjects/:id', async (request, response) => {
  const recordId = validId(request.params.id);
  await transaction(async client => {
    await requireRecord(client, 'subjects', recordId);
    await client.query('DELETE FROM subjects WHERE id=$1', [recordId]);
    await audit(client, request.user.id, 'subject', recordId, 'delete');
  });
  response.json({ deleted: true });
});

async function questions(client = pool, questionId) {
  return (await client.query(`SELECT q.*,s.name AS subject_name,COALESCE(jsonb_agg(jsonb_build_object('id',o.id,'content',o.content,'isCorrect',o.is_correct) ORDER BY o.sort_order) FILTER(WHERE o.id IS NOT NULL),'[]') AS options FROM questions q JOIN subjects s ON s.id=q.subject_id LEFT JOIN answer_options o ON o.question_id=q.id ${questionId ? 'WHERE q.id=$1' : ''} GROUP BY q.id,s.name ORDER BY q.created_at DESC,q.id`, questionId ? [questionId] : [])).rows.map(camel);
}
adminController.get('/questions', async (request, response) => {
  let items = await questions();
  if (request.query.subjectId) items = items.filter(item => item.subjectId === request.query.subjectId);
  response.json(listing(items, request.query));
});
adminController.get('/questions/:id', async (request, response) => {
  const items = await questions(pool, validId(request.params.id));
  assert(items.length, 404, 'Không tìm thấy câu hỏi');
  response.json(items[0]);
});
for (const method of ['post', 'patch']) {
  adminController[method](method === 'post' ? '/questions' : '/questions/:id', async (request, response) => {
    const value = parse(questionSchema, request.body);
    const recordId = method === 'post' ? id() : validId(request.params.id);
    await transaction(async client => {
      await validSubject(client, value.subjectId);
      if (method === 'patch') {
        const related = await client.query('SELECT q.status FROM quiz_questions qq JOIN quizzes q ON q.id=qq.quiz_id WHERE qq.question_id=$1 ORDER BY q.id FOR SHARE OF q', [recordId]);
        assert(related.rows.every(quiz => quiz.status === 'draft'), 409, 'Câu hỏi thuộc đề đã xuất bản không được sửa');
        await requireRecord(client, 'questions', recordId);
        const mismatch = await client.query('SELECT 1 FROM quiz_questions qq JOIN quizzes q ON q.id=qq.quiz_id WHERE qq.question_id=$1 AND q.subject_id<>$2', [recordId, value.subjectId]);
        assert(!mismatch.rowCount, 409, 'Môn câu hỏi phải trùng môn của đề đang sử dụng');
        await client.query('UPDATE questions SET subject_id=$2,content=$3,type=$4,difficulty=$5,explanation=$6,updated_at=now() WHERE id=$1', [recordId, value.subjectId, value.content, value.type, value.difficulty, value.explanation]);
        await client.query('DELETE FROM answer_options WHERE question_id=$1', [recordId]);
      } else await client.query('INSERT INTO questions(id,subject_id,content,type,difficulty,explanation,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)', [recordId, value.subjectId, value.content, value.type, value.difficulty, value.explanation, request.user.id]);
      for (const [index, option] of value.options.entries()) await client.query('INSERT INTO answer_options(id,question_id,content,is_correct,sort_order) VALUES($1,$2,$3,$4,$5)', [id(), recordId, option.content, option.isCorrect, index]);
      await audit(client, request.user.id, 'question', recordId, method === 'post' ? 'create' : 'update');
    });
    response.status(method === 'post' ? 201 : 200).json({ id: recordId });
  });
}
adminController.delete('/questions/:id', async (request, response) => {
  const recordId = validId(request.params.id);
  await transaction(async client => {
    await requireRecord(client, 'questions', recordId);
    await client.query('DELETE FROM questions WHERE id=$1', [recordId]);
    await audit(client, request.user.id, 'question', recordId, 'delete');
  });
  response.json({ deleted: true });
});

adminController.get('/quizzes', async (request, response) => {
  let items = (await pool.query(`SELECT q.*,s.name AS subject_name,(SELECT count(*)::int FROM quiz_questions WHERE quiz_id=q.id) AS question_count FROM quizzes q JOIN subjects s ON s.id=q.subject_id ORDER BY q.created_at DESC,q.id`)).rows.map(camel);
  if (request.query.status) items = items.filter(item => item.status === request.query.status);
  response.json(listing(items, request.query));
});
adminController.get('/quizzes/:id', async (request, response) => {
  const recordId = validId(request.params.id);
  const result = await pool.query('SELECT * FROM quizzes WHERE id=$1', [recordId]);
  assert(result.rowCount, 404, 'Không tìm thấy đề');
  const selected = (await pool.query('SELECT question_id,points FROM quiz_questions WHERE quiz_id=$1 ORDER BY sort_order', [recordId])).rows.map(camel);
  response.json({ ...camel(result.rows[0]), questions: selected.map(item => ({ ...item, points: Number(item.points) })) });
});
for (const method of ['post', 'patch']) {
  adminController[method](method === 'post' ? '/quizzes' : '/quizzes/:id', async (request, response) => {
    const value = parse(quizSchema, request.body);
    const recordId = method === 'post' ? id() : validId(request.params.id);
    await transaction(async client => {
      await validSubject(client, value.subjectId);
      if (method === 'patch') {
        const existing = await requireRecord(client, 'quizzes', recordId);
        assert(existing.status === 'draft', 409, 'Chỉ sửa đề nháp; đề đã xuất bản được khóa');
        await client.query('UPDATE quizzes SET title=$2,subject_id=$3,description=$4,duration_minutes=$5,updated_at=now() WHERE id=$1', [recordId, value.title, value.subjectId, value.description, value.durationMinutes]);
        await client.query('DELETE FROM quiz_questions WHERE quiz_id=$1', [recordId]);
      } else await client.query('INSERT INTO quizzes(id,title,subject_id,description,duration_minutes,created_by) VALUES($1,$2,$3,$4,$5,$6)', [recordId, value.title, value.subjectId, value.description, value.durationMinutes, request.user.id]);
      for (const [index, question] of value.questions.entries()) {
        const found = await client.query('SELECT id FROM questions WHERE id=$1 AND subject_id=$2 FOR SHARE', [question.questionId, value.subjectId]);
        assert(found.rowCount, 400, 'Câu hỏi không thuộc môn của đề');
        await client.query('INSERT INTO quiz_questions(quiz_id,question_id,sort_order,points) VALUES($1,$2,$3,$4)', [recordId, question.questionId, index, question.points]);
      }
      await audit(client, request.user.id, 'quiz', recordId, method === 'post' ? 'create' : 'update');
    });
    response.status(method === 'post' ? 201 : 200).json({ id: recordId });
  });
}
adminController.post('/quizzes/:id/publish', async (request, response) => {
  const recordId = validId(request.params.id);
  await transaction(async client => {
    const existing = await requireRecord(client, 'quizzes', recordId);
    assert(existing.status === 'draft', 409, 'Chỉ xuất bản đề nháp');
    const count = (await client.query('SELECT count(*)::int AS count FROM quiz_questions WHERE quiz_id=$1', [recordId])).rows[0].count;
    assert(count > 0, 409, 'Đề cần ít nhất một câu hỏi');
    await client.query("UPDATE quizzes SET status='published',published_at=now(),updated_at=now() WHERE id=$1", [recordId]);
    await audit(client, request.user.id, 'quiz', recordId, 'publish');
  });
  response.json({ published: true });
});
adminController.post('/quizzes/:id/archive', async (request, response) => {
  const recordId = validId(request.params.id);
  await transaction(async client => {
    const existing = await requireRecord(client, 'quizzes', recordId);
    assert(existing.status === 'published', 409, 'Chỉ lưu trữ đề đã xuất bản');
    await client.query("UPDATE quizzes SET status='archived',updated_at=now() WHERE id=$1", [recordId]);
    await audit(client, request.user.id, 'quiz', recordId, 'archive');
  });
  response.json({ archived: true });
});
adminController.delete('/quizzes/:id', async (request, response) => {
  const recordId = validId(request.params.id);
  await transaction(async client => {
    const existing = await requireRecord(client, 'quizzes', recordId);
    assert(existing.status === 'draft', 409, 'Chỉ xóa đề nháp chưa được sử dụng');
    await client.query('DELETE FROM quizzes WHERE id=$1', [recordId]);
    await audit(client, request.user.id, 'quiz', recordId, 'delete');
  });
  response.json({ deleted: true });
});

const assignmentSelect = `SELECT a.*,q.title,q.subject_id,s.name AS subject_name,ARRAY(SELECT class_id FROM assignment_classes WHERE assignment_id=a.id) AS class_ids,ARRAY(SELECT student_id FROM assignment_students WHERE assignment_id=a.id) AS student_ids,(SELECT count(*)::int FROM attempts WHERE assignment_id=a.id) AS attempt_count FROM assignments a JOIN quizzes q ON q.id=a.quiz_id JOIN subjects s ON s.id=q.subject_id`;
adminController.get('/assignments', async (request, response) => response.json(listing((await pool.query(`${assignmentSelect} ORDER BY a.created_at DESC,a.id`)).rows.map(camel), request.query)));
adminController.get('/assignments/:id', async (request, response) => {
  const found = await pool.query(`${assignmentSelect} WHERE a.id=$1`, [validId(request.params.id)]);
  assert(found.rowCount, 404, 'Không tìm thấy giao bài');
  response.json(camel(found.rows[0]));
});
for (const method of ['post', 'patch']) {
  adminController[method](method === 'post' ? '/assignments' : '/assignments/:id', async (request, response) => {
    const value = parse(assignmentSchema, request.body);
    const recordId = method === 'post' ? id() : validId(request.params.id);
    await transaction(async client => {
      if (method === 'patch') {
        const existing = await requireRecord(client, 'assignments', recordId);
        assert(existing.status === 'active', 409, 'Giao bài đã hủy không được sửa');
        const count = await client.query('SELECT 1 FROM attempts WHERE assignment_id=$1', [recordId]);
        assert(!count.rowCount, 409, 'Giao bài đã có lượt làm không được sửa');
      }
      const quiz = await client.query("SELECT id FROM quizzes WHERE id=$1 AND status='published' FOR SHARE", [value.quizId]);
      assert(quiz.rowCount, 400, 'Chỉ giao đề đã xuất bản');
      if (method === 'post') await client.query('INSERT INTO assignments(id,quiz_id,target_type,open_at,due_at,max_attempts,show_answers_after_submit,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [recordId, value.quizId, value.targetType, value.openAt, value.dueAt, value.maxAttempts, value.showAnswersAfterSubmit, request.user.id]);
      else {
        await client.query('UPDATE assignments SET quiz_id=$2,target_type=$3,open_at=$4,due_at=$5,max_attempts=$6,show_answers_after_submit=$7 WHERE id=$1', [recordId, value.quizId, value.targetType, value.openAt, value.dueAt, value.maxAttempts, value.showAnswersAfterSubmit]);
        await client.query('DELETE FROM assignment_classes WHERE assignment_id=$1', [recordId]);
        await client.query('DELETE FROM assignment_students WHERE assignment_id=$1', [recordId]);
      }
      for (const classId of new Set(value.classIds)) {
        await validClass(client, classId);
        await client.query('INSERT INTO assignment_classes(assignment_id,class_id) VALUES($1,$2)', [recordId, classId]);
      }
      for (const studentId of new Set(value.studentIds)) {
        const found = await client.query("SELECT id FROM users WHERE id=$1 AND role='student' AND status='active'", [studentId]);
        assert(found.rowCount, 400, 'Học sinh không hợp lệ');
        await client.query('INSERT INTO assignment_students(assignment_id,student_id) VALUES($1,$2)', [recordId, studentId]);
      }
      await audit(client, request.user.id, 'assignment', recordId, method === 'post' ? 'create' : 'update');
    });
    response.status(method === 'post' ? 201 : 200).json({ id: recordId });
  });
}
adminController.delete('/assignments/:id', async (request, response) => {
  const recordId = validId(request.params.id);
  await transaction(async client => {
    await requireRecord(client, 'assignments', recordId);
    const used = await client.query('SELECT 1 FROM attempts WHERE assignment_id=$1', [recordId]);
    assert(!used.rowCount, 409, 'Giao bài đã có lượt làm không được xóa');
    await client.query("UPDATE assignments SET status='cancelled' WHERE id=$1", [recordId]);
    await audit(client, request.user.id, 'assignment', recordId, 'cancel');
  });
  response.json({ cancelled: true });
});
adminController.get('/results', async (request, response) => {
  await expireAttempts();
  let items = (await pool.query(`SELECT at.*,u.full_name,u.student_code,COALESCE(at.snapshot->>'classId',u.class_id::text) AS class_id,COALESCE(at.snapshot->>'className',c.name) AS class_name,q.subject_id FROM attempts at JOIN users u ON u.id=at.user_id JOIN quizzes q ON q.id=at.quiz_id LEFT JOIN classes c ON c.id=u.class_id WHERE at.status='submitted' ORDER BY at.submitted_at DESC,at.id`)).rows.map(row => ({ ...summary(row), title: row.snapshot.title, subjectName: row.snapshot.subjectName }));
  for (const field of ['classId', 'subjectId', 'quizId']) if (request.query[field]) items = items.filter(item => item[field] === request.query[field]);
  if (request.query.studentId) items = items.filter(item => item.userId === request.query.studentId);
  if (request.query.q) items = items.filter(item => `${item.title} ${item.fullName} ${item.studentCode}`.toLowerCase().includes(String(request.query.q).toLowerCase()));
  response.json(listing(items, request.query));
});
