import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WordbookDetailScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { useWordbookDetail } from '../hooks/useWordbookDetail';
import WordbookHeader from '../components/wordbook/WordbookHeader';
import StudyModeView from '../components/wordbook/StudyModeView';
import ExamModeView from '../components/wordbook/ExamModeView';
import AddWordModal from '../components/wordbook/AddWordModal';

export default function WordbookDetailScreen({ navigation, route }: WordbookDetailScreenProps) {
  const { theme } = useTheme();
  const { wordbookId, wordbookName = '단어장' } = route.params;

  // 모달 상태
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);

  // 커스텀 Hook에서 모든 상태와 로직 가져오기
  const {
    vocabulary,
    currentMode,
    currentDisplayFilter,
    currentLevelFilters,
    selectedWords,
    isShuffled,
    flippedCards,
    examStage,
    selectedQuestionCount,
    customQuestionCount,
    examQuestions,
    currentQuestionIndex,
    examAnswers,
    spellingInput,
    meaningInput,
    isEditingTitle,
    editedTitle,
    totalWords,
    memorizedWords,
    setCurrentMode,
    setCurrentDisplayFilter,
    setCurrentLevelFilters,
    setIsEditingTitle,
    setEditedTitle,
    setSelectedQuestionCount,
    setCustomQuestionCount,
    setSpellingInput,
    setMeaningInput,
    getFilteredWords,
    toggleMemorized,
    toggleWordSelection,
    toggleSelectAll,
    flipCard,
    shuffleWords,
    deleteSelectedWords,
    startExam,
    nextQuestion,
    previousQuestion,
    retryExam,
    finishEditingTitle,
    getLevelColor,
    playPronunciation,
    calculateExamScore,
    reloadWords,
  } = useWordbookDetail(wordbookId, wordbookName);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <WordbookHeader
        wordbookId={wordbookId}
        editedTitle={editedTitle}
        isEditingTitle={isEditingTitle}
        totalWords={totalWords}
        currentMode={currentMode}
        onBack={() => navigation.goBack()}
        onTitleChange={setEditedTitle}
        onStartEdit={() => setIsEditingTitle(true)}
        onFinishEdit={finishEditingTitle}
        onModeChange={setCurrentMode}
        onAddWord={() => setIsAddModalVisible(true)}
      />

      {currentMode === 'study' && (
        <StudyModeView
          words={getFilteredWords()}
          currentDisplayFilter={currentDisplayFilter}
          currentLevelFilters={currentLevelFilters}
          selectedWords={selectedWords}
          flippedCards={flippedCards}
          onFilterChange={setCurrentDisplayFilter}
          onLevelFilterChange={setCurrentLevelFilters}
          onShuffle={shuffleWords}
          onToggleSelectAll={toggleSelectAll}
          onDeleteSelected={deleteSelectedWords}
          onToggleWordSelection={toggleWordSelection}
          onToggleMemorized={toggleMemorized}
          onFlipCard={flipCard}
          onPlayPronunciation={playPronunciation}
          getLevelColor={getLevelColor}
          onAddWord={() => setIsAddModalVisible(true)}
          onWordPress={(word) =>
            navigation.navigate('WordDetail', {
              wordbookId: wordbookId,
              wordId: word.id,
              word: word.english,
            })
          }
        />
      )}

      {currentMode === 'exam' && (
        <ExamModeView
          examStage={examStage}
          selectedQuestionCount={selectedQuestionCount}
          customQuestionCount={customQuestionCount}
          examQuestions={examQuestions}
          currentQuestionIndex={currentQuestionIndex}
          examAnswers={examAnswers}
          spellingInput={spellingInput}
          meaningInput={meaningInput}
          memorizedWords={memorizedWords}
          totalWords={totalWords}
          onQuestionCountChange={setSelectedQuestionCount}
          onCustomCountChange={(text) => {
            setCustomQuestionCount(text);
            const num = parseInt(text);
            if (!isNaN(num) && num > 0) {
              setSelectedQuestionCount(num);
            }
          }}
          onStartExam={startExam}
          onNextQuestion={nextQuestion}
          onPreviousQuestion={previousQuestion}
          onRetryExam={retryExam}
          onSpellingChange={setSpellingInput}
          onMeaningChange={setMeaningInput}
          onToggleMemorized={toggleMemorized}
          onPlayPronunciation={playPronunciation}
          calculateExamScore={calculateExamScore}
        />
      )}

      {/* 단어 추가 모달 */}
      <AddWordModal
        visible={isAddModalVisible}
        wordbookId={wordbookId}
        onClose={() => setIsAddModalVisible(false)}
        onWordsAdded={reloadWords}
      />
    </SafeAreaView>
  );
}