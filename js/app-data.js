// 단어장 앱 데이터 및 전역 상태 관리

// 단어 데이터 (실제 DB 구조 반영)
const vocabulary = [
    { 
        english: 'photograph', 
        korean: [
            { pos: 'n', meanings: ['사진'] },
            { pos: 'v', meanings: ['사진을 찍다'] }
        ], 
        level: 1, 
        memorized: false 
    },
    { 
        english: 'capture', 
        korean: [
            { pos: 'n', meanings: ['노획물', '생포'] },
            { pos: 'v', meanings: ['매료하다', '사로잡다', '점령하다', '탈취하다', '포착'] }
        ], 
        level: 3, 
        memorized: false 
    },
    { 
        english: 'magnificent', 
        korean: [
            { pos: 'adj', meanings: ['장엄한', '훌륭한', '멋진'] }
        ], 
        level: 4, 
        memorized: false 
    },
    { 
        english: 'extraordinary', 
        korean: [
            { pos: 'adj', meanings: ['특별한', '비범한', '놀라운'] }
        ], 
        level: 4, 
        memorized: false 
    },
    { 
        english: 'beautiful', 
        korean: [
            { pos: 'adj', meanings: ['곱다', '아름다운'] }
        ], 
        level: 2, 
        memorized: true 
    },
    { 
        english: 'wonderful', 
        korean: [
            { pos: 'adj', meanings: ['멋진', '훌륭한', '놀라운'] }
        ], 
        level: 2, 
        memorized: false 
    },
    { 
        english: 'amazing', 
        korean: [
            { pos: 'adj', meanings: ['괘목하다', '굉장한', '신령하다'] }
        ], 
        level: 2, 
        memorized: true 
    },
    { 
        english: 'incredible', 
        korean: [
            { pos: 'adj', meanings: ['믿을 수 없는', '놀라운'] }
        ], 
        level: 3, 
        memorized: false 
    },
    { 
        english: 'fantastic', 
        korean: [
            { pos: 'adj', meanings: ['환상적인', '멋진'] }
        ], 
        level: 3, 
        memorized: false 
    },
    { 
        english: 'outstanding', 
        korean: [
            { pos: 'adj', meanings: ['뛰어난', '두드러진'] }
        ], 
        level: 1, 
        memorized: false 
    }
];

// 전역 상태 변수들
let currentMode = 'study';
let currentDisplayFilter = 'all'; // 표시 방식: all, english, meaning
let currentLevelFilters = new Set(['all']); // 레벨 필터: all, 1, 2, 3, 4 (다중 선택 가능)
let examQuestions = [];
let currentQuestionIndex = 0;
let examAnswers = [];
let selectedQuestionCount = 10;
let isShuffled = false;
let shuffledVocabulary = [...vocabulary];
let currentWordbookName = '기본 단어장';
let isEditingTitle = false;
let selectedWords = new Set(); // 선택된 단어들 추적
let examResults = []; // 시험 결과 저장

// 상태 관리 유틸리티 함수들

// 외운 단어 개수 업데이트
function updateMemorizedCount() {
    const memorizedCount = vocabulary.filter(word => word.memorized).length;
    const countEl = document.getElementById('memorized-count');
    if (countEl) {
        countEl.textContent = memorizedCount;
    }
}

// 외운 단어 토글
function toggleMemorized(englishWord) {
    const wordIndex = vocabulary.findIndex(w => w.english === englishWord);
    if (wordIndex !== -1) {
        vocabulary[wordIndex].memorized = !vocabulary[wordIndex].memorized;

        // 셔플된 배열도 업데이트
        const shuffledIndex = shuffledVocabulary.findIndex(w => w.english === englishWord);
        if (shuffledIndex !== -1) {
            shuffledVocabulary[shuffledIndex].memorized = vocabulary[wordIndex].memorized;
        }

        // 카드 다시 렌더링
        renderWordCards();

        // 외운 단어 개수 업데이트
        updateMemorizedCount();

        // 피드백 메시지
        const message = vocabulary[wordIndex].memorized ? '🔥 외운 단어로 표시했습니다!' : '📚 학습 중인 단어로 변경했습니다.';
        showTemporaryMessage(message);
    }
}

// 여러 단어의 외운 상태 설정
function memorizeWords(englishWords) {
    englishWords.forEach(englishWord => {
        const wordIndex = vocabulary.findIndex(w => w.english === englishWord);
        if (wordIndex !== -1) {
            vocabulary[wordIndex].memorized = true;

            // 셔플된 배열도 업데이트
            const shuffledIndex = shuffledVocabulary.findIndex(w => w.english === englishWord);
            if (shuffledIndex !== -1) {
                shuffledVocabulary[shuffledIndex].memorized = true;
            }
        }
    });

    // 외운 단어 개수 업데이트
    updateMemorizedCount();
}

// 여러 단어의 외운 상태 해제
function unmemorizeWords(englishWords) {
    englishWords.forEach(englishWord => {
        const wordIndex = vocabulary.findIndex(w => w.english === englishWord);
        if (wordIndex !== -1 && vocabulary[wordIndex].memorized) {
            vocabulary[wordIndex].memorized = false;

            // 셔플된 배열도 업데이트
            const shuffledIndex = shuffledVocabulary.findIndex(w => w.english === englishWord);
            if (shuffledIndex !== -1) {
                shuffledVocabulary[shuffledIndex].memorized = false;
            }
        }
    });

    // 외운 단어 개수 업데이트
    updateMemorizedCount();
}

// 임시 메시지 표시 유틸리티
function showTemporaryMessage(message) {
    // 기존 메시지가 있으면 제거
    const existingMsg = document.querySelector('.temp-message');
    if (existingMsg) {
        existingMsg.remove();
    }

    const msgEl = document.createElement('div');
    msgEl.className = 'temp-message';
    msgEl.textContent = message;
    msgEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(79, 70, 229, 0.9);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000;
        animation: fadeInOut 2s ease-in-out;
    `;

    document.body.appendChild(msgEl);

    setTimeout(() => {
        if (msgEl.parentNode) {
            msgEl.remove();
        }
    }, 2000);
}

// 발음 기능
function playPronunciation(word) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.8;
        utterance.pitch = 1;
        speechSynthesis.speak(utterance);
    } else {
        alert('🔊 ' + word + ' 발음이 재생됩니다.');
    }
}