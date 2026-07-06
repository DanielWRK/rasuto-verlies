/* =========================================
   REQUERIMIENTO 3: GENERACIÓN PROCEDURAL CONTINUA
   ========================================= */

function generarZona() {
    gameState.arbustos = [];
    gameState.enemigos = [];
    gameState.cofres = [];
    gameState.proyectilesEnemigos = []; 
    gameState.proyectilesJugador = [];
    gameState.portalActivo = false; // Reiniciamos el portal

    // 🧮 FÓRMULA DE DIFICULTAD ESCALABLE
    let zona = gameState.zonaActual;
    let densidadMundo = Math.min(0.35, 0.20 + (zona * 0.015)); // El mapa se llena más
    let multiplicadorStats = 1 + (zona * 0.15); // +15% stats por nivel

    for (let gY = 0; gY < GRID_SIZE; gY++) {
        if (gY === 0) continue; // Respetar HUD
        for (let gX = 0; gX < GRID_SIZE; gX++) {
            // Zona segura en el centro (Nacimiento del jugador y Portal)
            if ((gX === 4 && gY === 4) || (gX === 3 && gY === 4) || (gX === 4 && gY === 3)) continue;

            if (Math.random() < densidadMundo) { 
                let cx = gX * CELL_SIZE + CELL_SIZE / 2;
                let cy = gY * CELL_SIZE + CELL_SIZE / 2;
                let dadoGlobal = Math.random();

                if (dadoGlobal < 0.10) {
                    gameState.cofres.push({ x: cx, y: cy, radio: 18 });
                } else if (dadoGlobal < 0.50) {
                    let dadoTipoEnemigo = Math.random();
                    let nuevoEnemigo = { x: cx, y: cy, golpeadoEnEsteAtaque: false, pushbackFrames: 0, anguloPushback: 0 };
                    
                    if (dadoTipoEnemigo < 0.50) {
                        nuevoEnemigo.tipo = 'zombie';
                        nuevoEnemigo.hp = Math.floor(3 * multiplicadorStats); // Escala vida
                        nuevoEnemigo.velocidad = 0.5 * multiplicadorStats; // Escala velocidad
                        nuevoEnemigo.radio = 16;
                        nuevoEnemigo.emoji = '🧟';
                        nuevoEnemigo.timerPatrulla = 0;
                        nuevoEnemigo.vx = 0; nuevoEnemigo.vy = 0;
                    } else if (dadoTipoEnemigo < 0.80) {
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
                        // Disparan más rápido a mayor nivel
                        nuevoEnemigo.cooldownBase = Math.max(40, 100 - (zona * 5)); 
                        nuevoEnemigo.cooldownDisparo = 90; 
                    }
                    gameState.enemigos.push(nuevoEnemigo);
                } else {
                    gameState.arbustos.push({ x: cx, y: cy, radio: 22 });
                }
            }
        }
    }
    
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
    gameState.corriendo = false;
    document.exitPointerLock(); 
    
    const p = gameState.jugador;
    const contenedor = document.getElementById('contenedor-opciones');
    contenedor.innerHTML = ''; 

    let opcionesValidas = [];

    // SI TIENE PUÑOS: Forzamos que salgan armas (y el escudo si no lo tiene)
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
            document.getElementById('pantalla-cofre').style.display = 'none';
            canvas.requestPointerLock();
        });
        contenedor.appendChild(carta);
    });

    document.getElementById('pantalla-cofre').style.display = 'flex';
}