import { useState } from "react";
import { signIn } from "../lib/auth-client";
import { Shield, Sparkles, School, ArrowRight, Loader2 } from "lucide-react";

interface LoginViewProps {
  onLoginSuccess: () => void;
  onNavigateToPublicPortal?: () => void;
}

export function LoginView({ onLoginSuccess, onNavigateToPublicPortal }: LoginViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    const targetEmail = customEmail || email;
    const targetPassword = customPass || password;

    try {
      const { error } = await signIn.email({
        email: targetEmail,
        password: targetPassword,
      });

      if (error) {
        setErrorMsg(error.message || "Failed to sign in. Please verify credentials.");
      } else {
        onLoginSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
    handleLogin(undefined, demoEmail, "password123");
  };

  const handleSeedDemo = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("Data demo 4 kampus Al Wildan & Buku Cambridge berhasil di-load!");
      }
    } catch {
      alert("Gagal memuat data demo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col justify-center items-center px-4 py-10 antialiased">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Modern Facebook Brand Hero Section */}
        <div className="lg:col-span-7 text-center lg:text-left space-y-3 pr-0 lg:pr-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E7F3FF] text-[#1877F2] text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#1877F2]"></span>
            Al Wildan Islamic School Logistics
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-[#1877F2] tracking-tight">
            School Book
          </h1>
          <p className="text-base sm:text-xl text-[#050505] font-normal leading-relaxed max-w-lg mx-auto lg:mx-0">
            Kelola distribusi buku Cambridge, lacak inventaris fisik tiap cabang, dan transfer antar sekolah secara real-time.
          </p>
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2 text-xs text-[#65676B] font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#31A24C]"></span> 4 Kampus Al Wildan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1877F2]"></span> Kurikulum Cambridge
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Barcode & Fisik
            </span>
          </div>
        </div>

        {/* Facebook-style Auth Card */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="bg-white border border-[#CED0D4] shadow-xl rounded-2xl p-6 sm:p-7">
            <form onSubmit={handleLogin} className="space-y-3.5">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg">
                  {errorMsg}
                </div>
              )}

              <div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email atau nama akun"
                  className="w-full px-4 py-3 text-sm bg-white border border-[#CED0D4] rounded-lg focus:outline-none focus:border-[#1877F2] focus:ring-2 focus:ring-[#1877F2]/20 text-[#050505] placeholder-[#8A8D91] transition-all"
                />
              </div>

              <div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kata sandi"
                  className="w-full px-4 py-3 text-sm bg-white border border-[#CED0D4] rounded-lg focus:outline-none focus:border-[#1877F2] focus:ring-2 focus:ring-[#1877F2]/20 text-[#050505] placeholder-[#8A8D91] transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#1877F2] hover:bg-[#166FE5] active:bg-[#0E5ECE] text-white py-3 rounded-lg text-base font-bold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Masuk ke Sistem <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {onNavigateToPublicPortal && (
                <button
                  type="button"
                  onClick={onNavigateToPublicPortal}
                  className="w-full mt-2 py-2.5 px-4 bg-[#F0F2F5] hover:bg-[#E4E6EB] text-[#050505] rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>&larr; Buka Portal Orang Tua (Pemesanan & Retur)</span>
                </button>
              )}
            </form>

            {/* Quick Demo Access Switcher */}
            <div className="mt-6 pt-5 border-t border-[#E4E6EB]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#65676B] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#1877F2]" /> Akses Demo Cepat
                </span>
                <button
                  type="button"
                  onClick={handleSeedDemo}
                  className="text-xs font-semibold text-[#1877F2] hover:underline"
                >
                  Seed Cambridge Demo
                </button>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemo("admin.pusat@alwildan.sch.id")}
                  className="w-full text-left p-2.5 rounded-xl border border-[#E4E6EB] hover:border-[#1877F2] hover:bg-[#E7F3FF]/40 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-full bg-[#E7F3FF] text-[#1877F2]">
                      <Shield className="w-4 h-4 text-[#1877F2]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#050505]">Central Admin (HQ Pusat)</div>
                      <div className="text-[11px] text-[#65676B]">admin.pusat@alwildan.sch.id</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-[#F0F2F5] px-2 py-0.5 rounded-full text-[#050505] group-hover:bg-[#1877F2] group-hover:text-white transition-colors">
                    Al Wildan 1
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemo("admin.cabang2@alwildan.sch.id")}
                  className="w-full text-left p-2.5 rounded-xl border border-[#E4E6EB] hover:border-[#1877F2] hover:bg-[#E7F3FF]/40 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-full bg-[#E7F3FF] text-[#1877F2]">
                      <School className="w-4 h-4 text-[#1877F2]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#050505]">Branch Admin 2</div>
                      <div className="text-[11px] text-[#65676B]">admin.cabang2@alwildan.sch.id</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-[#F0F2F5] px-2 py-0.5 rounded-full text-[#050505] group-hover:bg-[#1877F2] group-hover:text-white transition-colors">
                    Al Wildan 2
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemo("admin.cabang3@alwildan.sch.id")}
                  className="w-full text-left p-2.5 rounded-xl border border-[#E4E6EB] hover:border-[#1877F2] hover:bg-[#E7F3FF]/40 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-full bg-[#E7F3FF] text-[#1877F2]">
                      <School className="w-4 h-4 text-[#1877F2]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#050505]">Branch Admin 3</div>
                      <div className="text-[11px] text-[#65676B]">admin.cabang3@alwildan.sch.id</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-[#F0F2F5] px-2 py-0.5 rounded-full text-[#050505] group-hover:bg-[#1877F2] group-hover:text-white transition-colors">
                    Al Wildan 3
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-[#65676B] mt-4">
            Password demo: <code className="bg-[#E4E6EB] px-2 py-0.5 rounded-md font-semibold text-[#050505]">password123</code>
          </div>
        </div>
      </div>
    </div>
  );
}
