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

/* =========================================
   SISTEMA DE ARMAS (DICCIONARIO GLOBAL)
   ========================================= */
const CONFIG_ARMAS = {
    punios: {
        nombre: 'Puños',
        rango: 35,
        daño: 1,
        cooldownBase: 20,
        velocidadAnimacion: 0.15,
        tipoHitbox: 'recta', // Pega solo al frente
        dibujar: (ctx, p, progreso) => {
            let avance = progreso < 0.5 ? progreso * 2 : (1 - progreso) * 2; 
            let alcanceGolpe = avance * CONFIG_ARMAS['punios'].rango;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + Math.cos(p.anguloMirada) * alcanceGolpe, p.y + Math.sin(p.anguloMirada) * alcanceGolpe);
            ctx.strokeStyle = '#ff9800'; 
            ctx.lineWidth = 12; 
            ctx.stroke();
        }
    },
        espada: {
        nombre: 'Espada de Bronce',
        rango: 65,
        daño: 1,
        cooldownBase: 40,
        velocidadAnimacion: 0.08, // Más lenta
        tipoHitbox: 'abanico', // Pega en área
        dibujar: (ctx, p, progreso) => {
            let rango = CONFIG_ARMAS['espada'].rango;
            let anguloInicio = p.anguloMirada - Math.PI / 3;
            let anguloActual = anguloInicio + (Math.PI * 2 / 3) * progreso;
            
            // Área amarilla
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.arc(p.x, p.y, rango, anguloInicio, anguloActual);
            ctx.lineTo(p.x, p.y);
            ctx.fillStyle = 'rgba(255, 235, 59, 0.22)';
            ctx.fill();
            
            // Borde brillante de la hoja
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + Math.cos(anguloActual) * rango, p.y + Math.sin(anguloActual) * rango);
            ctx.strokeStyle = '#fff59d';
            ctx.lineWidth = 4;
            ctx.stroke();
        }
    },
        arco: {
        nombre: 'Arco de Caza',
        rango: 400, // Sirve de referencia
        daño: 1,
        cooldownBase: 35,
        velocidadAnimacion: 0.10,
        tipoHitbox: 'proyectil',     // 👈 Define que no pega cuerpo a cuerpo
        velocidadProyectil: 12,      // 👈 Qué tan rápido vuela la flecha
        dibujar: (ctx, p, progreso) => {
            // Dibujar un arco estilo Zelda
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.anguloMirada);
            
            // Madera del arco
            ctx.beginPath();
            ctx.arc(0, 0, 20, -Math.PI/2, Math.PI/2);
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Cuerda animada que se tensa
            ctx.beginPath();
            ctx.moveTo(0, -20);
            let tension = progreso > 0 ? (progreso < 0.5 ? progreso * 20 : (1 - progreso) * 20) : 0;
            ctx.lineTo(-tension, 0);
            ctx.lineTo(0, 20);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.restore();
        }
    },  
        lanza: {
        nombre: 'Lanza Guardiana',
        rango: 120, // 👈 Mucho más largo que la espada (65)
        daño: 1,
        cooldownBase: 35,
        velocidadAnimacion: 0.12, // Estocada rápida
        tipoHitbox: 'recta', // 👈 ¡Reutilizamos la lógica frontal de los puños!
        dibujar: (ctx, p, progreso) => {
            // Calculamos el efecto de estocada (va y vuelve rápido)
            let avance = progreso < 0.5 ? progreso * 2 : (1 - progreso) * 2; 
            let alcanceGolpe = avance * CONFIG_ARMAS['lanza'].rango;
            
            let cos = Math.cos(p.anguloMirada);
            let sin = Math.sin(p.anguloMirada);
            
            // Posición de inicio y fin de la lanza
            let inicioX = p.x + cos * p.radio; 
            let inicioY = p.y + sin * p.radio;
            let finX = p.x + cos * alcanceGolpe;
            let finY = p.y + sin * alcanceGolpe;

            // 1. Dibujar el palo de madera
            ctx.beginPath();
            ctx.moveTo(inicioX, inicioY);
            ctx.lineTo(finX, finY);
            ctx.strokeStyle = '#8B4513'; // Color madera
            ctx.lineWidth = 6; // Delgada
            ctx.stroke();

            // 2. Dibujar la punta de metal (solo si ya avanzó un poco)
            if (avance > 0.1) {
                ctx.beginPath();
                ctx.moveTo(finX - cos * 20, finY - sin * 20); // 20px antes del final
                ctx.lineTo(finX, finY); // Hasta la punta
                ctx.strokeStyle = '#E0E0E0'; // Metal brillante plateado
                ctx.lineWidth = 8; // Un poquito más gruesa la punta
                ctx.stroke();
            }
        }
    },

};

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


/* =========================================
   ACTUALIZACIÓN DE FÍSICAS Y REFUERZOS
   ========================================= */

function actualizarMotor() {
    const p = gameState.jugador;

    // 🔥 PERIODO DE GRACIA INICIAL
    if (gameState.retrasoArranque > 0) {
        gameState.retrasoArranque--;
        p.anguloMirada = Math.atan2(gameState.mouse.y - p.y, gameState.mouse.x - p.x);
        return; 
    }

    // Reducir el temporizador de ataque si es mayor a 0
    if (p.ataqueCooldownTimer > 0) {
        p.ataqueCooldownTimer--;
    }

    if (p.stamina < p.staminaMax) p.stamina += 0.6;
    if (p.stamina > p.staminaMax) p.stamina = p.staminaMax;

    if (p.escudoActivo) {
        p.escudoRadioActual += 3.5; 
        
        gameState.enemigos.forEach(enemigo => {
            let dist = Math.hypot(enemigo.x - p.x, enemigo.y - p.y);
            if (dist <= p.escudoRadioActual + enemigo.radio) {
                let anguloEnemigo = Math.atan2(enemigo.y - p.y, enemigo.x - p.x);
                enemigo.pushbackFrames = 14; 
                enemigo.anguloPushback = anguloEnemigo;
            }
        });

        if (p.escudoRadioActual >= p.escudoRadioMax) {
            p.escudoActivo = false;
        }
    }

    p.anguloMirada = Math.atan2(gameState.mouse.y - p.y, gameState.mouse.x - p.x);

    // =========================================
    // Control de Animaciones y Daño (CUERPO A CUERPO)
    // =========================================
    if (p.atacando) {
        let arma = CONFIG_ARMAS[p.armaActual]; 
        
        let velocidadAnimacionReal = arma.velocidadAnimacion + (p.velocidadAtaqueItem * 0.005);
        p.progresoAtaque += velocidadAnimacionReal; 
        
        let anguloActualEspada = p.anguloMirada - Math.PI / 3 + (Math.PI * 2 / 3) * p.progresoAtaque;

        if (p.progresoAtaque >= 1) {
            p.atacando = false;
            p.progresoAtaque = 0;
        }

        // Daño Melee
        if (arma.tipoHitbox !== 'proyectil') { 
            gameState.enemigos.forEach(enemigo => {
                if (enemigo.golpeadoEnEsteAtaque) return; 
                let dist = Math.hypot(enemigo.x - p.x, enemigo.y - p.y);
                
                if (dist <= arma.rango + enemigo.radio) {
                    let anguloEnemigo = Math.atan2(enemigo.y - p.y, enemigo.x - p.x);
                    let impactoExitoso = false;

                    if (arma.tipoHitbox === 'abanico') {
                        let difAngular = Math.atan2(Math.sin(anguloEnemigo - anguloActualEspada), Math.cos(anguloEnemigo - anguloActualEspada));
                        if (Math.abs(difAngular) < 0.28) impactoExitoso = true;
                    } 
                    else if (arma.tipoHitbox === 'recta') {
                        let difAngular = Math.atan2(Math.sin(anguloEnemigo - p.anguloMirada), Math.cos(anguloEnemigo - p.anguloMirada));
                        if (Math.abs(difAngular) < 0.35) impactoExitoso = true;
                    }

                    if (impactoExitoso) {
                        enemigo.hp -= arma.daño; 
                        enemigo.golpeadoEnEsteAtaque = true; 
                        enemigo.pushbackFrames = 5; 
                        enemigo.anguloPushback = p.anguloMirada;
                    }
                }
            });
            gameState.enemigos = gameState.enemigos.filter(e => e.hp > 0);
        }
    }

    // =========================================
    // Modificadores de Desplazamiento del Jugador
    // =========================================
    let siguienteX = p.x;
    let siguienteY = p.y;

    if (p.pushbackFrames > 0) {
        siguienteX += Math.cos(p.anguloPushback) * 8;
        siguienteY += Math.sin(p.anguloPushback) * 8;
        p.pushbackFrames--;
    } else if (p.dashFramesActivos > 0) {
        siguienteX += Math.cos(p.anguloDash) * 14; 
        siguienteY += Math.sin(p.anguloDash) * 14;
        p.dashFramesActivos--;
    } else {
        let dx = 0; let dy = 0;
        if (gameState.teclas.w) dy -= 1;
        if (gameState.teclas.s) dy += 1;
        if (gameState.teclas.a) dx -= 1;
        if (gameState.teclas.d) dx += 1;

        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx*dx + dy*dy);
            dx /= len; dy /= len;
        }
        siguienteX += dx * p.velocidad;
        siguienteY += dy * p.velocidad;
    }

    const LIMITE_HUD_Y = 50; 
    if (siguienteX < p.radio) siguienteX = p.radio;
    if (siguienteX > canvas.width - p.radio) siguienteX = canvas.width - p.radio;
    if (siguienteY < LIMITE_HUD_Y + p.radio) siguienteY = LIMITE_HUD_Y + p.radio;
    if (siguienteY > canvas.height - p.radio) siguienteY = canvas.height - p.radio;

    let chocaObstaculo = false;
    gameState.arbustos.forEach(arbusto => {
        if (Math.hypot(siguienteX - arbusto.x, siguienteY - arbusto.y) < p.radio + arbusto.radio) chocaObstaculo = true;
    });

    if (!chocaObstaculo) {
        p.x = siguienteX;
        p.y = siguienteY;
    }

    // Absorción de cofres
    gameState.cofres = gameState.cofres.filter(cofre => {
        if (Math.hypot(p.x - cofre.x, p.y - cofre.y) < p.radio + cofre.radio) {
            abrirMenuCofre(); 
            return false; 
        }
        return true;
    });

    // =========================================
    // Actualización de Enemigos
    // =========================================
    if (gameState.debug.enemigosActivos) {
        gameState.enemigos.forEach(enemigo => {
            let distAlJugador = Math.hypot(p.x - enemigo.x, p.y - enemigo.y);
            let movX = enemigo.x;
            let movY = enemigo.y;

            if (enemigo.pushbackFrames > 0) {
                movX += Math.cos(enemigo.anguloPushback) * 6; 
                movY += Math.sin(enemigo.anguloPushback) * 6;
                enemigo.pushbackFrames--;
            } else if (enemigo.tipo === 'zombie') {
                if (distAlJugador <= 320) {
                    let anguloAlJugador = Math.atan2(p.y - enemigo.y, p.x - enemigo.x);
                    movX += Math.cos(anguloAlJugador) * enemigo.velocidad;
                    movY += Math.sin(anguloAlJugador) * enemigo.velocidad;
                } else {
                    enemigo.timerPatrulla--;
                    if (enemigo.timerPatrulla <= 0) {
                        if (Math.random() < 0.25) { 
                            enemigo.vx = 0; enemigo.vy = 0;
                        } else {
                            let anguloRandom = Math.random() * Math.PI * 2;
                            enemigo.vx = Math.cos(anguloRandom) * enemigo.velocidad;
                            enemigo.vy = Math.sin(anguloRandom) * enemigo.velocidad;
                        }
                        enemigo.timerPatrulla = 40 + Math.random() * 50; 
                    }
                    movX += enemigo.vx;
                    movY += enemigo.vy;
                }
            } else if (enemigo.tipo === 'kamikaze') {
                let anguloAlJugador = Math.atan2(p.y - enemigo.y, p.x - enemigo.x);
                movX += Math.cos(anguloAlJugador) * enemigo.velocidad;
                movY += Math.sin(anguloAlJugador) * enemigo.velocidad;
            } else if (enemigo.tipo === 'lanzador') {
                if (enemigo.cooldownDisparo > 0) {
                    enemigo.cooldownDisparo--;
                } else if (distAlJugador < 550) {
                    let anguloAlJugador = Math.atan2(p.y - enemigo.y, p.x - enemigo.x);
                    gameState.proyectilesEnemigos.push({
                        x: enemigo.x, y: enemigo.y,
                        vx: Math.cos(anguloAlJugador) * 5, vy: Math.sin(anguloAlJugador) * 5,
                        radio: 5
                    });
                    enemigo.cooldownDisparo = 100; 
                }
            }

            if (enemigo.tipo !== 'lanzador') {
                let enemigoChocaArbusto = gameState.arbustos.some(a => Math.hypot(movX - a.x, movY - a.y) < enemigo.radio + a.radio);
                let fueraDeMargen = (movX < enemigo.radio || movX > canvas.width - enemigo.radio || movY < LIMITE_HUD_Y + enemigo.radio || movY > canvas.height - enemigo.radio);
                
                if (!enemigoChocaArbusto && !fueraDeMargen) {
                    enemigo.x = movX;
                    enemigo.y = movY;
                } else if (enemigo.tipo === 'zombie') {
                    enemigo.timerPatrulla = 0; 
                }
            }

            if (distAlJugador < p.radio + enemigo.radio && p.dashFramesActivos === 0 && p.pushbackFrames === 0) {
                p.hp--;
                let anguloImpacto = Math.atan2(p.y - enemigo.y, p.x - enemigo.x);
                p.pushbackFrames = 10; 
                p.anguloPushback = anguloImpacto; 
                if (p.hp <= 0) { alert("💀 Has muerto."); window.location.reload(); }
            }
        });
    }

    // =========================================
    // Actualización de Proyectiles ENEMIGOS
    // =========================================
    gameState.proyectilesEnemigos = gameState.proyectilesEnemigos.filter(proj => {
        proj.x += proj.vx;
        proj.y += proj.vy;

        if (proj.x < 0 || proj.x > canvas.width || proj.y < LIMITE_HUD_Y || proj.y > canvas.height) return false;

        let projChocaArbusto = gameState.arbustos.some(a => Math.hypot(proj.x - a.x, proj.y - a.y) < proj.radio + a.radio);
        if (projChocaArbusto) return false;

        if (Math.hypot(p.x - proj.x, p.y - proj.y) < p.radio + proj.radio) {
            if (p.dashFramesActivos === 0 && p.pushbackFrames === 0) {
                p.hp--;
                p.pushbackFrames = 6; 
                p.anguloPushback = Math.atan2(proj.vy, proj.vx); 
                if (p.hp <= 0) { alert("💀 Has muerto."); window.location.reload(); }
            }
            return false;
        }
        return true;
    });

    // =========================================
    // Actualización de Proyectiles JUGADOR (EL ARCO)
    // =========================================
    gameState.proyectilesJugador = gameState.proyectilesJugador.filter(proj => {
        proj.x += proj.vx;
        proj.y += proj.vy;

        if (proj.x < 0 || proj.x > canvas.width || proj.y < LIMITE_HUD_Y || proj.y > canvas.height) return false;

        let chocaArbusto = gameState.arbustos.some(a => Math.hypot(proj.x - a.x, proj.y - a.y) < proj.radio + a.radio);
        if (chocaArbusto) return false;

        let chocoEnemigo = false;
        for (let i = 0; i < gameState.enemigos.length; i++) {
            let enemigo = gameState.enemigos[i];
            if (Math.hypot(enemigo.x - proj.x, enemigo.y - proj.y) < enemigo.radio + proj.radio) {
                enemigo.hp -= proj.daño;
                enemigo.pushbackFrames = 6; 
                enemigo.anguloPushback = Math.atan2(proj.vy, proj.vx); 
                chocoEnemigo = true;
                break; 
            }
        }
        
        return !chocoEnemigo; 
    });
    
    gameState.enemigos = gameState.enemigos.filter(e => e.hp > 0);

    // 🔥 LÓGICA DEL PORTAL
    if (gameState.enemigos.length === 0 && gameState.retrasoArranque <= 0) {
        gameState.portalActivo = true;
        // Si el jugador toca el centro del mapa (400, 400)
        if (Math.hypot(p.x - 400, p.y - 400) < p.radio + 25) {
            gameState.zonaActual++; // Subimos nivel
            generarZona(); // Generamos el siguiente piso
        }
    } else {
        gameState.portalActivo = false;
    }

}


/* =========================================
   REQUERIMIENTO 2: RENDERIZADO DEL NUEVO HUD Y ESCENARIO
   ========================================= */
function dibujarMotor() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const p = gameState.jugador;

    // 1. Dibujar Entidades con Hitboxes Sincronizadas
    gameState.cofres.forEach(c => { ctx.font = '24px Arial'; ctx.fillText('🎁', c.x - 12, c.y + 10); });
    gameState.enemigos.forEach(e => { ctx.font = '24px Arial'; ctx.fillText(e.emoji, e.x - 12, e.y + 10); });
    
    // REQUISITO: Ajustar el arbusto para que no deje espacios vacíos de colisión invisible
    gameState.arbustos.forEach(a => { ctx.font = '32px Arial'; ctx.fillText('🌲', a.x - 16, a.y + 11); });

    // NUEVO: Dibujar los proyectiles de los Lanzadores
    gameState.proyectilesEnemigos.forEach(proj => {
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radio, 0, Math.PI * 2);
        ctx.fillStyle = '#ff9800'; // Proyectiles color fuego de los magos
        ctx.fill();
    });

        // NUEVO: Dibujar los proyectiles del jugador (Flechas)
    gameState.proyectilesJugador.forEach(proj => {
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radio, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700'; // Color dorado
        ctx.fill();
        
        // Efecto de estela de la flecha
        ctx.beginPath();
        ctx.moveTo(proj.x, proj.y);
        ctx.lineTo(proj.x - proj.vx * 1.5, proj.y - proj.vy * 1.5);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    });


        // 2. Dibujar Animaciones de Armas (DELEGADO AL DICCIONARIO)
    if (p.atacando) {
        CONFIG_ARMAS[p.armaActual].dibujar(ctx, p, p.progresoAtaque);
    }


    // Dibujar Onda del Escudo Expansivo si está activo
    if (p.escudoActivo) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.escudoRadioActual, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(33, 150, 243, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.escudoRadioActual, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(33, 150, 243, 0.08)';
        ctx.fill();
    }

    // 3. Dibujar Jugador
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radio, 0, Math.PI * 2);
    ctx.fillStyle = '#2196F3';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.anguloMirada) * 20, p.y + Math.sin(p.anguloMirada) * 20);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 4. Dibujar Mira del Ratón Virtual
    ctx.beginPath();
    ctx.arc(gameState.mouse.x, gameState.mouse.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4d4d';
    ctx.fill();

    // =========================================
    // DIBUJO DEL HUD SUPERIOR ACTUALIZADO
    // =========================================
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, 50);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, 50);

    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    
    // REQUISITO: Dibujo dinámico de corazones basado en tu maxHp acumulada
    let cantidadMax = p.maxHp || 3; // Usa 3 como salvavidas si maxHp no existe
    let corazonesNegros = Math.max(0, cantidadMax - p.hp);
    
    // Validamos que no sea NaN antes de pintar para no romper el repeat
    if (isNaN(corazonesNegros)) corazonesNegros = 0;

    let corazonesTexto = '❤️'.repeat(Math.max(0, p.hp)) + '🖤'.repeat(corazonesNegros);
    ctx.fillText(corazonesTexto, 20, 31);

    ctx.fillText(`ZONA: ${gameState.zonaActual}`, 320, 31); 
    
    // REQUISITO: Barra renombrada a STAMINA con cálculo de porcentaje sobre 100 puntos
    ctx.fillText("STAMINA:", 440, 31);
    ctx.fillStyle = '#333';
    ctx.fillRect(540, 16, 200, 16); 

    let porcentajeStamina = p.stamina / p.staminaMax;
    // Cambia a rojo si no tienes energía suficiente para realizar un Dash básico
    ctx.fillStyle = (p.stamina < p.costoDash) ? '#ff4d4d' : '#4CAF50'; 
    ctx.fillRect(540, 16, 200 * porcentajeStamina, 16);
    
    // Feedback visual del Retraso Inicial
    if (gameState.retrasoArranque > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Oscurecer pantalla
        ctx.fillRect(0, 50, canvas.width, canvas.height); // Respetar HUD
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 40px monospace';
        ctx.textAlign = 'center';
        let segundos = Math.ceil(gameState.retrasoArranque / 60);
        ctx.fillText(`PREPÁRATE... ${segundos}`, canvas.width / 2, canvas.height / 2);
        ctx.textAlign = 'left'; // Resetear alineación
    }

        // (Al final de dibujarMotor)
    // Dibujar el Portal de Descenso si está activo
    if (gameState.portalActivo) {
        let pulso = Math.sin(Date.now() / 150) * 4; // Animación de latido
        
        ctx.beginPath();
        ctx.arc(400, 400, 25 + pulso, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(156, 39, 176, 0.7)'; // Morado místico
        ctx.fill();
        ctx.strokeStyle = '#E1BEE7';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('DESCENDER', 400, 360);
        ctx.textAlign = 'left';
    }

    
}

function bucleJuego() {
    if (!gameState.corriendo) return;
    actualizarMotor();
    dibujarMotor();
    requestAnimationFrame(bucleJuego);
}

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


