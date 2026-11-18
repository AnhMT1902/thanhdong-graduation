export function grade(snapshot, answers) {
  const answerMap = new Map(answers.map(answer => [answer.question_id || answer.questionId, answer.selected_option_ids || answer.selectedOptionIds || []]));
  let earned = 0;
  let total = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  for (const question of snapshot.questions) {
    const selected = [...new Set(answerMap.get(question.id) || [])].sort();
    const expected = question.options.filter(option => option.isCorrect).map(option => option.id).sort();
    const correct = selected.length > 0 && JSON.stringify(selected) === JSON.stringify(expected);
    total += Number(question.points);
    if (!selected.length) unansweredCount++;
    else if (correct) { correctCount++; earned += Number(question.points); }
    else wrongCount++;
  }
  return { score: total ? Math.round(earned / total * 1000) / 100 : 0, correctCount, wrongCount, unansweredCount };
}

export function publicQuestions(snapshot, showAnswers) {
  return snapshot.questions.map(question => ({
    id: question.id, content: question.content, type: question.type, points: question.points,
    ...(showAnswers ? { explanation: question.explanation } : {}),
    options: question.options.map(option => ({ id: option.id, content: option.content, ...(showAnswers ? { isCorrect: option.isCorrect } : {}) }))
  }));
}
