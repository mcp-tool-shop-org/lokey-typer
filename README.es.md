<p align="center">
  <strong>English</strong> | <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português</a>
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

Una aplicación para practicar la mecanografía con un ambiente tranquilo, paisajes sonoros ambientales, rutinas diarias personalizables y sin necesidad de crear una cuenta.

## ¿De qué se trata?

LoKey Typer es una aplicación para practicar la mecanografía, diseñada para adultos que buscan sesiones de concentración y tranquilidad, sin elementos de gamificación, tablas de clasificación ni distracciones.

Todos los datos permanecen en su dispositivo. No requiere cuentas. No utiliza la nube. No realiza ningún seguimiento.

## Modos de práctica

- **Enfoque:** Ejercicios cuidadosamente diseñados para mejorar el ritmo y la precisión.
- **Aplicación práctica:** Práctica con correos, formularios, mensajes, notas y otros textos cotidianos.
- **Competitivo:** Pruebas cronometradas con registros personales.
- **Conjunto diario:** Un nuevo conjunto de ejercicios generado cada día, adaptado a tus sesiones recientes.

## Características

- Paisajes sonoros diseñados para favorecer la concentración prolongada. Los ajustes muestran solo las categorías que tienen una pista.
- Sonido de las teclas de una máquina de escribir mecánica (opcional).
- Ejercicios diarios personalizados basados en sesiones recientes.
- Soporte completo sin conexión después de la primera carga.
- Accesible: modo de lectura de pantalla, reducción de movimiento, opción de desactivar el sonido.

## Instalar

**Microsoft Store** (recomendado):
[Descárguelo de la Microsoft Store](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**Navegador:**
Ejecute `npm run dev` y abra la dirección local. El flujo de Pages publica la aplicación en [el destino de Pages](https://mcp-tool-shop-org.github.io/lokey-typer/) cuando este repositorio sea público. El manual está en `/handbook/` en ese mismo sitio. Hasta entonces, esa dirección no es una aplicación en línea.

## Privacidad

LoKey Typer no recopila ningún dato. Todas las preferencias, el historial de uso y los mejores resultados se almacenan localmente en su navegador. Consulte la [política de privacidad](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html) completa. Esa página se publica con el sitio. Hasta que este repositorio sea público, esa dirección no está en línea.

## Licencia

MIT. Consulte [LICENSE](LICENSE).

---

## Desarrollo

### Ejecutar localmente

```bash
npm ci
npm run dev
```

### Construir

```bash
npm run build
npm run preview
```

### Guiones.
Secuencias.
Programas.
Textos.
Escenarios.
(Dependiendo del contexto, también podría ser: "Guiones teatrales", "Guiones cinematográficos", etc.)

- `npm run dev`: servidor de desarrollo.
- `npm run build`: verificación de tipos + compilación para producción.
- `npm run typecheck`: verificación de tipos únicamente para TypeScript.
- `npm run lint`: ESLint.
- `npm run preview`: previsualización de la compilación para producción, localmente.
- `npm run validate:content`: validación de esquema y estructura para todos los paquetes de contenido.
- `npm run gen:phase2-content`: regeneración de los paquetes de la Fase 2.
- `npm run smoke:rotation`: prueba de novedad/rotación.
- `npm run qa:ambient:assets`: verificación de archivos de audio ambientales (WAV).
- `npm run qa:sound-design`: pruebas de aceptación del diseño de sonido.
- `npm run qa:phase3:novelty`: simulación diaria de contenido nuevo.
- `npm run qa:phase3:recommendation`: simulación de verificación de la funcionalidad de recomendaciones.

### Estructura del código

- `src/app`: configuración de la aplicación (enrutador, estructura general/diseño, proveedores globales).
- `src/features`: interfaz de usuario específica de cada funcionalidad (páginas y componentes de la funcionalidad).
- `src/lib`: lógica compartida (almacenamiento, métricas, audio/sonido ambiente, etc.).
- `src/content`: tipos de contenido y carga de paquetes de contenido.

Consulte el archivo `modular.md` para obtener información sobre los contratos de arquitectura y los límites de importación.

### Alias de importación

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public` (interfaz de la API pública)
- `@lib-internal` → `src/lib` (restringido a la configuración y proveedores de la aplicación)

### Rutas

- `/` — Inicio
- `/daily` — Conjunto diario
- `/focus` — Modo de concentración
- `/real-life` — Modo de vida real
- `/competitive` — Modo competitivo
- `/focus/run/:exerciseId`, `/real-life/run/:exerciseId`, `/competitive/run/:exerciseId` — Ejecutar un ejercicio
- `/practice` redirige a `/focus`. `/arcade` redirige a `/competitive`

Los ajustes se abren desde el encabezado. No hay una página de lista de ejercicios.

### Documentos

- `modular.md` — arquitectura y contratos de límites de importación.
- `docs/sound-design.md` — marco de diseño de sonido ambiental.
- `docs/sound-design-manifesto.md` — manifiesto de diseño de sonido y pruebas de aceptación.
- `docs/sound-philosophy.md` — filosofía del sonido, orientada al público.
- `docs/accessibility-commitment.md` — compromiso con la accesibilidad.
- `docs/how-personalization-works.md` — explicación de cómo funciona la personalización.
