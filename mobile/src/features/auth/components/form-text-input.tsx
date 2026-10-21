import { type Control, type FieldPath, useController } from 'react-hook-form';
import {
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
};

export function FormTextInput({
  control,
  label,
  name,
  onValueChange,
  ...inputProps
}: FormTextInputProps) {
  const {
    field: { onBlur, onChange, value },
    fieldState: { error },
  } = useController({ control, name });

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        onBlur={onBlur}
        onChangeText={(text) => {
          onChange(text);
          onValueChange?.();
        }}
        placeholderTextColor="#91A19C"
        style={[styles.input, error && styles.inputError]}
        value={value}
      />
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
  inputError: {
    borderColor: '#C43D4B',
  },
  errorText: {
    color: '#A62F3D',
    fontSize: 13,
    lineHeight: 18,
  },
});
