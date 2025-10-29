import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import theme from '../../styles/theme';
import { SmartWordDefinition } from '../../types/types';
import DataSourceBadge from './DataSourceBadge';
import LevelTag from './LevelTag';

interface SmartWordCardProps {
  word: SmartWordDefinition;
  onPress?: () => void;
  onPronounce?: () => void;
  showSource?: boolean;
  style?: ViewStyle;
}

export default function SmartWordCard({
  word,
  onPress,
  onPronounce,
  showSource = true,
  style
}: SmartWordCardProps) {

  const primaryMeaning = word.meanings[0];
  const exampleSentence = primaryMeaning?.examples?.[0];

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background.primary,
          borderColor: theme.colors.border.light,
          shadowColor: theme.colors.text.primary,
        },
        style
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header Row */}
      <View style={styles.header}>
        <View style={styles.leftHeader}>
          <Text
            style={[
              styles.wordText,
              { color: theme.colors.text.primary }
            ]}
          >
            {word.word}
          </Text>
          {word.pronunciation && (
            <TouchableOpacity
              style={[
                styles.pronounceButton,
                { backgroundColor: `${theme.colors.primary.main}15` }
              ]}
              onPress={onPronounce}
            >
              <Text style={styles.pronounceIcon}>🔊</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.rightHeader}>
          {showSource && (
            <DataSourceBadge source={word.source} size="small" />
          )}
          <LevelTag level={word.difficulty} size="sm" style={{ marginLeft: 6 }} />
        </View>
      </View>

      {/* Pronunciation */}
      {word.pronunciation && (
        <Text
          style={[
            styles.pronunciation,
            { color: theme.colors.text.secondary }
          ]}
        >
          {word.pronunciation}
        </Text>
      )}

      {/* Meanings */}
      <View style={styles.meaningContainer}>
        <View style={styles.partOfSpeechRow}>
          <Text
            style={[
              styles.partOfSpeech,
              {
                color: theme.colors.text.secondary,
                backgroundColor: `${theme.colors.primary.main}15`,
              }
            ]}
          >
            {primaryMeaning?.partOfSpeech}
          </Text>
          <Text
            style={[
              styles.meaning,
              { color: theme.colors.text.primary }
            ]}
          >
            {primaryMeaning?.korean}
          </Text>
        </View>

        {primaryMeaning?.english && (
          <Text
            style={[
              styles.englishDefinition,
              { color: theme.colors.text.secondary }
            ]}
          >
            {primaryMeaning.english}
          </Text>
        )}
      </View>

      {/* Example Sentence */}
      {exampleSentence && (
        <View style={styles.exampleContainer}>
          <Text
            style={[
              styles.exampleLabel,
              { color: theme.colors.text.secondary }
            ]}
          >
            예문:
          </Text>
          <Text
            style={[
              styles.exampleEnglish,
              { color: theme.colors.text.primary }
            ]}
          >
            {exampleSentence.en}
          </Text>
          <Text
            style={[
              styles.exampleKorean,
              { color: theme.colors.text.secondary }
            ]}
          >
            {exampleSentence.ko}
          </Text>
        </View>
      )}

      {/* Data Source Indicator (detailed) */}
      {showSource && word.source !== 'none' && (
        <View style={styles.sourceInfo}>
          <View style={styles.sourceDetails}>
            {word.source === 'cache' && (
              <>
                <Text style={[styles.sourceText, { color: theme.colors.semantic.success }]}>
                  ⚡ 캐시에서 로드 (비용 0원)
                </Text>
                {word.access_count && word.access_count > 1 && (
                  <Text style={[styles.accessCount, { color: theme.colors.text.secondary }]}>
                    {word.access_count}번 조회됨
                  </Text>
                )}
              </>
            )}
            {word.source === 'gpt' && (
              <>
                <Text style={[styles.sourceText, { color: theme.colors.primary.main }]}>
                  🤖 AI 생성 (고품질 번역)
                </Text>
                {word.confidence && (
                  <Text style={[styles.confidenceText, { color: theme.colors.text.secondary }]}>
                    신뢰도: {Math.round(word.confidence * 100)}%
                  </Text>
                )}
              </>
            )}
          </View>

          {word.cached_at && (
            <Text style={[styles.timestamp, { color: theme.colors.text.secondary }]}>
              {new Date(word.cached_at).toLocaleDateString('ko-KR')}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  pronounceButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pronounceIcon: {
    fontSize: 14,
  },
  pronunciation: {
    fontSize: 14,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  meaningContainer: {
    marginBottom: 8,
  },
  partOfSpeechRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  partOfSpeech: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
    textTransform: 'uppercase',
  },
  meaning: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  englishDefinition: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  exampleContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  exampleEnglish: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  exampleKorean: {
    fontSize: 13,
  },
  sourceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  sourceDetails: {
    flex: 1,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '500',
  },
  accessCount: {
    fontSize: 10,
    marginTop: 2,
  },
  confidenceText: {
    fontSize: 10,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 10,
  },
});

export type { SmartWordCardProps };