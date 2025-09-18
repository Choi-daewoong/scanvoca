// Main Bottom Tab Navigator
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../styles/ThemeProvider';
import { MainTabParamList } from './types';
import TabIcon from './TabIcons';

// Screens
import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';
import WordbookScreen from '../screens/WordbookScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // Tab Bar Icon
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: 'home' | 'scan' | 'wordbook';

          switch (route.name) {
            case 'Home':
              iconName = 'home';
              break;
            case 'Scan':
              iconName = 'scan';
              break;
            case 'Wordbook':
              iconName = 'wordbook';
              break;
            default:
              iconName = 'home';
          }

          return <TabIcon name={iconName} focused={focused} color={color} size={size} />;
        },

        // Tab Bar Style
        tabBarActiveTintColor: theme.colors.primary.main,
        tabBarInactiveTintColor: theme.colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.background.primary,
          borderTopColor: theme.colors.border.light,
          borderTopWidth: 1,
          height: theme.layout.tabBarHeight,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.caption.fontSize,
          fontWeight: '600',
          marginTop: 2,
        },

        // Header Style
        headerStyle: {
          backgroundColor: theme.colors.background.primary,
          borderBottomColor: theme.colors.border.light,
          borderBottomWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: theme.colors.text.primary,
        headerTitleStyle: {
          fontSize: theme.typography.h4.fontSize,
          fontWeight: theme.typography.h4.fontWeight,
          color: theme.colors.text.primary,
        },
        headerTitleAlign: 'center',
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: '홈',
          headerTitle: 'Scan_Voca',
          headerTitleStyle: {
            color: theme.colors.primary.main,
            fontSize: 20,
            fontWeight: 'bold',
          },
        }}
      />

      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          tabBarLabel: '스캔',
          headerTitle: '단어 스캔',
        }}
      />

      <Tab.Screen
        name="Wordbook"
        component={WordbookScreen}
        options={{
          tabBarLabel: '단어장',
          headerTitle: '내 단어장',
        }}
      />
    </Tab.Navigator>
  );
}