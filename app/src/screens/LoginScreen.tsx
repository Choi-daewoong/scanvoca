// src/screens/LoginScreen.tsx

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../stores/authStore';
import { socialAuthService } from '../services/socialAuth';
import { LoginScreenProps } from '../navigation/types';
import {
  Button,
  Card,
  Typography,
  Header,
  GoogleIcon,
  KakaoIcon,
  NaverIcon,
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
    .min(8, '비밀번호는 8자 이상이어야 합니다.'),
});

type LoginFormData = z.infer<typeof loginSchema>;

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
    } catch (error) {
      const message = error instanceof Error ? error.message : '로그인에 실패했습니다.';
      Alert.alert('로그인 실패', message);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'naver' | 'kakao') => {
    try {
      let authResult;

      switch (provider) {
        case 'google':
          authResult = await socialAuthService.signInWithGoogle();
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
    } catch (error) {
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* 단색 배경 */}
      <View style={styles.background} />

      {/* 장식용 원형 요소들 */}
      <View style={[styles.decorCircle, styles.circle1]} />
      <View style={[styles.decorCircle, styles.circle2]} />
      <View style={[styles.decorCircle, styles.circle3]} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          {/* 로고 섹션 */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <Typography variant="h1" style={styles.logoText}>
                Scan Voca
              </Typography>
              <Typography variant="body1" style={styles.subtitleText}>
                영단어 학습의 새로운 경험
              </Typography>
            </View>
          </View>

          {/* 로그인 카드 */}
          <View style={styles.loginCard}>
            <View style={{ marginBottom: theme.spacing.lg }}>
              <Typography variant="h3" style={{ marginBottom: theme.spacing.sm }}>
                로그인
              </Typography>
              <Typography variant="body2" color="secondary">
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
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: errors.email
                        ? theme.colors.semantic.error
                        : theme.colors.border.light,
                      borderRadius: theme.borderRadius.md,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      backgroundColor: theme.colors.background.secondary,
                      fontSize: 16,
                      color: theme.colors.text.primary,
                      minHeight: 48,
                    }}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                    placeholder="your@email.com"
                    placeholderTextColor={theme.colors.text.secondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                  />
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
                        ? theme.colors.semantic.error
                        : theme.colors.border.light,
                      borderRadius: theme.borderRadius.md,
                      backgroundColor: theme.colors.background.secondary,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <TextInput
                      style={{
                        flex: 1,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm,
                        fontSize: 16,
                        color: theme.colors.text.primary,
                        minHeight: 48,
                      }}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      value={value}
                      placeholder="비밀번호를 입력하세요"
                      placeholderTextColor={theme.colors.text.secondary}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="password"
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
              size="xl"
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading}
              title={isLoading ? '로그인 중...' : '로그인'}
              style={{ marginBottom: theme.spacing.md }}
            />

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
                    backgroundColor: theme.colors.border.medium,
                  }}
                />
                <Typography
                  variant="caption"
                  color="secondary"
                  style={{ marginHorizontal: theme.spacing.md }}
                >
                  또는
                </Typography>
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: theme.colors.border.medium,
                  }}
                />
              </View>

              <View style={styles.socialButtonsContainer}>
                <TouchableOpacity
                  style={[styles.socialButton, styles.googleButton]}
                  onPress={() => handleSocialLogin('google')}
                >
                  <GoogleIcon width={24} height={24} />
                  <Typography variant="body1" style={styles.socialButtonText}>
                    Google로 계속하기
                  </Typography>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.socialButton, styles.kakaoButton]}
                  onPress={() => handleSocialLogin('kakao')}
                >
                  <KakaoIcon width={24} height={24} />
                  <Typography variant="body1" style={styles.socialButtonText}>
                    카카오로 계속하기
                  </Typography>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.socialButton, styles.naverButton]}
                  onPress={() => handleSocialLogin('naver')}
                >
                  <NaverIcon width={24} height={24} />
                  <Typography variant="body1" style={[styles.socialButtonText, { color: '#FFFFFF' }]}>
                    네이버로 계속하기
                  </Typography>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Register Link */}
          <View style={styles.registerLinkContainer}>
            <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.registerLink}>
              <Typography variant="body2" style={styles.registerText}>
                계정이 없으신가요?{' '}
                <Typography variant="body2" style={styles.registerLinkText}>
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

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#667eea',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    paddingBottom: 80, // 하단 추가 여백으로 네비게이션 바 회피
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    minHeight: height * 0.9,
  },

  // 장식용 원형 요소들
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  circle1: {
    width: 200,
    height: 200,
    top: -100,
    right: -100,
  },
  circle2: {
    width: 150,
    height: 150,
    bottom: 100,
    left: -75,
  },
  circle3: {
    width: 80,
    height: 80,
    top: height * 0.3,
    right: 50,
  },

  // 로고 섹션
  logoSection: {
    marginBottom: theme.spacing.xxl,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: theme.spacing.sm,
  },
  subtitleText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '300',
  },

  // 로그인 카드
  loginCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: theme.spacing.xl,
    marginHorizontal: theme.spacing.sm,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },

  // 소셜 로그인 버튼
  socialButtonsContainer: {
    gap: theme.spacing.md,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
  },
  kakaoButton: {
    backgroundColor: '#FEE500',
  },
  naverButton: {
    backgroundColor: '#03C75A',
  },
  socialButtonText: {
    marginLeft: theme.spacing.md,
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },

  // 회원가입 링크
  registerLinkContainer: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.xxl, // 하단 여백 크게 증가
    paddingBottom: 40, // 추가 패딩으로 안전 영역 확보
    alignItems: 'center',
  },
  registerLink: {
    padding: theme.spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  registerText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    textAlign: 'center',
  },
  registerLinkText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});