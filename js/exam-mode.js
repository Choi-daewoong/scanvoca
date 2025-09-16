// 시험 모드 관련 기능

// 시험 설정 화면 초기화
function initializeExamSetup() {
    const memorizedCount = vocabulary.filter(word => word.memorized).length;
    const totalCount = vocabulary.length;
    
    document.getElementById('memorized-count').textContent = memorizedCount;
    document.getElementById('total-count').textContent = totalCount;
    
    // 기본 선택을 5문제로 설정
    selectCount(5);
}

// 시험 문제 수 선택
function selectCount(count) {
    selectedQuestionCount = count;

    document.querySelectorAll('.count-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`[data-count="${count}"]`).classList.add('selected');

    // 커스텀 입력 필드 초기화
    document.getElementById('custom-count').value = '';
}

// 커스텀 문항 수 선택
function selectCustomCount() {
    const customInput = document.getElementById('custom-count');
    const customCount = parseInt(customInput.value);

    if (customCount && customCount > 0 && customCount <= 100) {
        selectedQuestionCount = customCount;

        // 기존 버튼 선택 해제
        document.querySelectorAll('.count-btn').forEach(btn => btn.classList.remove('selected'));
    } else {
        customInput.value = '';
        showTemporaryMessage('❌ 1~100 사이의 숫자를 입력해주세요.');
    }
}

// 시험 시작
function startExam() {
    const memorizedWords = vocabulary.filter(word => word.memorized);
    const totalWords = vocabulary.length;

    // 외운 단어가 없는 경우
    if (memorizedWords.length === 0) {
        showTemporaryMessage('🔥 외운 단어가 없습니다! 먼저 단어를 외운 것으로 표시해주세요.');
        return;
    }

    // 설정한 문제 수가 외운 단어보다 많은 경우
    if (selectedQuestionCount > memorizedWords.length) {
        const includeUnmemorized = confirm(
            `외운 단어는 ${memorizedWords.length}개인데, 문제를 ${selectedQuestionCount}개 출제할까요?\n\n` +
            `'확인'을 누르면 외운 것과 안 외운 것 상관없이 ${selectedQuestionCount}문항을 출제합니다.`
        );

        if (includeUnmemorized) {
            // 전체 단어에서 문제 출제
            if (selectedQuestionCount > totalWords) {
                showTemporaryMessage(`❌ 전체 단어는 ${totalWords}개뿐입니다. 문제 수를 줄여주세요.`);
                return;
            }
            examQuestions = [...vocabulary].sort(() => Math.random() - 0.5).slice(0, selectedQuestionCount);
        } else {
            return; // 사용자가 취소한 경우
        }
    } else {
        // 외운 단어만으로 충분한 경우
        examQuestions = [...memorizedWords].sort(() => Math.random() - 0.5).slice(0, selectedQuestionCount);
    }

    examAnswers = [];
    currentQuestionIndex = 0;

    document.getElementById('exam-setup').style.display = 'none';
    document.getElementById('exam-question').classList.add('active');

    updateQuestionDisplay();
}

// 문제 표시 업데이트
function updateQuestionDisplay() {
    const questionNum = document.getElementById('question-number');
    const progressFill = document.getElementById('progress-fill');

    questionNum.textContent = `${currentQuestionIndex + 1} / ${examQuestions.length}`;
    progressFill.style.width = `${((currentQuestionIndex + 1) / examQuestions.length) * 100}%`;

    // 입력 필드 초기화
    document.getElementById('spelling-input').value = '';
    document.getElementById('meaning-input').value = '';

    // 네비게이션 버튼 상태
    document.getElementById('prev-btn').disabled = currentQuestionIndex === 0;
    document.getElementById('next-btn').textContent =
        currentQuestionIndex === examQuestions.length - 1 ? '제출하기' : '다음';

    // 불타는 이모지 상태 업데이트
    updateExamMemorizeButton();
}

// 현재 단어 발음
function playCurrentWord() {
    if (examQuestions[currentQuestionIndex]) {
        playPronunciation(examQuestions[currentQuestionIndex].english);
    }
}

// 시험 중 현재 단어 외운 상태 토글
function toggleCurrentWordMemorized() {
    if (examQuestions[currentQuestionIndex]) {
        const currentWord = examQuestions[currentQuestionIndex];
        toggleMemorized(currentWord.english);

        // 시험 화면의 불타는 이모지 상태 업데이트
        updateExamMemorizeButton();
    }
}

// 시험 화면 불타는 이모지 버튼 상태 업데이트
function updateExamMemorizeButton() {
    const examBtn = document.getElementById('exam-memorize-btn');
    if (examBtn && examQuestions[currentQuestionIndex]) {
        const currentWord = examQuestions[currentQuestionIndex];
        const wordData = vocabulary.find(w => w.english === currentWord.english);

        if (wordData && wordData.memorized) {
            examBtn.classList.add('memorized');
        } else {
            examBtn.classList.remove('memorized');
        }
    }
}

// 이전 문제
function previousQuestion() {
    if (currentQuestionIndex > 0) {
        saveCurrentAnswer();
        currentQuestionIndex--;
        updateQuestionDisplay();
        loadSavedAnswer();
    }
}

// 다음 문제
function nextQuestion() {
    saveCurrentAnswer();

    if (currentQuestionIndex < examQuestions.length - 1) {
        currentQuestionIndex++;
        updateQuestionDisplay();
        loadSavedAnswer();
    } else {
        finishExam();
    }
}

// 현재 답변 저장
function saveCurrentAnswer() {
    const spelling = document.getElementById('spelling-input').value;
    const meaning = document.getElementById('meaning-input').value;

    examAnswers[currentQuestionIndex] = {
        spelling: spelling,
        meaning: meaning,
        question: examQuestions[currentQuestionIndex]
    };
}

// 저장된 답변 불러오기
function loadSavedAnswer() {
    const saved = examAnswers[currentQuestionIndex];
    if (saved) {
        document.getElementById('spelling-input').value = saved.spelling || '';
        document.getElementById('meaning-input').value = saved.meaning || '';
    }
}

// 시험 완료
function finishExam() {
    document.getElementById('exam-question').classList.remove('active');
    document.getElementById('exam-result').classList.add('active');

    gradeExam();
}

// 채점
function gradeExam() {
    let correctCount = 0;
    const results = [];
    const wrongWords = []; // 틀린 단어들 추적
    const correctWords = []; // 맞은 단어들 추적

    examAnswers.forEach(answer => {
        if (!answer) return;

        const spellingCorrect = gradeSpelling(answer.spelling, answer.question.english);
        const meaningCorrect = gradeMeaning(answer.meaning, answer.question.korean);

        const isCorrect = spellingCorrect && meaningCorrect;
        if (isCorrect) {
            correctCount++;
            correctWords.push(answer.question.english);
        } else {
            // 틀린 단어는 외운 상태에서 해제
            wrongWords.push(answer.question.english);
        }

        results.push({
            question: answer.question,
            userSpelling: answer.spelling,
            userMeaning: answer.meaning,
            spellingCorrect,
            meaningCorrect,
            isCorrect
        });
    });

    // 맞은 단어들 외운 상태로 설정 (이미 외운 상태라면 유지)
    if (correctWords.length > 0) {
        memorizeWords(correctWords);
    }

    // 틀린 단어들 외운 상태 해제
    if (wrongWords.length > 0) {
        unmemorizeWords(wrongWords);
        showTemporaryMessage(`✅ 맞은 ${correctWords.length}개 단어 외운 상태 유지, ❌ 틀린 ${wrongWords.length}개 단어 외운 표시 해제`);
    } else if (correctWords.length > 0) {
        showTemporaryMessage(`✅ 모든 문제를 맞혔습니다! ${correctWords.length}개 단어 외운 상태 유지`);
    }

    const score = Math.round((correctCount / examAnswers.length) * 100);

    // 결과 표시
    document.getElementById('final-score').textContent = score + '점';
    document.getElementById('score-message').textContent = getScoreMessage(score);

    displayDetailedResults(results);
}

// 스펠링 채점
function gradeSpelling(answer, correct) {
    return answer.toLowerCase().trim() === correct.toLowerCase().trim();
}

// 뜻 채점
function gradeMeaning(answer, correctMeanings) {
    const userAnswer = answer.toLowerCase().trim();
    return correctMeanings.some(meaning =>
        meaning.toLowerCase().includes(userAnswer) ||
        userAnswer.includes(meaning.toLowerCase())
    );
}

// 점수 메시지
function getScoreMessage(score) {
    if (score >= 90) return "완벽해요! 🎉";
    if (score >= 80) return "훌륭해요! 👏";
    if (score >= 70) return "잘했어요! 💪";
    if (score >= 60) return "조금 더 노력해요! 📚";
    return "다시 학습해보세요! 💪";
}

// 상세 결과 표시
function displayDetailedResults(results) {
    examResults = results; // 결과를 전역 변수에 저장
    const container = document.getElementById('result-details');
    container.innerHTML = '';

    results.forEach((result, index) => {
        const item = document.createElement('div');
        item.className = `result-item ${result.isCorrect ? 'correct' : 'incorrect'}`;

        // 현재 외운 상태 확인
        const wordData = vocabulary.find(w => w.english === result.question.english);
        const isMemorized = wordData && wordData.memorized;

        // 입력 답안 색상 스타일링
        const spellingClass = result.spellingCorrect ? 'user-answer-correct' : 'user-answer-incorrect';
        const meaningClass = result.meaningCorrect ? 'user-answer-correct' : 'user-answer-incorrect';

        item.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-weight: 600;">${result.question.english}</span>
                <button class="result-memorize-btn ${isMemorized ? 'memorized' : ''}" onclick="toggleResultMemorized(${index})">🔥</button>
            </div>
            <div>정답: ${result.question.korean.join(', ')}</div>
            <div>입력: <span class="${spellingClass}">${result.userSpelling}</span> / <span class="${meaningClass}">${result.userMeaning}</span></div>
            <div style="color: ${result.isCorrect ? '#28A745' : '#DC3545'}; font-size: 14px; margin-top: 5px;">
                ${result.isCorrect ? '✓ 정답' : '✗ 오답'}
                ${!result.isCorrect ? ' (🔥 클릭하면 정답으로 인정)' : ''}
            </div>
        `;

        container.appendChild(item);
    });
}

// 결과에서 외운 상태 토글 (정답 인정)
function toggleResultMemorized(index) {
    const result = examResults[index];
    if (!result) return;

    // 단어의 외운 상태 토글
    toggleMemorized(result.question.english);

    // 틀린 문제였다면 정답으로 변경하고 점수 업데이트
    if (!result.isCorrect) {
        result.isCorrect = true;
        result.spellingCorrect = true;
        result.meaningCorrect = true;

        // 점수 재계산
        const correctCount = examResults.filter(r => r.isCorrect).length;
        const newScore = Math.round((correctCount / examResults.length) * 100);

        // 점수 업데이트
        document.getElementById('final-score').textContent = newScore + '점';
        document.getElementById('score-message').textContent = getScoreMessage(newScore);

        // 피드백 메시지
        showTemporaryMessage(`🎉 "${result.question.english}" 정답으로 인정! 점수가 ${newScore}점으로 업데이트되었습니다.`);
    }

    // 결과 다시 표시
    displayDetailedResults(examResults);
}

// 시험 재시작
function retryExam() {
    resetExam();
}

// 시험 초기화
function resetExam() {
    document.getElementById('exam-setup').style.display = 'block';
    document.getElementById('exam-question').classList.remove('active');
    document.getElementById('exam-result').classList.remove('active');

    examQuestions = [];
    examAnswers = [];
    currentQuestionIndex = 0;
}