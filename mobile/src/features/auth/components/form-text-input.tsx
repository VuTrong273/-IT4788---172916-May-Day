import { type Control, type FieldPath, useController } from 'react-hook-form';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import type { LoginFormValues } from '@/features/auth/login-schema';

type FormTextInputProps = Pick<
  TextInputProps,
  | 'autoCapitalize'
  | 'autoComplete'
  | 'keyboardType'
  | 'maxLength'
  | 'onSubmitEditing'
  | 'placeholder'
  | 'returnKeyType'
  | 'secureTextEntry'
> & {
  control: Control<LoginFormValues>;
  label: string;
  name: FieldPath<LoginFormValues>;
  onValueChange?: () => void;
  accessoryLabel?: string;
  onAccessoryPress?: () => void;
};

export function FormTextInput({
  control,
  label,
  name,
  onValueChange,
  accessoryLabel,
  onAccessoryPress,
  ...inputProps
}: FormTextInputProps) {
  const {
    field: { onBlur, onChange, value },
    fieldState: { error },
  } = useController({ control, name });

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          {...inputProps}
          accessibilityLabel={label}
          onBlur={onBlur}
          onChangeText={(text) => {
            onChange(text);
            onValueChange?.();
          }}
          placeholderTextColor="#91A19C"
          style={[styles.input, accessoryLabel && styles.inputWithAccessory, error && styles.inputError]}
          value={value}
        />
        {accessoryLabel && onAccessoryPress ? (
          <Pressable
            accessibilityLabel={accessoryLabel === 'Hiện' ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}
            accessibilityRole="button"
            onPress={onAccessoryPress}
            style={styles.accessory}>
            <Text style={styles.accessoryText}>{accessoryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error.message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    color: '#243B35',
    fontSize: 14,
    fontWeight: '700',
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: '#CCDAD5',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    color: '#102A25',
    fontSize: 16,
    paddingHorizontal: 16,
  },
  inputWithAccessory: {
    paddingRight: 78,
  },
  accessory: {
    minWidth: 62,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    top: 5,
  },
  accessoryText: {
    color: '#087A55',
    fontSize: 14,
    fontWeight: '700',
  },
  inputError: {
    borderColor: '#C43D4B',
  },
  errorText: {
    color: '#A62F3D',
    fontSize: 13,
    lineHeight: 18,
  },
});
