/* =========================================
   CONECTORES DE INTERFAZ Y RATÓN
   ========================================= */

window.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (gameState.teclas.hasOwnProperty(key)) gameState.teclas[key] = true;
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (gameState.teclas.hasOwnProperty(key)) gameState.teclas[key] = false;
});

// 1. NUEVA PARTIDA -> Manda al LOBBY
document.getElementById('btn-jugar')?.addEventListener('click', () => {
    gameState.zonaActual = 1; 
    generarLobby(); // 👈 Se genera el Lobby aquí
    cambiarEscena('LOBBY');
});

document.getElementById('btn-cargar')?.addEventListener('click', () => {
    const partidaGuardada = localStorage.getItem('rasuto_save');
    if (partidaGuardada) {
        const datosCargados = JSON.parse(partidaGuardada);
        gameState.zonaActual = datosCargados.zonaActual;
        Object.assign(gameState.jugador, datosCargados.jugador);
        
        generarZona(); // 👈 Se genera la Mazmorra aquí
        cambiarEscena('MAZMORRA'); 
    } else {
        alert("❌ No se encontró ninguna partida guardada en este navegador.");
    }
});


// 2. REANUDAR -> Devuelve al LOBBY o a la MAZMORRA
document.getElementById('btn-reanudar')?.addEventListener('click', () => {
    if(gameState.tipoPortal === 'ENTRADA_MAZMORRA') {
        cambiarEscena('LOBBY');
    } else {
        cambiarEscena('MAZMORRA');
    }
});

// 3. ABANDONAR PARTIDA -> Vuelve al MENU
document.getElementById('btn-salir')?.addEventListener('click', () => {
    cambiarEscena('MENU');
});

// 4. GUARDAR PROGRESO (Botón de Pausa)
document.getElementById('btn-guardar')?.addEventListener('click', () => {
    // Validar que no haya monstruos vivos
    if (gameState.enemigos.length > 0) {
        alert("⚔️ ¡No puedes descansar ahora! Aún hay enemigos en esta zona.");
        return;
    }

    // Empaquetar la memoria vital
    const datosGuardado = {
        zonaActual: gameState.zonaActual + 1,
        jugador: gameState.jugador
    };

    // Guardar en el navegador
    localStorage.setItem('rasuto_save', JSON.stringify(datosGuardado));
    alert("✅ Progreso guardado con éxito. Puedes abandonar la partida seguro.");
});

// 6. MANEJO DE PAUSA (Al presionar ESC, el navegador quita el Mouse Lock)
let bucleActivo = false;
document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
        gameState.corriendo = true;
        // Evitamos que el bucle corra al doble de velocidad
        if (!bucleActivo) {
            bucleActivo = true;
            bucleJuego();
        }
    } else {
        gameState.corriendo = false;
        bucleActivo = false;
        // Si estábamos jugando y salimos del Mouse Lock, forzamos la escena de PAUSA
        if (gameState.escenaActual === 'MAZMORRA' || gameState.escenaActual === 'LOBBY') {
            cambiarEscena('PAUSA');
        }
    }
});

/* =========================================
   CONTROLES DE JUEGO (MOVIMIENTO Y COMBATE)
   ========================================= */

document.addEventListener('mousemove', (e) => {
    if (!gameState.corriendo) return;
    gameState.mouse.x += e.movementX;
    gameState.mouse.y += e.movementY;
    if (gameState.mouse.x < 0) gameState.mouse.x = 0;
    if (gameState.mouse.x > canvas.width) gameState.mouse.x = canvas.width;
    if (gameState.mouse.y < 0) gameState.mouse.y = 0;
    if (gameState.mouse.y > canvas.height) gameState.mouse.y = canvas.height;
});

document.addEventListener('mousedown', (e) => {
    if (!gameState.corriendo) return;
    const p = gameState.jugador;

    // ATAQUE PRINCIPAL
    if (e.button === 0 && p.ataqueCooldownTimer === 0 && p.dashFramesActivos === 0 && !p.escudoActivo) {
        let arma = CONFIG_ARMAS[p.armaActual];
        
        p.atacando = true;
        p.progresoAtaque = 0;
        p.ataqueCooldownTimer = Math.max(10, arma.cooldownBase - p.velocidadAtaqueItem);
        
        if (arma.tipoHitbox === 'proyectil') {
            gameState.proyectilesJugador.push({
                x: p.x + Math.cos(p.anguloMirada) * p.radio, 
                y: p.y + Math.sin(p.anguloMirada) * p.radio,
                vx: Math.cos(p.anguloMirada) * arma.velocidadProyectil,
                vy: Math.sin(p.anguloMirada) * arma.velocidadProyectil,
                radio: 4,
                daño: arma.daño
            });
        } else {
            gameState.enemigos.forEach(en => en.golpeadoEnEsteAtaque = false);
        }
    }

    // ESCUDO (Click Derecho)
    if (e.button === 2 && p.tieneEscudo && p.stamina >= p.staminaMax && !p.escudoActivo && p.dashFramesActivos === 0 && !p.atacando) {
        p.stamina -= p.staminaMax; 
        p.escudoActivo = true;
        p.escudoRadioActual = p.radio; 
    }
});

document.addEventListener('keydown', (e) => {
    if (!gameState.corriendo) return;
    const p = gameState.jugador;
    
    if (e.repeat) return; 
    
    // DASH (Esquivar)
    if (e.key === 'Shift') {
        if (p.stamina < p.staminaMax) return; 
        if (p.dashFramesActivos === 0 && !p.escudoActivo) {
            p.stamina = 0; 
            p.dashFramesActivos = 8; 
            let dx = 0; let dy = 0;
            if (gameState.teclas.w) dy -= 1;
            if (gameState.teclas.s) dy += 1;
            if (gameState.teclas.a) dx -= 1;
            if (gameState.teclas.d) dx += 1;
            if (dx !== 0 || dy !== 0) {
                p.anguloDash = Math.atan2(dy, dx);
            } else {
                p.anguloDash = p.anguloMirada;
            }
        }
    }
});

/* =========================================
   CONTROLES DEL MODO DESARROLLADOR
   ========================================= */

// Abrir el panel con F2
document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
        if (gameState.corriendo) document.exitPointerLock(); // Pausa forzada
        document.getElementById('pantalla-pausa').style.display = 'none';
        document.getElementById('panel-debug').style.display = 'flex';
        
        document.getElementById('dbg-hp').value = gameState.jugador.hp;
    }
});

// Botón de guardar y reanudar (Debug)
document.getElementById('btn-cerrar-debug')?.addEventListener('click', () => {
      gameState.debug.enemigosActivos = document.getElementById('dbg-enemigos').checked;
    gameState.jugador.hp = parseInt(document.getElementById('dbg-hp').value);
    gameState.jugador.armaActual = document.getElementById('dbg-arma').value;
    gameState.debug.mejoras.fuego = document.getElementById('dbg-fuego').checked;
    gameState.debug.mejoras.dashDanino = document.getElementById('dbg-dash').checked;
    
    document.getElementById('panel-debug').style.display = 'none';
    canvas.requestPointerLock();
});
