// 드래그 앤 드롭 관련 변수
let draggedElement = null;
let draggedData = null;
let dragStartTime = null;
let dragStartPosition = null;

// 드래그 앤 드롭 이벤트 핸들러
function initializeDragAndDrop() {
    // 기존 이벤트 리스너 제거를 위해 모든 요소의 이벤트를 정리
    const items = document.querySelectorAll('.wordbook-item, .wordbook-group');
    const container = document.getElementById('wordbookList');
    
    items.forEach(item => {
        // 이미 이벤트가 추가된 요소는 스킵
        if (item.hasAttribute('data-drag-initialized')) {
            return;
        }
        item.setAttribute('data-drag-initialized', 'true');
        
        // 드래그 시작
        item.addEventListener('dragstart', function(e) {
            draggedElement = this;
            dragStartTime = Date.now();
            dragStartPosition = { x: e.clientX, y: e.clientY };
            
            if (this.classList.contains('wordbook-item')) {
                draggedData = extractWordbookData(this);
            } else {
                draggedData = extractGroupData(this);
            }
            
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.outerHTML);
        });
        
        // 드래그 종료
        item.addEventListener('dragend', function(e) {
            this.classList.remove('dragging');
            clearAllDropIndicators();
            clearAllHighlights();
            
            draggedElement = null;
            draggedData = null;
            dragStartTime = null;
            dragStartPosition = null;
        });
        
        // 드롭 허용
        item.addEventListener('dragover', function(e) {
            if (draggedElement && draggedElement !== this) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                // 드롭 위치 결정
                const rect = this.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                const dropPosition = e.clientY < midY ? 'before' : 'after';
                
                // 중앙 영역 체크 (그룹 생성용)
                const dropX = e.clientX - rect.left;
                const dropY = e.clientY - rect.top;
                const isInCenterArea = dropX > rect.width * 0.2 && dropX < rect.width * 0.8 &&
                                     dropY > rect.height * 0.3 && dropY < rect.height * 0.7;
                
                // 시각적 피드백
                clearAllHighlights();
                
                if (draggedElement.classList.contains('wordbook-item') && 
                    this.classList.contains('wordbook-group') &&
                    !isWordbookInGroup(draggedElement)) {
                    // 외부 단어장을 그룹에 추가 모드
                    this.classList.add('drag-over-group');
                    clearAllDropIndicators();
                } else if (draggedElement.classList.contains('wordbook-item') && 
                         this.classList.contains('wordbook-item') &&
                         isWordbookInGroup(draggedElement) && 
                         isWordbookInGroup(this) &&
                         getParentGroup(draggedElement) === getParentGroup(this)) {
                    // 같은 그룹 내 순서 변경 모드
                    this.classList.add('drag-over-reorder');
                    showDropIndicator(this, dropPosition);
                } else if (isInCenterArea && 
                    draggedElement.classList.contains('wordbook-item') && 
                    this.classList.contains('wordbook-item') &&
                    !isWordbookInGroup(draggedElement) && !isWordbookInGroup(this)) {
                    // 외부 단어장끼리 그룹 생성 모드
                    this.classList.add('drag-over-group');
                    clearAllDropIndicators();
                } else {
                    // 일반 순서 변경 모드
                    this.classList.add('drag-over-reorder');
                    showDropIndicator(this, dropPosition);
                }
            }
        });
        
        // 드롭 존 진입
        item.addEventListener('dragenter', function(e) {
            if (draggedElement && draggedElement !== this) {
                e.preventDefault();
            }
        });
        
        // 드롭 존 떠나기
        item.addEventListener('dragleave', function(e) {
            if (!this.contains(e.relatedTarget)) {
                clearDropIndicator(this);
            }
        });
        
        // 드롭 처리
        item.addEventListener('drop', function(e) {
            e.preventDefault();
            
            if (draggedElement && draggedElement !== this) {
                const dragDuration = Date.now() - dragStartTime;
                const dragDistance = Math.sqrt(
                    Math.pow(e.clientX - dragStartPosition.x, 2) + 
                    Math.pow(e.clientY - dragStartPosition.y, 2)
                );
                
                // 드롭 위치 결정
                const rect = this.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                const dropPosition = e.clientY < midY ? 'before' : 'after';
                
                // 드롭 위치가 중앙 영역인지 확인 (그룹 생성용)
                const dropX = e.clientX - rect.left;
                const dropY = e.clientY - rect.top;
                const isInCenterArea = dropX > rect.width * 0.2 && dropX < rect.width * 0.8 &&
                                     dropY > rect.height * 0.3 && dropY < rect.height * 0.7;
                
                // 드롭 대상에 따른 처리
                if (draggedElement.classList.contains('wordbook-item') && 
                    this.classList.contains('wordbook-group') &&
                    !isWordbookInGroup(draggedElement)) {
                    // 외부 단어장을 그룹에 드롭 - 그룹에 추가
                    addWordbookToGroup(draggedElement, this);
                } else if (draggedElement.classList.contains('wordbook-item') && 
                         this.classList.contains('wordbook-item') &&
                         isWordbookInGroup(draggedElement) && 
                         isWordbookInGroup(this) &&
                         getParentGroup(draggedElement) === getParentGroup(this)) {
                    // 같은 그룹 내 단어장끼리 순서 변경
                    reorderWithinGroup(draggedElement, this, dropPosition);
                } else if (isInCenterArea && 
                    draggedElement.classList.contains('wordbook-item') && 
                    this.classList.contains('wordbook-item') &&
                    !isWordbookInGroup(draggedElement) && !isWordbookInGroup(this)) {
                    // 외부 단어장끼리 중앙 드롭 - 그룹 생성
                    const targetData = extractWordbookData(this);
                    showGroupModal(draggedData, targetData);
                } else {
                    // 일반 순서 변경
                    reorderItems(draggedElement, this, dropPosition);
                }
            }
            
            clearAllDropIndicators();
            clearAllHighlights();
        });

        // 단어장 콘텐츠 클릭 이벤트 (wordbook-item만)
        if (item.classList.contains('wordbook-item')) {
            const content = item.querySelector('.wordbook-content');
            if (content && !item.hasAttribute('data-click-added')) {
                content.addEventListener('click', function(e) {
                    e.stopPropagation();
                    goToWordbook(item.getAttribute('data-wordbook-id'));
                });
                item.setAttribute('data-click-added', 'true');
            }
        }
    });
}

// 단어장이 그룹 내부에 있는지 확인
function isWordbookInGroup(wordbookElement) {
    return wordbookElement.closest('.wordbook-group') !== null;
}

// 단어장의 부모 그룹 반환
function getParentGroup(wordbookElement) {
    return wordbookElement.closest('.wordbook-group');
}

// 그룹 내 단어장들에 클릭 이벤트 설정
function setupGroupWordbookEvents() {
    const groupWordbooks = document.querySelectorAll('.wordbook-group .wordbook-item .wordbook-content');
    groupWordbooks.forEach(content => {
        const wordbookItem = content.closest('.wordbook-item');
        const wordbookId = wordbookItem.getAttribute('data-wordbook-id');
        
        // 기존 이벤트 제거
        content.onclick = null;
        
        // 새 클릭 이벤트 추가
        content.addEventListener('click', function(e) {
            e.stopPropagation();
            goToWordbook(wordbookId);
        });
    });
}

// 그룹 내에서 단어장 순서 변경
function reorderWithinGroup(draggedElement, targetElement, position) {
    const groupContent = targetElement.closest('.group-content');
    
    // 드래그 초기화 속성 제거
    draggedElement.removeAttribute('data-drag-initialized');
    
    // 새 위치에 삽입
    if (position === 'before') {
        groupContent.insertBefore(draggedElement, targetElement);
    } else {
        groupContent.insertBefore(draggedElement, targetElement.nextSibling);
    }
    
    console.log('그룹 내 순서 변경 완료:', draggedData, position, 'target:', targetElement);
    
    // 이벤트 리스너 재초기화
    setTimeout(() => {
        initializeDragAndDrop();
    }, 100);
}

// 순서 변경 함수
function reorderItems(draggedElement, targetElement, position) {
    const container = document.getElementById('wordbookList');
    
    // 드래그 초기화 속성 제거
    draggedElement.removeAttribute('data-drag-initialized');
    
    // 새 위치에 삽입
    if (position === 'before') {
        container.insertBefore(draggedElement, targetElement);
    } else {
        container.insertBefore(draggedElement, targetElement.nextSibling);
    }
    
    console.log('순서 변경 완료:', draggedData, position, 'target:', targetElement);
    
    // 이벤트 리스너 재초기화
    setTimeout(() => {
        initializeDragAndDrop();
    }, 100);
}

// 단어장을 그룹에 추가하는 함수
function addWordbookToGroup(wordbookElement, groupElement) {
    const wordbookData = extractWordbookData(wordbookElement);
    const groupContent = groupElement.querySelector('.group-content');
    const groupCount = groupElement.querySelector('.group-count');
    
    // 원본 단어장을 그룹 내부로 직접 이동 (복사가 아닌 이동)
    wordbookElement.removeAttribute('data-drag-initialized');
    
    // 기존 클릭 이벤트 제거하고 새로 추가
    const existingContent = wordbookElement.querySelector('.wordbook-content');
    if (existingContent) {
        existingContent.onclick = () => goToWordbook(wordbookData.id);
    }
    
    // 그룹 내용에 직접 이동
    groupContent.appendChild(wordbookElement);
    
    // 그룹 카운트 업데이트
    const currentCount = parseInt(groupCount.textContent);
    groupCount.textContent = currentCount + 1;
    
    // 그룹 펼치기
    const groupToggle = groupElement.querySelector('.group-toggle');
    if (!groupToggle.classList.contains('expanded')) {
        groupToggle.classList.add('expanded');
        groupContent.classList.add('expanded');
    }
    
    console.log(`"${wordbookData.title}" 단어장이 그룹에 추가되었습니다.`);
    
    // 이벤트 리스너 재초기화
    setTimeout(() => {
        initializeDragAndDrop();
        setupGroupWordbookEvents();
    }, 100);
}

// 드롭 인디케이터 관련 함수들
function showDropIndicator(targetElement, position) {
    clearAllDropIndicators();
    
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator show';
    indicator.setAttribute('data-drop-indicator', 'true');
    
    try {
        if (position === 'before') {
            targetElement.parentNode.insertBefore(indicator, targetElement);
        } else {
            targetElement.parentNode.insertBefore(indicator, targetElement.nextSibling);
        }
    } catch (error) {
        console.error('드롭 인디케이터 표시 실패:', error, targetElement);
    }
}

function clearDropIndicator(targetElement) {
    const indicators = targetElement.parentNode.querySelectorAll('.drop-indicator');
    indicators.forEach(indicator => indicator.remove());
}

function clearAllDropIndicators() {
    const indicators = document.querySelectorAll('.drop-indicator');
    indicators.forEach(indicator => indicator.remove());
}

function clearAllHighlights() {
    document.querySelectorAll('.wordbook-item, .wordbook-group').forEach(item => {
        item.classList.remove('drag-over-group', 'drag-over-reorder');
    });
}

// 데이터 추출 함수들
function extractWordbookData(element) {
    const titleElement = element.querySelector('.wordbook-title');
    const iconElement = element.querySelector('.wordbook-icon');
    const wordCountElement = element.querySelector('.word-count');
    const lastStudiedElement = element.querySelector('.last-studied');
    const progressElement = element.querySelector('.progress-percent');
    
    return {
        id: element.getAttribute('data-wordbook-id'),
        title: titleElement ? titleElement.textContent : '',
        icon: iconElement ? iconElement.textContent : '📚',
        wordCount: wordCountElement ? parseInt(wordCountElement.textContent) : 0,
        lastStudied: lastStudiedElement ? lastStudiedElement.textContent : '',
        progress: progressElement ? parseInt(progressElement.textContent) : 0
    };
}

function extractGroupData(element) {
    const nameElement = element.querySelector('.group-name');
    const countElement = element.querySelector('.group-count');
    
    return {
        id: element.getAttribute('data-group-id') || 'group-' + Date.now(),
        name: nameElement ? nameElement.textContent : '',
        count: countElement ? parseInt(countElement.textContent) : 0,
        type: 'group'
    };
}