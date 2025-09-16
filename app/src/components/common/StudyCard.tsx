import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, ViewStyle } from 'react-native';
import theme from '../../styles/theme';
import Typography from './Typography';
import Card from './Card';
import Button from './Button';

export interface StudyCardProps {
  word: string;
  pronunciation?: string;
  definition: string;
  example?: string;
  isFlipped?: boolean;
  showAnswer?: boolean;
  onFlip?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  style?: ViewStyle;
}

const StudyCard: React.FC<StudyCardProps> = ({
  word,
  pronunciation,
  definition,
  example,
  isFlipped = false,
  showAnswer = false,
  onFlip,
  onNext,
  onPrevious,
  style,
}) => {
  const [flipAnimation] = useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(flipAnimation, {
      toValue: isFlipped ? 1 : 0,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [isFlipped, flipAnimation]);

  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.cardContainer}>
        {/* Front of card (Word) */}
        <Animated.View style={[styles.card, frontAnimatedStyle]}>
          <TouchableOpacity onPress={onFlip} activeOpacity={0.8}>
            <Card variant="elevated" padding="lg">
              <View style={styles.cardContent}>
                <Typography variant="h2" align="center" color="primary">
                  {word}
                </Typography>
                {pronunciation && (
                  <Typography 
                    variant="body1" 
                    align="center" 
                    color="secondary"
                    style={styles.pronunciation}
                  >
                    [{pronunciation}]
                  </Typography>
                )}
                <View style={styles.hint}>
                  <Typography variant="caption" color="tertiary" align="center">
                    탭하여 뜻 보기
                  </Typography>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        </Animated.View>

        {/* Back of card (Definition) */}
        <Animated.View style={[styles.card, styles.cardBack, backAnimatedStyle]}>
          <TouchableOpacity onPress={onFlip} activeOpacity={0.8}>
            <Card variant="elevated" padding="lg">
              <View style={styles.cardContent}>
                <Typography variant="h4" align="center" color="primary">
                  {word}
                </Typography>
                {pronunciation && (
                  <Typography 
                    variant="caption" 
                    align="center" 
                    color="secondary"
                    style={styles.smallPronunciation}
                  >
                    [{pronunciation}]
                  </Typography>
                )}
                
                <View style={styles.divider} />
                
                <Typography 
                  variant="body1" 
                  align="center" 
                  color="primary"
                  style={styles.definition}
                >
                  {definition}
                </Typography>

                {example && (
                  <View style={styles.example}>
                    <Typography variant="caption" color="tertiary" align="center">
                      예문
                    </Typography>
                    <Typography 
                      variant="body2" 
                      align="center" 
                      color="secondary"
                      style={styles.exampleText}
                    >
                      {example}
                    </Typography>
                  </View>
                )}

                <View style={styles.hint}>
                  <Typography variant="caption" color="tertiary" align="center">
                    탭하여 단어 보기
                  </Typography>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Navigation Controls */}
      <View style={styles.controls}>
        {onPrevious && (
          <Button
            title="이전"
            variant="outline"
            size="sm"
            onPress={onPrevious}
            style={styles.controlButton}
          />
        )}
        
        <View style={styles.centerControls}>
          {onFlip && (
            <Button
              title={isFlipped ? "단어 보기" : "뜻 보기"}
              variant="secondary"
              size="md"
              onPress={onFlip}
            />
          )}
        </View>
        
        {onNext && (
          <Button
            title="다음"
            variant="primary"
            size="sm"
            onPress={onNext}
            style={styles.controlButton}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  
  card: {
    width: '100%',
    minHeight: 300,
    position: 'absolute',
    backfaceVisibility: 'hidden',
  },
  
  cardBack: {
    top: 0,
  },
  
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 250,
  },
  
  pronunciation: {
    marginTop: theme.spacing.sm,
  },
  
  smallPronunciation: {
    marginTop: theme.spacing.xs,
  },
  
  divider: {
    height: 1,
    backgroundColor: theme.colors.border.light,
    marginVertical: theme.spacing.lg,
    marginHorizontal: theme.spacing.xl,
  },
  
  definition: {
    marginBottom: theme.spacing.lg,
    lineHeight: 28,
  },
  
  example: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  
  exampleText: {
    marginTop: theme.spacing.xs,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  
  hint: {
    position: 'absolute',
    bottom: theme.spacing.md,
    left: 0,
    right: 0,
  },
  
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  
  centerControls: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  
  controlButton: {
    minWidth: 80,
  },
});

export default StudyCard;