// 스캔 결과 페이지 로직

// 전역 상태
let currentLevelFilters = new Set(['all']); // 레벨 필터 (다중 선택 지원)
let selectedWords = new Set(); // 선택된 단어들

// 단어 데이터 (예시)
const scannedWords = [
    { english: 'vocabulary', korean: '어휘, 단어의 집합', pos: 'n.', level: 3 },
    { english: 'essential', korean: '필수적인, 본질적인', pos: 'adj.', level: 2 },
    { english: 'education', korean: '교육', pos: 'n.', level: 1 },
    { english: 'knowledge', korean: '지식', pos: 'n.', level: 2 }
];

// 페이지 로드시 초기화
document.addEventListener('DOMContentLoaded', function() {
    updateSaveButtonState();

    // 개별 체크박스에 이벤트 리스너 추가
    document.querySelectorAll('.word-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const wordText = this.closest('.word-card').querySelector('.word-text').textContent;
            toggleWordSelection(wordText, this);
        });
    });
});

// 레벨별 단어 선택 (다중 레벨 지원)
function selectLevelWords(level) {
    const wordCards = document.querySelectorAll('.word-card');

    if (level === 'all') {
        // 모든 단어 선택
        currentLevelFilters.clear();
        currentLevelFilters.add('all');

        wordCards.forEach(card => {
            const checkbox = card.querySelector('.word-checkbox');
            const wordText = card.querySelector('.word-text').textContent;
            checkbox.checked = true;
            selectedWords.add(wordText);
        });
    } else {
        // 레벨 토글 로직
        if (currentLevelFilters.has('all')) {
            // '모두'가 선택되어 있으면, 모든 체크 해제하고 해당 레벨만 선택
            currentLevelFilters.clear();
            selectedWords.clear();

            wordCards.forEach(card => {
                const checkbox = card.querySelector('.word-checkbox');
                checkbox.checked = false;
            });
        }

        if (currentLevelFilters.has(level)) {
            // 이미 선택된 레벨이면 해제
            currentLevelFilters.delete(level);

            wordCards.forEach(card => {
                const levelElement = card.querySelector('.word-level');
                if (!levelElement) return;

                const levelText = levelElement.textContent;
                const cardLevel = parseInt(levelText.replace('Lv.', ''));

                if (cardLevel === level) {
                    const checkbox = card.querySelector('.word-checkbox');
                    const wordText = card.querySelector('.word-text').textContent;
                    checkbox.checked = false;
                    selectedWords.delete(wordText);
                }
            });
        } else {
            // 새로운 레벨 추가
            currentLevelFilters.add(level);

            wordCards.forEach(card => {
                const levelElement = card.querySelector('.word-level');
                if (!levelElement) return;

                const levelText = levelElement.textContent;
                const cardLevel = parseInt(levelText.replace('Lv.', ''));

                if (cardLevel === level) {
                    const checkbox = card.querySelector('.word-checkbox');
                    const wordText = card.querySelector('.word-text').textContent;
                    checkbox.checked = true;
                    selectedWords.add(wordText);
                }
            });
        }

        // 레벨이 하나도 선택되지 않으면 '모두' 활성화
        if (currentLevelFilters.size === 0) {
            currentLevelFilters.add('all');
        }
    }

    updateLevelFilterButtons();
    updateSelectAllState();
    updateSaveButtonState();
}

// 레벨 필터 버튼 업데이트
function updateLevelFilterButtons() {
    document.querySelectorAll('.level-tabs .filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    currentLevelFilters.forEach(level => {
        const selector = level === 'all' ?
            '.level-tabs .filter-tab:first-child' :
            `.level-tabs .filter-tab:nth-child(${level + 1})`;
        const button = document.querySelector(selector);
        if (button) {
            button.classList.add('active');
        }
    });
}

// 단어 필터링 함수 제거 (이제 체크박스 선택으로만 동작)

// 뒤로가기 함수 추가
function goBack() {
    window.history.back();
}

// 삭제 확인 팝업
function confirmDelete() {
    if (selectedWords.size === 0) return;

    if (confirm(`선택된 ${selectedWords.size}개 단어를 삭제하시겠습니까?`)) {
        deleteSelectedWords();
    }
}

// 선택된 단어 삭제 함수
function deleteSelectedWords() {
    // 선택된 단어 카드들 제거
    document.querySelectorAll('.word-card').forEach(card => {
        const checkbox = card.querySelector('.word-checkbox');
        if (checkbox.checked) {
            card.remove();
        }
    });

    // 상태 초기화
    selectedWords.clear();
    document.getElementById('select-all-checkbox').checked = false;
    updateSaveButtonState();

    // 총 단어 수 업데이트
    const remainingWords = document.querySelectorAll('.word-card').length;
    document.getElementById('total-words-count').textContent = `총 ${remainingWords}개 단어`;
}

// 전체 선택 토글
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const wordCheckboxes = document.querySelectorAll('.word-checkbox');
    const isChecked = selectAllCheckbox.checked;

    wordCheckboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
        const wordText = checkbox.closest('.word-card').querySelector('.word-text').textContent;

        if (isChecked) {
            selectedWords.add(wordText);
        } else {
            selectedWords.delete(wordText);
        }
    });

    updateSaveButtonState();
}

// 개별 단어 선택 토글
function toggleWordSelection(word, checkbox) {
    if (checkbox.checked) {
        selectedWords.add(word);
    } else {
        selectedWords.delete(word);
    }

    updateSelectAllState();
    updateSaveButtonState();
}

// 전체 선택 체크박스 상태 업데이트
function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const wordCheckboxes = document.querySelectorAll('.word-checkbox');

    const checkedCount = Array.from(wordCheckboxes).filter(cb => cb.checked).length;
    const totalCount = wordCheckboxes.length;

    if (checkedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedCount === totalCount) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

// 저장 버튼 상태 업데이트
function updateSaveButtonState() {
    const saveButton = document.getElementById('save-to-wordbook-btn');
    const moveButton = document.getElementById('move-to-wordbook-btn');

    saveButton.disabled = selectedWords.size === 0;

    if (selectedWords.size > 0) {
        saveButton.textContent = `단어장에 저장 (${selectedWords.size}개)`;
        moveButton.classList.add('show');
        moveButton.classList.add('active');
    } else {
        saveButton.textContent = '단어장에 저장';
        moveButton.classList.remove('show');
        moveButton.classList.remove('active');
    }
}

// 단어장 저장 모달 열기
function saveToWordbook() {
    if (selectedWords.size === 0) return;

    document.getElementById('selected-words-count').textContent = selectedWords.size;
    document.getElementById('wordbook-modal').classList.add('show');
}

// 단어장 모달 닫기
function closeWordbookModal() {
    document.getElementById('wordbook-modal').classList.remove('show');
}

// 새 단어장 생성 폼 보이기
function showCreateWordbookForm() {
    document.getElementById('create-wordbook-form').style.display = 'block';
}

// 새 단어장 생성 폼 숨기기
function hideCreateWordbookForm() {
    document.getElementById('create-wordbook-form').style.display = 'none';
    document.getElementById('new-wordbook-name').value = '';
    document.getElementById('new-wordbook-description').value = '';
}

// 새 단어장 생성
function createWordbook() {
    const name = document.getElementById('new-wordbook-name').value.trim();
    if (!name) {
        alert('단어장 이름을 입력해주세요.');
        return;
    }

    // TODO: 실제 단어장 생성 로직
    alert(`"${name}" 단어장이 생성되었습니다!`);
    closeWordbookModal();

    // 선택된 단어들 초기화
    selectedWords.clear();
    document.querySelectorAll('.word-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('select-all-checkbox').checked = false;
    updateSaveButtonState();
}

// 기존 단어장 선택
function selectWordbook(id, name) {
    // TODO: 실제 단어장에 단어 추가 로직
    alert(`"${name}"에 ${selectedWords.size}개 단어가 추가되었습니다!`);
    closeWordbookModal();

    // 선택된 단어들 초기화
    selectedWords.clear();
    document.querySelectorAll('.word-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('select-all-checkbox').checked = false;
    updateSaveButtonState();
}

// 발음 재생
function playPronunciation(word) {
    console.log('Playing pronunciation for:', word);
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
    }
}

// 사전 열기 (dict-btn 클릭시)
function openDictionary(word) {
    const url = `https://en.dict.naver.com/#/search?query=${encodeURIComponent(word)}`;
    window.open(url, '_blank');
}


// 사전 버튼 이벤트 추가
document.addEventListener('DOMContentLoaded', function() {
    // dict-btn 클릭 이벤트 추가
    document.querySelectorAll('.word-dict-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const wordText = this.closest('.word-card').querySelector('.word-text').textContent;
            openDictionary(wordText);
        });
    });
});