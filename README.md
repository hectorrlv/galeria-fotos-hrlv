# Galería de fotos HRLV

Aplicación Lit para organizar y publicar álbumes fotográficos de viajes y
paseos. Este primer hito contiene el shell navegable y la preparación técnica;
la galería, la administración y la conexión real con Firebase se implementarán
en etapas posteriores.

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
