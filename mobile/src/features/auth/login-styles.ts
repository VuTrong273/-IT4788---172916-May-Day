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
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#D9F3E8',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  roleBadgeText: {
    color: '#087A55',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    marginTop: 24,
    color: '#102A25',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 10,
    color: '#63756F',
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    marginTop: 32,
    gap: 18,
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
    borderRadius: 15,
    backgroundColor: '#15966C',
    paddingHorizontal: 20,
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
  signupLink: {
    alignSelf: 'center',
    marginTop: 24,
    padding: 10,
  },
  signupLinkText: {
    color: '#087A55',
    fontSize: 15,
    fontWeight: '700',
  },
});
