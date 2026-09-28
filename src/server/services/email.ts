// Facade kompatibilitas: impor dari "./email" tetap berfungsi.
// Implementasi nyata tinggal di ./email/* (types, brevo-provider,
// smtp-provider, factory).
export {
  getSmtpConfig,
  saveSmtpConfig,
  sendEmailNotification,
  selectProviderName,
} from "./email/factory";
export type {
  EmailProvider,
  EmailProviderName,
  EmailProviderSetting,
  EmailSendOptions,
  EmailSendResult,
  EmailRuntimeEnv,
  ResolvedEmailConfig,
} from "./email/types";
export type { SmtpConfig, ProviderSelection } from "./email/factory";
