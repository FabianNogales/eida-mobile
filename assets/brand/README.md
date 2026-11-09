# Marca EIDA

`eida-logo.svg` es una copia idéntica del recurso autorizado de EIDA Web:
`C:/proyecto/oidevs-examenes-frontend/src/assets/images/eida-logo.svg`.

No fue reconstruido, recoloreado ni extraído de una captura. No contiene material privado.

`eida-logo.png` es la versión transparente que renderiza `EidaLogo` mediante Image
nativo de React Native. Se usa en el login y las cuatro cabeceras principales.

- Resolución: 1520 × 1520, PNG RGBA de 8 bits, 74 575 bytes.
- Derivación: los 25 paths originales del SVG, escalados exactamente 2× mediante
  WPF disponible en Windows. Se conservaron curvas, colores #EC1C24/#013975 y las
  reglas de relleno nonzero/evenodd. No se reconstruyó ni recortó desde capturas.
- No se añadió fondo, tinte, marco o redibujo. El SVG original sigue intacto.
- SHA-256 SVG: `bb52c4f7b10ea81dda83dea764bb285285bf1d90edefc6e0adc0f210bd0f58c9`.
- SHA-256 PNG: `22c16696158fdeb9a2f79aead87539069021f4264fb9df4ea2ebbf5984d01cc8`.

La conversión del recurso se hizo en memoria y solo escribió este PNG dentro del
proyecto. No instaló herramientas, no ejecutó scripts del proyecto ni compiló la app.
Image usa contain y dimensiones cuadradas, sin tintColor; la versión de cabecera es
decorativa y el login ofrece una etiqueta de imagen accesible. El original sirve como
fuente para cualquier exportación futura; mantener sus proporciones y rellenos.

No se necesita react-native-svg, transformador Metro ni módulo nativo nuevo para
el logo actual. No se modificó la configuración de Metro o Android.

Poppins permanece pendiente: proporcionar archivos locales Regular 400, Medium 500,
SemiBold 600 y Bold 700, junto con su licencia. También hace falta expo-font compatible
con el SDK instalado (~58.0.11 según expo/bundledNativeModules.json). La instalación y
los archivos los aporta el usuario; no se descargó ni instaló nada. Hasta entonces se
usa la fuente del sistema con escalado, sin carga remota ni salto de tipografía.
