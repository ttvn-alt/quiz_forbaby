/**
 * Adult Nursing Quiz Engine (adult_quiz.js)
 * ระบบแบบทดสอบวิชาการพยาบาลผู้ใหญ่
 * Version: 1.0.0
 *
 * Features:
 * - Practice Mode / Exam Mode / Mistake Mode
 * - Question History (localStorage)
 * - Chapter selection
 * - Difficulty filtering
 * - Weak Topic Detection
 * - Analytics Dashboard
 * - Duplicate Detection (3 levels)
 */

// ============================================================
// CONSTANTS
// ============================================================
const ADULT_STORAGE_KEY = 'adult_nursing_history';
const ADULT_VERSION = '1.0.0';

// Quiz Modes
const QUIZ_MODE = {
    PRACTICE: 'practice',   // แสดงเฉลยทันทีหลังตอบ
    EXAM:     'exam',       // ไม่แสดงเฉลย แสดงคะแนนเมื่อจบ
    MISTAKE:  'mistake'     // เฉพาะข้อที่เคยตอบผิด
};

// ============================================================
// ADULT QUIZ ENGINE
// ============================================================
const AdultQuizEngine = {

    // ─── HISTORY & STORAGE ─────────────────────────────────

    /**
     * บันทึกประวัติการทำข้อสอบ (localStorage)
     * @param {Object} record - { questionId, chapterId, selectedAnswer, correctAnswer, isCorrect, score, topic, difficulty, timestamp }
     */
    recordAnswer(record) {
        const history = this.getHistory();
        history.push({
            questionId:     record.questionId,
            chapterId:      record.chapterId,
            topic:          record.topic || '',
            difficulty:     record.difficulty || 'easy',
            selectedAnswer: record.selectedAnswer,
            correctAnswer:  record.correctAnswer,
            isCorrect:      record.isCorrect,
            score:          record.isCorrect ? 1 : 0,
            tags:           record.tags || [],
            timestamp:      record.timestamp || Date.now()
        });
        try {
            localStorage.setItem(ADULT_STORAGE_KEY, JSON.stringify({
                version: ADULT_VERSION,
                records: history
            }));
        } catch(e) {
            console.warn('AdultQuizEngine: localStorage write failed', e);
        }
    },

    /**
     * ดึงประวัติทั้งหมด
     * @returns {Array} array of history records
     */
    getHistory() {
        try {
            const raw = localStorage.getItem(ADULT_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return parsed.records || [];
        } catch(e) {
            return [];
        }
    },

    /**
     * ลบประวัติทั้งหมด
     */
    clearHistory() {
        try {
            localStorage.removeItem(ADULT_STORAGE_KEY);
        } catch(e) {}
    },

    /**
     * ตรวจว่าข้อนี้เคยทำหรือยัง (รอบล่าสุด)
     * @param {string} questionId
     * @returns {Object|null} record หรือ null
     */
    getQuestionRecord(questionId) {
        const history = this.getHistory();
        const records = history.filter(r => r.questionId === questionId);
        return records.length > 0 ? records[records.length - 1] : null;
    },

    /**
     * ดึงรายการข้อที่เคยตอบผิด (unique by questionId)
     * @returns {Array} array of questionIds
     */
    getMistakeIds() {
        const history = this.getHistory();
        const wrongMap = {};
        history.forEach(r => {
            if (!r.isCorrect) {
                wrongMap[r.questionId] = r;
            } else {
                // ถ้าตอบถูกในภายหลัง ให้ลบออกจาก mistake list
                if (wrongMap[r.questionId]) delete wrongMap[r.questionId];
            }
        });
        return Object.keys(wrongMap);
    },

    /**
     * ดึงข้อมูล: แต่ละ questionId เคยทำกี่ครั้ง ถูกกี่ครั้ง
     */
    getQuestionStats() {
        const history = this.getHistory();
        const stats = {};
        history.forEach(r => {
            if (!stats[r.questionId]) {
                stats[r.questionId] = { attempts: 0, correct: 0, questionId: r.questionId, chapterId: r.chapterId, topic: r.topic, tags: r.tags };
            }
            stats[r.questionId].attempts++;
            if (r.isCorrect) stats[r.questionId].correct++;
        });
        return stats;
    },

    // ─── QUESTION SELECTION ─────────────────────────────────

    /**
     * ดึงคำถามตาม chapters + difficulty + mode + count
     * @param {Object} options
     * @param {string[]} options.chapters - ['ch1','ch2',...] หรือ ['all']
     * @param {string}   options.difficulty - 'all'/'easy'/'medium'/'hard'/'expert'
     * @param {string}   options.mode - 'practice'/'exam'/'mistake'
     * @param {number}   options.count - จำนวนข้อ (0 = ทั้งหมด)
     * @param {boolean}  options.randomize - สุ่มลำดับ
     * @returns {Array} questions
     */
    getQuestions(options = {}) {
        const {
            chapters    = ['all'],
            difficulty  = 'all',
            mode        = QUIZ_MODE.PRACTICE,
            count       = 20,
            randomize   = true
        } = options;

        if (typeof adultQuizData === 'undefined') {
            console.error('adultQuizData is not loaded');
            return [];
        }

        let pool = [];

        // กำหนด chapters
        const allChapterIds = Object.keys(adultQuizData);
        const targetChapters = (chapters.includes('all') || chapters.length === 0)
            ? allChapterIds
            : chapters;

        // กำหนด difficulties
        const allDifficulties = ['easy', 'medium', 'hard', 'expert'];
        const targetDiffs = (difficulty === 'all') ? allDifficulties : [difficulty];

        // รวมข้อในระดับที่เลือกก่อน
        targetChapters.forEach(chId => {
            if (!adultQuizData[chId]) return;
            targetDiffs.forEach(diff => {
                const qs = adultQuizData[chId][diff];
                if (qs && Array.isArray(qs)) {
                    pool = pool.concat(qs);
                }
            });
        });

        // กรณี Mistake mode
        if (mode === QUIZ_MODE.MISTAKE) {
            const mistakeIds = this.getMistakeIds();
            pool = pool.filter(q => mistakeIds.includes(q.id));
        }

        // ระดับความยากเป็น "ระดับที่เน้น" ไม่ใช่โควตาที่ทำให้แบบทดสอบเหลือ 2 ข้อ
        // หากจำนวนที่ขอมากกว่าข้อของระดับนั้น ให้เติมข้อระดับอื่นจาก "บทเดิมเท่านั้น"
        // โดยไม่ซ้ำ questionId. Mistake mode ต้องคงเฉพาะข้อผิด จึงไม่เติมข้ออื่น
        if (mode !== QUIZ_MODE.MISTAKE && difficulty !== 'all' && count > 0 && pool.length < count) {
            const chosenIds = new Set(pool.map(q => q.id));
            const supplemental = [];
            targetChapters.forEach(chId => {
                const chapter = adultQuizData[chId];
                if (!chapter) return;
                allDifficulties.filter(diff => diff !== difficulty).forEach(diff => {
                    (chapter[diff] || []).forEach(q => {
                        if (!chosenIds.has(q.id)) supplemental.push({ ...q, difficultyRequested: difficulty });
                    });
                });
            });
            pool = pool.concat(supplemental);
        }

        // ให้ข้อที่ยังไม่เคยทำมาก่อนอยู่ก่อนข้อเดิม หากยังมีข้อเหลือ
        if (mode !== QUIZ_MODE.MISTAKE) {
            const seen = new Set(this.getHistory().map(r => r.questionId));
            const fresh = pool.filter(q => !seen.has(q.id));
            const attempted = pool.filter(q => seen.has(q.id));
            pool = fresh.length ? fresh.concat(attempted) : pool;
        }

        // สุ่มลำดับภายในกลุ่ม เพื่อไม่สร้าง pattern เดิม
        if (randomize) {
            const seen = new Set(this.getHistory().map(r => r.questionId));
            const fresh = pool.filter(q => !seen.has(q.id));
            const attempted = pool.filter(q => seen.has(q.id));
            this._shuffle(fresh); this._shuffle(attempted);
            pool = fresh.length ? fresh.concat(attempted) : attempted;
        }

        // จำกัดจำนวน
        if (count > 0 && count < pool.length) {
            pool = pool.slice(0, count);
        }

        return pool;
    },

    // ─── ANALYTICS ─────────────────────────────────────────

    /**
     * คำนวณ Analytics แยกตามบท
     * @returns {Object} analytics data
     */
    getAnalytics() {
        const history = this.getHistory();
        const chapterStats = {};
        const topicStats = {};
        const tagStats = {};

        if (typeof adultChapters !== 'undefined') {
            adultChapters.forEach(ch => {
                chapterStats[ch.id] = {
                    id: ch.id,
                    name: ch.name,
                    attempts: 0,
                    correct: 0,
                    score: 0
                };
            });
        }

        history.forEach(r => {
            // Chapter stats
            if (!chapterStats[r.chapterId]) {
                chapterStats[r.chapterId] = { id: r.chapterId, name: r.chapterId, attempts: 0, correct: 0, score: 0 };
            }
            chapterStats[r.chapterId].attempts++;
            if (r.isCorrect) chapterStats[r.chapterId].correct++;

            // Topic stats
            const topic = r.topic || 'Unknown';
            if (!topicStats[topic]) topicStats[topic] = { attempts: 0, correct: 0 };
            topicStats[topic].attempts++;
            if (r.isCorrect) topicStats[topic].correct++;

            // Tag stats
            (r.tags || []).forEach(tag => {
                if (!tagStats[tag]) tagStats[tag] = { attempts: 0, correct: 0 };
                tagStats[tag].attempts++;
                if (r.isCorrect) tagStats[tag].correct++;
            });
        });

        // คำนวณ score %
        Object.values(chapterStats).forEach(ch => {
            ch.score = ch.attempts > 0 ? Math.round((ch.correct / ch.attempts) * 100) : null;
        });
        Object.values(topicStats).forEach(t => {
            t.score = t.attempts > 0 ? Math.round((t.correct / t.attempts) * 100) : null;
        });
        Object.values(tagStats).forEach(t => {
            t.score = t.attempts > 0 ? Math.round((t.correct / t.attempts) * 100) : null;
        });

        // Overall
        const totalAttempts = history.length;
        const totalCorrect  = history.filter(r => r.isCorrect).length;
        const overallScore  = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null;

        return { chapterStats, topicStats, tagStats, overallScore, totalAttempts, totalCorrect };
    },

    /**
     * ตรวจหา Weak Topics (score < 60% และมีอย่างน้อย 3 attempts)
     * @returns {Array} weak topics sorted by score ascending
     */
    detectWeakTopics() {
        const analytics = this.getAnalytics();
        const weak = [];

        Object.values(analytics.topicStats).forEach(t => {
            if (t.attempts >= 3 && t.score !== null && t.score < 60) {
                weak.push(t);
            }
        });

        // เรียงจากคะแนนน้อยสุด
        weak.sort((a, b) => a.score - b.score);
        return weak;
    },

    /**
     * ตรวจหา Weak Tags
     * @returns {Array}
     */
    detectWeakTags() {
        const analytics = this.getAnalytics();
        const weak = [];
        Object.entries(analytics.tagStats).forEach(([tag, t]) => {
            if (t.attempts >= 3 && t.score !== null && t.score < 60) {
                weak.push({ tag, ...t });
            }
        });
        weak.sort((a, b) => a.score - b.score);
        return weak;
    },

    /**
     * สรุปผลหลังทำแบบทดสอบ
     * @param {Array} questions - questions that were answered
     * @param {Array} userAnswers - array of selected option ids (A/B/C/D) or indices
     * @returns {Object} result summary
     */
    summarizeResult(questions, userAnswers) {
        let correct = 0;
        const wrongTopics = {};
        const correctTopics = {};
        const details = [];

        questions.forEach((q, i) => {
            const selected = userAnswers[i];
            const isCorrect = (selected === q.correctAnswer);

            if (isCorrect) {
                correct++;
                const topic = q.topic || 'Unknown';
                if (!correctTopics[topic]) correctTopics[topic] = 0;
                correctTopics[topic]++;
            } else {
                const topic = q.topic || 'Unknown';
                if (!wrongTopics[topic]) wrongTopics[topic] = 0;
                wrongTopics[topic]++;
            }

            details.push({
                questionId: q.id,
                question: q.question || q.q,
                selected,
                correct: q.correctAnswer,
                isCorrect,
                topic: q.topic,
                tags: q.tags,
                explanation: q.explanation || q.reason
            });
        });

        const total = questions.length;
        const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

        // Sort wrong topics by frequency
        const weakTopics = Object.entries(wrongTopics)
            .map(([topic, count]) => ({ topic, count }))
            .sort((a, b) => b.count - a.count);

        const strongTopics = Object.entries(correctTopics)
            .map(([topic, count]) => ({ topic, count }))
            .sort((a, b) => b.count - a.count);

        return { correct, total, percentage, weakTopics, strongTopics, details };
    },

    // ─── DUPLICATE DETECTION ──────────────────────────────

    /**
     * ตรวจ duplicate 3 ระดับ
     * @param {Array} questions - question pool to check
     * @returns {Array} duplicate groups
     */
    detectDuplicates(questions) {
        const duplicates = [];
        const checked = new Set();

        for (let i = 0; i < questions.length; i++) {
            for (let j = i + 1; j < questions.length; j++) {
                const key = `${i}-${j}`;
                if (checked.has(key)) continue;
                checked.add(key);

                const q1 = questions[i];
                const q2 = questions[j];
                const dupLevel = this._checkDuplicate(q1, q2);
                if (dupLevel) {
                    duplicates.push({ q1: q1.id, q2: q2.id, level: dupLevel });
                }
            }
        }
        return duplicates;
    },

    /**
     * ตรวจ duplicate ระหว่าง 2 คำถาม
     * @returns {string|null} 'exact' | 'similar' | 'same_knowledge' | null
     */
    _checkDuplicate(q1, q2) {
        const text1 = (q1.question || q1.q || '').trim();
        const text2 = (q2.question || q2.q || '').trim();

        // Level 1: Exact match
        if (text1 === text2) return 'exact';

        // Level 2: Similar wording (normalized similarity)
        const norm1 = this._normalize(text1);
        const norm2 = this._normalize(text2);
        // Similar phrasing is a duplicate only when it targets the same topic.
        // A shared scenario stem alone must not reject different learning objectives.
        if (q1.topic === q2.topic && this._similarity(norm1, norm2) > 0.75) return 'similar';

        // Level 3: Same explicit learning objective at the same cognitive level.
        // Metadata is deliberate: matching only broad chapter/topic tags is not enough.
        if (q1.learningObjective && q1.learningObjective === q2.learningObjective &&
            q1.questionType === q2.questionType && q1.difficulty === q2.difficulty) {
            return 'same_knowledge';
        }

        return null;
    },

    _normalize(text) {
        return text.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[?!.,;:]/g, '');
    },

    /**
     * Dice coefficient similarity
     */
    _similarity(a, b) {
        if (a === b) return 1;
        if (a.length < 2 || b.length < 2) return 0;
        const firstBigrams = new Map();
        for (let i = 0; i < a.length - 1; i++) {
            const bigram = a.substring(i, i + 2);
            const count = (firstBigrams.get(bigram) || 0) + 1;
            firstBigrams.set(bigram, count);
        }
        let intersectionSize = 0;
        for (let i = 0; i < b.length - 1; i++) {
            const bigram = b.substring(i, i + 2);
            const count = firstBigrams.get(bigram) || 0;
            if (count > 0) {
                firstBigrams.set(bigram, count - 1);
                intersectionSize++;
            }
        }
        return (2.0 * intersectionSize) / (a.length + b.length - 2);
    },

    // ─── UTILITIES ─────────────────────────────────────────

    _shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    },

    /**
     * สุ่มตัวเลือก และอัปเดต correctAnswer
     * @param {Object} question
     * @returns {Object} shuffled question (deep copy)
     */
    shuffleOptions(question) {
        const q = JSON.parse(JSON.stringify(question));
        const correctText = q.options.find(o => o.id === q.correctAnswer)?.text;

        // Shuffle
        for (let i = q.options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
        }

        // Re-assign A/B/C/D labels
        const labels = ['A', 'B', 'C', 'D'];
        q.options.forEach((opt, idx) => { opt.id = labels[idx]; });

        // Update correctAnswer
        const newCorrect = q.options.find(o => o.text === correctText);
        if (newCorrect) q.correctAnswer = newCorrect.id;

        // Update backward-compat ans field
        q.ans = q.options.findIndex(o => o.id === q.correctAnswer);

        return q;
    }
};

// ============================================================
// ADULT UI CONTROLLER (สำหรับ index.html ใช้)
// ============================================================
const AdultUI = {

    currentQuestions: [],
    userAnswers: [],
    currentMode: QUIZ_MODE.PRACTICE,
    sessionResults: null,

    /**
     * เริ่มแบบทดสอบ Adult Nursing
     */
    startQuiz(options) {
        const {
            chapters, difficulty, mode, count, randomizeQ, randomizeOpt
        } = options;

        this.currentMode = mode || QUIZ_MODE.PRACTICE;
        let questions = AdultQuizEngine.getQuestions({
            chapters, difficulty, mode: this.currentMode, count, randomize: randomizeQ
        });

        if (questions.length === 0) {
            if (this.currentMode === QUIZ_MODE.MISTAKE) {
                alert('ไม่พบข้อที่เคยตอบผิดในหมวดนี้ 🎉 คุณทำได้ดีมาก!');
            } else {
                alert('ไม่พบข้อสอบในหมวดที่เลือก กรุณาเลือกเงื่อนไขอื่น');
            }
            return false;
        }

        // สุ่มตัวเลือก
        if (randomizeOpt) {
            questions = questions.map(q => AdultQuizEngine.shuffleOptions(q));
        }

        this.currentQuestions = questions;
        this.userAnswers = new Array(questions.length).fill(null);
        this.sessionResults = null;

        return true;
    },

    /**
     * บันทึกคำตอบผู้ใช้
     */
    setAnswer(questionIndex, optionId) {
        this.userAnswers[questionIndex] = optionId;
    },

    /**
     * ส่งคำตอบและคำนวณคะแนน
     */
    submitQuiz() {
        const results = AdultQuizEngine.summarizeResult(
            this.currentQuestions,
            this.userAnswers
        );
        this.sessionResults = results;

        // บันทึก history
        this.currentQuestions.forEach((q, i) => {
            const selected = this.userAnswers[i];
            if (selected !== null) {
                AdultQuizEngine.recordAnswer({
                    questionId:     q.id,
                    chapterId:      q.chapterId,
                    topic:          q.topic,
                    difficulty:     q.difficulty,
                    selectedAnswer: selected,
                    correctAnswer:  q.correctAnswer,
                    isCorrect:      selected === q.correctAnswer,
                    tags:           q.tags || [],
                    timestamp:      Date.now()
                });
            }
        });

        return results;
    },

    /**
     * ดึง question history สำหรับแสดง
     */
    getHistory() {
        return AdultQuizEngine.getHistory();
    },

    /**
     * ดึง analytics
     */
    getAnalytics() {
        return AdultQuizEngine.getAnalytics();
    },

    /**
     * ดึง weak topics
     */
    getWeakTopics() {
        return AdultQuizEngine.detectWeakTopics();
    }
};

// ============================================================
// VALIDATION UTILITY (ใช้ตรวจสอบ question bank)
// ============================================================
const AdultQuizValidator = {
    /**
     * ตรวจสอบว่าแต่ละบทมี 20 ข้อครบ
     */
    validateChapterCounts() {
        if (typeof adultQuizData === 'undefined') return { error: 'adultQuizData not loaded' };
        const results = {};
        const difficulties = ['easy', 'medium', 'hard', 'expert'];
        Object.keys(adultQuizData).forEach(chId => {
            results[chId] = {};
            let total = 0;
            difficulties.forEach(diff => {
                const qs = adultQuizData[chId][diff] || [];
                results[chId][diff] = qs.length;
                total += qs.length;
            });
            results[chId].total = total;
            results[chId].valid = (total === 30);
        });
        return results;
    },

    /**
     * ตรวจสอบ answer distribution
     */
    validateAnswerDistribution() {
        if (typeof adultQuizData === 'undefined') return { error: 'adultQuizData not loaded' };
        const results = {};
        Object.keys(adultQuizData).forEach(chId => {
            const dist = { A: 0, B: 0, C: 0, D: 0 };
            ['easy','medium','hard','expert'].forEach(diff => {
                (adultQuizData[chId][diff] || []).forEach(q => {
                    if (q.correctAnswer) dist[q.correctAnswer]++;
                });
            });
            results[chId] = dist;
        });
        return results;
    },

    /**
     * ตรวจสอบ duplicate ใน question bank ทั้งหมด
     */
    validateNoDuplicates() {
        if (typeof adultQuizData === 'undefined') return { error: 'adultQuizData not loaded' };
        const allQuestions = [];
        Object.keys(adultQuizData).forEach(chId => {
            ['easy','medium','hard','expert'].forEach(diff => {
                (adultQuizData[chId][diff] || []).forEach(q => allQuestions.push(q));
            });
        });
        return AdultQuizEngine.detectDuplicates(allQuestions);
    },

    /**
     * Run all validations
     */
    runAll() {
        const chapterCounts = this.validateChapterCounts();
        const answerDist    = this.validateAnswerDistribution();
        const duplicates    = this.validateNoDuplicates();

        let allValid = true;
        Object.values(chapterCounts).forEach(ch => {
            if (ch.valid === false) allValid = false;
        });

        console.log('=== Adult Nursing Quiz Validation ===');
        console.log('Chapter counts:', chapterCounts);
        console.log('Answer distribution:', answerDist);
        console.log('Duplicates found:', duplicates.length);
        console.log('All valid:', allValid);

        return { chapterCounts, answerDist, duplicates, allValid };
    }
};

// Make globally accessible
window.AdultQuizEngine    = AdultQuizEngine;
window.AdultUI            = AdultUI;
window.AdultQuizValidator = AdultQuizValidator;
window.QUIZ_MODE          = QUIZ_MODE;
