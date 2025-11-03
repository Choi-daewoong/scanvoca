import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../styles/ThemeProvider';

export interface LevelTagProps {
  level: 1 | 2 | 3 | 4 | 5;
  showStars?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: any;
}

export default function LevelTag({
  level,
  showStars = true,
  showLabel = false,
  size = 'md',
  style,
}: LevelTagProps) {
  const { theme } = useTheme();

  const levelConfig = theme.word.level[level];

  const sizeConfig = {
    sm: {
      padding: theme.spacing.xs,
      fontSize: 10,
      starSize: 8,
    },
    md: {
      padding: theme.spacing.sm,
      fontSize: 12,
      starSize: 10,
    },
    lg: {
      padding: theme.spacing.md,
      fontSize: 14,
      starSize: 12,
    },
  };

  const config = sizeConfig[size];

  const styles = StyleSheet.create({
    container: {
      backgroundColor: levelConfig.backgroundColor,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: config.padding,
      paddingVertical: config.padding * 0.5,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
    },
    starsContainer: {
      flexDirection: 'row',
      marginRight: showLabel ? theme.spacing.xs : 0,
    },
    star: {
      fontSize: config.starSize,
      color: levelConfig.color,
      marginRight: 1,
    },
    label: {
      fontSize: config.fontSize,
      fontWeight: '600',
      color: levelConfig.color,
    },
  });

  const renderStars = () => {
    const stars = [];
    for (let i = 0; i < levelConfig.stars; i++) {
      stars.push(
        <Text key={i} style={styles.star}>
          ★
        </Text>
      );
    }
    return stars;
  };

  return (
    <View style={[styles.container, style]}>
      {showStars && <View style={styles.starsContainer}>{renderStars()}</View>}
      {showLabel && <Text style={styles.label}>{levelConfig.label}</Text>}
    </View>
  );
}