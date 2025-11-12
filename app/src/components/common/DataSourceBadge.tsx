import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import theme from '../../styles/theme';

interface DataSourceBadgeProps {
  source: 'cache' | 'gpt' | 'none' | 'complete-wordbook';
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

export default function DataSourceBadge({
  source,
  size = 'small',
  style
}: DataSourceBadgeProps) {

  const getBadgeConfig = () => {
    switch (source) {
      case 'complete-wordbook':
        return {
          icon: '📚',
          text: 'Dictionary',
          color: theme.colors.semantic.info,
          backgroundColor: `${theme.colors.semantic.info}15`,
          description: 'Basic Dictionary'
        };
      case 'cache':
        return {
          icon: '💾',
          text: 'Cache',
          color: theme.colors.semantic.success,
          backgroundColor: `${theme.colors.semantic.success}15`,
          description: 'Cached'
        };
      case 'gpt':
        return {
          icon: '🤖',
          text: 'AI',
          color: theme.colors.primary.main,
          backgroundColor: `${theme.colors.primary.main}15`,
          description: 'AI Generated'
        };
      case 'none':
      default:
        return {
          icon: '❌',
          text: 'N/A',
          color: theme.colors.text.secondary,
          backgroundColor: `${theme.colors.text.secondary}10`,
          description: 'Not Found'
        };
    }
  };

  const config = getBadgeConfig();
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          paddingHorizontal: isSmall ? 4 : 6,
          paddingVertical: isSmall ? 2 : 3,
          borderRadius: isSmall ? 8 : 10,
        },
        style
      ]}
    >
      <Text
        style={[
          styles.icon,
          {
            fontSize: isSmall ? 8 : 10,
            marginRight: isSmall ? 2 : 3,
          }
        ]}
      >
        {config.icon}
      </Text>
      <Text
        style={[
          styles.text,
          {
            color: config.color,
            fontSize: isSmall ? 9 : 11,
            fontWeight: isSmall ? '500' : '600',
          }
        ]}
      >
        {config.text}
      </Text>
    </View>
  );
}

export function DataSourceIndicator({
  source,
  showDescription = false,
  style
}: {
  source: 'cache' | 'gpt' | 'none';
  showDescription?: boolean;
  style?: ViewStyle;
}) {

  const getBadgeConfig = () => {
    switch (source) {
      case 'cache':
        return {
          icon: '⚡',
          text: 'Instant',
          longText: 'Cached (Free)',
          color: theme.colors.semantic.success,
          description: '캐시에서 즉시 로드됨 (비용 0원)'
        };
      case 'gpt':
        return {
          icon: '🧠',
          text: 'AI',
          longText: 'AI Generated',
          color: theme.colors.primary.main,
          description: 'GPT API로 생성됨 (고품질 번역)'
        };
      case 'none':
      default:
        return {
          icon: '⚪',
          text: 'N/A',
          longText: 'Not Available',
          color: theme.colors.text.secondary,
          description: '번역을 찾을 수 없음'
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <View style={[styles.indicatorContainer, style]}>
      <View
        style={[
          styles.indicator,
          {
            backgroundColor: `${config.color}20`,
            borderColor: `${config.color}40`,
          }
        ]}
      >
        <Text style={[styles.indicatorIcon, { color: config.color }]}>
          {config.icon}
        </Text>
        <Text style={[styles.indicatorText, { color: config.color }]}>
          {config.text}
        </Text>
      </View>
      {showDescription && (
        <Text style={[styles.description, { color: theme.colors.text.secondary }]}>
          {config.description}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  icon: {
    lineHeight: 12,
  },
  text: {
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  indicatorContainer: {
    alignItems: 'center',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  indicatorIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  indicatorText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
});