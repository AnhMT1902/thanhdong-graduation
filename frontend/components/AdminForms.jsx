'use client';
import Select from './Select';
import { useRef, useState } from 'react';
import { api, useCatalog, localDate } from '../lib/client';
import { useSession } from './Shell';
import { Field, Loading, Modal, Badge, Confirm } from './ui';

export function StudentForm({ initial = {}, onSaved }) {
  const classes = useCatalog('/admin/classes');
  const { notify } = useSession();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  if (classes.loading) return <Loading />;
  if (classes.error) return <p role="alert">{classes.error}</p>;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setErrors({}); setFormError('');
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const body = { fullName: form.get('fullName'), email: form.get('email'), studentCode: form.get('studentCode'), classId: form.get('classId') || null, status: form.get('status') };
    if (form.get('password')) body.password = form.get('password');
    try { await api(initial.id ? `/admin/students/${initial.id}` : '/admin/students', { method: initial.id ? 'PATCH' : 'POST', body }); notify('Đã lưu học sinh'); onSaved(); }
    catch (error) {
      setErrors(error.fields || {}); setFormError(Object.keys(error.fields || {}).length ? '' : error.message);
      formElement.elements.namedItem(Object.keys(error.fields || {})[0])?.focus();
    }
    finally { setBusy(false); }
  }
  return <form className="stack" onSubmit={submit} onChange={event => { const name = event.target.name; setErrors(current => ({ ...current, [name]: undefined })); setFormError(''); }}><div className="form-row"><Field label="Họ và tên"><input className="input" name="fullName" defaultValue={initial.fullName || ''} required maxLength={200} /></Field><Field label="Mã học sinh" error={errors.studentCode}><input className="input" name="studentCode" defaultValue={initial.studentCode || ''} required maxLength={40} /></Field></div><div className="form-row"><Field label="Email" error={errors.email}><input className="input" type="email" name="email" defaultValue={initial.email || ''} required /></Field><Field label={initial.id ? 'Mật khẩu mới nếu cần' : 'Mật khẩu ban đầu'}><input className="input" type="password" name="password" required={!initial.id} minLength={8} maxLength={128} autoComplete="new-password" /></Field></div><div className="form-row"><Field label="Lớp chính"><Select className="select" name="classId" defaultValue={initial.classId || ''}><option value="">Chưa gán lớp</option>{classes.data?.items.filter(item => item.status === 'active' || item.id === initial.classId).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</Select></Field><Field label="Trạng thái"><Select className="select" name="status" defaultValue={initial.status || 'active'}><option value="active">Hoạt động</option><option value="inactive">Vô hiệu hóa</option></Select></Field></div><p className="small muted">Một học sinh chỉ thuộc một lớp chính. Đặt lại mật khẩu hoặc vô hiệu hóa sẽ thu hồi phiên đăng nhập.</p>{formError && <p className="error-text" role="alert">{formError}</p>}<div className="modal-footer"><button className="btn primary" disabled={busy || classes.loading}>{busy ? 'Đang lưu…' : 'Lưu học sinh'}</button></div></form>;
}

export function CatalogForm({ kind, initial = {}, onSaved }) {
  const subjects = useCatalog('/admin/subjects');
  const [selected, setSelected] = useState(initial.subjectIds || []);
  const [busy, setBusy] = useState(false);
  const { notify } = useSession();
  const isClass = kind === 'classes';
  if (isClass && subjects.loading) return <Loading />;
  if (isClass && subjects.error) return <p role="alert">{subjects.error}</p>;
  async function submit(event) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = { code: form.get('code'), name: form.get('name'), status: form.get('status'), ...(isClass ? { grade: form.get('grade'), subjectIds: selected } : { gradeScope: form.get('grade') }) };
    try { await api(`/admin/${kind}${initial.id ? `/${initial.id}` : ''}`, { method: initial.id ? 'PATCH' : 'POST', body }); notify('Đã lưu dữ liệu'); onSaved(); }
    catch (error) { notify(error.message, true); }
    finally { setBusy(false); }
  }
  return <form className="stack" onSubmit={submit}><div className="form-row"><Field label={isClass ? 'Mã lớp' : 'Mã môn'}><input className="input" name="code" required defaultValue={initial.code || ''} maxLength={40} /></Field><Field label={isClass ? 'Tên lớp' : 'Tên môn'}><input className="input" name="name" required defaultValue={initial.name || ''} maxLength={200} /></Field></div><div className="form-row"><Field label="Khối"><input className="input" name="grade" defaultValue={initial.grade || initial.gradeScope || ''} maxLength={40} /></Field><Field label="Trạng thái"><Select className="select" name="status" defaultValue={initial.status || 'active'}><option value="active">Hoạt động</option><option value="inactive">Vô hiệu hóa</option></Select></Field></div>{isClass && <Field label="Môn học của lớp"><div className="check-list">{subjects.data?.items.map(item => <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(value => value !== item.id))} />{item.name}</label>)}</div></Field>}<div className="modal-footer"><button className="btn primary" disabled={busy || isClass && subjects.loading}>{busy ? 'Đang lưu…' : 'Lưu'}</button></div></form>;
}

export function QuestionForm({ initial = {}, onSaved, subjectLocked = false }) {
  const subjects = useCatalog('/admin/subjects');
  const { notify } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [content, setContent] = useState(initial.content || '');
  const [explanation, setExplanation] = useState(initial.explanation || '');
  const [options, setOptions] = useState(initial.options?.map(option => option.content) || ['', '', '', '']);
  const [correct, setCorrect] = useState(Math.max(0, initial.options?.findIndex(option => option.isCorrect) ?? 0));
  const formRef = useRef(null);
  const lastInput = useRef(null);
  if (subjects.loading) return <Loading />;
  if (subjects.error) return <p role="alert">{subjects.error}</p>;
  async function submit(event) {
    event.preventDefault(); event.stopPropagation(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const body = { subjectId: subjectLocked ? initial.subjectId : form.get('subjectId'), content, type: 'single', difficulty: form.get('difficulty'), explanation, options: options.map((value, index) => ({ content: value, isCorrect: index === correct })) };
    try {
      const saved = await api(`/admin/questions${initial.id ? `/${initial.id}` : ''}`, { method: initial.id ? 'PATCH' : 'POST', body });
      notify('Đã lưu câu hỏi'); onSaved({ ...body, ...saved });
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  function remove(index) { setOptions(current => current.filter((_, position) => position !== index)); setCorrect(current => current === index ? 0 : current > index ? current - 1 : current); }
  function insertSymbol(symbol) {
    const input = lastInput.current?.isConnected ? lastInput.current : formRef.current.elements.namedItem('content');
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const value = input.value.slice(0, start) + symbol + input.value.slice(end);
    if (value.length > input.maxLength) return;
    if (input.name === 'content') setContent(value);
    else if (input.name === 'explanation') setExplanation(value);
    else setOptions(current => current.map((option, index) => index === Number(input.dataset.option) ? value : option));
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + symbol.length, start + symbol.length); });
  }
  return <form ref={formRef} className="stack" onSubmit={submit} onFocusCapture={event => { if (event.target.matches('textarea,input[data-option]')) lastInput.current = event.target; }}>
    <div className="form-row"><Field label="Môn học"><Select className="select" name="subjectId" defaultValue={initial.subjectId || ''} required disabled={subjectLocked || busy}><option value="">Chọn môn</option>{subjects.data?.items.filter(item => item.status === 'active' || item.id === initial.subjectId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label="Độ khó"><Select className="select" name="difficulty" defaultValue={initial.difficulty || 'medium'} disabled={busy}><option value="easy">Dễ</option><option value="medium">Trung bình</option><option value="hard">Khó</option></Select></Field></div>
    <div className="question-help"><strong>Nhập câu hỏi và chọn một đáp án đúng</strong><p className="small">Có thể gõ hoặc dán văn bản, ký tự như x², √, α. Bấm vào nội dung, lựa chọn hoặc giải thích rồi chọn ký tự để chèn tại con trỏ.</p><p className="small muted">Bản hiện tại chưa hỗ trợ tải hình hoặc dựng công thức LaTeX/phân số nhiều tầng. Ký tự được hiển thị như văn bản, không phải công thức được render.</p></div>
    <div className="symbol-toolbar" role="group" aria-label="Chèn ký tự vào ô đang nhập">{['²', '³', '√', 'π', 'α', 'β', 'Δ', 'θ', '±', '×', '÷', '≤', '≥', '°'].map(symbol => <button key={symbol} type="button" className="btn secondary" disabled={busy} aria-label={`Chèn ký tự ${symbol}`} onMouseDown={event => event.preventDefault()} onClick={() => insertSymbol(symbol)}>{symbol}</button>)}</div>
    <Field label="Nội dung câu hỏi"><textarea className="textarea" name="content" required value={content} onChange={event => setContent(event.target.value)} maxLength={5000} disabled={busy} placeholder="Ví dụ: Diện tích hình vuông cạnh 3 cm là bao nhiêu?" /></Field>
    <div className="field"><label>Các lựa chọn — đánh dấu đúng một đáp án đúng</label><div className="draft-options">{options.map((value, index) => <div className="draft-option" key={index}><input type="radio" value={index} aria-label={`Đáp án đúng số ${index + 1}`} name="correctOption" checked={correct === index} disabled={busy} onChange={() => setCorrect(index)} /><input className="input" name={`option-${index}`} data-option={index} aria-label={`Lựa chọn ${index + 1}`} value={value} required maxLength={2000} disabled={busy} onChange={event => setOptions(current => current.map((item, position) => position === index ? event.target.value : item))} /><button type="button" className="icon-btn" aria-label={`Xóa lựa chọn ${index + 1}`} disabled={busy || options.length <= 2} onClick={() => remove(index)}>×</button></div>)}</div><button className="btn secondary" type="button" disabled={busy || options.length >= 8} onClick={() => setOptions(current => [...current, ''])}>Thêm lựa chọn</button></div>
    <Field label="Giải thích nếu có"><textarea className="textarea" name="explanation" value={explanation} onChange={event => setExplanation(event.target.value)} maxLength={5000} disabled={busy} /></Field>
    <details><summary>Xem trước câu hỏi</summary><div className="stack question-preview"><strong>{content || 'Chưa nhập nội dung câu hỏi'}</strong>{options.map((value, index) => <div key={index}>{String.fromCharCode(65 + index)}. {value || '(Chưa nhập lựa chọn)'}{index === correct && <Badge>Đáp án đúng</Badge>}</div>)}{explanation && <p>Giải thích: {explanation}</p>}</div></details>
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="modal-footer"><button className="btn primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu câu hỏi'}</button></div>
  </form>;
}

export function QuizForm({ initial = {}, onSaved }) {
  const subjects = useCatalog('/admin/subjects');
  const questions = useCatalog('/admin/questions');
  const [subjectId, setSubjectId] = useState(initial.subjectId || '');
  const [selected, setSelected] = useState(initial.questions || []);
  const [pendingSubject, setPendingSubject] = useState(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { notify } = useSession();
  const readonly = initial.status && initial.status !== 'draft';
  if (subjects.loading || questions.loading) return <Loading />;
  if (subjects.error || questions.error) return <p role="alert">{subjects.error || questions.error}</p>;
  const available = questions.data.items.filter(item => item.subjectId === subjectId);
  const matching = available.filter(item => item.content.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const body = { title: form.get('title'), subjectId, description: form.get('description'), durationMinutes: Number(form.get('durationMinutes')), questions: selected.map(item => ({ questionId: item.questionId, points: Number(item.points) })) };
    try { await api(`/admin/quizzes${initial.id ? `/${initial.id}` : ''}`, { method: initial.id ? 'PATCH' : 'POST', body }); notify('Đã lưu đề nháp'); onSaved(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  function added(question) {
    questions.setData(current => ({ ...current, items: [...current.items, question] }));
    setSelected(current => [...current, { questionId: question.id, points: 1 }]);
    setSearch(''); setCreating(false);
    notify('Đã tạo câu hỏi và chọn vào đề. Hãy lưu đề nháp để giữ danh sách đã chọn.');
  }
  return <form className="stack" onSubmit={submit}>
    {!readonly && <div className="question-help"><strong>1. Chọn môn → 2. Chọn hoặc tạo câu hỏi → 3. Lưu đề nháp</strong><p className="small">Câu hỏi lấy từ ngân hàng cùng môn. Bạn có thể tạo ngay tại đây, không phải rời màn hình và nhập lại thông tin đề.</p></div>}
    <Field label="Tên đề kiểm tra"><input className="input" name="title" defaultValue={initial.title || ''} required disabled={readonly || busy} maxLength={200} /></Field>
    <div className="form-row"><Field label="Môn học"><Select className="select" name="subjectId" value={subjectId} disabled={readonly || busy} required onChange={event => { if (selected.length && event.target.value !== subjectId) { setPendingSubject(event.target.value); return; } setSubjectId(event.target.value); setSelected([]); setSearch(''); }}><option value="">Chọn môn</option>{subjects.data.items.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</Select></Field><Field label="Thời lượng phút"><input className="input" name="durationMinutes" type="number" min={1} max={180} required disabled={readonly || busy} defaultValue={initial.durationMinutes || 15} /></Field></div>
    <Field label="Mô tả"><textarea className="textarea" name="description" defaultValue={initial.description || ''} disabled={readonly || busy} /></Field>
    <section className="stack" aria-label="Câu hỏi của đề"><div className="row between"><div><h2 className="section-title">Câu hỏi của đề</h2><p className="small muted">Đã chọn {selected.length}/100 câu. Trọng số mặc định là 1; có thể điều chỉnh từng câu.</p></div>{!readonly && <button type="button" className="btn secondary" disabled={!subjectId || busy || selected.length >= 100} onClick={() => setCreating(true)}>Tạo câu hỏi mới</button>}</div>
      {!subjectId ? <p className="question-help">Chọn môn học trước để xem câu hỏi và mở nút tạo câu hỏi mới.</p> : !available.length ? <div className="question-help"><strong>Môn này chưa có câu hỏi</strong><p className="small">Bấm “Tạo câu hỏi mới” để nhập nội dung, các lựa chọn và đánh dấu đáp án đúng.</p></div> : <><Field label="Tìm câu hỏi của môn"><input className="input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nhập nội dung cần tìm…" /></Field><div className="check-list">{matching.length ? matching.map(item => { const chosen = selected.find(question => question.questionId === item.id); return <div className="question-choice" key={item.id}><label><input type="checkbox" disabled={readonly || busy || (!chosen && selected.length >= 100)} checked={!!chosen} onChange={event => setSelected(current => event.target.checked ? [...current, { questionId: item.id, points: 1 }] : current.filter(question => question.questionId !== item.id))} />{item.content}</label>{chosen && <input className="input points-input" aria-label={`Trọng số ${item.content}`} type="number" min="0.01" max="100" step="0.01" disabled={readonly || busy} value={chosen.points} onChange={event => setSelected(current => current.map(question => question.questionId === item.id ? { ...question, points: event.target.value } : question))} />}</div>; }) : <p className="small muted">Không có câu hỏi khớp từ khóa. Thử từ khóa khác hoặc tạo câu hỏi mới.</p>}</div></>}
    </section>
    <p className="small muted">{readonly ? 'Đề đã xuất bản/lưu trữ ở chế độ chỉ xem để giữ lịch sử.' : 'Câu hỏi mới được lưu vào ngân hàng ngay; danh sách đã chọn chỉ được lưu vào đề khi bấm Lưu đề nháp. Cần ít nhất một câu trước khi xuất bản.'}</p>
    {error && <p className="error-text" role="alert">{error}</p>}
    {!readonly && <div className="modal-footer"><button className="btn primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu đề nháp'}</button></div>}
    {pendingSubject !== null && <Confirm title="Đổi môn học của đề?" message="Đổi môn sẽ bỏ các câu hỏi đang chọn trong đề. Thông tin tên đề và mô tả được giữ nguyên." tone="default" cancelLabel="Giữ môn hiện tại" confirmLabel="Đổi môn" onClose={() => setPendingSubject(null)} onConfirm={() => { setSubjectId(pendingSubject); setSelected([]); setSearch(''); setPendingSubject(null); }} />}
    {creating && <Modal title="Tạo câu hỏi mới cho đề" onClose={() => setCreating(false)}><QuestionForm initial={{ subjectId }} subjectLocked onSaved={added} /></Modal>}
  </form>;
}

export function AssignmentForm({ initial = {}, onSaved }) {
  const quizzes = useCatalog('/admin/quizzes?status=published');
  const classes = useCatalog('/admin/classes');
  const students = useCatalog('/admin/students');
  const [targetType, setTargetType] = useState(initial.targetType || 'class');
  const [selected, setSelected] = useState(initial.targetType === 'student' ? initial.studentIds || [] : initial.classIds || []);
  const [busy, setBusy] = useState(false);
  const { notify } = useSession();
  if (quizzes.loading || classes.loading || students.loading) return <Loading />;
  if (quizzes.error || classes.error || students.error) return <p role="alert">{quizzes.error || classes.error || students.error}</p>;
  async function submit(event) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = { quizId: form.get('quizId'), targetType, classIds: targetType === 'class' ? selected : [], studentIds: targetType === 'student' ? selected : [], openAt: new Date(form.get('openAt')).toISOString(), dueAt: new Date(form.get('dueAt')).toISOString(), maxAttempts: Number(form.get('maxAttempts')), showAnswersAfterSubmit: form.get('showAnswers') === 'on' };
    try { await api(`/admin/assignments${initial.id ? `/${initial.id}` : ''}`, { method: initial.id ? 'PATCH' : 'POST', body }); notify('Đã lưu giao bài'); onSaved(); }
    catch (error) { notify(error.message, true); }
    finally { setBusy(false); }
  }
  const targets = (targetType === 'class' ? classes.data?.items : students.data?.items)?.filter(item => item.status === 'active') || [];
  return <form className="stack assignment-form" onSubmit={submit}>
    <div className="form-row">
      <Field label="Đề đã xuất bản"><Select className="select" name="quizId" defaultValue={initial.quizId || ''} required disabled={busy}><option value="">Chọn đề kiểm tra</option>{quizzes.data?.items.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</Select></Field>
      <Field label="Loại đối tượng"><Select className="select" value={targetType} disabled={busy} onChange={event => { setTargetType(event.target.value); setSelected([]); }}><option value="class">Giao cho lớp</option><option value="student">Giao cho học sinh</option></Select></Field>
    </div>
    <div className="field assignment-targets">
      <span id="assignment-targets-label" className="assignment-targets-label">{targetType === 'class' ? 'Chọn một hoặc nhiều lớp' : 'Chọn một hoặc nhiều học sinh'} <span className="small muted">(đã chọn {selected.length})</span></span>
      <div className="check-list" role="group" aria-labelledby="assignment-targets-label" tabIndex={0}>{targets.length ? targets.map(item => <label key={item.id}><input type="checkbox" disabled={busy} checked={selected.includes(item.id)} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(value => value !== item.id))} />{item.name || `${item.studentCode} — ${item.fullName}`}</label>) : <p className="small muted">{targetType === 'class' ? 'Chưa có lớp hoạt động.' : 'Chưa có học sinh hoạt động.'}</p>}</div>
    </div>
    <div className="form-row">
      <Field label="Giờ mở — giờ trên máy bạn"><input className="input" type="datetime-local" name="openAt" required disabled={busy} defaultValue={localDate(initial.openAt || Date.now())} /></Field>
      <Field label="Hạn nộp — giờ trên máy bạn"><input className="input" type="datetime-local" name="dueAt" required disabled={busy} defaultValue={localDate(initial.dueAt || Date.now() + 86400000)} /></Field>
    </div>
    <div className="form-row assignment-options">
      <Field label="Số lượt tối đa"><input className="input" type="number" name="maxAttempts" min={1} max={10} required disabled={busy} defaultValue={initial.maxAttempts || 1} /></Field>
      <label className="checkbox-field"><input className="checkbox" type="checkbox" name="showAnswers" disabled={busy} defaultChecked={initial.showAnswersAfterSubmit ?? true} /><span>Cho xem đáp án đúng và giải thích sau khi nộp</span></label>
    </div>
    <p className="small muted">Giao bài đã có lượt làm không được thay đổi hoặc xóa để bảo toàn lịch sử.</p>
    <div className="modal-footer"><button className="btn primary" disabled={busy || quizzes.loading || classes.loading || students.loading}>{busy ? 'Đang lưu…' : 'Lưu giao bài'}</button></div>
  </form>;
}
