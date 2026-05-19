import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuthStore();
  const [inviteCode, setInviteCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = inviteCode.trim();
    if (!code) return;
    login(code);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top navbar */}
      <header className="h-14 border-b border-[#D5D8E6] flex items-center justify-between px-4 shrink-0">
        <div className="flex flex-col justify-center">
          <div className="flex items-center">
            <img
              src="https://img.alicdn.com/imgextra/i3/6000000002738/O1CN01LALgaE1W63Z9D7jhW_!!6000000002738-2-gg_dtc.png"
              alt="Logo"
              className="w-[22px] h-5"
            />
            <img
              src="https://img.alicdn.com/imgextra/i3/6000000006695/O1CN01vUcD4Y1zKMnTDHTQJ_!!6000000006695-2-gg_dtc.png"
              alt="JVS Crew"
              className="w-[72px] h-[11px] ml-1"
            />
          </div>
          <span className="text-sm text-black/40 mt-0.5">用户试用端</span>
        </div>
      </header>

      {/* Main area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[960px] pointer-events-none">
          <img
            src="https://img.alicdn.com/imgextra/i4/6000000001396/O1CN01nv0e9f1MBQ2ro6Sv5_!!6000000001396-2-gg_dtc.png"
            alt=""
            className="w-full opacity-60"
          />
        </div>

        {/* Login card */}
        <div className="relative z-10 w-[436px] bg-white rounded-3xl shadow-[inset_0_0_0_1px_#D5D8E6] flex flex-col justify-between items-center py-8 min-h-[370px]">
          <form onSubmit={handleSubmit} className="w-full px-8 flex flex-col gap-14">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-medium text-black">请输入您的用户ID</h2>
            </div>

            <div className="border-b-[1px] border-[#3550FF] pb-0">
              <div className="flex items-center h-[54px]">
                <div className="w-0.5 h-[22px] bg-[#3550FF] shrink-0" />
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => { setInviteCode(e.target.value); clearError(); }}
                  placeholder="请输入您的用户ID"
                  className="flex-1 ml-2 text-sm outline-none bg-transparent placeholder:text-black/30"
                  autoFocus
                />
              </div>
            </div>
          </form>

          {error && (
            <div className="mx-8 mt-4 w-[calc(100%-64px)] bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <div className="w-full px-8 flex justify-end items-center mt-auto pt-6">
            <button
              type="submit"
              disabled={isLoading || !inviteCode.trim()}
              onClick={handleSubmit}
              className="w-[200px] h-14 rounded-full bg-[#3550FF] text-white text-sm font-medium
                         hover:bg-[#2a42e0] disabled:opacity-50 disabled:cursor-not-allowed
                         transition flex items-center justify-center"
            >
              {isLoading ? (
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                '确认并登录'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
