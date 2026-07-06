
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