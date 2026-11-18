'use client';
import Select from './Select';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, useLoad, useCatalog, date, score, time } from '../lib/client';
import { useSession } from './Shell';
import { Heading, Badge, DataTable, Pagination, LoadState, Empty, Stat, Confirm } from './ui';
import Profile from './Profile';

function AssignmentAction({ item, onStartError }) {
  const { notify, refreshActive } = useSession();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function start() {
    setBusy(true);
    try { const attempt = await api(`/user/assignments/${item.id}/attempts`, { method: 'POST' }); await refreshActive(); router.push(`/user/assignments/${item.id}/attempt/${attempt.id}`); }
    catch (error) { notify(error.message, true); onStartError?.(); }
    finally { setBusy(false); }
  }
  return (item.activeAttempt ? <Link className="btn primary" href={`/user/assignments/${item.id}/attempt/${item.activeAttempt.id}`}>Tiếp tục</Link> : item.bestAttempt && !item.canStart ? <Link className="btn secondary" href={`/user/results/${item.bestAttempt.id}`}>Xem kết quả</Link> : <button type="button" className="btn primary" disabled={!item.canStart || busy} onClick={start}>{busy ? 'Đang mở…' : item.state === 'locked' ? 'Đang khóa' : item.canStart ? item.bestAttempt ? 'Làm lại' : 'Bắt đầu' : item.attemptsRemaining === 0 ? 'Hết lượt' : item.state === 'upcoming' ? 'Chưa mở' : item.state === 'overdue' ? 'Quá hạn' : 'Đã đóng'}</button>);
}

function AssignmentCard({ item }) {
  const schedule = item.state === 'upcoming' ? item.openAt : item.dueAt;
  const scheduleLabel = item.state === 'upcoming' ? 'Mở vào' : 'Hạn nộp';
  const scheduleText = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(schedule));
  return <article className="card assignment-card">
    <div className="assignment-topline"><span className="small muted">{item.subjectName}</span><Badge state={item.state} /></div>
    <h2 className="section-title"><Link className="link-button" href={`/user/assignments/${item.id}/history`}>{item.title}</Link></h2>
    <p className="assignment-meta">{item.durationMinutes} phút <span aria-hidden="true">·</span> {item.questionCount} câu</p>
    <p className="assignment-schedule"><span>{scheduleLabel}</span><time dateTime={schedule}>{scheduleText}</time></p>
    <div className="assignment-footer">
      {item.bestAttempt && <span className="assignment-score small">Điểm tốt nhất <strong>{score(item.bestAttempt.score)}/10</strong></span>}
      <AssignmentAction item={item} />
    </div>
  </article>;

}

function Dashboard() {
  const { user, active } = useSession();
  const resource = useLoad('/user/dashboard');
  useEffect(() => { resource.reload(); }, [active?.id]);
  return <div className="stack"><Heading title="Tổng quan" subtitle={`Chào mừng ${user.fullName}. Theo dõi bài được giao và kết quả học tập của bạn`} /><LoadState resource={resource}>{data => <><div className="grid grid-3"><Stat label="Bài được giao" value={data.assignmentCount} /><Stat label="Lượt đã nộp" value={data.submittedCount} /><Stat label="Bài đang làm" value={data.activeAttempt ? 1 : 0} /></div>{data.activeAttempt && <div className="attempt-banner"><div><strong>Bạn có bài đang làm</strong><p className="small">Các bài khác đang khóa. Hãy tiếp tục hoặc nộp bài hiện tại.</p></div><Link className="btn primary" href={`/user/assignments/${data.activeAttempt.assignmentId}/attempt/${data.activeAttempt.id}`}>Tiếp tục làm bài</Link></div>}<div className="row between"><h2 className="section-title">Bài được giao</h2><Link className="link-button" href="/user/assignments">Xem tất cả</Link></div>{data.assignments.length ? <div className="grid grid-2">{data.assignments.slice(0, 4).map(item => <AssignmentCard key={item.id} item={item} />)}</div> : <Empty title="Chưa có bài được giao" />}<section className="panel"><div className="panel-header"><h2 className="section-title">Kết quả gần đây</h2><Link className="link-button" href="/user/results">Kết quả của tôi</Link></div>{data.results.length ? <DataTable headers={['Bài kiểm tra', 'Môn', 'Điểm', 'Nộp lúc', 'Thao tác']} rows={data.results.map(result => [result.title, result.subjectName, `${score(result.score)}/10`, date(result.submittedAt), <Link key={result.id} className="link-button" href={`/user/results/${result.id}`}>Xem kết quả</Link>])} /> : <Empty title="Chưa có kết quả" description="Bạn chưa hoàn thành bài kiểm tra nào." />}</section></>}</LoadState></div>;
}

function useFilters() {
  const [filters, setFilters] = useState({ q: '', subjectId: '', status: '', result: '', sort: 'latest', page: 1, pageSize: 8 });
  const set = (key, value) => setFilters(previous => ({ ...previous, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) }));
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '')).toString();
  const reset = () => setFilters(current => ({ ...current, q: '', subjectId: '', status: '', result: '', page: 1 }));
  return { filters, set, query, reset };
}

function StudentFilters({ filters, set, subjects, reset, results = false }) {
  return <div className="toolbar"><input className="input" aria-label="Tìm kiếm" placeholder="Tìm bài kiểm tra…" value={filters.q} onChange={event => set('q', event.target.value)} /><Select className="select compact" aria-label="Lọc môn học" value={filters.subjectId} onChange={event => set('subjectId', event.target.value)}><option value="">Tất cả môn học</option>{subjects.map(subject => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</Select><Select className="select compact" aria-label={results ? 'Lọc kết quả' : 'Lọc trạng thái'} value={results ? filters.result : filters.status} onChange={event => set(results ? 'result' : 'status', event.target.value)}><option value="">{results ? 'Tất cả kết quả' : 'Tất cả trạng thái'}</option>{(results ? [['pass', 'Từ 5 điểm'], ['fail', 'Dưới 5 điểm']] : [['not_started', 'Chưa làm'], ['in_progress', 'Đang làm'], ['submitted', 'Đã nộp'], ['locked', 'Đang khóa'], ['upcoming', 'Chưa mở'], ['overdue', 'Quá hạn']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>{!results && <Select className="select compact" aria-label="Sắp xếp" value={filters.sort} onChange={event => set('sort', event.target.value)}><option value="latest">Mới nhất</option><option value="title">Tên bài</option>{results && <option value="score">Điểm cao nhất</option>}{!results && <option value="due">Hạn nộp gần nhất</option>}</Select>}<button type="button" className="btn secondary filter-reset" disabled={!filters.q && !filters.subjectId && !filters.status && !filters.result} onClick={reset}>Xóa bộ lọc</button></div>;
}

function Assigned() {
  const { filters, set, query, reset } = useFilters();
  const catalog = useCatalog('/user/assignments');
  const resource = useLoad(`/user/assignments?${query}`);
  const { active } = useSession();
  useEffect(() => { resource.reload(); }, [active?.id]);
  const subjects = [...new Map((catalog.data?.items || []).map(item => [item.subjectId, { id: item.subjectId, name: item.subjectName }])).values()];
  return <div className="stack"><Heading title="Bài được giao" subtitle="Chỉ những bài giao cho lớp của bạn hoặc trực tiếp cho bạn" /><StudentFilters filters={filters} set={set} reset={reset} subjects={subjects} /><LoadState resource={resource}>{data => <>{data.items.length ? <div className="grid grid-2">{data.items.map(item => <AssignmentCard key={item.id} item={item} />)}</div> : <Empty title="Không có bài phù hợp" />}<Pagination data={data} onPage={page => set('page', page)} onPageSize={size => set('pageSize', size)} /></>}</LoadState></div>;
}

function History({ assignmentId }) {
  const { active } = useSession();
  const resource = useLoad(`/user/assignments/${assignmentId}/history`);
  const catalog = useCatalog('/user/assignments');
  const assignment = catalog.data?.items.find(item => item.id === assignmentId);
  useEffect(() => { catalog.reload(); resource.reload(); }, [active?.id]);
  const unavailableHints = { locked: 'Bạn đang làm bài khác. Hãy hoàn tất bài đang làm trước khi bắt đầu bài này.', upcoming: `Bài chưa mở. Bạn có thể bắt đầu từ ${date(assignment?.openAt)}.`, overdue: 'Đã quá hạn nộp. Bạn không thể bắt đầu lượt mới.', closed: 'Bài đã đóng. Bạn không thể bắt đầu lượt mới.' };
  const actionHint = assignment?.activeAttempt ? 'Bạn có lượt đang làm. Tiếp tục để không tạo thêm lượt.' : assignment?.canStart ? `Còn ${assignment.attemptsRemaining} lượt làm. Bạn có thể ${assignment.bestAttempt ? 'làm lại' : 'bắt đầu'} ngay tại đây.` : unavailableHints[assignment?.state] || (assignment?.attemptsRemaining === 0 ? 'Bạn đã dùng hết số lượt làm bài.' : 'Bài hiện chưa thể bắt đầu.');
  return <div className="stack"><Heading title="Chi tiết bài kiểm tra" subtitle="Thông tin bài được giao và lịch sử làm bài của bạn" action={<Link className="btn secondary" href="/user/assignments">Bài được giao</Link>} />
    {catalog.loading ? <p className="small muted" role="status">Đang tải thông tin bài kiểm tra…</p> : catalog.error ? <div role="alert"><p>{catalog.error}</p><button className="btn secondary" onClick={catalog.reload}>Thử tải thông tin</button></div> : assignment && <section className="panel panel-body stack assignment-details"><div className="row between"><h2 className="section-title">{assignment.title}</h2><Badge state={assignment.state} /></div><dl className="detail-grid"><div><dt>Môn học</dt><dd>{assignment.subjectName}</dd></div><div><dt>Giáo viên</dt><dd>{assignment.teacherName}</dd></div><div><dt>Đối tượng được giao</dt><dd>{assignment.targetLabels}</dd></div><div><dt>Thời lượng và số câu</dt><dd>{assignment.durationMinutes} phút · {assignment.questionCount} câu</dd></div><div><dt>Giờ mở</dt><dd>{date(assignment.openAt)}</dd></div><div><dt>Hạn nộp</dt><dd>{date(assignment.dueAt)}</dd></div><div><dt>Số lượt tối đa</dt><dd>{assignment.maxAttempts}</dd></div><div><dt>Số lượt còn lại</dt><dd>{assignment.attemptsRemaining}</dd></div></dl><div className="assignment-detail-actions"><div className="assignment-detail-status"><p>{actionHint}</p>{assignment.state === 'locked' && active && <Link className="link-button" href={`/user/assignments/${active.assignmentId}/attempt/${active.id}`}>Tiếp tục bài đang làm</Link>}</div><AssignmentAction item={assignment} onStartError={() => { catalog.reload(); resource.reload(); }} /></div></section>}
    <LoadState resource={resource}>{items => <section className="panel"><div className="panel-header"><h2 className="section-title">Lịch sử làm bài</h2></div><DataTable headers={['Lượt', 'Trạng thái', 'Bắt đầu', 'Nộp lúc', 'Thời gian', 'Tiến độ', 'Điểm', 'Thao tác']} rows={items.map(item => [item.attemptNumber, <Badge key={item.id} state={item.status} />, date(item.startedAt), date(item.submittedAt), time(item.timeUsedSeconds), `${item.progressPercent}%`, score(item.score), <Link key={item.id} className="link-button" href={item.status === 'in_progress' ? `/user/assignments/${assignmentId}/attempt/${item.id}` : `/user/results/${item.id}`}>{item.status === 'in_progress' ? 'Tiếp tục' : 'Xem kết quả'}</Link>])} /></section>}</LoadState>
  </div>;
}

function Results() {
  const { filters, set, query, reset } = useFilters();
  const resource = useLoad(`/user/results?${query}`);
  const catalog = useCatalog('/user/results');
  const subjects = [...new Map((catalog.data?.items || []).map(item => [item.subjectId, { id: item.subjectId, name: item.subjectName }])).values()];
  return <div className="stack"><Heading title="Kết quả của tôi" subtitle="Lịch sử tổng hợp các bài đã nộp của bạn" /><StudentFilters filters={filters} set={set} reset={reset} subjects={subjects} results /><LoadState resource={resource}>{data => <section className="panel"><DataTable sorting={{ sort: filters.sort, onSort: value => set('sort', value) }} sortFields={['title', 'subjectName', 'attemptNumber', 'score', 'submittedAt', 'timeUsedSeconds']} headers={['Bài kiểm tra', 'Môn', 'Lượt', 'Điểm', 'Nộp lúc', 'Thời gian']} rows={data.items.map(item => [<Link key={item.id} className="link-button" href={`/user/results/${item.id}`}>{item.title}</Link>, item.subjectName, item.attemptNumber, `${score(item.score)}/10`, date(item.submittedAt), time(item.timeUsedSeconds)])} /><Pagination data={data} onPage={page => set('page', page)} onPageSize={size => set('pageSize', size)} /></section>}</LoadState></div>;
}

function QuestionHeading({ question, index, status, flagged = false }) {
  return <div className="question-heading"><span className="question-index" aria-hidden="true">{index + 1}</span><div className="question-title"><span className="question-caption">Câu {index + 1}</span><h2 id={`question-title-${question.id}`}>{question.content}</h2></div>{(status || flagged) && <div className="question-meta">{status && <span className={`question-status ${status.kind}`}>{status.label}</span>}{flagged && <span className="question-flag-label">Đã đánh dấu</span>}</div>}</div>;
}

function AnswerRow({ question, option, index, selected, disabled, review = false, showAnswers = false, onChange }) {
  if (review) {
    const answerKey = showAnswers && option.isCorrect;
    const state = selected ? showAnswers ? answerKey ? 'correct' : 'wrong' : 'selected' : '';
    return <li className={`answer-row review-option ${state}`}>
      <span className="review-option-letter">{String.fromCharCode(65 + index)}</span>
      <span className="option-text">{option.content}</span>
      {(answerKey || selected) && <span className="option-notes">{answerKey && <span className={'option-note' + (!selected ? ' is-reference' : '')}>{selected ? 'Đáp án đúng' : 'Đáp án đúng · tham khảo'}</span>}{selected && <span className="option-note">Bạn đã chọn</span>}</span>}
    </li>;
  }
  return <label className={`answer-row option ${selected ? 'selected' : ''}`}>
    <input className="review-radio" type="radio" name={question.id} value={option.id} checked={selected} disabled={disabled} onChange={onChange} />
    <span className="option-content"><span className="option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span className="option-text">{option.content}</span></span>
  </label>;
}

function Review({ attemptId }) {
  const resource = useLoad(`/user/results/${attemptId}`);
  return <LoadState resource={resource}>{data => <div className="stack exam-page review-page">
    <div className="exam-heading"><span className="exam-eyebrow">Nhìn lại bài làm</span><Heading title={data.title} subtitle={`${data.subjectName} · Lượt ${data.attemptNumber}`} action={<Link className="btn secondary" href="/user/results">Kết quả của tôi</Link>} /></div>
    <div className="result-summary"><div className="panel panel-body stack"><h2 className="section-title">Chi tiết kết quả</h2><div className="row small muted"><Badge state="submitted" /><span>Nộp: {date(data.submittedAt)}</span><span>Thời gian: {time(data.timeUsedSeconds)}</span></div><div className="result-counts"><span className="correct">Đúng: {data.correctCount}</span><span className="wrong">Sai: {data.wrongCount}</span><span className="unanswered">Chưa làm: {data.unansweredCount}</span></div></div><div className="score-box"><span className="score-caption">Điểm bài làm</span><strong>{score(data.score)}</strong><span>/ 10 điểm</span></div></div>
    <p className="review-guidance">{data.showAnswers ? 'Màu xanh: bạn chọn đúng. Màu đỏ: bạn chọn sai. Đáp án chưa chọn chỉ để tham khảo; câu bỏ trống được 0 điểm.' : 'Giáo viên chưa cho phép xem đáp án đúng và giải thích.'}</p>
    {data.questions.map((question, index) => {
      const answer = data.answers.find(item => item.questionId === question.id);
      const selected = answer?.selectedOptionIds || [];
      const correct = question.options.filter(option => option.isCorrect).map(option => option.id);
      const status = selected.length === 0 ? { kind: 'unanswered', label: 'Chưa làm' } : !data.showAnswers ? { kind: 'answered', label: 'Đã trả lời' } : JSON.stringify([...selected].sort()) === JSON.stringify([...correct].sort()) ? { kind: 'correct', label: 'Đúng' } : { kind: 'wrong', label: 'Sai' };
      return <section className={`question-card ${answer?.flagged ? 'is-flagged' : ''}`} key={question.id} aria-labelledby={`question-title-${question.id}`}><QuestionHeading question={question} index={index} status={status} flagged={answer?.flagged} />{status.kind === 'unanswered' && <p className="review-unanswered"><strong>Bạn chưa trả lời câu này — 0 điểm.</strong>{data.showAnswers && <span>Đáp án đúng bên dưới chỉ để tham khảo, không phải đáp án bạn đã chọn.</span>}</p>}<ul className="answer-list" aria-labelledby={`question-title-${question.id}`}>{question.options.map((option, optionIndex) => <AnswerRow key={option.id} question={question} option={option} index={optionIndex} selected={selected.includes(option.id)} review showAnswers={data.showAnswers} />)}</ul>{data.showAnswers && question.explanation && <div className="question-explanation"><strong>Giải thích</strong><p>{question.explanation}</p></div>}</section>;
    })}
  </div>}</LoadState>;
}

function Attempt({ assignmentId, attemptId }) {
  const resource = useLoad(`/user/attempts/${attemptId}`);
  return <LoadState resource={resource}>{data => <AttemptContent key={attemptId} initial={data} assignmentId={assignmentId} />}</LoadState>;
}

function AttemptContent({ initial, assignmentId }) {
  const [answers, setAnswers] = useState(Object.fromEntries(initial.answers.map(answer => [answer.questionId, answer])));
  const answersRef = useRef(answers);
  const queue = useRef(Promise.resolve());
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const offset = useRef(new Date(initial.serverTime).getTime() - Date.now());
  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((new Date(initial.expiresAt).getTime() - Date.now() - offset.current) / 1000)));
  const submitted = useRef(false);
  const { notify, refreshActive } = useSession();
  const router = useRouter();
  useEffect(() => { if (initial.status === 'submitted') router.replace(`/user/results/${initial.id}`); else if (initial.assignmentId !== assignmentId) router.replace(`/user/assignments/${initial.assignmentId}/attempt/${initial.id}`); }, [initial.id, initial.status, initial.assignmentId, assignmentId, router]);
  useEffect(() => { const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((new Date(initial.expiresAt).getTime() - Date.now() - offset.current) / 1000))), 1000); return () => clearInterval(timer); }, [initial.expiresAt]);
  async function submit() {
    if (submitted.current) return;
    submitted.current = true; setBusy(true);
    try { await queue.current; await api(`/user/attempts/${initial.id}/submit`, { method: 'POST' }); await refreshActive(); router.replace(`/user/results/${initial.id}`); }
    catch (error) { submitted.current = false; setBusy(false); notify(error.message, true); }
  }
  useEffect(() => { if (remaining === 0 && initial.status === 'in_progress') submit(); }, [remaining]);
  function save(questionId, patch) {
    const value = { questionId, selectedOptionIds: answersRef.current[questionId]?.selectedOptionIds || [], flagged: answersRef.current[questionId]?.flagged || false, ...patch };
    answersRef.current = { ...answersRef.current, [questionId]: value };
    setAnswers(answersRef.current); setPending(count => count + 1);
    queue.current = queue.current.then(() => api(`/user/attempts/${initial.id}/answers`, { method: 'PATCH', body: value })).catch(error => { setFailed(true); notify(error.message, true); }).finally(() => setPending(count => count - 1));
  }
  async function retry() {
    setBusy(true);
    try { await queue.current; for (const value of Object.values(answersRef.current)) await api(`/user/attempts/${initial.id}/answers`, { method: 'PATCH', body: { questionId: value.questionId, selectedOptionIds: value.selectedOptionIds, flagged: value.flagged } }); setFailed(false); notify('Đã lưu lại toàn bộ đáp án'); }
    catch (error) { notify(error.message, true); }
    finally { setBusy(false); }
  }
  const attemptPage = useRef(null);
  const mobileBar = useRef(null);
  useEffect(() => {
    const container = attemptPage.current;
    const toolbar = mobileBar.current;
    if (!container || !toolbar) return;
    let disposed = false;
    const measure = () => { if (!disposed && container.isConnected && toolbar.isConnected) container.style.setProperty('--attempt-toolbar-height', `${toolbar.getBoundingClientRect().height}px`); };
    const observer = new ResizeObserver(measure);
    observer.observe(toolbar); measure();
    return () => { disposed = true; observer.disconnect(); };
  }, []);
  const clock = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  const answered = Object.values(answers).filter(answer => answer.selectedOptionIds.length).length;
  return <div className="stack exam-page attempt-page" ref={attemptPage}>
    <div className="attempt-mobile-bar" ref={mobileBar}><div><span className="small muted">Thời gian còn lại</span><strong className="mono" aria-live="off">{clock}</strong></div><button type="button" className="btn primary" disabled={busy || pending > 0 || failed || !remaining} onClick={() => setConfirm(true)}>{busy ? 'Đang nộp…' : 'Nộp bài'}</button></div>
    <div className="exam-heading"><span className="exam-eyebrow">Không gian làm bài</span><Heading title={initial.title} subtitle={`${initial.subjectName} · Lượt ${initial.attemptNumber} · Hạn kết thúc ${date(initial.expiresAt)}`} /><p className="exam-intro">Chọn một đáp án cho mỗi câu. Bạn có thể bỏ chọn hoặc đánh dấu để xem lại trước khi nộp.</p></div>
    <div className="split-layout"><div className="stack question-list">{initial.questions.map((question, index) => {
      const answer = answers[question.id];
      const hasAnswer = Boolean(answer?.selectedOptionIds.length);
      return <section className={`question-card ${answer?.flagged ? 'is-flagged' : ''}`} id={`question-${question.id}`} key={question.id} aria-labelledby={`question-title-${question.id}`}>
        <QuestionHeading question={question} index={index} flagged={answer?.flagged} />
        <div className="answer-list" role="radiogroup" aria-labelledby={`question-title-${question.id}`}>{question.options.map((option, optionIndex) => <AnswerRow key={option.id} question={question} option={option} index={optionIndex} selected={answer?.selectedOptionIds.includes(option.id) || false} disabled={busy || !remaining} onChange={() => save(question.id, { selectedOptionIds: [option.id] })} />)}</div>
        <div className="question-footer"><span className="small muted">{hasAnswer ? 'Đã chọn đáp án' : 'Chưa chọn đáp án'}</span><div className="question-actions"><button type="button" className="btn secondary clear-answer" disabled={!hasAnswer || busy || !remaining} onClick={() => save(question.id, { selectedOptionIds: [] })}>Bỏ chọn đáp án</button><button type="button" className={`btn flag-button ${answer?.flagged ? 'is-flagged' : ''}`} aria-pressed={Boolean(answer?.flagged)} disabled={busy || !remaining} onClick={() => save(question.id, { flagged: !answersRef.current[question.id]?.flagged })}>{answer?.flagged ? 'Bỏ đánh dấu' : 'Đánh dấu xem lại'}</button></div></div>
      </section>;
    })}</div><aside><div className="panel panel-body sticky-side stack exam-sidebar"><span className="exam-eyebrow">Tiến độ của bạn</span><h2 className="section-title">Thời gian còn lại</h2><strong className="stat-value mono exam-clock" aria-live="off">{clock}</strong><span>Đã trả lời {answered}/{initial.questions.length}</span><div className="progress" role="progressbar" aria-label="Tiến độ trả lời" aria-valuemin={0} aria-valuemax={initial.questions.length} aria-valuenow={answered}><span style={{ width: `${answered / initial.questions.length * 100}%` }} /></div><h3 className="question-nav-title">Đi đến câu hỏi</h3><div className="question-nav">{initial.questions.map((question, index) => {
      const answeredQuestion = Boolean(answers[question.id]?.selectedOptionIds.length);
      const flaggedQuestion = Boolean(answers[question.id]?.flagged);
      const label = `Câu ${index + 1}, ${answeredQuestion ? 'Đã trả lời' : 'Chưa trả lời'}${flaggedQuestion ? ', Đã đánh dấu' : ''}`;
      return <button type="button" key={question.id} aria-label={label} title={label} className={`${answeredQuestion ? 'answered' : ''} ${flaggedQuestion ? 'flagged' : ''}`} onClick={() => document.getElementById(`question-${question.id}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}><span>{index + 1}</span></button>;
    })}</div><div className="question-legend small"><span><i className="nav-key" aria-hidden="true" />Trắng: chưa trả lời</span><span><i className="nav-key answered" aria-hidden="true" />Xanh: đã trả lời</span><span><i className="nav-key flagged" aria-hidden="true" />Viền vàng: đánh dấu</span></div><p className={`small ${failed ? 'error-text' : 'muted'}`} role="status">{failed ? 'Có đáp án chưa lưu. Hãy lưu lại trước khi nộp.' : pending ? 'Đang lưu đáp án…' : 'Đáp án đã được lưu trên máy chủ.'}</p>{failed && <button className="btn secondary" disabled={busy || pending > 0} onClick={retry}>Lưu lại đáp án</button>}<button className="btn primary" disabled={busy || pending > 0 || failed || !remaining} onClick={() => setConfirm(true)}>{busy ? 'Đang nộp…' : 'Nộp bài'}</button><p className="small muted">Hết thời gian hệ thống tự nộp. Sau khi nộp không thể sửa đáp án.</p></div></aside></div>
    {confirm && <Confirm title="Xác nhận nộp bài" tone="default" message={`Bạn đã trả lời ${answered}/${initial.questions.length} câu. Lượt đã nộp không được sửa.`} onClose={() => setConfirm(false)} onConfirm={submit} busy={busy} />}
  </div>;

}

export default function UserPage({ segments }) {
  if (segments[0] === 'profile') return <Profile />;
  if (segments[0] === 'dashboard') return <Dashboard />;
  if (segments[0] === 'results' && segments.length === 2) return <Review attemptId={segments[1]} />;
  if (segments[0] === 'results' && segments.length === 1) return <Results />;
  if (segments[0] === 'assignments' && segments.length === 3 && segments[2] === 'history') return <History assignmentId={segments[1]} />;
  if (segments[0] === 'assignments' && segments.length === 4 && segments[2] === 'attempt') return <Attempt assignmentId={segments[1]} attemptId={segments[3]} />;
  if (segments[0] === 'assignments' && segments.length === 1) return <Assigned />;
  return <Empty title="Không tìm thấy màn hình" />;
}
