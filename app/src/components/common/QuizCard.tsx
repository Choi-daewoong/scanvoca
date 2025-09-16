import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import theme from '../../styles/theme';
import Typography from './Typography';
import Card from './Card';
import Button from './Button';

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizCardProps {
  question: string;
  options: QuizOption[];
  selectedOptionId?: string;
  showResult?: boolean;
  questionNumber: number;
  totalQuestions: number;
  onSelectOption?: (optionId: string) => void;
  style?: ViewStyle;
}

const QuizCard: React.FC<QuizCardProps> = ({
  question,
  options,
  selectedOptionId,
  showResult = false,
  questionNumber,
  totalQuestions,
  onSelectOption,
  style,
}) => {
  const getOptionStyle = (option: QuizOption) => {
    const baseStyle = [styles.option];
    
    if (!showResult && selectedOptionId === option.id) {
      baseStyle.push(styles.selectedOption);
    }
    
    if (showResult) {
      if (option.isCorrect) {
        baseStyle.push(styles.correctOption);
      } else if (selectedOptionId === option.id && !option.isCorrect) {
        baseStyle.push(styles.incorrectOption);
      }
    }
    
    return baseStyle;
  };

  const getOptionTextColor = (option: QuizOption) => {
    if (showResult && option.isCorrect) return 'inverse';
    if (showResult && selectedOptionId === option.id && !option.isCorrect) return 'inverse';
    if (!showResult && selectedOptionId === option.id) return 'inverse';
    return 'primary';
  };

  return (
    <Card variant="elevated" padding="lg" style={style}>
      {/* Question Header */}
      <View style={styles.header}>
        <Typography variant="caption" color="secondary">
          질문 {questionNumber} / {totalQuestions}
        </Typography>
      </View>

      {/* Question */}
      <Typography 
        variant="h4" 
        color="primary"
        style={styles.question}
      >
        {question}
      </Typography>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <Button
            key={option.id}
            title={option.text}
            variant="outline"
            fullWidth
            onPress={() => onSelectOption?.(option.id)}
            disabled={showResult}
            style={getOptionStyle(option)}
            textStyle={styles.optionText}
          />
        ))}
      </View>

      {/* Result Feedback */}
      {showResult && (
        <View style={styles.resultContainer}>
          {selectedOptionId && options.find(o => o.id === selectedOptionId)?.isCorrect ? (
            <View style={styles.correctFeedback}>
              <Typography variant="h4" color="success">
                ✓ 정답!
              </Typography>
              <Typography variant="body2" color="secondary" style={styles.feedbackText}>
                잘했어요!
              </Typography>
            </View>
          ) : (
            <View style={styles.incorrectFeedback}>
              <Typography variant="h4" color="error">
                ✗ 틀렸습니다
              </Typography>
              <Typography variant="body2" color="secondary" style={styles.feedbackText}>
                정답: {options.find(o => o.isCorrect)?.text}
              </Typography>
            </View>
          )}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: theme.spacing.md,
  },
  
  question: {
    marginBottom: theme.spacing.xl,
    lineHeight: 28,
    textAlign: 'center',
  },
  
  optionsContainer: {
    gap: theme.spacing.md,
  },
  
  option: {
    borderWidth: 2,
    borderColor: theme.colors.border.light,
  },
  
  selectedOption: {
    backgroundColor: theme.colors.primary.main,
    borderColor: theme.colors.primary.main,
  },
  
  correctOption: {
    backgroundColor: theme.colors.semantic.success,
    borderColor: theme.colors.semantic.success,
  },
  
  incorrectOption: {
    backgroundColor: theme.colors.semantic.error,
    borderColor: theme.colors.semantic.error,
  },
  
  optionText: {
    textAlign: 'left',
    paddingHorizontal: theme.spacing.md,
  },
  
  resultContainer: {
    marginTop: theme.spacing.xl,
    alignItems: 'center',
  },
  
  correctFeedback: {
    alignItems: 'center',
  },
  
  incorrectFeedback: {
    alignItems: 'center',
  },
  
  feedbackText: {
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
});

export default QuizCard;