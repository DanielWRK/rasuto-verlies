/* =========================================
   SISTEMA DE JEFES (DICCIONARIO GLOBAL)
   ========================================= */
const CONFIG_JEFES = {
    pingpong: {
        tipo: 'jefe_pingpong',
        hpBase: 3,
        radio: 50, // Es más grande
        emoji: '🏓', // ¡El Rey del Ping Pong!
        init: (jefe) => {
            jefe.timerAtaque = 120; // 2 segundos antes de servir la primera bola
            jefe.bola = null; 
            // Posición fija inicial arriba
            jefe.x = 400;
            jefe.y = 150; 
        }
    }
};
