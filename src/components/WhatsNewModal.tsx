import React from 'react';
import { Sparkles, Pin, Layout, Sliders, AudioLines, Move, X, CheckCircle2 } from 'lucide-react';
import { LanguageCode } from '../locales/i18n';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
  language?: LanguageCode;
  accentColor?: string;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  isOpen,
  onClose,
  version,
  language = 'vi',
  accentColor = '#ff2a55',
}) => {
  if (!isOpen) return null;

  const isVi = language === 'vi';

  const features = [
    {
      icon: <Sparkles className="w-5 h-5 text-amber-400" />,
      tag: isVi ? 'Mới • Giao diện' : 'New • UI Animation',
      title: isVi ? 'Tìm kiếm cuộn kính lúp & Banner Crossfade điện ảnh' : 'Animated Search & Cinematic Banner Crossfade',
      desc: isVi
        ? 'Ô tìm kiếm thu nhỏ thành nút tròn thanh lịch, cuộn xoay kính lúp mượt mà khi mở rộng và thu gọn. Banner nghệ sĩ trên Trang chủ chuyển cảnh crossfade & Ken Burns zoom mượt mà, đẳng cấp.'
        : 'Sleek search pill smoothly rolls the magnifying glass when expanding or collapsing. The Home hero showcase features smooth cinematic crossfade transitions with subtle zoom.',
    },
    {
      icon: <Layout className="w-5 h-5 text-emerald-400" />,
      tag: isVi ? 'Thiết kế • Unslop' : 'Design • Minimal',
      title: isVi ? 'Phong cách Minimal & Modern chuẩn Unslop' : 'Clean Minimal & Modern Aesthetic',
      desc: isVi
        ? 'Loại bỏ gradient màu mè, tối giản hóa bố cục bảng điều khiển, đồng bộ giao diện Dark/Light mode và hỗ trợ song ngữ toàn diện cho Spy Jam, Hồ sơ và Cài đặt âm thanh.'
        : 'Clean matte surfaces without neon gradient bloat, full Dark/Light theme sync, and comprehensive bilingual support across Spy Jam, Profile, and Settings.',
    },
    {
      icon: <Sliders className="w-5 h-5 text-sky-400" />,
      tag: isVi ? 'Khám phá • Nhạc' : 'Discovery • Music',
      title: isVi ? 'Bộ lọc thể loại Top 10 gọn gàng & Smart DJ tối ưu' : 'Streamlined Top 10 Genres & Smart DJ',
      desc: isVi
        ? 'Thay thế thanh tag cồng kềnh bằng menu chọn thể loại 22 dòng nhạc phong phú. Nút phát bài nguyên bản Spotify và luồng phát Smart DJ theo thời gian chính xác.'
        : 'Replaced cluttered multi-row pill tags with an elegant dropdown supporting 22 genres, restored classic solid play buttons, and accurate time-of-day flow mixes.',
    },
    {
      icon: <Pin className="w-5 h-5 text-rose-400" />,
      tag: isVi ? 'Tiện ích' : 'Utility',
      title: isVi ? 'Thanh Mini Player nổi (Desktop Mini Bar)' : 'Floating Mini Player Bar',
      desc: isVi
        ? 'Thu nhỏ Spytify thành thanh phát nhạc mini siêu gọn (380x76px). Luôn nổi trên cùng (Always-on-Top), kéo rê tự do khắp màn hình, ẩn toàn bộ thanh window và phát nhạc liền mạch.'
        : 'Shrink Spytify directly into a compact floating mini player bar (380x76px). Always-on-Top, smoothly draggable, frameless, and seamless playback.',
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[#090a10] border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp text-white"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: `0 20px 60px rgba(0,0,0,0.9), 0 0 30px ${accentColor}20`,
        }}
      >
        {/* Header Banner */}
        <div 
          className="relative px-6 pt-6 pb-4 border-b border-white/10 flex items-start justify-between"
          style={{
            background: `radial-gradient(ellipse at top left, ${accentColor}20, transparent 70%)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-lg"
              style={{
                backgroundColor: `${accentColor}20`,
                borderColor: `${accentColor}50`,
                color: accentColor,
              }}
            >
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span 
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border"
                  style={{
                    backgroundColor: `${accentColor}25`,
                    color: accentColor,
                    borderColor: `${accentColor}60`,
                  }}
                >
                  {isVi ? 'Bản cập nhật mới' : "What's New"}
                </span>
                <span className="text-xs font-mono font-bold text-zinc-400">v{version}</span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white mt-0.5">
                {isVi ? `Có gì mới trong Spytify ${version}?` : `Welcome to Spytify ${version}`}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isVi ? 'Đóng' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Features Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-3.5 custom-scrollbar flex-1">
          {features.map((f, i) => (
            <div 
              key={i}
              className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 transition-all flex items-start gap-3.5 group"
            >
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 shrink-0 group-hover:scale-105 transition-transform">
                {f.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-xs font-bold text-white tracking-tight">{f.title}</h4>
                  <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-white/10 text-zinc-300">
                    {f.tag}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-white/10 bg-[#07070c] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isVi ? 'Đã cài đặt thành công' : 'Successfully Installed'}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 0 16px ${accentColor}40`,
            }}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            {isVi ? 'Bắt đầu trải nghiệm' : 'Got it, let’s go!'}
          </button>
        </div>
      </div>
    </div>
  );
};
