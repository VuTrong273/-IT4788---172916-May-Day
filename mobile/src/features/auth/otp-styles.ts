import { StyleSheet } from 'react-native';

export const otpStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5FAF8' },
  keyboardView: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40 },
  title: { color: '#102A25', fontSize: 30, fontWeight: '800' },
  subtitle: { marginTop: 10, color: '#63756F', fontSize: 15, lineHeight: 22 },
  form: { marginTop: 28, gap: 18 },
  field: { gap: 8 },
  label: { color: '#243B35', fontSize: 14, fontWeight: '700' },
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
  error: { color: '#A62F3D', fontSize: 14, lineHeight: 20 },
  button: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#15966C',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
