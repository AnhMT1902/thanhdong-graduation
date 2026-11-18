const textFields = ['name', 'title', 'content', 'fullName', 'studentCode', 'email', 'code', 'subjectName', 'className', 'targetLabels'];
const numericFields = new Set(['studentCount', 'durationMinutes', 'questionCount', 'maxAttempts', 'attemptNumber', 'score', 'timeUsedSeconds']);
const sortFields = new Set([...textFields, ...numericFields, 'status', 'difficulty', 'grade', 'gradeScope', 'targetType', 'createdAt', 'startedAt', 'submittedAt', 'openAt', 'dueAt']);

export function listRecords(records, query = {}) {
  const items = records.filter(record => {
    if (query.q && !textFields.map(field => record[field]).filter(Boolean).join(' ').toLocaleLowerCase('vi').includes(String(query.q).trim().toLocaleLowerCase('vi'))) return false;
    for (const field of ['status', 'difficulty', 'subjectId', 'quizId', 'targetType']) {
      if (query[field] && record[field] !== query[field]) return false;
    }
    if (query.grade && String(record.grade ?? record.gradeScope ?? '') !== String(query.grade)) return false;
    if (query.classId && (query.classId === 'unassigned' ? !!record.classId : record.classId !== query.classId && !record.classIds?.includes(query.classId))) return false;
    if (query.studentId && record.userId !== query.studentId && !record.studentIds?.includes(query.studentId)) return false;
    if (query.result === 'pass' && !(Number(record.score) >= 5)) return false;
    if (query.result === 'fail' && !(Number(record.score) < 5)) return false;
    return true;
  });
  const sort = String(query.sort || '');
  const direction = sort.endsWith('_desc') || sort === 'latest' || sort === 'score' ? -1 : 1;
  const field = sort === 'latest' || sort === 'oldest' ? 'timestamp' : sort === 'title' ? 'title' : sort === 'score' ? 'score' : sort === 'due' ? 'dueAt' : sort.replace(/_(asc|desc)$/, '');
  if (!sortFields.has(field) && field !== 'timestamp') return items;
  const value = record => field === 'name' ? record.name ?? record.title ?? record.fullName ?? record.content : field === 'timestamp' ? record.submittedAt ?? record.createdAt ?? record.startedAt : record[field];
  items.sort((first, second) => {
    const firstValue = value(first), secondValue = value(second);
    if (firstValue == null && secondValue != null) return 1;
    if (secondValue == null && firstValue != null) return -1;
    let compared = 0;
    if (firstValue != null && secondValue != null) {
      if (numericFields.has(field)) compared = Number(firstValue) - Number(secondValue);
      else if (field === 'timestamp' || field.endsWith('At')) compared = Date.parse(firstValue) - Date.parse(secondValue);
      else if (field === 'difficulty') compared = ['easy', 'medium', 'hard'].indexOf(firstValue) - ['easy', 'medium', 'hard'].indexOf(secondValue);
      else compared = String(firstValue).localeCompare(String(secondValue), 'vi', { numeric: true });
    }
    return compared * direction || String(first.id).localeCompare(String(second.id));
  });
  return items;
}
