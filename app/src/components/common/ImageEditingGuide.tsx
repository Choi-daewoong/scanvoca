import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useTheme } from '../../styles/ThemeProvider';

interface ImageEditingGuideProps {
  visible: boolean;
  onClose: () => void;
}

export default function ImageEditingGuide({ visible, onClose }: ImageEditingGuideProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    modalContainer: {
      backgroundColor: theme.colors.background.primary,
      borderRadius: 20,
      padding: theme.spacing.lg,
      width: '100%',
      maxHeight: '80%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 12,
    },
    header: {
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
      paddingBottom: theme.spacing.md,
    },
    title: {
      ...theme.typography.h2,
      color: theme.colors.text.primary,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      textAlign: 'center',
    },
    content: {
      flex: 1,
    },
    guideItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.background.secondary,
      padding: theme.spacing.md,
      borderRadius: 12,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary.main,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary.main,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.md,
    },
    iconText: {
      fontSize: 18,
      color: 'white',
    },
    textContainer: {
      flex: 1,
    },
    itemTitle: {
      ...theme.typography.h4,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs,
    },
    itemDescription: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      lineHeight: 20,
    },
    highlightText: {
      color: theme.colors.primary.main,
      fontWeight: '600',
    },
    tipBox: {
      backgroundColor: theme.colors.neutral.gray100,
      padding: theme.spacing.md,
      borderRadius: 12,
      marginTop: theme.spacing.md,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.accent.orange,
    },
    tipTitle: {
      ...theme.typography.h4,
      color: theme.colors.accent.orange,
      marginBottom: theme.spacing.xs,
    },
    tipText: {
      ...theme.typography.body2,
      color: theme.colors.text.primary,
      lineHeight: 20,
    },
    closeButton: {
      backgroundColor: theme.colors.primary.main,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      borderRadius: 12,
      marginTop: theme.spacing.lg,
      alignItems: 'center',
      shadowColor: theme.colors.primary.main,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    closeButtonText: {
      ...theme.typography.button,
      color: theme.colors.primary.contrast,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  const guideItems = [
    {
      icon: '⬅️',
      title: '상단 왼쪽: 뒤로가기',
      description: '화면 왼쪽 위 모서리에 있습니다. 사진을 다시 찍으려면 이 버튼을 누르세요.',
    },
    {
      icon: '🔄',
      title: '상단 오른쪽: 회전',
      description: '화면 오른쪽 위에 있습니다. 사진이 기울어졌다면 이 버튼으로 90도씩 회전하세요.',
    },
    {
      icon: '⚖️',
      title: '상단 오른쪽: 대칭 (좌우반전)',
      description: '회전 버튼 옆에 있습니다. 좌우가 바뀌었다면 이 버튼으로 반전하세요.',
    },
    {
      icon: '✂️',
      title: '자르기 버튼',
      description: '화면 상단 우측에 "자르기" 텍스트가 있습니다. 편집이 완료되면 이 버튼을 눌러 확정하세요.',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>📸 이미지 편집 가이드</Text>
            <Text style={styles.subtitle}>
              편집 버튼이 잘 안 보인다면 이 가이드를 참고하세요
            </Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {guideItems.map((item, index) => (
              <View key={index} style={styles.guideItem}>
                <View style={styles.iconContainer}>
                  <Text style={styles.iconText}>{item.icon}</Text>
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemDescription}>{item.description}</Text>
                </View>
              </View>
            ))}

            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>⚠️ 중요: 버튼이 어두워서 잘 안 보여요!</Text>
              <Text style={styles.tipText}>
                편집 화면의 <Text style={styles.highlightText}>상단 버튼들이 검은색 반투명 배경</Text>이라 잘 안 보일 수 있습니다.{'\n\n'}
                <Text style={styles.highlightText}>• 왼쪽 위 모서리</Text>: ← 뒤로가기{'\n'}
                <Text style={styles.highlightText}>• 오른쪽 위</Text>: 🔄 회전, ⚖️ 대칭, "자르기" 버튼{'\n\n'}
                버튼 위치를 기억하고 <Text style={styles.highlightText}>손가락으로 상단을 터치</Text>해보세요!
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeButtonText}>이해했어요! 👍</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}