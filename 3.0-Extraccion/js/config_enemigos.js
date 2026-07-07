/* =========================================
   SISTEMA DE ENEMIGOS (DICCIONARIO GLOBAL)
   ========================================= */
const CONFIG_ENEMIGOS = {
    zombie: {
        tipo: 'zombie',
        hpBase: 3,
        velocidadBase: 0.5,
        radio: 16,
        emoji: '🧟',
        init: (enemigo, zona) => {
            enemigo.timerPatrulla = 0;
            enemigo.vx = 0; 
            enemigo.vy = 0;
        }
    },
    kamikaze: {
        tipo: 'kamikaze',
        hpBase: 1,
        velocidadBase: 1.2,
        radio: 14,
        emoji: '🏃‍♂️',
        init: (enemigo, zona) => {
        }
    },
    lanzador: {
        tipo: 'lanzador',
        hpBase: 2,
        velocidadBase: 0, 
        radio: 16,
        emoji: '🧙‍♂️',
        init: (enemigo, zona) => {
            enemigo.cooldownBase = Math.max(40, 100 - (zona * 5)); 
            enemigo.cooldownDisparo = 90; 
        }
    }
};