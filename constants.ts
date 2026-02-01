import { LevelData, EnemyType, Platform, Enemy, Yarn, Rect } from './types';

// --- Physics Constants ---
export const GRAVITY = 0.6;
export const JUMP_FORCE = -13.5; // Slightly increased for better feel
export const MOVE_SPEED = 6;
export const FRICTION_DEFAULT = 0.8;
export const FRICTION_ICE = 0.96; 
export const WALL_SLIDE_SPEED = 2;
export const WALL_JUMP_FORCE = { x: 10, y: -12 };
export const SCRATCH_DURATION = 15;
export const INVULNERABILITY_FRAMES = 60;
export const MAX_LIVES = 9; 

// --- Assets (Backgrounds Only - Platforms are now CSS Generated) ---
export const ASSETS = {
    bg: {
        // High quality atmospheric backgrounds
        kitchen: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=1600&auto=format&fit=crop", 
        garden: "https://images.unsplash.com/photo-1518131392939-78709569c878?q=80&w=1600&auto=format&fit=crop", 
        roof: "https://images.unsplash.com/photo-1516934898236-84883492576b?q=80&w=1600&auto=format&fit=crop",
        castle: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1600&auto=format&fit=crop", // More mystical castle
    },
    // Theme Colors for CSS 3D Rendering
    themes: {
        kitchen: {
            top: '#f3f4f6', // White marble top
            face: '#d1d5db', // Grey marble face
            side: '#6b7280', // Dark shadow
            accent: '#e5e7eb'
        },
        garden: {
            top: '#4ade80', // Grass top
            face: '#78350f', // Dirt face
            side: '#451a03', // Dark dirt shadow
            accent: '#22c55e'
        },
        roof: {
            top: '#f87171', // Red tile top
            face: '#dc2626', // Darker red face
            side: '#991b1b', // Shadow
            accent: '#fee2e2'
        },
        castle: {
            top: '#525252', // Stone top
            face: '#262626', // Dark stone face
            side: '#171717', // Black shadow
            accent: '#737373'
        }
    }
};

// --- Dimensions ---
export const TILE_SIZE = 40;
export const PLAYER_SIZE = { w: 32, h: 32 };

// --- Level Parser ---
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
    let door: Rect = { x: 0, y: 0, w: 40, h: 80 }; 

    const height = layout.length * TILE_SIZE;
    const width = layout[0].length * TILE_SIZE;

    layout.forEach((row, rowIdx) => {
        let currentPlat: Platform | null = null;

        for (let colIdx = 0; colIdx < row.length; colIdx++) {
            const char = row[colIdx];
            const x = colIdx * TILE_SIZE;
            const y = rowIdx * TILE_SIZE;

            const isSolid = char === 'X';
            const isSlippery = char === 'S';
            const isOneWay = char === '=';
            
            if (isSolid || isSlippery || isOneWay) {
                let texture: Platform['texture'] = 'brick';
                if (theme === 'garden') texture = 'grass';
                if (theme === 'kitchen' && isSlippery) texture = 'ice';
                if (theme === 'kitchen' && isOneWay) texture = 'table';
                if (theme === 'castle') texture = 'stone';
                
                const type = isOneWay ? 'oneway' : 'solid';

                // Optimization: Merge adjacent platforms of same type into one wide platform
                if (currentPlat && 
                    currentPlat.type === type && 
                    currentPlat.isSlippery === isSlippery && 
                    currentPlat.texture === texture &&
                    currentPlat.x + currentPlat.w === x) {
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

            const cx = x + (TILE_SIZE - 24) / 2;
            const cy = y + (TILE_SIZE - 24) / 2;

            switch (char) {
                case 'P': playerStart = { x: x + 4, y: y + (TILE_SIZE - PLAYER_SIZE.h) - 1 }; break;
                case 'O': yarns.push({ id: `y-${id}-${x}-${y}`, x: cx, y: cy, w: 24, h: 24, collected: false }); break;
                case 'D': door = { x: x + 4, y: y - 40, w: 32, h: 80 }; break;
                case 'R': 
                    enemies.push({
                        id: `e-${id}-${x}-${y}`, x, y: y + 10, w: 40, h: 30,
                        enemyType: EnemyType.ROOMBA, patrolStart: x - 100, patrolEnd: x + 100,
                        direction: 1, speed: 2, state: 'PATROL', stateTimer: 0, detectionRange: 0,
                        originalY: y + 10
                    });
                    break;
                case 'C': 
                    enemies.push({
                        id: `e-${id}-${x}-${y}`, x: x + 5, y: y + 5, w: 30, h: 35,
                        enemyType: EnemyType.CUCUMBER, patrolStart: x, patrolEnd: x,
                        direction: 1, speed: 0, state: 'HIDDEN', stateTimer: 0, detectionRange: 120,
                        originalY: y + 5
                    });
                    break;
                case 'G': 
                    enemies.push({
                        id: `e-${id}-${x}-${y}`, x, y: y + 8, w: 48, h: 32,
                        enemyType: EnemyType.DOG, patrolStart: x - 150, patrolEnd: x + 150,
                        direction: 1, speed: 3.5, state: 'SLEEP', stateTimer: 0, detectionRange: 160,
                        originalY: y + 8
                    });
                    break;
                case 'B': 
                    enemies.push({
                        id: `e-${id}-${x}-${y}`, x, y, w: 40, h: 30,
                        enemyType: EnemyType.BIRD, patrolStart: x - 200, patrolEnd: x + 200,
                        direction: 1, speed: 2.5, state: 'PATROL', stateTimer: 0, detectionRange: 0,
                        originalY: y
                    });
                    break;
                case 'H': 
                     enemies.push({
                        id: `e-${id}-${x}-${y}`, x, y: y - 20, w: 32, h: 40,
                        enemyType: EnemyType.GHOST, patrolStart: x - 150, patrolEnd: x + 150,
                        direction: 1, speed: 1.5, state: 'PATROL', stateTimer: 0, detectionRange: 0,
                        originalY: y - 20
                    });
                    break;
            }
        }
        if (currentPlat) platforms.push(currentPlat);
    });

    // World Boundaries
    platforms.push({ x: -40, y: 0, w: 40, h: height, type: 'solid' }); 
    platforms.push({ x: width, y: 0, w: 40, h: height, type: 'solid' }); 
    platforms.push({ x: 0, y: -1000, w: width, h: 40, type: 'solid' });

    return {
        id, name, description, theme, physics,
        playerStart, platforms, enemies, yarns, door,
        width, height
    };
};

// --- Level Designs ---
// LEGEND:
// . = Empty
// X = Solid Wall/Floor
// = = One-Way Platform (Jump up through it)
// S = Slippery Floor
// P = Player Start
// O = Yarn (Objective)
// D = Door (Exit)
// Enemies: R (Roomba), C (Cucumber), G (Dog), B (Bird), H (Ghost)

const LEVEL_1_MAP = [
    "....................",
    "....................",
    "X.....O.............",
    "X....===............",
    "X.........===......X",
    "X..................X", 
    "X....O.............X",
    "X...====...........X",
    "X...=..=......O....X",
    "X...=..=...........X", 
    "XP.......R.........X",
    "XXXXX..............X",
    "X..................X",
    "X...C...........D..X",
    "SSSSSSSSSSSSSSSSSSSS",
];

const LEVEL_2_MAP = [
    "....................",
    "..............O.....",
    "X.....B.....====...X",
    "X..................X",
    "X...====...........X",
    "X.......XXXXX......X",
    "X...O..............X",
    "X.XXXXX.........O..X",
    "X..................X",
    "X.......XXXXXX.....X", 
    "X...P..............X",
    "X.................DX", 
    "X................XXX",
    "X......G.......G...X", 
    "XXXXXXXXXXXXXXXXXXXX", 
];

const LEVEL_3_MAP = [
    "....................",
    "....................",
    "X...O.....B........X",
    "X..===.............X", // Changed to platform for easier jump
    "X...X..............X",
    "X...X.......====...X", // Changed to platform
    "X.......O...X......X",
    "X...........X......X",
    "X.XXXX......X...O..X",
    "X....X......X..XXXXX",
    "X....X......X......X",
    "X....P......X..D...X", 
    "X......B...........X",
    "XXXXXXXXXXXXXXXXXXXX", 
];

// REBUILT LEVEL 4: Verticality focus, using One-Way platforms (=) to allow climbing up without getting blocked.
const LEVEL_4_MAP = [
    "...................D", // Top Right Exit
    "...............=====", 
    "......O........X....", 
    "....=====H.....X....", // Floating platform mid-air
    "...............X....",
    "...........O...=....", // Right side climb
    "....H......=...=....",
    "...........=...XXXXX",
    "....====...=.......X",
    "...........=.......X",
    "....====...=.......X",
    "O..........=.......X", // Bottom Left Yarn
    "XX.........=.......X",
    "X...P..............X", // Start
    "XXXXXXXXXXXXXXXXXXXX", 
];

export const LEVELS = [
    parseLevel(LEVEL_1_MAP, 1, "La Cocina Caótica", "¡Cuidado con la Roomba!", 'kitchen', { friction: FRICTION_ICE, wind: 0 }),
    parseLevel(LEVEL_2_MAP, 2, "El Jardín", "No despiertes a los perros.", 'garden', { friction: FRICTION_DEFAULT, wind: 0 }),
    parseLevel(LEVEL_3_MAP, 3, "El Tejado", "¡Mucho viento!", 'roof', { friction: FRICTION_DEFAULT, wind: -0.2 }),
    parseLevel(LEVEL_4_MAP, 4, "El Castillo Embrujado", "¡Rescata a Ayelen!", 'castle', { friction: FRICTION_DEFAULT, wind: 0 }),
];