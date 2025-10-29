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
      icon: '✂️',
      title: '자르기 (크롭)',
      description: '이미지 모서리를 드래그하여 원하는 영역만 선택하세요. 단어가 있는 부분만 남기면 인식률이 더 좋아집니다.',
    },
    {
      icon: '🔄',
      title: '회전',
      description: '사진이 기울어졌거나 거꾸로 되어있다면 회전 버튼을 눌러 바로잡으세요. 텍스트가 수평이어야 잘 인식됩니다.',
    },
    {
      icon: '🔍',
      title: '확대/축소',
      description: '핀치 제스처로 확대하여 정확한 영역을 선택하세요. 작은 글씨도 선명하게 잘라낼 수 있습니다.',
    },
    {
      icon: '↕️',
      title: '자유로운 크롭',
      description: '이제 가로/세로 비율에 제한이 없습니다! 위아래만 늘리거나 좌우만 늘려서 원하는 영역을 정확히 선택하세요.',
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
              <Text style={styles.tipTitle}>💡 편집 버튼이 안 보일 때</Text>
              <Text style={styles.tipText}>
                상단의 편집 버튼들이 <Text style={styles.highlightText}>어두워서 잘 안 보인다면</Text> 화면을 밝게 하거나,
                손가락으로 <Text style={styles.highlightText}>상단 영역을 살짝 터치</Text>해보세요.
                버튼 위치를 확인할 수 있습니다.
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