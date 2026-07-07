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
                if (enemigo.tipo.startsWith('jefe')) return;
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
    // =========================================
    // Actualización de Enemigos y Jefes
    // =========================================
    if (gameState.debug.enemigosActivos) {
        gameState.enemigos.forEach(enemigo => {
            let distAlJugador = Math.hypot(p.x - enemigo.x, p.y - enemigo.y);
            
            // 🔥 LÓGICA DEL JEFE PING-PONG
            if (enemigo.tipo === 'jefe_pingpong') {
                if (!enemigo.bola) {
                    enemigo.timerAtaque--;
                    if (enemigo.timerAtaque <= 0) {
                        // El Jefe Sirve la pelota
                        let angulo = Math.atan2(p.y - enemigo.y, p.x - enemigo.x);
                        enemigo.bola = {
                            x: enemigo.x, y: enemigo.y,
                            velocidad: 5,
                            vx: Math.cos(angulo) * 5, vy: Math.sin(angulo) * 5,
                            radio: 12, propietario: 'jefe'
                        };
                    }
                } else {
                    let b = enemigo.bola;
                    b.x += b.vx; b.y += b.vy;

                    // Rebote en paredes del cuarto
                    if(b.x < b.radio || b.x > canvas.width - b.radio) b.vx *= -1;
                    if(b.y < 50 + b.radio || b.y > canvas.height - b.radio) b.vy *= -1;

                    // Choque con el Jugador
                    if (b.propietario === 'jefe' && Math.hypot(p.x - b.x, p.y - b.y) < p.radio + b.radio) {
                        // ¿Está usando estamina? (Dash o Escudo)
                        if (p.dashFramesActivos > 0 || p.escudoActivo) {
                            // PARRY EXITOSO
                            b.propietario = 'jugador';
                            b.velocidad += 2; // La bola se acelera
                            b.vx = Math.cos(p.anguloMirada) * b.velocidad;
                            b.vy = Math.sin(p.anguloMirada) * b.velocidad;
                        } else {
                            // DAÑO AL JUGADOR
                            p.hp--;
                            p.pushbackFrames = 10;
                            p.anguloPushback = Math.atan2(b.vy, b.vx);
                            enemigo.bola = null;
                            enemigo.timerAtaque = 60;
                            if (p.hp <= 0) { alert("💀 Has muerto."); window.location.reload(); }
                        }
                    }

                    // Choque con el Jefe (Cuando el jugador se la devuelve)
                    if (enemigo.bola && b.propietario === 'jugador') {
                        // IA: El jefe persigue la pelota en el eje X para intentar atraparla
                        let velocidadJefe = 3 + (3 - enemigo.hp) * 2; // Más rápido con menos vida
                        if (enemigo.x < b.x - 10) enemigo.x += velocidadJefe;
                        if (enemigo.x > b.x + 10) enemigo.x -= velocidadJefe;

                        if (Math.hypot(enemigo.x - b.x, enemigo.y - b.y) < enemigo.radio + b.radio) {
                            // Matemáticas de fallo
                            let probFallo = (enemigo.hp === 3) ? 0.50 : (enemigo.hp === 2) ? 0.25 : 0.10;
                            
                            if (Math.random() < probFallo) {
                                enemigo.hp--; // JEFE RECIBE DAÑO
                                enemigo.bola = null;
                                enemigo.timerAtaque = 90;
                            } else {
                                // JEFE HACE PARRY
                                b.propietario = 'jefe';
                                b.velocidad += 1.5;
                                let angulo = Math.atan2(p.y - enemigo.y, p.x - enemigo.x);
                                b.vx = Math.cos(angulo) * b.velocidad;
                                b.vy = Math.sin(angulo) * b.velocidad;
                            }
                        }
                    }
                }
                return; // Termina el turno del jefe, salta a la siguiente iteración
            }
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
                if (enemigo.tipo.startsWith('jefe')) {
                    chocoEnemigo = true; 
                    break;
                }
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

    // 🔥 LÓGICA DEL PORTAL ACTUALIZADA
    if (gameState.escenaActual === 'MAZMORRA' && gameState.enemigos.length === 0 && gameState.retrasoArranque <= 0) {
        gameState.portalActivo = true;
        gameState.tipoPortal = 'DESCENSO';
    }

        if (gameState.portalActivo) {
        let portalX = 400;
        let portalY = (gameState.tipoPortal === 'ENTRADA_MAZMORRA') ? 150 : 400;

        if (Math.hypot(p.x - portalX, p.y - portalY) < p.radio + 25) {
            if (gameState.tipoPortal === 'ENTRADA_MAZMORRA') {
                generarZona(); // 👈 Se genera la Zona 1 aquí
                cambiarEscena('MAZMORRA'); 
            } else if (gameState.tipoPortal === 'DESCENSO') {
                gameState.zonaActual++; 
                generarZona(); // 👈 Se genera el piso siguiente aquí
            }
        }
    }

        // Filtrar enemigos muertos y disparar recompensa de Jefe
    for (let i = gameState.enemigos.length - 1; i >= 0; i--) {
        let e = gameState.enemigos[i];
        if (e.hp <= 0) {
            if (e.tipo.startsWith('jefe')) {
                gameState.esperandoCofreJefe = 120; // 2 segundos (120 frames) de delay
            }
            gameState.enemigos.splice(i, 1);
        }
    }

    // Temporizador de victoria
    if (gameState.esperandoCofreJefe > 0) {
        gameState.esperandoCofreJefe--;
        if (gameState.esperandoCofreJefe === 0) {
            abrirMenuCofre(); // Se abre el cofre tras el delay
        }
    }

}