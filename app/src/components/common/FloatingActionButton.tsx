import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import theme from '../../styles/theme';
import Typography from './Typography';

export interface FloatingActionButtonProps {
  icon?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent';
  size?: 'md' | 'lg';
  disabled?: boolean;
  style?: ViewStyle;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  icon = '📷',
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  style,
}) => {
  const getButtonStyle = (): ViewStyle[] => {
    const baseStyle = [styles.fab, styles[size], styles[variant]];
    
    if (disabled) {
      baseStyle.push(styles.disabled);
    }
    
    if (style) {
      baseStyle.push(style);
    }
    
    return baseStyle;
  };

  const getIconSize = () => {
    return size === 'lg' ? 'h3' : 'h4';
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Typography 
        variant={getIconSize()} 
        color="inverse"
        style={styles.icon}
      >
        {icon}
      </Typography>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: {
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: theme.spacing.xl,
    right: theme.spacing.xl,
    ...theme.shadows.lg,
  },
  
  // Sizes
  md: {
    width: 48,
    height: 48,
  },
  
  lg: {
    width: theme.layout.fabSize,
    height: theme.layout.fabSize,
  },
  
  // Variants
  primary: {
    backgroundColor: theme.colors.primary.main,
  },
  
  secondary: {
    backgroundColor: theme.colors.secondary.main,
  },
  
  accent: {
    backgroundColor: theme.colors.accent.orange,
  },
  
  // States
  disabled: {
    backgroundColor: theme.colors.neutral.gray300,
    shadowOpacity: 0,
    elevation: 0,
  },
  
  icon: {
    textAlign: 'center',
  },
});

export default FloatingActionButton;