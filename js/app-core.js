// 단어장 앱 핵심 로직 - 네비게이션 및 앱 흐름 관리

// 홈으로 이동
function goHome() {
    // 편집 중이면 저장
    if (isEditingTitle) {
        saveWordbookName();
    }

    document.getElementById('home-screen').style.display = 'block';
    document.getElementById('wordbook-detail').classList.remove('active');
}

// 단어장 열기
function openWordbook() {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('wordbook-detail').classList.add('active');
    updateMemorizedCount(); // 외운 단어 개수 초기화
    switchMode('study');
}

// 모드 전환 (학습/시험)
function switchMode(mode) {
    currentMode = mode;

    // 모드 버튼 업데이트
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // 화면 표시
    if (mode === 'study') {
        document.getElementById('study-mode').style.display = 'block';
        document.getElementById('exam-mode').classList.remove('active');
        renderWordCards();
    } else {
        document.getElementById('study-mode').style.display = 'none';
        document.getElementById('exam-mode').classList.add('active');
        updateMemorizedCount(); // 외운 단어 개수 업데이트
        initializeExamSetup(); // 시험 설정 화면 초기화
        resetExam();
    }
}

// 단어장 이름 편집 관리
function editWordbookName() {
    if (isEditingTitle) return;

    isEditingTitle = true;
    const titleElement = document.getElementById('wordbook-title');
    const editBtn = document.querySelector('.edit-btn');

    // 현재 제목을 input으로 변경
    titleElement.innerHTML = `<input type="text" class="title-input" value="${currentWordbookName}" onblur="saveWordbookName()" onkeydown="handleTitleKeydown(event)">`;

    // 편집 버튼 텍스트 변경
    editBtn.textContent = '저장';
    editBtn.onclick = saveWordbookName;

    // input에 포커스
    const input = titleElement.querySelector('.title-input');
    input.focus();
    input.select();
}

// 단어장 이름 저장
function saveWordbookName() {
    if (!isEditingTitle) return;

    const input = document.querySelector('.title-input');
    const newName = input.value.trim();

    if (newName && newName !== currentWordbookName) {
        currentWordbookName = newName;

        // 홈 화면 단어장 이름도 업데이트
        document.querySelector('.wordbook-name').textContent = newName;
    }

    // 제목을 일반 텍스트로 복원
    const titleElement = document.getElementById('wordbook-title');
    titleElement.textContent = currentWordbookName;

    // 편집 버튼 복원
    const editBtn = document.querySelector('.edit-btn');
    editBtn.textContent = '편집';
    editBtn.onclick = editWordbookName;

    isEditingTitle = false;
}

// 키보드 이벤트 처리
function handleTitleKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        saveWordbookName();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelEdit();
    }
}

// 편집 취소
function cancelEdit() {
    const titleElement = document.getElementById('wordbook-title');
    titleElement.textContent = currentWordbookName;

    const editBtn = document.querySelector('.edit-btn');
    editBtn.textContent = '편집';
    editBtn.onclick = editWordbookName;

    isEditingTitle = false;
}

// 표시 필터 설정 (전체/영어만/뜻만)
function setDisplayFilter(filter) {
    currentDisplayFilter = filter;

    // 표시 필터 버튼 업데이트
    document.querySelectorAll('.filter-tabs:first-child .filter-tab').forEach(tab => {
        if (!tab.classList.contains('shuffle-btn')) {
            tab.classList.remove('active');
        }
    });
    event.target.classList.add('active');

    // 선택 상태 초기화
    selectedWords.clear();
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    updateDeleteButton();

    renderWordCards();
}

// 레벨 필터 토글 (다중 선택 가능)
function toggleLevelFilter(level) {
    if (level === 'all') {
        // '모두' 선택 시 다른 레벨 선택 해제하고 'all'만 활성화
        currentLevelFilters.clear();
        currentLevelFilters.add('all');
    } else {
        // 특정 레벨 선택/해제
        if (currentLevelFilters.has('all')) {
            // 'all'이 선택되어 있었다면 제거
            currentLevelFilters.delete('all');
        }

        if (currentLevelFilters.has(level)) {
            // 이미 선택된 레벨이면 해제
            currentLevelFilters.delete(level);
        } else {
            // 선택되지 않은 레벨이면 추가
            currentLevelFilters.add(level);
        }

        // 아무것도 선택되지 않았으면 '모두' 활성화
        if (currentLevelFilters.size === 0) {
            currentLevelFilters.add('all');
        }
    }

    // 레벨 버튼 UI 업데이트
    updateLevelFilterButtons();

    // 선택 상태 초기화
    selectedWords.clear();
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    updateDeleteButton();

    renderWordCards();
}

// 레벨 필터 버튼 상태 업데이트
function updateLevelFilterButtons() {
    const levelButtons = document.querySelectorAll('.level-tabs .filter-tab');

    levelButtons.forEach(btn => {
        btn.classList.remove('active');
        const btnText = btn.textContent;

        if (btnText === '모두' && currentLevelFilters.has('all')) {
            btn.classList.add('active');
        } else if (btnText.startsWith('Lv.')) {
            const level = parseInt(btnText.replace('Lv.', ''));
            if (currentLevelFilters.has(level)) {
                btn.classList.add('active');
            }
        }
    });
}

// 단어 섞기 함수
function shuffleWords() {
    const shuffleBtn = document.querySelector('.shuffle-btn');

    // 애니메이션 효과
    shuffleBtn.classList.add('shuffling');

    setTimeout(() => {
        shuffleBtn.classList.remove('shuffling');

        // Fisher-Yates 섞기 알고리즘
        shuffledVocabulary = [...vocabulary];
        for (let i = shuffledVocabulary.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledVocabulary[i], shuffledVocabulary[j]] = [shuffledVocabulary[j], shuffledVocabulary[i]];
        }

        // 선택 상태 초기화
        selectedWords.clear();
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        updateDeleteButton();

        isShuffled = true;
        renderWordCards();

        // 섞기 완료 알림
        const originalText = shuffleBtn.innerHTML;
        shuffleBtn.innerHTML = '✓ 섞김';
        setTimeout(() => {
            shuffleBtn.innerHTML = originalText;
        }, 1000);

    }, 250);
}

// 카드 뒤집기 (학습 모드)
function flipCard(card) {
    const englishEl = card.querySelector('.word-en');
    const meaningsEl = card.querySelector('.word-meanings');

    if (englishEl && englishEl.classList.contains('hidden')) {
        englishEl.classList.remove('hidden');
        if (meaningsEl) meaningsEl.classList.add('hidden');
    } else if (meaningsEl && meaningsEl.classList.contains('hidden')) {
        if (englishEl) englishEl.classList.add('hidden');
        meaningsEl.classList.remove('hidden');
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', function() {
    renderWordCards();
});