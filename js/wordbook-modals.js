// 새 단어장 모달 관련 함수들
function showNewWordbookModal() {
    document.getElementById('newWordbookModal').classList.add('show');
    document.getElementById('wordbookNameInput').focus();
}

function hideNewWordbookModal() {
    document.getElementById('newWordbookModal').classList.remove('show');
    document.getElementById('wordbookNameInput').value = '';
    document.getElementById('confirmBtn').disabled = true;
}

function createNewWordbook() {
    const name = document.getElementById('wordbookNameInput').value.trim();
    if (name) {
        // 새 단어장 생성 로직
        console.log('새 단어장 생성:', name);
        
        // 단어장 목록에 추가 (시뮬레이션)
        addNewWordbookToList(name);
        
        // 모달 닫기
        hideNewWordbookModal();
        
        // 성공 메시지
        alert(`"${name}" 단어장이 만들어졌습니다!`);
    }
}

// 단어장 목록에 새 항목 추가
function addNewWordbookToList(name) {
    const wordbookList = document.getElementById('wordbookList');
    const newItemId = 'wb-' + Date.now();
    const newItem = document.createElement('div');
    newItem.className = 'wordbook-item';
    newItem.draggable = true;
    newItem.setAttribute('data-wordbook-id', newItemId);
    newItem.innerHTML = `
        <div class="drag-handle">⋮⋮</div>
        <div class="wordbook-content">
            <div class="wordbook-header">
                <div class="wordbook-title">${name}</div>
                <div class="wordbook-icon">📝</div>
            </div>
            <div class="wordbook-meta">
                <span class="word-count">0개 단어</span>
                <span class="last-studied">방금 생성</span>
            </div>
            <div class="progress-info">
                <span class="progress-text">학습 진행률</span>
                <span class="progress-percent">0%</span>
            </div>
            <div class="mini-progress-bar">
                <div class="mini-progress-fill" style="width: 0%;"></div>
            </div>
        </div>
    `;
    wordbookList.appendChild(newItem);
    
    // 새로 추가된 요소에 이벤트 추가
    setTimeout(() => {
        initializeDragAndDrop();
    }, 100);
}

// 그룹 모달 관련 함수들
function showGroupModal(sourceWordbook, targetWordbook) {
    const modal = document.getElementById('groupModal');
    const previewItems = document.getElementById('groupPreviewItems');
    const groupNameInput = document.getElementById('groupNameInput');
    
    // 미리보기 항목 추가
    previewItems.innerHTML = `
        <div class="group-preview-item">${sourceWordbook.title}</div>
        <div class="group-preview-item">${targetWordbook.title}</div>
    `;
    
    // 임시 데이터 저장
    window.tempGroupData = {
        source: sourceWordbook,
        target: targetWordbook
    };
    
    modal.classList.add('show');
    groupNameInput.focus();
}

function hideGroupModal() {
    const modal = document.getElementById('groupModal');
    const groupNameInput = document.getElementById('groupNameInput');
    const confirmBtn = document.getElementById('groupConfirmBtn');
    
    modal.classList.remove('show');
    groupNameInput.value = '';
    confirmBtn.disabled = true;
    
    // 임시 데이터 정리
    delete window.tempGroupData;
}

function createGroup() {
    const groupName = document.getElementById('groupNameInput').value.trim();
    const groupData = window.tempGroupData;
    
    if (groupName && groupData) {
        console.log(`그룹 생성: ${groupName}`, groupData);
        
        // 그룹 HTML 생성
        const groupHTML = createGroupHTML(groupName, [groupData.source, groupData.target]);
        
        // 원본 단어장들 제거
        const sourceElement = document.querySelector(`[data-wordbook-id="${groupData.source.id}"]`);
        const targetElement = document.querySelector(`[data-wordbook-id="${groupData.target.id}"]`);
        
        const wordbookList = document.getElementById('wordbookList');
        
        // 그룹을 대상 단어장 위치에 추가
        if (targetElement) {
            targetElement.insertAdjacentHTML('beforebegin', groupHTML);
            targetElement.remove();
        }
        if (sourceElement && sourceElement !== targetElement) {
            sourceElement.remove();
        }
        
        // 이벤트 리스너 재초기화
        setTimeout(() => {
            initializeDragAndDrop();
            // 새로 생성된 그룹 내 단어장들에 클릭 이벤트 추가
            setupGroupWordbookEvents();
        }, 100);
        
        hideGroupModal();
        alert(`"${groupName}" 그룹이 생성되었습니다!`);
    }
}

function createGroupHTML(groupName, wordbooks) {
    const totalWords = wordbooks.reduce((sum, wb) => sum + parseInt(wb.wordCount), 0);
    const avgProgress = Math.round(wordbooks.reduce((sum, wb) => sum + wb.progress, 0) / wordbooks.length);
    
    const wordbookItems = wordbooks.map(wb => `
        <div class="wordbook-item" draggable="true" data-wordbook-id="${wb.id}">
            <div class="drag-handle">⋮⋮</div>
            <div class="wordbook-content">
                <div class="wordbook-header">
                    <div class="wordbook-title">${wb.title}</div>
                    <div class="wordbook-icon">${wb.icon}</div>
                </div>
                <div class="wordbook-meta">
                    <span class="word-count">${wb.wordCount}개 단어</span>
                    <span class="last-studied">${wb.lastStudied}</span>
                </div>
                <div class="progress-info">
                    <span class="progress-text">학습 진행률</span>
                    <span class="progress-percent">${wb.progress}%</span>
                </div>
                <div class="mini-progress-bar">
                    <div class="mini-progress-fill" style="width: ${wb.progress}%;"></div>
                </div>
            </div>
        </div>
    `).join('');
    
    return `
        <div class="wordbook-group" draggable="true" data-group-id="group-${Date.now()}">
            <div class="drag-handle">⋮⋮</div>
            <div class="group-header" onclick="toggleGroup(this)">
                <div class="group-title">
                    <span class="group-name">${groupName}</span>
                    <span class="group-count">${wordbooks.length}</span>
                </div>
                <div class="group-toggle">▶</div>
            </div>
            <div class="group-content">
                ${wordbookItems}
            </div>
        </div>
    `;
}

function toggleGroup(header) {
    const toggle = header.querySelector('.group-toggle');
    const content = header.parentElement.querySelector('.group-content');
    
    toggle.classList.toggle('expanded');
    content.classList.toggle('expanded');
}

// 기타 유틸리티 함수들
function goToWordbook(wordbookId) {
    console.log(`단어장으로 이동: ${wordbookId}`);
    window.location.href = 'wordbook-detail.html';
}

// 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', function() {
    // 입력 감지 및 버튼 활성화
    document.getElementById('wordbookNameInput').addEventListener('input', function() {
        const confirmBtn = document.getElementById('confirmBtn');
        confirmBtn.disabled = this.value.trim() === '';
    });

    // Enter 키로 단어장 만들기
    document.getElementById('wordbookNameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.value.trim() !== '') {
            createNewWordbook();
        }
    });

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideNewWordbookModal();
            hideGroupModal();
        }
    });

    // 모달 배경 클릭으로 닫기
    document.getElementById('newWordbookModal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideNewWordbookModal();
        }
    });

    // 그룹 모달 입력 감지
    document.getElementById('groupNameInput').addEventListener('input', function() {
        const confirmBtn = document.getElementById('groupConfirmBtn');
        confirmBtn.disabled = this.value.trim() === '';
    });

    // Enter 키로 그룹 만들기
    document.getElementById('groupNameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.value.trim() !== '') {
            createGroup();
        }
    });

    // 그룹 모달 배경 클릭으로 닫기
    document.getElementById('groupModal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideGroupModal();
        }
    });

    // 페이지 로드 시 드래그 앤 드롭 초기화
    initializeDragAndDrop();
});