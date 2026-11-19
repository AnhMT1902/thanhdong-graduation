import { HttpError } from '../security.js';

export function notFound(request, response, next) {
  next(new HttpError(404, 'Không tìm thấy API'));
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);
  let status = error.status || 500;
  let message = error.message;
  let fields;
  if (error.code === '23505') {
    status = 409;
    const conflicts = { users_student_code_key: ['studentCode', 'Mã học sinh đã tồn tại'], users_email_key: ['email', 'Email đã tồn tại'] };
    const conflict = conflicts[error.constraint];
    if (conflict) { message = conflict[1]; fields = { [conflict[0]]: message }; }
    else message = error.constraint === 'one_active_attempt_per_student' ? 'Bạn đang có một lượt làm bài khác' : 'Dữ liệu này đã tồn tại; vui lòng kiểm tra lại';
  }
  if (error.code === '23503') { status = 409; message = 'Dữ liệu đang được sử dụng; không thể xóa hoặc thay đổi liên kết'; }
  if (error.code === '23514') { status = 400; message = 'Dữ liệu không thỏa quy tắc hệ thống'; }
  if (status >= 500) { console.error(error); message = 'Có lỗi hệ thống. Vui lòng thử lại'; }
  response.status(status).json({ error: message, ...(fields ? { fields } : {}) });
}