import { useState } from "react";
import { signIn } from "../lib/auth-client";
import { Shield, Sparkles, School, ArrowRight, Loader2 } from "lucide-react";

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
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
    <div className="min-h-screen bg-[#FBFBFA] flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Editorial Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A1A1A] text-white text-[11px] font-mono mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            AL WILDAN LOGISTICS SYSTEM
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#1A1A1A] tracking-tight">
            School Book Inventory
          </h1>
          <p className="text-xs text-[#737373] mt-1 font-mono">
            Cambridge Curriculum Multi-Branch Distribution
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-[#E5E5E0] shadow-sm rounded-lg p-6 mb-6">
          <form onSubmit={handleLogin} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-mono rounded">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-mono font-medium text-[#404040] mb-1">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@alwildan.sch.id"
                className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded focus:outline-none focus:border-[#1A1A1A] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-[#404040] mb-1">
                PASSWORD
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm border border-[#D4D4D0] rounded focus:outline-none focus:border-[#1A1A1A] font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1A1A1A] hover:bg-[#333] text-white py-2.5 rounded text-xs font-mono font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="mt-8 pt-6 border-t border-[#F0F0EC]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono font-semibold text-[#737373] tracking-wider uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Quick Demo Access
              </span>
              <button
                type="button"
                onClick={handleSeedDemo}
                className="text-[10px] font-mono text-[#0066CC] hover:underline"
              >
                (Re-seed Cambridge Demo)
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleQuickDemo("admin.pusat@alwildan.sch.id")}
                className="w-full text-left p-2.5 rounded border border-[#E5E5E0] hover:border-[#1A1A1A] hover:bg-[#FBFBFA] transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-neutral-100 text-[#1A1A1A]">
                    <Shield className="w-3.5 h-3.5 text-amber-700" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#1A1A1A]">Central Admin (HQ Pusat)</div>
                    <div className="text-[10px] text-[#737373] font-mono">admin.pusat@alwildan.sch.id</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-neutral-100 px-1.5 py-0.5 rounded text-[#525252] group-hover:bg-[#1A1A1A] group-hover:text-white transition-colors">
                  Al Wildan 1
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("admin.cabang2@alwildan.sch.id")}
                className="w-full text-left p-2.5 rounded border border-[#E5E5E0] hover:border-[#1A1A1A] hover:bg-[#FBFBFA] transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-neutral-100 text-[#1A1A1A]">
                    <School className="w-3.5 h-3.5 text-blue-700" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#1A1A1A]">Branch Admin 2</div>
                    <div className="text-[10px] text-[#737373] font-mono">admin.cabang2@alwildan.sch.id</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-neutral-100 px-1.5 py-0.5 rounded text-[#525252] group-hover:bg-[#1A1A1A] group-hover:text-white transition-colors">
                  Al Wildan 2
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("admin.cabang3@alwildan.sch.id")}
                className="w-full text-left p-2.5 rounded border border-[#E5E5E0] hover:border-[#1A1A1A] hover:bg-[#FBFBFA] transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-neutral-100 text-[#1A1A1A]">
                    <School className="w-3.5 h-3.5 text-emerald-700" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#1A1A1A]">Branch Admin 3</div>
                    <div className="text-[10px] text-[#737373] font-mono">admin.cabang3@alwildan.sch.id</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-neutral-100 px-1.5 py-0.5 rounded text-[#525252] group-hover:bg-[#1A1A1A] group-hover:text-white transition-colors">
                  Al Wildan 3
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] font-mono text-[#737373]">
          Password default demo: <code className="bg-[#EBEBE6] px-1.5 py-0.5 rounded">password123</code>
        </div>
      </div>
    </div>
  );
}
