import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import theme from '../../styles/theme';
import Typography from './Typography';
import Card from './Card';

export interface WordCardProps {
  word: string;
  pronunciation?: string;
  partOfSpeech?: string;
  definition: string;
  example?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  isLearned?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

const WordCard: React.FC<WordCardProps> = ({
  word,
  pronunciation,
  partOfSpeech,
  definition,
  example,
  difficulty = 'medium',
  isLearned = false,
  onPress,
  style,
}) => {
  const getDifficultyColor = () => {
    switch (difficulty) {
      case 'easy':
        return 'success';
      case 'hard':
        return 'error';
      default:
        return 'warning';
    }
  };

  const CardComponent = onPress ? TouchableOpacity : View;

  return (
    <CardComponent 
      style={style}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Card variant="outlined" padding="md">
        <View style={styles.header}>
          <View style={styles.wordInfo}>
            <Typography variant="h4" color="primary">
              {word}
            </Typography>
            {pronunciation && (
              <Typography variant="caption" color="secondary" style={styles.pronunciation}>
                [{pronunciation}]
              </Typography>
            )}
          </View>
          
          <View style={styles.badges}>
            {partOfSpeech && (
              <View style={styles.badge}>
                <Typography variant="caption" color="inverse">
                  {partOfSpeech}
                </Typography>
              </View>
            )}
            {isLearned && (
              <View style={[styles.badge, styles.learnedBadge]}>
                <Typography variant="caption" color="inverse">
                  ✓
                </Typography>
              </View>
            )}
          </View>
        </View>

        <Typography 
          variant="body2" 
          color="primary"
          style={styles.definition}
        >
          {definition}
        </Typography>

        {example && (
          <View style={styles.example}>
            <Typography variant="caption" color="tertiary">
              예문:
            </Typography>
            <Typography 
              variant="body2" 
              color="secondary"
              style={styles.exampleText}
            >
              {example}
            </Typography>
          </View>
        )}

        <View style={styles.footer}>
          <View style={[styles.difficultyDot, styles[`${difficulty}Dot`]]} />
          <Typography variant="caption" color={getDifficultyColor()}>
            {difficulty.toUpperCase()}
          </Typography>
        </View>
      </Card>
    </CardComponent>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  
  wordInfo: {
    flex: 1,
  },
  
  pronunciation: {
    marginTop: theme.spacing.xs,
  },
  
  badges: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  
  badge: {
    backgroundColor: theme.colors.neutral.gray600,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
  },
  
  learnedBadge: {
    backgroundColor: theme.colors.semantic.success,
  },
  
  definition: {
    marginBottom: theme.spacing.sm,
    lineHeight: 20,
  },
  
  example: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  
  exampleText: {
    marginTop: theme.spacing.xs,
    fontStyle: 'italic',
  },
  
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  
  difficultyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  
  easyDot: {
    backgroundColor: theme.colors.semantic.success,
  },
  
  mediumDot: {
    backgroundColor: theme.colors.semantic.warning,
  },
  
  hardDot: {
    backgroundColor: theme.colors.semantic.error,
  },
});

export default WordCard;