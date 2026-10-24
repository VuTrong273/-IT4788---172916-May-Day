import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5FAF8',
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 48,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  brandMark: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#15966C',
  },
  brandMarkText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 32,
  },
  brandName: {
    color: '#102A25',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#D9F3E8',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 38,
  },
  roleBadgeText: {
    color: '#087A55',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    marginTop: 14,
    color: '#102A25',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 39,
  },
  subtitle: {
    marginTop: 10,
    color: '#63756F',
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    marginTop: 28,
    gap: 16,
    borderWidth: 1,
    borderColor: '#E0EBE6',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  formTitle: {
    color: '#193A32',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    justifyContent: 'center',
    minHeight: 36,
    marginTop: -7,
  },
  forgotLinkText: {
    color: '#087A55',
    fontSize: 14,
    fontWeight: '700',
  },
  messageBox: {
    borderRadius: 12,
    backgroundColor: '#E8F5F0',
    padding: 13,
  },
  messageText: {
    color: '#176B50',
    fontSize: 14,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#FCEBEC',
  },
  errorMessage: {
    color: '#A62F3D',
  },
  loginButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#15966C',
    paddingHorizontal: 20,
    marginTop: 2,
  },
  loginButtonPressed: {
    opacity: 0.75,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  signupRow: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 24,
    gap: 5,
  },
  signupPrompt: {
    color: '#63756F',
    fontSize: 15,
  },
  signupLink: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  signupLinkText: {
    color: '#087A55',
    fontSize: 15,
    fontWeight: '700',
  },
});
