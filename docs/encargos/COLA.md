# Cola de encargos

Trabajo identificado que todavía no es encargo. Cada uno pasa a encargo con la plantilla (`PLANTILLA.md`) cuando
Esteban lo asigna, y entonces sale de esta lista. Orden de llegada; no implica prioridad.

| Nombre | Desde | Qué | Origen |
|---|---|---|---|
| `bitacora-filtro-servidor` | 19/11/2026 | La bitácora del staff (`/admin/bitacora`) carga los últimos 500 eventos y filtra en el navegador. Lo anterior no se puede ver aunque se filtre por cliente, acción o fecha: en staging, los 54 eventos de la precarga de O'Donnell («Precarga por IRStrat», 11/11) ya están fuera de los últimos 500, con 891 posteriores. Los filtros tienen que ir al servidor, con paginación. | Despliegue v48, comprobación 14 (especificación §10) |
