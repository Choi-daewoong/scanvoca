let currentWord = 8;
let totalWords = 32;
let isFlipped = false;

function flipCard() {
    const card = document.querySelector('.study-card');
    card.classList.toggle('flipped');
    isFlipped = !isFlipped;
}

function exitStudy() {
    if (confirm('학습을 중단하시겠습니까? 진행 상황은 저장됩니다.')) {
        window.history.back();
    }
}

function previousWord() {
    if (currentWord > 1) {
        currentWord--;
        updateProgress();
        resetCard();
    }
}

function nextWord() {
    if (currentWord < totalWords) {
        currentWord++;
        updateProgress();
        resetCard();
        
        // Enable previous button
        document.querySelector('.btn-nav').disabled = false;
    }
}

function markDifficulty(level) {
    console.log(`단어 난이도: ${level}`);
    
    // 통계 업데이트
    updateStats(level);
    
    // 자동으로 다음 단어로
    setTimeout(() => {
        nextWord();
    }, 300);
}

function updateProgress() {
    const progress = (currentWord / totalWords) * 100;
    document.querySelector('.progress-fill').style.width = `${progress}%`;
    document.querySelector('.study-progress').textContent = `${currentWord}/${totalWords}`;
}

function resetCard() {
    const card = document.querySelector('.study-card');
    if (isFlipped) {
        card.classList.remove('flipped');
        isFlipped = false;
    }
}

function updateStats(difficulty) {
    // 실제 앱에서는 실제 통계 업데이트
    console.log(`통계 업데이트: ${difficulty}`);
}

// 키보드 단축키
document.addEventListener('keydown', function(e) {
    switch(e.key) {
        case ' ':
            e.preventDefault();
            flipCard();
            break;
        case 'ArrowLeft':
            previousWord();
            break;
        case 'ArrowRight':
            nextWord();
            break;
        case '1':
            markDifficulty('hard');
            break;
        case '2':
            markDifficulty('medium');
            break;
        case '3':
            markDifficulty('easy');
            break;
    }
});