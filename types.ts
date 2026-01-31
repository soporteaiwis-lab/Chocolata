
export type Vector2 = {
  x: number;
  y: number;
};

export type Size = {
  w: number;
  h: number;
};

export type Rect = Vector2 & Size;

export enum EntityType {
  PLAYER = 'PLAYER',
  PLATFORM = 'PLATFORM',
  ENEMY = 'ENEMY',
  YARN = 'YARN',
  DOOR = 'DOOR',
  OBSTACLE = 'OBSTACLE'
}

export enum EnemyType {
  ROOMBA = 'ROOMBA',
  DOG = 'DOG',
  BIRD = 'BIRD',
  CUCUMBER = 'CUCUMBER',
  GHOST = 'GHOST' // New Enemy for Castle
}

export interface Platform extends Rect {
  type: 'solid' | 'oneway';
  isSlippery?: boolean;
  texture?: 'grass' | 'brick' | 'table' | 'ice' | 'stone'; // Added stone
}

export type EnemyState = 'PATROL' | 'SLEEP' | 'ALERT' | 'CHASE' | 'HIDDEN' | 'SURPRISE';

export interface Enemy extends Rect {
  id: string;
  enemyType: EnemyType;
  patrolStart: number;
  patrolEnd: number;
  direction: 1 | -1;
  speed: number;
  isDead?: boolean;
  
  // AI State
  state: EnemyState;
  stateTimer: number; 
  detectionRange: number; 
  originalY?: number; 
}

export interface Yarn extends Rect {
  id: string;
  collected: boolean;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface LevelData {
  id: number;
  name: string;
  description: string;
  theme: 'kitchen' | 'garden' | 'roof' | 'castle';
  physics: {
    friction: number;
    wind: number;
  };
  playerStart: Vector2;
  platforms: Platform[];
  enemies: Enemy[];
  yarns: Yarn[];
  door: Rect;
  width: number;
  height: number;
}

export type GameStatus = 'MENU' | 'PLAYING' | 'LEVEL_COMPLETE' | 'GAME_OVER' | 'VICTORY';
