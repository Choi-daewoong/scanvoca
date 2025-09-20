// Quiz State
let quizState = {
    // Selection state
    selectedWordbook: null,
    selectedLevel: 'all',
    selectedCount: 10,
    selectedMode: 'meaning',

    // Game state
    selectedAnswerIndex: -1,
    currentQuestion: 0,
    totalQuestions: 10,
    correctAnswers: 0,
    isAnswered: false,
    questions: [],

    // Current question data
    currentWord: {
        word: '',
        pronunciation: '',
        meaning: '',
        options: [],
        correctIndex: 0
    }
};

// Sample wordbook data
const wordbookData = {
    1: {
        name: '기초 영단어',
        words: [
            { word: 'vocabulary', pronunciation: '/vəˈkæbjəlɛri/', pos: 'n.', meaning: '어휘, 단어의 집합', level: 2 },
            { word: 'grammar', pronunciation: '/ˈɡræmər/', pos: 'n.', meaning: '문법, 언어의 규칙', level: 2 },
            { word: 'pronunciation', pronunciation: '/prəˌnʌnsiˈeɪʃən/', pos: 'n.', meaning: '발음, 소리의 표현', level: 3 },
            { word: 'spelling', pronunciation: '/ˈspelɪŋ/', pos: 'n.', meaning: '철자, 글자의 순서', level: 1 },
            { word: 'sentence', pronunciation: '/ˈsentəns/', pos: 'n.', meaning: '문장, 완전한 생각', level: 1 }
        ]
    },
    2: {
        name: '고급 어휘',
        words: [
            { word: 'sophisticated', pronunciation: '/səˈfɪstɪkeɪtɪd/', pos: 'adj.', meaning: '정교한, 세련된', level: 5 },
            { word: 'meticulous', pronunciation: '/məˈtɪkjələs/', pos: 'adj.', meaning: '세심한, 꼼꼼한', level: 4 },
            { word: 'eloquent', pronunciation: '/ˈeləkwənt/', pos: 'adj.', meaning: '웅변의, 유창한', level: 4 }
        ]
    },
    3: {
        name: '과학 용어',
        words: [
            { word: 'hypothesis', pronunciation: '/haɪˈpɑːθəsɪs/', pos: 'n.', meaning: '가설, 추정', level: 4 },
            { word: 'experiment', pronunciation: '/ɪkˈsperɪmənt/', pos: 'n.', meaning: '실험, 시험', level: 3 },
            { word: 'analysis', pronunciation: '/əˈnæləsɪs/', pos: 'n.', meaning: '분석, 해석', level: 3 }
        ]
    }
};

// Quiz Selection Functions
function selectWordbook(id) {
    // 이전 선택 해제
    document.querySelectorAll('.wordbook-item.selectable').forEach(item => {
        item.classList.remove('selected');
    });

    // 새로운 선택
    document.querySelector(`[data-wordbook-id="${id}"]`).classList.add('selected');
    quizState.selectedWordbook = id;

    updateStartButton();
}


function selectCount(count) {
    // 이전 선택 해제
    document.querySelectorAll('.count-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 새로운 선택
    document.querySelector(`[data-count="${count}"]`).classList.add('active');
    quizState.selectedCount = count;
    quizState.totalQuestions = count;

    updateStartButton();
}

function selectMode(mode) {
    // 이전 선택 해제
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 새로운 선택
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
    quizState.selectedMode = mode;

    updateStartButton();
}

function updateStartButton() {
    const startBtn = document.getElementById('start-quiz-btn');
    const startInfo = document.getElementById('start-info');

    if (quizState.selectedWordbook) {
        startBtn.disabled = false;
        const wordbookName = wordbookData[quizState.selectedWordbook].name;
        startInfo.textContent = `${wordbookName} • ${quizState.selectedCount}문제`;
    } else {
        startBtn.disabled = true;
        startInfo.textContent = '단어장을 선택해주세요';
    }
}

function startQuiz() {
    if (!quizState.selectedWordbook) return;

    // 퀴즈 문제 생성
    generateQuestions();

    // 화면 전환
    document.getElementById('quiz-selection').style.display = 'none';
    document.getElementById('quiz-game').style.display = 'block';

    // 첫 번째 문제 로드
    quizState.currentQuestion = 1;
    loadQuestion();
    updateProgress();
}

function generateQuestions() {
    const wordbook = wordbookData[quizState.selectedWordbook];
    let availableWords = [...wordbook.words];

    // 문제 수만큼 랜덤 선택
    const selectedWords = [];
    for (let i = 0; i < Math.min(quizState.selectedCount, availableWords.length); i++) {
        const randomIndex = Math.floor(Math.random() * availableWords.length);
        selectedWords.push(availableWords.splice(randomIndex, 1)[0]);
    }

    // 각 단어에 대해 선택지 생성
    quizState.questions = selectedWords.map(word => {
        const wrongOptions = getAllWrongOptions(word);
        const shuffledWrong = shuffleArray(wrongOptions).slice(0, 3);

        const options = [...shuffledWrong, word.meaning];
        const shuffledOptions = shuffleArray(options);

        return {
            word: word.word,
            pronunciation: word.pronunciation,
            correctAnswer: word.meaning,
            options: shuffledOptions,
            correctIndex: shuffledOptions.indexOf(word.meaning)
        };
    });

    quizState.totalQuestions = quizState.questions.length;
}

function getAllWrongOptions(correctWord) {
    const wrongOptions = [];

    // 모든 단어장에서 잘못된 선택지 수집
    Object.values(wordbookData).forEach(wordbook => {
        wordbook.words.forEach(word => {
            if (word.word !== correctWord.word) {
                wrongOptions.push(word.meaning);
            }
        });
    });

    return wrongOptions;
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function selectAnswer(index) {
    if (quizState.isAnswered) return;

    // 이전 선택 해제
    document.querySelectorAll('.answer-option').forEach(option => {
        option.classList.remove('selected');
    });

    // 새로운 선택
    document.querySelectorAll('.answer-option')[index].classList.add('selected');
    quizState.selectedAnswerIndex = index;

    // 제출 버튼 활성화
    document.getElementById('submit-btn').disabled = false;
}

function loadQuestion() {
    if (quizState.currentQuestion > quizState.totalQuestions) return;

    const question = quizState.questions[quizState.currentQuestion - 1];
    quizState.currentWord = question;

    // 상태 초기화
    quizState.selectedAnswerIndex = -1;
    quizState.isAnswered = false;

    // UI 업데이트
    document.getElementById('quiz-title').textContent = `${wordbookData[quizState.selectedWordbook].name} 퀴즈`;
    document.getElementById('question-word').textContent = question.word;
    document.getElementById('question-pronunciation').textContent = question.pronunciation;

    // 퀴즈 모드에 따른 질문 텍스트 변경
    const questionText = document.getElementById('question-text');
    if (quizState.selectedMode === 'meaning') {
        questionText.textContent = '다음 중 이 단어의 뜻으로 가장 적절한 것은?';
        document.getElementById('question-word').style.display = 'block';
    } else if (quizState.selectedMode === 'listening') {
        questionText.textContent = '발음을 듣고 올바른 뜻을 선택하세요 🔊';
        document.getElementById('question-word').style.display = 'none';
    } else {
        questionText.textContent = '다음 중 이 단어의 뜻으로 가장 적절한 것은?';
        document.getElementById('question-word').style.display = 'block';
    }

    // 답 선택지 업데이트
    const answerOptions = document.getElementById('answer-options');
    answerOptions.innerHTML = '';

    question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'answer-option';
        optionDiv.onclick = () => selectAnswer(index);

        optionDiv.innerHTML = `
            <span class="option-letter">${String.fromCharCode(65 + index)}</span>
            <span class="option-text">${option}</span>
        `;

        answerOptions.appendChild(optionDiv);
    });

    // 채점 오버레이 초기화
    const overlay = document.getElementById('check-mark-overlay');
    const checkMark = document.getElementById('check-mark');
    overlay.classList.remove('show', 'fade-out');
    checkMark.classList.remove('correct', 'incorrect');

    // 버튼 초기화
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.textContent = '정답 확인';
    submitBtn.className = 'btn btn-submit';
    submitBtn.disabled = true;
    submitBtn.style.display = 'inline-block';
    submitBtn.style.transform = 'scale(1)';
    submitBtn.style.opacity = '1';

    const nextBtn = document.getElementById('next-btn');
    nextBtn.style.display = 'none';
}

function submitAnswer() {
    if (quizState.selectedAnswerIndex === -1 || quizState.isAnswered) return;

    quizState.isAnswered = true;
    const correctIndex = quizState.currentWord.correctIndex;
    const isCorrect = quizState.selectedAnswerIndex === correctIndex;

    // 동그라미/X마크 채점 애니메이션
    showGradingAnimation(isCorrect);

    // 선택지 결과 표시 및 버튼 변경 (애니메이션 후)
    setTimeout(() => {
        document.querySelectorAll('.answer-option').forEach((option, index) => {
            if (index === correctIndex) {
                option.classList.add('correct');
            } else if (index === quizState.selectedAnswerIndex && index !== correctIndex) {
                option.classList.add('incorrect');
            }
        });

        // 버튼 변경 (정답 확인 -> 다음 문제)
        changeToNextButton();

    }, 1200); // 채점 애니메이션 후 실행

    if (isCorrect) {
        quizState.correctAnswers++;
        updateScore();
    }
}

function showGradingAnimation(isCorrect) {
    const overlay = document.getElementById('check-mark-overlay');
    const checkMark = document.getElementById('check-mark');

    // 초기화
    overlay.classList.remove('fade-out');
    checkMark.classList.remove('correct', 'incorrect');

    // 마킹 설정
    if (isCorrect) {
        checkMark.classList.add('correct');
        checkMark.textContent = '○';  // 동그라미
    } else {
        checkMark.classList.add('incorrect');
        checkMark.textContent = '✗';  // X표시
    }

    // 애니메이션 시작
    overlay.classList.add('show');

    // 1.5초 후 페이드아웃
    setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.classList.remove('show', 'fade-out');
        }, 500);
    }, 1000);
}

function changeToNextButton() {
    const submitBtn = document.getElementById('submit-btn');
    const nextBtn = document.getElementById('next-btn');

    // 정답 확인 버튼을 다음 문제 버튼으로 변경
    submitBtn.style.display = 'none';
    nextBtn.style.display = 'inline-block';
    nextBtn.textContent = quizState.currentQuestion < quizState.totalQuestions ? '다음 문제' : '결과 보기';

    // 버튼 변경 애니메이션
    nextBtn.style.transform = 'scale(0.9)';
    nextBtn.style.opacity = '0';

    setTimeout(() => {
        nextBtn.style.transform = 'scale(1)';
        nextBtn.style.opacity = '1';
        nextBtn.style.transition = 'all 0.3s ease-out';
    }, 50);
}

function nextQuestion() {
    if (quizState.currentQuestion < quizState.totalQuestions) {
        quizState.currentQuestion++;
        loadQuestion();
        updateProgress();
    } else {
        // 퀴즈 완료 - 결과 화면으로
        showResults();
    }
}

function skipQuestion() {
    if (!quizState.isAnswered) {
        nextQuestion();
    }
}

function updateProgress() {
    const progress = (quizState.currentQuestion / quizState.totalQuestions) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('quiz-progress').textContent = `${quizState.currentQuestion}/${quizState.totalQuestions}`;
    document.getElementById('progress-text').textContent = `진행률: ${Math.round(progress)}%`;
}

function updateScore() {
    document.getElementById('score-display').textContent = `정답: ${quizState.correctAnswers}/${quizState.currentQuestion}`;
}

function showResults() {
    const accuracy = Math.round((quizState.correctAnswers / quizState.totalQuestions) * 100);

    let message = `🎉 퀴즈 완료!\n\n`;
    message += `📊 결과\n`;
    message += `• 정답률: ${accuracy}%\n`;
    message += `• 정답 수: ${quizState.correctAnswers}/${quizState.totalQuestions}\n`;
    message += `• 단어장: ${wordbookData[quizState.selectedWordbook].name}\n\n`;

    if (accuracy >= 90) {
        message += `🏆 훌륭합니다! 완벽한 실력이네요!`;
    } else if (accuracy >= 70) {
        message += `👍 잘했습니다! 조금만 더 연습하면 완벽해요!`;
    } else if (accuracy >= 50) {
        message += `📚 좋은 시작입니다! 더 많이 연습해보세요!`;
    } else {
        message += `💪 포기하지 마세요! 계속 연습하면 실력이 늘어날 거예요!`;
    }

    alert(message);

    // 선택 화면으로 돌아가기
    document.getElementById('quiz-game').style.display = 'none';
    document.getElementById('quiz-selection').style.display = 'block';

    // 상태 초기화
    resetQuizState();
}

function resetQuizState() {
    quizState.selectedAnswerIndex = -1;
    quizState.currentQuestion = 0;
    quizState.correctAnswers = 0;
    quizState.isAnswered = false;
    quizState.questions = [];
}

// Audio playback function
function playAudio() {
    const currentWord = quizState.currentWord.word;

    // Web Speech API를 사용한 TTS
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(currentWord);
        utterance.lang = 'en-US';
        utterance.rate = 0.8;
        utterance.pitch = 1;

        speechSynthesis.speak(utterance);

        // 버튼 애니메이션
        const audioBtn = document.getElementById('audio-btn');
        audioBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            audioBtn.style.transform = 'scale(1)';
        }, 150);
    } else {
        alert('음성 재생을 지원하지 않는 브라우저입니다.');
    }
}

function exitQuiz() {
    if (confirm('퀴즈를 중단하시겠습니까?')) {
        // 게임 중이면 선택 화면으로, 선택 화면이면 이전 페이지로
        if (document.getElementById('quiz-game').style.display !== 'none') {
            document.getElementById('quiz-game').style.display = 'none';
            document.getElementById('quiz-selection').style.display = 'block';
            resetQuizState();
        } else {
            window.history.back();
        }
    }
}

// 키보드 단축키
document.addEventListener('keydown', function(e) {
    // 퀴즈 게임 중일 때만 단축키 활성화
    if (document.getElementById('quiz-game').style.display === 'none') return;
    if (quizState.isAnswered) return;

    switch(e.key) {
        case '1':
        case 'a':
        case 'A':
            selectAnswer(0);
            break;
        case '2':
        case 'b':
        case 'B':
            selectAnswer(1);
            break;
        case '3':
        case 'c':
        case 'C':
            selectAnswer(2);
            break;
        case '4':
        case 'd':
        case 'D':
            selectAnswer(3);
            break;
        case 'Enter':
            if (quizState.selectedAnswerIndex !== -1) {
                submitAnswer();
            }
            break;
        case ' ': // 스페이스바로 오디오 재생
            e.preventDefault();
            playAudio();
            break;
    }
});

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 초기 상태 설정
    document.getElementById('quiz-selection').style.display = 'block';
    document.getElementById('quiz-game').style.display = 'none';

    // 기본 선택 상태 설정
    updateStartButton();
});