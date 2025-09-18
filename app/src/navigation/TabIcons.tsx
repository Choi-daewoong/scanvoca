// Tab Icons for Bottom Navigation
import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface TabIconProps {
  name: 'home' | 'scan' | 'wordbook';
  focused: boolean;
  color: string;
  size?: number;
}

export default function TabIcon({ name, focused, color, size = 24 }: TabIconProps) {
  const getIconEmoji = (iconName: string): string => {
    switch (iconName) {
      case 'home':
        return '🏠';
      case 'scan':
        return '📷';
      case 'wordbook':
        return '📚';
      default:
        return '❓';
    }
  };

  const styles = StyleSheet.create({
    icon: {
      fontSize: size,
      opacity: focused ? 1 : 0.6,
    },
  });

  return (
    <Text style={styles.icon}>
      {getIconEmoji(name)}
    </Text>
  );
}

// Alternative using Text-based icons (if emoji doesn't work well)
export function TextTabIcon({ name, focused, color, size = 16 }: TabIconProps) {
  const getIconText = (iconName: string): string => {
    switch (iconName) {
      case 'home':
        return '●';  // or 'HOME'
      case 'scan':
        return '◉';  // or 'SCAN'
      case 'wordbook':
        return '◈';  // or 'BOOK'
      default:
        return '?';
    }
  };

  const styles = StyleSheet.create({
    textIcon: {
      fontSize: size,
      color: color,
      fontWeight: focused ? 'bold' : 'normal',
      opacity: focused ? 1 : 0.6,
    },
  });

  return (
    <Text style={styles.textIcon}>
      {getIconText(name)}
    </Text>
  );
}