// 학습 모드 관련 기능

// 단어의 뜻 정보 가져오기 (HTML 형태로)
function getWordMeaningsHTML(word) {
    if (Array.isArray(word.korean) && word.korean[0]?.pos) {
        // 새로운 구조: 품사별로 분리된 뜻 (각 품사마다 줄바꿈)
        return word.korean.map(item =>
            `<div class="word-line">
                <span class="word-pos-tag">[${item.pos}]</span>
                <span class="word-ko">${item.meanings.join(', ')}</span>
            </div>`
        ).join('');
    } else if (word.pos) {
        // 기존 구조: 단일 품사 (임시 데모용)
        return `<div class="word-line">
            <span class="word-pos-tag">[${word.pos}]</span>
            <span class="word-ko">${word.korean.join(', ')}</span>
        </div>`;
    } else {
        // 실제 DB 구조: 품사 정보 없음
        return `<div class="word-line">
            <span class="word-ko">${Array.isArray(word.korean) ? word.korean.join(', ') : word.korean}</span>
        </div>`;
    }
}

// 단어 카드 렌더링 (새로운 필터링 시스템 적용)
function renderWordCards() {
    const grid = document.getElementById('word-grid');
    grid.innerHTML = '';

    // 섞인 상태에 따라 기본 데이터 선택
    let baseWords = isShuffled ? shuffledVocabulary : vocabulary;
    let filteredWords = baseWords;

    // 레벨 필터링 (다중 선택 지원)
    if (!currentLevelFilters.has('all')) {
        filteredWords = baseWords.filter(word =>
            currentLevelFilters.has(word.level)
        );
    }

    filteredWords.forEach((word, index) => {
        const card = document.createElement('div');
        card.className = `word-card ${selectedWords.has(word.english) ? 'selected' : ''}`;
        card.onclick = (e) => {
            if (e.target.type !== 'checkbox') {
                flipCard(card);
            }
        };

        const meaningsHTML = getWordMeaningsHTML(word);

        let content = '';
        if (currentDisplayFilter === 'english') {
            // 영어만 보기
            content = `
                <div class="word-info">
                    <div class="word-line">
                        <span class="word-en">${word.english}</span>
                    </div>
                    <div class="word-meanings hidden">${meaningsHTML}</div>
                </div>
            `;
        } else if (currentDisplayFilter === 'meaning') {
            // 뜻만 보기
            content = `
                <div class="word-info">
                    <div class="word-line">
                        <span class="word-en hidden">${word.english}</span>
                    </div>
                    <div class="word-meanings">${meaningsHTML}</div>
                </div>
            `;
        } else {
            // 전체 보기
            content = `
                <div class="word-info">
                    <div class="word-line">
                        <span class="word-en">${word.english}</span>
                    </div>
                    <div class="word-meanings">${meaningsHTML}</div>
                </div>
            `;
        }

        card.innerHTML = `
            <input type="checkbox" class="word-checkbox" ${selectedWords.has(word.english) ? 'checked' : ''}
                   onchange="toggleWordSelection('${word.english}', this)" onclick="event.stopPropagation()">
            <button class="pronunciation-btn" onclick="event.stopPropagation(); playPronunciation('${word.english}')">🔊</button>
            <button class="memorize-btn ${word.memorized ? 'memorized' : ''}" onclick="event.stopPropagation(); toggleMemorized('${word.english}')">🔥</button>
            <div class="word-level level-${word.level}">Lv.${word.level}</div>
            ${content}
        `;

        grid.appendChild(card);
    });
}