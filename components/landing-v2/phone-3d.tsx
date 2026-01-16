"use client";

/**
 * Ultra-Realistic 3D iPhone 15 Pro Mockup
 * Photorealistic details with subtle floating animation
 */

import { motion } from "framer-motion";
import { Mic, PhoneOff, Speaker } from "lucide-react";

export function Phone3D() {
  return (
    <div
      className="relative"
      style={{ perspective: "1500px" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute -inset-20 opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.4) 0%, rgba(34,211,238,0.2) 40%, transparent 70%)',
          filter: 'blur(60px)',
          transform: 'translateY(40px)',
        }}
      />

      {/* Floor reflection */}
      <div
        className="absolute bottom-[-180px] left-1/2 -translate-x-1/2 w-[350px] h-[200px] opacity-20"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.1), transparent)',
          filter: 'blur(20px)',
          transform: 'rotateX(80deg)',
        }}
      />

      {/* Phone container */}
      <motion.div
        initial={{ opacity: 0, y: 60, rotateX: 10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="animate-float"
        style={{
          transformStyle: "preserve-3d",
          transform: "rotateY(-14deg) rotateX(2deg) rotateZ(0.5deg)",
        }}
      >
        {/* iPhone 15 Pro Frame - Natural Titanium */}
        <div
          className="relative w-[294px] h-[602px] rounded-[56px]"
          style={{
            background: `
              linear-gradient(145deg,
                #4a4a4c 0%,
                #3a3a3c 15%,
                #2c2c2e 40%,
                #1c1c1e 60%,
                #2a2a2c 85%,
                #3a3a3c 100%
              )
            `,
            boxShadow: `
              0 80px 160px -40px rgba(0, 0, 0, 0.8),
              0 40px 80px -20px rgba(0, 0, 0, 0.6),
              -30px 30px 60px -10px rgba(0, 0, 0, 0.5),
              inset 0 1px 0 rgba(255, 255, 255, 0.15),
              inset 0 -1px 0 rgba(0, 0, 0, 0.3),
              inset 1px 0 0 rgba(255, 255, 255, 0.05),
              inset -1px 0 0 rgba(0, 0, 0, 0.2)
            `,
          }}
        >
          {/* Titanium brushed texture overlay */}
          <div
            className="absolute inset-0 rounded-[56px] opacity-30 pointer-events-none"
            style={{
              background: `repeating-linear-gradient(
                90deg,
                transparent,
                transparent 1px,
                rgba(255,255,255,0.03) 1px,
                rgba(255,255,255,0.03) 2px
              )`,
            }}
          />

          {/* Left edge chamfer highlight */}
          <div
            className="absolute left-0 top-[70px] bottom-[70px] w-[3px] rounded-l-full"
            style={{
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 30%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.1) 70%, rgba(255,255,255,0.3) 100%)',
            }}
          />

          {/* Right edge shadow */}
          <div
            className="absolute right-0 top-[70px] bottom-[70px] w-[3px] rounded-r-full"
            style={{
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.1) 100%)',
            }}
          />

          {/* Top edge subtle highlight */}
          <div
            className="absolute top-0 left-[70px] right-[70px] h-[2px]"
            style={{
              background: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.15) 70%, transparent 100%)',
              borderRadius: '2px',
            }}
          />

          {/* Bottom edge shadow */}
          <div
            className="absolute bottom-0 left-[70px] right-[70px] h-[2px]"
            style={{
              background: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.2) 70%, transparent 100%)',
              borderRadius: '2px',
            }}
          />

          {/* Inner bezel - ceramic shield glass edge */}
          <div
            className="absolute inset-[3px] rounded-[53px]"
            style={{
              background: '#000000',
              boxShadow: `
                inset 0 0 0 1px rgba(255,255,255,0.05),
                inset 0 2px 8px rgba(0,0,0,0.9)
              `,
            }}
          />

          {/* Screen */}
          <div
            className="absolute inset-[4px] rounded-[52px] overflow-hidden"
            style={{
              background: '#000000',
            }}
          >
            {/* OLED deep blacks with subtle gradient */}
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at 50% 30%, #0a0a0a 0%, #000000 60%)',
              }}
            />

            {/* Screen glass reflections */}
            <div
              className="absolute inset-0 pointer-events-none z-30"
              style={{
                background: `
                  linear-gradient(
                    125deg,
                    rgba(255,255,255,0.1) 0%,
                    rgba(255,255,255,0.05) 10%,
                    transparent 25%,
                    transparent 75%,
                    rgba(255,255,255,0.02) 90%,
                    rgba(255,255,255,0.05) 100%
                  )
                `,
                borderRadius: '52px',
              }}
            />

            {/* Dynamic Island */}
            <div
              className="absolute top-[12px] left-1/2 -translate-x-1/2 w-[126px] h-[37px] bg-black rounded-[20px] z-40"
              style={{
                boxShadow: `
                  inset 0 0 0 1px rgba(255,255,255,0.05),
                  inset 0 2px 4px rgba(0,0,0,0.8),
                  0 1px 2px rgba(0,0,0,0.5)
                `,
              }}
            >
              {/* Front camera */}
              <div
                className="absolute left-[20px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] rounded-full"
                style={{
                  background: 'radial-gradient(circle at 30% 30%, #1a1a2e 0%, #0a0a12 60%, #000 100%)',
                  boxShadow: `
                    inset 0 1px 2px rgba(0,0,0,0.8),
                    inset 0 0 0 1px rgba(255,255,255,0.1),
                    0 0 0 2px rgba(30,30,40,0.8)
                  `,
                }}
              >
                {/* Lens reflection */}
                <div
                  className="absolute top-[2px] left-[2px] w-[4px] h-[4px] rounded-full"
                  style={{
                    background: 'radial-gradient(circle, rgba(100,150,255,0.4) 0%, transparent 70%)',
                  }}
                />
              </div>

              {/* Face ID sensors (subtle dots) */}
              <div className="absolute right-[24px] top-1/2 -translate-y-1/2 flex items-center gap-[6px]">
                <div className="w-[6px] h-[6px] rounded-full bg-[#1a1a1a]" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)' }} />
                <div className="w-[8px] h-[8px] rounded-full bg-green-500 animate-pulse" style={{ boxShadow: '0 0 8px rgba(34,197,94,0.6)' }} />
              </div>
            </div>

            {/* Status bar */}
            <div className="absolute top-[14px] left-[30px] right-[30px] flex justify-between items-center z-20 text-white text-[13px] font-medium">
              <span className="opacity-90">9:41</span>
              <div className="flex items-center gap-1.5 opacity-90">
                <svg className="w-[18px] h-[12px]" viewBox="0 0 18 12" fill="currentColor">
                  <path d="M1 3.5C1 2.67 1.67 2 2.5 2h9c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5h-9C1.67 10 1 9.33 1 8.5v-5zM15 4v4c.83 0 1.5-.45 1.5-1v-2c0-.55-.67-1-1.5-1z"/>
                </svg>
              </div>
            </div>

            {/* Call UI Content */}
            <div className="relative h-full flex flex-col items-center justify-center px-6 pt-16 pb-8 z-10">
              {/* Caller Avatar */}
              <div className="text-center mb-4">
                <div className="relative">
                  <div
                    className="w-[100px] h-[100px] rounded-full bg-gradient-to-br from-purple-500 via-violet-500 to-cyan-500 flex items-center justify-center mx-auto"
                    style={{
                      boxShadow: `
                        0 15px 50px rgba(139, 92, 246, 0.5),
                        0 5px 20px rgba(139, 92, 246, 0.3),
                        inset 0 1px 0 rgba(255,255,255,0.3)
                      `,
                    }}
                  >
                    <span
                      className="text-5xl font-bold text-white"
                      style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
                    >
                      K
                    </span>
                  </div>
                  {/* Avatar ring animation */}
                  <div
                    className="absolute inset-[-4px] rounded-full border-2 border-purple-500/30 animate-ping"
                    style={{ animationDuration: '2s' }}
                  />
                </div>
                <h3 className="text-white text-[26px] font-semibold tracking-tight mt-4">Koya</h3>
                <p className="text-zinc-500 text-[15px] mt-0.5">AI Receptionist</p>
              </div>

              {/* Call timer */}
              <div className="flex items-center gap-2 mb-5">
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-500 animate-ping opacity-75" />
                </div>
                <span className="text-green-400 text-[15px] font-medium tracking-wide">0:12</span>
              </div>

              {/* Audio visualizer */}
              <div className="flex items-end justify-center gap-[4px] mb-5 h-[44px]">
                {[1.5, 2.5, 4, 6, 8, 9, 8, 6, 4, 2.5, 1.5].map((height, i) => (
                  <div
                    key={i}
                    className="w-[5px] rounded-full"
                    style={{
                      height: `${height * 4}px`,
                      background: `linear-gradient(to top, #8b5cf6, #06b6d4)`,
                      animation: 'waveform 0.8s ease-in-out infinite',
                      animationDelay: `${i * 0.07}s`,
                      boxShadow: '0 0 10px rgba(139,92,246,0.3)',
                    }}
                  />
                ))}
              </div>

              {/* Speech bubble */}
              <div
                className="rounded-[20px] px-5 py-4 max-w-[230px] mb-3"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: `
                    0 8px 32px rgba(0,0,0,0.3),
                    inset 0 1px 0 rgba(255,255,255,0.1)
                  `,
                }}
              >
                <p className="text-white text-[15px] leading-[1.5]">
                  &quot;Hi! Thanks for calling. How can I help you today?&quot;
                </p>
              </div>

              {/* Call controls */}
              <div className="absolute bottom-20 left-0 right-0 flex items-center justify-center gap-4">
                {/* Mute button */}
                <button
                  className="w-[64px] h-[64px] rounded-full flex items-center justify-center transition-transform active:scale-95"
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: `
                      0 4px 20px rgba(0,0,0,0.4),
                      inset 0 1px 0 rgba(255,255,255,0.15),
                      inset 0 -1px 0 rgba(0,0,0,0.2)
                    `,
                  }}
                >
                  <Mic className="w-7 h-7 text-white" />
                </button>

                {/* End call button */}
                <button
                  className="w-[76px] h-[76px] rounded-full flex items-center justify-center transition-transform active:scale-95"
                  style={{
                    background: 'linear-gradient(180deg, #ff453a 0%, #d70015 100%)',
                    boxShadow: `
                      0 8px 32px rgba(255, 69, 58, 0.5),
                      0 4px 16px rgba(255, 69, 58, 0.3),
                      inset 0 1px 0 rgba(255,255,255,0.25),
                      inset 0 -2px 0 rgba(0,0,0,0.2)
                    `,
                  }}
                >
                  <PhoneOff className="w-8 h-8 text-white" />
                </button>

                {/* Speaker button */}
                <button
                  className="w-[64px] h-[64px] rounded-full flex items-center justify-center transition-transform active:scale-95"
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: `
                      0 4px 20px rgba(0,0,0,0.4),
                      inset 0 1px 0 rgba(255,255,255,0.15),
                      inset 0 -1px 0 rgba(0,0,0,0.2)
                    `,
                  }}
                >
                  <Speaker className="w-7 h-7 text-white" />
                </button>
              </div>

              {/* Home indicator */}
              <div
                className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[134px] h-[5px] rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.35)',
                }}
              />
            </div>
          </div>

          {/* Physical buttons with realistic depth */}
          {/* Action button (top left) */}
          <div
            className="absolute -left-[2.5px] top-[108px] w-[4px] h-[34px] rounded-l-[2px]"
            style={{
              background: 'linear-gradient(90deg, #2a2a2c 0%, #3a3a3c 50%, #2c2c2e 100%)',
              boxShadow: '-3px 0 6px rgba(0,0,0,0.5), inset 1px 0 0 rgba(255,255,255,0.1)',
            }}
          />

          {/* Volume up */}
          <div
            className="absolute -left-[2.5px] top-[165px] w-[4px] h-[64px] rounded-l-[2px]"
            style={{
              background: 'linear-gradient(90deg, #2a2a2c 0%, #3a3a3c 50%, #2c2c2e 100%)',
              boxShadow: '-3px 0 6px rgba(0,0,0,0.5), inset 1px 0 0 rgba(255,255,255,0.1)',
            }}
          />

          {/* Volume down */}
          <div
            className="absolute -left-[2.5px] top-[244px] w-[4px] h-[64px] rounded-l-[2px]"
            style={{
              background: 'linear-gradient(90deg, #2a2a2c 0%, #3a3a3c 50%, #2c2c2e 100%)',
              boxShadow: '-3px 0 6px rgba(0,0,0,0.5), inset 1px 0 0 rgba(255,255,255,0.1)',
            }}
          />

          {/* Power/Side button */}
          <div
            className="absolute -right-[2.5px] top-[185px] w-[4px] h-[100px] rounded-r-[2px]"
            style={{
              background: 'linear-gradient(90deg, #2c2c2e 0%, #3a3a3c 50%, #2a2a2c 100%)',
              boxShadow: '3px 0 6px rgba(0,0,0,0.5), inset -1px 0 0 rgba(255,255,255,0.05)',
            }}
          />

          {/* SIM tray */}
          <div
            className="absolute -right-[1px] top-[340px] w-[2px] h-[30px] rounded-r-sm"
            style={{
              background: '#2a2a2c',
              boxShadow: '2px 0 4px rgba(0,0,0,0.3)',
            }}
          />
        </div>
      </motion.div>

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: rotateY(-14deg) rotateX(2deg) rotateZ(0.5deg) translateY(0px);
          }
          50% {
            transform: rotateY(-14deg) rotateX(2deg) rotateZ(0.5deg) translateY(-14px);
          }
        }
        @keyframes waveform {
          0%, 100% {
            transform: scaleY(0.5);
            opacity: 0.7;
          }
          50% {
            transform: scaleY(1);
            opacity: 1;
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
