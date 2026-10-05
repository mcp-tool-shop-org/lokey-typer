<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.md">English</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/LoKey-Typer/readme.png" alt="LoKey Typer" width="400" />
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/lokey-typer/actions/workflows/deploy.yml"><img src="https://github.com/mcp-tool-shop-org/lokey-typer/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/lokey-typer/"><img src="https://img.shields.io/badge/Pages-target-blue" alt="Pages target"></a>
  <a href="https://apps.microsoft.com/detail/9NRVWM08HQC4"><img src="https://img.shields.io/badge/Microsoft_Store-available-blue" alt="Microsoft Store"></a>
</p>

Una aplicación de práctica de mecanografía tranquila con paisajes sonoros ambientales, ejercicios diarios personalizados y sin necesidad de cuentas.

## ¿Qué es?

LoKey Typer es una aplicación de práctica de mecanografía diseñada para adultos que desean sesiones tranquilas y enfocadas, sin elementos de juego, tablas de clasificación ni distracciones.

Todos los datos permanecen en tu dispositivo. Sin cuentas. Sin nube. Sin seguimiento.

## Modos de práctica

- **Enfoque:** Ejercicios tranquilos y seleccionados para desarrollar el ritmo y la precisión.
- **Vida real:** Practica con correos electrónicos, formularios, mensajes, notas y otros textos cotidianos.
- **Competitivo:** Sesiones cronometradas con mejores marcas personales.
- **Ejercicio diario:** Un nuevo conjunto de ejercicios generado cada día, adaptado a tus sesiones recientes.
- **Estudio:** Agrega tu propio texto. Este permanecerá en este dispositivo y se presentará por partes, en orden o de forma aleatoria.

## Características

- Paisajes sonoros ambientales diseñados para mantener la concentración. La configuración muestra solo las categorías que tienen una pista.
- Audio de pulsaciones de máquina de escribir mecánica (opcional), además de Clicky, Tick y Muted. El teclado que elijas se mantendrá en esa grabación. El predeterminado es Mechanical.
- Ejercicios diarios personalizados basados en las sesiones recientes.
- Soporte completo sin conexión después de la primera carga.
- Accesible: modo de lector de pantalla, movimiento reducido, sonido opcional.

## Instalación

**Microsoft Store** (recomendado):
[Descárgalo de Microsoft Store](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**Navegador:**
Ejecuta `npm run dev` y abre la dirección local. El flujo de trabajo de Pages publica la aplicación en [el sitio de Pages](https://mcp-tool-shop-org.github.io/lokey-typer/). El manual se encuentra en `/handbook/` en el mismo sitio.

**Docker (autoalojado):**

```bash
docker run -d --name lokey-typer -p 8080:8080 --restart unless-stopped ghcr.io/mcp-tool-shop-org/lokey-typer:latest
```

Luego, abre `http://localhost:8080/`. El manual se encuentra en `/lokey-typer/handbook/`. Tu progreso se guarda en tu navegador para esa dirección, no dentro del contenedor, por lo que detener, actualizar o reemplazar el contenedor lo conserva. Abre el mismo host y puerto cada vez; una dirección diferente comenzará de nuevo.

## Privacidad

LoKey Typer no recopila datos. Las preferencias, el historial de ejecución, las mejores marcas personales y el texto que agregas para el Estudio se guardan en este navegador. Consulta la [política de privacidad](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html) completa. Esa página se incluye con el sitio.

## Licencia

MIT. Consulta [LICENSE](LICENSE).

---

## Desarrollo

### Ejecutar localmente

```bash
npm ci
npm run dev
```

### Compilar

```bash
npm run build
npm run preview
```

### Scripts

- `npm run dev`: servidor de desarrollo
- `npm run build`: verificación de tipos + compilación de producción
- `npm run verify`: verificación de contenido, controles de sonido, verificación de tipos, cobertura y compilación de producción
- `npm run typecheck`: compilación de TypeScript, solo verificación de tipos
- `npm run lint`: ESLint
- `npm run preview`: vista previa de la compilación de producción localmente
- `npm run validate:content`: validación de esquemas y estructuras para todos los paquetes de contenido
- `npm run gen:phase2-content`: regenerar los paquetes de la Fase 2
- `npm run smoke:rotation`: prueba de humo de novedades/rotación
- `npm run qa:ambient:assets`: verificación de activos WAV ambientales
- `npm run qa:sound-design`: controles de aceptación del diseño de sonido
- `npm run qa:phase3:novelty`: simulación de novedades del ejercicio diario
- `npm run qa:phase3:recommendation`: simulación de la lógica de recomendación

### Estructura del código

- `src/app`: cableado de la aplicación (enrutador, shell/diseño, proveedores globales)
- `src/features`: interfaz de usuario de propiedad de la función (páginas + componentes de la función)
- `src/lib`: lógica de dominio compartida (almacenamiento, métricas de escritura, audio/ambiente, etc.)
- `src/content`: tipos de contenido + carga de paquetes de contenido

Consulta `modular.md` para conocer los contratos de arquitectura y los límites de importación.

### Alias de importación

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public` (superficie de la API pública)
- `@lib-internal` → `src/lib` (restringido al cableado/proveedores de la aplicación)

### Rutas

- `/`: Inicio
- `/daily`: Ejercicio diario
- `/focus`: Modo Enfoque
- `/real-life`: Modo Vida real
- `/competitive`: Modo Competitivo
- `/study`: Estudio, para el texto que agregas
- `/focus/run/:exerciseId`, `/real-life/run/:exerciseId`, `/competitive/run/:exerciseId`: ejecutar un ejercicio
- `/practice` redirige a `/focus`. `/arcade` redirige a `/competitive`

La configuración se abre desde la cabecera. No hay una página de lista de ejercicios.

### Documentación

- `modular.md`: arquitectura + contratos de límite de importación
- `docs/sound-design.md`: marco de diseño de sonido ambiental
- `docs/sound-design-manifesto.md`: manifiesto de diseño de sonido + pruebas de aceptación
- `docs/sound-philosophy.md`: filosofía del sonido de cara al público
- `docs/accessibility-commitment.md`: compromiso con la accesibilidad
- `docs/how-personalization-works.md`: explicación de la personalización

---

## Seguridad y alcance de los datos

LoKey Typer es una aplicación web de práctica de mecanografía (PWA + Microsoft Store) sin cuentas y sin telemetría.

- **Datos accedidos:** localStorage del navegador (preferencias, historial de ejecución, mejores marcas personales) y la base de datos IndexedDB `lokey-study` (texto que agregas en la página de Estudio)
- **Datos NO accedidos:** No hay sincronización en la nube. No hay telemetría. No hay análisis. No hay cuentas. No hay seguimiento.
- **Red:** La aplicación carga sus propias páginas y audio desde el mismo origen. No llama a un servicio de cuentas, un punto final de telemetría ni ninguna API de terceros.
- **No se recopila ni se envía ninguna telemetría.**

Política completa: [SECURITY.md](SECURITY.md)

---

## Tabla de resultados

| Categoría | Puntuación |
|----------|-------|
| A. Seguridad | 10/10 |
| B. Manejo de errores | 10/10 |
| C. Documentación para operadores | 10/10 |
| D. Higiene de envío | 10/10 |
| E. Identidad (suave) | 10/10 |
| **Overall** | **50/50** |

---

<p align="center">
  Built by <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
</p>
