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
        armaActual: 'espada',
        armasDesbloqueadas: ['espada'],
        atacando: false,
        progresoAtaque: 0, 
        ataqueCooldownTimer: 0,
        ataqueCooldownTotal: 25, 
        rangoAtaque: 65
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
    
    
        if (e.button === 0 && p.ataqueCooldownTimer === 0 && p.dashFramesActivos === 0 && !p.escudoActivo) {
            p.atacando = true;
            p.progresoAtaque = 0;
            p.ataqueCooldownTimer = Math.max(10, p.ataqueCooldownTotal - p.velocidadAtaqueItem);
            gameState.enemigos.forEach(en => en.golpeadoEnEsteAtaque = false);
        }
    
        if (e.button === 2 && p.tieneEscudo && p.stamina >= p.staminaMax && !p.escudoActivo && p.dashFramesActivos === 0 && !p.atacando) {
            p.stamina -= p.staminaMax; // Drena TODA la barra (100%)
            p.escudoActivo = true;
            p.escudoRadioActual = p.radio; 
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

    for (let gY = 0; gY < GRID_SIZE; gY++) {
        // Ignorar por completo la primera fila superior para evitar choques con el HUD
        if (gY === 0) continue; 

        for (let gX = 0; gX < GRID_SIZE; gX++) {
            // No generar nada en el centro (donde nace el jugador)
            if (gX === 4 && gY === 4) continue;

            if (Math.random() < 0.22) { 
                let dadoGlobal = Math.random();
                let cx = gX * CELL_SIZE + CELL_SIZE / 2;
                let cy = gY * CELL_SIZE + CELL_SIZE / 2;

                if (dadoGlobal < 0.12) {
                    gameState.cofres.push({ x: cx, y: cy, radio: 18 });
                } else if (dadoGlobal < 0.45) {
                    
                    let dadoTipoEnemigo = Math.random();
                    let nuevoEnemigo = { x: cx, y: cy, golpeadoEnEsteAtaque: false, pushbackFrames: 0, anguloPushback: 0 };
                    
                    if (dadoTipoEnemigo < 0.50) {
                        nuevoEnemigo.tipo = 'zombie';
                        nuevoEnemigo.hp = 3;
                        nuevoEnemigo.velocidad = 0.5; // Tu velocidad personalizada
                        nuevoEnemigo.radio = 16;
                        nuevoEnemigo.emoji = '🧟';
                        nuevoEnemigo.timerPatrulla = 0;
                        nuevoEnemigo.vx = 0;
                        nuevoEnemigo.vy = 0;
                    } else if (dadoTipoEnemigo < 0.80) {
                        nuevoEnemigo.tipo = 'kamikaze';
                        nuevoEnemigo.hp = 1;
                        nuevoEnemigo.velocidad = 1.2; // Tu velocidad personalizada
                        nuevoEnemigo.radio = 14;
                        nuevoEnemigo.emoji = '🏃‍♂️';
                    } else {
                        nuevoEnemigo.tipo = 'lanzador';
                        nuevoEnemigo.hp = 2;
                        nuevoEnemigo.velocidad = 0;
                        nuevoEnemigo.radio = 16;
                        nuevoEnemigo.emoji = '🧙‍♂️';
                        // Retraso seguro de disparo inicial (1.5 segundos)
                        nuevoEnemigo.cooldownDisparo = 90 + Math.floor(Math.random() * 60); 
                    }
                    gameState.enemigos.push(nuevoEnemigo);
                } else {
                    gameState.arbustos.push({ x: cx, y: cy, radio: 22 });
                }
            }
        }
    }
    
    // 🔥 PERIODO DE GRACIA: 90 frames (1.5 segundos) al iniciar el mapa
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
        p.escudoRadioActual += 3.5; // Velocidad de expansión de la onda
        
        // Empujar con fuerza a todos los enemigos que entren en el radio de la onda
        gameState.enemigos.forEach(enemigo => {
            let dist = Math.hypot(enemigo.x - p.x, enemigo.y - p.y);
            if (dist <= p.escudoRadioActual + enemigo.radio) {
                let anguloEnemigo = Math.atan2(enemigo.y - p.y, enemigo.x - p.x);
                enemigo.pushbackFrames = 14; // Empuje prolongado
                enemigo.anguloPushback = anguloEnemigo;
            }
        });

        // Terminar la onda al llegar a su rango máximo
        if (p.escudoRadioActual >= p.escudoRadioMax) {
            p.escudoActivo = false;
        }
    }

    p.anguloMirada = Math.atan2(gameState.mouse.y - p.y, gameState.mouse.x - p.x);

    // Control del abanico animado
    let anguloActualEspada = 0;
    if (p.atacando) {
        p.progresoAtaque += 0.12; 
        let anguloInicio = p.anguloMirada - Math.PI / 3;
        anguloActualEspada = anguloInicio + (Math.PI * 2 / 3) * p.progresoAtaque;

        if (p.progresoAtaque >= 1) {
            p.atacando = false;
            p.progresoAtaque = 0;
        }
    }

    // Calcular posición final aplicando Modificadores de Desplazamiento
    let siguienteX = p.x;
    let siguienteY = p.y;

    if (p.pushbackFrames > 0) {
        // REQUISITO: El jugador es empujado hacia atrás por el impacto enemigo
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

    // Límites del HUD y mapa
    const LIMITE_HUD_Y = 50; 
    if (siguienteX < p.radio) siguienteX = p.radio;
    if (siguienteX > canvas.width - p.radio) siguienteX = canvas.width - p.radio;
    if (siguienteY < LIMITE_HUD_Y + p.radio) siguienteY = LIMITE_HUD_Y + p.radio;
    if (siguienteY > canvas.height - p.radio) siguienteY = canvas.height - p.radio;

    // Colisión jugador contra arbustos ajustados
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
            abrirMenuCofre(); // Llama a la generación de cartas
            return false; // Borra el cofre físico del suelo
        }
        return true;
    });

    if (gameState.debug.enemigosActivos) {
        
        gameState.enemigos.forEach(enemigo => {
            let distAlJugador = Math.hypot(p.x - enemigo.x, p.y - enemigo.y);
            let movX = enemigo.x;
            let movY = enemigo.y;

            // 🔥 NUEVO: Movimiento de empuje suave (Knockback) priorizado
            if (enemigo.pushbackFrames > 0) {
                movX += Math.cos(enemigo.anguloPushback) * 6; // Se desliza 6px por frame
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
                
                // Ahora si el empuje los tira contra la pared, simplemente se detienen ahí, no se atoran
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
                if (p.hp <= 0) { alert("💀 Has muerto en Rasuto Verlies."); window.location.reload(); }
            }
        });

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
                    if (p.hp <= 0) { alert("💀 Has muerto en Rasuto Verlies."); window.location.reload(); }
                }
                return false;
            }
            return true;
        });
        
    if (p.atacando) {
        gameState.enemigos.forEach(enemigo => {
            if (enemigo.golpeadoEnEsteAtaque) return; 

            let dist = Math.hypot(enemigo.x - p.x, enemigo.y - p.y);
            if (dist <= p.rangoAtaque + enemigo.radio) {
                let anguloEnemigo = Math.atan2(enemigo.y - p.y, enemigo.x - p.x);
                let difAngular = Math.atan2(Math.sin(anguloEnemigo - anguloActualEspada), Math.cos(anguloEnemigo - anguloActualEspada));
                
                if (Math.abs(difAngular) < 0.28) {
                    enemigo.hp -= 1; 
                    enemigo.golpeadoEnEsteAtaque = true; 
                    
                    // 🔥 NUEVO: Activar los frames de empuje en lugar de teletransportar
                    enemigo.pushbackFrames = 5; 
                    enemigo.anguloPushback = anguloEnemigo;
                }
            }
        });

        // Eliminar del mapa únicamente a los enemigos cuya vida llegó a cero
        gameState.enemigos = gameState.enemigos.filter(e => e.hp > 0);
    }
    }


    // --- ACTUALIZACIÓN DE PROYECTILES ENEMIGOS ---
    gameState.proyectilesEnemigos = gameState.proyectilesEnemigos.filter(proj => {
        proj.x += proj.vx;
        proj.y += proj.vy;

        // Desvanecer si sale de la mazmorra
        if (proj.x < 0 || proj.x > canvas.width || proj.y < LIMITE_HUD_Y || proj.y > canvas.height) return false;

        // Desvanecer si choca contra un arbusto sólido
        let projChocaArbusto = gameState.arbustos.some(a => Math.hypot(proj.x - a.x, proj.y - a.y) < proj.radio + a.radio);
        if (projChocaArbusto) return false;

        // Impactar jugador
        if (Math.hypot(p.x - proj.x, p.y - proj.y) < p.radio + proj.radio) {
            if (p.dashFramesActivos === 0 && p.pushbackFrames === 0) {
                p.hp--;
                p.pushbackFrames = 6; 
                p.anguloPushback = Math.atan2(proj.vy, proj.vx); // Empuje en base a la trayectoria de la bala
                if (p.hp <= 0) { alert("💀 Has muerto en Rasuto Verlies."); window.location.reload(); }
            }
            return false;
        }
        return true;
    });

    // --- CÁLCULO DE HITBOX DEL ESPADAZO (BARRIDO EN ABANICO) ---
    if (p.atacando) {
            gameState.enemigos.forEach(enemigo => {
                if (enemigo.golpeadoEnEsteAtaque) return; 

                let dist = Math.hypot(enemigo.x - p.x, enemigo.y - p.y);
                if (dist <= p.rangoAtaque + enemigo.radio) {
                    let anguloEnemigo = Math.atan2(enemigo.y - p.y, enemigo.x - p.x);
                    let difAngular = Math.atan2(Math.sin(anguloEnemigo - anguloActualEspada), Math.cos(anguloEnemigo - anguloActualEspada));
                    
                    if (Math.abs(difAngular) < 0.28) {
                        enemigo.hp -= 1; 
                        enemigo.golpeadoEnEsteAtaque = true; 
                        
                        // 🔥 REQUISITO 2: Empujar al enemigo bruscamente hacia atrás
                        enemigo.x += Math.cos(anguloEnemigo) * 25;
                        enemigo.y += Math.sin(anguloEnemigo) * 25;
                    }
                }
            });

            // Eliminar del mapa únicamente a los enemigos cuya vida llegó a cero
            gameState.enemigos = gameState.enemigos.filter(e => e.hp > 0);
        }

        // Eliminar del mapa únicamente a los enemigos cuya vida llegó a cero
        gameState.enemigos = gameState.enemigos.filter(e => e.hp > 0);
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

    // 2. Dibujar Animación de Espada en Abanico
    if (p.atacando) {
        let anguloInicio = p.anguloMirada - Math.PI / 3;
        let anguloActual = anguloInicio + (Math.PI * 2 / 3) * p.progresoAtaque;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, p.rangoAtaque, anguloInicio, anguloActual);
        ctx.lineTo(p.x, p.y);
        ctx.fillStyle = 'rgba(255, 235, 59, 0.22)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(anguloActual) * p.rangoAtaque, p.y + Math.sin(anguloActual) * p.rangoAtaque);
        ctx.strokeStyle = '#fff59d';
        ctx.lineWidth = 4;
        ctx.stroke();
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

    // REQUISITO: Barra renombrada a STAMINA con cálculo de porcentaje sobre 100 puntos
    ctx.fillText("STAMINA:", 440, 31);
    ctx.fillStyle = '#333';
    ctx.fillRect(540, 16, 200, 16); 

    let porcentajeStamina = p.stamina / p.staminaMax;
    // Cambia a rojo si no tienes energía suficiente para realizar un Dash básico
    ctx.fillStyle = (p.stamina < p.costoDash) ? '#ff4d4d' : '#4CAF50'; 
    ctx.fillRect(540, 16, 200 * porcentajeStamina, 16);

    // (Al final de dibujarMotor)
    
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
    document.exitPointerLock(); // Liberar ratón para permitir la selección en la UI
    
    const p = gameState.jugador;
    const contenedor = document.getElementById('contenedor-opciones');
    contenedor.innerHTML = ''; // Limpiar cartas previas

    // Lista total de bendiciones posibles en el juego
    const bancoMejoras = [
        { titulo: "❤️ VITA MAXIMA", desc: "+1 Corazón máximo permanente", ejec: () => { p.maxHp++; p.hp++; } },
        { titulo: "⚡ CELERIDAD", desc: "+15% Velocidad de movimiento", ejec: () => { p.velocidad *= 1.15; } },
        { titulo: "⚔️ FILO ACELERADO", desc: "+20% Velocidad de ataque con armas", ejec: () => { p.velocidadAtaqueItem += 5; } },
        { titulo: "🛡️ ESCUDO DE FUERZA", desc: "Desbloquea Escudo Expansivo (Click Derecho)", ejec: () => { p.tieneEscudo = true; } },
        { titulo: "🏹 ARCO DE CAZA", desc: "Equipar Arco (Estadísticas adaptadas)", ejec: () => { p.armaActual = 'arco'; p.rangoAtaque = 180; p.ataqueCooldownTotal = 35; } },
        { titulo: "🥊 PUÑOS DE HIERRO", desc: "Equipar Puños (Ataque rápido de corto alcance)", ejec: () => { p.armaActual = 'punios'; p.rangoAtaque = 40; p.ataqueCooldownTotal = 14; } }
    ];

    // Mezclar el banco de mejoras y extraer exactamente 3 únicas
    const seleccionadas = [];
    while (seleccionadas.length < 3) {
        let indiceRandom = Math.floor(Math.random() * bancoMejoras.length);
        let opcion = bancoMejoras[indiceRandom];
        if (!seleccionadas.includes(opcion)) {
            seleccionadas.push(opcion);
        }
    }

    // Construir los elementos HTML de las cartas en pantalla
// Busca esto dentro de la función abrirMenuCofre() y reemplázalo:
    seleccionadas.forEach(opcion => {
        const carta = document.createElement('button');
        carta.className = 'carta-opcion';
        carta.innerHTML = `<div>${opcion.titulo}</div><div style="font-size:11px; font-weight:normal; margin-top:5px; color:#aaa;">${opcion.desc}</div>`;
        
        carta.addEventListener('click', () => {
            opcion.ejec(); 
            
            // Ocultar menú y reanudar partida
            document.getElementById('pantalla-cofre').style.display = 'none';
            canvas.requestPointerLock();
        });
        
        contenedor.appendChild(carta);
    });

    // Mostrar el panel de recompensas
    document.getElementById('pantalla-cofre').style.display = 'flex';
}