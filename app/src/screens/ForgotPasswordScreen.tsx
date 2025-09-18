import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Components
import { Button, Typography, Card } from '../components/common';
import { useTheme } from '../styles/ThemeProvider';
import { RootStackParamList } from '../navigation/types';

// Validation Schema
const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요')
    .email('올바른 이메일 형식이 아닙니다'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

type ForgotPasswordScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ForgotPassword'
>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<ForgotPasswordScreenNavigationProp>();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const email = watch('email');

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsLoading(true);
      console.log('📧 비밀번호 재설정 요청:', data.email);

      // TODO: 실제 API 호출로 대체
      // await authService.requestPasswordReset(data.email);

      // Mock API 호출 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 1500));

      setIsEmailSent(true);
      console.log('✅ 비밀번호 재설정 이메일 전송 완료');
    } catch (error) {
      console.error('❌ 비밀번호 재설정 요청 실패:', error);
      Alert.alert(
        '오류',
        '비밀번호 재설정 요청 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.',
        [{ text: '확인' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigation.navigate('Login');
  };

  const handleResendEmail = () => {
    setIsEmailSent(false);
  };

  if (isEmailSent) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Typography variant="h2" style={[styles.title, { color: theme.colors.text.primary }]}>
              이메일을 확인해주세요
            </Typography>
            <Typography
              variant="body1"
              style={[styles.subtitle, { color: theme.colors.text.secondary }]}
            >
              비밀번호 재설정 링크를 보내드렸습니다
            </Typography>
          </View>

          <Card style={styles.emailCard}>
            <View style={styles.emailInfo}>
              <Typography
                variant="body1"
                style={[styles.emailLabel, { color: theme.colors.text.secondary }]}
              >
                전송된 이메일
              </Typography>
              <Typography
                variant="body1"
                style={[styles.emailValue, { color: theme.colors.text.primary }]}
              >
                {email}
              </Typography>
            </View>

            <Typography
              variant="body2"
              style={[styles.instruction, { color: theme.colors.text.secondary }]}
            >
              • 이메일을 확인하고 비밀번호 재설정 링크를 클릭해주세요{'\n'}
              • 링크는 24시간 동안 유효합니다{'\n'}
              • 이메일이 보이지 않으면 스팸 폴더를 확인해주세요
            </Typography>
          </Card>

          <View style={styles.buttonContainer}>
            <Button
              title="다시 보내기"
              variant="secondary"
              size="large"
              onPress={handleResendEmail}
              style={styles.resendButton}
            />
            <Button
              title="로그인으로 돌아가기"
              variant="primary"
              size="large"
              onPress={handleBackToLogin}
              style={styles.backButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Typography variant="h2" style={[styles.title, { color: theme.colors.text.primary }]}>
            비밀번호 찾기
          </Typography>
          <Typography
            variant="body1"
            style={[styles.subtitle, { color: theme.colors.text.secondary }]}
          >
            가입하신 이메일 주소를 입력해주세요{'\n'}
            비밀번호 재설정 링크를 보내드리겠습니다
          </Typography>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Typography
              variant="body2"
              style={[styles.label, { color: theme.colors.text.primary }]}
            >
              이메일 주소
            </Typography>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputWrapper}>
                  <Typography
                    variant="body1"
                    style={[
                      styles.input,
                      {
                        color: value ? theme.colors.text.primary : theme.colors.text.secondary,
                        borderColor: errors.email
                          ? theme.colors.semantic.error
                          : theme.colors.border.light,
                        backgroundColor: theme.colors.background.secondary,
                      },
                    ]}
                    onBlur={onBlur}
                    value={value}
                    placeholder="your@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    onChangeText={onChange}
                  />
                </View>
              )}
            />
            {errors.email && (
              <Typography
                variant="caption"
                style={[styles.errorText, { color: theme.colors.semantic.error }]}
              >
                {errors.email.message}
              </Typography>
            )}
          </View>

          <Button
            title={isLoading ? '전송 중...' : '재설정 링크 보내기'}
            variant="primary"
            size="large"
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            style={styles.submitButton}
          />

          <View style={styles.footer}>
            <Typography
              variant="body2"
              style={[styles.footerText, { color: theme.colors.text.secondary }]}
            >
              비밀번호가 기억나셨나요?
            </Typography>
            <Button
              title="로그인으로 돌아가기"
              variant="text"
              size="medium"
              onPress={handleBackToLogin}
              style={styles.loginLink}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    marginBottom: 8,
    fontWeight: '600',
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    minHeight: 56,
  },
  errorText: {
    marginTop: 8,
    marginLeft: 4,
  },
  submitButton: {
    marginBottom: 32,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    marginBottom: 12,
  },
  loginLink: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emailCard: {
    marginBottom: 32,
    padding: 20,
  },
  emailInfo: {
    marginBottom: 16,
  },
  emailLabel: {
    marginBottom: 4,
    fontSize: 14,
  },
  emailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  instruction: {
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 12,
  },
  resendButton: {
    marginBottom: 0,
  },
  backButton: {
    marginBottom: 0,
  },
});