import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../styles/ThemeProvider';

export interface FilterTab {
  key: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface FilterTabsProps {
  tabs: FilterTab[];
  activeTab: string;
  onTabPress: (tabKey: string) => void;
  style?: any;
  scrollable?: boolean;
}

export default function FilterTabs({
  tabs,
  activeTab,
  onTabPress,
  style,
  scrollable = false,
}: FilterTabsProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.xs,
    },
    scrollContainer: {
      flexGrow: 1,
    },
    tabsContainer: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    tab: {
      flex: scrollable ? undefined : 1,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: scrollable ? 80 : undefined,
    },
    activeTab: {
      backgroundColor: theme.colors.primary.main,
      ...theme.shadows.sm,
    },
    inactiveTab: {
      backgroundColor: 'transparent',
    },
    disabledTab: {
      backgroundColor: 'transparent',
      opacity: 0.5,
    },
    tabText: {
      ...theme.typography.body2,
      fontWeight: '600',
      textAlign: 'center',
    },
    activeTabText: {
      color: theme.colors.primary.contrast,
    },
    inactiveTabText: {
      color: theme.colors.text.secondary,
    },
    disabledTabText: {
      color: theme.colors.text.tertiary,
    },
    countText: {
      ...theme.typography.caption,
      marginTop: 2,
      opacity: 0.8,
    },
  });

  const renderTab = (tab: FilterTab) => {
    const isActive = tab.key === activeTab;
    const isDisabled = tab.disabled;

    const tabStyle = [
      styles.tab,
      isActive ? styles.activeTab : styles.inactiveTab,
      isDisabled && styles.disabledTab,
    ];

    const textStyle = [
      styles.tabText,
      isActive ? styles.activeTabText : styles.inactiveTabText,
      isDisabled && styles.disabledTabText,
    ];

    return (
      <TouchableOpacity
        key={tab.key}
        style={tabStyle}
        onPress={() => !isDisabled && onTabPress(tab.key)}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        <Text style={textStyle}>{tab.label}</Text>
        {tab.count !== undefined && (
          <Text style={[styles.countText, textStyle]}>{tab.count}</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (scrollable) {
    return (
      <View style={[styles.container, style]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
        >
          <View style={styles.tabsContainer}>{tabs.map(renderTab)}</View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.tabsContainer}>{tabs.map(renderTab)}</View>
    </View>
  );
}