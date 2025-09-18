// src/screens/LoginScreen.tsx

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../stores/authStore';
import { socialAuthService } from '../services/socialAuth';
import {
  Button,
  Card,
  Typography,
  Header,
} from '../components/common';
import theme from '../styles/theme';

// Validation schema
const loginSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요.')
    .email('올바른 이메일 형식이 아닙니다.'),
  password: z
    .string()
    .min(6, '비밀번호는 6자 이상이어야 합니다.'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginScreenProps {
  navigation: any;
}

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { login, socialLogin, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data);
      // 로그인 성공 시 네비게이션은 App.tsx에서 처리
    } catch (error: any) {
      Alert.alert('로그인 실패', error.message);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple' | 'naver' | 'kakao') => {
    try {
      let authResult;

      switch (provider) {
        case 'google':
          authResult = await socialAuthService.signInWithGoogle();
          break;
        case 'apple':
          authResult = await socialAuthService.signInWithApple();
          break;
        case 'kakao':
          authResult = await socialAuthService.signInWithKakao();
          break;
        case 'naver':
          authResult = await socialAuthService.signInWithNaver();
          break;
        default:
          throw new Error('지원하지 않는 소셜 로그인 제공자입니다.');
      }

      // 백엔드로 소셜 로그인 정보 전송
      await socialLogin({
        provider,
        code: authResult.code,
        id_token: authResult.idToken,
      });

      // 로그인 성공 시 네비게이션은 App.tsx에서 처리
    } catch (error: any) {
      console.error(`[LoginScreen] ${provider} 로그인 실패:`, error);

      // 개발 중에는 준비중 메시지로 대체
      Alert.alert(
        '간편로그인 준비중',
        `${provider} 간편로그인 기능을 준비 중입니다.\n일반 로그인을 이용해주세요.`,
        [{ text: '확인' }]
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header title="로그인" showBack={false} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flex: 1, justifyContent: 'center', minHeight: 400 }}>
          <View style={{ marginBottom: theme.spacing.xxl, alignItems: 'center' }}>
            <Typography variant="h1" color="primary" style={{ marginBottom: theme.spacing.sm }}>
              Scan Voca
            </Typography>
            <Typography variant="body1" color="textSecondary">
              영단어 학습의 새로운 경험
            </Typography>
          </View>

          <Card variant="default" style={{ padding: theme.spacing.lg }}>
            <View style={{ marginBottom: theme.spacing.lg }}>
              <Typography variant="h3" style={{ marginBottom: theme.spacing.sm }}>
                로그인
              </Typography>
              <Typography variant="body2" color="textSecondary">
                계정에 로그인하여 학습을 계속하세요
              </Typography>
            </View>

            {/* Email Input */}
            <View style={{ marginBottom: theme.spacing.md }}>
              <Typography
                variant="body2"
                style={{ marginBottom: theme.spacing.sm, fontWeight: '600' }}
              >
                이메일
              </Typography>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: errors.email
                        ? theme.colors.error
                        : theme.colors.border,
                      borderRadius: theme.borderRadius.md,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      backgroundColor: theme.colors.surface,
                    }}
                  >
                    <Typography
                      variant="body1"
                      style={{
                        color: value ? theme.colors.text : theme.colors.textSecondary,
                        minHeight: 20,
                      }}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      value={value}
                      placeholder="your@email.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                )}
              />
              {errors.email && (
                <Typography
                  variant="caption"
                  color="error"
                  style={{ marginTop: theme.spacing.xs }}
                >
                  {errors.email.message}
                </Typography>
              )}
            </View>

            {/* Password Input */}
            <View style={{ marginBottom: theme.spacing.lg }}>
              <Typography
                variant="body2"
                style={{ marginBottom: theme.spacing.sm, fontWeight: '600' }}
              >
                비밀번호
              </Typography>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: errors.password
                        ? theme.colors.error
                        : theme.colors.border,
                      borderRadius: theme.borderRadius.md,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      backgroundColor: theme.colors.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Typography
                      variant="body1"
                      style={{
                        flex: 1,
                        color: value ? theme.colors.text : theme.colors.textSecondary,
                        minHeight: 20,
                      }}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      value={value}
                      placeholder="비밀번호를 입력하세요"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={{ padding: theme.spacing.xs }}
                    >
                      <Typography variant="caption" color="primary">
                        {showPassword ? '숨기기' : '보기'}
                      </Typography>
                    </TouchableOpacity>
                  </View>
                )}
              />
              {errors.password && (
                <Typography
                  variant="caption"
                  color="error"
                  style={{ marginTop: theme.spacing.xs }}
                >
                  {errors.password.message}
                </Typography>
              )}
            </View>

            {/* Login Button */}
            <Button
              variant="primary"
              size="large"
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading}
              style={{ marginBottom: theme.spacing.md }}
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </Button>

            {/* Forgot Password Link */}
            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={{ alignItems: 'center', marginBottom: theme.spacing.lg }}
            >
              <Typography variant="body2" color="primary">
                비밀번호를 잊으셨나요?
              </Typography>
            </TouchableOpacity>

            {/* Social Login Section */}
            <View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: theme.spacing.md,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: theme.colors.border,
                  }}
                />
                <Typography
                  variant="caption"
                  color="textSecondary"
                  style={{ marginHorizontal: theme.spacing.md }}
                >
                  또는
                </Typography>
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: theme.colors.border,
                  }}
                />
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Button
                  variant="outline"
                  size="large"
                  onPress={() => handleSocialLogin('google')}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Typography variant="body1" style={{ marginLeft: theme.spacing.sm }}>
                    Google로 계속하기
                  </Typography>
                </Button>

                <Button
                  variant="outline"
                  size="large"
                  onPress={() => handleSocialLogin('apple')}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Typography variant="body1" style={{ marginLeft: theme.spacing.sm }}>
                    Apple로 계속하기
                  </Typography>
                </Button>

                <Button
                  variant="outline"
                  size="large"
                  onPress={() => handleSocialLogin('kakao')}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Typography variant="body1" style={{ marginLeft: theme.spacing.sm }}>
                    카카오로 계속하기
                  </Typography>
                </Button>
              </View>
            </View>
          </Card>

          {/* Register Link */}
          <View
            style={{
              marginTop: theme.spacing.lg,
              alignItems: 'center',
            }}
          >
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Typography variant="body2" color="textSecondary">
                계정이 없으신가요?{' '}
                <Typography variant="body2" color="primary">
                  회원가입
                </Typography>
              </Typography>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}