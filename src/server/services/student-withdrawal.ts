export {
  submitStudentWithdrawal as requestStudentWithdrawal,
  approveStudentWithdrawal,
} from "./order-withdrawal";
export type {
  WithdrawalKind,
  RequestWithdrawalInput as RequestStudentWithdrawalInput,
  WithdrawalDeps as StudentWithdrawalDeps,
  WithdrawalSuccess as WithdrawalCancellationSuccess,
  WithdrawalFailure as WithdrawalCancellationFailure,
  WithdrawalResult as WithdrawalCancellationResult,
} from "./order-withdrawal";
