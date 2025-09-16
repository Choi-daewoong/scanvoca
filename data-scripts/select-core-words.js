const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'processed', 'vocabulary.db');

console.log('🎯 중/고등학생 핵심 10,000 단어 선별');
console.log('=' .repeat(50));

// 단어 선별 기준 설계
const selectionCriteria = {
  // 1. CEFR 레벨 기반 (유럽 언어 공통 기준)
  cefr_weights: {
    'A1': 100,  // 기초 필수
    'A2': 90,   // 기초
    'B1': 80,   // 중급 하
    'B2': 70,   // 중급 상
    'C1': 50,   // 고급 (일부만)
    'C2': 30    // 최고급 (소수만)
  },
  
  // 2. 빈도수 기반 가중치
  frequency_weight: 0.3,
  
  // 3. 단어 길이 기반 (너무 긴 단어는 제외)
  max_word_length: 15,
  min_word_length: 2,
  
  // 4. 품사별 가중치 (추후 품사 정보가 있을 때)
  pos_weights: {
    'noun': 1.0,
    'verb': 1.0,
    'adjective': 0.9,
    'adverb': 0.8,
    'preposition': 0.7,
    'conjunction': 0.6
  },
  
  // 5. 교육과정 연관성 (기본 가중치)
  educational_weight: 0.2
};

class CoreWordSelector {
  constructor(dbPath) {
    this.db = new Database(dbPath, { readonly: true });
  }

  // 단어 점수 계산
  calculateWordScore(word) {
    let score = 0;
    
    // 1. CEFR 레벨 점수
    if (word.cefr_level && selectionCriteria.cefr_weights[word.cefr_level]) {
      score += selectionCriteria.cefr_weights[word.cefr_level];
    } else {
      score += 40; // 기본 점수
    }
    
    // 2. 빈도 점수 (빈도가 높을수록 높은 점수)
    if (word.frequency_rank && word.frequency_rank > 0) {
      // 빈도 순위가 낮을수록 (더 자주 사용되는) 높은 점수
      const frequencyScore = Math.max(0, 100 - (word.frequency_rank / 10));
      score += frequencyScore * selectionCriteria.frequency_weight;
    }
    
    // 3. 단어 길이 점수
    const wordLength = word.word.length;
    if (wordLength >= selectionCriteria.min_word_length && 
        wordLength <= selectionCriteria.max_word_length) {
      // 적절한 길이의 단어에 보너스
      if (wordLength >= 4 && wordLength <= 8) {
        score += 10; // 최적 길이
      } else if (wordLength >= 3 && wordLength <= 10) {
        score += 5;  // 좋은 길이
      }
    } else {
      score -= 20; // 너무 짧거나 긴 단어 패널티
    }
    
    // 4. 단어 복잡도 점수
    const hasSpecialChars = /[^a-zA-Z]/.test(word.word);
    if (hasSpecialChars) {
      score -= 15; // 특수문자 포함 단어 패널티
    }
    
    // 5. 의미의 수 (여러 의미가 있는 단어는 중요할 가능성)
    if (word.meaning_count > 1) {
      score += Math.min(word.meaning_count * 2, 10);
    }
    
    return Math.max(0, score);
  }

  // 교육과정 관련 단어 식별
  isEducationalWord(word) {
    const educationalKeywords = [
      // 학교 관련
      'school', 'student', 'teacher', 'study', 'learn', 'education',
      // 일상 생활
      'family', 'home', 'food', 'time', 'day', 'week', 'month', 'year',
      // 기본 동사
      'be', 'have', 'do', 'make', 'go', 'get', 'take', 'come', 'see', 'know',
      // 기본 형용사  
      'good', 'bad', 'big', 'small', 'new', 'old', 'right', 'left', 'high', 'low',
      // 색깔
      'red', 'blue', 'green', 'yellow', 'black', 'white', 'brown', 'pink',
      // 숫자
      'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'
    ];
    
    return educationalKeywords.some(keyword => 
      word.word.includes(keyword) || keyword.includes(word.word)
    );
  }

  // 핵심 단어 선별
  selectCoreWords(targetCount = 10000) {
    console.log(`📚 ${targetCount}개 핵심 단어 선별 시작...`);
    
    // 모든 단어와 의미 정보 조회
    const wordsQuery = `
      SELECT 
        w.id,
        w.word,
        w.cefr_level,
        w.frequency_rank,
        w.difficulty_level,
        COUNT(wm.id) as meaning_count,
        GROUP_CONCAT(wm.korean_meaning, ' | ') as meanings
      FROM words w
      LEFT JOIN word_meanings wm ON w.id = wm.word_id
      WHERE LENGTH(w.word) >= ? AND LENGTH(w.word) <= ?
      GROUP BY w.id, w.word, w.cefr_level, w.frequency_rank, w.difficulty_level
      HAVING meaning_count > 0
    `;
    
    const words = this.db.prepare(wordsQuery).all(
      selectionCriteria.min_word_length,
      selectionCriteria.max_word_length
    );
    
    console.log(`🔍 총 ${words.length.toLocaleString()}개 단어 분석 중...`);
    
    // 각 단어에 점수 계산
    const scoredWords = words.map(word => {
      const score = this.calculateWordScore(word);
      const isEducational = this.isEducationalWord(word);
      
      return {
        ...word,
        score: score + (isEducational ? 20 : 0), // 교육과정 단어 보너스
        isEducational
      };
    });
    
    // 점수별 정렬
    scoredWords.sort((a, b) => b.score - a.score);
    
    // 상위 단어들 선별
    const selectedWords = scoredWords.slice(0, targetCount);
    
    // 통계 정보
    this.printSelectionStats(selectedWords, targetCount);
    
    return selectedWords;
  }

  // 선별 결과 통계 출력
  printSelectionStats(selectedWords, targetCount) {
    console.log(`\n📊 선별 결과 통계 (상위 ${targetCount}개)`);
    console.log('-' .repeat(40));
    
    // CEFR 레벨별 분포
    const cefrDistribution = {};
    selectedWords.forEach(word => {
      const level = word.cefr_level || 'Unknown';
      cefrDistribution[level] = (cefrDistribution[level] || 0) + 1;
    });
    
    console.log('\n🎯 CEFR 레벨별 분포:');
    Object.entries(cefrDistribution)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([level, count]) => {
        const percentage = ((count / selectedWords.length) * 100).toFixed(1);
        console.log(`  ${level}: ${count.toLocaleString()} (${percentage}%)`);
      });
    
    // 단어 길이별 분포
    const lengthDistribution = {};
    selectedWords.forEach(word => {
      const length = word.word.length;
      lengthDistribution[length] = (lengthDistribution[length] || 0) + 1;
    });
    
    console.log('\n📏 단어 길이별 분포:');
    Object.entries(lengthDistribution)
      .sort(([a], [b]) => Number(a) - Number(b))
      .slice(0, 10) // 상위 10개만
      .forEach(([length, count]) => {
        console.log(`  ${length}자: ${count.toLocaleString()}`);
      });
    
    // 점수 분포
    const scores = selectedWords.map(w => w.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    
    console.log('\n🏆 점수 통계:');
    console.log(`  평균 점수: ${avgScore.toFixed(1)}`);
    console.log(`  최고 점수: ${maxScore}`);
    console.log(`  최저 점수: ${minScore}`);
    
    // 교육과정 관련 단어 수
    const educationalCount = selectedWords.filter(w => w.isEducational).length;
    console.log(`\n📚 교육과정 관련 단어: ${educationalCount}개 (${((educationalCount/selectedWords.length)*100).toFixed(1)}%)`);
    
    // 상위 20개 단어 미리보기
    console.log('\n🌟 상위 20개 단어 미리보기:');
    selectedWords.slice(0, 20).forEach((word, index) => {
      const meanings = word.meanings.split(' | ').slice(0, 2).join(', ');
      console.log(`  ${(index + 1).toString().padStart(2)}. ${word.word.padEnd(12)} (${word.score.toFixed(1)}) - ${meanings}`);
    });
  }

  // 선별된 단어들을 데이터베이스에 마킹
  markCoreWords(selectedWords) {
    console.log('\n💾 핵심 단어 데이터베이스 마킹...');
    
    // 읽기 전용 모드에서는 업데이트 불가
    // 별도 파일로 저장하거나 나중에 업데이트용 스크립트 작성
    const coreWordIds = selectedWords.map(w => w.id);
    
    // JSON 파일로 저장
    const fs = require('fs');
    const outputPath = path.join(__dirname, 'processed', 'core-words-10k.json');
    
    const outputData = {
      metadata: {
        totalSelected: selectedWords.length,
        selectionDate: new Date().toISOString(),
        criteria: selectionCriteria
      },
      words: selectedWords.map(word => ({
        id: word.id,
        word: word.word,
        score: word.score,
        cefr_level: word.cefr_level,
        frequency_rank: word.frequency_rank,
        meaning_count: word.meaning_count,
        isEducational: word.isEducational,
        meanings: word.meanings
      }))
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`✅ 핵심 단어 목록 저장: ${outputPath}`);
    
    return coreWordIds;
  }

  close() {
    this.db.close();
  }
}

// 실행
try {
  const selector = new CoreWordSelector(dbPath);
  const coreWords = selector.selectCoreWords(10000);
  const coreWordIds = selector.markCoreWords(coreWords);
  
  console.log('\n🎉 핵심 단어 선별 완료!');
  console.log(`📋 총 ${coreWords.length}개 단어가 선별되었습니다.`);
  
  selector.close();
} catch (error) {
  console.error('❌ 오류 발생:', error.message);
}