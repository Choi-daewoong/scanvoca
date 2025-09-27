/**
 * 남아있는 databaseService 참조들을 모두 제거하고 적절한 대체로 수정
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'app', 'src');

// databaseService 참조가 있는 파일들을 찾아서 수정
function fixDatabaseReferences() {
  const filesToFix = [
    'screens/StudyStatsScreen.tsx',
    'screens/WordDetailScreen.tsx',
    'screens/WordbookDetailScreen.tsx',
    'screens/SettingsScreen.tsx',
    'screens/QuizSessionScreen.tsx',
    'utils/testSmartDictionary.ts',
    'screens/DatabaseTestScreen.tsx'
  ];

  filesToFix.forEach(relativePath => {
    const fullPath = path.join(srcDir, relativePath);

    if (fs.existsSync(fullPath)) {
      console.log(`📝 수정 중: ${relativePath}`);

      let content = fs.readFileSync(fullPath, 'utf-8');

      // databaseService import 제거
      content = content.replace(
        /import.*databaseService.*from.*['"].*database.*['"];?\s*/g,
        '// databaseService import 제거됨\n'
      );

      // databaseService 사용 코드들을 주석 처리
      content = content.replace(
        /\s*await\s+databaseService\..*?;/g,
        '\n    // databaseService 사용 코드 제거됨 - AsyncStorage 사용 필요시 재구현'
      );

      content = content.replace(
        /\s*databaseService\..*?;/g,
        '\n    // databaseService 사용 코드 제거됨 - AsyncStorage 사용 필요시 재구현'
      );

      // 일반적인 databaseService 참조들 주석 처리
      content = content.replace(
        /databaseService\./g,
        '// databaseService.'
      );

      fs.writeFileSync(fullPath, content, 'utf-8');
      console.log(`✅ 수정 완료: ${relativePath}`);
    } else {
      console.log(`⚠️ 파일 없음: ${relativePath}`);
    }
  });
}

// 실행
console.log('🔧 databaseService 참조 제거 시작...');
fixDatabaseReferences();
console.log('✅ 모든 파일 수정 완료!');