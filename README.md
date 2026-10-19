# Galería de fotos HRLV

Aplicación Lit para organizar y publicar álbumes fotográficos de viajes y
paseos. Incluye galería pública editorial, filtros, visor inmersivo y un estudio
privado para preparar y publicar los álbumes.

## Requisitos

- Node.js 24.13.0
- pnpm 11.18.0

## Desarrollo

```sh
pnpm install
cp .env.example .env
pnpm start
```

La aplicación funciona en modo de demostración si las variables de Firebase
están vacías. La configuración local real vive en `.env`, que Git ignora.

## Comandos

- `pnpm start`: compila y sirve la aplicación en `http://localhost:8000`.
- `pnpm build`: genera la aplicación de producción en `dist/`.
- `pnpm typecheck`: valida TypeScript.
- `pnpm lint`: ejecuta ESLint sin modificar archivos.
- `pnpm format`: aplica ESLint y Prettier.
- `pnpm test`: ejecuta pruebas unitarias.
- `pnpm test:e2e`: ejecuta pruebas de navegador con Playwright.
- `pnpm check`: ejecuta las validaciones no mutantes y la compilación.

## Firebase

El proyecto local está asociado con `galeria-fotos-hrlv`. La configuración web
se carga desde `.env` durante la compilación.

Authentication está habilitado con Google y usuario/contraseña. El UID del
primer administrador está autorizado en las reglas locales y en el guard de la
interfaz.

Antes de publicar la funcionalidad real:

1. Verifica Realtime Database, Storage y Hosting mediante los emuladores o un
   proyecto de prueba antes del despliegue.
2. Despliega las reglas revisadas de Database y Storage.

### CORS de Storage

La regeneración del crédito descarga el original privado desde el navegador.
El bucket debe permitir solicitudes `GET` y `HEAD` desde los dominios de
Hosting y el servidor local incluidos en `storage.cors.json`.

Esta configuración pertenece al bucket y no se aplica con
`firebase deploy`. Después de autenticar Google Cloud CLI en el proyecto,
ejecuta:

```sh
gcloud storage buckets update \
  gs://galeria-fotos-hrlv.firebasestorage.app \
  --cors-file=storage.cors.json
```

Para verificar la configuración aplicada:

```sh
gcloud storage buckets describe \
  gs://galeria-fotos-hrlv.firebasestorage.app \
  --format='default(cors_config)'
```

Las reglas reservan `/private` y `/originals` para el administrador. La galería
pública lee `/public` en Database y Storage; los contadores y votos tienen los
permisos específicos descritos a continuación.

### Likes sin registro

La cuadrícula y el visor comparten un corazón y contador por fotografía, incluso
cuando aparece en varios álbumes. Firebase crea una identidad anónima al primer
like y conserva la sesión en el navegador. Teléfono, iPad, otros navegadores y
sesiones privadas pueden tener identidades distintas. Borrar los datos del sitio
puede generar una nueva identidad; no se garantiza un voto por persona.

Los datos viven en `/photoLikes/{photoId}/count` y
`/photoLikes/{photoId}/voters/{uid}/albumId`, separados de los snapshots de los
álbumes. El contador es público; cada visitante solo puede leer y modificar su
voto. Las reglas exigen que voto y contador se actualicen juntos y rechazan votos
para fotografías que no estén visibles en un álbum publicado. Los likes se
conservan al editar o retirar de publicación y se eliminan al borrar
definitivamente la foto. La sesión del administrador se reutiliza; una sesión
anónima sigue viendo el formulario de acceso en `/admin`.

Para activar esta función en un entorno publicado, después de revisar los cambios:

1. En Firebase Console → Authentication → Sign-in method, habilita **Anonymous**.
   Si el proyecto usa Identity Platform, conserva desactivada la limpieza
   automática de cuentas anónimas para mantener la posibilidad de retirar likes
   en visitas posteriores.
2. Despliega las reglas con `firebase deploy --only database --project galeria-fotos-hrlv`.
3. Publica la aplicación mediante el flujo habitual de Hosting. Publicar Hosting
   por sí solo no actualiza las reglas ni habilita el proveedor anónimo.
4. Verifica en ese entorno dar y quitar un like, recargar y acceder a `/admin`.

La implementación local no activa proveedores ni despliega Firebase real.
No requiere Cloud Functions ni un servidor adicional.

Para verificar localmente se requieren Firebase CLI, Java y Chromium de Playwright:

```sh
pnpm test:likes
pnpm test:likes:e2e
```

Ambos comandos usan únicamente el proyecto ficticio `demo-gallery-likes`, Auth en
`127.0.0.1:9109` y Database en `127.0.0.1:9019`. El segundo inicia la aplicación
en `127.0.0.1:8017` con configuración ficticia, comprueba escritorio y móvil,
persistencia al recargar, sincronización entre pestañas e identidades separadas.
`FIREBASE_EMULATORS_ENABLED=1` selecciona esta configuración durante el build;
solo funciona en localhost y nunca utiliza las variables del proyecto real.
Las pruebas habituales `pnpm test:e2e` mantienen el modo de demostración y omiten
las pruebas que requieren estos emuladores.

## Modelo de datos

- `/private/photos/{photoId}` conserva una única fotografía, sus metadatos,
  crédito y rutas de archivos. No pertenece a un álbum concreto.
- `/private/albums/{albumId}/photoRefs/{photoId}` conserva la asociación y
  visibilidad de la fotografía en ese álbum. Orden y portada son propios del álbum.
- `/private/schemaVersion: 2` indica que se completó la conversión al modelo compartido.
- `/public/albums/{albumId}` contiene snapshots sanitizados de álbumes
  publicados.
- `/private/site` y `/public/site` contienen la identidad y los valores
  predeterminados del crédito.
- `originals/photos/{photoId}` guarda los nuevos originales intactos.
- `public/photos/{photoId}` guarda sus miniaturas, cuadrícula y visor en WebP.
  Los archivos anteriores conservan sus rutas; la migración no los mueve.

## Flujo editorial

1. Entra a `/admin` con Google o correo y contraseña.
2. Configura el nombre y el texto real del crédito fotográfico.
3. Crea un álbum, agrega su relato y carga fotografías.
4. Revisa orden, metadatos, portada, visibilidad y contraste del crédito.
5. Publica el álbum para generar su snapshot público de forma atómica.

La generación de derivados ocurre en el navegador. El original se carga por
separado y nunca se modifica. Retirar un álbum elimina su snapshot de Database,
pero conserva el borrador privado y sus archivos.

### Fotografías compartidas

Desde cada álbum, **Elegir fotos existentes** permite buscar por nombre y agregar
varias fotografías sin subir archivos de nuevo. Las ya incluidas están marcadas.
El pie, lugar, fecha, texto alternativo, imagen y crédito son compartidos. Guardar
sus cambios actualiza sus apariciones públicas, incluso desde un borrador, sin
publicar otros cambios pendientes de los demás álbumes. El orden, portada y
visibilidad se conservan por álbum. Cambiar las opciones de crédito conserva el
flujo de revisión: usa **Regenerar crédito** para aplicarlas a los archivos WebP.

**Quitar del álbum** conserva la foto para reutilizarla. **Eliminar definitivamente**
solo aparece en el selector para fotografías sin álbumes. El repositorio vuelve a
comprobar las asociaciones dentro de una transacción antes de borrar archivos.
Si Storage falla, el selector permite reintentar la eliminación; la foto queda
bloqueada para nuevas asociaciones mientras tanto. La última fotografía visible
de un álbum publicado no puede quitarse ni ocultarse: primero retira el álbum.

Cargar archivos con nombres iguales crea fotografías distintas. **Reemplazar
archivo** es una acción explícita que cambia la imagen en todos sus álbumes.
Resolver duplicados solo quita asociaciones del álbum actual.

### Migración al modelo compartido

La herramienta trabaja únicamente con una exportación JSON local de la **raíz**
de Realtime Database. No se conecta a Firebase ni importa datos automáticamente.
Sin migración, el nuevo administrador permite consultar los álbumes anteriores,
pero bloquea su edición. Una base nueva y vacía se inicializa al guardar.

```sh
# Simulación: no crea ni modifica archivos.
node --import tsx scripts/migrate-shared-photos.mjs /ruta/exportacion.json

# Crea un respaldo privado junto al original y un archivo nuevo para importar.
# Nunca sobrescribe la exportación ni una salida existente.
node --import tsx scripts/migrate-shared-photos.mjs /ruta/exportacion.json \
  --apply --output /ruta/migrado.json
```

La conversión conserva URLs, archivos, orden, portadas, visibilidad y los
snapshots públicos existentes. No fusiona por nombre; si dos registros antiguos
comparten ID, asigna otro ID a la colisión y remapea sus referencias. Repetir la
conversión sobre una exportación con versión 2 no vuelve a convertirla.

Para una publicación posterior autorizada:

1. Pausa la edición y cierra todas las sesiones de administración. Exporta la
   raíz desde Firebase Console y conserva el respaldo fuera del repositorio.
2. Ejecuta la simulación y conversión; verifica el resultado en un emulador o
   proyecto de prueba antes de importar datos reales.
3. Manteniendo la pausa, despliega las reglas revisadas e importa la exportación
   convertida desde Console. Publica después el nuevo Hosting y abre una sesión
   nueva para verificar el selector, un álbum compartido y la galería pública.
4. Si hay que revertir antes de reanudar la edición, restaura el respaldo,
   las reglas y Hosting de la versión anterior durante la misma pausa. No uses
   un respaldo antiguo para revertir después de nuevas ediciones.

Las reglas permiten al mismo UID administrador leer y escribir la raíz para
coordinar fotografías y snapshots públicos en una transacción. Los visitantes
siguen leyendo solo `/public`; `/private` y los originales conservan su acceso
privado. Las reglas rechazan fotos embebidas del administrador antiguo tras
activar la versión 2 y prohíben `originalPath` en snapshots públicos.

### Validación con emulador

Además de `pnpm check` y `pnpm test:e2e`, con Java y Firebase CLI instalados:

```sh
firebase emulators:exec --project demo-gallery-shared --only database \
  'node --import tsx --test test/integration/shared-photos.test.ts'
```

Estas pruebas rechazan direcciones de emulador que no sean locales. Cubren
permisos, asociaciones, propagación pública, conflictos entre sesiones y
reintentos de eliminación sin tocar servicios reales.
