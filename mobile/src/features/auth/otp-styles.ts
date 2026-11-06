
import { StyleSheet } from 'react-native';

export const otpStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EAF5FA',
  },

  keyboardView: {
    flex: 1,
  },

  // Background giống Login
  background: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },

  backgroundOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(234, 245, 250, 0.5)',
  },

  // Container
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },

  // Header giống Login
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 82,
  },

  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },

  brandMark: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#0875B5',
    borderWidth: 3,
    borderColor: '#C4E4F4',
    elevation: 4,
  },

  brandMarkText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 36,
    fontFamily: 'Montserrat',
  },

  brandName: {
    color: '#07518A',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 1.3,
    fontFamily: 'Montserrat',
  },

  brandDescription: {
    color: '#6C91A9',
    fontSize: 11,
    letterSpacing: 0.5,
    fontFamily: 'Montserrat',
  },

  hospitalHeader: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },

  hospitalNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  hospitalPlus: {
    color: '#D93636',
    fontSize: 24,
    fontWeight: '900',
  },

  hospitalName: {
    color: '#07518A',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
    fontFamily: 'Montserrat',
  },

  hospitalEnglish: {
    color: '#66869D',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.7,
    textAlign: 'center',
    marginTop: 3,
    fontFamily: 'Montserrat',
  },

  hospitalSubtitle: {
    color: '#375C78',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
    fontFamily: 'Montserrat',
  },

  roleBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A8D2E8',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  roleBadgeText: {
    color: '#07518A',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    fontFamily: 'Montserrat',
  },

  headerDivider: {
    height: 1,
    backgroundColor: '#BDD8E6',
    marginTop: 14,
    marginBottom: 28,
    opacity: 0.8,
  },

  // Form card giống Login
  loginCard: {
    width: '100%',
    maxWidth: 510,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 30,
    paddingTop: 32,
    paddingBottom: 30,
    borderWidth: 1,
    borderColor: '#E4EEF4',

    shadowColor: '#174D70',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 7,
  },

  cardHeading: {
    alignItems: 'center',
    marginBottom: 28,
  },

  title: {
    color: '#07518A',
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
    fontFamily: 'Montserrat',
  },

  subtitle: {
    marginTop: 7,
    color: '#8299A9',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Montserrat',
  },

  // Form fields
  form: {
    gap: 20,
  },

  field: {
    gap: 8,
  },

  label: {
    color: '#193C50',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Montserrat',
  },

  input: {
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: '#D5E3EC',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: '#193C50',
    fontSize: 15,
    paddingHorizontal: 20,
    fontFamily: 'Montserrat',
  },

  // Resend OTP
  resendButton: {
    alignSelf: 'flex-end',
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  resendText: {
    color: '#07518A',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Montserrat',
  },

  // Message
  messageBox: {
    borderRadius: 10,
    backgroundColor: '#E7F3FA',
    padding: 13,
    borderWidth: 1,
    borderColor: '#C9E3F1',
  },

  messageText: {
    color: '#175B83',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Montserrat',
  },

  errorBox: {
    backgroundColor: '#FCEBEC',
    borderColor: '#F2C7CC',
  },

  errorMessage: {
    color: '#A62F3D',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Montserrat',
  },

  // Buttons
  loginButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 12,
    backgroundColor: '#07518A',
    paddingHorizontal: 20,
    marginTop: 2,

    shadowColor: '#07518A',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  loginButtonPressed: {
    opacity: 0.8,
  },

  loginButtonDisabled: {
    opacity: 0.6,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: 'Montserrat',
  },

  backButton: {
    width: '100%',
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#07518A',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  backButtonText: {
    color: '#07518A',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Montserrat',
  },

  // Footer giống Login
  footer: {
    alignItems: 'center',
    marginTop: 28,
    gap: 8,
  },

  footerDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#C9DDE9',
    marginBottom: 8,
  },

  footerText: {
    color: '#7591A5',
    fontSize: 11,
    textAlign: 'center',
    fontFamily: 'Montserrat',
  },

  footerSubtext: {
    color: '#A1B4C1',
    fontSize: 9,
    letterSpacing: 1,
    fontFamily: 'Montserrat',
  },
});
