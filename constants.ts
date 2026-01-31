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
export const MAX_LIVES = 9; 

// --- Assets (High Quality Unsplash Textures) ---
export const ASSETS = {
    bg: {
        kitchen: "https://images.unsplash.com/photo-1556910103-1c02745a30bf?q=80&w=1600&auto=format&fit=crop", 
        garden: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?q=80&w=1600&auto=format&fit=crop", 
        roof: "https://images.unsplash.com/photo-1534234828569-1f27c71f9855?q=80&w=1600&auto=format&fit=crop", // More cloudy/windy look
        castle: "https://images.unsplash.com/photo-1505587043598-a6da2ee1da2f?q=80&w=1600&auto=format&fit=crop", // Spooky Foggy Castle
    },
    textures: {
        brick: "https://images.unsplash.com/photo-1588612547040-798c602058b8?q=80&w=200&auto=format&fit=crop", // Red Brick
        wood: "https://images.unsplash.com/photo-1542456637-a16f6b571182?q=80&w=200&auto=format&fit=crop", // Dark Wood
        table: "https://images.unsplash.com/photo-1513682902306-03c004386903?q=80&w=200&auto=format&fit=crop", // Light Wood
        grass: "https://images.unsplash.com/photo-1558223611-64c6dc9014b2?q=80&w=200&auto=format&fit=crop",
        ice: "https://images.unsplash.com/photo-1571783472097-4b7113f8c5b9?q=80&w=200&auto=format&fit=crop", // Blue Ice
        stone: "https://images.unsplash.com/photo-1629016943072-0bf0ce4e2608?q=80&w=200&auto=format&fit=crop", // Grey Castle Stone
    }
    // Note: Characters are now rendered via SVG components in App.tsx to prevent broken images.
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
                        direction: 1, speed: 2, state: 'PATROL', stateTimer: 0, detectionRange: 0
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
                        direction: 1, speed: 3.5, state: 'SLEEP', stateTimer: 0, detectionRange: 160
                    });
                    break;
                case 'B': 
                    enemies.push({
                        id: `e-${id}-${x}-${y}`, x, y, w: 40, h: 30,
                        enemyType: EnemyType.BIRD, patrolStart: x - 200, patrolEnd: x + 200,
                        direction: 1, speed: 2.5, state: 'PATROL', stateTimer: 0, detectionRange: 0
                    });
                    break;
                case 'H': // Ghost (H for Haunt)
                     enemies.push({
                        id: `e-${id}-${x}-${y}`, x, y: y - 20, w: 32, h: 40,
                        enemyType: EnemyType.GHOST, patrolStart: x - 150, patrolEnd: x + 150,
                        direction: 1, speed: 1.5, state: 'PATROL', stateTimer: 0, detectionRange: 0
                    });
                    break;
            }
        }
        if (currentPlat) platforms.push(currentPlat);
    });

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

// Level 1: La Cocina Caótica
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

// Level 2: El Jardín
const LEVEL_2_MAP = [
    "....................",
    "....................",
    "X.....B............X",
    "X..........O.......X",
    "X..................X",
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

// Level 3: El Tejado
const LEVEL_3_MAP = [
    "....................",
    "....................",
    "X..................X",
    "X...O.....B........X",
    "X..XXX.............X", 
    "X...X..............X",
    "X...X.......XXXX...X", 
    "X.......O...X......X",
    "X...........X......X",
    "X.XXXX......X...O..X",
    "X....X......X..XXXXX",
    "X....X......X......X",
    "X....P......X..D...X",
    "X......B...........X",
    "XXXXXXXXXXXXXXXXXXXX", 
];

// Level 4: El Castillo Embrujado (New Final Level)
const LEVEL_4_MAP = [
    "....................",
    "....................",
    "...................X",
    "X......O...H.......X", 
    "X..XXXXXXXXXXXX....X", 
    "X..X...............X",
    "X..X.....H.........X", 
    "X..X..XXXXXX.......X",
    "X..X.......X....O..X",
    "X..X...O...X.......X",
    "X..X..XXXXXX.......X",
    "X..X.......X.......X",
    "X..X..P....X...D...X", // Door is actually a cage for Ayelen logic
    "X..X.......X.......X",
    "XXXXXXXXXXXXXXXXXXXX", 
];

export const LEVELS = [
    parseLevel(LEVEL_1_MAP, 1, "La Cocina Caótica", "¡Cuidado con la Roomba!", 'kitchen', { friction: FRICTION_ICE, wind: 0 }),
    parseLevel(LEVEL_2_MAP, 2, "El Jardín", "No despiertes a los perros.", 'garden', { friction: FRICTION_DEFAULT, wind: 0 }),
    parseLevel(LEVEL_3_MAP, 3, "El Tejado", "¡Mucho viento!", 'roof', { friction: FRICTION_DEFAULT, wind: -0.25 }),
    parseLevel(LEVEL_4_MAP, 4, "El Castillo Embrujado", "¡Rescata a Ayelen!", 'castle', { friction: FRICTION_DEFAULT, wind: 0 }),
];
