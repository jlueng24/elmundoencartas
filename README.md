# Cartas del Mundo — versión 5.1 (ligas y progreso en Google)

## Subir a GitHub Pages

Descomprime el ZIP y sube **el contenido de esta carpeta** a la raíz del repositorio. `index.html` debe quedar en la raíz, junto a `app.js`, `country-mysteries.js`, `country-card-data.js`, `achievements.js`, `achievements.json` y `countries-local.json`. Conserva toda la carpeta `img`: contiene los logros y el icono `cartas-icon.svg`. GitHub no ejecuta la aplicación si solo subes el archivo ZIP.

Al actualizar un sitio ya publicado, reemplaza los archivos existentes por los de esta versión. El progreso anterior permanece guardado en el navegador del jugador.

La primera pantalla pide el nombre de jugador. «Continuar» lleva a la selección de Banderas, Capitales, Mixto, Supervivencia, Estudio o Misterio del día. Las reglas y el progreso de las partidas anteriores se conservan. El final ahora muestra los aciertos y solo las cartas o logros nuevos; las partidas perfectas tienen un tratamiento propio.

En móvil, tanto la pantalla del jugador como la selección de modo muestran accesos directos a **Álbum**, **Logros** y **Liga**. En pantallas grandes, esos accesos siguen en la navegación lateral.

## Ligas entre amigos: conexión de la nube

El proyecto publicado utiliza Supabase para las ligas privadas y para el progreso personal asociado a cada cuenta de Google. Sin sesión, el juego libre sigue guardándose en el navegador y se puede importar al entrar con Google.

1. En un proyecto nuevo de [Supabase](https://supabase.com/), ejecuta en orden `supabase/001_private_leagues.sql` y `supabase/002_player_progress.sql` una sola vez. En el proyecto `elmundoencartas` ambas migraciones ya están aplicadas. Crean las ligas y el progreso por cuenta, con políticas de acceso por usuario.
2. En Google Cloud, configura una aplicación OAuth para web. En **Authorized redirect URIs** añade la dirección que muestra Supabase para Google: `https://TU-PROYECTO.supabase.co/auth/v1/callback`. Copia el identificador y el secreto de Google al proveedor **Google** de Supabase Auth. Si la aplicación de Google está en modo de pruebas, añade los correos de los amigos como usuarios de prueba.
3. En **Supabase → Authentication → URL Configuration**, pon la URL pública exacta de tu juego como Site URL y en Redirect URLs. Para GitHub Pages de un repositorio, sería del tipo `https://USUARIO.github.io/REPOSITORIO/`. Incluye también cualquier otra URL desde la que vayas a probar el juego.
4. En **Project Settings → API Keys** copia la **publishable key** y la URL del proyecto a `cloud-config.js`. Por ejemplo:

   ```js
   window.CARTAS_CLOUD = {
     url: 'https://TU-PROYECTO.supabase.co',
     publishableKey: 'sb_publishable_...'
   };
   ```

   La clave publicable se puede incluir en GitHub Pages. No incluyas la clave secreta ni `service_role` en ningún archivo del juego.
5. Publica `cloud-config.js`, `cloud-progress.js`, `cloud-leagues.js` y los demás archivos en GitHub Pages. La carpeta `supabase` documenta las migraciones y no se ejecuta en GitHub. Entra en Liga, inicia sesión con Google, crea una liga e invita a otra cuenta para comprobar la clasificación.

### Reglas de liga

Cada semana, de lunes a domingo según la hora de Madrid, cambia la región común entre Europa, Asia, América, África y Oceanía. Banderas, Capitales, Mixto, Estudio y las tres variantes de Supervivencia usan la misma selección y orden de países para todos los miembros. La dificultad es Adultos. Cada jugador dispone de tres intentos por reto y cuenta su mejor resultado.

Banderas, Capitales y Mixto dan 10 puntos por acierto (máximo 100). Estudio da 10 puntos por cada respuesta acertada a la primera en sus diez preguntas iniciales; los reintentos sirven para aprender, pero no suben la puntuación de liga. Supervivencia puntúa por el porcentaje completado; para la general se calcula la media de sus tres variantes. El Misterio del día suma 10 puntos por acierto (máximo 70 en una semana), aunque se hayan usado pistas. Hay clasificación general y tablas por modo.

Los intentos se reservan al comenzar. Salir, cerrar la página o perder la conexión durante un reto consume ese intento. Si un resultado termina mientras falla la conexión, se guarda temporalmente en este navegador para reintentar la subida. El botón «Actualizar» vuelve a comprobar los resultados. Las partidas libres no gastan intentos ni suman a la liga.

El nombre, el álbum (incluidos favoritos), los pines del misterio, los logros, el historial, las estadísticas y las rachas se sincronizan con la cuenta de Google. El progreso existente en el navegador se importa al iniciar sesión; si se juega sin conexión, los cambios quedan allí y se reintentan más tarde. Los cambios en varios dispositivos se combinan sin volver a bloquear cartas o logros y sin duplicar partidas ya sincronizadas. Al salir de la cuenta, su progreso se conserva por separado en ese navegador. Los resultados de liga se comparten solo con sus miembros mediante las políticas de la base de datos. Esta versión es una competición amistosa: como las preguntas se ejecutan en el navegador, una persona que manipule el código puede falsear respuestas. Para una competición pública con premios hará falta validar cada respuesta en un servidor.

## Misterio del día: países

Cada fecha local selecciona el mismo país de un conjunto estable de 199 países del catálogo; se excluyen los territorios dependientes. La silueta aparece desde el principio con cuatro opciones fijas de la misma región. Las alternativas se eligen por subregión, proximidad y tamaño cuando los datos lo permiten. El jugador puede abrir hasta tres pistas de texto antes de elegir. Tiene **una sola respuesta**: si acierta, consigue el pin con independencia de las pistas abiertas; si falla, aparece el país correcto y termina el reto. Las pistas abiertas se guardan aunque cierre la ventana. El resultado y el pin quedan asociados al país; un pin puede mostrar su carta aunque la bandera y la capital aún estén pendientes. Los retos ya terminados conservan su resultado y los pines históricos cuyo país se hubiese guardado.

La silueta tiene un SVG independiente, ajustado a su espacio para que no se salga de la tarjeta. Se puede responder directamente al verla, sin abrir pistas.

Los 199 países tienen una ficha propia en `country-mysteries.js`. Se elige una pista difícil y dos de nivel intermedio sin repetir exactamente el mismo dato, de forma estable para cada fecha. Las categorías son río, montaña, monumento, ciudad distinta de la capital nacional, equipo de fútbol, frontera, moneda, idioma, personaje y silueta. Se incluyen 1.591 pistas candidatas en total. Cada pista conserva un enlace de fuente a Wikipedia en la ficha; los datos de monedas, idiomas y fronteras proceden también del catálogo mledoze/countries. Las categorías concretas varían según el país: una isla sin fronteras terrestres, por ejemplo, no recibe esa pista.

Los pines mantienen un marco dorado común. España, Japón e Islandia incorporan ilustraciones específicas; los demás utilizan la silueta individual del país con una combinación de color estable.

## Catálogos

- Europa tiene 45 países en `countries-local.json`, disponible aunque falle la carga mundial.
- El catálogo mundial se obtiene de [mledoze/countries](https://github.com/mledoze/countries), con licencia ODbL 1.0, y se guarda localmente tras una carga correcta. Si esa descarga falla, la aplicación muestra el alcance disponible y permite jugar Europa; no presenta 45 países como si fueran todo el mundo.
- Las banderas se muestran desde FlagCDN. Las imágenes de logros, en cambio, están incluidas en `img/logros`.
- Las cartas comparten un diseño para todos los continentes. El número XX001/999 se calcula por orden alfabético del catálogo disponible dentro de la región; el total incluye también los países sin descubrir. Si se usa el catálogo europeo de respaldo, España es EU016/045. Al regresar el catálogo mundial, su numeración refleja ese catálogo completo.
- Las siluetas se incluyen en `country-card-data.js`, adaptadas de [MapSVG](https://mapsvg.com/maps/world) bajo [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). La silueta de Antártida se derivó del GeoJSON de [mledoze/countries](https://github.com/mledoze/countries) (ODbL 1.0). Las monedas incluidas para uso sin conexión mundial proceden del mismo catálogo mledoze/countries (ODbL 1.0). La fuente y licencia del mapa también aparecen al pie del álbum.

## Verificación técnica

Ejecuta `node tests/smoke.cjs`, `node tests/cloud.cjs` y `node tests/progress.cjs`. Comprueban el juego, las ligas simuladas, la importación de progreso, la mezcla entre dos dispositivos y el cambio de cuenta. La política de acceso de `game_player_progress` se ha comprobado en Supabase con dos identidades simuladas dentro de una transacción revertida. El primer inicio de sesión real tras publicar esta versión verificará el traslado del historial existente.

El catálogo mundial se sigue cargando desde la fuente original al jugar; si no hay conexión, las partidas normales ofrecen el respaldo europeo, pero el Misterio del día utiliza las pistas y siluetas locales de los 199 países sin depender de esa descarga.
