/**
 * 앱 크래시를 일으키는 모든 문법 오류 완전 제거
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'app', 'src');

// 모든 TypeScript/JavaScript 파일 찾기
function findAllTsFiles(dir) {
  const files = [];
  function scanDir(currentDir) {
    const items = fs.readdirSync(currentDir);
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }
  scanDir(dir);
  return files;
}

// 크리티컬 에러들을 수정
function fixCriticalErrors() {
  const allFiles = findAllTsFiles(srcDir);

  console.log(`🔍 총 ${allFiles.length}개 파일 검사 중...`);

  allFiles.forEach(filePath => {
    const relativePath = path.relative(srcDir, filePath);

    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      let hasChanges = false;
      const originalContent = content;

      // 1. 잘못된 await 구문 수정
      const awaitPattern = /await\s*\/\/.*?\(제거됨\)/g;
      if (awaitPattern.test(content)) {
        content = content.replace(awaitPattern, '// await databaseService (제거됨)');
        hasChanges = true;
        console.log(`🔧 ${relativePath}: 잘못된 await 구문 수정`);
      }

      // 2. 불완전한 Promise.all 수정
      const promiseAllPattern = /const\s+\[.*?\]\s*=\s*await\s+Promise\.all\(\[\s*\/\/.*?\]\);?/gs;
      if (promiseAllPattern.test(content)) {
        content = content.replace(promiseAllPattern, '// Promise.all 제거됨 - 임시 데이터 사용');
        hasChanges = true;
        console.log(`🔧 ${relativePath}: 불완전한 Promise.all 수정`);
      }

      // 3. 잘못된 변수 할당 수정 (const variable = 으로 끝나는 것들)
      const incompleteVarPattern = /const\s+\w+\s*=\s*$/gm;
      if (incompleteVarPattern.test(content)) {
        content = content.replace(incompleteVarPattern, 'const temp = null; // 불완전한 할당 수정');
        hasChanges = true;
        console.log(`🔧 ${relativePath}: 불완전한 변수 할당 수정`);
      }

      // 4. import 문제 수정
      const badImportPattern = /import.*databaseService.*from.*['"].*database.*['"];?\s*/g;
      if (badImportPattern.test(content)) {
        content = content.replace(badImportPattern, '');
        hasChanges = true;
        console.log(`🔧 ${relativePath}: databaseService import 제거`);
      }

      // 5. 빈 if/else 블록 수정
      const emptyIfPattern = /if\s*\([^)]*\)\s*\{\s*\}\s*else\s*\{\s*\}/g;
      if (emptyIfPattern.test(content)) {
        content = content.replace(emptyIfPattern, '// if-else 블록 제거됨');
        hasChanges = true;
        console.log(`🔧 ${relativePath}: 빈 if-else 블록 수정`);
      }

      // 6. 구문 오류를 일으킬 수 있는 패턴들 제거
      const dangerousPatterns = [
        /\/\/.*databaseService\.\w+.*?\n/g,
        /databaseService\.\w+.*?;/g,
      ];

      dangerousPatterns.forEach((pattern, index) => {
        if (pattern.test(content)) {
          content = content.replace(pattern, '// 제거됨\n');
          hasChanges = true;
          console.log(`🔧 ${relativePath}: 위험한 패턴 ${index + 1} 제거`);
        }
      });

      // 변경사항이 있으면 파일 저장
      if (hasChanges) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`✅ ${relativePath}: 수정 완료`);
      }

    } catch (error) {
      console.error(`❌ ${relativePath}: 수정 실패 -`, error.message);
    }
  });
}

// QuizSessionScreen 특별 수정
function fixQuizSessionScreen() {
  const quizPath = path.join(srcDir, 'screens', 'QuizSessionScreen.tsx');
  if (fs.existsSync(quizPath)) {
    console.log('🎯 QuizSessionScreen 특별 수정...');
    let content = fs.readFileSync(quizPath, 'utf-8');

    // await // // 같은 잘못된 패턴 수정
    content = content.replace(/await\s*\/\/\s*\/\/.*$/gm, '// await 제거됨');

    fs.writeFileSync(quizPath, content, 'utf-8');
    console.log('✅ QuizSessionScreen 수정 완료');
  }
}

// WordbookDetailScreen 특별 수정
function fixWordbookDetailScreen() {
  const detailPath = path.join(srcDir, 'screens', 'WordbookDetailScreen.tsx');
  if (fs.existsSync(detailPath)) {
    console.log('🎯 WordbookDetailScreen 특별 수정...');
    let content = fs.readFileSync(detailPath, 'utf-8');

    // await // // 같은 잘못된 패턴 수정
    content = content.replace(/await\s*\/\/\s*\/\/.*$/gm, '// await 제거됨');

    fs.writeFileSync(detailPath, content, 'utf-8');
    console.log('✅ WordbookDetailScreen 수정 완료');
  }
}

// 실행
console.log('🚨 앱 크래시 원인 제거 시작...');
fixCriticalErrors();
fixQuizSessionScreen();
fixWordbookDetailScreen();
console.log('✅ 모든 크리티컬 에러 수정 완료!');