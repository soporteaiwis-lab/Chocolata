import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Menu, RefreshCw, Play, PawPrint, Wind, Volume2, VolumeX, Heart, Zap
} from 'lucide-react';
import { 
  GRAVITY, JUMP_FORCE, MOVE_SPEED, PLAYER_SIZE, LEVELS, SCRATCH_DURATION, 
  INVULNERABILITY_FRAMES, WALL_SLIDE_SPEED, WALL_JUMP_FORCE, TILE_SIZE 
} from './constants';
import { 
  LevelData, Rect, Enemy, EnemyType, Particle, GameStatus
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

export default function App() {
  // --- State ---
  const [status, setStatus] = useState<GameStatus>('MENU');
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [yarnsCollected, setYarnsCollected] = useState(0);
  const [score, setScore] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showDoorMessage, setShowDoorMessage] = useState(false); // New state for feedback
  const [tick, setTick] = useState(0);

  // --- Game Loop Refs ---
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Player State
  const playerRef = useRef({
    x: 0, y: 0, vx: 0, vy: 0,
    w: PLAYER_SIZE.w, h: PLAYER_SIZE.h,
    isGrounded: false,
    isWallSliding: false,
    wallDir: 0, 
    facingRight: true,
    isAttacking: false,
    attackTimer: 0,
    invulnerableTimer: 0,
    isDead: false
  });

  // Level State
  const levelRef = useRef<LevelData | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // --- Audio ---
  const playSound = (type: 'jump' | 'collect' | 'scratch' | 'hit' | 'win' | 'open') => {
    if (isMuted) return;
    // Placeholder for sound API
  };

  // --- Game Mechanics ---

  const initLevel = (levelIdx: number) => {
    const levelTemplate = LEVELS[levelIdx];
    if (!levelTemplate) {
      setStatus('VICTORY');
      return;
    }
    levelRef.current = JSON.parse(JSON.stringify(levelTemplate));
    
    if (levelRef.current) {
        levelRef.current.enemies.forEach(e => {
            e.originalY = e.y;
        });
    
        playerRef.current = {
            ...playerRef.current,
            x: levelRef.current.playerStart.x,
            y: levelRef.current.playerStart.y,
            vx: 0, vy: 0,
            isGrounded: false,
            isDead: false,
            invulnerableTimer: 0
        };
    }
    setYarnsCollected(0);
    setShowDoorMessage(false);
    particlesRef.current = [];
  };

  const spawnParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        id: Math.random().toString(),
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 20 + Math.random() * 20,
        color
      });
    }
  };

  const updateEnemyAI = (enemy: Enemy, player: Rect) => {
      const dist = getDistance(enemy, player);
      
      switch (enemy.enemyType) {
          case EnemyType.DOG:
              if (enemy.state === 'SLEEP') {
                  if (dist < enemy.detectionRange) {
                      enemy.state = 'ALERT';
                      enemy.stateTimer = 30; 
                  }
              } else if (enemy.state === 'ALERT') {
                  enemy.stateTimer--;
                  if (enemy.stateTimer <= 0) {
                      enemy.state = 'CHASE';
                      playSound('hit'); 
                  }
              } else if (enemy.state === 'CHASE') {
                  const dx = (player.x + player.w/2) - (enemy.x + enemy.w/2);
                  enemy.direction = dx > 0 ? 1 : -1;
                  enemy.x += enemy.speed * enemy.direction;
                  if (dist > enemy.detectionRange * 2) {
                      enemy.state = 'SLEEP';
                  }
              }
              break;

          case EnemyType.CUCUMBER:
              if (enemy.state === 'HIDDEN') {
                  if (dist < enemy.detectionRange) {
                      enemy.state = 'SURPRISE';
                  }
              } else if (enemy.state === 'SURPRISE') {
                  enemy.y -= 5;
                  if (enemy.originalY && enemy.y < enemy.originalY - 80) {
                      enemy.state = 'PATROL'; 
                  }
              } else if (enemy.state === 'PATROL') {
                  enemy.x += enemy.direction;
                  if (enemy.originalY && enemy.y < enemy.originalY) enemy.y += 2; 
              }
              break;

          case EnemyType.ROOMBA:
          case EnemyType.BIRD:
          default:
              enemy.x += enemy.speed * enemy.direction;
              if (enemy.x <= enemy.patrolStart || enemy.x >= enemy.patrolEnd) {
                  enemy.direction *= -1;
              }
              break;
      }
  };

  const update = (dt: number) => {
    if (status !== 'PLAYING' || !levelRef.current) return;

    const player = playerRef.current;
    const level = levelRef.current;
    const physics = level.physics;

    // --- 1. Player Physics ---
    if (!player.isDead) {
        if (keysRef.current['ArrowRight']) {
            player.vx += 0.8;
            player.facingRight = true;
        } else if (keysRef.current['ArrowLeft']) {
            player.vx -= 0.8;
            player.facingRight = false;
        } else {
            player.vx *= physics.friction;
        }
        
        player.vx += physics.wind;
        player.vx = Math.max(Math.min(player.vx, MOVE_SPEED), -MOVE_SPEED);

        if ((keysRef.current['z'] || keysRef.current[' ']) && player.attackTimer === 0) {
            player.isAttacking = true;
            player.attackTimer = SCRATCH_DURATION;
            playSound('scratch');
        }
    }

    player.vy += GRAVITY;
    player.y += player.vy;
    player.x += player.vx;

    // --- 2. Collisions ---
    player.isGrounded = false;
    player.isWallSliding = false;
    player.wallDir = 0;

    for (const plat of level.platforms) {
        if (player.x + player.w > plat.x && player.x < plat.x + plat.w) {
            if (player.vy > 0 && player.y + player.h >= plat.y && player.y + player.h - player.vy <= plat.y) {
                player.y = plat.y - player.h;
                player.vy = 0;
                player.isGrounded = true;
            } else if (plat.type === 'solid' && player.vy < 0 && player.y <= plat.y + plat.h && player.y - player.vy >= plat.y + plat.h) {
                player.y = plat.y + plat.h;
                player.vy = 0;
            }
        }

        if (plat.type === 'solid' && player.y + player.h > plat.y && player.y < plat.y + plat.h) {
            if (player.vx > 0 && player.x + player.w >= plat.x && player.x + player.w - player.vx <= plat.x) {
                 player.x = plat.x - player.w;
                 player.vx = 0;
                 if (!player.isGrounded) { player.isWallSliding = true; player.wallDir = 1; }
            } else if (player.vx < 0 && player.x <= plat.x + plat.w && player.x - player.vx >= plat.x + plat.w) {
                player.x = plat.x + plat.w;
                player.vx = 0;
                if (!player.isGrounded) { player.isWallSliding = true; player.wallDir = -1; }
            }
        }
    }

    if (keysRef.current['ArrowUp']) {
        if (player.isGrounded) {
            player.vy = JUMP_FORCE;
            player.isGrounded = false;
            playSound('jump');
        } else if (player.isWallSliding) {
            player.vy = WALL_JUMP_FORCE.y;
            player.vx = -player.wallDir * WALL_JUMP_FORCE.x;
            player.isWallSliding = false;
            playSound('jump');
        }
    }

    if (player.isWallSliding && player.vy > 0) player.vy = Math.min(player.vy, WALL_SLIDE_SPEED);

    if (player.x < 0) player.x = 0;
    if (player.x > level.width - player.w) player.x = level.width - player.w;
    if (player.y > level.height + 100) killPlayer();

    // --- 3. Interactions ---
    
    // Yarns
    level.yarns.forEach(yarn => {
        if (!yarn.collected && rectIntersect(player, yarn)) {
            yarn.collected = true;
            setYarnsCollected(p => {
                const newVal = p + 1;
                if (newVal === 3) {
                    setShowDoorMessage(true);
                    playSound('open');
                    setTimeout(() => setShowDoorMessage(false), 3000);
                }
                return newVal;
            });
            setScore(p => p + 100);
            playSound('collect');
            spawnParticles(yarn.x + yarn.w/2, yarn.y + yarn.h/2, '#FCD34D', 10);
        }
    });

    // Enemies
    level.enemies.forEach(enemy => {
        if (enemy.isDead) return;

        updateEnemyAI(enemy, player);

        if (rectIntersect(player, enemy)) {
            let hitEnemy = false;
            if (player.isAttacking) {
                const attackBox: Rect = {
                    x: player.facingRight ? player.x + player.w : player.x - 30,
                    y: player.y, w: 30, h: player.h
                };
                if (rectIntersect(attackBox, enemy)) hitEnemy = true;
            } else if (player.vy > 0 && player.y + player.h < enemy.y + enemy.h / 2) {
                hitEnemy = true;
                player.vy = JUMP_FORCE * 0.5;
            }

            if (hitEnemy) {
                enemy.isDead = true;
                setScore(p => p + 50);
                spawnParticles(enemy.x + enemy.w/2, enemy.y + enemy.h/2, '#EF4444', 15);
            } else if (player.invulnerableTimer === 0 && !player.isDead) {
                killPlayer();
            }
        }
    });

    particlesRef.current.forEach(p => {
        p.x += p.vx + (physics.wind * 0.5);
        p.y += p.vy;
        p.life--;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    if (player.attackTimer > 0) {
        player.attackTimer--;
        if (player.attackTimer === 0) player.isAttacking = false;
    }
    if (player.invulnerableTimer > 0) player.invulnerableTimer--;

    const allCollected = level.yarns.every(y => y.collected);
    if (allCollected && rectIntersect(player, level.door)) {
        handleLevelComplete();
    }
  };

  const killPlayer = () => {
    if (playerRef.current.isDead) return;
    playerRef.current.isDead = true;
    playSound('hit');
    setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) setStatus('GAME_OVER');
        else {
            setTimeout(() => {
                if (levelRef.current) {
                    playerRef.current.x = levelRef.current.playerStart.x;
                    playerRef.current.y = levelRef.current.playerStart.y;
                    playerRef.current.vx = 0; playerRef.current.vy = 0;
                    playerRef.current.isDead = false;
                    playerRef.current.invulnerableTimer = INVULNERABILITY_FRAMES;
                    // Reset enemies
                    levelRef.current.enemies.forEach(e => {
                        e.isDead = false;
                        if(e.enemyType === EnemyType.DOG) e.state = 'SLEEP';
                        if(e.enemyType === EnemyType.CUCUMBER) e.state = 'HIDDEN';
                        if(e.originalY) e.y = e.originalY;
                    });
                }
            }, 1000);
        }
        return newLives;
    });
  };

  const handleLevelComplete = () => {
    setStatus('LEVEL_COMPLETE');
    setScore(p => p + 500);
    playSound('win');
    setTimeout(() => {
        const nextIdx = currentLevelIdx + 1;
        if (nextIdx >= LEVELS.length) setStatus('VICTORY');
        else {
            setCurrentLevelIdx(nextIdx);
            initLevel(nextIdx);
            setStatus('PLAYING');
        }
    }, 2000);
  };

  const gameLoop = useCallback((time: number) => {
    const dt = time - lastTimeRef.current;
    lastTimeRef.current = time;
    update(dt);
    setTick(prev => prev + 1); 
    requestRef.current = requestAnimationFrame(gameLoop);
  }, [currentLevelIdx, status]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (status === 'PLAYING') requestRef.current = requestAnimationFrame(gameLoop);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [status, gameLoop]);

  const startGame = () => {
    setLives(3); setScore(0); setCurrentLevelIdx(0);
    initLevel(0); setStatus('PLAYING');
  };

  // --- Rendering (Visuals Engine) ---
  const getThemeColors = () => {
      const theme = levelRef.current?.theme || 'kitchen';
      switch(theme) {
          case 'kitchen': return 'bg-amber-100 border-amber-800';
          case 'garden': return 'bg-sky-300 border-green-800';
          case 'roof': return 'bg-slate-900 border-slate-600';
          default: return 'bg-gray-100';
      }
  };

  const renderGame = () => {
      if (!levelRef.current) return null;
      const { platforms, enemies, yarns, door } = levelRef.current;
      const player = playerRef.current;
      const allYarnsCollected = yarns.every(y => y.collected);

      return (
          <div className={`relative w-[800px] h-[600px] overflow-hidden border-4 border-black mx-auto shadow-2xl ${getThemeColors()}`}>
              
              {/* --- Backgrounds --- */}
              {levelRef.current.theme === 'kitchen' && (
                  <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
                      backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)',
                      backgroundSize: '40px 40px',
                      backgroundPosition: '0 0, 20px 20px'
                  }}></div>
              )}
              {levelRef.current.theme === 'garden' && (
                  <div className="absolute inset-0 opacity-40 pointer-events-none">
                      <div className="absolute top-10 left-20 w-32 h-10 bg-white rounded-full blur-xl"></div>
                      <div className="absolute top-40 left-60 w-48 h-12 bg-white rounded-full blur-xl"></div>
                  </div>
              )}
              {levelRef.current.theme === 'roof' && (
                  <div className="absolute inset-0 opacity-80 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
              )}

              {/* HUD */}
              <div className="absolute top-4 left-4 z-50 flex gap-4 text-white font-bold text-shadow bg-black/50 p-2 rounded border border-white/20">
                  <div className="flex items-center gap-2"><Heart className="text-red-500 fill-current" size={20} /> x {lives}</div>
                  <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border border-white ${allYarnsCollected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div> 
                      x {yarnsCollected}/3
                  </div>
                  <div>SCORE: {score}</div>
                  {levelRef.current.theme === 'roof' && <div className="flex items-center text-blue-300"><Wind size={16} className="mr-1 animate-pulse"/> VIENTO</div>}
              </div>

              {/* Door Open Notification */}
              {showDoorMessage && (
                  <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-yellow-400 text-black px-6 py-2 rounded-lg border-4 border-black font-bold animate-bounce z-50 shadow-lg">
                      ¡PUERTA ABIERTA!
                  </div>
              )}

              {/* Door */}
              <div 
                className={`absolute transition-all duration-500 ${allYarnsCollected ? 'bg-green-500 shadow-[0_0_20px_#22c55e]' : 'bg-red-900'}`}
                style={{ left: door.x, top: door.y, width: door.w, height: door.h, border: '4px solid #2a1b1a' }}
              >
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-full text-center text-[10px] text-white/80 font-bold bg-black/20">
                      {allYarnsCollected ? 'OPEN' : 'LOCKED'}
                  </div>
                  {allYarnsCollected && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                  <div className="absolute bottom-0 w-full h-2 bg-black/40"></div>
              </div>

              {/* Platforms */}
              {platforms.map((p, i) => {
                  let bgClass = 'bg-stone-700 border-stone-900';
                  let style = {};
                  if (p.texture === 'ice') {
                      bgClass = 'bg-cyan-100 border-cyan-300';
                      style = { backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.4) 25%, transparent 25%)', backgroundSize: '10px 10px' };
                  }
                  if (p.texture === 'table') bgClass = 'bg-amber-800 border-amber-950 shadow-lg';
                  if (p.texture === 'grass') bgClass = 'bg-green-700 border-green-900';

                  return (
                    <div 
                        key={i} 
                        className={`absolute ${bgClass} box-border`}
                        style={{ left: p.x, top: p.y, width: p.w, height: p.h, border: '2px solid rgba(0,0,0,0.5)', ...style }}
                    >
                        {p.texture === 'grass' && <div className="absolute -top-3 left-[-2px] w-[calc(100%+4px)] h-4 bg-green-500 border-t-4 border-green-300 rounded-sm"></div>}
                        {p.texture === 'table' && <div className="absolute top-0 left-0 w-full h-1 bg-amber-600/50"></div>}
                    </div>
                  );
              })}

              {/* Yarns */}
              {yarns.filter(y => !y.collected).map(y => (
                  <div 
                    key={y.id} 
                    className="absolute bg-yellow-400 rounded-full border-2 border-white animate-bounce shadow-lg flex items-center justify-center z-10"
                    style={{ left: y.x, top: y.y, width: y.w, height: y.h }}
                  >
                      <div className="w-full h-[2px] bg-yellow-600 absolute rotate-45"></div>
                      <div className="w-full h-[2px] bg-yellow-600 absolute -rotate-45"></div>
                  </div>
              ))}

              {/* Enemies */}
              {enemies.filter(e => !e.isDead).map(e => (
                  <div 
                    key={e.id} 
                    className={`absolute transition-transform ${e.direction === 1 ? 'scale-x-[-1]' : ''}`}
                    style={{ 
                        left: e.x, top: e.y, width: e.w, height: e.h,
                        opacity: e.state === 'HIDDEN' ? 0.1 : 1
                    }}
                  >
                    {e.enemyType === EnemyType.ROOMBA && (
                        <div className="w-full h-full relative">
                            <div className="absolute bottom-0 w-full h-3/4 bg-gray-800 rounded-full border-2 border-gray-900 overflow-hidden shadow-sm">
                                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-6 border-2 border-gray-600 rounded-full"></div>
                            </div>
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-4 bg-black"></div>
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-2 bg-red-500 rounded-full animate-ping"></div>
                        </div>
                    )}
                    {e.enemyType === EnemyType.DOG && (
                        <div className="w-full h-full relative">
                             <div className={`w-full h-full bg-amber-800 rounded-lg border-2 border-black ${e.state === 'SLEEP' ? 'scale-y-75 mt-2' : ''}`}>
                                 <div className="absolute top-1 right-1 w-2 h-2 bg-black rounded-full"></div>
                                 <div className="absolute top-2 -right-2 w-3 h-2 bg-black rounded-full"></div>
                             </div>
                             {e.state === 'SLEEP' && <div className="absolute -top-4 right-0 text-xs animate-pulse font-bold text-white">Zzz</div>}
                             {e.state === 'ALERT' && <div className="absolute -top-6 right-2 text-red-500 font-bold text-xl animate-bounce">!</div>}
                        </div>
                    )}
                    {e.enemyType === EnemyType.BIRD && (
                        <div className="w-full h-full relative">
                            <div className="w-full h-2/3 bg-blue-500 rounded-full border border-black"></div>
                            <div className="absolute top-2 left-2 w-2 h-2 bg-white rounded-full"></div>
                            <div className="absolute top-[-5px] right-[-5px] w-0 h-0 border-t-[8px] border-t-transparent border-l-[12px] border-l-yellow-400 border-b-[8px] border-b-transparent"></div>
                            <div className="absolute top-[-10px] right-2 w-8 h-4 bg-blue-400 rotate-[-20deg] animate-pulse rounded-full border border-black"></div>
                        </div>
                    )}
                    {e.enemyType === EnemyType.CUCUMBER && (
                        <div className="w-full h-full bg-green-600 rounded-full border-2 border-green-800 flex items-center justify-center shadow-lg">
                             {e.state !== 'HIDDEN' && <div className="text-xs text-white font-bold">!!!</div>}
                        </div>
                    )}
                  </div>
              ))}

              {/* Player - CHOCOLATA (Calico Pixel Art CSS) */}
              <div 
                className={`absolute transition-opacity ${player.invulnerableTimer > 0 && player.invulnerableTimer % 4 < 2 ? 'opacity-50' : 'opacity-100'}`}
                style={{ 
                    left: player.x, top: player.y, width: player.w, height: player.h,
                    transform: `scaleX(${player.facingRight ? 1 : -1})`
                }}
              >
                  <div className={`w-full h-full relative ${player.vx !== 0 ? 'animate-[bounce_0.2s_infinite]' : ''}`}>
                      {/* Body */}
                      <div className="absolute bottom-0 left-0 w-3/4 h-3/4 bg-white border-2 border-black rounded-sm"></div>
                      <div className="absolute bottom-0 right-0 w-1/4 h-1/2 bg-white border-2 border-black rounded-sm"></div>
                      
                      {/* Patches */}
                      <div className="absolute bottom-2 left-0 w-3 h-4 bg-orange-400 opacity-90"></div>
                      <div className="absolute bottom-0 right-1 w-2 h-2 bg-black"></div>

                      {/* Head */}
                      <div className="absolute top-0 left-0 w-3/4 h-3/4 bg-white border-2 border-black rounded-sm z-10">
                          {/* Ears */}
                          <div className="absolute -top-2 left-0 w-2 h-2 bg-orange-400 border border-black"></div>
                          <div className="absolute -top-2 right-0 w-2 h-2 bg-black border border-black"></div>
                          {/* Face */}
                          <div className="absolute top-2 left-1 w-1 h-1 bg-black rounded-full"></div>
                          <div className="absolute top-2 right-1 w-1 h-1 bg-black rounded-full"></div>
                          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-1 h-1 bg-pink-400 rounded-full"></div>
                      </div>

                      {/* Tail */}
                      <div className="absolute bottom-1 -right-2 w-2 h-4 bg-black border border-black origin-bottom rotate-[20deg] animate-pulse rounded-full"></div>
                      
                      {/* Scratch Effect */}
                      {player.isAttacking && (
                          <div className="absolute top-0 -right-8 w-8 h-full flex flex-col justify-around">
                              <div className="w-full h-1 bg-white/90 rounded shadow-[0_0_2px_white]"></div>
                              <div className="w-full h-1 bg-white/90 rounded shadow-[0_0_2px_white]"></div>
                              <div className="w-full h-1 bg-white/90 rounded shadow-[0_0_2px_white]"></div>
                          </div>
                      )}
                  </div>
              </div>

              {/* Particles */}
              {particlesRef.current.map(p => (
                  <div key={p.id} className="absolute w-1.5 h-1.5" style={{ left: p.x, top: p.y, backgroundColor: p.color, opacity: p.life / 20 }}></div>
              ))}
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4 font-mono select-none">
      <div className="scanlines pointer-events-none"></div>
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl text-center text-yellow-400 mb-6 font-bold tracking-wider drop-shadow-[4px_4px_0_rgba(0,0,0,1)] flex items-center justify-center gap-4">
            <PawPrint /> LAS AVENTURAS DE CHOCOLATA <PawPrint />
        </h1>

        {status === 'MENU' && (
             <div className="bg-neutral-800 border-4 border-neutral-600 p-8 rounded-lg text-center shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-yellow-500 to-transparent animate-pulse"></div>
                 <div className="mb-8 space-y-4 text-gray-300 relative z-10">
                     <p className="text-xl text-white">¡Ayuda a Chocolata a recuperar sus ovillos!</p>
                     <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-sm text-left bg-black/50 p-6 rounded border-2 border-gray-700">
                         <div className="flex items-center gap-2"><span className="text-yellow-400 font-bold">ARROWS</span> Move & Jump</div>
                         <div className="flex items-center gap-2"><span className="text-yellow-400 font-bold">SPACE / Z</span> Scratch</div>
                         <div className="col-span-2 text-center text-gray-400 mt-2 italic text-xs border-t border-gray-700 pt-2">Engine v1.3 - Pixel Art Update</div>
                     </div>
                 </div>
                 <button onClick={startGame} className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 px-8 rounded text-xl border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2 mx-auto shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                     <Play size={24} /> JUGAR AHORA
                 </button>
             </div>
        )}

        {status === 'PLAYING' && renderGame()}

        {status === 'GAME_OVER' && (
            <div className="bg-red-900/90 border-4 border-red-500 p-12 rounded-lg text-center text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] shadow-2xl backdrop-blur-sm">
                <h2 className="text-4xl mb-4 text-red-200 font-bold drop-shadow-md">¡GAME OVER!</h2>
                <div className="text-6xl mb-6">😿</div>
                <button onClick={startGame} className="bg-white text-red-900 font-bold py-3 px-6 rounded hover:bg-gray-200 flex items-center gap-2 mx-auto border-b-4 border-gray-300 active:border-b-0 active:translate-y-1"><RefreshCw /> REINTENTAR</button>
            </div>
        )}

        {status === 'LEVEL_COMPLETE' && (
            <div className="bg-green-800/90 border-4 border-green-500 p-12 rounded-lg text-center text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] shadow-2xl backdrop-blur-sm">
                <h2 className="text-4xl mb-4 text-green-200 font-bold">¡NIVEL COMPLETADO!</h2>
                <div className="animate-spin text-6xl mb-6">🧶</div>
            </div>
        )}

        {status === 'VICTORY' && (
            <div className="bg-yellow-600/90 border-4 border-yellow-400 p-12 rounded-lg text-center text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] shadow-2xl backdrop-blur-sm">
                <h2 className="text-5xl mb-6 text-yellow-100 font-bold drop-shadow-lg">¡VICTORIA!</h2>
                <p className="mb-8 text-xl">Chocolata tiene toda su lana.</p>
                <div className="flex justify-center gap-4 text-4xl mb-8">
                    <span className="animate-bounce delay-100">😺</span>
                    <span className="animate-bounce delay-200">🧶</span>
                    <span className="animate-bounce delay-300">💖</span>
                </div>
                <button onClick={() => setStatus('MENU')} className="bg-black text-yellow-400 font-bold py-3 px-6 rounded hover:bg-gray-800 border-2 border-yellow-400">VOLVER AL MENÚ</button>
            </div>
        )}

        <div className="mt-4 flex justify-between text-gray-500 text-xs px-2">
            <div>Las Aventuras de Chocolata &copy; 2025</div>
            <button onClick={() => setIsMuted(!isMuted)} className="hover:text-white flex items-center gap-1 transition-colors">
                {isMuted ? <VolumeX size={16}/> : <Volume2 size={16}/>} {isMuted ? "MUTED" : "SOUND ON"}
            </button>
        </div>
      </div>
    </div>
  );
}