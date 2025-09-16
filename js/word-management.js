// 단어 관리 기능 - 선택, 삭제, Gmail 스타일 체크박스 시스템

// 단어 선택 토글
function toggleWordSelection(englishWord, checkbox) {
    const card = checkbox.closest('.word-card');

    if (checkbox.checked) {
        selectedWords.add(englishWord);
        card.classList.add('selected');
    } else {
        selectedWords.delete(englishWord);
        card.classList.remove('selected');
    }

    updateSelectAllCheckbox();
    updateDeleteButton();
}

// 전체 선택 토글
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const wordCheckboxes = document.querySelectorAll('.word-checkbox');
    const wordCards = document.querySelectorAll('.word-card');

    if (selectAllCheckbox.checked) {
        // 전체 선택
        selectedWords.clear();
        wordCheckboxes.forEach((checkbox, index) => {
            const englishWord = checkbox.getAttribute('onchange').match(/'([^']+)'/)[1];
            checkbox.checked = true;
            selectedWords.add(englishWord);
            wordCards[index].classList.add('selected');
        });
    } else {
        // 전체 해제
        selectedWords.clear();
        wordCheckboxes.forEach((checkbox, index) => {
            checkbox.checked = false;
            wordCards[index].classList.remove('selected');
        });
    }

    updateDeleteButton();
}

// 전체 선택 체크박스 상태 업데이트
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const wordCheckboxes = document.querySelectorAll('.word-checkbox');
    const checkedCount = document.querySelectorAll('.word-checkbox:checked').length;

    if (checkedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedCount === wordCheckboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

// 삭제 버튼 상태 업데이트
function updateDeleteButton() {
    const deleteBtn = document.getElementById('delete-selected-btn');

    if (selectedWords.size > 0) {
        deleteBtn.classList.add('visible');
        deleteBtn.innerHTML = `🗑 ${selectedWords.size}개 삭제`;
    } else {
        deleteBtn.classList.remove('visible');
        deleteBtn.innerHTML = '🗑 삭제';
    }
}

// 선택된 단어들 삭제
function deleteSelectedWords() {
    if (selectedWords.size === 0) return;

    const confirmDelete = confirm(
        `선택한 ${selectedWords.size}개의 단어를 삭제하시겠습니까?`
    );

    if (confirmDelete) {
        // 선택된 단어들을 vocabulary 배열에서 제거
        const selectedArray = Array.from(selectedWords);
        selectedArray.forEach(englishWord => {
            const index = vocabulary.findIndex(word => word.english === englishWord);
            if (index !== -1) {
                vocabulary.splice(index, 1);
            }

            // 셔플된 배열에서도 제거
            const shuffledIndex = shuffledVocabulary.findIndex(word => word.english === englishWord);
            if (shuffledIndex !== -1) {
                shuffledVocabulary.splice(shuffledIndex, 1);
            }
        });

        // 선택 상태 초기화
        selectedWords.clear();

        // 외운 단어 개수 업데이트
        updateMemorizedCount();

        // 카드 다시 렌더링
        renderWordCards();

        // 피드백 메시지
        showTemporaryMessage(`🗑 ${selectedArray.length}개 단어가 삭제되었습니다.`);

        // 전체 선택 체크박스 상태 초기화
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;

        // 삭제 버튼 숨기기
        updateDeleteButton();
    }
}