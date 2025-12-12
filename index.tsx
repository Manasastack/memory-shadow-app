
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// --- AUDIO ENGINE ---

class SoundEngine {
  ctx: AudioContext | null = null;
  enabled: boolean = false;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.enabled = true;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(type: 'hover' | 'click' | 'success' | 'alert' | 'open') {
    if (!this.enabled || !this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const now = this.ctx.currentTime;

    if (type === 'hover') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
      gain.gain.setValueAtTime(0.015, now); // Softer
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'open') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(400, now + 0.3);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.04, now + 0.1);
      gain.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  }
}

const sfx = new SoundEngine();

// --- TYPES & CONSTANTS ---

type ItemType = 'note' | 'task' | 'file' | 'module';

interface InteractionMetadata {
  lastInteraction: number;
  viewDuration: number;
  interactionCount: number;
}

interface MemoryItem {
  id: string;
  label: string;
  type: ItemType;
  meta: InteractionMetadata;
  strength: number;
  currentRetention: number;
}

interface Prediction {
  itemId: string;
  retention24h: number;
  status: 'stable' | 'at-risk' | 'critical';
}

const CRITICAL_THRESHOLD = 45;
const RISK_THRESHOLD = 75;
const TYPES: ItemType[] = ['note', 'task', 'file', 'module'];

// --- VISUAL COMPONENTS ---

const CosmicDust = ({ count = 40 }: { count?: number }) => {
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    // Generate static particles to avoid re-renders causing jumps
    const newParticles = Array.from({ length: count }).map((_, i) => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.3 + 0.1
    }));
    setParticles(newParticles);
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p, i) => (
        <div 
          key={i}
          className="particle bg-indigo-200 shadow-[0_0_5px_white]"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animation: `float-particle ${p.duration}s linear infinite`,
            animationDelay: `-${p.delay}s`
          }}
        />
      ))}
    </div>
  );
};

const ItemIcon = ({ type, className = "" }: { type: ItemType, className?: string }) => {
  const map: Record<ItemType, string> = {
    note: '🌿', 
    task: '⚡', 
    file: '💠', 
    module: '🪐' 
  };
  return <span className={`text-lg filter drop-shadow-md hover:brightness-125 transition-all duration-300 cursor-default ${className}`}>{map[type]}</span>;
};

const RetentionChart = ({ item }: { item: MemoryItem | null }) => {
  const width = 800;
  const height = 300;
  
  if (!item) return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden rounded-3xl bg-black/10 group">
       {/* Empty State Planet Visuals */}
       <div className="relative flex items-center justify-center">
          {/* Orbital Ring */}
          <div className="absolute w-40 h-40 rounded-full border border-indigo-400/20 shadow-[0_0_30px_rgba(129,140,248,0.1)] animate-orbit"></div>
          <div className="absolute w-56 h-56 rounded-full border border-fuchsia-400/10 animate-orbit" style={{animationDuration: '20s', animationDirection: 'reverse'}}></div>
          
          {/* Planet */}
          <div className="text-7xl opacity-80 filter drop-shadow-[0_0_30px_rgba(139,92,246,0.4)] relative z-10 animate-pulse" style={{animationDuration: '4s'}}>🪐</div>
       </div>
       
       <h3 className="text-white/70 font-medium tracking-[0.3em] text-[10px] uppercase mt-8 mb-2">Awaiting Target</h3>
       <p className="text-white/30 text-[10px] font-light tracking-wide">Select a memory node to visualize decay</p>
    </div>
  );

  const points = [];
  const now = Date.now();
  const hours = 72;
  
  for (let h = 0; h <= hours; h += 2) {
    const timeOffsetMinutes = h * 60;
    const timeSinceLastInteraction = (now - item.meta.lastInteraction) / (1000 * 60);
    const totalTime = timeSinceLastInteraction + timeOffsetMinutes;
    const r = Math.exp(-totalTime / (item.strength * 2.5));
    const y = height - (r * height * 0.7) - 40; 
    const x = (h / hours) * width;
    points.push(`${x},${y}`);
  }

  return (
    <div className="w-full h-full relative group animate-bounce-in">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="50%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(129, 140, 248, 0.15)" />
            <stop offset="100%" stopColor="rgba(244, 114, 182, 0)" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Breathing Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <line key={p} x1="0" y1={height * p} x2={width} y2={height * p} stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" className="animate-pulse" style={{animationDelay: `${p}s`}} />
        ))}

        <path 
          d={`M0,${height} ${points.map(p => `L${p}`).join(' ')} L${width},${height} Z`} 
          fill="url(#areaGradient)" 
          className="transition-all duration-700"
        />
        <path 
          d={`M${points.map((p, i) => (i === 0 ? 'M' : 'L') + p).join(' ')}`} 
          fill="none" 
          stroke="url(#lineGradient)" 
          strokeWidth="2.5" 
          filter="url(#glow)"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive Indicator */}
        <circle cx="0" cy={points[0].split(',')[1]} r="5" fill="#fff" className="animate-pulse shadow-[0_0_20px_white]" />
      </svg>
      
      <div className="absolute bottom-3 left-0 w-full flex justify-between text-[9px] text-white/20 uppercase tracking-[0.2em] px-2 font-medium">
        <span>Now</span>
        <span>+24h</span>
        <span>+48h</span>
        <span>+72h</span>
      </div>
    </div>
  );
};

const RiskGauge = ({ value, label }: { value: number, label: string }) => {
  let color = 'bg-emerald-400';
  let textColor = 'text-emerald-400';
  
  if (value < RISK_THRESHOLD) { color = 'bg-amber-400'; textColor = 'text-amber-400'; }
  if (value < CRITICAL_THRESHOLD) { color = 'bg-rose-400'; textColor = 'text-rose-400'; }

  return (
    <div className="flex flex-col gap-1.5 w-full group">
      <div className="flex justify-between items-end">
        <span className="text-[9px] uppercase tracking-wider text-white/40 font-medium group-hover:text-white/60 transition-colors">{label}</span>
        <span className={`text-[10px] font-bold ${textColor} font-mono tracking-wide`}>{value.toFixed(0)}%</span>
      </div>
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
        <div 
          className={`h-full ${color} transition-all duration-1000 ease-out shadow-[0_0_12px_currentColor] relative`} 
          style={{ width: `${value}%` }}
        >
            <div className="absolute top-0 left-0 w-full h-[1px] bg-white/30"></div>
        </div>
      </div>
    </div>
  );
};


// --- MAIN APP ---

const MemoryShadow = () => {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isSimulating, setIsSimulating] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);

  const initAudio = () => {
    if (!audioInitialized) {
      sfx.init();
      setAudioInitialized(true);
    }
  };

  const playHover = () => sfx.playTone('hover');
  
  // Real-time updates
  useEffect(() => {
    let interval: any;
    if (activeItemId) {
      interval = setInterval(() => {
        setItems(prev => prev.map(item => {
          if (item.id === activeItemId) {
            const newMeta = {
              ...item.meta,
              viewDuration: item.meta.viewDuration + 1,
              lastInteraction: Date.now(),
            };
            return {
              ...item,
              meta: newMeta,
              strength: newMeta.interactionCount * 25 + Math.pow(newMeta.viewDuration, 0.9) * 2 + 10,
              currentRetention: 100,
            };
          }
          return item;
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeItemId]);

  // Decay
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
      setItems(prev => prev.map(item => {
        if (item.id === activeItemId) return item; 
        return {
          ...item,
          currentRetention: calculateRetention(item.meta.lastInteraction, item.strength)
        };
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, [activeItemId]);

  const activeItem = useMemo(() => items.find(i => i.id === activeItemId) || null, [items, activeItemId]);

  const predictions = useMemo(() => {
    return items.map(item => {
      const now = Date.now();
      const timeSinceLast = (now - item.meta.lastInteraction) / (1000 * 60);
      const calcPred = (hours: number) => {
         const t = timeSinceLast + (hours * 60);
         return Math.max(0, Math.exp(-t / (item.strength * 2.5)) * 100);
      };
      const r24 = calcPred(24);
      let status: 'stable' | 'at-risk' | 'critical' = 'stable';
      if (r24 < CRITICAL_THRESHOLD) status = 'critical';
      else if (r24 < RISK_THRESHOLD) status = 'at-risk';

      return { itemId: item.id, retention24h: r24, status } as Prediction;
    }).sort((a, b) => a.retention24h - b.retention24h);
  }, [items, lastUpdate]);

  const handleCreate = () => {
    initAudio();
    sfx.playTone('click');
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const newItem: MemoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      label: `Node ${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      type,
      meta: { lastInteraction: Date.now(), viewDuration: 0, interactionCount: 1 },
      strength: 10,
      currentRetention: 100
    };
    setItems(prev => [newItem, ...prev]);
    setActiveItemId(newItem.id);
  };

  const handleSimulate = () => {
    initAudio();
    sfx.playTone('click');
    setIsSimulating(true);
    setTimeout(() => {
      const demoItems: MemoryItem[] = [];
      const now = Date.now();
      for (let i = 0; i < 6; i++) {
        const type = TYPES[Math.floor(Math.random() * TYPES.length)];
        const lastInteraction = now - (Math.random() * 48 * 60 * 60 * 1000 + 600000);
        const meta = {
          lastInteraction,
          viewDuration: Math.floor(Math.random() * 500) + 10,
          interactionCount: Math.floor(Math.random() * 20) + 1
        };
        const strength = meta.interactionCount * 25 + Math.pow(meta.viewDuration, 0.9) * 2 + 10;
        demoItems.push({
          id: Math.random().toString(36).substr(2, 9),
          label: `Subject ${Math.floor(Math.random() * 9000) + 1000}`,
          type,
          meta,
          strength,
          currentRetention: calculateRetention(lastInteraction, strength)
        });
      }
      setItems(demoItems);
      setIsSimulating(false);
      sfx.playTone('open');
    }, 800);
  };

  const handleSelect = (id: string) => {
    initAudio();
    sfx.playTone('open');
    if (activeItemId === id) setActiveItemId(null);
    else setActiveItemId(id);
  };

  const calculateRetention = (lastInteraction: number, strength: number): number => {
      const now = Date.now();
      const elapsedMinutes = (now - lastInteraction) / (1000 * 60);
      if (elapsedMinutes < 0) return 100;
      const retention = Math.exp(-elapsedMinutes / (strength * 2.5)); 
      return Math.max(0, Math.min(100, retention * 100));
  };

  return (
    <div className="flex w-full h-full text-slate-100 p-6 gap-6 max-w-[1800px] mx-auto fade-in font-light relative z-10" onClick={initAudio}>
      
      {/* BACKGROUND PARTICLES */}
      <CosmicDust />

      {/* --- LEFT SIDEBAR --- */}
      <aside className="w-[340px] flex flex-col gap-6 relative z-20">
        
        {/* Brand */}
        <div className="glass-layer-2 rounded-3xl p-6 flex items-center justify-between group cursor-default shadow-xl border-t border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-900 to-indigo-700 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.2)] text-2xl group-hover:scale-110 transition-transform duration-500 border border-white/10">
               🧠
            </div>
            <div>
              <h1 className="font-semibold text-lg tracking-tight leading-none text-white">MEMORY<br/><span className="font-extralight text-indigo-200/50 tracking-[0.2em] text-xs">SHADOW</span></h1>
            </div>
          </div>
          <div className={`w-1.5 h-1.5 rounded-full ${audioInitialized ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-rose-400'} animate-pulse`} title="Neural Link Active"></div>
        </div>

        {/* Actions */}
        <div className="glass-layer-3 rounded-3xl p-3 flex gap-3">
           <button 
             onClick={handleCreate}
             onMouseEnter={playHover}
             className="flex-1 rounded-2xl py-4 flex flex-col items-center justify-center gap-2 group hover:bg-white/5 active:scale-95 transition-all border border-transparent hover:border-white/5"
           >
             <span className="text-xl filter drop-shadow group-hover:scale-110 transition-transform duration-300">✨</span>
             <span className="text-[9px] uppercase tracking-widest font-bold text-white/50 group-hover:text-cyan-200">New Node</span>
           </button>
           <button 
             onClick={handleSimulate}
             onMouseEnter={playHover}
             disabled={isSimulating}
             className="flex-1 rounded-2xl py-4 flex flex-col items-center justify-center gap-2 group hover:bg-white/5 active:scale-95 transition-all border border-transparent hover:border-white/5"
           >
             <span className={`text-xl filter drop-shadow transition-transform duration-700 ${isSimulating ? 'animate-spin' : 'group-hover:rotate-180'}`}>🔮</span>
             <span className="text-[9px] uppercase tracking-widest font-bold text-white/50 group-hover:text-fuchsia-200">Simulate</span>
           </button>
        </div>

        {/* Item List */}
        <div className="flex-1 glass-layer-1 rounded-3xl p-1 flex flex-col overflow-hidden relative border border-white/5">
          <div className="p-4 pb-2 flex justify-between items-center">
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-bold flex items-center gap-2">
              <i className="fa-solid fa-satellite-dish text-[8px]"></i> Tracked
            </span>
            <span className="bg-white/5 border border-white/5 text-[9px] px-2 py-0.5 rounded-full text-white/40 font-mono">{items.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 p-3 scroll-smooth">
            {items.length === 0 && (
               <div className="h-full flex flex-col items-center justify-center text-white/20 pb-10">
                 <div className="text-3xl mb-4 grayscale opacity-30 animate-pulse">👻</div>
                 <p className="text-[10px] font-light tracking-widest uppercase">No Signals Detected</p>
               </div>
            )}
            {items.map(item => (
              <div 
                key={item.id}
                onClick={() => handleSelect(item.id)}
                onMouseEnter={playHover}
                className={`
                  p-3 rounded-xl cursor-pointer border transition-all duration-300 group relative overflow-hidden
                  ${activeItemId === item.id 
                    ? 'bg-gradient-to-r from-white/10 to-transparent border-white/10 shadow-lg translate-x-1' 
                    : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5 hover:translate-x-0.5'}
                `}
              >
                {activeItemId === item.id && (
                  <div className="absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-cyan-400 via-indigo-400 to-fuchsia-400 shadow-[0_0_15px_rgba(56,189,248,0.5)]"></div>
                )}
                
                <div className="flex items-center justify-between mb-2 relative z-10">
                   <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs bg-white/5 border border-white/5`}>
                        <ItemIcon type={item.type} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors">{item.label}</span>
                        <span className="text-[8px] text-white/20 font-mono tracking-wider">{item.id}</span>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className={`text-[10px] font-bold drop-shadow-sm font-mono ${item.currentRetention < 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {item.currentRetention.toFixed(0)}%
                      </div>
                   </div>
                </div>
                {/* Micro Retention Bar */}
                <div className="w-full h-[2px] bg-black/30 rounded-full overflow-hidden">
                   <div 
                     className={`h-full transition-all duration-1000 ${item.currentRetention < 50 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                     style={{ width: `${item.currentRetention}%` }}
                   ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* --- MAIN STAGE --- */}
      <main className="flex-1 flex flex-col gap-6 min-w-0 relative z-20">
        
        {/* Detail Panel */}
        <section className="flex-1 glass-layer-2 rounded-3xl p-8 relative overflow-hidden flex flex-col shadow-2xl transition-all duration-500 border border-white/5">
           
           {/* Header */}
           <div className="flex justify-between items-start mb-6 z-10 min-h-[50px]">
             <div>
                <h2 className="text-2xl font-light text-white tracking-tight flex items-center gap-3 animate-bounce-in">
                  {activeItem ? activeItem.label : 'Neural Dashboard'}
                </h2>
                <div className="flex items-center gap-2 mt-2 h-6">
                    {activeItem && <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>}
                    <p className="text-white/30 text-xs font-light tracking-wide">
                    {activeItem ? `Last synced: ${(Math.max(0, (Date.now() - activeItem.meta.lastInteraction)/1000/60)).toFixed(0)}m ago` : 'System Ready'}
                    </p>
                </div>
             </div>
             
             {activeItem && (
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 backdrop-blur-md flex flex-col items-end animate-bounce-in">
                   <span className="text-[8px] uppercase tracking-wider text-white/30">Data Integrity</span>
                   <span className={`font-medium text-sm flex items-center gap-1 ${activeItem.currentRetention > 80 ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {activeItem.currentRetention.toFixed(1)}%
                   </span>
                </div>
             )}
           </div>

           {/* Chart Area */}
           <div className="flex-1 w-full min-h-[300px] z-10 rounded-2xl overflow-hidden border border-white/5 bg-black/20 backdrop-blur-sm relative shadow-inner">
             <RetentionChart item={activeItem} />
           </div>

           {/* Insight Tiles */}
           {activeItem && (
             <div className="grid grid-cols-3 gap-4 mt-6 z-10">
                <div className="glass-layer-3 p-4 rounded-xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                  <div className="text-[8px] text-white/30 uppercase tracking-widest font-bold mb-1">Est. Stability</div>
                  <div className="text-xl text-indigo-200 font-light">{(activeItem.strength/60).toFixed(1)} <span className="text-[10px] text-white/20 font-normal">hrs</span></div>
                  <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-indigo-500 to-transparent opacity-50"></div>
                </div>
                
                <div className="glass-layer-3 p-4 rounded-xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                  <div className="text-[8px] text-white/30 uppercase tracking-widest font-bold mb-1">Depth</div>
                  <div className="text-xl text-fuchsia-200 font-light">{activeItem.meta.interactionCount} <span className="text-[10px] text-white/20 font-normal">cycles</span></div>
                  <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-fuchsia-500 to-transparent opacity-50"></div>
                </div>

                <div className="glass-layer-3 p-4 rounded-xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                  <div className="text-[8px] text-white/30 uppercase tracking-widest font-bold mb-1">Focus</div>
                  <div className="text-xl text-cyan-200 font-light">{activeItem.meta.viewDuration} <span className="text-[10px] text-white/20 font-normal">s</span></div>
                  <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-cyan-500 to-transparent opacity-50"></div>
                </div>
             </div>
           )}
        </section>

        {/* Footer */}
        <footer className="h-12 glass-layer-2 rounded-full flex items-center justify-between px-6 mx-8 mb-2 border border-white/5">
           <div className="flex gap-6 items-center">
              <div className="flex items-center gap-3">
                 <div className="relative">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full relative z-10"></div>
                    <div className="absolute inset-[-4px] bg-emerald-500 rounded-full animate-breathe"></div>
                 </div>
                 <span className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-bold">Online</span>
              </div>
              <div className="h-3 w-[1px] bg-white/10"></div>
              <div className="text-[9px] text-white/30 font-mono">
                 v2.0.4 <span className="text-white/10 ml-2">Beta</span>
              </div>
           </div>
        </footer>

      </main>

      {/* --- RIGHT SIDEBAR: MATRIX --- */}
      <aside className="w-[300px] glass-layer-1 rounded-3xl flex flex-col relative overflow-hidden shadow-2xl z-20 border border-white/5">
        
        <div className="p-5 z-10 backdrop-blur-md">
           <h3 className="text-xs font-bold text-white/80 uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
             <i className="fa-solid fa-chart-pie text-xs text-indigo-400"></i> Matrix
           </h3>
           <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-6 scroll-smooth z-10">
           
           {/* Critical Section */}
           <div className="animate-bounce-in" style={{animationDelay: '0.1s'}}>
             <div className="flex justify-between items-center mb-2">
               <span className="text-[9px] font-bold text-rose-300 tracking-widest flex items-center gap-2 uppercase">
                 <i className="fa-solid fa-arrow-trend-down"></i> Fading
               </span>
               <span className="text-[9px] bg-rose-500/10 text-rose-300 px-2 py-0.5 rounded border border-rose-500/20">
                 {predictions.filter(p => p.status === 'critical').length}
               </span>
             </div>
             <div className="space-y-2">
               {predictions.filter(p => p.status === 'critical').map(p => {
                 const item = items.find(i => i.id === p.itemId);
                 if (!item) return null;
                 return (
                   <div key={p.itemId} onClick={() => handleSelect(p.itemId)} onMouseEnter={playHover} className="glass-layer-3 rounded-lg p-3 cursor-pointer group border border-transparent hover-pulse-red transition-all">
                      <div className="flex justify-between text-xs text-white/90 mb-1">
                        <span className="truncate w-24 font-medium">{item.label}</span>
                        <span className="text-rose-400 font-mono text-[9px]">-24h</span>
                      </div>
                      <RiskGauge value={p.retention24h} label="" />
                   </div>
                 );
               })}
             </div>
           </div>

           {/* Moderate Section */}
           <div className="animate-bounce-in" style={{animationDelay: '0.2s'}}>
             <div className="flex justify-between items-center mb-2">
               <span className="text-[9px] font-bold text-amber-300 tracking-widest flex items-center gap-2 uppercase">
                 <i className="fa-regular fa-clock"></i> Drifting
               </span>
               <span className="text-[9px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20">
                 {predictions.filter(p => p.status === 'at-risk').length}
               </span>
             </div>
             <div className="space-y-2">
               {predictions.filter(p => p.status === 'at-risk').map(p => {
                 const item = items.find(i => i.id === p.itemId);
                 if (!item) return null;
                 return (
                   <div key={p.itemId} onClick={() => handleSelect(p.itemId)} onMouseEnter={playHover} className="glass-layer-3 rounded-lg p-3 cursor-pointer border border-transparent hover-wobble transition-all">
                      <div className="flex justify-between text-xs text-white/90 mb-1">
                        <span className="truncate w-24 font-medium">{item.label}</span>
                        <span className="text-amber-400 font-mono text-[9px]">Declining</span>
                      </div>
                      <RiskGauge value={p.retention24h} label="" />
                   </div>
                 );
               })}
             </div>
           </div>
           
           {/* Stable Section */}
           <div className="animate-bounce-in" style={{animationDelay: '0.3s'}}>
              <div className="flex justify-between items-center mb-2">
               <span className="text-[9px] font-bold text-emerald-300 tracking-widest flex items-center gap-2 uppercase">
                 <i className="fa-solid fa-gem"></i> Solid
               </span>
               <span className="text-[9px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20">
                 {predictions.filter(p => p.status === 'stable').length}
               </span>
             </div>
             <div className="grid grid-cols-4 gap-2">
                {predictions.filter(p => p.status === 'stable').map(p => {
                   const item = items.find(i => i.id === p.itemId);
                   if (!item) return null;
                   return (
                     <div 
                       key={p.itemId} 
                       onClick={() => handleSelect(p.itemId)}
                       onMouseEnter={playHover} 
                       title={item.label}
                       className="hover-shimmer aspect-square rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer flex items-center justify-center text-emerald-400/70 hover:text-emerald-300 transition-all text-sm hover:scale-105 shadow-sm"
                     >
                       🌿
                     </div>
                   );
                })}
             </div>
           </div>
        </div>
      </aside>

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<MemoryShadow />);
