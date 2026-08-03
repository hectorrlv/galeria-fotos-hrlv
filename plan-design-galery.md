# Diseño de la galería fotográfica de viajes

## Resumen

Crear una galería pública, editorial e inmersiva, acompañada por un estudio privado de administración. Las fotografías serán las protagonistas sobre una interfaz oscura, con álbumes organizados por viaje y una navegación sencilla tanto en computadora como en móvil.

Los originales se conservarán intactos. Al publicar, el sistema generará copias optimizadas con el crédito `@usuario` integrado de forma automática y ajustable.

## Experiencia pública

- **Inicio:** gran portada del viaje destacado, introducción breve, álbumes recientes y accesos por año, país o tipo de paseo.
- **Índice de álbumes:** tarjetas con fotografía de portada, título, ubicación, fecha y cantidad de fotos. Filtros combinables por año, país y categoría.
- **Álbum:** portada panorámica, título, lugar, periodo e introducción; después, fotografías en filas justificadas que conservan proporción y orden.
- **Visor inmersivo:** imagen casi a pantalla completa, fondo negro, navegación con flechas, teclado, gestos y miniaturas opcionales. Mostrará pie breve, lugar y fecha sin distraer.
- **Continuidad:** al final aparecerán el viaje anterior, el siguiente y hasta tres álbumes relacionados por año o ubicación.
- **Navegación global:** logotipo o nombre del proyecto, Inicio, Álbumes y Acerca de. En móvil se usará un menú compacto y controles táctiles.
- **Descargas:** no habrá botón de descarga. Las imágenes públicas estarán optimizadas y llevarán crédito, aunque esto no pretende impedir técnicamente una captura o guardado desde el navegador.

## Lenguaje visual

- Fondo carbón y negro suave, texto marfil y grises cálidos.
- Tipografía editorial para títulos y una tipografía sencilla para navegación y metadatos.
- Animaciones breves: aparición progresiva de imágenes, transición suave al visor y respuesta visible al pasar el cursor.
- Las fotografías no se recortarán en la vista completa; las portadas sí podrán tener un encuadre ajustable.
- Estados de carga discretos que respeten la proporción de cada foto para evitar saltos de contenido.
- Accesibilidad: contraste suficiente, textos alternativos, navegación por teclado, foco visible y opción de reducir movimiento.

## Estudio privado y crédito fotográfico

- Flujo del álbum: **borrador → revisión → publicado**.
- Cada álbum tendrá título, descripción, ubicación, fechas, categoría, portada, orden de fotos y estado.
- Cada foto podrá tener pie opcional, lugar, fecha, texto alternativo, encuadre de portada y visibilidad.
- La carga permitirá ordenar varias fotos mediante arrastre y aplicar datos comunes a un grupo.
- Antes de publicar habrá una revisión del mosaico, metadatos y créditos.
- El original permanecerá privado y sin modificaciones; se generarán miniaturas, versiones web y una copia pública acreditada.
- El sistema analizará las cuatro esquinas y elegirá la zona con mejor legibilidad.
- El crédito usará blanco o negro según la luminosidad local, con una sombra o contorno muy discreto cuando sea necesario.
- Existirá una configuración general del `@`, tamaño, opacidad y margen, además de ajustes individuales de posición, color, tamaño y opacidad.
- Cualquier cambio mostrará una vista previa antes de regenerar la copia pública.
- Si ninguna esquina ofrece contraste adecuado, el editor señalará la foto para revisión manual en vez de colocar un crédito ilegible.

## Modelo de contenido

- **Álbum:** título, slug, descripción, país, ubicación, fechas, categoría, portada, estado, destacado y orden.
- **Foto:** original privado, derivados públicos, dimensiones, fecha, lugar, pie, texto alternativo, orden y configuración de crédito.
- **Configuración del sitio:** nombre de la galería, `@` de crédito, presentación personal, enlaces sociales y valores predeterminados de marca de agua.
- Los filtros públicos se calcularán a partir de álbumes publicados; los borradores y originales nunca serán accesibles desde la galería.

## Validación del diseño

- Probar inicio, índice, álbum y visor en móvil, tableta y escritorio.
- Confirmar que fotos verticales y horizontales conserven proporción y orden.
- Verificar navegación con teclado, gestos, botones anterior/siguiente y conservación de filtros al regresar.
- Revisar el crédito sobre imágenes claras, oscuras, uniformes y con detalle en todas las esquinas.
- Confirmar que editar el crédito nunca modifique el archivo original.
- Verificar que álbumes en borrador no sean visibles públicamente.
- Evaluar tiempos de carga con álbumes pequeños y con varios cientos de fotografías.
- Considerar aprobado el diseño cuando una persona pueda descubrir un viaje, recorrerlo, abrir fotografías y pasar al siguiente álbum sin necesitar instrucciones.

## Supuestos

- La primera versión tendrá álbumes públicos y borradores privados; no incluirá álbumes protegidos con contraseña.
- No incluirá mapa interactivo, comentarios, “me gusta”, compras ni descargas de originales.
- El nombre definitivo del sitio, el `@` y las tipografías se seleccionarán durante la etapa de identidad visual.
- El siguiente paso de diseño será crear wireframes de Inicio, Álbumes, detalle del álbum, visor y estudio privado antes de elegir tecnología o escribir código.
