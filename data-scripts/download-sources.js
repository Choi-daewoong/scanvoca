const fs = require('fs');
const https = require('https');
const path = require('path');

// 데이터 소스 URL들
const dataSources = {
  // 한영 사전 데이터 (Kengdic)
  kengdic: {
    url: 'https://raw.githubusercontent.com/garfieldnate/kengdic/master/kengdic.tsv',
    filename: 'kengdic.tsv',
    description: '한영 사전 데이터 (Kengdic TSV format)'
  },
  
  // 한국어 단어 목록 1
  koreanWords1: {
    url: 'https://raw.githubusercontent.com/acidsound/korean_wordlist/master/korean_dictionary1.json',
    filename: 'korean-dictionary1.json',
    description: '한국어 사전 데이터 1 (ㄱ-사)'
  },
  
  // 한국어 단어 목록 2  
  koreanWords2: {
    url: 'https://raw.githubusercontent.com/acidsound/korean_wordlist/master/korean_dictionary2.json',
    filename: 'korean-dictionary2.json',
    description: '한국어 사전 데이터 2 (사-ㅎ)'
  },
  
  // 영어 기본 단어 목록 (대안)
  basicEnglishWords: {
    url: 'https://raw.githubusercontent.com/matthewreagan/WebstersEnglishDictionary/master/dictionary.json',
    filename: 'websters-dictionary.json',
    description: 'Webster\'s English Dictionary (기본 영어 단어)'
  }
};

// HTTP(S) 파일 다운로드 함수
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded: ${path.basename(filePath)}`);
          resolve();
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        // 리다이렉트 처리
        downloadFile(response.headers.location, filePath).then(resolve).catch(reject);
      } else {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
      }
    }).on('error', (err) => {
      fs.unlink(filePath, () => {}); // 실패 시 파일 삭제
      reject(err);
    });
  });
}

// 메인 다운로드 함수
async function downloadAllSources() {
  console.log('🚀 데이터 소스 다운로드를 시작합니다...\n');
  
  // raw 디렉토리 생성
  const rawDir = path.join(__dirname, 'raw');
  if (!fs.existsSync(rawDir)) {
    fs.mkdirSync(rawDir, { recursive: true });
  }
  
  for (const [key, source] of Object.entries(dataSources)) {
    try {
      console.log(`📥 ${source.description} 다운로드 중...`);
      const filePath = path.join(rawDir, source.filename);
      
      // 이미 파일이 존재하는지 확인
      if (fs.existsSync(filePath)) {
        console.log(`⚠️  파일이 이미 존재합니다: ${source.filename}`);
        continue;
      }
      
      await downloadFile(source.url, filePath);
      
    } catch (error) {
      console.error(`❌ ${key} 다운로드 실패:`, error.message);
      console.log(`💡 수동으로 다운로드해 주세요: ${source.url}`);
    }
  }
  
  console.log('\n✨ 다운로드 완료! raw/ 폴더를 확인해 주세요.');
  console.log('\n📋 다음 단계:');
  console.log('1. 각 파일의 형식을 확인하세요');
  console.log('2. node analyze-sources.js 를 실행하여 데이터를 분석하세요');
}

// 스크립트 실행
if (require.main === module) {
  downloadAllSources().catch(console.error);
}

module.exports = { downloadAllSources, dataSources };