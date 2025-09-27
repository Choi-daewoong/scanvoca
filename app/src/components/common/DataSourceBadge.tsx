import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../styles/ThemeProvider';

interface DataSourceBadgeProps {
  source: 'cache' | 'gpt' | 'none';
  size?: 'small' | 'medium';
  style?: any;
}

export default function DataSourceBadge({
  source,
  size = 'small',
  style
}: DataSourceBadgeProps) {
  const theme = useTheme();

  const getBadgeConfig = () => {
    switch (source) {
      case 'cache':
        return {
          icon: '💾',
          text: 'Cache',
          color: theme.colors.success,
          backgroundColor: `${theme.colors.success}15`,
          description: 'Cached'
        };
      case 'gpt':
        return {
          icon: '🤖',
          text: 'GPT',
          color: theme.colors.primary,
          backgroundColor: `${theme.colors.primary}15`,
          description: 'AI Generated'
        };
      case 'none':
      default:
        return {
          icon: '❌',
          text: 'N/A',
          color: theme.colors.textSecondary,
          backgroundColor: `${theme.colors.textSecondary}10`,
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
  style?: any;
}) {
  const theme = useTheme();

  const getBadgeConfig = () => {
    switch (source) {
      case 'cache':
        return {
          icon: '⚡',
          text: 'Instant',
          longText: 'Cached (Free)',
          color: theme.colors.success,
          description: '캐시에서 즉시 로드됨 (비용 0원)'
        };
      case 'gpt':
        return {
          icon: '🧠',
          text: 'AI',
          longText: 'AI Generated',
          color: theme.colors.primary,
          description: 'GPT API로 생성됨 (고품질 번역)'
        };
      case 'none':
      default:
        return {
          icon: '⚪',
          text: 'N/A',
          longText: 'Not Available',
          color: theme.colors.textSecondary,
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
        <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
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