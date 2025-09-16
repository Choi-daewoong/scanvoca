const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'processed', 'vocabulary.db');

console.log('🔧 기본 동사 예문 수정 및 구동사 예문 생성');
console.log('=' .repeat(50));

class ExampleFixer {
  constructor() {
    this.db = new Database(dbPath);
  }

  // 기본 동사들의 올바른 예문 정의
  getCorrectBasicExamples() {
    return {
      'get': [
        { en: 'I want to get a good grade.', ko: '나는 좋은 성적을 얻고 싶다.' },
        { en: 'Can you get me some water?', ko: '물 좀 가져다 줄 수 있어?' },
        { en: 'She got a present from her friend.', ko: '그녀는 친구로부터 선물을 받았다.' }
      ],
      'make': [
        { en: 'I make breakfast every morning.', ko: '나는 매일 아침 아침식사를 만든다.' },
        { en: 'She makes friends easily.', ko: '그녀는 쉽게 친구를 사귄다.' },
        { en: 'Let\'s make a plan together.', ko: '함께 계획을 세우자.' }
      ],
      'take': [
        { en: 'Take your umbrella with you.', ko: '우산을 가져가.' },
        { en: 'I take the bus to school.', ko: '나는 버스를 타고 학교에 간다.' },
        { en: 'It takes 30 minutes to get there.', ko: '거기까지 가는데 30분이 걸린다.' }
      ],
      'have': [
        { en: 'I have a younger sister.', ko: '나는 여동생이 있다.' },
        { en: 'We have dinner at 6 PM.', ko: '우리는 오후 6시에 저녁을 먹는다.' },
        { en: 'She has beautiful eyes.', ko: '그녀는 아름다운 눈을 가지고 있다.' }
      ],
      'do': [
        { en: 'What do you do in your free time?', ko: '여가 시간에 무엇을 하나요?' },
        { en: 'I do my homework after school.', ko: '나는 방과 후에 숙제를 한다.' },
        { en: 'She does her best in everything.', ko: '그녀는 모든 일에 최선을 다한다.' }
      ],
      'go': [
        { en: 'I go to the library every week.', ko: '나는 매주 도서관에 간다.' },
        { en: 'Let\'s go to the movies tonight.', ko: '오늘 밤 영화를 보러 가자.' },
        { en: 'Time goes by so fast.', ko: '시간이 정말 빨리 간다.' }
      ],
      'come': [
        { en: 'Please come to my birthday party.', ko: '내 생일 파티에 와주세요.' },
        { en: 'Spring comes after winter.', ko: '겨울 다음에 봄이 온다.' },
        { en: 'The idea came to me suddenly.', ko: '갑자기 아이디어가 떠올랐다.' }
      ],
      'see': [
        { en: 'I can see the mountains from here.', ko: '여기서 산들이 보인다.' },
        { en: 'Let me see your homework.', ko: '네 숙제를 보자.' },
        { en: 'I want to see that movie.', ko: '나는 그 영화를 보고 싶다.' }
      ]
    };
  }

  // 주요 구동사들의 예문 정의
  getPhrasalVerbExamples() {
    return {
      'get up': [
        { en: 'I get up at 7 AM every day.', ko: '나는 매일 오전 7시에 일어난다.' },
        { en: 'What time do you get up?', ko: '몇 시에 일어나나요?' },
        { en: 'She gets up early to exercise.', ko: '그녀는 운동하기 위해 일찍 일어난다.' }
      ],
      'come on': [
        { en: 'Come on, we\'re going to be late!', ko: '어서, 늦을 거야!' },
        { en: 'Come on, you can do it!', ko: '힘내, 너는 할 수 있어!' },
        { en: 'The lights come on automatically.', ko: '불이 자동으로 켜진다.' }
      ],
      'come back': [
        { en: 'I will come back tomorrow.', ko: '내일 돌아올게요.' },
        { en: 'Please come back soon.', ko: '빨리 돌아와주세요.' },
        { en: 'The fashion trend came back.', ko: '그 패션 트렌드가 다시 돌아왔다.' }
      ],
      'come up': [
        { en: 'A problem came up at work.', ko: '직장에서 문제가 생겼다.' },
        { en: 'The sun comes up in the east.', ko: '해는 동쪽에서 뜬다.' },
        { en: 'New ideas come up in meetings.', ko: '회의에서 새로운 아이디어가 나온다.' }
      ],
      'come out': [
        { en: 'The movie comes out next month.', ko: '그 영화는 다음 달에 나온다.' },
        { en: 'The truth will come out eventually.', ko: '진실은 결국 밝혀질 것이다.' },
        { en: 'The stars come out at night.', ko: '밤에 별들이 나타난다.' }
      ],
      'go on': [
        { en: 'The show must go on.', ko: '쇼는 계속되어야 한다.' },
        { en: 'What\'s going on here?', ko: '여기서 무슨 일이 일어나고 있나요?' },
        { en: 'Please go on with your story.', ko: '이야기를 계속해주세요.' }
      ],
      'go up': [
        { en: 'The price of gas went up.', ko: '기름 값이 올랐다.' },
        { en: 'Let\'s go up to the second floor.', ko: '2층으로 올라가자.' },
        { en: 'The balloon goes up in the sky.', ko: '풍선이 하늘로 올라간다.' }
      ],
      'take off': [
        { en: 'Please take off your shoes.', ko: '신발을 벗어주세요.' },
        { en: 'The plane takes off at 3 PM.', ko: '비행기는 오후 3시에 이륙한다.' },
        { en: 'He took off his jacket.', ko: '그는 재킷을 벗었다.' }
      ],
      'take up': [
        { en: 'I want to take up piano lessons.', ko: '피아노 레슨을 시작하고 싶다.' },
        { en: 'This project takes up a lot of time.', ko: '이 프로젝트는 많은 시간을 차지한다.' },
        { en: 'She took up painting as a hobby.', ko: '그녀는 취미로 그림을 시작했다.' }
      ],
      'put on': [
        { en: 'Put on your coat, it\'s cold.', ko: '추우니까 코트를 입어.' },
        { en: 'She puts on makeup every morning.', ko: '그녀는 매일 아침 화장을 한다.' },
        { en: 'We put on a great show.', ko: '우리는 훌륭한 공연을 했다.' }
      ],
      'put off': [
        { en: 'Don\'t put off until tomorrow.', ko: '내일로 미루지 마.' },
        { en: 'The meeting was put off.', ko: '회의가 연기되었다.' },
        { en: 'I keep putting off my homework.', ko: '나는 계속 숙제를 미룬다.' }
      ],
      'look up': [
        { en: 'Look up the word in the dictionary.', ko: '사전에서 그 단어를 찾아봐.' },
        { en: 'I look up to my teacher.', ko: '나는 선생님을 존경한다.' },
        { en: 'Things are looking up for us.', ko: '우리에게는 상황이 좋아지고 있다.' }
      ],
      'look for': [
        { en: 'I\'m looking for my keys.', ko: '열쇠를 찾고 있어.' },
        { en: 'She is looking for a new job.', ko: '그녀는 새 직장을 찾고 있다.' },
        { en: 'What are you looking for?', ko: '무엇을 찾고 있나요?' }
      ],
      'look after': [
        { en: 'I look after my little brother.', ko: '나는 남동생을 돌봐준다.' },
        { en: 'Who looks after your pet?', ko: '누가 당신의 애완동물을 돌봐주나요?' },
        { en: 'Please look after yourself.', ko: '몸 조심하세요.' }
      ],
      'turn on': [
        { en: 'Turn on the lights, please.', ko: '불을 켜주세요.' },
        { en: 'I turn on the TV to watch news.', ko: '뉴스를 보려고 TV를 켠다.' },
        { en: 'Turn on the air conditioner.', ko: '에어컨을 켜.' }
      ],
      'turn down': [
        { en: 'Please turn down the music.', ko: '음악 소리를 줄여주세요.' },
        { en: 'He turned down the job offer.', ko: '그는 취업 제안을 거절했다.' },
        { en: 'Turn down the heat.', ko: '난방을 줄여.' }
      ]
    };
  }

  // 기본 동사 예문 수정
  async fixBasicVerbExamples() {
    console.log('\n🔧 기본 동사 예문 수정 시작...');
    
    const basicExamples = this.getCorrectBasicExamples();
    let fixed = 0;
    
    for (const [word, examples] of Object.entries(basicExamples)) {
      try {
        // 단어 ID 찾기
        const wordData = this.db.prepare('SELECT id FROM words WHERE word = ?').get(word);
        if (!wordData) {
          console.log(`❌ "${word}" 단어를 찾을 수 없음`);
          continue;
        }
        
        // 기존 예문 삭제
        this.db.prepare('DELETE FROM examples WHERE word_id = ?').run(wordData.id);
        
        // 새 예문 삽입
        const insertStmt = this.db.prepare(`
          INSERT INTO examples (word_id, sentence_en, sentence_ko, difficulty_level, source, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        examples.forEach((example, index) => {
          insertStmt.run(
            wordData.id,
            example.en,
            example.ko,
            1, // Easy difficulty
            'fixed_manual',
            new Date().toISOString()
          );
        });
        
        console.log(`✅ "${word}" - ${examples.length}개 예문 수정 완료`);
        fixed++;
        
      } catch (error) {
        console.error(`❌ "${word}" 예문 수정 실패:`, error.message);
      }
    }
    
    console.log(`\n📊 기본 동사 예문 수정 완료: ${fixed}개 단어`);
    return fixed;
  }

  // 구동사 예문 생성
  async generatePhrasalVerbExamples() {
    console.log('\n📝 구동사 예문 생성 시작...');
    
    const phrasalExamples = this.getPhrasalVerbExamples();
    let generated = 0;
    
    for (const [phrasal, examples] of Object.entries(phrasalExamples)) {
      try {
        // 구동사 ID 찾기
        const wordData = this.db.prepare('SELECT id FROM words WHERE word = ?').get(phrasal);
        if (!wordData) {
          console.log(`❌ "${phrasal}" 구동사를 찾을 수 없음`);
          continue;
        }
        
        // 기존 예문이 있는지 확인
        const existingCount = this.db.prepare('SELECT COUNT(*) as count FROM examples WHERE word_id = ?').get(wordData.id);
        
        if (existingCount.count > 0) {
          console.log(`ℹ️  "${phrasal}" - 기존 예문 ${existingCount.count}개 있음, 건너뛰기`);
          continue;
        }
        
        // 새 예문 삽입
        const insertStmt = this.db.prepare(`
          INSERT INTO examples (word_id, sentence_en, sentence_ko, difficulty_level, source, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        examples.forEach((example, index) => {
          insertStmt.run(
            wordData.id,
            example.en,
            example.ko,
            2, // Medium difficulty
            'phrasal_manual',
            new Date().toISOString()
          );
        });
        
        console.log(`✅ "${phrasal}" - ${examples.length}개 예문 생성 완료`);
        generated++;
        
      } catch (error) {
        console.error(`❌ "${phrasal}" 예문 생성 실패:`, error.message);
      }
    }
    
    console.log(`\n📊 구동사 예문 생성 완료: ${generated}개 구동사`);
    return generated;
  }

  // 결과 검증
  verifyResults() {
    console.log('\n🔍 결과 검증...');
    
    // 수정된 기본 동사들 확인
    const basicVerbs = ['get', 'make', 'take', 'have', 'do', 'go', 'come', 'see'];
    console.log('\n📊 기본 동사 예문 상태:');
    
    basicVerbs.forEach(verb => {
      const wordData = this.db.prepare('SELECT id FROM words WHERE word = ?').get(verb);
      if (wordData) {
        const examples = this.db.prepare('SELECT sentence_en FROM examples WHERE word_id = ? LIMIT 1').all(wordData.id);
        if (examples.length > 0) {
          console.log(`  ✅ "${verb}": ${examples[0].sentence_en}`);
        } else {
          console.log(`  ❌ "${verb}": 예문 없음`);
        }
      }
    });
    
    // 구동사들 확인
    const phrasalVerbs = ['get up', 'come on', 'go on', 'take off', 'put on', 'look up'];
    console.log('\n📊 구동사 예문 상태:');
    
    phrasalVerbs.forEach(phrasal => {
      const wordData = this.db.prepare('SELECT id FROM words WHERE word = ?').get(phrasal);
      if (wordData) {
        const examples = this.db.prepare('SELECT sentence_en FROM examples WHERE word_id = ? LIMIT 1').all(wordData.id);
        if (examples.length > 0) {
          console.log(`  ✅ "${phrasal}": ${examples[0].sentence_en}`);
        } else {
          console.log(`  ❌ "${phrasal}": 예문 없음`);
        }
      } else {
        console.log(`  ❌ "${phrasal}": 단어 없음`);
      }
    });
  }

  // 전체 프로세스 실행
  async run() {
    try {
      const fixedCount = await this.fixBasicVerbExamples();
      const generatedCount = await this.generatePhrasalVerbExamples();
      
      this.verifyResults();
      
      console.log('\n🎉 예문 수정 및 생성 완료!');
      console.log(`📊 최종 결과:`);
      console.log(`  - 수정된 기본 동사: ${fixedCount}개`);
      console.log(`  - 생성된 구동사 예문: ${generatedCount}개`);
      
      return { fixed: fixedCount, generated: generatedCount };
      
    } catch (error) {
      console.error('❌ 전체 프로세스 실패:', error.message);
      throw error;
    }
  }

  close() {
    this.db.close();
  }
}

// 실행
try {
  const fixer = new ExampleFixer();
  fixer.run().then((result) => {
    fixer.close();
    console.log('\n✅ 모든 작업 완료!');
  });
} catch (error) {
  console.error('❌ 오류 발생:', error.message);
}