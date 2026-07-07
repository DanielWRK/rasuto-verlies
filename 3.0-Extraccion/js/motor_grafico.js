/* =========================================
   REQUERIMIENTO 2: RENDERIZADO DEL NUEVO HUD Y ESCENARIO
   ========================================= */
function dibujarMotor() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const p = gameState.jugador;

    // 1. Dibujar Entidades con Hitboxes Sincronizadas
    gameState.cofres.forEach(c => { ctx.font = '24px Arial'; ctx.fillText('🎁', c.x - 12, c.y + 10); });
    gameState.enemigos.forEach(e => { 
        // Si es jefe, el emoji es gigante
        let esJefe = e.tipo.startsWith('jefe');
        ctx.font = (esJefe ? '50px' : '24px') + ' Arial'; 
        ctx.fillText(e.emoji, e.x - (esJefe ? 25 : 12), e.y + (esJefe ? 18 : 10)); 

        // Dibujar bola de energía si el jefe la tiene
        if(e.bola) {
            ctx.beginPath();
            ctx.arc(e.bola.x, e.bola.y, e.bola.radio, 0, Math.PI * 2);
            // Rojo si viene hacia ti, Verde si tú se la devolviste
            ctx.fillStyle = e.bola.propietario === 'jefe' ? '#ff4d4d' : '#4CAF50';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });

    
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

    // Dibujar el Portal de Descenso si está activo
    if (gameState.portalActivo) {
        let pulso = Math.sin(Date.now() / 150) * 4;
        let portalX = 400;
        let portalY = (gameState.tipoPortal === 'ENTRADA_MAZMORRA') ? 150 : 400;
        
        ctx.beginPath();
        ctx.arc(portalX, portalY, 25 + pulso, 0, Math.PI * 2);
        // Si es el Lobby es Azul seguro, si es descenso es Morado místico
        ctx.fillStyle = (gameState.tipoPortal === 'ENTRADA_MAZMORRA') ? 'rgba(33, 150, 243, 0.7)' : 'rgba(156, 39, 176, 0.7)'; 
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        let textoPortal = (gameState.tipoPortal === 'ENTRADA_MAZMORRA') ? 'ENTRAR A MAZMORRA' : 'DESCENDER';
        ctx.fillText(textoPortal, portalX, portalY - 40);
        ctx.textAlign = 'left';
    }


    
}