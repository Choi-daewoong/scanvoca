import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import theme from '../../styles/theme';
import Typography from './Typography';
import Card from './Card';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  style?: ViewStyle;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color = 'primary',
  style,
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return '📈';
      case 'down':
        return '📉';
      default:
        return '➖';
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'success';
      case 'down':
        return 'error';
      default:
        return 'secondary';
    }
  };

  return (
    <Card variant="outlined" padding="md" style={style}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Typography variant="caption" color="secondary">
            {title}
          </Typography>
          {icon && (
            <Typography variant="body1">
              {icon}
            </Typography>
          )}
        </View>

        {/* Main Value */}
        <Typography 
          variant="h2" 
          color={color}
          style={styles.value}
        >
          {value}
        </Typography>

        {/* Subtitle and Trend */}
        <View style={styles.footer}>
          {subtitle && (
            <Typography variant="caption" color="tertiary">
              {subtitle}
            </Typography>
          )}
          
          {trend && trendValue && (
            <View style={styles.trend}>
              <Typography variant="caption" color={getTrendColor()}>
                {getTrendIcon()} {trendValue}
              </Typography>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 100,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  
  value: {
    marginBottom: theme.spacing.sm,
  },
  
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default StatCard;