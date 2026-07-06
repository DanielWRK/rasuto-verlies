/* =========================================
   ESTADO GLOBAL DEL JUEGO
   ========================================= */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const pantallaInicio = document.getElementById('pantalla-inicio');
const pantallaPausa = document.getElementById('pantalla-pausa');
const contenedorJuego = document.getElementById('contenedor-juego');
const btnJugar = document.getElementById('btn-jugar');

const GRID_SIZE = 8;
const CELL_SIZE = 100; // 800x800 dividido en 8x8 significa celdas de 100x100

const gameState = {
    corriendo: false,
    teclas: { w: false, a: false, s: false, d: false },
    mouse: { x: 400, y: 400 },
    zonaActual: 1,
    arbustos: [],
    enemigos: [],
    cofres: [],
    proyectilesEnemigos: [],
    retrasoArranque: 0,
    debug: {
        enemigosActivos: true,
        mejoras: { fuego: false, dashDanino: false }
    },
    jugador: {
        x: 450, y: 450, 
        radio: 15,
        velocidad: 4,
        anguloMirada: 0,
        hp: 3,
        maxHp: 3, // <--- ¡VITAL!
        velocidadAtaqueItem: 0, 
        pushbackFrames: 0,
        anguloPushback: 0,
        dashFramesActivos: 0,
        anguloDash: 0,
        stamina: 100, // <--- ¡VITAL!
        staminaMax: 100,
        costoDash: 35,
        costoEscudo: 45,
        tieneEscudo: false,
        escudoActivo: false,
        escudoRadioActual: 0,
        escudoRadioMax: 65,
        armaActual: 'punios',
        atacando: false,
        progresoAtaque: 0, 
        proyectilesJugador: [], 
        ataqueCooldownTimer: 0,
    }
};