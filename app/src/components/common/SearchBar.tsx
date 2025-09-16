import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  ViewStyle, 
  TextInputProps 
} from 'react-native';
import theme from '../../styles/theme';
import Typography from './Typography';

export interface SearchBarProps extends Omit<TextInputProps, 'style'> {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onSearch?: (text: string) => void;
  onClear?: () => void;
  showSearchButton?: boolean;
  showClearButton?: boolean;
  style?: ViewStyle;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "단어 검색...",
  value,
  onChangeText,
  onSearch,
  onClear,
  showSearchButton = true,
  showClearButton = true,
  style,
  ...inputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');

  const handleChangeText = (text: string) => {
    setInputValue(text);
    onChangeText?.(text);
  };

  const handleSearch = () => {
    onSearch?.(inputValue.trim());
  };

  const handleClear = () => {
    setInputValue('');
    onChangeText?.('');
    onClear?.();
  };

  const handleSubmitEditing = () => {
    handleSearch();
  };

  return (
    <View style={[styles.container, isFocused && styles.focusedContainer, style]}>
      {/* Search Icon */}
      <View style={styles.searchIcon}>
        <Typography variant="body1" color="tertiary">
          🔍
        </Typography>
      </View>

      {/* Input Field */}
      <TextInput
        {...inputProps}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.text.tertiary}
        value={inputValue}
        onChangeText={handleChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onSubmitEditing={handleSubmitEditing}
        returnKeyType="search"
        clearButtonMode="never" // We'll handle this manually
      />

      {/* Clear Button */}
      {showClearButton && inputValue.length > 0 && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClear}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Typography variant="body1" color="tertiary">
            ✕
          </Typography>
        </TouchableOpacity>
      )}

      {/* Search Button */}
      {showSearchButton && inputValue.length > 0 && (
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Typography variant="button" color="primary">
            검색
          </Typography>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    paddingHorizontal: theme.spacing.md,
    height: 48,
  },
  
  focusedContainer: {
    borderColor: theme.colors.primary.main,
    backgroundColor: theme.colors.background.primary,
    ...theme.shadows.sm,
  },
  
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  
  input: {
    flex: 1,
    fontSize: theme.typography.body1.fontSize,
    color: theme.colors.text.primary,
    height: '100%',
    paddingVertical: 0,
  },
  
  clearButton: {
    marginLeft: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  
  searchButton: {
    marginLeft: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.primary.light,
    borderRadius: theme.borderRadius.sm,
  },
});

export default SearchBar;