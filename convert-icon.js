const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

// SVG 파일 경로
const svgPath = path.join(__dirname, 'app', 'assets', 'icon.svg');
const iconPath = path.join(__dirname, 'app', 'assets', 'icon.png');
const adaptiveIconPath = path.join(__dirname, 'app', 'assets', 'adaptive-icon.png');
const splashPath = path.join(__dirname, 'app', 'assets', 'splash-icon.png');

console.log('📱 아이콘 변환 시작...');

// 온라인 도구 사용 안내
console.log('\n🔧 SVG 파일을 PNG로 변환하세요:');
console.log(`   SVG 위치: ${svgPath}`);
console.log('\n📌 변환 방법 (3가지 중 선택):');
console.log('\n1. 온라인 도구 사용 (추천):');
console.log('   - https://cloudconvert.com/svg-to-png');
console.log('   - 파일 업로드 → 1024x1024 크기 설정 → 변환');
console.log('   - 다운로드 후 다음 파일로 저장:');
console.log(`     • ${iconPath}`);
console.log(`     • ${adaptiveIconPath}`);
console.log(`     • ${splashPath}`);

console.log('\n2. 브라우저에서 변환:');
console.log(`   - ${svgPath} 파일을 크롬 브라우저로 열기`);
console.log('   - F12 개발자 도구 → 우클릭 → Capture node screenshot');
console.log('   - 또는 화면 캡처 후 1024x1024 크기로 저장');

console.log('\n3. Figma 사용:');
console.log('   - Figma에서 SVG 임포트');
console.log('   - Export as PNG (1024x1024)');
console.log('   - 위의 경로에 저장');

console.log('\n✅ 변환 완료 후 다음 명령어로 빌드하세요:');
console.log('   cd app && eas build --profile preview --platform android');
