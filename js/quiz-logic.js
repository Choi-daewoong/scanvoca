let selectedAnswerIndex = -1;
let currentQuestion = 4;
let totalQuestions = 10;
let correctAnswers = 3;
let isAnswered = false;

function selectAnswer(index) {
    if (isAnswered) return;

    // 이전 선택 해제
    document.querySelectorAll('.answer-option').forEach(option => {
        option.classList.remove('selected');
    });

    // 새로운 선택
    document.querySelectorAll('.answer-option')[index].classList.add('selected');
    selectedAnswerIndex = index;

    // 제출 버튼 활성화
    document.getElementById('submit-btn').disabled = false;
}

function submitAnswer() {
    if (selectedAnswerIndex === -1 || isAnswered) return;

    isAnswered = true;
    const correctIndex = 1; // "어휘, 단어의 집합"이 정답

    // 모든 옵션에 결과 표시
    document.querySelectorAll('.answer-option').forEach((option, index) => {
        if (index === correctIndex) {
            option.classList.add('correct');
        } else if (index === selectedAnswerIndex && index !== correctIndex) {
            option.classList.add('incorrect');
        }
    });

    // 결과 피드백 표시
    const feedback = document.getElementById('result-feedback');
    feedback.classList.add('show');
    
    if (selectedAnswerIndex === correctIndex) {
        feedback.classList.add('correct');
        correctAnswers++;
        updateScore();
    } else {
        feedback.classList.remove('correct');
        feedback.classList.add('incorrect');
        feedback.querySelector('.result-icon').textContent = '❌';
        feedback.querySelector('.result-text').textContent = '틀렸습니다';
        feedback.querySelector('.result-text').classList.remove('correct');
        feedback.querySelector('.result-text').classList.add('incorrect');
        feedback.querySelector('.result-explanation').textContent = 
            `정답은 "어휘, 단어의 집합"입니다. vocabulary는 한 언어나 분야의 단어들을 총칭하는 말입니다.`;
    }

    // 버튼 변경
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.textContent = currentQuestion < totalQuestions ? '다음 문제' : '결과 보기';
    submitBtn.className = 'btn btn-next';
    submitBtn.disabled = false;
    submitBtn.onclick = nextQuestion;
}

function nextQuestion() {
    if (currentQuestion < totalQuestions) {
        currentQuestion++;
        resetQuiz();
        updateProgress();
    } else {
        // 퀴즈 완료 - 결과 화면으로
        showResults();
    }
}

function skipQuestion() {
    if (!isAnswered) {
        nextQuestion();
    }
}

function resetQuiz() {
    // 상태 초기화
    selectedAnswerIndex = -1;
    isAnswered = false;

    // UI 초기화
    document.querySelectorAll('.answer-option').forEach(option => {
        option.className = 'answer-option';
    });

    document.getElementById('result-feedback').className = 'result-feedback';

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.textContent = '정답 확인';
    submitBtn.className = 'btn btn-submit';
    submitBtn.disabled = true;
    submitBtn.onclick = submitAnswer;

    // 새로운 문제 로드 (시뮬레이션)
    loadNewQuestion();
}

function loadNewQuestion() {
    // 실제 앱에서는 새로운 문제 데이터를 로드
    console.log(`새로운 문제 로드: ${currentQuestion}/${totalQuestions}`);
}

function updateProgress() {
    const progress = (currentQuestion / totalQuestions) * 100;
    document.querySelector('.progress-fill').style.width = `${progress}%`;
    document.querySelector('.quiz-progress').textContent = `${currentQuestion}/${totalQuestions}`;
    document.querySelector('.progress-text').textContent = `진행률: ${Math.round(progress)}%`;
}

function updateScore() {
    document.querySelector('.score-display').textContent = `정답: ${correctAnswers}/${currentQuestion}`;
}

function showResults() {
    const accuracy = Math.round((correctAnswers / totalQuestions) * 100);
    alert(`퀴즈 완료!\n정답률: ${accuracy}% (${correctAnswers}/${totalQuestions})`);
    // 실제 앱에서는 결과 화면으로 이동
    window.history.back();
}

function exitQuiz() {
    if (confirm('퀴즈를 중단하시겠습니까?')) {
        window.history.back();
    }
}

// 키보드 단축키
document.addEventListener('keydown', function(e) {
    if (isAnswered) return;

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
            if (selectedAnswerIndex !== -1) {
                submitAnswer();
            }
            break;
    }
});