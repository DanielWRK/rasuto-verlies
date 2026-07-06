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