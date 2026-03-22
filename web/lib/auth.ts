/** Barrel: gate logic is Edge-safe in `auth-gates`; password login uses Node `crypto` in `auth-login`. */
export {
  type AuthGateId,
  AUTH_GATE_IDS,
  AUTH_GATES,
  buildAuthMisconfiguredMessage,
  buildGateFailureResponse,
  buildGateLoginSuccessResponse,
  CHARTING_GATE_CHAIN,
  clearAllGateCookies,
  getConfiguredPassword,
  getRequiredGatesForPath,
  hasGateCookie,
  isChartingPath,
  isMechanicsPath,
  isPublicPath,
  MECHANICS_GATE_CHAIN,
  requireRequestGates,
  resolveConfiguredPassword,
  SITE_GATE_CHAIN,
  unauthorizedApiResponse,
} from "./auth-gates";

export { handlePasswordGateLogin } from "./auth-login";
