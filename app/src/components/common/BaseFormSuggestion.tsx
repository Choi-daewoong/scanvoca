import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Typography from './Typography';
import Card from './Card';
import theme from '../../styles/theme';

export interface BaseFormSuggestionProps {
  inflectedWord: string;
  baseForm: string;
  explanation: string;
  onAddBaseForm: () => void;
  onDismiss: () => void;
}

const BaseFormSuggestion: React.FC<BaseFormSuggestionProps> = ({
  inflectedWord,
  baseForm,
  explanation,
  onAddBaseForm,
  onDismiss,
}) => {
  return (
    <Card variant="elevated" padding="md" style={styles.container}>
      <View style={styles.header}>
        <Typography variant="caption" color="primary" style={styles.badge}>
          💡 학습 제안
        </Typography>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <Typography variant="caption" color="tertiary">✕</Typography>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Typography variant="body2" color="secondary">
          <Typography variant="body2" color="primary" style={styles.highlight}>
            "{inflectedWord}"
          </Typography>
          는 {explanation}입니다.
        </Typography>

        <Typography variant="body2" color="secondary" style={styles.suggestion}>
          원형 단어
          <Typography variant="body2" color="primary" style={styles.highlight}>
            "{baseForm}"
          </Typography>
          도 함께 학습하시겠습니까?
        </Typography>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.dismissBtn]}
          onPress={onDismiss}
        >
          <Typography variant="caption" color="tertiary">
            나중에
          </Typography>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.addBtn]}
          onPress={onAddBaseForm}
        >
          <Typography variant="caption" color="inverse">
            원형 추가
          </Typography>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background.primary,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary.main,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  badge: {
    backgroundColor: theme.colors.primary.light,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  dismissButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.neutral.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    marginBottom: theme.spacing.md,
  },
  suggestion: {
    marginTop: theme.spacing.sm,
  },
  highlight: {
    fontWeight: '600',
    color: theme.colors.primary.main,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  button: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  dismissBtn: {
    backgroundColor: theme.colors.neutral.gray200,
  },
  addBtn: {
    backgroundColor: theme.colors.primary.main,
  },
});

export default BaseFormSuggestion;