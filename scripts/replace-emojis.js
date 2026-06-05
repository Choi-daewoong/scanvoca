#!/usr/bin/env node
/**
 * 이모지 → Icon 컴포넌트 자동 교체 스크립트
 *
 * 실행: node scripts/replace-emojis.js
 */

const fs = require('fs');
const path = require('path');

// 이모지 → Icon 매핑
const emojiToIconMap = {
  // Navigation & Menu
  '🏠': 'home',
  '📷': 'camera',
  '📚': 'book-stack',
  '📖': 'book-open',
  '📊': 'chart-bar',
  '⚙️': 'settings',
  '📱': 'smartphone',
  '🧭': 'compass',
  '📋': 'clipboard',

  // Actions
  '💾': 'save',
  '🗑️': 'trash',
  '🔊': 'volume-high',
  '🔄': 'refresh',
  '✅': 'check-circle',
  '❌': 'x-circle',
  '🔍': 'search',
  '📸': 'camera-shutter',
  '🖼️': 'image-gallery',
  '📝': 'edit',
  '🚀': 'rocket',
  '🎯': 'target',
  '🔒': 'lock',
  '🔐': 'lock-closed',
  '↩️': 'arrow-back',

  // Learning
  '🧠': 'brain',
  '🎉': 'celebration',
  '👏': 'clap',
  '👍': 'thumbs-up',
  '😊': 'smile',
  '💪': 'muscle',
  '💡': 'lightbulb',
  '🎲': 'dice',
  '🔀': 'shuffle',
  '🧪': 'beaker',
  '⏱️': 'timer',

  // System
  '🤖': 'robot',
  '🗄️': 'database',
  '🏥': 'health',
  '🟢': 'circle-green',
  '🟡': 'circle-yellow',
  '🔴': 'circle-red',
  '🛑': 'octagon-stop',

  // Feedback
  '⏳': 'hourglass',
  '📧': 'mail',
  '📄': 'document',
  '🔧': 'wrench',
  '📅': 'calendar',
  '📈': 'trending-up',
  '📥': 'inbox',
  '👆': 'hand-point',

  // Misc
  '👤': 'user',
  '🎥': 'video',
  '⚖️': 'scale',
};

function replaceEmojisInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let needsIconImport = false;

  // Icon 컴포넌트 import 체크
  const hasIconImport = content.includes("import { Icon }") || content.includes("import Icon");

  // 각 이모지 교체
  for (const [emoji, iconName] of Object.entries(emojiToIconMap)) {
    // Text 컴포넌트 안의 이모지 찾기
    const patterns = [
      // <Text>🏠</Text> → <Icon name="home" size={24} />
      new RegExp(`<Text[^>]*>${emoji}</Text>`, 'g'),
      // <Text>{변수}</Text> 형태는 제외
    ];

    patterns.forEach(pattern => {
      if (pattern.test(content)) {
        // 스타일 정보 추출 (간단한 경우만)
        content = content.replace(pattern, (match) => {
          needsIconImport = true;
          modified = true;

          // 색상 추출 시도 (간단한 케이스만)
          const colorMatch = match.match(/color:\s*['"]([^'"]+)['"]/);
          const color = colorMatch ? colorMatch[1] : undefined;

          const iconTag = color
            ? `<Icon name="${iconName}" size={24} color="${color}" />`
            : `<Icon name="${iconName}" size={24} />`;

          return iconTag;
        });
      }
    });
  }

  // Icon import 추가 (필요하고 없는 경우만)
  if (needsIconImport && !hasIconImport && modified) {
    // import 구문 위치 찾기
    const importMatch = content.match(/^import.*from.*;$/m);
    if (importMatch) {
      const lastImport = importMatch[0];
      const importIndex = content.indexOf(lastImport) + lastImport.length;
      content = content.slice(0, importIndex) +
                "\nimport { Icon } from '../components/icons';" +
                content.slice(importIndex);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated: ${filePath}`);
    return true;
  }

  return false;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  let count = 0;

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      count += processDirectory(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      // Icon 컴포넌트 자체는 제외
      if (!fullPath.includes('components/icons/')) {
        if (replaceEmojisInFile(fullPath)) {
          count++;
        }
      }
    }
  });

  return count;
}

// 실행
const appSrcDir = path.join(__dirname, '..', 'app', 'src');
console.log('🔄 이모지 → Icon 컴포넌트 교체 시작...\n');
const totalFiles = processDirectory(appSrcDir);
console.log(`\n🎉 완료! ${totalFiles}개 파일 업데이트됨`);
