import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

interface UserProfilePopoverProps {
  children: React.ReactNode;
}

export default function UserProfilePopover({ children }: UserProfilePopoverProps) {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const config = useAuthStore((s) => s.config);
  const logout = useAuthStore((s) => s.logout);

  const show = () => {
    clearTimeout(timerRef.current);
    setVisible(true);
  };

  const hide = () => {
    timerRef.current = setTimeout(() => setVisible(false), 150);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const userName = config?.externalUserId ?? '--';

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}

      {visible && (
        <div
          className="absolute right-0 top-full mt-2 z-50"
          style={{ width: 240 }}
        >
          <div
            className="rounded-2xl bg-white flex flex-col gap-2 py-0 px-2"
            style={{ boxShadow: '0px 6px 16px 0px rgba(0,0,0,0.08)' }}
          >
            {/* 用户信息区 */}
            <div className="rounded-xl bg-[#EDEEF680] px-2 py-2 relative mt-2">
              <div className="flex items-center gap-3 px-2">
                <img
                  src="https://img.alicdn.com/imgextra/i1/6000000005415/O1CN01P8mrP61ps7pkYICKe_!!6000000005415-2-gg_dtc.png"
                  alt="avatar"
                  className="w-10 h-10 rounded-full shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-black leading-[22px] truncate">
                    {userName}
                  </span>
                  <span className="text-xs text-black/60 leading-5 truncate">
                    {config?.externalUserId ?? '--'}
                  </span>
                </div>
              </div>
              {/* 设置图标 */}
              <img
                src="https://img.alicdn.com/imgextra/i4/6000000000789/O1CN01CddJdw1HhPdL2yVFa_!!6000000000789-2-gg_dtc.png"
                alt="settings"
                className="w-8 h-8 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer hover:opacity-70 transition"
              />
            </div>

            {/* 分割线 */}
            <div className="px-2">
              <div className="h-px bg-[#2F3A801A]" />
            </div>

            {/* 菜单列表 */}
            <div className="flex flex-col rounded-xl pb-2">
              <MenuItem
                iconSrc="https://img.alicdn.com/imgextra/i1/6000000000195/O1CN01wm36kH1DJMMwwyNSW_!!6000000000195-2-gg_dtc.png"
                label="用户反馈"
              />
              <MenuItem
                iconSrc="https://img.alicdn.com/imgextra/i3/6000000004996/O1CN01HmaoS11mmDskkjekC_!!6000000004996-2-gg_dtc.png"
                label="Crew交流群"
              />
              <MenuItem
                iconSrc="https://img.alicdn.com/imgextra/i4/6000000000174/O1CN01NVnol11D9k3LONG9U_!!6000000000174-2-gg_dtc.png"
                label="帮助中心"
              />
              <MenuItem
                iconSrc="https://img.alicdn.com/imgextra/i2/6000000008066/O1CN01AWi4R829SHnuZvjeI_!!6000000008066-2-gg_dtc.png"
                label="退出登录"
                onClick={logout}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  iconSrc,
  label,
  onClick,
}: {
  iconSrc: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl flex items-center gap-2 px-2 h-[38px] hover:bg-[#EDEEF680] transition text-left w-full"
    >
      <img src={iconSrc} alt={label} className="w-4 h-4 shrink-0" />
      <span className="text-sm text-black leading-[22px]">{label}</span>
    </button>
  );
}
