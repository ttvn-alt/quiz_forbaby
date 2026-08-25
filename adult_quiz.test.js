// Run with the bundled Node runtime: node adult_quiz.test.js
global.window = global;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
require('./adult_data.js');
require('./adult_quiz.js');

const result = AdultQuizValidator.runAll();
if (!result.allValid) throw new Error('Each Adult Nursing chapter must contain exactly 20 questions.');
if (result.duplicates.length) throw new Error(`Duplicate questions found: ${result.duplicates.length}`);
for (const [id, distribution] of Object.entries(result.answerDist)) {
  for (const count of Object.values(distribution)) {
    if (count !== 5) throw new Error(`${id} answer distribution is not balanced.`);
  }
}
for (const question of Object.values(adultQuizData).flatMap(ch => Object.values(ch).flat())) {
  if (question.options.length !== 4 || !question.options.some(o => o.id === question.correctAnswer)) {
    throw new Error(`Invalid schema: ${question.id}`);
  }
}
if (AdultQuizEngine.getQuestions({ chapters: ['all'], difficulty: 'expert', count: 30 }).length !== 30) {
  throw new Error('Difficulty selection must still provide a 30-question exam across selected chapters.');
}
if (AdultQuizEngine.getQuestions({ chapters: ['adult-periop'], difficulty: 'expert', count: 20 }).length !== 20) {
  throw new Error('A chapter must provide 20 unique questions even when one difficulty is preferred.');
}
console.log('Adult Nursing bank validation passed.');
