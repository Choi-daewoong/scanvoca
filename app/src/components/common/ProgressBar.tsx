import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import theme from '../../styles/theme';
import Typography from './Typography';

export interface ProgressBarProps {
  progress: number; // 0-100
  showPercentage?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  height?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  style?: ViewStyle;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showPercentage = false,
  color = 'primary',
  height = 'md',
  animated = true,
  style,
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  const getBarStyle = (): StyleProp<ViewStyle> => {
    const baseStyle: any[] = [styles.progressBar, styles[height]];

    if (style) {
      baseStyle.push(style);
    }

    return baseStyle;
  };

  const getFillStyle = (): ViewStyle => {
    return {
      ...styles.progressFill,
      ...styles[`${color}Fill`],
      width: `${clampedProgress}%`,
    };
  };

  return (
    <View>
      <View style={getBarStyle()}>
        <View style={getFillStyle()} />
      </View>
      {showPercentage && (
        <Typography 
          variant="caption" 
          color="secondary" 
          align="right"
          style={{ marginTop: theme.spacing.xs }}
        >
          {Math.round(clampedProgress)}%
        </Typography>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  progressBar: {
    backgroundColor: theme.colors.neutral.gray200,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
  
  // Heights
  sm: {
    height: 4,
  },
  md: {
    height: 8,
  },
  lg: {
    height: 12,
  },
  
  // Colors
  primaryFill: {
    backgroundColor: theme.colors.primary.main,
  },
  secondaryFill: {
    backgroundColor: theme.colors.secondary.main,
  },
  successFill: {
    backgroundColor: theme.colors.semantic.success,
  },
  warningFill: {
    backgroundColor: theme.colors.semantic.warning,
  },
  errorFill: {
    backgroundColor: theme.colors.semantic.error,
  },
});

export default ProgressBar;