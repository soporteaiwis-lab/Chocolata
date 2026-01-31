import { LevelData, EnemyType, Platform, Enemy, Yarn, Rect } from './types';

// --- Physics Constants ---
export const GRAVITY = 0.6;
export const JUMP_FORCE = -13; 
export const MOVE_SPEED = 6;
export const FRICTION_DEFAULT = 0.8;
export const FRICTION_ICE = 0.96; 
export const WALL_SLIDE_SPEED = 2;
export const WALL_JUMP_FORCE = { x: 9, y: -11 };
export const SCRATCH_DURATION = 15;
export const INVULNERABILITY_FRAMES = 60;

// --- Dimensions ---
export const TILE_SIZE = 40;
export const PLAYER_SIZE = { w: 32, h: 32 };

// --- Level Parser ---
/*
  Legend:
  . = Empty
  X = Solid Block (Wall/Floor)
  = = One-Way Platform (Jump through from bottom, land on top)
  S = Slippery Block (Ice/Wet Floor)
  P = Player Start
  O = Yarn (Ovillo)
  D = Door
  
  Enemies:
  R = Roomba
  C = Cucumber
  G = Dog (Guard)
  B = Bird
*/

const parseLevel = (
    layout: string[], 
    id: number, 
    name: string, 
    description: string, 
    theme: LevelData['theme'],
    physics: { friction: number, wind: number }
): LevelData => {
    const platforms: Platform[] = [];
    const enemies: Enemy[] = [];
    const yarns: Yarn[] = [];
    let playerStart = { x: 50, y: 500 };
    let door: Rect = { x: 0, y: 0, w: 40, h: 80 }; // Default

    // Grid Dimensions
    const height = layout.length * TILE_SIZE;
    const width = layout[0].length * TILE_SIZE;

    layout.forEach((row, rowIdx) => {
        let currentPlat: Platform | null = null;

        for (let colIdx = 0; colIdx < row.length; colIdx++) {
            const char = row[colIdx];
            const x = colIdx * TILE_SIZE;
            const y = rowIdx * TILE_SIZE;

            // --- Platforms (Row merging optimization) ---
            const isSolid = char === 'X';
            const isSlippery = char === 'S';
            const isOneWay = char === '=';
            
            if (isSolid || isSlippery || isOneWay) {
                // Determine texture based on theme and type
                let texture: Platform['texture'] = 'brick';
                if (theme === 'garden') texture = 'grass';
                if (theme === 'kitchen' && isSlippery) texture = 'ice';
                if (theme === 'kitchen' && isSolid) texture = 'brick'; // Floor
                if (theme === 'kitchen' && isOneWay) texture = 'table';
                if (theme === 'roof') texture = 'brick';
                
                const type = isOneWay ? 'oneway' : 'solid';

                // Attempt to merge with previous horizontal platform if same type
                if (currentPlat && 
                    currentPlat.type === type && 
                    currentPlat.isSlippery === isSlippery && 
                    currentPlat.texture === texture &&
                    currentPlat.x + currentPlat.w === x) {
                    // Extend existing platform
                    currentPlat.w += TILE_SIZE;
                } else {
                    if (currentPlat) platforms.push(currentPlat);
                    currentPlat = {
                        x, y, w: TILE_SIZE, h: TILE_SIZE,
                        type,
                        isSlippery,
                        texture
                    };
                }
            } else {
                if (currentPlat) {
                    platforms.push(currentPlat);
                    currentPlat = null;
                }
            }

            // --- Entities ---
            const cx = x + (TILE_SIZE - 24) / 2; // Center for small items
            const cy = y + (TILE_SIZE - 24) / 2;

            switch (char) {
                case 'P':
                    playerStart = { x: x + 4, y: y + (TILE_SIZE - PLAYER_SIZE.h) - 1 };
                    break;
                case 'O':
                    yarns.push({ id: `y-${id}-${x}-${y}`, x: cx, y: cy, w: 24, h: 24, collected: false });
                    break;
                case 'D':
                    // Door is usually 2 tiles high, place at bottom of this tile
                    door = { x: x + 4, y: y - 40, w: 32, h: 80 }; 
                    break;
                case 'R': // Roomba
                    enemies.push({
                        id: `e-${id}-${x}-${y}`, x, y: y + 10, w: 40, h: 30,
                        enemyType: EnemyType.ROOMBA, patrolStart: x - 100, patrolEnd: x + 100,
                        direction: 1, speed: 2, state: 'PATROL', stateTimer: 0, detectionRange: 0
                    });
                    break;
                case 'C': // Cucumber
                    enemies.push({
                        id: `e-${id}-${x}-${y}`, x: x + 5, y: y + 5, w: 30, h: 35,
                        enemyType: EnemyType.CUCUMBER, patrolStart: x, patrolEnd: x,
                        direction: 1, speed: 0, state: 'HIDDEN', stateTimer: 0, detectionRange: 120,
                        originalY: y + 5
                    });
                    break;
                case 'G': // Dog
                    enemies.push({
                        id: `e-${id}-${x}-${y}`, x, y: y + 8, w: 48, h: 32,
                        enemyType: EnemyType.DOG, patrolStart: x - 150, patrolEnd: x + 150,
                        direction: 1, speed: 3.5, state: 'SLEEP', stateTimer: 0, detectionRange: 160
                    });
                    break;
                case 'B': // Bird
                    enemies.push({
                        id: `e-${id}-${x}-${y}`, x, y, w: 40, h: 30,
                        enemyType: EnemyType.BIRD, patrolStart: x - 200, patrolEnd: x + 200,
                        direction: 1, speed: 2.5, state: 'PATROL', stateTimer: 0, detectionRange: 0
                    });
                    break;
            }
        }
        if (currentPlat) platforms.push(currentPlat);
    });

    // Add boundaries
    platforms.push({ x: -40, y: 0, w: 40, h: height, type: 'solid' }); // Left
    platforms.push({ x: width, y: 0, w: 40, h: height, type: 'solid' }); // Right
    // Top boundary is open-ish
    platforms.push({ x: 0, y: -1000, w: width, h: 40, type: 'solid' });

    return {
        id, name, description, theme, physics,
        playerStart, platforms, enemies, yarns, door,
        width, height
    };
};

// --- Level Designs ---

// Level 1: La Cocina Caótica
// Redesigned to be more open. 3 Yarns guaranteed.
// = = One Way Platform (Table tops, shelves)
const LEVEL_1_MAP = [
    "....................",
    "....................",
    "X.....O.............", // High Yarn
    "X....===............", // High Shelf
    "X.........===......X", // Mid Shelf
    "X..................X", 
    "X....O.............X", // Mid Yarn
    "X...====...........X", // Table
    "X...=..=......O....X", // Low Yarn (on floor right)
    "X...=..=...........X", 
    "XP.......R.........X", // Player Start & Roomba
    "XXXXX......SSSSSS..X", 
    "X..........S....S..X",
    "X...C......S.D..S..X", // Door accessed via slip floor
    "SSSSSSSSSSSSSSSSSSSS", // Floor
];

// Level 2: El Jardín
const LEVEL_2_MAP = [
    "....................",
    "....................",
    "X.....B............X",
    "X..........O.......X", // Yarn 1
    "X..................X",
    "X.......XXXXX......X", // Branch
    "X...O..............X", // Yarn 2
    "X.XXXXX.........O..X", // Yarn 3 (Mid branch)
    "X..................X",
    "X.......XXXXXX.....X", 
    "X...P..............X",
    "X.................DX", 
    "X................XXX",
    "X......G.......G...X", 
    "XXXXXXXXXXXXXXXXXXXX", 
];

// Level 3: El Tejado
const LEVEL_3_MAP = [
    "....................",
    "....................",
    "X..................X",
    "X...O.....B........X", // Yarn 1
    "X..XXX.............X", 
    "X...X..............X",
    "X...X.......XXXX...X", 
    "X.......O...X......X", // Yarn 2
    "X...........X......X",
    "X.XXXX......X...O..X", // Yarn 3
    "X....X......X..XXXXX",
    "X....X......X......X",
    "X....P......X..D...X",
    "X......B...........X",
    "XXXXXXXXXXXXXXXXXXXX",
];

export const LEVELS = [
    parseLevel(LEVEL_1_MAP, 1, "La Cocina Caótica", "¡Cuidado con la Roomba!", 'kitchen', { friction: FRICTION_ICE, wind: 0 }),
    parseLevel(LEVEL_2_MAP, 2, "El Jardín", "No despiertes a los perros.", 'garden', { friction: FRICTION_DEFAULT, wind: 0 }),
    parseLevel(LEVEL_3_MAP, 3, "El Tejado", "¡Mucho viento!", 'roof', { friction: FRICTION_DEFAULT, wind: -0.25 }),
];