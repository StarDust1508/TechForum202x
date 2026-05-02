import { motion } from 'motion/react';
import { ArrowLeft, User, MapPin, Building, ShieldCheck, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Ticket() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 bg-surface flex flex-col px-5 pb-10">
      {/* Header */}
      <header className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-2xl bg-card border border-card-border active:scale-90 transition-all"
        >
          <ArrowLeft className="w-6 h-6 text-primary" />
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Мой билет</h1>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto scrollbar-hide pt-4">
        {/* Simplified Ticket Card */}
        <div className="bg-card border border-card-border rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/60">
          <div className="p-10 space-y-12">
            {/* QR Code Container */}
            <div className="flex flex-col items-center gap-6">
              <div className="bg-white p-5 rounded-[2.5rem] border-[6px] border-[#1a1e2a] shadow-xl">
                <div className="w-56 h-56 relative overflow-hidden">
                  {/* SVG QR Code Simulation */}
                  <svg viewBox="0 0 100 100" className="w-full h-full text-[#13161f]">
                    <rect x="0" y="0" width="100" height="100" fill="white" />
                    <rect x="10" y="10" width="25" height="25" fill="currentColor" rx="4" />
                    <rect x="15" y="15" width="15" height="15" fill="white" rx="2" />
                    <rect x="18" y="18" width="9" height="9" fill="currentColor" rx="1" />
                    
                    <rect x="65" y="10" width="25" height="25" fill="currentColor" rx="4" />
                    <rect x="70" y="15" width="15" height="15" fill="white" rx="2" />
                    <rect x="73" y="18" width="9" height="9" fill="currentColor" rx="1" />
                    
                    <rect x="10" y="65" width="25" height="25" fill="currentColor" rx="4" />
                    <rect x="15" y="70" width="15" height="15" fill="white" rx="2" />
                    <rect x="18" y="73" width="9" height="9" fill="currentColor" rx="1" />
                    
                    {/* BUG_FIX_CONTEXT: v1 рендерил QR через Math.random() в каждом
                        ререндере, из-за чего "QR" мигал и был не сканируемым. Заменено
                        на стабильный детерминированный паттерн на основе хэша индекса.
                        Реальный QR через qrcode-lib придёт в Этапе 3 (Quick Win #10). */}
                    {Array.from({ length: 60 }, (_, i) => {
                      const hash = (i * 2654435761) >>> 0;
                      const x = (hash % 80) + 10;
                      const y = ((hash >> 8) % 80) + 10;
                      const visible = (hash >> 16) % 10 > 2;
                      return (
                        <rect
                          key={i}
                          x={x}
                          y={y}
                          width="4"
                          height="4"
                          fill="currentColor"
                          rx="1"
                          opacity={visible ? 1 : 0}
                        />
                      );
                    })}
                  </svg>
                </div>
              </div>
              <p className="text-sm text-muted font-bold tracking-[0.5em] uppercase opacity-60">ТФ26 17762720</p>
            </div>

            {/* Name Only Section */}
            <div className="text-center space-y-2 py-6 border-t border-card-border/50">
              <p className="text-[10px] text-muted font-black uppercase tracking-[0.3em]">Владелец билета</p>
              <h2 className="text-xl font-black text-primary tracking-tight leading-tight px-4">
                Фидеев <br /> Ильяс Александрович
              </h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
