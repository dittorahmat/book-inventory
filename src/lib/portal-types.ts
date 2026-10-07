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
}

export interface BookPackageItem {
  id?: string;
  bookId?: string;
  title: string;
  isbn?: string;
  quantity: number;
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

export interface MatchedOrder {
  id: string;
  orderNumber: string;
  studentId: string;
  studentName: string;
  nis: string;
  schoolId: string;
  schoolName: string;
  packageId: string;
  packageName: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  handoverDate?: string;
  handoverDeliveryNumber?: string;
  handoverRecipient?: string;
}

export interface NewStudentForm {
  schoolId: string;
  name: string;
  gender: "male" | "female";
  gradeLevel: string;
  curriculumType: "international" | "national";
  academicYear: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
}

export interface PackageBookChoice {
  bookId: string;
  title: string;
  isbn: string;
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
