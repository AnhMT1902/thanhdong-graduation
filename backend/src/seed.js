import { fileURLToPath } from 'node:url';
import { pool, transaction } from './db.js';
import { id, hashPassword } from './security.js';
import { migrate } from './migrate.js';

export const demoIds = {
  admin: '10000000-0000-4000-8000-000000000001',
  student1: '10000000-0000-4000-8000-000000000002',
  student2: '10000000-0000-4000-8000-000000000003',
  student3: '10000000-0000-4000-8000-000000000004',
  class1: '20000000-0000-4000-8000-000000000001',
  class2: '20000000-0000-4000-8000-000000000002',
  math: '30000000-0000-4000-8000-000000000001',
  informatics: '30000000-0000-4000-8000-000000000002',
  quiz1: '40000000-0000-4000-8000-000000000001',
  quiz2: '40000000-0000-4000-8000-000000000002',
  quiz3: '40000000-0000-4000-8000-000000000003',
  assignment1: '50000000-0000-4000-8000-000000000001',
  assignment2: '50000000-0000-4000-8000-000000000002',
  assignment3: '50000000-0000-4000-8000-000000000003'
};

export async function seed() {
  const passwordHash = await hashPassword(process.env.DEMO_PASSWORD || 'Demo12345!');
  await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('quizify_seed'))");
    if ((await client.query("SELECT 1 FROM users WHERE role='admin' LIMIT 1")).rowCount) return;
    for (const [classId, code, name] of [[demoIds.class1, 'DEMO-A', 'Lớp Demo A'], [demoIds.class2, 'DEMO-B', 'Lớp Demo B']]) await client.query('INSERT INTO classes(id,code,name,grade) VALUES($1,$2,$3,$4)', [classId, code, name, '12']);
    for (const [subjectId, code, name] of [[demoIds.math, 'TOAN', 'Toán học'], [demoIds.informatics, 'TIN', 'Tin học']]) await client.query('INSERT INTO subjects(id,code,name,grade_scope) VALUES($1,$2,$3,$4)', [subjectId, code, name, '12']);
    for (const classId of [demoIds.class1, demoIds.class2]) for (const subjectId of [demoIds.math, demoIds.informatics]) await client.query('INSERT INTO class_subjects(class_id,subject_id) VALUES($1,$2)', [classId, subjectId]);
    const users = [[demoIds.admin, 'admin', 'Giáo viên Demo', 'admin@quizify.test', null, null], [demoIds.student1, 'student', 'Học sinh Demo 01', 'hs01@quizify.test', 'HS001', demoIds.class1], [demoIds.student2, 'student', 'Học sinh Demo 02', 'hs02@quizify.test', 'HS002', demoIds.class1], [demoIds.student3, 'student', 'Học sinh Demo 03', 'hs03@quizify.test', 'HS003', demoIds.class2]];
    for (const [userId, role, fullName, email, code, classId] of users) await client.query('INSERT INTO users(id,role,full_name,email,student_code,password_hash,class_id) VALUES($1,$2,$3,$4,$5,$6,$7)', [userId, role, fullName, email, code, passwordHash, classId]);
    const questionData = [
      [demoIds.math, 'Giá trị của 2 + 3 là bao nhiêu?', ['4', '5', '6', '7'], 1, '2 cộng 3 bằng 5.'],
      [demoIds.math, 'Nghiệm của phương trình x + 4 = 10 là gì?', ['4', '5', '6', '14'], 2, 'Trừ 4 hai vế, được x = 6.'],
      [demoIds.math, 'Diện tích hình vuông cạnh 3 cm là bao nhiêu?', ['6 cm²', '9 cm²', '12 cm²', '3 cm²'], 1, 'Diện tích hình vuông bằng cạnh nhân cạnh: 3 × 3 = 9.'],
      [demoIds.informatics, 'HTTP được sử dụng chủ yếu để làm gì?', ['Truyền dữ liệu web', 'Định dạng ổ đĩa', 'Tính toán đồ họa', 'Mã hóa mọi file'], 0, 'HTTP là giao thức truyền tải dữ liệu giữa client và server trên web.'],
      [demoIds.informatics, 'Khóa chính của bảng có đặc điểm nào?', ['Có thể trùng tùy ý', 'Có thể NULL tùy ý', 'Nhận diện duy nhất mỗi bản ghi', 'Chỉ lưu chuỗi'], 2, 'Khóa chính nhận diện duy nhất bản ghi và không được NULL.'],
      [demoIds.math, '10 chia 2 bằng bao nhiêu?', ['2', '5', '10', '20'], 1, '10 / 2 = 5.']
    ];
    const questionIds = [];
    for (const [subjectId, content, choices, correctIndex, explanation] of questionData) {
      const questionId = id();
      questionIds.push(questionId);
      await client.query("INSERT INTO questions(id,subject_id,content,type,explanation,created_by) VALUES($1,$2,$3,'single',$4,$5)", [questionId, subjectId, content, explanation, demoIds.admin]);
      for (const [index, content] of choices.entries()) await client.query('INSERT INTO answer_options(id,question_id,content,is_correct,sort_order) VALUES($1,$2,$3,$4,$5)', [id(), questionId, content, index === correctIndex, index]);
    }
    const quizzes = [[demoIds.quiz1, 'Kiểm tra Toán cơ bản', demoIds.math, [0, 1, 2]], [demoIds.quiz2, 'Ôn tập kiến thức Tin học', demoIds.informatics, [3, 4]], [demoIds.quiz3, 'Luyện tập Toán cá nhân', demoIds.math, [0, 1]]];
    for (const [quizId, title, subjectId, indexes] of quizzes) {
      await client.query("INSERT INTO quizzes(id,title,subject_id,description,duration_minutes,status,created_by,published_at) VALUES($1,$2,$3,'Đề demo với dữ liệu giả lập',15,'published',$4,now())", [quizId, title, subjectId, demoIds.admin]);
      for (const [order, questionIndex] of indexes.entries()) await client.query('INSERT INTO quiz_questions(quiz_id,question_id,sort_order,points) VALUES($1,$2,$3,1)', [quizId, questionIds[questionIndex], order]);
    }
    const draftId = id();
    await client.query("INSERT INTO quizzes(id,title,subject_id,description,duration_minutes,created_by) VALUES($1,'Đề Toán nháp', $2,'Dùng để thử chỉnh sửa và xuất bản',10,$3)", [draftId, demoIds.math, demoIds.admin]);
    await client.query('INSERT INTO quiz_questions(quiz_id,question_id,sort_order,points) VALUES($1,$2,0,1)', [draftId, questionIds[5]]);
    for (const [assignmentId, quizId, targetType] of [[demoIds.assignment1, demoIds.quiz1, 'class'], [demoIds.assignment2, demoIds.quiz2, 'class'], [demoIds.assignment3, demoIds.quiz3, 'student']]) {
      await client.query("INSERT INTO assignments(id,quiz_id,target_type,open_at,due_at,max_attempts,show_answers_after_submit,created_by) VALUES($1,$2,$3,now()-interval '1 day',now()+interval '30 days',3,true,$4)", [assignmentId, quizId, targetType, demoIds.admin]);
      if (targetType === 'class') await client.query('INSERT INTO assignment_classes(assignment_id,class_id) VALUES($1,$2)', [assignmentId, demoIds.class1]);
      else await client.query('INSERT INTO assignment_students(assignment_id,student_id) VALUES($1,$2)', [assignmentId, demoIds.student2]);
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await migrate();
  await seed();
  await pool.end();
}
