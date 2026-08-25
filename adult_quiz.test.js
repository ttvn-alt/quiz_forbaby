// Run with the bundled Node runtime: node adult_quiz.test.js
global.window = global;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
require('./adult_data.js');
require('./adult_quiz.js');

const result = AdultQuizValidator.runAll();
if (!result.allValid) throw new Error('Each Adult Nursing chapter must contain exactly 30 questions.');
if (result.duplicates.length) throw new Error(`Duplicate questions found: ${result.duplicates.length}`);
for (const [id, distribution] of Object.entries(result.answerDist)) {
  const counts = Object.values(distribution);
  if (Math.max(...counts) - Math.min(...counts) > 1) throw new Error(`${id} answer distribution is not balanced.`);
}
for (const question of Object.values(adultQuizData).flatMap(ch => Object.values(ch).flat())) {
  if (question.options.length !== 4 || !question.options.some(o => o.id === question.correctAnswer)) {
    throw new Error(`Invalid schema: ${question.id}`);
  }
}
// Template-generated chapters must not contain a generic answer unrelated to its asked topic.
for (const chapterId of ['adult-urinary', 'adult-fluid', 'adult-abg', 'adult-endo', 'adult-pain', 'adult-ortho']) {
  for (const question of Object.values(adultQuizData[chapterId]).flat()) {
    const correct = question.options.find(option => option.id === question.correctAnswer).text;
    if (!question.question.includes(question.topic) || !correct.includes(question.topic)) {
      throw new Error(`Question/answer coherence failed: ${question.id}`);
    }
  }
}
if (AdultQuizEngine.getQuestions({ chapters: ['all'], difficulty: 'expert', count: 30 }).length !== 30) {
  throw new Error('Difficulty selection must still provide a 30-question exam across selected chapters.');
}
if (AdultQuizEngine.getQuestions({ chapters: ['adult-periop'], difficulty: 'expert', count: 30 }).length !== 30) {
  throw new Error('A chapter must provide 30 unique questions even when one difficulty is preferred.');
}
console.log('Adult Nursing bank validation passed.');
