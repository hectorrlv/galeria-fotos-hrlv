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

Las reglas reservan `/private` y `/originals` para el administrador. Los
visitantes solo pueden leer `/public` en Database y Storage.

## Modelo de datos

- `/private/albums/{albumId}` conserva borradores, originales y configuración
  de trabajo.
- `/public/albums/{albumId}` contiene snapshots sanitizados de álbumes
  publicados.
- `/private/site` y `/public/site` contienen la identidad y los valores
  predeterminados del crédito.
- `originals/{albumId}/{photoId}` guarda el archivo intacto.
- `public/{albumId}/{photoId}` guarda miniatura, cuadrícula y visor en WebP.

## Flujo editorial

1. Entra a `/admin` con Google o correo y contraseña.
2. Configura el nombre y el texto real del crédito fotográfico.
3. Crea un álbum, agrega su relato y carga fotografías.
4. Revisa orden, metadatos, portada, visibilidad y contraste del crédito.
5. Publica el álbum para generar su snapshot público de forma atómica.

La generación de derivados ocurre en el navegador. El original se carga por
separado y nunca se modifica. Retirar un álbum elimina su snapshot de Database,
pero conserva el borrador privado y sus archivos.
