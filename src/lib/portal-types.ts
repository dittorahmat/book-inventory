export interface SchoolOption {
  id: string;
  name: string;
  code: string;
}

export interface StudentSearchResult {
  id: string;
  nis: string;
  name: string;
  gradeLevel: string;
  curriculumType: "international" | "national";
  academicYear: string;
  status: string;
  isScholarship: boolean;
  schoolId: string;
  schoolName: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  detectedStatus: "naik_kelas" | "aktif" | "baru";
  currentGradeLevel: string;
  targetGradeLevel: string;
  /** Kelayakan order milik server (seam validasi yang sama dengan submit). */
  canOrder: boolean;
  orderBlockedReason: string | null;
}

export interface BookPackageItem {
  id?: string;
  bookId?: string;
  title: string;
  quantity: number;
  unitPrice?: number;
}

export interface BookPackageOption {
  id: string;
  code: string;
  name: string;
  gradeLevel: string;
  curriculumType: "international" | "national";
  academicYear: string;
  price: number;
  totalItemsCount: number;
  items: BookPackageItem[];
}

export interface StaffBookReturn {
  id: string;
  orderId: string;
  orderNumber: string;
  studentId: string;
  studentName: string;
  nis: string;
  defectiveBookId: string;
  bookTitle: string;
  isbn: string;
  reason: string;
  photoProofUrl?: string;
  status: "reported" | "approved" | "replaced" | "rejected";
  replacementBookItemId?: string;
  resolvedAt?: string;
  createdAt: string;
}

/** Pesanan hasil pencarian portal untuk alur refund buku. */
export interface PortalOrderLookup {
  id: string;
  orderNumber: string;
  studentId: string;
  studentName: string;
  nis: string;
  schoolId: string;
  schoolName: string;
  packageId: string | null;
  packageName: string | null;
  fulfillmentStatus: "waiting_preparation" | "ready_for_pickup" | "picked_up" | "return_in_progress";
  paymentStatus: string;
  handoverDate: string | null;
  handoverDeliveryNumber: string | null;
  handoverRecipient: string | null;
}

/** Judul buku versi publik (alias samaran, tanpa ISBN) untuk form refund. */
export interface PortalBookChoice {
  bookId: string;
  title: string;
}

export interface NewStudentForm {  schoolId: string;
  name: string;
  gender: "male" | "female";
  gradeLevel: string;
  curriculumType: "international" | "national";
  academicYear: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
}

export type FileUploadHandler = (
  e: React.ChangeEvent<HTMLInputElement>,
  setter: (val: string) => void
) => void;

export type SatuanOverride = "open" | "closed";

/** Status keterbukaan order satuan. Kanonik lintas seam (server + portal + pengaturan). */
export interface SatuanStatus {
  academicYear: string;
  open: boolean;
  todayWIB: string;
  openFrom: string | null;
  override: SatuanOverride | null;
  /** Alasan singkat untuk ditampilkan di UI publik. */
  reason: string;
}
