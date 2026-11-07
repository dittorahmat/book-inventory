/**
 * Re-export dari seam terpadu `src/components/portal/portal-api.ts`.
 * Seluruh endpoint publik buku dan seragam kini dikelola dalam satu adapter terpadu.
 */
export {
  fetchUniformSchools,
  searchUniformStudents,
  fetchUniformCatalog,
  fetchUniformSatuanStatus,
  submitUniformOrder,
  lookupUniformOrders,
  requestUniformExchange,
  getSportsExchangeTracking,
  requestUniformRefund,
  type UniformStudentSearchParams,
  type SubmittedUniformOrder,
  type UniformLookupOrder,
  type UniformLookupItem,
} from "../portal/portal-api";
