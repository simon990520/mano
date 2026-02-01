# Walkthrough: Sistema de Racha Diaria y Pagos WhatsApp

Se ha completado la transición del sistema de anuncios (AdSense) a un modelo de fidelización por racha diaria y pagos manuales vía WhatsApp.

## Cambios Principales

### 1. Sistema de Racha (Racha Diaria)
- **Frontend:** El botón de "Gratis" ha sido reemplazado por **"RACHA"**.
- **Lógica:** El premio escala de 10 a 70 monedas durante 7 días consecutivos.
- **Validación:** El botón se bloquea automáticamente una vez reclamado el premio del día.
- **Persistencia:** La racha se guarda en Supabase y se reinicia si el usuario falla un día o completa el ciclo.

### 2. Pagos vía WhatsApp
- **Remoción:** Se eliminaron todas las dependencias y endpoints de **Bold**. No hay más cobros automáticos que puedan ser bloqueados.
- **Flujo:** Al elegir cualquier paquete de monedas o gemas (excepto la racha), el usuario es redirigido a WhatsApp con un mensaje pre-llenado:
  - *Ej:* "Hola buenos dias deseo comprar 100 gemas".

### 3. Backend (Server.js)
- Se implementó el nuevo evento de socket `claimDailyReward`.
- Se eliminaron los endpoints de firma y webhook de Bold para mayor seguridad y limpieza del código.

## Archivos Modificados
- [useEconomyController.ts](file:///d:/Desarrollos/moddio/rock-paper-scissors-game/app/controllers/useEconomyController.ts) - Lógica de racha y redirección.
- [ShopModal.tsx](file:///d:/Desarrollos/moddio/rock-paper-scissors-game/app/components/Modals/ShopModal.tsx) - Nueva interfaz de la tienda.
- [server.js](file:///d:/Desarrollos/moddio/rock-paper-scissors-game/server.js) - Lógica del servidor y base de datos.
- [page.tsx](file:///d:/Desarrollos/moddio/rock-paper-scissors-game/app/page.tsx) - Paso de propiedades de racha al modal.

## Cómo verificar
1. **Paso 1:** Reclamar la recompensa diaria en la tienda de monedas. Confirmar que las monedas suben y el botón dice "MAÑANA".
2. **Paso 2:** Intentar comprar un paquete de 50 gemas. Confirmar que abre WhatsApp con el mensaje correcto.
3. **Paso 3:** Asegúrate de correr el script SQL incluido en `INFORME_IMPLEMENTACION_RACHA.md` en tu consola de Supabase.
