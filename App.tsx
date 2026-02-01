import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Menu, RefreshCw, Play, PawPrint, Volume2, VolumeX, Heart, Save, ArrowRightCircle, Star, Sparkles
} from 'lucide-react';
import { 
  GRAVITY, JUMP_FORCE, MOVE_SPEED, PLAYER_SIZE, LEVELS, SCRATCH_DURATION, 
  INVULNERABILITY_FRAMES, WALL_SLIDE_SPEED, WALL_JUMP_FORCE, TILE_SIZE, MAX_LIVES, ASSETS 
} from './constants';
import { 
  LevelData, Rect, Enemy, EnemyType, Particle, GameStatus, ParticleType, Platform
} from './types';

// --- Utils ---
const rectIntersect = (r1: Rect, r2: Rect) => {
  return !(r2.x > r1.x + r1.w || 
           r2.x + r2.w < r1.x || 
           r2.y > r1.y + r1.h || 
           r2.y + r2.h < r1.y);
};

const getDistance = (r1: Rect, r2: Rect) => {
    const dx = (r1.x + r1.w/2) - (r2.x + r2.w/2);
    const dy = (r1.y + r1.h/2) - (r2.y + r2.h/2);
    return Math.sqrt(dx*dx + dy*dy);
};

// --- SVG Components (Optimized & Styled) ---

const ChocolataSprite = ({ isAttacking, facingRight, runFrame }: { isAttacking: boolean, facingRight: boolean, runFrame: number }) => (
    <svg viewBox="0 0 64 64" width="100%" height="100%" style={{ overflow: 'visible', filter: 'drop-shadow(0 4px 2px rgba(0,0,0,0.4))' }}>
        <g transform={`scale(${facingRight ? 1 : -1}, 1) translate(${facingRight ? 0 : -64}, 0)`}>
            {/* Shadow under feet for 3D feel */}
            <ellipse cx="32" cy="60" rx="15" ry="4" fill="rgba(0,0,0,0.3)" />
            
            <path d="M10 45 Q-5 30 5 15" stroke="#1f2937" strokeWidth="4" fill="none" strokeLinecap="round" className="animate-[wiggle_1s_ease-in-out_infinite]"/>
            <ellipse cx="20" cy={55 + (runFrame % 2 * 2)} rx="5" ry="6" fill="#fff" stroke="#1f2937" strokeWidth="2"/>
            <ellipse cx="32" cy="45" rx="20" ry="16" fill="#fff" stroke="#1f2937" strokeWidth="2"/>
            <path d="M25 35 Q35 25 45 35 Q40 50 30 45" fill="#f97316" opacity="0.9"/>
            <path d="M35 30 Q45 25 50 40" fill="#1f2937" opacity="0.9"/>
            <ellipse cx="44" cy={55 - (runFrame % 2 * 2)} rx="5" ry="6" fill="#fff" stroke="#1f2937" strokeWidth="2"/>
            <g transform="translate(36, 18)">
                <circle cx="0" cy="0" r="14" fill="#fff" stroke="#1f2937" strokeWidth="2"/>
                <path d="M-10 -8 L-14 -20 L-2 -12 Z" fill="#f97316" stroke="#1f2937" strokeWidth="2"/>
                <path d="M10 -8 L14 -20 L2 -12 Z" fill="#1f2937" stroke="#1f2937" strokeWidth="2"/>
                <circle cx="-5" cy="-2" r="2" fill="#000"/>
                <circle cx="5" cy="-2" r="2" fill="#000"/>
                <path d="M-3 4 Q0 6 3 4" fill="none" stroke="#000" strokeWidth="1.5"/>
                <circle cx="0" cy="2" r="1.5" fill="#pink"/>
            </g>
            {isAttacking && (
                <g className="animate-pulse">
                    <path d="M50 20 L75 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                    <path d="M52 30 L80 30" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                    <path d="M50 40 L75 50" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                </g>
            )}
        </g>
    </svg>
);

const AyelenSprite = ({ mood = 'happy' }: { mood?: 'happy' | 'scared' }) => (
    <svg viewBox="0 0 100 150" width="100%" height="100%" style={{ overflow: 'visible', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5))' }}>
         <defs>
            <linearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffe0bd"/>
                <stop offset="100%" stopColor="#ffcd94"/>
            </linearGradient>
        </defs>
        <path d="M25 40 Q50 10 75 40 L80 90 Q50 100 20 90 Z" fill="#3E2723"/>
        <rect x="35" y="110" width="10" height="40" fill="#333"/>
        <rect x="55" y="110" width="10" height="40" fill="#333"/>
        <path d="M30 110 L20 140 L80 140 L70 110 Z" fill="#4ecdc4"/>
        <rect x="30" y="70" width="40" height="45" rx="5" fill="#ff6b6b"/>
        {mood === 'happy' ? (
            <>
            <path d="M30 75 Q15 90 25 105" stroke="#ff6b6b" strokeWidth="8" strokeLinecap="round" fill="none"/>
            <circle cx="25" cy="105" r="5" fill="#ffe0bd"/>
            </>
        ) : (
            <path d="M30 80 Q50 90 70 80" stroke="#ff6b6b" strokeWidth="8" strokeLinecap="round" fill="none"/>
        )}
        <rect x="42" y="60" width="16" height="12" fill="#ffe0bd"/>
        <circle cx="50" cy="45" r="24" fill="url(#skinGrad)"/>
        <circle cx="42" cy="42" r="2" fill="#333"/>
        <circle cx="58" cy="42" r="2" fill="#333"/>
        <path d={mood === 'happy' ? "M42 52 Q50 58 58 52" : "M45 55 Q50 50 55 55"} stroke="#333" strokeWidth="1.5" fill="none"/>
        <path d="M25 45 Q25 20 50 20 Q75 20 75 45 Q75 30 70 25 Q50 15 30 25 Q25 35 25 45" fill="#3E2723"/>
    </svg>
);

const GhostSprite = () => (
    <svg viewBox="0 0 64 64" width="100%" height="100%" className="animate-[bounce_2s_infinite]" style={{ overflow: 'visible', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.6))' }}>
         <defs>
            <radialGradient id="ghostGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.9"/>
                <stop offset="100%" stopColor="#e0e7ff" stopOpacity="0.6"/>
            </radialGradient>
        </defs>
        <path d="M12 60 L12 30 Q12 4 32 4 Q52 4 52 30 L52 60 L42 50 L32 60 L22 50 L12 60 Z" fill="url(#ghostGrad)" stroke="#c7d2fe" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="3" fill="#1e1b4b" />
        <circle cx="40" cy="24" r="3" fill="#1e1b4b" />
        <path d="M28 36 Q32 30 36 36" stroke="#1e1b4b" strokeWidth="2" fill="none" opacity="0.5"/>
        <g className="animate-pulse">
            <circle cx="10" cy="15" r="2" fill="#fff" opacity="0.6" />
            <circle cx="54" cy="40" r="1.5" fill="#fff" opacity="0.6" />
        </g>
    </svg>
);

// --- Audio Engine ---
const AudioEngine = {
    ctx: null as AudioContext | null,
    bgmInterval: null as number | null,
    
    init: () => {
        if (!AudioEngine.ctx) {
            AudioEngine.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (AudioEngine.ctx.state === 'suspended') AudioEngine.ctx.resume();
    },

    playTone: (freq: number, type: OscillatorType, duration: number, vol = 0.1) => {
        if (!AudioEngine.ctx) return;
        const osc = AudioEngine.ctx.createOscillator();
        const gain = AudioEngine.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, AudioEngine.ctx.currentTime);
        gain.gain.setValueAtTime(vol, AudioEngine.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, AudioEngine.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(AudioEngine.ctx.destination);
        osc.start();
        osc.stop(AudioEngine.ctx.currentTime + duration);
    },

    playSFX: (type: 'jump' | 'collect' | 'scratch' | 'hit' | 'win' | 'open') => {
        if (!AudioEngine.ctx) return;
        switch (type) {
            case 'jump': AudioEngine.playTone(400, 'square', 0.05, 0.05); setTimeout(() => AudioEngine.playTone(500, 'square', 0.1, 0.05), 50); break;
            case 'collect': AudioEngine.playTone(1200, 'sine', 0.1, 0.1); setTimeout(() => AudioEngine.playTone(1800, 'sine', 0.2, 0.1), 100); break;
            case 'scratch': AudioEngine.playTone(200, 'sawtooth', 0.1, 0.1); break;
            case 'hit': AudioEngine.playTone(150, 'sawtooth', 0.3, 0.2); setTimeout(() => AudioEngine.playTone(100, 'sawtooth', 0.3, 0.2), 100); break;
            case 'open': AudioEngine.playTone(440, 'triangle', 0.5, 0.1); setTimeout(() => AudioEngine.playTone(880, 'triangle', 0.8, 0.1), 200); break;
            case 'win': [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => AudioEngine.playTone(f, 'square', 0.3, 0.1), i * 150)); break;
        }
    },

    startBGM: () => {
        if (AudioEngine.bgmInterval) return;
        let step = 0;
        const bassLine = [110, 110, 164, 164, 146, 146, 130, 98]; 
        AudioEngine.bgmInterval = window.setInterval(() => {
            if (!AudioEngine.ctx) return;
            const freq = bassLine[step % bassLine.length];
            AudioEngine.playTone(freq, 'triangle', 0.2, 0.05);
            if (step % 2 === 0) AudioEngine.playTone(8000, 'square', 0.02, 0.005); 
            step++;
        }, 250); 
    },

    stopBGM: () => {
        if (AudioEngine.bgmInterval) {
            clearInterval(AudioEngine.bgmInterval);
            AudioEngine.bgmInterval = null;
        }
    }
};

export default function App() {
  const [scale, setScale] = useState(1);
  const [status, setStatus] = useState<GameStatus>('MENU');
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [unlockedLevel, setUnlockedLevel] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [yarnsCollected, setYarnsCollected] = useState(0);
  const [score, setScore] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showDoorMessage, setShowDoorMessage] = useState(false);
  const [, setTick] = useState(0);

  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const playerRef = useRef({
    x: 0, y: 0, vx: 0, vy: 0, w: PLAYER_SIZE.w, h: PLAYER_SIZE.h,
    isGrounded: false, isWallSliding: false, wallDir: 0, facingRight: true,
    isAttacking: false, attackTimer: 0, invulnerableTimer: 0, isDead: false, frame: 0
  });
  const prevGroundedRef = useRef(false);

  const levelRef = useRef<LevelData | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleResize = () => {
        const maxWidth = window.innerWidth;
        const maxHeight = window.innerHeight;
        const scaleX = maxWidth / 800;
        const scaleY = maxHeight / 600;
        const newScale = Math.min(scaleX, scaleY) * 0.95; 
        setScale(newScale);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const savedLevel = localStorage.getItem('chocolata_unlocked_level');
    if (savedLevel) setUnlockedLevel(parseInt(savedLevel, 10));
  }, []);

  const saveProgress = (levelIdx: number) => {
      if (levelIdx > unlockedLevel && levelIdx < LEVELS.length) {
          setUnlockedLevel(levelIdx);
          localStorage.setItem('chocolata_unlocked_level', levelIdx.toString());
      }
  };

  const playSound = (type: 'jump' | 'collect' | 'scratch' | 'hit' | 'win' | 'open') => {
    if (isMuted) return;
    AudioEngine.playSFX(type);
  };

  useEffect(() => {
      if (!isMuted && status === 'PLAYING') AudioEngine.startBGM();
      else AudioEngine.stopBGM();
      return () => AudioEngine.stopBGM();
  }, [isMuted, status]);

  const initLevel = (levelIdx: number) => {
    const levelTemplate = LEVELS[levelIdx];
    if (!levelTemplate) {
      setStatus('VICTORY');
      return;
    }
    levelRef.current = JSON.parse(JSON.stringify(levelTemplate));
    
    if (levelRef.current) {
        playerRef.current = {
            ...playerRef.current,
            x: levelRef.current.playerStart.x,
            y: levelRef.current.playerStart.y,
            vx: 0, vy: 0,
            isGrounded: false, isDead: false, invulnerableTimer: 0, frame: 0
        };
    }
    setYarnsCollected(0);
    setShowDoorMessage(false);
    particlesRef.current = [];
  };

  const spawnParticles = (x: number, y: number, type: ParticleType, count: number, colorOverride?: string) => {
    const theme = levelRef.current?.theme || 'kitchen';
    
    for (let i = 0; i < count; i++) {
        let life = 30 + Math.random() * 20;
        let size = 4 + Math.random() * 4;
        let vx = (Math.random() - 0.5) * 6;
        let vy = (Math.random() - 0.5) * 6;
        let color = colorOverride || '#fff';
        let rotSpeed = (Math.random() - 0.5) * 10;

        if (type === 'dust') {
            vy = -Math.random() * 2; // Float up
            vx = (Math.random() - 0.5) * 2;
            life = 20 + Math.random() * 10;
            size = 6 + Math.random() * 6;
            color = theme === 'garden' ? '#86efac' : (theme === 'roof' ? '#e0f2fe' : '#e5e7eb');
        } else if (type === 'hit') {
            color = '#ef4444';
            size = 5 + Math.random() * 5;
            vx = (Math.random() - 0.5) * 10;
            vy = (Math.random() - 0.5) * 10;
        } else if (type === 'sparkle' || type === 'star') {
            color = '#fbbf24';
            vy = -Math.random() * 4;
            life = 40 + Math.random() * 20;
        } else if (type === 'scratch') {
            color = '#fff';
            life = 10;
            vx = (Math.random() - 0.5) * 15;
            vy = (Math.random() - 0.5) * 15;
            size = 2; // Thin lines
        }

        particlesRef.current.push({
            id: Math.random().toString(),
            x, y, vx, vy, life, maxLife: life, color, size, type,
            rotation: Math.random() * 360,
            rotSpeed
        });
    }
  };

  const updateEnemyAI = (enemy: Enemy, player: Rect) => {
      const dist = getDistance(enemy, player);
      switch (enemy.enemyType) {
          case EnemyType.DOG:
              if (enemy.state === 'SLEEP' && dist < enemy.detectionRange) { enemy.state = 'ALERT'; enemy.stateTimer = 30; }
              else if (enemy.state === 'ALERT') { enemy.stateTimer--; if (enemy.stateTimer <= 0) { enemy.state = 'CHASE'; playSound('hit'); } }
              else if (enemy.state === 'CHASE') {
                  const dx = (player.x + player.w/2) - (enemy.x + enemy.w/2);
                  enemy.direction = dx > 0 ? 1 : -1;
                  enemy.x += enemy.speed * enemy.direction;
                  if (dist > enemy.detectionRange * 2) enemy.state = 'SLEEP';
              }
              break;
          case EnemyType.CUCUMBER:
              if (enemy.state === 'HIDDEN' && dist < enemy.detectionRange) enemy.state = 'SURPRISE';
              else if (enemy.state === 'SURPRISE') {
                  enemy.y -= 5;
                  if (typeof enemy.originalY === 'number' && enemy.y < enemy.originalY - 80) enemy.state = 'PATROL'; 
              } else if (enemy.state === 'PATROL') {
                  enemy.x += enemy.direction;
                  if (typeof enemy.originalY === 'number' && enemy.y < enemy.originalY) enemy.y += 2; 
              }
              break;
          case EnemyType.GHOST:
              enemy.x += enemy.speed * enemy.direction;
              enemy.y += Math.sin(Date.now() / 200) * 1.5;
              if (enemy.x <= enemy.patrolStart || enemy.x >= enemy.patrolEnd) enemy.direction *= -1;
              break;
          default:
              enemy.x += enemy.speed * enemy.direction;
              if (enemy.x <= enemy.patrolStart || enemy.x >= enemy.patrolEnd) enemy.direction *= -1;
      }
  };

  const killPlayer = () => {
    if (playerRef.current.isDead) return;
    playerRef.current.isDead = true;
    playSound('hit');
    spawnParticles(playerRef.current.x + PLAYER_SIZE.w/2, playerRef.current.y + PLAYER_SIZE.h/2, 'hit', 20);
    
    setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) setStatus('GAME_OVER');
        else setTimeout(() => {
            if (levelRef.current) {
                playerRef.current = { ...playerRef.current, x: levelRef.current.playerStart.x, y: levelRef.current.playerStart.y, vx: 0, vy: 0, isDead: false, invulnerableTimer: INVULNERABILITY_FRAMES };
                levelRef.current.enemies.forEach(e => {
                    e.isDead = false;
                    if(e.enemyType === EnemyType.DOG) e.state = 'SLEEP';
                    if(e.enemyType === EnemyType.CUCUMBER) e.state = 'HIDDEN';
                    // Strict Reset to original Y
                    if(typeof e.originalY === 'number') e.y = e.originalY;
                });
            }
        }, 1000);
        return newLives;
    });
  };

  const handleLevelComplete = () => {
    setStatus('LEVEL_COMPLETE'); setScore(p => p + 500); playSound('win');
    spawnParticles(playerRef.current.x, playerRef.current.y, 'star', 30);
    const nextIdx = currentLevelIdx + 1; saveProgress(nextIdx);
    setTimeout(() => {
        if (nextIdx >= LEVELS.length) setStatus('VICTORY');
        else { setCurrentLevelIdx(nextIdx); initLevel(nextIdx); setStatus('PLAYING'); }
    }, 3000);
  };

  const update = (dt: number) => {
    if (status !== 'PLAYING' || !levelRef.current) return;
    const player = playerRef.current;
    const level = levelRef.current;
    const physics = level.physics;

    if (!player.isDead) {
        let moved = false;
        if (keysRef.current['ArrowRight']) { player.vx += 0.8; player.facingRight = true; moved = true; } 
        else if (keysRef.current['ArrowLeft']) { player.vx -= 0.8; player.facingRight = false; moved = true; } 
        else { player.vx *= physics.friction; }

        if (moved) player.frame++;
        player.vx += physics.wind;
        player.vx = Math.max(Math.min(player.vx, MOVE_SPEED), -MOVE_SPEED);

        if ((keysRef.current['z'] || keysRef.current[' ']) && player.attackTimer === 0) {
            player.isAttacking = true; player.attackTimer = SCRATCH_DURATION; playSound('scratch');
            spawnParticles(player.x + (player.facingRight ? 30 : 0), player.y + 15, 'scratch', 5);
        }
    }

    player.vy += GRAVITY; player.y += player.vy; player.x += player.vx;

    // Collisions
    player.isGrounded = false; player.isWallSliding = false; player.wallDir = 0;
    for (const plat of level.platforms) {
        const isOneWay = plat.type === 'oneway';
        const playerBottom = player.y + player.h;
        const playerOldBottom = playerBottom - player.vy; 
        
        if (player.x + player.w > plat.x && player.x < plat.x + plat.w) {
            if (player.vy >= 0 && playerBottom >= plat.y && playerOldBottom <= plat.y) {
                 player.y = plat.y - player.h; player.vy = 0; player.isGrounded = true;
            } else if (!isOneWay && player.vy < 0 && player.y <= plat.y + plat.h && player.y - player.vy >= plat.y + plat.h) {
                player.y = plat.y + plat.h; player.vy = 0;
            }
        }
        if (!isOneWay && player.y + player.h > plat.y && player.y < plat.y + plat.h) {
            if (player.vx > 0 && player.x + player.w >= plat.x && player.x + player.w - player.vx <= plat.x) {
                 player.x = plat.x - player.w; player.vx = 0;
                 if (!player.isGrounded) { player.isWallSliding = true; player.wallDir = 1; }
            } else if (player.vx < 0 && player.x <= plat.x + plat.w && player.x - player.vx >= plat.x + plat.w) {
                player.x = plat.x + plat.w; player.vx = 0;
                if (!player.isGrounded) { player.isWallSliding = true; player.wallDir = -1; }
            }
        }
    }

    // Landing Particles
    if (!prevGroundedRef.current && player.isGrounded) {
        spawnParticles(player.x + player.w/2, player.y + player.h, 'dust', 6);
    }
    prevGroundedRef.current = player.isGrounded;

    if (keysRef.current['ArrowUp']) {
        if (player.isGrounded) { 
            player.vy = JUMP_FORCE; player.isGrounded = false; playSound('jump');
            spawnParticles(player.x + player.w/2, player.y + player.h, 'dust', 4);
        } 
        else if (player.isWallSliding) { 
            player.vy = WALL_JUMP_FORCE.y; player.vx = -player.wallDir * WALL_JUMP_FORCE.x; player.isWallSliding = false; playSound('jump');
            spawnParticles(player.x + (player.wallDir === 1 ? player.w : 0), player.y + player.h/2, 'dust', 4);
        }
    }
    if (player.isWallSliding && player.vy > 0) player.vy = Math.min(player.vy, WALL_SLIDE_SPEED);

    if (player.x < 0) player.x = 0;
    if (player.x > level.width - player.w) player.x = level.width - player.w;
    if (player.y > level.height + 100) killPlayer();

    level.yarns.forEach(yarn => {
        if (!yarn.collected && rectIntersect(player, yarn)) {
            yarn.collected = true;
            setYarnsCollected(p => {
                const newVal = p + 1;
                if (newVal === 3) { setShowDoorMessage(true); playSound('open'); setTimeout(() => setShowDoorMessage(false), 3000); }
                return newVal;
            });
            setScore(p => p + 100); playSound('collect'); spawnParticles(yarn.x + yarn.w/2, yarn.y + yarn.h/2, 'star', 15);
        }
    });

    level.enemies.forEach(enemy => {
        if (enemy.isDead) return;
        updateEnemyAI(enemy, player);
        if (rectIntersect(player, enemy)) {
            let hitEnemy = false;
            if (player.isAttacking) {
                const attackBox: Rect = { x: player.facingRight ? player.x + player.w : player.x - 30, y: player.y, w: 30, h: player.h };
                if (rectIntersect(attackBox, enemy)) hitEnemy = true;
            } else if (player.vy > 0 && player.y + player.h < enemy.y + enemy.h / 2 + 10) {
                hitEnemy = true; player.vy = JUMP_FORCE * 0.6; playSound('jump');
            }
            if (hitEnemy) {
                enemy.isDead = true; setScore(p => p + 50); spawnParticles(enemy.x + enemy.w/2, enemy.y + enemy.h/2, 'hit', 15);
            } else if (player.invulnerableTimer === 0 && !player.isDead) killPlayer();
        }
    });

    particlesRef.current.forEach(p => { 
        p.x += p.vx + (physics.wind * 0.5); 
        p.y += p.vy; 
        p.life--; 
        p.rotation += p.rotSpeed;
        if(p.type === 'hit' || p.type === 'dust') p.vy += 0.2; // Gravity for debris
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    if (player.attackTimer > 0) { player.attackTimer--; if (player.attackTimer === 0) player.isAttacking = false; }
    if (player.invulnerableTimer > 0) player.invulnerableTimer--;

    const allCollected = level.yarns.every(y => y.collected);
    if (allCollected && rectIntersect(player, level.door)) handleLevelComplete();
  };

  const gameLoop = useCallback((time: number) => {
    const dt = time - lastTimeRef.current; lastTimeRef.current = time;
    update(dt);
    requestRef.current = requestAnimationFrame(gameLoop);
    setTick(t => t + 1); 
  }, [currentLevelIdx, status]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, []);

  useEffect(() => {
    if (status === 'PLAYING') requestRef.current = requestAnimationFrame(gameLoop);
    return () => { if (requestRef.current !== null) cancelAnimationFrame(requestRef.current); };
  }, [status, gameLoop]);

  const startGame = (fromSave = false) => {
    // Explicitly initialize audio on user interaction
    AudioEngine.init();
    setLives(MAX_LIVES); setScore(0); 
    const startLevel = fromSave ? unlockedLevel : 0;
    setCurrentLevelIdx(startLevel); initLevel(startLevel); setStatus('PLAYING');
  };

  const retryLevel = () => {
      setLives(MAX_LIVES);
      setScore(0);
      initLevel(currentLevelIdx);
      setStatus('PLAYING');
  };

  const getThemeBackground = () => {
      const theme = levelRef.current?.theme || 'kitchen';
      if (theme === 'kitchen') return ASSETS.bg.kitchen;
      if (theme === 'garden') return ASSETS.bg.garden;
      if (theme === 'roof') return ASSETS.bg.roof;
      if (theme === 'castle') return ASSETS.bg.castle;
      return '';
  };

  // --- 3D RENDER ENGINE ---
  const renderPlatform3D = (p: Platform, i: number, themeName: string) => {
      const themes = ASSETS.themes as any;
      const theme = themes[themeName] || themes.kitchen;
      const isOneWay = p.type === 'oneway';
      
      // Calculate dimensions for 3D effect
      const depth = isOneWay ? 6 : 10;
      
      return (
        <div 
            key={i}
            style={{
                position: 'absolute',
                left: p.x, 
                top: p.y, 
                width: p.w, 
                height: p.h,
                zIndex: 5
            }}
        >
            {/* Main Face */}
            <div style={{
                width: '100%',
                height: isOneWay ? '10px' : '100%',
                backgroundColor: theme.face,
                backgroundImage: `linear-gradient(to bottom, ${theme.top} 0%, ${theme.face} 100%)`,
                borderRadius: isOneWay ? '4px' : '4px',
                position: 'relative',
                zIndex: 2,
                borderTop: `2px solid ${theme.top}`,
                boxShadow: isOneWay 
                    ? `0 ${depth}px 0 ${theme.side}, 0 ${depth+4}px 6px rgba(0,0,0,0.3)` 
                    : `inset 0 0 10px rgba(0,0,0,0.1), 0 ${depth}px 0 ${theme.side}, 0 ${depth+5}px 10px rgba(0,0,0,0.4)`
            }}>
                {/* Decorative Texture Pattern (Subtle) */}
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.1,
                    backgroundImage: 'radial-gradient(black 1px, transparent 1px)',
                    backgroundSize: '10px 10px'
                }}></div>
            </div>
        </div>
      );
  };

  const renderGame = () => {
      if (!levelRef.current) return null;
      const { platforms, enemies, yarns, door } = levelRef.current;
      const player = playerRef.current;
      const allYarnsCollected = yarns.every(y => y.collected);
      const isCastle = levelRef.current.theme === 'castle';
      const currentTheme = levelRef.current.theme;

      return (
          <div 
            className="relative w-[800px] h-[600px] overflow-hidden shadow-2xl bg-black border-4 border-gray-800"
            style={{ 
                backgroundImage: `url(${getThemeBackground()})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
          >
              {/* Atmospheric Gradient Overlays */}
              <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none"></div>

              {/* HUD - Modern Glassmorphism */}
              <div className="absolute top-4 left-4 z-50 flex gap-4 text-white font-bold">
                  <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 shadow-lg">
                      <Heart className="fill-red-500 text-red-500" size={20} />
                      <span className="text-xl">{lives}</span>
                  </div>
                  <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 shadow-lg">
                      <div className={`w-5 h-5 rounded-full border-2 border-white ${allYarnsCollected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
                      <span className="text-xl text-yellow-400">{yarnsCollected}/3</span>
                  </div>
                  <div className="bg-blue-600/80 backdrop-blur-md px-4 py-2 rounded-full border border-blue-400/30 shadow-lg">
                      LEVEL {currentLevelIdx + 1}
                  </div>
              </div>

              {showDoorMessage && (
                  <div className="absolute top-32 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-yellow-300 text-black px-8 py-3 rounded-xl border-b-4 border-yellow-700 font-bold animate-bounce z-50 shadow-2xl text-xl tracking-wider flex items-center gap-2">
                     <Sparkles size={24}/> {isCastle ? "¡JAULA ABIERTA!" : "¡PUERTA ABIERTA!"} <Sparkles size={24}/>
                  </div>
              )}

              {/* Door/Cage */}
              <div 
                className={`absolute transition-all duration-500 z-0`}
                style={{ 
                    left: door.x, top: door.y, width: door.w, height: door.h,
                    zIndex: 1
                }}
              >
                  {isCastle ? (
                      <div className="w-full h-full relative">
                           {/* Cage Bars */}
                           <div className={`absolute inset-0 border-4 border-gray-600 bg-black/40 rounded-t-lg z-20 transition-transform duration-1000 ${allYarnsCollected ? '-translate-y-[120%]' : ''}`}>
                                <div className="absolute left-1/4 top-0 bottom-0 w-1 bg-gray-500"></div>
                                <div className="absolute left-2/4 top-0 bottom-0 w-1 bg-gray-500"></div>
                                <div className="absolute left-3/4 top-0 bottom-0 w-1 bg-gray-500"></div>
                           </div>
                           <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-24 z-10">
                              <AyelenSprite mood={allYarnsCollected ? 'happy' : 'scared'} />
                           </div>
                      </div>
                  ) : (
                    <div className="relative w-full h-full">
                         {/* 3D Door Frame */}
                         <div className="absolute inset-0 bg-amber-900 border-4 border-amber-950 rounded-t-full shadow-lg"></div>
                         {/* Door Inner */}
                         <div className={`absolute inset-2 bg-black rounded-t-full overflow-hidden transition-all duration-500 ${allYarnsCollected ? 'bg-yellow-200/20' : ''}`}>
                             {allYarnsCollected && <div className="absolute inset-0 bg-white/40 animate-pulse"></div>}
                         </div>
                         <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/50 px-2 py-1 rounded text-[10px] text-white font-bold whitespace-nowrap">
                            {allYarnsCollected ? 'EXIT' : 'LOCKED'}
                         </div>
                    </div>
                  )}
              </div>

              {/* Render Platforms with new 3D Engine */}
              {platforms.map((p, i) => renderPlatform3D(p, i, currentTheme))}

              {/* Yarn Collectibles */}
              {yarns.filter(y => !y.collected).map(y => (
                  <div 
                    key={y.id} 
                    className="absolute z-10 animate-[bounce_2s_infinite]"
                    style={{ left: y.x, top: y.y, width: y.w, height: y.h }}
                  >
                      <div className="w-full h-full bg-yellow-400 rounded-full border-2 border-white shadow-[0_0_15px_#facc15] relative overflow-hidden">
                          {/* Yarn Texture details */}
                          <div className="absolute inset-0 border-t border-black/10 rotate-45 transform translate-y-1"></div>
                          <div className="absolute inset-0 border-t border-black/10 rotate-45 transform translate-y-3"></div>
                      </div>
                      <div className="absolute -inset-2 bg-yellow-400/30 blur-md rounded-full -z-10 animate-pulse"></div>
                  </div>
              ))}

              {/* Enemies */}
              {enemies.filter(e => !e.isDead).map(e => (
                  <div 
                    key={e.id} 
                    className={`absolute z-10 transition-transform duration-200 ${e.direction === 1 ? 'scale-x-[-1]' : ''}`}
                    style={{ 
                        left: e.x, top: e.y, width: e.w, height: e.h,
                        opacity: e.state === 'HIDDEN' ? 0 : 1,
                    }}
                  >
                    {e.enemyType === EnemyType.ROOMBA && (
                        <div className="w-full h-full relative">
                            <div className="absolute bottom-0 w-full h-3/4 bg-gray-800 rounded-full border border-gray-600 shadow-xl overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-gray-700 to-gray-900"></div>
                            </div>
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full animate-ping shadow-[0_0_10px_red]"></div>
                            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-600 rounded-full"></div>
                        </div>
                    )}
                    {e.enemyType === EnemyType.DOG && (
                        <div className="w-full h-full relative">
                             <div className={`w-full h-full bg-amber-800 rounded-2xl border-2 border-amber-950 ${e.state === 'SLEEP' ? 'scale-y-75 mt-2' : ''} shadow-lg relative overflow-hidden`}>
                                 <div className="absolute top-1 right-1 w-3 h-3 bg-amber-950 rounded-full"></div>
                                 <div className="absolute top-2 right-4 w-3 h-3 bg-white rounded-full"><div className="w-1.5 h-1.5 bg-black rounded-full ml-0.5 mt-0.5"></div></div>
                             </div>
                             {e.state === 'SLEEP' && <div className="absolute -top-8 right-0 text-2xl animate-pulse font-bold text-white drop-shadow-md">Zzz</div>}
                         </div>
                    )}
                    {e.enemyType === EnemyType.BIRD && (
                        <div className="w-full h-full relative">
                            <div className="w-full h-2/3 bg-sky-500 rounded-full border border-sky-700 shadow-lg relative">
                                <div className="absolute -right-2 top-0 w-4 h-4 bg-yellow-400 rotate-45 transform origin-bottom-left rounded-sm"></div>
                            </div>
                            <div className="absolute -top-4 right-4 w-8 h-4 bg-sky-300 rotate-[-20deg] animate-[wiggle_0.5s_infinite] rounded-full"></div>
                        </div>
                    )}
                    {e.enemyType === EnemyType.CUCUMBER && (
                        <div className="w-full h-full bg-green-600 rounded-full border-2 border-green-800 flex items-center justify-center shadow-lg relative">
                             <div className="w-full h-full bg-gradient-to-b from-green-500 to-green-700 rounded-full"></div>
                             {e.state !== 'HIDDEN' && <div className="absolute -top-4 text-xs text-white font-bold drop-shadow-md bg-red-600 px-1 rounded">!</div>}
                        </div>
                    )}
                    {e.enemyType === EnemyType.GHOST && <GhostSprite />}
                  </div>
              ))}

              {/* Player */}
              <div 
                className={`absolute z-20 transition-opacity ${player.invulnerableTimer > 0 && player.invulnerableTimer % 4 < 2 ? 'opacity-50' : 'opacity-100'}`}
                style={{ 
                    left: player.x, top: player.y, width: player.w, height: player.h,
                }}
              >
                 <ChocolataSprite isAttacking={player.isAttacking} facingRight={player.facingRight} runFrame={Math.floor(player.frame / 5)} />
              </div>

              {/* Particles */}
              {particlesRef.current.map(p => {
                  const style = {
                      left: p.x, top: p.y, 
                      width: p.size, height: p.size,
                      backgroundColor: p.type === 'star' ? 'transparent' : p.color,
                      opacity: p.life / p.maxLife,
                      transform: `rotate(${p.rotation}deg)`,
                      boxShadow: p.type === 'hit' ? '0 0 10px red' : 'none'
                  };
                  
                  if (p.type === 'star') {
                      return <Star key={p.id} className="absolute text-yellow-400 fill-yellow-400" size={p.size * 2} style={{...style, width: p.size*2, height: p.size*2}} />;
                  }
                  if (p.type === 'dust') {
                      return <div key={p.id} className="absolute rounded-full bg-white/50 blur-[1px]" style={style}></div>;
                  }
                  if (p.type === 'scratch') {
                      return <div key={p.id} className="absolute bg-white shadow-[0_0_5px_white]" style={{...style, height: 2, width: p.size * 3}}></div>;
                  }

                  return (
                      <div key={p.id} className="absolute rounded-sm" style={style}></div>
                  );
              })}
          </div>
      );
  };

  return (
    <div className="fixed inset-0 bg-[#0f0f13] flex items-center justify-center font-sans select-none overflow-hidden">
        {/* Cinematic Background */}
        <div className="absolute inset-0 opacity-10" style={{ 
            backgroundImage: 'repeating-linear-gradient(45deg, #222 0px, #222 10px, #111 10px, #111 20px)',
        }}></div>

        <div 
            style={{ 
                transform: `scale(${scale})`,
                width: 800,
                height: 600,
                transformOrigin: 'center center'
            }}
            className="relative shadow-2xl bg-black rounded-xl overflow-hidden ring-8 ring-gray-900"
        >
            <div className="absolute -top-20 w-full text-center">
                 <h1 className="text-5xl text-yellow-400 font-extrabold tracking-wider drop-shadow-[0_4px_0_rgba(0,0,0,1)] flex items-center justify-center gap-6" style={{ fontFamily: 'Impact, sans-serif' }}>
                    <PawPrint size={48} className="fill-yellow-600" /> CHOCOLATA 3D <PawPrint size={48} className="fill-yellow-600" />
                </h1>
            </div>

            {status === 'MENU' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
                    <div className="bg-neutral-900/90 border border-neutral-700 p-12 rounded-3xl text-center shadow-2xl max-w-2xl w-full relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
                        <h2 className="text-3xl text-white font-bold mb-2">Misión: Rescate de Ovillos</h2>
                        <p className="text-gray-400 mb-8">Navega entornos 3D, esquiva enemigos y salva a Ayelen.</p>
                        
                        <div className="flex flex-col gap-4 items-center w-3/4 mx-auto">
                            {unlockedLevel > 0 && (
                                <button onClick={() => startGame(true)} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-4 px-8 rounded-xl text-xl shadow-lg transform transition-all hover:scale-105 flex items-center justify-center gap-3">
                                    <ArrowRightCircle size={28} /> NIVEL {unlockedLevel + 1}
                                </button>
                            )}
                            <button onClick={() => startGame(false)} className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold py-4 px-8 rounded-xl text-xl shadow-lg transform transition-all hover:scale-105 flex items-center justify-center gap-3">
                                <Play size={28} /> NUEVA PARTIDA
                            </button>
                        </div>

                        <div className="flex justify-center gap-8 mt-10 text-gray-500 text-sm font-bold uppercase tracking-widest">
                            <span className="flex items-center gap-2"><div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center border border-gray-700">←</div> MOVER</span>
                            <span className="flex items-center gap-2"><div className="w-20 h-8 rounded bg-gray-800 flex items-center justify-center border border-gray-700">SPACE</div> ATAQUE</span>
                        </div>
                    </div>
                </div>
            )}

            {status === 'PLAYING' && renderGame()}

            {status === 'GAME_OVER' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-red-950/90 backdrop-blur-md">
                    <div className="bg-black/50 border-2 border-red-500/50 p-12 rounded-3xl text-center shadow-[0_0_100px_rgba(220,38,38,0.3)]">
                        <h2 className="text-6xl text-red-500 font-black mb-4 tracking-widest">GAME OVER</h2>
                        <div className="flex flex-col gap-4 mt-8">
                            <button onClick={retryLevel} className="bg-white text-black font-bold py-4 px-12 rounded-full hover:bg-gray-200 transform hover:scale-105 transition-all flex items-center justify-center gap-3">
                                <RefreshCw size={24} /> REINTENTAR
                            </button>
                            <button onClick={() => setStatus('MENU')} className="text-white/60 hover:text-white font-bold py-2">MENÚ PRINCIPAL</button>
                        </div>
                    </div>
                </div>
            )}

            {status === 'LEVEL_COMPLETE' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-emerald-950/90 backdrop-blur-md">
                    <div className="bg-black/50 border-2 border-emerald-500/50 p-12 rounded-3xl text-center shadow-[0_0_100px_rgba(16,185,129,0.3)]">
                        <h2 className="text-4xl text-emerald-400 font-bold mb-4">¡NIVEL COMPLETADO!</h2>
                        <div className="animate-spin text-6xl mb-4 text-yellow-400">🧶</div>
                    </div>
                </div>
            )}

            {status === 'VICTORY' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-purple-950/95 backdrop-blur-xl">
                     <div className="text-center max-w-3xl">
                        <h2 className="text-8xl text-transparent bg-clip-text bg-gradient-to-b from-purple-300 to-purple-600 font-black mb-6 drop-shadow-2xl">¡LIBERTAD!</h2>
                        <p className="text-2xl text-purple-200 mb-10 font-light">Ayelen ha sido rescatada del Castillo.</p>
                        <div className="flex justify-center items-end h-64 mb-12 gap-8 bg-black/30 rounded-3xl p-8 border border-white/5">
                            <div className="w-32 h-32 animate-bounce"><ChocolataSprite isAttacking={false} facingRight={true} runFrame={0} /></div>
                            <div className="w-40 h-64"><AyelenSprite mood="happy" /></div>
                        </div>
                        <button onClick={() => setStatus('MENU')} className="bg-white text-purple-900 font-bold py-4 px-16 rounded-full text-xl shadow-2xl hover:bg-purple-100 transform hover:scale-105 transition-all">VOLVER AL MENÚ</button>
                    </div>
                </div>
            )}

            <div className="absolute bottom-4 left-4 right-4 flex justify-between text-white/30 text-xs font-bold pointer-events-none">
                 <span>v3.0 PRO 3D ENGINE</span>
                 <div className="pointer-events-auto cursor-pointer flex items-center gap-2 hover:text-white transition-colors" onClick={() => setIsMuted(!isMuted)}>
                    {isMuted ? <VolumeX size={16}/> : <Volume2 size={16}/>} {isMuted ? "SILENCIO" : "SONIDO ON"}
                 </div>
            </div>
        </div>
    </div>
  );
}