/* =========================================
   1. ESTADO DEL JUEGO (El "Cerebro")
   Aquí guardamos la verdad absoluta de la partida.
   ========================================= */
const gameState = {
    jugador: null,
    zonaActual: 1,
    casillasAtacadas: [], 
    bloqueoMovimiento: false,
    bloqueoAtaque: false,
    jugadorEsquiveEnCooldown: false,
    arbustos: [],
    enemigos: [],
    cofres: [],
    intervaloIA: null // 🔥 NUEVO: Para poder detener el tiempo si mueres
};

// Diccionario estático de las clases base
const CLASES_BASE = {
    arquero: { rango: 4, velMovimiento: 150, velAtaque: 300, cooldownDash: 1000, hp: 3 }, // Rápido, flecha larga
    espadachin: { rango: 1, velMovimiento: 250, velAtaque: 500, cooldownDash: 2000, hp: 3 }, // Medio
    peleador: { rango: 1, velMovimiento: 400, velAtaque: 800, cooldownDash: 3000, hp: 3 }  // Lento y pesado
};

// Nuevos candados de tiempo en el estado global
gameState.bloqueoMovimiento = false;
gameState.bloqueoAtaque = false;


/* =========================================
   2. REFERENCIAS A LA INTERFAZ (UI)
   ========================================= */
const pantallaInicio = document.getElementById('pantalla-inicio');
const pantallaJuego = document.getElementById('pantalla-juego');
const estadisticasTexto = document.getElementById('estadisticas-texto');


/* =========================================
   3. LÓGICA DE CONTROL Y ACCIONES
   ========================================= */

// Función llamada por los botones del HTML
function seleccionarClase(claseElegida) {
    // Validar que la clase exista en nuestra base de datos local
    if (CLASES_BASE[claseElegida]) {
        
        // Asignar los datos al Estado del Juego
        gameState.jugador = {
            clase: claseElegida,
            estadisticas: { ...CLASES_BASE[claseElegida] }, // Clonamos las stats
            posicion: { x: 0, y: 0 }, // Se usará en la Fase 2
            direccion: '>'
        };

        // Pasar a la siguiente fase visual
        iniciarPartida();
    }
}

function iniciarPartida() {
    // 1. Ocultar el menú y mostrar la pantalla de juego
    pantallaInicio.style.display = 'none';
    pantallaJuego.style.display = 'block';

    // 2. Extraer datos del gameState para pintar el HUD
    const clase = gameState.jugador.clase.toUpperCase();
    const vel = gameState.jugador.estadisticas.velMovimiento;
    const rango = gameState.jugador.estadisticas.rango;

    estadisticasTexto.innerText = `Clase: ${clase} | Vel: ${vel}ms | Rango: ${rango}`;
    
    generarZona();
    iniciarIAEnemigos(); 
    actualizarCorazones(); 
    renderizarTablero();
    
    // Log para desarrollador
    console.log("Partida iniciada. Estado del juego:", gameState);
}

/* =========================================
   FASE 2: EL ENTORNO Y MOVIMIENTO
   ========================================= */

const TAMANIO_TABLERO = 8;
const contenedorMazmorra = document.getElementById('contenedor-mazmorra');

// 1. EL CEREBRO: Lógica de movimiento y colisiones
function moverJugador(tecla) {
    if (gameState.bloqueoMovimiento) return;

    let { x, y } = gameState.jugador.posicion;
    tecla = tecla.toLowerCase();

    // Actualizar coordenada y dirección de la mirada
    if (tecla === 'w') { y -= 1; gameState.jugador.direccion = '^'; }
    if (tecla === 's') { y += 1; gameState.jugador.direccion = 'v'; }
    if (tecla === 'a') { x -= 1; gameState.jugador.direccion = '<'; }
    if (tecla === 'd') { x += 1; gameState.jugador.direccion = '>'; }

    // Validar límites del tablero
    if (x >= 0 && x < TAMANIO_TABLERO && y >= 0 && y < TAMANIO_TABLERO) {
        
        // 1. Chocar con Arbustos o Enemigos (Solid blocks)
        const hayArbusto = gameState.arbustos.some(a => a.x === x && a.y === y);
        const hayEnemigo = gameState.enemigos.some(e => e.x === x && e.y === y);
        
        if (hayArbusto || hayEnemigo) {
            return; // Interrumpe el movimiento, chocaste
        }

        // 2. Recolectar Cofres
        const indiceCofre = gameState.cofres.findIndex(c => c.x === x && c.y === y);
        if (indiceCofre !== -1) {
            gameState.cofres.splice(indiceCofre, 1); // Lo borramos del mapa
            
            // Recompensa del GDD: +5% velocidad (le restamos ms para que sea más rápido)
            gameState.jugador.estadisticas.velMovimiento = Math.max(50, gameState.jugador.estadisticas.velMovimiento * 0.95);
            
            // Actualizar HUD
            document.getElementById('estadisticas-texto').innerText = 
                `Clase: ${gameState.jugador.clase.toUpperCase()} | Vel: ${Math.round(gameState.jugador.estadisticas.velMovimiento)}ms | Rango: ${gameState.jugador.estadisticas.rango}`;
        }

        // Si pasó las validaciones, se mueve
        gameState.jugador.posicion.x = x;
        gameState.jugador.posicion.y = y;
        
        gameState.bloqueoMovimiento = true;
        setTimeout(() => gameState.bloqueoMovimiento = false, gameState.jugador.estadisticas.velMovimiento);
    }

    renderizarTablero();
}

// 2. LOS OJOS: Dibujar la cuadrícula en pantalla
function renderizarTablero() {
    // Limpiamos el contenedor
    contenedorMazmorra.innerHTML = ''; 
    
    const tableroDiv = document.createElement('div');
    tableroDiv.id = 'tablero';

    // Recorrer filas (Y) y columnas (X)
    for (let y = 0; y < TAMANIO_TABLERO; y++) {
        for (let x = 0; x < TAMANIO_TABLERO; x++) {
            const celda = document.createElement('div');
            celda.className = 'celda';

            // 🔥 AQUÍ ENTRA EL NUEVO TOQUE VISUAL DETALLADO:
            // Buscamos el objeto de ataque específico para esta coordenada (x, y)
            const ataqueInfo = gameState.casillasAtacadas.find(ataque => ataque.x === x && ataque.y === y);
            
            if (ataqueInfo) {
                if (ataqueInfo.esFlecha) {
                    // Si es flecha, aplicamos el diseño delgado según su dirección
                    if (ataqueInfo.direccion === '<' || ataqueInfo.direccion === '>') {
                        celda.classList.add('flecha-horizontal');
                    } else {
                        celda.classList.add('flecha-vertical');
                    }
                } else {
                    // Si es espada/puño, pintamos el bloque naranja brillante completo
                    celda.classList.add('ataque');
                }
            }
            
            // Dibujar Arbustos
            if (gameState.arbustos.some(a => a.x === x && a.y === y)) {
                celda.innerHTML = '<div class="arbusto">🌳</div>';
            }
            // Dibujar Enemigos
            if (gameState.enemigos.some(e => e.x === x && e.y === y)) {
                celda.innerHTML = '<div class="enemigo">💀</div>';
            }
            // Dibujar Cofres
            if (gameState.cofres.some(c => c.x === x && c.y === y)) {
                celda.innerHTML = '<div class="cofre">🎁</div>';
            }

            // Preguntamos al Cerebro: ¿El jugador está en esta coordenada (x,y)?
            if (gameState.jugador.posicion.x === x && gameState.jugador.posicion.y === y) {
                const jugadorDiv = document.createElement('div');
                jugadorDiv.className = 'jugador';
                jugadorDiv.innerText = gameState.jugador.direccion;

                // Color dinámico según la clase para darle identidad
                if(gameState.jugador.clase === 'arquero') jugadorDiv.style.backgroundColor = '#4CAF50'; // Verde
                if(gameState.jugador.clase === 'espadachin') jugadorDiv.style.backgroundColor = '#2196F3'; // Azul
                if(gameState.jugador.clase === 'peleador') jugadorDiv.style.backgroundColor = '#f44336'; // Rojo
                
                celda.appendChild(jugadorDiv);
            }

            tableroDiv.appendChild(celda);
        }
    }
    
    contenedorMazmorra.appendChild(tableroDiv);
}
// 3. CONTROLES: Escuchar el teclado (WASD)
document.addEventListener('keydown', (evento) => {
    if (gameState.jugador) {
        const tecla = evento.key.toLowerCase();
        const teclasMovimiento = ['w', 'a', 's', 'd'];
        
        if (teclasMovimiento.includes(tecla)) {
            moverJugador(tecla);
        } else if (tecla === 'o') {
            intentarEsquivar(); // DASH HACIA ATRÁS
        } else if (tecla === 'i') {
            intentarAtacar();   // ATACAR
        }
    }
});

/* =========================================
   FASE 3: ACCIONES - ATAQUE Y ESQUIVE (DASH)
   ========================================= */
// -- ACCIÓN 1: EL ESQUIVE Y LA BARRA --
function activarCooldownEsquive() {
    gameState.jugadorEsquiveEnCooldown = true;
    
    const ms = gameState.jugador.estadisticas.cooldownDash;
    const barra = document.getElementById('barra-dash');
    
    // Vaciar la barra al instante y ponerla en rojo
    barra.style.transition = 'none';
    barra.style.width = '0%';
    barra.style.backgroundColor = '#ff4d4d';
    
    // Llenarla progresivamente
    setTimeout(() => {
        barra.style.transition = `width ${ms}ms linear`;
        barra.style.width = '100%';
    }, 50);

    // Liberar el cooldown cuando la barra se llene (vuelve a verde)
    setTimeout(() => {
        gameState.jugadorEsquiveEnCooldown = false;
        barra.style.backgroundColor = '#4CAF50'; 
    }, ms);
}

function intentarEsquivar() {
    // Si la barra ya se está recargando, no permitimos hacer dash
    if (gameState.jugadorEsquiveEnCooldown) return;

    let { x, y } = gameState.jugador.posicion;
    const dir = gameState.jugador.direccion;

    // Calcular la posición hacia ATRÁS de la mirada actual
    if (dir === '^') { y += 2; } // Mira arriba, salta abajo
    if (dir === 'v') { y -= 2; } // Mira abajo, salta arriba
    if (dir === '<') { x += 2; } // Mira izq, salta der
    if (dir === '>') { x -= 2; } // Mira der, salta izq

    // Validar que el salto hacia atrás no se salga del tablero
    if (x >= 0 && x < TAMANIO_TABLERO && y >= 0 && y < TAMANIO_TABLERO) {
        gameState.jugador.posicion.x = x;
        gameState.jugador.posicion.y = y;
        
        renderizarTablero(); // Actualizar pantalla
        
        // Disparar la animación de la barra
        activarCooldownEsquive();
    }
}

// -- ACCIÓN 2: EL ATAQUE PROYECTIL / MELEE --
function intentarAtacar() {
    if (gameState.bloqueoAtaque) return;
    gameState.bloqueoAtaque = true;
    setTimeout(() => gameState.bloqueoAtaque = false, gameState.jugador.estadisticas.velAtaque);

    const dir = gameState.jugador.direccion;
    const alcance = gameState.jugador.estadisticas.rango; 

    if (gameState.jugador.clase === 'arquero') {
        let distanciaViajada = 1;
        
        const intervaloFlecha = setInterval(() => {
            let { x, y } = gameState.jugador.posicion;
            
            if (dir === '^') y -= distanciaViajada;
            if (dir === 'v') y += distanciaViajada;
            if (dir === '<') x -= distanciaViajada;
            if (dir === '>') x += distanciaViajada;

            if (x < 0 || x >= TAMANIO_TABLERO || y < 0 || y >= TAMANIO_TABLERO || distanciaViajada > alcance) {
                clearInterval(intervaloFlecha);
                gameState.casillasAtacadas = [];
                renderizarTablero();
                return;
            }

            // 🔥 AQUÍ ELIMINAMOS AL ENEMIGO (Si la flecha pasa por encima)
            gameState.enemigos = gameState.enemigos.filter(e => e.x !== x || e.y !== y);

            gameState.casillasAtacadas = [{ x, y, esFlecha: true, direccion: dir }];
            renderizarTablero();
            distanciaViajada++;

        }, 80); 

    } else {
        let { x, y } = gameState.jugador.posicion;
        if (dir === '^') y -= 1;
        if (dir === 'v') y += 1;
        if (dir === '<') x -= 1;
        if (dir === '>') x += 1;

        if (x >= 0 && x < TAMANIO_TABLERO && y >= 0 && y < TAMANIO_TABLERO) {
            
            // 🔥 AQUÍ ELIMINAMOS AL ENEMIGO (Si la espada lo golpea)
            gameState.enemigos = gameState.enemigos.filter(e => e.x !== x || e.y !== y);

            gameState.casillasAtacadas = [{ x, y, esFlecha: false }];
            renderizarTablero();
        }

        setTimeout(() => {
            gameState.casillasAtacadas = [];
            renderizarTablero();
        }, 150); 
    }
}

/* =========================================
   FASE 4: GENERACIÓN PROCEDURAL
   ========================================= */
function generarZona() {
    // 1. Limpiar las listas para la nueva zona
    gameState.arbustos = [];
    gameState.enemigos = [];
    gameState.cofres = [];

    // 2. Curva de dificultad basada en el GDD
    // Asumimos que un 25% de la sala tendrá objetos. De ese 25%, dividimos las probabilidades:
    let probArbusto = 0.50;
    let probEnemigo = 0.30;
    let probCofre = 0.20;

    // Si estás en zonas más altas (ej. Zona 10), invertimos las probabilidades
    if (gameState.zonaActual >= 5) {
        probArbusto -= 0.10;
        probEnemigo += 0.20;
        probCofre -= 0.10;
    }

    // 3. Recorrer el tablero y tirar los dados
    for (let y = 0; y < TAMANIO_TABLERO; y++) {
        for (let x = 0; x < TAMANIO_TABLERO; x++) {
            // Evitar generar cosas en la posición inicial del jugador (0,0) y sus casillas adyacentes para no quedar atrapado
            if ((x === 0 && y === 0) || (x === 1 && y === 0) || (x === 0 && y === 1)) continue;

            const dadoGlobal = Math.random();
            
            // 25% de probabilidad de que aparezca ALGO en esta casilla
            if (dadoGlobal < 0.25) { 
                const dadoEntidad = Math.random();

                if (dadoEntidad < probCofre) {
                    gameState.cofres.push({ x, y });
                } else if (dadoEntidad < probCofre + probEnemigo) {
                    gameState.enemigos.push({ x, y, hp: 1 }); // Enemigos mueren de 1 golpe por ahora
                } else {
                    gameState.arbustos.push({ x, y });
                }
            }
        }
    }
}

/* =========================================
   FASE 4.5: SISTEMA DE DAÑO Y MUERTE
   ========================================= */

function actualizarCorazones() {
    const hp = gameState.jugador.estadisticas.hp;
    // Pinta corazones rojos según tu vida, y corazones negros para la vida perdida
    document.getElementById('corazones').innerText = '❤️'.repeat(hp) + '🖤'.repeat(3 - Math.max(0, hp));
}

function recibirDanioJugador() {
    gameState.jugador.estadisticas.hp -= 1;
    actualizarCorazones();

    // Efecto visual: La pantalla parpadea en rojo
    const contenedor = document.getElementById('contenedor-mazmorra');
    contenedor.style.borderColor = "red";
    setTimeout(() => contenedor.style.borderColor = "#444", 200);

    // Condición de Muerte (Permadeath)
    if (gameState.jugador.estadisticas.hp <= 0) {
        morir();
    }
}

function morir() {
    // 1. Detener el tiempo de los enemigos
    clearInterval(gameState.intervaloIA);
    
    // 2. Avisar al jugador
    alert("💀 ¡Has muerto! La mazmorra te ha reclamado.");
    
    // 3. Regresar a la pantalla de inicio
    pantallaInicio.style.display = 'block';
    pantallaJuego.style.display = 'none';
    
    // 4. Borrar el progreso para obligar a elegir clase de nuevo
    gameState.jugador = null; 
}

function iniciarIAEnemigos() {
    // Limpiar cualquier reloj anterior por seguridad
    if (gameState.intervaloIA) clearInterval(gameState.intervaloIA);

    // Los enemigos actúan cada 1 segundo (1000 ms)
    gameState.intervaloIA = setInterval(() => {
        
        gameState.enemigos.forEach(enemigo => {
            let px = gameState.jugador.posicion.x;
            let py = gameState.jugador.posicion.y;
            let { x, y } = enemigo;

            // Calcular distancia matemática (Distancia Manhattan)
            let distancia = Math.abs(px - x) + Math.abs(py - y);

            // ACCIÓN 1: ATACAR (Si está pegado a ti)
            if (distancia === 1) {
                recibirDanioJugador();
                return; // Termina su turno, se queda quieto golpeando
            }

            // ACCIÓN 2: PERSEGUIR O PATRULLAR
            let nuevaX = x;
            let nuevaY = y;

            if (distancia <= 4 && distancia > 1) {
                // Modo Persecución: Se mueve hacia la coordenada del jugador
                if (Math.abs(px - x) > Math.abs(py - y)) {
                    nuevaX += (px > x) ? 1 : -1; // Se acerca en X
                } else {
                    nuevaY += (py > y) ? 1 : -1; // Se acerca en Y
                }
            } else {
                // Modo Patrulla: Movimiento aleatorio
                const dir = Math.floor(Math.random() * 4);
                if (dir === 0) nuevaY -= 1;
                if (dir === 1) nuevaY += 1;
                if (dir === 2) nuevaX -= 1;
                if (dir === 3) nuevaX += 1;
            }

            // Validar colisiones antes de dar el paso
            if (nuevaX >= 0 && nuevaX < TAMANIO_TABLERO && nuevaY >= 0 && nuevaY < TAMANIO_TABLERO) {
                const chocaArbusto = gameState.arbustos.some(a => a.x === nuevaX && a.y === nuevaY);
                const chocaCofre = gameState.cofres.some(c => c.x === nuevaX && c.y === nuevaY);
                // Evitar que los enemigos se fusionen entre ellos
                const chocaOtroEnemigo = gameState.enemigos.some(e => e.x === nuevaX && e.y === nuevaY && e !== enemigo);
                const chocaJugador = (px === nuevaX && py === nuevaY);

                if (!chocaArbusto && !chocaCofre && !chocaOtroEnemigo && !chocaJugador) {
                    enemigo.x = nuevaX;
                    enemigo.y = nuevaY;
                }
            }
        });
        
        renderizarTablero(); 
    }, 1000);
}