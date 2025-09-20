// Main Bottom Tab Navigator
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../styles/ThemeProvider';
import { MainTabParamList } from './types';
import TabIcon from './TabIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';
import WordbookScreen from '../screens/WordbookScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

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
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2,
        },

        // Header Style
        headerStyle: {
          backgroundColor: '#FFFFFF',
          borderBottomColor: '#E5E7EB',
          borderBottomWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: '#111827',
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: 'bold',
          color: '#111827',
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
            color: '#4F46E5',
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