// src/screens/RegisterScreen.tsx

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../stores/authStore';
import {
  Button,
  Card,
  Typography,
  Header,
  Checkbox,
} from '../components/common';
import theme from '../styles/theme';

// Validation schema
const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, '이름은 2자 이상이어야 합니다.')
      .max(20, '이름은 20자 이하여야 합니다.'),
    email: z
      .string()
      .min(1, '이메일을 입력해주세요.')
      .email('올바른 이메일 형식이 아닙니다.'),
    password: z
      .string()
      .min(6, '비밀번호는 6자 이상이어야 합니다.')
      .regex(
        /^(?=.*[a-zA-Z])(?=.*\d)/,
        '비밀번호는 영문과 숫자를 포함해야 합니다.'
      ),
    confirmPassword: z
      .string()
      .min(1, '비밀번호 확인을 입력해주세요.'),
    phone: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^\d{2,3}-\d{3,4}-\d{4}$/.test(val),
        '올바른 전화번호 형식이 아닙니다. (예: 010-1234-5678)'
      ),
    agreeTerms: z
      .boolean()
      .refine((val) => val === true, '서비스 이용약관에 동의해주세요.'),
    agreePrivacy: z
      .boolean()
      .refine((val) => val === true, '개인정보 처리방침에 동의해주세요.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterScreenProps {
  navigation: any;
}

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const { register, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      agreeTerms: false,
      agreePrivacy: false,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await register({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        role: 'user',
      });

      Alert.alert(
        '회원가입 완료',
        '회원가입이 완료되었습니다.\n로그인 페이지로 이동합니다.',
        [
          {
            text: '확인',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('회원가입 실패', error.message);
    }
  };

  const formatPhoneNumber = (text: string) => {
    const numbers = text.replace(/[^\d]/g, '');
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header
        title="회원가입"
        leftIcon={<Typography variant="h4">←</Typography>}
        onLeftPress={() => navigation.goBack()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Card variant="default" style={{ padding: theme.spacing.lg }}>
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Typography variant="h3" style={{ marginBottom: theme.spacing.sm }}>
              회원가입
            </Typography>
            <Typography variant="body2" color="secondary">
              Scan Voca와 함께 영단어 학습을 시작하세요
            </Typography>
          </View>

          {/* Name Input */}
          <View style={{ marginBottom: theme.spacing.md }}>
            <Typography
              variant="body2"
              style={{ marginBottom: theme.spacing.sm, fontWeight: '600' }}
            >
              이름 *
            </Typography>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: errors.name ? theme.colors.semantic.error : theme.colors.border.medium,
                    borderRadius: theme.borderRadius.md,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    backgroundColor: theme.colors.background.primary,
                  }}
                >
                  <TextInput
                    style={{
                      color: theme.colors.text.primary,
                      fontSize: 16,
                      minHeight: 20,
                    }}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                    placeholder="이름을 입력하세요"
                    placeholderTextColor={theme.colors.text.secondary}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              )}
            />
            {errors.name && (
              <Typography
                variant="caption"
                color="error"
                style={{ marginTop: theme.spacing.xs }}
              >
                {errors.name.message}
              </Typography>
            )}
          </View>

          {/* Email Input */}
          <View style={{ marginBottom: theme.spacing.md }}>
            <Typography
              variant="body2"
              style={{ marginBottom: theme.spacing.sm, fontWeight: '600' }}
            >
              이메일 *
            </Typography>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: errors.email ? theme.colors.semantic.error : theme.colors.border.medium,
                    borderRadius: theme.borderRadius.md,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    backgroundColor: theme.colors.background.primary,
                  }}
                >
                  <TextInput
                    style={{
                      color: theme.colors.text.primary,
                      fontSize: 16,
                      minHeight: 20,
                    }}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                    placeholder="your@email.com"
                    placeholderTextColor={theme.colors.text.secondary}
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
          <View style={{ marginBottom: theme.spacing.md }}>
            <Typography
              variant="body2"
              style={{ marginBottom: theme.spacing.sm, fontWeight: '600' }}
            >
              비밀번호 *
            </Typography>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: errors.password ? theme.colors.semantic.error : theme.colors.border.medium,
                    borderRadius: theme.borderRadius.md,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    backgroundColor: theme.colors.background.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <TextInput
                    style={{
                      flex: 1,
                      color: theme.colors.text.primary,
                      fontSize: 16,
                      minHeight: 20,
                    }}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                    placeholder="영문, 숫자 포함 6자 이상"
                    placeholderTextColor={theme.colors.text.secondary}
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

          {/* Confirm Password Input */}
          <View style={{ marginBottom: theme.spacing.md }}>
            <Typography
              variant="body2"
              style={{ marginBottom: theme.spacing.sm, fontWeight: '600' }}
            >
              비밀번호 확인 *
            </Typography>
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: errors.confirmPassword
                      ? theme.colors.semantic.error
                      : theme.colors.border.medium,
                    borderRadius: theme.borderRadius.md,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    backgroundColor: theme.colors.background.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <TextInput
                    style={{
                      flex: 1,
                      color: theme.colors.text.primary,
                      fontSize: 16,
                      minHeight: 20,
                    }}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                    placeholder="비밀번호를 다시 입력하세요"
                    placeholderTextColor={theme.colors.text.secondary}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ padding: theme.spacing.xs }}
                  >
                    <Typography variant="caption" color="primary">
                      {showConfirmPassword ? '숨기기' : '보기'}
                    </Typography>
                  </TouchableOpacity>
                </View>
              )}
            />
            {errors.confirmPassword && (
              <Typography
                variant="caption"
                color="error"
                style={{ marginTop: theme.spacing.xs }}
              >
                {errors.confirmPassword.message}
              </Typography>
            )}
          </View>

          {/* Phone Input */}
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Typography
              variant="body2"
              style={{ marginBottom: theme.spacing.sm, fontWeight: '600' }}
            >
              전화번호 (선택사항)
            </Typography>
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: errors.phone ? theme.colors.semantic.error : theme.colors.border.medium,
                    borderRadius: theme.borderRadius.md,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    backgroundColor: theme.colors.background.primary,
                  }}
                >
                  <TextInput
                    style={{
                      color: theme.colors.text.primary,
                      fontSize: 16,
                      minHeight: 20,
                    }}
                    onChangeText={(text) => onChange(formatPhoneNumber(text))}
                    onBlur={onBlur}
                    value={value}
                    placeholder="010-1234-5678"
                    placeholderTextColor={theme.colors.text.secondary}
                    keyboardType="phone-pad"
                    maxLength={13}
                  />
                </View>
              )}
            />
            {errors.phone && (
              <Typography
                variant="caption"
                color="error"
                style={{ marginTop: theme.spacing.xs }}
              >
                {errors.phone.message}
              </Typography>
            )}
          </View>

          {/* Terms Agreement */}
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Controller
              control={control}
              name="agreeTerms"
              render={({ field: { onChange, value } }) => (
                <View style={{ marginBottom: theme.spacing.sm }}>
                  <Checkbox
                    checked={value}
                    onPress={() => onChange(!value)}
                    label="서비스 이용약관에 동의합니다 *"
                    size="md"
                  />
                </View>
              )}
            />

            <Controller
              control={control}
              name="agreePrivacy"
              render={({ field: { onChange, value } }) => (
                <Checkbox
                  checked={value}
                  onPress={() => onChange(!value)}
                  label="개인정보 처리방침에 동의합니다 *"
                  size="md"
                />
              )}
            />

            {(errors.agreeTerms || errors.agreePrivacy) && (
              <Typography
                variant="caption"
                color="error"
                style={{ marginTop: theme.spacing.sm }}
              >
                필수 약관에 동의해주세요.
              </Typography>
            )}
          </View>

          {/* Register Button */}
          <Button
            variant="primary"
            size="lg"
            title={isLoading ? '가입 중...' : '회원가입'}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            style={{ marginBottom: theme.spacing.md }}
          />

          {/* Login Link */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={{ alignItems: 'center' }}
          >
            <Typography variant="body2" color="secondary">
              이미 계정이 있으신가요?{' '}
              <Typography variant="body2" color="primary">
                로그인
              </Typography>
            </Typography>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}