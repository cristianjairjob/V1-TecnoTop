# Revisión de localidades del checkout

Fuente: https://www.datos.gov.co/Mapas-Nacionales/DIVIPOLA-C-digos-municipios/gdxc-w37w (DANE). Consulta completa mediante API con límite de 5000 filas.

Resultado: 32 departamentos y Bogotá D.C.; 1122 registros de municipios, isla y áreas no municipalizadas. Comparación por código: cero faltantes, cero sobrantes y cero diferencias de nombre de municipio o departamento asignado. No es un catálogo de barrios ni de todos los centros poblados.

Cúcuta ya figuraba como SAN JOSÉ DE CÚCUTA (54001), Norte de Santander. Se presenta como CÚCUTA (SAN JOSÉ DE CÚCUTA), sin modificar el valor oficial guardado.

La búsqueda filtra por inicio del nombre o alias y no distingue tildes ni mayúsculas. Cambiar departamento elimina la selección anterior de ciudad. Solo se envían opciones válidas del catálogo; se conserva la validación del servidor.
