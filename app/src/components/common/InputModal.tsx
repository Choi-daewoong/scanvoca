import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../styles/ThemeProvider';

interface InputModalProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  onConfirm: (value: string) => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function InputModal({
  visible,
  title,
  message,
  placeholder,
  defaultValue = '',
  keyboardType = 'default',
  onConfirm,
  onCancel,
  confirmText = '확인',
  cancelText = '취소',
}: InputModalProps) {
  const { theme } = useTheme();
  const [inputValue, setInputValue] = useState(defaultValue);

  const handleConfirm = () => {
    onConfirm(inputValue);
    setInputValue('');
  };

  const handleCancel = () => {
    onCancel();
    setInputValue(defaultValue);
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    modal: {
      backgroundColor: theme.colors.background.primary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      width: '100%',
      maxWidth: 300,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 10,
    },
    title: {
      ...theme.typography.h4,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    message: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.lg,
      textAlign: 'center',
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border.medium,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      fontSize: 16,
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.background.secondary,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    button: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: theme.colors.background.secondary,
      marginRight: theme.spacing.sm,
    },
    confirmButton: {
      backgroundColor: theme.colors.primary.main,
      marginLeft: theme.spacing.sm,
    },
    cancelButtonText: {
      ...theme.typography.body1,
      color: theme.colors.text.secondary,
      fontWeight: '600',
    },
    confirmButtonText: {
      ...theme.typography.body1,
      color: theme.colors.primary.contrast,
      fontWeight: '600',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleCancel}
          activeOpacity={1}
        />
        <View style={styles.modal}>
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}

          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.text.tertiary}
            value={inputValue}
            onChangeText={setInputValue}
            keyboardType={keyboardType}
            autoFocus
            selectTextOnFocus
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmButtonText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}