/* =========================================
   MÁQUINA DE ESTADOS (SCENE MANAGER)
   ========================================= */
function cambiarEscena(nuevaEscena) {
    gameState.escenaActual = nuevaEscena;
    
    // 1. Ocultar TODAS las pantallas HTML
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-pausa').style.display = 'none';
    document.getElementById('pantalla-cofre').style.display = 'none';
    document.getElementById('contenedor-juego').style.display = 'none';

    // 2. Mostrar lo que corresponde
    switch(nuevaEscena) {
        case 'MENU':
            document.getElementById('pantalla-inicio').style.display = 'block';
            gameState.corriendo = false;
            break;
            
        case 'LOBBY':
            document.getElementById('contenedor-juego').style.display = 'block';
            gameState.corriendo = true;
            canvas.requestPointerLock();
            break;
            
        case 'MAZMORRA':
            document.getElementById('contenedor-juego').style.display = 'block';
            gameState.corriendo = true;
            canvas.requestPointerLock();
            break;
            
        case 'PAUSA':
            document.getElementById('pantalla-pausa').style.display = 'block';
            document.getElementById('contenedor-juego').style.display = 'block'; // Fondo visible
            gameState.corriendo = false;
            document.exitPointerLock();
            break;
            
        case 'COFRE': // 🔥 NUEVO ESTADO EXCLUSIVO PARA EL COFRE
            document.getElementById('pantalla-cofre').style.display = 'flex';
            document.getElementById('contenedor-juego').style.display = 'block'; // Fondo visible
            gameState.corriendo = false;
            document.exitPointerLock();
            break;
    }
}


/* =========================================
   GENERACIÓN DEL LOBBY (ZONA SEGURA)
   ========================================= */
function generarLobby() {
    // Vaciamos todo el peligro
    gameState.enemigos = [];
    gameState.cofres = [];
    gameState.proyectilesEnemigos = [];
    gameState.proyectilesJugador = [];
    gameState.arbustos = [];
    
    // Ponemos al jugador en el centro
    gameState.jugador.x = 400;
    gameState.jugador.y = 400;
    
    // Forzamos un "portal" azul en la parte superior del mapa
    gameState.portalActivo = true; 
    gameState.tipoPortal = 'ENTRADA_MAZMORRA'; 
}


/* =========================================
   GENERACIÓN PROCEDURAL Y DIFICULTAD
   ========================================= */
function generarZona() {
    gameState.arbustos = [];
    gameState.enemigos = [];
    gameState.cofres = [];
    gameState.proyectilesEnemigos = []; 
    gameState.proyectilesJugador = [];
    gameState.portalActivo = false;

    let zona = gameState.zonaActual;

    // 🔥 SALA DE JEFE (Pisos 5, 10, 15...)
    if (zona % 5 === 0) {
        let def = CONFIG_JEFES['pingpong'];
        let jefe = { 
            x: 400, y: 150, 
            tipo: def.tipo, hp: def.hpBase, radio: def.radio, emoji: def.emoji,
            golpeadoEnEsteAtaque: false, pushbackFrames: 0, anguloPushback: 0 
        };
        def.init(jefe);
        gameState.enemigos.push(jefe);

        // Generar algunos arbustos aleatorios como obstáculos, SIN COFRES
        for(let i=0; i<12; i++) {
            gameState.arbustos.push({ x: 100 + Math.random()*600, y: 250 + Math.random()*450, radio: 22 });
        }
        // Posicionar jugador y salir
        gameState.jugador.x = 400; gameState.jugador.y = 650;
        gameState.retrasoArranque = 90; 
        return; // ¡Termina la generación aquí para que no salgan enemigos normales!
    }

    // 1. ESCALADO MATEMÁTICO SUAVE
    // Zona 1 = Multiplicador 1.0 (Sin buffs). Zona 2 = 1.15, etc.
    let multiplicadorStats = 1 + ((zona - 1) * 0.15); 
    
    // El mapa se llena un poco más cada nivel
    let densidadMundo = Math.min(0.40, 0.20 + (zona * 0.02)); 

    // 2. GARANTIZAR COFRES Y EVITAR SUPERPOSICIONES
    let cofresGarantizados = (zona === 1) ? 2 : 1; // Piso 1 asegura 2 cofres para armarte
    let celdasLibres = [];

    // Recopilamos todas las celdas válidas del mapa
    for (let gY = 1; gY < GRID_SIZE; gY++) { 
        for (let gX = 0; gX < GRID_SIZE; gX++) {
            // Ignoramos la zona segura central (donde nace el jugador)
            if ((gX === 4 && gY === 4) || (gX === 3 && gY === 4) || (gX === 4 && gY === 3)) continue;
            
            celdasLibres.push({
                x: gX * CELL_SIZE + CELL_SIZE / 2, 
                y: gY * CELL_SIZE + CELL_SIZE / 2
            });
        }
    }

    // Mezclamos las celdas aleatoriamente
    celdasLibres.sort(() => Math.random() - 0.5);

    // Plantamos los cofres garantizados sacando celdas de la lista
    for(let i = 0; i < cofresGarantizados; i++) {
        if(celdasLibres.length > 0) {
            let celda = celdasLibres.pop();
            gameState.cofres.push({ x: celda.x, y: celda.y, radio: 18 });
        }
    }

    // 3. GENERAR EL RESTO DEL MAPA (Enemigos y Arbustos)
    celdasLibres.forEach(celda => {
        if (Math.random() < densidadMundo) { 
            let dadoGlobal = Math.random();
            
            // 40% Enemigo, 60% Arbusto
            if (dadoGlobal < 0.40) {
                let dadoTipoEnemigo = Math.random();
                let nuevoEnemigo = { x: celda.x, y: celda.y, golpeadoEnEsteAtaque: false, pushbackFrames: 0, anguloPushback: 0 };
                
                // 🔥 CONTROL ESTRICTO DE TIPOS DE ENEMIGO POR ZONA
                let probZombie = 1.0;
                let probKamikaze = 0.0;
                let probLanzador = 0.0;

                if (zona === 1) {
                    probZombie = 0.85; 
                    probKamikaze = 0.15;
                    probLanzador = 0.0; // Prohibido el lanzador en la Zona 1
                } else if (zona === 2) {
                    probZombie = 0.70; 
                    probKamikaze = 0.30;
                    probLanzador = 0.0; // Prohibido en Zona 2
                } else { // Zona 3 en adelante
                    probZombie = Math.max(0.40, 0.70 - (zona * 0.05)); // Los zombies bajan
                    probKamikaze = 0.30; // Kamikazes se mantienen
                    probLanzador = 1.0 - probZombie - probKamikaze; // El resto son Lanzadores
                }

                // Asignar el enemigo según la probabilidad de la zona
                if (dadoTipoEnemigo < probZombie) {
                    nuevoEnemigo.tipo = 'zombie';
                    nuevoEnemigo.hp = Math.floor(3 * multiplicadorStats);
                    nuevoEnemigo.velocidad = 0.5 * multiplicadorStats;
                    nuevoEnemigo.radio = 16;
                    nuevoEnemigo.emoji = '🧟';
                    nuevoEnemigo.timerPatrulla = 0;
                    nuevoEnemigo.vx = 0; nuevoEnemigo.vy = 0;
                } else if (dadoTipoEnemigo < probZombie + probKamikaze) {
                    nuevoEnemigo.tipo = 'kamikaze';
                    nuevoEnemigo.hp = Math.floor(1 * multiplicadorStats);
                    nuevoEnemigo.velocidad = 1.2 * multiplicadorStats;
                    nuevoEnemigo.radio = 14;
                    nuevoEnemigo.emoji = '🏃‍♂️';
                } else {
                    nuevoEnemigo.tipo = 'lanzador';
                    nuevoEnemigo.hp = Math.floor(2 * multiplicadorStats);
                    nuevoEnemigo.velocidad = 0;
                    nuevoEnemigo.radio = 16;
                    nuevoEnemigo.emoji = '🧙‍♂️';
                    nuevoEnemigo.cooldownBase = Math.max(40, 100 - (zona * 5)); 
                    nuevoEnemigo.cooldownDisparo = 90; 
                }
                gameState.enemigos.push(nuevoEnemigo);
            } else {
                gameState.arbustos.push({ x: celda.x, y: celda.y, radio: 22 });
            }
        }
    });

    // Devolvemos al jugador al centro
    gameState.jugador.x = 450;
    gameState.jugador.y = 450;
    gameState.retrasoArranque = 90; 
}


function bucleJuego() {
    if (!gameState.corriendo) return;
    actualizarMotor();
    dibujarMotor();
    requestAnimationFrame(bucleJuego);
}

/* =========================================
   SISTEMA ROGUELIKE DE SELECCIÓN DE MEJORAS
   ========================================= */

function abrirMenuCofre() {
    cambiarEscena('COFRE'); // 👈 Delega el trabajo a la Máquina de Estados
    
    const p = gameState.jugador;
    const contenedor = document.getElementById('contenedor-opciones');
    contenedor.innerHTML = ''; 
    let opcionesValidas = [];

    if (p.armaActual === 'punios') {
        // 🔥 CORRECCIÓN AQUÍ: Solo cambiamos el nombre del arma, el motor hace el resto
        opcionesValidas.push({ titulo: "⚔️ ESPADA DE BRONCE", desc: "Ataque de barrido (Rango medio)", ejec: () => { p.armaActual = 'espada'; } });
        opcionesValidas.push({ titulo: "🏹 ARCO DE CAZA", desc: "Disparo a distancia (Próximamente)", ejec: () => { p.armaActual = 'arco'; } });
        opcionesValidas.push({ titulo: "🔱 LANZA GUARDIANA", desc: "Estocada recta (Largo alcance)", ejec: () => { p.armaActual = 'lanza'; } });
        
        if (!p.tieneEscudo) {
            opcionesValidas.push({ titulo: "🛡️ ESCUDO DE FUERZA", desc: "Bloquea y empuja (Click Derecho)", ejec: () => { p.tieneEscudo = true; } });
        } else {
            opcionesValidas.push({ titulo: "❤️ VITA MAXIMA", desc: "+1 Corazón máximo", ejec: () => { p.maxHp++; p.hp++; } });
        }
    } 

    // SI YA TIENE ARMA: Solo salen mejoras de stats y el escudo (si aún no lo tiene)
    else {
        let bancoMejoras = [
            { titulo: "❤️ VITA MAXIMA", desc: "+1 Corazón máximo permanente", ejec: () => { p.maxHp++; p.hp++; } },
            { titulo: "⚡ CELERIDAD", desc: "+15% Velocidad de movimiento", ejec: () => { p.velocidad *= 1.15; } },
            { titulo: "⚔️ FILO ACELERADO", desc: "+15% Vel. de ataque y animación", ejec: () => { p.velocidadAtaqueItem += 5; } }
        ];
        if (!p.tieneEscudo) {
            bancoMejoras.push({ titulo: "🛡️ ESCUDO DE FUERZA", desc: "Desbloquea Escudo (Click Derecho)", ejec: () => { p.tieneEscudo = true; } });
        }
        opcionesValidas = bancoMejoras;
    }

    // Seleccionar aleatoriamente de las opciones válidas (Máximo 3)
    const seleccionadas = [];
    while (seleccionadas.length < Math.min(3, opcionesValidas.length)) {
        let indiceRandom = Math.floor(Math.random() * opcionesValidas.length);
        let opcion = opcionesValidas[indiceRandom];
        if (!seleccionadas.includes(opcion)) seleccionadas.push(opcion);
    }

    // Dibujar las cartas
    seleccionadas.forEach(opcion => {
        const carta = document.createElement('button');
        carta.className = 'carta-opcion';
        carta.innerHTML = `<div>${opcion.titulo}</div><div style="font-size:11px; margin-top:5px; color:#aaa;">${opcion.desc}</div>`;
        
        carta.addEventListener('click', () => {
            opcion.ejec(); 
            cambiarEscena('MAZMORRA'); // 👈 Regresamos a la acción
        });
        contenedor.appendChild(carta);
    });
}