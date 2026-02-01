/**
 * Auth Library Index
 */

// Server actions
export {
  signup,
  login,
  logout,
  requestPasswordReset,
  updatePassword,
  getCurrentUser,
  getCurrentBusiness,
  type SignupData,
  type LoginData,
  type AuthResult,
} from "./actions";

// Client hooks
export { useAuth } from "./use-auth";
