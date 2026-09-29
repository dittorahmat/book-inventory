import { BookOpen, RotateCcw, AlertCircle, Clock } from "lucide-react";
import { usePublicOrder } from "../components/portal/usePublicOrder";
import { useReturnFlow } from "../components/portal/useReturnFlow";
import { StudentSearchStep } from "../components/portal/StudentSearchStep";
import { LockedPackageStep } from "../components/portal/LockedPackageStep";
import { PaymentStep } from "../components/portal/PaymentStep";
import { OrderSuccessStep } from "../components/portal/OrderSuccessStep";
import { ReturnReportTab } from "../components/portal/ReturnReportTab";

interface PublicOrderViewProps {
  onNavigateToStaffLogin?: () => void;
}

export function PublicOrderView({ onNavigateToStaffLogin }: PublicOrderViewProps) {
  const order = usePublicOrder();
  const returns = useReturnFlow(order.packages, order.setErrorMessage);
  const { activePortalTab, setActivePortalTab, step, errorMessage, setErrorMessage } = order;

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-[#050505] antialiased flex flex-col justify-between">
      {/* Editorial Navigation Header */}
      <header className="border-b border-[#E4E6EB] bg-white sticky top-0 z-40 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center text-white shadow-xs shrink-0">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div className="truncate">
              <span className="text-sm sm:text-base font-bold text-[#050505] truncate">
                Portal Orang Tua & Siswa
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-full">
                Al Wildan Islamic School
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToStaffLogin && (
              <button
                type="button"
                onClick={onNavigateToStaffLogin}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#1877F2] bg-[#E7F3FF] hover:bg-[#D8ECFF] active:scale-[0.98] rounded-full transition-all flex items-center gap-1.5"
              >
                <span>Login Staf / Admin &rarr;</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-3xl w-full mx-auto px-4 py-8 flex-1">
        {/* Portal Mode Switcher */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex p-1 bg-[#E4E6EB]/70 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => {
                setActivePortalTab("order");
                setErrorMessage(null);
              }}
              className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                activePortalTab === "order"
                  ? "bg-white text-[#1877F2] shadow-xs"
                  : "text-[#65676B] hover:text-[#050505]"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Formulir Pesan Buku</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePortalTab("return");
                setErrorMessage(null);
              }}
              className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                activePortalTab === "return"
                  ? "bg-white text-[#1877F2] shadow-xs"
                  : "text-[#65676B] hover:text-[#050505]"
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Lapor Retur Buku Rusak</span>
            </button>
          </div>
        </div>

        {/* ===================== TAB 1: PEMESANAN BUKU ===================== */}
        {activePortalTab === "order" && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#050505]">
                Pemesanan Paket Buku Kurikulum
              </h1>
              <p className="text-xs text-[#65676B] mt-1 max-w-md mx-auto">
                Layanan mandiri pemesanan buku Al Wildan untuk murid baru, kenaikan kelas, dan beasiswa.
              </p>

              {/* Breadcrumb Steps */}
              <div className="flex items-center justify-center gap-2 mt-5">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  step === 1 ? "bg-[#1877F2] text-white" : "bg-[#E4E6EB] text-[#65676B]"
                }`}>
                  <span>1</span> Identitas Siswa
                </div>
                <div className="w-4 h-px bg-[#CED0D4]" />
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  step === 2 ? "bg-[#1877F2] text-white" : "bg-[#E4E6EB] text-[#65676B]"
                }`}>
                  <span>2</span> Detail Paket
                </div>
                <div className="w-4 h-px bg-[#CED0D4]" />
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  step === 3 ? "bg-[#1877F2] text-white" : "bg-[#E4E6EB] text-[#65676B]"
                }`}>
                  <span>3</span> Cek Pembayaran & Beasiswa
                </div>
              </div>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-700">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Perhatian</div>
                  <div>{errorMessage}</div>
                </div>
              </div>
            )}

            {/* STEP 1: PENCARIAN SISWA / TUNGGU VERIFIKASI / PENDAFTARAN SISWA BARU */}
            {step === 1 && order.verificationPending && (
              <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E4E6EB] shadow-xs text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#FFF7E6] border border-[#FFD966] flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6 text-[#B7791F]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#050505]">
                    Pendaftaran Diterima
                  </h2>
                  <p className="text-xs text-[#65676B] mt-1 leading-relaxed max-w-sm mx-auto">
                    Data <span className="font-semibold text-[#050505]">{order.verificationPending.name}</span> menunggu
                    verifikasi admin sekolah. Silakan coba lagi setelah disetujui — belum bisa lanjut ke pemesanan buku.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => order.setVerificationPending(null)}
                  className="px-5 py-2.5 bg-[#F0F2F5] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98] transition-all"
                >
                  Kembali ke Pencarian
                </button>
              </div>
            )}
            {step === 1 && !order.verificationPending && (
              <StudentSearchStep
                schools={order.schools}
                searchQuery={order.searchQuery}
                setSearchQuery={order.setSearchQuery}
                isSearching={order.isSearching}
                searchResults={order.searchResults}
                isNewStudentMode={order.isNewStudentMode}
                setIsNewStudentMode={order.setIsNewStudentMode}
                newStudent={order.newStudent}
                setNewStudent={order.setNewStudent}
                isSubmitting={order.isSubmitting}
                onSearch={order.handleSearch}
                onSelectStudent={order.handleSelectStudent}
                onRegister={order.handleRegisterNewStudent}
              />
            )}

            {/* STEP 2: DETAIL PAKET TERKUNCI */}
            {step === 2 && order.selectedStudent && (
              <LockedPackageStep
                student={order.selectedStudent}
                selectedPackage={order.selectedPackage}
                onBack={() => order.goToStep(1)}
                onNext={() => order.goToStep(3)}
              />
            )}

            {/* STEP 3: PEMBAYARAN ATAU JALUR BEASISWA */}
            {step === 3 && order.selectedStudent && order.selectedPackage && (
              <PaymentStep
                pkg={order.selectedPackage}
                orderType={order.orderType}
                setOrderType={order.setOrderType}
                scholarshipProofBase64={order.scholarshipProofBase64}
                setScholarshipProofBase64={order.setScholarshipProofBase64}
                paymentChoice={order.paymentChoice}
                setPaymentChoice={order.setPaymentChoice}
                transferAmount={order.transferAmount}
                setTransferAmount={order.setTransferAmount}
                bookAllocationAmount={order.bookAllocationAmount}
                setBookAllocationAmount={order.setBookAllocationAmount}
                bankName={order.bankName}
                setBankName={order.setBankName}
                referenceNumber={order.referenceNumber}
                setReferenceNumber={order.setReferenceNumber}
                setPaymentProofBase64={order.setPaymentProofBase64}
                notes={order.notes}
                setNotes={order.setNotes}
                isSubmitting={order.isSubmitting}
                onFileUpload={order.handleFileUpload}
                onBack={() => order.goToStep(2)}
                onSubmit={order.handleSubmitFinalOrder}
              />
            )}

            {/* STEP 4: SUCCESS CONFIRMATION */}
            {step === 4 && order.submittedOrder && (
              <OrderSuccessStep
                submittedOrder={order.submittedOrder}
                onOrderAnother={order.resetOrderFlow}
              />
            )}
          </div>
        )}

        {/* ===================== TAB 2: LAPOR RETUR BUKU RUSAK ===================== */}
        {activePortalTab === "return" && (
          <ReturnReportTab
            errorMessage={order.errorMessage}
            returnLookupQuery={returns.returnLookupQuery}
            setReturnLookupQuery={returns.setReturnLookupQuery}
            isLookingUpReturn={returns.isLookingUpReturn}
            matchedOrders={returns.matchedOrders}
            selectedReturnOrder={returns.selectedReturnOrder}
            setSelectedReturnOrder={returns.setSelectedReturnOrder}
            packageBookList={returns.packageBookList}
            selectedDefectiveBookId={returns.selectedDefectiveBookId}
            setSelectedDefectiveBookId={returns.setSelectedDefectiveBookId}
            returnReason={returns.returnReason}
            setReturnReason={returns.setReturnReason}
            defectPhotoBase64={returns.defectPhotoBase64}
            setDefectPhotoBase64={returns.setDefectPhotoBase64}
            returnSuccessData={returns.returnSuccessData}
            isSubmitting={returns.isSubmittingReturn}
            onFileUpload={order.handleFileUpload}
            onLookupOrder={returns.handleLookupOrderForReturn}
            onSelectOrder={returns.handleSelectOrderForReturn}
            onSubmitReturn={returns.handleSubmitReturnReport}
            onResetReturn={returns.resetReturnFlow}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E4E6EB] bg-white py-4 text-center text-xs text-[#65676B]">
        &copy; {new Date().getFullYear()} Al Wildan Islamic School Logistics Management System. All rights reserved.
      </footer>
    </div>
  );
}
