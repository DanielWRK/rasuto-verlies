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

btnJugar.addEventListener('click', () => {
    pantallaInicio.style.display = 'none';
    contenedorJuego.style.display = 'block';
    canvas.requestPointerLock();
    generarZona();
});

document.getElementById('btn-reanudar').addEventListener('click', () => {
    canvas.requestPointerLock();
});

document.getElementById('btn-salir').addEventListener('click', () => {
    // Resetear el juego y volver al menú principal
    gameState.corriendo = false;
    document.getElementById('pantalla-pausa').style.display = 'none';
    document.getElementById('pantalla-inicio').style.display = 'flex';
    document.exitPointerLock();
});

// Guardar Partida (Botón de Pausa)
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

    // Guardar en el navegador (Convertido a Texto)
    localStorage.setItem('rasuto_save', JSON.stringify(datosGuardado));
    alert("✅ Progreso guardado con éxito. Puedes abandonar la partida seguro.");
});

// Cargar Partida (Botón de Inicio)
document.getElementById('btn-cargar')?.addEventListener('click', () => {
    const partidaGuardada = localStorage.getItem('rasuto_save');
    
    if (partidaGuardada) {
        // Desempaquetar la memoria
        const datosCargados = JSON.parse(partidaGuardada);
        
        // Restaurar estado
        gameState.zonaActual = datosCargados.zonaActual;
        // Fusionamos los stats guardados del jugador con el objeto actual
        Object.assign(gameState.jugador, datosCargados.jugador);
        
        pantallaInicio.style.display = 'none';
        contenedorJuego.style.display = 'block';
        canvas.requestPointerLock();
        
        // Generar la zona correspondiente a la que guardó
        generarZona(); 
    } else {
        alert("❌ No se encontró ninguna partida guardada en este navegador.");
    }
});


document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
        gameState.corriendo = true;
        pantallaPausa.style.display = 'none';
        bucleJuego();
    } else {
        gameState.corriendo = false;
        if (pantallaInicio.style.display === 'none') pantallaPausa.style.display = 'flex';
    }
});

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
        // ATAQUE PRINCIPAL
        if (e.button === 0 && p.ataqueCooldownTimer === 0 && p.dashFramesActivos === 0 && !p.escudoActivo) {
            let arma = CONFIG_ARMAS[p.armaActual];
            
            p.atacando = true;
            p.progresoAtaque = 0;
            p.ataqueCooldownTimer = Math.max(10, arma.cooldownBase - p.velocidadAtaqueItem);
            
            // 🔥 NUEVO: Si es arma de rango, dispara la flecha al hacer clic
            if (arma.tipoHitbox === 'proyectil') {
                gameState.proyectilesJugador.push({
                    x: p.x + Math.cos(p.anguloMirada) * p.radio, // Sale desde el borde del jugador
                    y: p.y + Math.sin(p.anguloMirada) * p.radio,
                    vx: Math.cos(p.anguloMirada) * arma.velocidadProyectil,
                    vy: Math.sin(p.anguloMirada) * arma.velocidadProyectil,
                    radio: 4,
                    daño: arma.daño
                });
                } else {
                    // Solo reiniciamos esto si es cuerpo a cuerpo
                    gameState.enemigos.forEach(en => en.golpeadoEnEsteAtaque = false);
                }
            }


    
        if (e.button === 2 && p.tieneEscudo && p.stamina >= p.staminaMax && !p.escudoActivo && p.dashFramesActivos === 0 && !p.atacando) {
            p.stamina -= p.staminaMax; // Drena TODA la barra (100%)
            p.escudoActivo = true;
            p.escudoRadioActual = p.radio; 
    }
});

document.addEventListener('keydown', (e) => {
    if (!gameState.corriendo) return;
    const p = gameState.jugador;
    
    // 🔥 CORRECCIÓN: Evita que el teclado spamee el dash si dejas presionado el SHIFT
    if (e.repeat) return; 
    
    // Si presiona Shift, verificamos que la stamina esté al 100% (totalmente llena)
    if (e.key === 'Shift') {
        // Si no está totalmente llena, se ignora por completo el comando
        if (p.stamina < p.staminaMax) return; 

        if (p.dashFramesActivos === 0 && !p.escudoActivo) {
            p.stamina = 0; // Al usarlo, vacía la barra por completo
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
        
        // Cargar los valores actuales de la memoria al panel HTML
        document.getElementById('dbg-hp').value = gameState.jugador.hp;
    }
});

// Botón de guardar y reanudar
document.getElementById('btn-cerrar-debug').addEventListener('click', () => {
    // 1. Extraer los datos del panel HTML
    gameState.debug.enemigosActivos = document.getElementById('dbg-enemigos').checked;
    gameState.jugador.hp = parseInt(document.getElementById('dbg-hp').value);
    gameState.jugador.armaActual = document.getElementById('dbg-arma').value;
    gameState.debug.mejoras.fuego = document.getElementById('dbg-fuego').checked;
    gameState.debug.mejoras.dashDanino = document.getElementById('dbg-dash').checked;

    // 2. Cerrar panel y volver al juego
    document.getElementById('panel-debug').style.display = 'none';
    canvas.requestPointerLock();
});
